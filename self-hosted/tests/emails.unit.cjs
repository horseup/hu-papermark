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
    discussions: ['2 new replies in a room-wide discussion', 'You were mentioned in a discussion about "SYNTHETIC-D2-deck.pdf"'], optOutUrl: optOut }]),
  'investor-update-two-rooms': investorUpdateEmail([
    { kind: 'updates', name: 'SYNTHETIC Fund A', url: `${app}/rooms/room1`, added: ['Teaser'], updated: [], discussions: [], optOutUrl: optOut },
    { kind: 'updates', name: 'SYNTHETIC Fund B', url: `${app}/rooms/room2`, added: [], updated: [], discussions: ['New reply in a room-wide discussion'], optOutUrl: `${optOut}2` }]),
  'access-ended': investorUpdateEmail([{ kind: 'ended', name: 'SYNTHETIC Fund A' }]),
  'admin-activity': adminActivityEmail([{ name: 'SYNTHETIC Fund A', url: `${app}/rooms/room1`, lines: [
    'investor@example.test accepted the invitation', 'investor@example.test opened the room for the first time',
    'investor@example.test wrote in a discussion about "SYNTHETIC-D2-deck.pdf"'] }]),
  'admin-activity-two-rooms': adminActivityEmail([
    { name: 'SYNTHETIC Fund A', url: `${app}/rooms/room1`, lines: ['investor@example.test wrote in a room-wide discussion'] },
    { name: 'SYNTHETIC Fund B', url: `${app}/rooms/room2`, lines: ['other@example.test accepted the invitation'] }]),
};

if (process.env.EMAIL_PREVIEW_DIR) {
  fs.mkdirSync(process.env.EMAIL_PREVIEW_DIR, { recursive: true });
  for (const [name, mail] of Object.entries(emails)) {
    fs.writeFileSync(path.join(process.env.EMAIL_PREVIEW_DIR, `${name}.html`), mail.html);
    fs.writeFileSync(path.join(process.env.EMAIL_PREVIEW_DIR, `${name}.txt`), `Subject: ${mail.subject}\n\n${mail.text}\n`);
  }
}

test('plain-text parts are unchanged from the text-only emails', () => {
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
    investorUpdateEmail([{ kind: 'updates', name: evilRoom, url: `${app}/rooms/room1`, added: [evilDoc], updated: [`${evilDoc} (version 2)`], discussions: [`New reply in a discussion about "${evilDoc}"`], optOutUrl: optOut }]),
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
