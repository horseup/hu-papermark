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
    {data.library.map(d => <div className="room-row" key={d.id}><span><strong>{d.name}</strong><small>{d.versions[0] ? `Published version ${d.versions[0].versionNumber}` : 'Unpublished'}</small></span>
      <label className="compact">Minimum stage<select aria-label={`Minimum stage for ${d.name}`} value={d.huAccessRule?.minimumStageId || ''} disabled={busy} onChange={async e => { setBusy(true); setError(''); try { await action('setDocumentStage', { documentId: d.id, stageId: e.target.value }); await refresh(); } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }}><option value="" disabled>Select a stage</option>{data.stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    </div>)}
  </section>;
}
