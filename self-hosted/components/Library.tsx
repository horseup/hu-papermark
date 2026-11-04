import { useState } from 'react';
import { pdfjs } from 'react-pdf';
import { action, type Workspace } from '../lib/client';
pdfjs.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
export default function Library({ data, refresh }: { data: Workspace; refresh: () => Promise<void> }) {
  const [busy, setBusy] = useState(false); const [message, setMessage] = useState(''); const [error, setError] = useState('');
  return <section><h2>Document library</h2><p>Upload PDFs exported from Drive. Publishing a new version updates every room that includes the document; existing discussions retain their original version.</p>
    <details className="editor"><summary>Upload and publish a PDF</summary><form onSubmit={async e => {
      e.preventDefault(); const form = e.currentTarget; const values = new FormData(form); const file = values.get('file') as File;
      setBusy(true); setError(''); setMessage('Checking PDF…'); let loading;
      try { if (!file.size || file.size > 100 * 1024 * 1024) throw new Error('Choose a PDF smaller than 100 MB.');
        loading = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
        const pdf = await loading.promise;
        const documentId = String(values.get('documentId') || '');
        const result = await action<{ uploadUrl: string; versionId: string }>('beginUpload', { name: values.get('name') || file.name, ...(documentId ? { documentId } : {}), stageId: values.get('stageId'), size: file.size });
        setMessage('Uploading PDF…'); const response = await fetch(result.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: file });
        if (!response.ok) throw new Error('Upload failed. Check your connection and try again.');
        setMessage('Publishing…'); await action('publishUpload', { versionId: result.versionId, pages: pdf.numPages }); await refresh(); form.reset(); setMessage('PDF published. Eligible rooms now show this version.');
      } catch (err) { setMessage(''); setError((err as Error).message); } finally { await loading?.destroy(); setBusy(false); }
    }}><label>Publish as<select name="documentId"><option value="">New library document</option>{data.library.map(d => <option key={d.id} value={d.id}>New version of {d.name}</option>)}</select></label>
      <label>Title for a new document<input name="name" maxLength={300} placeholder="Defaults to the PDF filename" /></label>
      <label>Minimum stage for a new document<select name="stageId" required>{data.stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>PDF file<input type="file" name="file" accept="application/pdf,.pdf" required /></label><button disabled={busy || !data.stages.length}>{busy ? 'Publishing…' : 'Upload and publish'}</button>
    </form></details>
    {message && <p role="status">{message}</p>}{error && <p role="alert" className="error">{error}</p>}
    {data.library.length > 0 && <div className="library-table" role="table" aria-label="Document library">
      <div className="library-head" role="row"><span role="columnheader">Document</span><span role="columnheader">Last updated</span><span role="columnheader">Minimum stage</span><span role="columnheader">Rooms</span><span role="columnheader"><span className="visually-hidden">Actions</span></span></div>
      {data.library.map(d => {
        const version = d.versions[0];
        const position = (stageId?: string | null) => data.stages.find(s => s.id === stageId)?.position ?? -1;
        const required = position(d.huAccessRule?.minimumStageId);
        const rooms = (d.huRoomSelections ?? []).map(r => r.room);
        const active = rooms.filter(r => !r.archivedAt);
        const visible = active.filter(r => required >= 0 && position(r.stageId) >= required);
        return <div className="library-row" role="row" key={d.id}>
          <span role="cell" data-label="Document"><strong>{d.name}</strong><small>{version ? `Version ${version.versionNumber}${version.numPages ? ` · ${version.numPages} page${version.numPages === 1 ? '' : 's'}` : ''}` : 'Unpublished'}</small></span>
          <span role="cell" data-label="Last updated">{version?.createdAt ? <time dateTime={version.createdAt}>{new Date(version.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</time> : '–'}</span>
          <span role="cell" data-label="Minimum stage"><select aria-label={`Minimum stage for ${d.name}`} value={d.huAccessRule?.minimumStageId || ''} disabled={busy} onChange={async e => { setBusy(true); setError(''); try { await action('setDocumentStage', { documentId: d.id, stageId: e.target.value }); await refresh(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }}><option value="" disabled>Select a stage</option>{data.stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></span>
          <span role="cell" data-label="Rooms">{rooms.length ? <details className="room-summary"><summary>{active.length} room{active.length === 1 ? '' : 's'} · {visible.length} can view{rooms.length > active.length ? ` · ${rooms.length - active.length} archived` : ''}</summary><ul>{rooms.map(r => {
            const state = r.archivedAt ? 'Archived' : visible.includes(r) ? 'Can view' : `Locked until ${d.huAccessRule ? data.stages.find(s => s.id === d.huAccessRule!.minimumStageId)?.name : 'a stage is set'}`;
            return <li key={r.id}><a href={`/rooms/${r.id}`}>{r.name}</a><small>{state}</small></li>;
          })}</ul></details> : <small>Not in any room</small>}</span>
          <span role="cell" className="library-actions">
            {version && <a className="button quiet" href={`/api/pdf?documentId=${encodeURIComponent(d.id)}&versionId=${encodeURIComponent(version.id)}`} target="_blank" rel="noopener">View</a>}
            <button type="button" className="quiet danger" disabled={busy} onClick={async () => {
              if (!window.confirm(`Delete "${d.name}"? It is removed from the library and from ${rooms.length} room(s) immediately. Existing discussions stay, without access to the document.`)) return;
              setBusy(true); setError(''); setMessage('');
              try { await action('deleteDocument', { documentId: d.id }); await refresh(); setMessage(`"${d.name}" was deleted and removed from ${rooms.length} room(s).`); }
              catch (err) { setError((err as Error).message); } finally { setBusy(false); }
            }}>Delete</button>
          </span>
        </div>;
      })}
    </div>}
  </section>;
}
