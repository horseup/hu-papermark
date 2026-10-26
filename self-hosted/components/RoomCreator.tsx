import { useState } from 'react';
import { useRouter } from 'next/router';
import { action, type Workspace } from '../lib/client';
export function RoomCreator({ data }: { data: Workspace }) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  return <details className="editor"><summary>Create an investor room</summary><form onSubmit={async e => {
    e.preventDefault(); setBusy(true); setError(''); const form = new FormData(e.currentTarget);
    try { const room = await action<{ id: string }>('createRoom', { name: form.get('name'), stageId: form.get('stageId'), documentIds: form.getAll('documents') });
      const emails = String(form.get('emails')).split(/[\s,;]+/).filter(Boolean);
      if (emails.length) { const invite = await action('invite', { roomId: room.id, emails }); if (invite.warning) { setError(String(invite.warning) + ' Open the new room from the overview to retry.'); return; } }
      await router.push(`/rooms/${room.id}`);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }}><label>Room name<input name="name" required maxLength={300} placeholder="Investor or fund name" /></label>
    <label>Access stage<select name="stageId" required>{data.stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    <fieldset><legend>Documents to include</legend>{data.library.map(d => <label className="check" key={d.id}><input type="checkbox" name="documents" value={d.id} />{d.name}</label>)}{!data.library.length && <p>No documents yet. You can add them later.</p>}</fieldset>
    <label>Invite people<textarea name="emails" placeholder="Email addresses separated by commas" /></label>
    <button disabled={busy || !data.stages.length}>{busy ? 'Creating…' : 'Create room and invite'}</button>{error && <p role="alert" className="error">{error}</p>}
  </form></details>;
}
