import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { action } from '../lib/client';
import type { RoomData } from '../lib/room-types';

const INVITE_BATCH = 10;
const initials = (email: string) => email.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase() || '?';
const day = (value: string) => new Date(value).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });

/** Invite, resend, remove or leave. Administrators and accepted investors share this dialog; the server enforces who may do what. */
export function MembersModal({ data, refresh, open, onClose }: { data: RoomData; refresh: () => Promise<void>; open: boolean; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(''); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const archived = Boolean(data.room.archivedAt);
  useEffect(() => {
    const el = dialog.current; if (!el) return;
    if (open && !el.open) { setError(''); setNotice(''); el.showModal(); }
    if (!open && el.open) el.close();
  }, [open]);

  async function run(name: string, values: Record<string, unknown>, done?: string) {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await action(name, { roomId: data.room.id, ...values });
      if (result.warning) setError(String(result.warning)); else if (done) setNotice(done);
      await refresh(); return true;
    } catch (err) { setError((err as Error).message); return false; } finally { setBusy(false); }
  }
  async function invite(event: React.FormEvent) {
    event.preventDefault();
    const emails = [...new Set(draft.split(',').map(e => e.trim().toLowerCase()).filter(Boolean))];
    if (!emails.length) return;
    if (emails.length > INVITE_BATCH) { setError(`Invite up to ${INVITE_BATCH} people at a time.`); return; }
    if (await run('invite', { emails }, emails.length === 1 ? `Invitation sent to ${emails[0]}.` : `${emails.length} invitations sent.`)) setDraft('');
  }
  function remove(member: RoomData['members'][number]) {
    const self = member.userId === data.actor.id;
    if (!window.confirm(self ? 'Leave this room? You will lose access to its documents and discussions.' : `Remove ${member.email} from this room? They lose access immediately.`)) return;
    if (self) { action('revokeMember', { roomId: data.room.id, membershipId: member.id }).then(() => window.location.assign('/')).catch(err => setError(err.message)); return; }
    void run('revokeMember', { membershipId: member.id }, `${member.email} was removed.`);
  }
  const members = data.members.filter(m => !m.revokedAt);
  const team = data.administrators.filter(a => a.email);

  return <dialog ref={dialog} className="modal" aria-labelledby="members-title" onClose={onClose} onClick={e => { if (e.target === dialog.current) onClose(); }}>
    <div className="modal-body">
      <header className="modal-head">
        <div><h2 id="members-title">Members</h2><p className="muted small">{data.room.name} · {members.length} {members.length === 1 ? 'member' : 'members'}</p></div>
        <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X size={18} aria-hidden="true" /></button>
      </header>
      <form className="invite-form" onSubmit={invite}>
        <label>Invite by email<input type="text" inputMode="email" autoComplete="off" value={draft} onChange={e => setDraft(e.target.value)} placeholder="name@fund.com, another@fund.com" disabled={archived} /></label>
        <button className="solid" disabled={busy || archived || !draft.trim()}>Send invite</button>
      </form>
      <p className="muted small modal-hint">{archived ? 'This room is archived. Reopen it before inviting people.' : `Separate addresses with commas. Up to ${INVITE_BATCH} at a time.`}</p>
      {error && <p role="alert" className="error modal-hint">{error}</p>}
      {notice && <p role="status" className="modal-hint">{notice}</p>}
      <ul className="member-list">
        {team.map(a => <li key={a.id}><span className="avatar" aria-hidden="true">HU</span>
          <span className="member-main"><strong>{a.email}</strong><small>HorseUp team</small></span><span className="badge team">HorseUp</span><span className="member-actions" /></li>)}
        {members.map(m => {
          const self = m.userId === data.actor.id;
          return <li key={m.id}><span className="avatar" aria-hidden="true">{initials(m.email)}</span>
            <span className="member-main"><strong>{m.email}</strong><small>{self ? 'You' : m.acceptedAt ? `Joined ${day(m.acceptedAt)}` : `Invited ${day(m.invitedAt)}`}</small></span>
            <span className={`badge${m.acceptedAt ? '' : ' pending'}`}>{m.acceptedAt ? 'Joined' : 'Invited'}</span>
            <span className="member-actions">
              {!m.acceptedAt && !archived && <button type="button" className="link-btn" disabled={busy} onClick={() => run('invite', { emails: [m.email] }, `Invitation sent again to ${m.email}.`)}>Resend</button>}
              <button type="button" className="link-btn danger" disabled={busy} onClick={() => remove(m)} aria-label={self ? 'Leave this room' : `Remove ${m.email}`}>{self ? 'Leave' : 'Remove'}</button>
            </span></li>;
        })}
      </ul>
      <footer className="modal-foot">
        {!data.actor.admin && data.room.notificationsEnabled !== null
          ? <label className="check small"><input type="checkbox" checked={data.room.notificationsEnabled} disabled={busy}
            onChange={e => run('setRoomNotifications', { enabled: e.target.checked })} />Email me about new documents and replies</label>
          : <span className="muted small">Removed members lose access immediately and get an email.</span>}
        <button type="button" className="ghost" onClick={onClose}>Done</button>
      </footer>
    </div>
  </dialog>;
}
