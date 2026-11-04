import { escapeHtml, heading, label, link, list, paragraph, renderEmail, safeHref, small, type Section } from './email-layout';

// Every deal room email, as a plain-text part plus an HTML part with the same
// content. Inputs are names and links only, never document content.
export type Email = { subject: string; text: string; html: string };

export function signInEmail(url: string): Email {
  return {
    subject: 'Sign in to HorseUp deal room',
    text: `Use this personal link to sign in:\n\n${url}\n\nIt expires in 15 minutes and can be used once. If you did not request it, you can ignore this email.`,
    html: renderEmail({
      title: 'Sign in to your deal room',
      sections: [paragraph('Use this personal link to sign in.')],
      cta: { label: 'Sign in', url },
      afterCta: [paragraph('It expires in 15 minutes and can be used once. If you did not request it, you can ignore this email.'),
        small(`If the button does not work, copy this link into your browser:<br><a href="${safeHref(url)}" style="color: #9CA3AF; word-break: break-all;">${escapeHtml(url)}</a>`)],
    }),
  };
}

export function invitationEmail(roomName: string, roomUrl: string): Email {
  return {
    subject: `Your invitation to ${roomName}`,
    text: `You have been invited to ${roomName} in the HorseUp deal room.\n\nOpen ${roomUrl} and sign in with this email address.\n\nThis invitation is personal. Access can be revoked by the room administrators.`,
    html: renderEmail({
      title: `Your invitation to ${roomName}`,
      sections: [paragraph(`You have been invited to ${roomName} in the HorseUp deal room.`), paragraph('Open the room and sign in with this email address.')],
      cta: { label: 'Open the room', url: roomUrl },
      footerNote: 'This invitation is personal. Access can be revoked by the room administrators.',
    }),
  };
}

export type InvestorRoomUpdate =
  | { kind: 'ended'; name: string }
  | { kind: 'updates'; name: string; url: string; added: string[]; updated: string[]; discussions: string[]; optOutUrl?: string };

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
    if (room.discussions.length) lines.push('', 'Discussions:', ...room.discussions.map(n => `- ${n}`));
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
    if (room.discussions.length) sections.push(label('Discussions:'), list(room.discussions));
    if (!single) sections.push(link(`Open ${room.name}`, room.url));
  }
  const html = renderEmail({
    title: updates.length ? (single ? `Updates in ${updates[0].name}` : 'Updates in your deal rooms') : 'Your deal room access has ended',
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
  return { subject, text, html: renderEmail({ title: 'Investor activity', sections, cta: single ? { label: 'Open the room', url: rooms[0].url } : undefined }) };
}
