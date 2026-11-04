import { useState } from 'react';
import { action } from '../lib/client';
import type { Anchor, Discussion, RoomData } from '../lib/room-types';
import type { Point } from '../lib/anchor';

export type Reference = { documentId: string; versionId: string; page: number };

// Administrators and accepted, current room members: the only people a mention may name.
export function roomPeople(data: RoomData) {
  return [...data.administrators, ...data.members.filter(m => m.acceptedAt && !m.revokedAt && m.userId).map(m => ({ id: m.userId!, email: m.email }))]
    .filter((p, index, all) => all.findIndex(other => other.id === p.id) === index);
}

function Mentions({ data, selected, toggle }: { data: RoomData; selected: string[]; toggle: (id: string) => void }) {
  const people = roomPeople(data).filter(p => p.id !== data.actor.id);
  if (!people.length) return null;
  return <div className="mention-chips" role="group" aria-label="Mention people">{people.map(p => <button type="button" key={p.id} className={`chip${selected.includes(p.id) ? ' on' : ''}`} aria-pressed={selected.includes(p.id)} onClick={() => toggle(p.id)}>@{p.email}</button>)}</div>;
}

function useToggle() {
  const [ids, setIds] = useState<string[]>([]);
  return [ids, (id: string) => setIds(current => current.includes(id) ? current.filter(x => x !== id) : [...current, id]), () => setIds([])] as const;
}

// Centered under the anchor's end, kept away from the page edges.
const place = (at: Point) => ({ left: `${Math.min(0.8, Math.max(0.2, at.left)) * 100}%`, top: `calc(${Math.min(at.top, 1) * 100}% + 8px)` });

export function CommentBubble({ at, onComment }: { at: Point; onComment: () => void }) {
  return <div className="inline-pop bubble" style={place(at)}><button type="button" onMouseDown={event => event.preventDefault()} onClick={onComment}>Comment</button></div>;
}

export function InlineComposer({ data, anchor, reference, at, refresh, onDone, onCancel }: {
  data: RoomData; anchor: Anchor; reference: Reference; at: Point; refresh: () => Promise<void>; onDone: (id: string) => void; onCancel: () => void;
}) {
  const [body, setBody] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [mentions, toggle] = useToggle();
  const [requestId] = useState(() => crypto.randomUUID());
  async function post() {
    if (!body.trim()) { setError('Write a comment first.'); return; }
    setBusy(true); setError('');
    try {
      const title = (anchor.quote || 'Comment on an area of the page').slice(0, 120);
      const result = await action<{ id: string; warning?: string }>('createDiscussion', { roomId: data.room.id, title, body, documentId: reference.documentId, versionId: reference.versionId, pageNumber: reference.page, anchor, mentionIds: mentions, requestId });
      await refresh(); onDone(result.id);
      if (result.warning) window.alert(String(result.warning));
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }
  return <div className="inline-pop" style={place(at)} role="dialog" aria-label="New comment">
    <p className="muted small">Visible to everyone in this room and the HorseUp team.</p>
    {anchor.quote && <blockquote>{anchor.quote.length > 160 ? `${anchor.quote.slice(0, 160)}…` : anchor.quote}</blockquote>}
    <label className="sr-only" htmlFor="inline-body">Comment</label>
    <textarea id="inline-body" autoFocus value={body} maxLength={20000} onChange={e => { setBody(e.target.value); setError(''); }} placeholder="Ask about this passage" />
    <Mentions data={data} selected={mentions} toggle={toggle} />
    {error && <p role="alert" className="error small">{error}</p>}
    <div className="pop-actions"><button type="button" className="quiet" onClick={onCancel}>Cancel</button><button type="button" disabled={busy} onClick={post}>{busy ? 'Posting…' : 'Post'}</button></div>
  </div>;
}

export function InlineThread({ data, discussion, number, at, refresh, onClose }: {
  data: RoomData; discussion: Discussion; number: number; at: Point; refresh: () => Promise<void>; onClose: () => void;
}) {
  const [body, setBody] = useState(''); const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [mentions, toggle, clear] = useToggle();
  const people = roomPeople(data);
  async function run(name: string, values: Record<string, unknown>) {
    setBusy(true); setError('');
    try { const result = await action(name, { roomId: data.room.id, discussionId: discussion.id, ...values }); await refresh(); if (result.warning) setError(String(result.warning)); return true; }
    catch (err) { setError((err as Error).message); return false; } finally { setBusy(false); }
  }
  const canResolve = data.actor.admin || data.actor.id === discussion.createdById;
  return <div className="inline-pop thread-pop" style={place(at)} role="dialog" aria-label={`Comment ${number}`}>
    <div className="pop-head"><span className="pdf-pin static">{number}</span><span className="muted small">{discussion.resolvedAt ? 'Resolved' : `Page ${discussion.pageNumber}`}</span><button type="button" className="quiet icon" aria-label="Close" onClick={onClose}>×</button></div>
    {discussion.anchor?.quote && <blockquote>{discussion.anchor.quote.length > 160 ? `${discussion.anchor.quote.slice(0, 160)}…` : discussion.anchor.quote}</blockquote>}
    <div className="pop-messages">{discussion.messages.map(m => <div className="message" key={m.id}><strong>{m.author.name || m.author.email}</strong><time dateTime={m.createdAt}>{new Date(m.createdAt).toLocaleString()}</time><p>{m.body}</p>
      {m.mentions.length > 0 && <small>Mentioned: {m.mentions.map(x => people.find(p => p.id === x.userId)?.email || 'Former room member').join(', ')}</small>}</div>)}</div>
    {!discussion.resolvedAt && <><label className="sr-only" htmlFor="inline-reply">Reply</label>
      <textarea id="inline-reply" value={body} maxLength={20000} onChange={e => { setBody(e.target.value); setError(''); }} placeholder="Reply" />
      <Mentions data={data} selected={mentions} toggle={toggle} /></>}
    {error && <p role="alert" className="error small">{error}</p>}
    <div className="pop-actions">{canResolve ? <button type="button" className="quiet" disabled={busy} onClick={() => run('resolveDiscussion', { resolved: !discussion.resolvedAt })}>{discussion.resolvedAt ? 'Reopen' : 'Resolve'}</button> : <span />}
      {!discussion.resolvedAt && <button type="button" disabled={busy} onClick={async () => {
        if (!body.trim()) { setError('Write a reply first.'); return; }
        if (await run('reply', { body, mentionIds: mentions, requestId: crypto.randomUUID() })) { setBody(''); clear(); }
      }}>Reply</button>}</div>
  </div>;
}
