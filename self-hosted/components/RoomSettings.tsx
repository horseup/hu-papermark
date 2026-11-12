import { useEffect, useState } from 'react';
import { action } from '../lib/client';
import type { RoomData } from '../lib/room-types';
import { ancestorsOf } from './FolderTree';

/** Administrator-only: which library documents the room includes, archiving, visits and downloads. Stage and members live in the room header. */
export function RoomSettings({ data, refresh }: { data: RoomData; refresh: () => Promise<void> }) {
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  // Remember whether the panel is open per room, so saves, the 30-second refresh and page reloads don't collapse it.
  const storageKey = `hu-room-settings-open:${data.room.id}`;
  const [open, setOpen] = useState(false);
  useEffect(() => { try { setOpen(window.sessionStorage.getItem(storageKey) === '1'); } catch { /* storage unavailable */ } }, [storageKey]);
  function toggle(next: boolean) { setOpen(next); try { window.sessionStorage.setItem(storageKey, next ? '1' : '0'); } catch { /* storage unavailable */ } }
  async function run(name: string, values: Record<string, unknown>) { setBusy(true); setError(''); try { const result = await action(name, { roomId: data.room.id, ...values }); if (result.warning) setError(String(result.warning)); await refresh(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }
  const name = (documentId: string) => data.library.find(d => d.id === documentId)?.name || 'Document';
  const where = (folderId: string | null) => ancestorsOf(data.folders, folderId).map(f => f.name).join(' / ') || 'Home';
  const library = [...data.library].sort((a, b) => where(a.folderId).localeCompare(where(b.folderId)) || a.name.localeCompare(b.name));
  return <details className="settings" open={open} onToggle={e => { const next = (e.currentTarget as HTMLDetailsElement).open; if (next !== open) toggle(next); }}>
    <summary>Room settings and activity</summary>
    <div className="settings-grid">
      <section><h2>Documents in this room</h2>
        <p className="muted small">The room shows a selected document once its stage allows it. Folders come from the library.</p>
        <form key={data.room.selectedDocumentIds.join(',')} onSubmit={e => { e.preventDefault(); run('setRoomDocuments', { documentIds: new FormData(e.currentTarget).getAll('documents') }); }}>
          <fieldset className="check-list"><legend className="visually-hidden">Selected documents</legend>
            {library.map(d => <label className="check" key={d.id}><input type="checkbox" name="documents" value={d.id} defaultChecked={data.room.selectedDocumentIds.includes(d.id)} />
              <span>{d.name}<small>{where(d.folderId)}</small></span></label>)}
            {!library.length && <p className="muted small">The library is empty.</p>}
          </fieldset>
          <button className="solid" disabled={busy}>Save document selection</button>
        </form>
        <p><button type="button" className="ghost" disabled={busy} onClick={() => run('archiveRoom', { archived: !data.room.archivedAt })}>{data.room.archivedAt ? 'Reopen room' : 'Archive room and revoke access'}</button></p>
      </section>
      <section><h2>Recent visits</h2>
        <p className="muted small">Up to 100 visits. Reading time estimates time on a visible, focused PDF page; it does not prove a document was read. Other file types record downloads only.</p>
        {!data.visits.length && <p className="muted small">No investor visits recorded yet.</p>}
        {data.visits.map(v => <details key={v.id} className="activity"><summary>{v.user.email} · {new Date(v.startedAt).toLocaleString()} · {Math.round(v.readings.reduce((sum, r) => sum + r.visibleMs, 0) / 1000)} s</summary>
          {v.readings.map((r, i) => <p key={i} className="small">{name(r.documentId)} · page {r.pageNumber} · {Math.round(r.visibleMs / 1000)} s</p>)}</details>)}
        <h2>Downloads</h2>
        <p className="muted small">Up to 100 downloaded documents. A ZIP lists each document it contained. &quot;AI assistant&quot; means a link requested through the MCP connector.</p>
        {!data.downloads.length && <p className="muted small">No downloads recorded yet.</p>}
        {data.downloads.map(d => <p key={d.id} className="small">{d.user.email} · {name(d.documentId)} · {new Date(d.createdAt).toLocaleString()}{d.bulk ? ' · in ZIP' : ''}{d.channel === 'MCP' ? ' · AI assistant' : ''}</p>)}
      </section>
    </div>
    {error && <p role="alert" className="error">{error}</p>}
  </details>;
}
