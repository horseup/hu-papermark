import { escapeHtml, heading, label, link, list, paragraph, renderEmail, safeHref, small, type Section } from './email-layout';

// Every deal room email, as a plain-text part plus an HTML part with the same
// content. Inputs are names and links only, never document content.
export type Email = { subject: string; text: string; html: string };

export function signInEmail(url: string): Email {
  return {
    subject: 'Your HorseUp Deal Room sign-in link',
    text: `Use this personal link to sign in:\n\n${url}\n\nIt expires in 15 minutes and can be used once. If you did not request it, you can ignore this email.`,
    html: renderEmail({
      title: 'Sign in to your deal room',
      preheader: 'Your personal link is valid for 15 minutes.',
      sections: [paragraph('Use this personal link to sign in.')],
      cta: { label: 'Sign in', url },
      afterCta: [paragraph('It expires in 15 minutes and can be used once. If you did not request it, you can ignore this email.'),
        small(`If the button does not work, copy this link into your browser:<br><a href="${safeHref(url)}" style="color: #9CA3AF; word-break: break-all;">${escapeHtml(url)}</a>`)],
    }),
  };
}

/** invitedBy is set when a room member, not HorseUp, sent the invitation. */
export function invitationEmail(roomName: string, roomUrl: string, invitedBy?: string): Email {
  const intro = invitedBy ? `${invitedBy} has invited you to ${roomName} in the HorseUp deal room.` : `You have been invited to ${roomName} in the HorseUp deal room.`;
  return {
    subject: `Your invitation to ${roomName}`,
    text: `${intro}\n\nOpen ${roomUrl} and sign in with this email address.\n\nThis invitation is personal. Access can be revoked by the room administrators.`,
    html: renderEmail({
      title: `Your invitation to ${roomName}`,
      preheader: 'Open the room with the email address this was sent to.',
      sections: [paragraph(intro), paragraph('Open the room and sign in with this email address.')],
      cta: { label: 'Open the room', url: roomUrl },
      footerNote: 'This invitation is personal. Access can be revoked by the room administrators.',
    }),
  };
}

export type InvestorRoomUpdate =
  | { kind: 'ended'; name: string }
  | { kind: 'updates'; name: string; url: string; added: string[]; updated: string[]; discussions: DiscussionUpdate[]; optOutUrl?: string };
/** One line per discussion: replies count THREAD_REPLY notices; a mention wins over replies. */
export type DiscussionUpdate = { replies: number; mentioned: boolean; topic: string };

export function discussionLine(d: DiscussionUpdate) {
  const what = d.mentioned ? 'You were mentioned in' : d.replies > 1 ? `${d.replies} new replies in` : 'New reply in';
  return `${what} ${d.topic}`;
}
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Inbox preview line: what changed, as counts, so it adds to the subject. */
export function investorPreheader(rooms: InvestorRoomUpdate[]) {
  const updates = rooms.filter((r): r is Extract<InvestorRoomUpdate, { kind: 'updates' }> => r.kind === 'updates');
  const ended = rooms.length - updates.length;
  const sum = (pick: (r: (typeof updates)[number]) => number) => updates.reduce((total, r) => total + pick(r), 0);
  const added = sum(r => r.added.length), updated = sum(r => r.updated.length);
  const replies = sum(r => r.discussions.filter(d => !d.mentioned).reduce((n, d) => n + Math.max(1, d.replies), 0));
  const mentions = sum(r => r.discussions.filter(d => d.mentioned).length);
  const parts = [
    added ? count(added, 'new document', 'new documents') : '',
    updated ? count(updated, 'updated document', 'updated documents') : '',
    replies ? count(replies, 'reply', 'replies') : '',
    mentions ? count(mentions, 'mention', 'mentions') : '',
  ].filter(Boolean);
  if (ended) parts.push(updates.length ? `access ended in ${count(ended, 'room', 'rooms')}` : 'Reply to this email if you have questions.');
  return parts.join(', ');
}

export function investorUpdateEmail(rooms: InvestorRoomUpdate[]): Email {
  const updates = rooms.filter((r): r is Extract<InvestorRoomUpdate, { kind: 'updates' }> => r.kind === 'updates');
  const ended = rooms.filter(r => r.kind === 'ended');
  const subject = updates.length === 0
    ? (ended.length === 1 ? `Your access to ${ended[0].name} has ended` : 'Your access to HorseUp deal rooms has ended')
    : (updates.length === 1 && !ended.length ? `Updates in ${updates[0].name}` : 'Updates in your HorseUp deal rooms');
  const intro = updates.length ? 'There are updates in your HorseUp deal room. Sign in with this email address to see them.' : 'An update about your HorseUp deal room access.';
  const endedLine = (name: string) => `Your access to "${name}" has ended. If you have questions, reply to this email.`;
  const optOuts = updates.flatMap(r => r.optOutUrl ? [{ room: r.name, url: r.optOutUrl }] : []);
  const footerNote = 'You receive these emails because you were invited to the room above. Reply to this email to reach the HorseUp team.';

  const textSections = rooms.map(room => {
    if (room.kind === 'ended') return endedLine(room.name);
    const lines = [`"${room.name}"`];
    if (room.added.length) lines.push('', 'New documents available:', ...room.added.map(n => `- ${n}`));
    if (room.updated.length) lines.push('', 'Updated documents:', ...room.updated.map(n => `- ${n}`));
    if (room.discussions.length) lines.push('', 'Discussions:', ...room.discussions.map(d => `- ${discussionLine(d)}`));
    lines.push('', `Open the room: ${room.url}`);
    return lines.join('\n');
  });
  const footer = optOuts.length ? ['', '--', footerNote, ...optOuts.map(o => `Stop notification emails for "${o.room}": ${o.url}`)] : [];
  const text = ['Hello,', '', intro, '', textSections.join('\n\n'), ...footer].join('\n');

  const single = updates.length === 1 && rooms.length === 1;
  const sections: Section[] = [paragraph('Hello,'), paragraph(intro)];
  for (const room of rooms) {
    if (room.kind === 'ended') { sections.push(paragraph(endedLine(room.name))); continue; }
    if (!single) sections.push(heading(room.name));
    if (room.added.length) sections.push(label('New documents available:'), list(room.added));
    if (room.updated.length) sections.push(label('Updated documents:'), list(room.updated));
    if (room.discussions.length) sections.push(label('Discussions:'), list(room.discussions.map(discussionLine)));
    if (!single) sections.push(link(`Open ${room.name}`, room.url));
  }
  const html = renderEmail({
    title: updates.length ? (single ? `Updates in ${updates[0].name}` : 'Updates in your deal rooms') : 'Your deal room access has ended',
    preheader: investorPreheader(rooms),
    sections,
    cta: single ? { label: 'Open the room', url: updates[0].url } : undefined,
    afterCta: optOuts.length ? [small(escapeHtml(footerNote)), ...optOuts.map(o =>
      small(`<a href="${safeHref(o.url)}" style="color: #9CA3AF;">Stop notification emails for &quot;${escapeHtml(o.room)}&quot;</a>`))] : undefined,
  });
  return { subject, text, html };
}

export type AdminRoomActivity = { name: string; url: string; lines: string[] };

export function adminActivityEmail(rooms: AdminRoomActivity[]): Email {
  const subject = rooms.length === 1 ? `Deal room activity in ${rooms[0].name}` : `Deal room activity in ${rooms.length} rooms`;
  const text = ['Investor activity in the HorseUp deal room:', '',
    rooms.map(r => [r.name, ...r.lines.map(l => `- ${l}`), `Open: ${r.url}`].join('\n')).join('\n\n')].join('\n');
  const single = rooms.length === 1;
  const sections: Section[] = [paragraph('Investor activity in the HorseUp deal room:')];
  for (const room of rooms) {
    sections.push(heading(room.name), list(room.lines));
    if (!single) sections.push(link(`Open ${room.name}`, room.url));
  }
  const total = rooms.reduce((n, r) => n + r.lines.length, 0);
  const first = rooms.find(r => r.lines.length);
  const preheader = first ? `${rooms.length > 1 ? `${first.name}: ` : ''}${first.lines[0]}${total > 1 ? ` (+${total - 1} more)` : ''}` : 'Investor activity in the HorseUp deal room';
  return { subject, text, html: renderEmail({ title: 'Investor activity', preheader, sections, cta: single ? { label: 'Open the room', url: rooms[0].url } : undefined }) };
}
