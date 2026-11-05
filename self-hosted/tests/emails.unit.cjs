// Email rendering tests. Pure functions only: no database, no network, no email.
// Set EMAIL_PREVIEW_DIR to also write each rendered HTML email there for review.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText;
  module._compile(code, filename);
};
const { signInEmail, invitationEmail, investorUpdateEmail, adminActivityEmail } = require('../lib/emails.ts');
const { safeHref } = require('../lib/email-layout.ts');
process.env.HORSEUP_EMAIL_FROM = 'HorseUp <noreply@example.test>';
process.env.NEXTAUTH_URL = 'https://dealroom.example.test';
const mail = require('../lib/mail.ts');
const SENDER = 'HorseUp Deal Room';

const app = 'https://dealroom.example.test';
const signInUrl = `${app}/api/auth/callback/email?callbackUrl=https%3A%2F%2Fdealroom.example.test%2F&token=abc123&email=investor%2Btest%40example.test`;
const optOut = `${app}/unsubscribe?m=membership1&t=signature_-1`;
const evilRoom = 'Fund <script>alert("x")</script> & Co\'s';
const evilDoc = '<img src=x onerror=alert(1)>.pdf';

const emails = {
  'sign-in': signInEmail(signInUrl),
  invitation: invitationEmail('SYNTHETIC Fund A', `${app}/rooms/room1`),
  'investor-update': investorUpdateEmail([{ kind: 'updates', name: 'SYNTHETIC Fund A', url: `${app}/rooms/room1`,
    added: ['SYNTHETIC-D2-deck.pdf', 'Teaser'], updated: ['SYNTHETIC-D3-financials.pdf (version 2)'],
    discussions: [{ replies: 2, mentioned: false, topic: 'a room-wide discussion' }, { replies: 1, mentioned: true, topic: 'a discussion about "SYNTHETIC-D2-deck.pdf"' }], optOutUrl: optOut }]),
  'investor-update-two-rooms': investorUpdateEmail([
    { kind: 'updates', name: 'SYNTHETIC Fund A', url: `${app}/rooms/room1`, added: ['Teaser'], updated: [], discussions: [], optOutUrl: optOut },
    { kind: 'updates', name: 'SYNTHETIC Fund B', url: `${app}/rooms/room2`, added: [], updated: [], discussions: [{ replies: 1, mentioned: false, topic: 'a room-wide discussion' }], optOutUrl: `${optOut}2` }]),
  'access-ended': investorUpdateEmail([{ kind: 'ended', name: 'SYNTHETIC Fund A' }]),
  'admin-activity': adminActivityEmail([{ name: 'SYNTHETIC Fund A', url: `${app}/rooms/room1`, lines: [
    'investor@example.test accepted the invitation', 'investor@example.test opened the room for the first time',
    'investor@example.test wrote in a discussion about "SYNTHETIC-D2-deck.pdf"'] }]),
  'admin-activity-two-rooms': adminActivityEmail([
    { name: 'SYNTHETIC Fund A', url: `${app}/rooms/room1`, lines: ['investor@example.test wrote in a room-wide discussion'] },
    { name: 'SYNTHETIC Fund B', url: `${app}/rooms/room2`, lines: ['other@example.test accepted the invitation'] }]),
};

const preheaderOf = html => /<div style="display: none;[^"]*">([^<&]*(?:&(?!zwnj;|#847;)[^<&]*)*)/.exec(html)[1]
  .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

if (process.env.EMAIL_PREVIEW_DIR) {
  const dir = process.env.EMAIL_PREVIEW_DIR;
  fs.mkdirSync(dir, { recursive: true });
  for (const [name, item] of Object.entries(emails)) {
    fs.writeFileSync(path.join(dir, `${name}.html`), item.html);
    fs.writeFileSync(path.join(dir, `${name}.txt`), `Subject: ${item.subject}\n\n${item.text}\n`);
  }
  // Approximation of an inbox list: sender, subject, then the preheader in grey.
  const esc = v => v.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const rows = Object.entries(emails).map(([name, item]) => `<tr><td class="s">${SENDER}</td><td><b>${esc(item.subject)}</b><span class="p"> – ${esc(preheaderOf(item.html))}</span></td><td class="n">${name}</td></tr>`).join('');
  fs.writeFileSync(path.join(dir, 'inbox-list.html'), `<!DOCTYPE html><meta charset="utf-8"><style>body{font:14px Arial,sans-serif;margin:16px;color:#202124}table{border-collapse:collapse;width:100%}td{padding:9px 10px;border-bottom:1px solid #eee;white-space:nowrap}td.s{font-weight:bold;width:150px}.p{color:#5f6368}td.n{color:#aaa;font-size:11px}</style><table>${rows}</table>`);
  fs.writeFileSync(path.join(dir, 'inbox-list.txt'), Object.entries(emails).map(([name, item]) => `${name}\n  ${SENDER} | ${item.subject} – ${preheaderOf(item.html)}`).join('\n') + '\n');
}

test('every HTML email starts with a hidden preheader that adds to the subject', () => {
  const expected = {
    'sign-in': 'Your personal link is valid for 15 minutes.',
    invitation: 'Open the room with the email address this was sent to.',
    'investor-update': '2 new documents, 1 updated document, 2 replies, 1 mention',
    'investor-update-two-rooms': '1 new document, 1 reply',
    'access-ended': 'Reply to this email if you have questions.',
    'admin-activity': 'investor@example.test accepted the invitation (+2 more)',
    'admin-activity-two-rooms': 'SYNTHETIC Fund A: investor@example.test wrote in a room-wide discussion (+1 more)',
  };
  for (const [name, item] of Object.entries(emails)) {
    assert.equal(preheaderOf(item.html), expected[name], name);
    const body = item.html.slice(item.html.indexOf('<body'));
    assert.match(body, /^<body[^>]*>\s*<div style="display: none;[^"]*max-height: 0;[^"]*overflow: hidden; mso-hide: all;">/, name);
    assert.ok(body.includes('&#847;&zwnj;&nbsp;'.repeat(20)), name);
    assert.ok(!item.text.includes(expected[name]) || name === 'sign-in', `${name}: text part stays unchanged`);
  }
  const mixed = investorUpdateEmail([{ kind: 'ended', name: 'A' }, { kind: 'updates', name: 'B', url: `${app}/rooms/b`, added: ['Deck'], updated: [], discussions: [] }]);
  assert.equal(preheaderOf(mixed.html), '1 new document, access ended in 1 room');
  assert.ok(preheaderOf(investorUpdateEmail([{ kind: 'updates', name: evilRoom, url: `${app}/rooms/r`, added: [], updated: [], discussions: [] }]).html) === '');
  const hostile = adminActivityEmail([{ name: evilRoom, url: `${app}/rooms/r`, lines: ['<b>x</b> wrote'] }]).html;
  assert.ok(hostile.includes('mso-hide: all;">&lt;b&gt;x&lt;/b&gt; wrote'));
});

test('sign-in, invitation and notifications all send as "HorseUp Deal Room" from the configured address', async () => {
  const sent = [];
  mail.setMailTransport(async message => { sent.push(message); });
  try {
    await mail.sendRoomInvite('investor@example.test', 'SYNTHETIC Fund A', 'room1');
    const signIn = signInEmail(signInUrl);
    await mail.sendMail('investor@example.test', signIn.subject, signIn.text, { html: signIn.html });
  } finally { mail.setMailTransport(null); }
  assert.deepEqual(sent.map(m => m.from), ['HorseUp Deal Room <noreply@example.test>', 'HorseUp Deal Room <noreply@example.test>']);
  assert.equal(sent[0].subject, 'Your invitation to SYNTHETIC Fund A');
  assert.ok(sent[0].html.includes(`href="${app}/rooms/room1"`) && sent[1].html.includes('>Sign in</a>'));
  assert.equal(mail.senderWithName('noreply@example.test', 'HorseUp Deal Room'), 'HorseUp Deal Room <noreply@example.test>');
});

test('plain-text parts are unchanged from the text-only emails', () => {
  assert.equal(emails['sign-in'].subject, 'Your HorseUp Deal Room sign-in link');
  assert.equal(emails['sign-in'].text, `Use this personal link to sign in:\n\n${signInUrl}\n\nIt expires in 15 minutes and can be used once. If you did not request it, you can ignore this email.`);
  assert.equal(emails.invitation.subject, 'Your invitation to SYNTHETIC Fund A');
  assert.equal(emails.invitation.text, `You have been invited to SYNTHETIC Fund A in the HorseUp deal room.\n\nOpen ${app}/rooms/room1 and sign in with this email address.\n\nThis invitation is personal. Access can be revoked by the room administrators.`);
  assert.equal(emails['investor-update'].subject, 'Updates in SYNTHETIC Fund A');
  assert.equal(emails['investor-update'].text, ['Hello,', '', 'There are updates in your HorseUp deal room. Sign in with this email address to see them.', '',
    '"SYNTHETIC Fund A"', '', 'New documents available:', '- SYNTHETIC-D2-deck.pdf', '- Teaser', '', 'Updated documents:', '- SYNTHETIC-D3-financials.pdf (version 2)',
    '', 'Discussions:', '- 2 new replies in a room-wide discussion', '- You were mentioned in a discussion about "SYNTHETIC-D2-deck.pdf"', '', `Open the room: ${app}/rooms/room1`,
    '', '--', 'You receive these emails because you were invited to the room above. Reply to this email to reach the HorseUp team.',
    `Stop notification emails for "SYNTHETIC Fund A": ${optOut}`].join('\n'));
  assert.equal(emails['access-ended'].subject, 'Your access to SYNTHETIC Fund A has ended');
  assert.equal(emails['access-ended'].text, 'Hello,\n\nAn update about your HorseUp deal room access.\n\nYour access to "SYNTHETIC Fund A" has ended. If you have questions, reply to this email.');
  assert.equal(emails['admin-activity'].subject, 'Deal room activity in SYNTHETIC Fund A');
  assert.equal(emails['admin-activity'].text, ['Investor activity in the HorseUp deal room:', '', 'SYNTHETIC Fund A', '- investor@example.test accepted the invitation',
    '- investor@example.test opened the room for the first time', '- investor@example.test wrote in a discussion about "SYNTHETIC-D2-deck.pdf"', `Open: ${app}/rooms/room1`].join('\n'));
  assert.equal(emails['admin-activity-two-rooms'].subject, 'Deal room activity in 2 rooms');
});

test('the room or sign-in link is the call to action, with the link encoding kept intact', () => {
  const button = url => `<a href="${url.replace(/&/g, '&amp;')}" style="display: inline-block; background-color: #027C81;`;
  assert.ok(emails['sign-in'].html.includes(button(signInUrl)));
  assert.ok(emails['sign-in'].html.includes('>Sign in</a>'));
  assert.ok(!emails['sign-in'].html.includes('%25'), 'percent-encoded parameters must not be double-encoded');
  assert.ok(emails.invitation.html.includes(button(`${app}/rooms/room1`)));
  assert.ok(emails['investor-update'].html.includes(button(`${app}/rooms/room1`)));
  assert.ok(emails['admin-activity'].html.includes(button(`${app}/rooms/room1`)));
  // Several rooms: one link per room instead of a single button.
  for (const name of ['investor-update-two-rooms', 'admin-activity-two-rooms']) {
    assert.ok(!emails[name].html.includes('background-color: #027C81;'), name);
    assert.ok(emails[name].html.includes(`href="${app}/rooms/room1"`) && emails[name].html.includes(`href="${app}/rooms/room2"`), name);
  }
  assert.ok(!emails['access-ended'].html.includes('background-color: #027C81;'));
});

test('unsubscribe links stay in the HTML part', () => {
  const href = url => `href="${url.replace(/&/g, '&amp;')}"`;
  assert.ok(emails['investor-update'].html.includes(href(optOut)));
  assert.ok(emails['investor-update-two-rooms'].html.includes(href(`${optOut}2`)));
  assert.ok(!emails['access-ended'].html.includes('unsubscribe'));
});

test('every interpolated value is escaped', () => {
  const mails = [
    invitationEmail(evilRoom, `${app}/rooms/room1`),
    investorUpdateEmail([{ kind: 'updates', name: evilRoom, url: `${app}/rooms/room1`, added: [evilDoc], updated: [`${evilDoc} (version 2)`], discussions: [{ replies: 1, mentioned: false, topic: `a discussion about "${evilDoc}"` }], optOutUrl: optOut }]),
    investorUpdateEmail([{ kind: 'ended', name: evilRoom }]),
    adminActivityEmail([{ name: evilRoom, url: `${app}/rooms/room1`, lines: [`"><script>x</script>@example.test wrote in a discussion about "${evilDoc}"`] }]),
  ];
  for (const mail of mails) {
    // No raw tag from user data survives; escaped text may still contain the words.
    assert.ok(!/<script|<img src=x|"><script/i.test(mail.html), mail.subject);
    assert.ok(mail.html.includes('&lt;script&gt;'), mail.subject);
  }
  assert.ok(mails[0].html.includes('Fund &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; Co&#39;s'));
  assert.ok(mails[1].html.includes('&lt;img src=x onerror=alert(1)&gt;.pdf'));
});

test('links must be http(s)', () => {
  assert.throws(() => safeHref('javascript:alert(1)'));
  assert.throws(() => invitationEmail('Room', 'javascript:alert(1)'));
  assert.equal(safeHref(`${app}/a?b=1&c="2"`), `${app}/a?b=1&amp;c=&quot;2&quot;`);
});

test('layout: logo, footer and 600px card', () => {
  for (const [name, mail] of Object.entries(emails)) {
    assert.ok(mail.html.startsWith('<!DOCTYPE html>'), name);
    assert.ok(mail.html.includes('<img src="https://horseup.de/logo.png" alt="HorseUp"'), name);
    assert.ok(mail.html.includes('&copy; 2026 HorseUp. All rights reserved.'), name);
    assert.ok(mail.html.includes('max-width: 600px'), name);
  }
});
