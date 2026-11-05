import { useState } from 'react';
import { action } from '../lib/client';
import type { RoomData } from '../lib/room-types';

/** Investor view: invite colleagues to this room, resend or withdraw invitations, remove members or leave. */
export function RoomMembers({ data, refresh }: { data: RoomData; refresh: () => Promise<void> }) {
  const [error, setError] = useState(''); const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  const archived = Boolean(data.room.archivedAt);
  async function run(name: string, values: Record<string, unknown>, done?: string) {
    setBusy(true); setError(''); setNotice('');
    try {
      const result = await action(name, { roomId: data.room.id, ...values });
      if (result.warning) setError(String(result.warning)); else if (done) setNotice(done);
      await refresh();
      return true;
    } catch (err) { setError((err as Error).message); return false; } finally { setBusy(false); }
  }
  function remove(member: RoomData['members'][number]) {
    const self = member.userId === data.actor.id;
    const question = self ? 'Leave this room? You will lose access to its documents and discussions.' : `Remove ${member.email} from this room?`;
    if (!window.confirm(question)) return;
    if (self) {
      // Leaving ends this page's access, so go straight back to the room list.
      action('revokeMember', { roomId: data.room.id, membershipId: member.id }).then(() => window.location.assign('/')).catch(err => setError(err.message));
      return;
    }
    void run('revokeMember', { membershipId: member.id }, `${member.email} was removed.`);
  }
  return <details className="editor"><summary>Members ({data.members.length})</summary><div className="settings-grid"><section>
    <h2>People in this room</h2>
    <p className="muted">Everyone here sees the same documents and discussions. HorseUp is notified when members are added or removed.</p>
    {data.members.map(m => <div className="member" key={m.id}><span>{m.email}<small>{m.userId === data.actor.id ? 'You' : m.acceptedAt ? 'Joined' : 'Invited'}</small></span>
      <div>{!m.acceptedAt && !archived && <button className="quiet" disabled={busy} onClick={() => run('invite', { emails: [m.email] }, `Invitation sent again to ${m.email}.`)}>Resend</button>}
        <button className="quiet" disabled={busy} onClick={() => remove(m)}>{m.userId === data.actor.id ? 'Leave room' : m.acceptedAt ? 'Remove' : 'Withdraw'}</button></div></div>)}
  </section><section>
    <h2>Invite colleagues</h2>
    <form onSubmit={e => { e.preventDefault(); const form = e.currentTarget; const emails = String(new FormData(form).get('emails')).split(/[\s,;]+/).filter(Boolean);
      void run('invite', { emails }, emails.length === 1 ? `Invitation sent to ${emails[0]}.` : `${emails.length} invitations sent.`).then(ok => { if (ok) form.reset(); }); }}>
      <label>Email addresses<textarea name="emails" required placeholder="Separate addresses with commas" /></label>
      <p className="muted">Up to 10 at a time. Each person signs in with their own email address.</p>
      <button disabled={busy || archived}>Send invitations</button>
    </form>
  </section></div>{error && <p role="alert" className="error">{error}</p>}{notice && <p role="status">{notice}</p>}</details>;
}
