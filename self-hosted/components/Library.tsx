import { useMemo, useRef, useState } from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Download, Eye, FolderPlus, Trash2, Upload } from 'lucide-react';
import { action, fileUrl, type Folder, type LibraryDocument, type Workspace } from '../lib/client';
import { ACCEPT, ACCEPT_LABEL, fileTypeByExt, formatBytes } from '../lib/file-types';
import { uploadDocument } from '../lib/upload';
import { DataTable } from './DataTable';
import { FileThumb } from './FileThumb';
import { FolderTree, ancestorsOf } from './FolderTree';

type Job = { name: string; step: string; error?: string };

/** Descendants of a folder (to keep "Move" from creating a loop). */
function descendants(folders: Folder[], id: string) {
  const out = new Set<string>([id]); let grew = true;
  while (grew) { grew = false; for (const f of folders) if (f.parentId && out.has(f.parentId) && !out.has(f.id)) { out.add(f.id); grew = true; } }
  return out;
}
const pathLabel = (folders: Folder[], id: string | null) => ['Home', ...ancestorsOf(folders, id).map(f => f.name)].join(' / ');

export default function Library({ data, refresh }: { data: Workspace; refresh: () => Promise<void> }) {
  const [folder, setFolder] = useState<string | null>(null);
  const [stageId, setStageId] = useState('');
  const [jobs, setJobs] = useState<Job[]>([]); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [message, setMessage] = useState(''); const [dragging, setDragging] = useState(false);
  const picker = useRef<HTMLInputElement>(null); const versionPicker = useRef<HTMLInputElement>(null); const versionTarget = useRef<LibraryDocument | null>(null);
  const folders = data.folders;
  const current = folders.find(f => f.id === folder) ?? null;
  const uploadStage = stageId || data.stages[0]?.id || '';
  const counts = useMemo(() => { const map = new Map<string | null, number>(); for (const d of data.library) map.set(d.folderId, (map.get(d.folderId) ?? 0) + 1); return map; }, [data.library]);
  const stageName = (id?: string | null) => data.stages.find(s => s.id === id)?.name;
  const position = (id?: string | null) => data.stages.find(s => s.id === id)?.position ?? -1;

  async function run(name: string, values: Record<string, unknown>, done?: string) {
    setBusy(true); setError(''); setMessage('');
    try { const result = await action(name, values); await refresh(); if (done) setMessage(done); return result; }
    catch (err) { setError((err as Error).message); return null; } finally { setBusy(false); }
  }
  async function upload(files: File[], documentId?: string) {
    if (!files.length) return;
    if (!uploadStage) { setError('Add an access stage before uploading.'); return; }
    setBusy(true); setError(''); setMessage('');
    const list: Job[] = files.map(f => ({ name: f.name, step: 'Waiting' })); setJobs(list);
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      const update = (patch: Partial<Job>) => setJobs(previous => previous.map((job, index) => index === i ? { ...job, ...patch } : job));
      try { await uploadDocument(files[i], { documentId, stageId: uploadStage, folderId: folder }, step => update({ step })); update({ step: 'Published' }); ok++; }
      catch (err) { update({ step: 'Failed', error: (err as Error).message }); }
    }
    await refresh().catch(() => {});
    setBusy(false);
    setMessage(ok ? `${ok} of ${files.length} file${files.length === 1 ? '' : 's'} published. Rooms that include ${documentId ? 'the document' : 'new documents'} show them once their stage allows.` : '');
    if (ok === files.length) setTimeout(() => setJobs([]), 4000);
  }
  async function newFolder() {
    const name = window.prompt(current ? `New folder inside "${current.name}"` : 'New folder at the top level');
    if (name?.trim()) await run('createFolder', { name: name.trim(), parentId: folder }, `Folder "${name.trim()}" created.`);
  }
  async function renameFolder() {
    if (!current) return; const name = window.prompt('Rename folder', current.name);
    if (name?.trim() && name.trim() !== current.name) await run('renameFolder', { folderId: current.id, name: name.trim() });
  }
  async function deleteFolder() {
    if (!current) return;
    if (!window.confirm(`Delete the folder "${current.name}"? Its documents and subfolders move up to ${current.parentId ? `"${folders.find(f => f.id === current.parentId)?.name}"` : 'the top level'}. Nothing is deleted from rooms.`)) return;
    const parent = current.parentId;
    if (await run('deleteFolder', { folderId: current.id }, `Folder "${current.name}" deleted.`)) setFolder(parent);
  }

  const rows = data.library.filter(d => d.folderId === folder);
  const blocked = current ? descendants(folders, current.id) : new Set<string>();
  const columns = useMemo<ColumnDef<LibraryDocument>[]>(() => [
    { id: 'name', header: 'Name', accessorFn: d => d.name, sortingFn: (a, b) => a.original.name.localeCompare(b.original.name, undefined, { numeric: true, sensitivity: 'base' }), meta: { className: 'col-name' },
      cell: ({ row: { original: d } }) => { const v = d.versions[0];
        return <span className="name-cell static"><FileThumb type={v?.type ?? d.type} src={v?.hasThumbnail ? fileUrl(d.id, v.id, undefined, true) : null} />
          <span className="name-text"><strong>{d.name}</strong><small>{v ? `Version ${v.versionNumber}${v.numPages ? ` · ${v.numPages} page${v.numPages === 1 ? '' : 's'}` : ''}` : 'Unpublished'}</small></span></span>; } },
    { id: 'type', header: 'Type', accessorFn: d => d.versions[0]?.type ?? d.type ?? '', meta: { className: 'col-type muted' }, cell: ({ getValue }) => String(getValue()).toUpperCase() },
    { id: 'size', header: 'Size', accessorFn: d => Number(d.versions[0]?.fileSize ?? 0), sortDescFirst: true, meta: { className: 'col-size muted' }, cell: ({ getValue }) => formatBytes(getValue() as number) },
    { id: 'stage', header: 'Minimum stage', accessorFn: d => position(d.huAccessRule?.minimumStageId), meta: { className: 'col-stage' },
      cell: ({ row: { original: d } }) => <select className="select-sm" aria-label={`Minimum stage for ${d.name}`} value={d.huAccessRule?.minimumStageId || ''} disabled={busy}
        onChange={e => run('setDocumentStage', { documentId: d.id, stageId: e.target.value })}><option value="" disabled>Select a stage</option>{data.stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select> },
    { id: 'rooms', header: 'Rooms', accessorFn: d => d.huRoomSelections?.filter(r => !r.room.archivedAt).length ?? 0, meta: { className: 'col-rooms' },
      cell: ({ row: { original: d } }) => {
        const rooms = (d.huRoomSelections ?? []).map(r => r.room); const active = rooms.filter(r => !r.archivedAt);
        const required = position(d.huAccessRule?.minimumStageId);
        const visible = active.filter(r => required >= 0 && position(r.stageId) >= required);
        if (!rooms.length) return <small className="muted">Not in any room</small>;
        return <details className="room-summary"><summary>{active.length} room{active.length === 1 ? '' : 's'} · {visible.length} can view</summary><ul>{rooms.map(r =>
          <li key={r.id}><a href={`/rooms/${r.id}`}>{r.name}</a><small>{r.archivedAt ? 'Archived' : visible.includes(r) ? 'Can view' : `Locked until ${stageName(d.huAccessRule?.minimumStageId) ?? 'a stage is set'}`}</small></li>)}</ul></details>;
      } },
    { id: 'updated', header: 'Updated', accessorFn: d => d.versions[0]?.createdAt ? Date.parse(d.versions[0].createdAt) : 0, sortDescFirst: true, meta: { className: 'col-updated muted' },
      cell: ({ getValue }) => { const t = getValue() as number; return t ? new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '–'; } },
    { id: 'actions', header: () => <span className="visually-hidden">Actions</span>, enableSorting: false, meta: { className: 'col-actions' },
      cell: ({ row: { original: d } }) => { const v = d.versions[0]; const kind = fileTypeByExt(v?.type ?? d.type).kind;
        return <span className="row-actions">
          <select className="select-sm" aria-label={`Folder for ${d.name}`} value={d.folderId ?? ''} disabled={busy} title="Move to folder"
            onChange={e => run('setDocumentFolder', { documentId: d.id, folderId: e.target.value || null })}>
            <option value="">Home</option>{folders.map(f => <option key={f.id} value={f.id}>{pathLabel(folders, f.id).replace(/^Home \/ /, '')}</option>)}</select>
          {v && <a className="icon-btn" href={fileUrl(d.id, v.id)} target="_blank" rel="noopener" aria-label={`${kind === 'pdf' || kind === 'image' || kind === 'text' ? 'View' : 'Download'} ${d.name}`} title={kind === 'pdf' || kind === 'image' || kind === 'text' ? 'View' : 'Download'}>
            {kind === 'pdf' || kind === 'image' || kind === 'text' ? <Eye size={16} aria-hidden="true" /> : <Download size={16} aria-hidden="true" />}</a>}
          <button type="button" className="icon-btn" aria-label={`Upload a new version of ${d.name}`} title="Upload new version" disabled={busy} onClick={() => { versionTarget.current = d; versionPicker.current?.click(); }}><Upload size={16} aria-hidden="true" /></button>
          <button type="button" className="icon-btn danger" aria-label={`Delete ${d.name}`} title="Delete" disabled={busy} onClick={async () => {
            const count = d.huRoomSelections?.length ?? 0;
            if (window.confirm(`Delete "${d.name}"? It is removed from the library and from ${count} room(s) immediately. Existing discussions stay, without access to the document.`))
              await run('deleteDocument', { documentId: d.id }, `"${d.name}" was deleted and removed from ${count} room(s).`);
          }}><Trash2 size={16} aria-hidden="true" /></button>
        </span>; } },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [data, busy, folders]);

  return <section className="library">
    <div className="page-head"><div><h1>Documents</h1>
      <p className="muted">One folder structure for every room. A document shows up in the same folder in each room that includes it. Rooms hide folders with nothing they can open.</p></div></div>
    <div className="browser">
      <div className="tree-panel">
        <div className="tree-panel-head"><span className="muted small">Folders</span>
          <button type="button" className="icon-btn" aria-label={current ? `New folder inside ${current.name}` : 'New top-level folder'} title="New folder" disabled={busy} onClick={newFolder}><FolderPlus size={16} aria-hidden="true" /></button></div>
        <FolderTree label="Folder structure" folders={folders} current={folder} onSelect={setFolder} counts={counts} homeLabel="Home (top level)" />
      </div>
      <div className="browser-main">
        <div className="browser-bar">
          <h2 className="folder-title">{current?.name ?? 'Home (top level)'}</h2>
          <div className="toolbar">
            {current && <>
              <button type="button" className="ghost" disabled={busy} onClick={renameFolder}>Rename</button>
              <label className="move-select"><span className="visually-hidden">Move folder to</span>
                <select className="select-sm" value={current.parentId ?? ''} disabled={busy} onChange={e => run('moveFolder', { folderId: current.id, parentId: e.target.value || null })}>
                  <option value="">Move to: Home</option>{folders.filter(f => !blocked.has(f.id)).map(f => <option key={f.id} value={f.id}>Move to: {pathLabel(folders, f.id).replace(/^Home \/ /, '')}</option>)}</select></label>
              <button type="button" className="ghost danger" disabled={busy} onClick={deleteFolder}>Delete folder</button>
            </>}
            <button type="button" className="solid" disabled={busy || !data.stages.length} onClick={() => picker.current?.click()}><Upload size={16} aria-hidden="true" />Upload</button>
          </div>
        </div>
        <div className={`dropzone${dragging ? ' is-over' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); if (!busy) void upload(Array.from(e.dataTransfer.files)); }}>
          <strong>Drop files here to upload into {current?.name ?? 'the top level'}</strong>
          <span className="muted small">{ACCEPT_LABEL} · up to 100 MB each</span>
          <label className="stage-select small">Minimum stage for new documents
            <select value={uploadStage} onChange={e => setStageId(e.target.value)}>{data.stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
          {!data.stages.length && <span className="error small">Add an access stage first.</span>}
          <input ref={picker} type="file" multiple accept={ACCEPT} className="visually-hidden" tabIndex={-1} onChange={e => { const files = Array.from(e.target.files ?? []); e.target.value = ''; void upload(files); }} />
          <input ref={versionPicker} type="file" accept={ACCEPT} className="visually-hidden" tabIndex={-1} onChange={e => { const file = e.target.files?.[0]; e.target.value = ''; const target = versionTarget.current; if (file && target) void upload([file], target.id); }} />
        </div>
        {jobs.length > 0 && <ul className="jobs" aria-live="polite">{jobs.map((j, i) => <li key={i}><span>{j.name}</span><span className={j.error ? 'error' : 'muted'}>{j.error ?? j.step}</span></li>)}</ul>}
        {message && <p role="status">{message}</p>}{error && <p role="alert" className="error">{error}</p>}
        <DataTable label={`Documents in ${current?.name ?? 'the top level'}`} data={rows} columns={columns} initialSort={[{ id: 'name', desc: false }]} getRowId={d => d.id}
          empty={<p className="empty">{folder ? "This folder is empty. Rooms won't show it until it holds a document they can open." : 'No documents at the top level.'}</p>} />
      </div>
    </div>
  </section>;
}
