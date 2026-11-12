import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { ArrowLeft, ChevronRight, Download, MessageSquare, Search, Users } from 'lucide-react';
import { action, downloadUrl, fileUrl, request } from '../../lib/client';
import type { Anchor, Discussion, RoomData } from '../../lib/room-types';
import { fileTypeByExt, formatBytes } from '../../lib/file-types';
import { CommentBubble, InlineComposer, InlineThread } from '../../components/InlineComments';
import { anchorPoint, type Point } from '../../lib/anchor';
import { Account, Shell } from '../../components/Shell';
import { RoomSettings } from '../../components/RoomSettings';
import { Discussions } from '../../components/Discussions';
import { MembersModal } from '../../components/MembersModal';
import { FolderTree, ancestorsOf } from '../../components/FolderTree';
import { FileThumb, FolderThumb } from '../../components/FileThumb';
import { DataTable } from '../../components/DataTable';

const PdfViewer = dynamic(() => import('../../components/PdfViewer'), { ssr: false });
const SheetPreview = dynamic(() => import('../../components/SheetPreview'), { ssr: false });

type Selection = { documentId: string; versionId: string; page: number; historical?: boolean };
type Row = { kind: 'folder'; id: string; name: string; meta: string } | {
  kind: 'file'; id: string; name: string; meta: string; ext: string; size: number; updated: number; versionId: string; thumb: string | null };

const relative = (time: number) => {
  const minutes = Math.round((Date.now() - time) / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return days === 1 ? 'Yesterday' : `${days} days ago`;
  return new Date(time).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: new Date(time).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
};

function TextPreview({ url }: { url: string }) {
  const [text, setText] = useState<string | null>(null); const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false; setText(null); setError('');
    fetch(url, { credentials: 'same-origin', cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('The file could not be loaded.'); return r.text(); })
      .then(value => { if (!cancelled) setText(value.length > 2_000_000 ? `${value.slice(0, 2_000_000)}\n\n[Preview cut. Download the file for the rest.]` : value); })
      .catch(err => { if (!cancelled) setError(err.message); });
    return () => { cancelled = true; };
  }, [url]);
  if (error) return <p role="alert" className="error">{error}</p>;
  return text === null ? <p role="status" className="muted">Loading…</p> : <pre className="text-preview">{text}</pre>;
}

export default function InvestorRoom() {
  const router = useRouter(); const { status } = useSession(); const id = typeof router.query.id === 'string' ? router.query.id : '';
  const [data, setData] = useState<RoomData>(); const [error, setError] = useState(''); const [visitId, setVisitId] = useState<string>();
  const [folder, setFolder] = useState<string | null>(null); const [query, setQuery] = useState('');
  const [selection, setSelection] = useState<Selection | null>(null);
  const [membersOpen, setMembersOpen] = useState(false); const [threadsOpen, setThreadsOpen] = useState(false);
  const started = useRef('');
  const [inline, setInline] = useState<{ key: string; at: Point } & ({ kind: 'bubble' | 'composer'; anchor: Anchor } | { kind: 'thread'; id: string }) | null>(null);

  const refresh = useCallback(async () => { const result = await request<RoomData>(`/api/workspace?roomId=${encodeURIComponent(id)}`); setData(result); setError(''); }, [id]);
  useEffect(() => {
    if (!id) return;
    if (status === 'unauthenticated') { router.replace(`/login?callbackUrl=${encodeURIComponent(`/rooms/${id}`)}`); return; }
    if (status !== 'authenticated') return;
    action('acceptInvitation', { roomId: id }).catch(() => {}).then(refresh).catch(err => setError(err.message));
  }, [id, status, router, refresh]);
  useEffect(() => {
    if (!data || data.actor.admin || started.current === data.room.id) return;
    const token = crypto.randomUUID(); started.current = data.room.id;
    action('startVisit', { roomId: data.room.id, visitId: token }).then(() => setVisitId(token)).catch(() => { started.current = ''; });
  }, [data]);
  // Keep an open document on its latest version after a refresh, unless it shows an older version on purpose.
  useEffect(() => {
    if (!data) return;
    setSelection(current => {
      if (!current) return current;
      const doc = data.documents.find(d => d.id === current.documentId);
      if (!doc) return null;
      return current.historical ? current : { ...current, versionId: doc.versions[0].id, page: current.versionId === doc.versions[0].id ? current.page : 1 };
    });
    setFolder(current => current && !data.folders.some(f => f.id === current) ? null : current);
  }, [data]);
  useEffect(() => { if (!data) return; const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh().catch(err => { setError(err.message); setData(undefined); setSelection(null); }); }, 30000); return () => clearInterval(timer); }, [Boolean(data), refresh]);

  // Inline comment numbering per page, as before.
  const pageKey = selection ? `${selection.documentId}:${selection.versionId}:${selection.page}` : '';
  const numbers = new Map<string, number>(); const pageThreads: Discussion[] = [];
  if (data) {
    const groups = new Map<string, Discussion[]>();
    for (const d of [...data.discussions].filter(d => d.anchor && d.documentId && !d.documentRemoved).sort((a, b) => a.createdAt.localeCompare(b.createdAt))) {
      const key = `${d.documentId}:${d.documentVersionId}:${d.pageNumber}`; groups.set(key, [...(groups.get(key) || []), d]);
    }
    for (const [key, list] of groups) list.forEach((d, i) => { numbers.set(d.id, i + 1); if (key === pageKey) pageThreads.push(d); });
  }
  const current = inline && inline.key === pageKey ? inline : null;
  const openThread = current?.kind === 'thread' ? data?.discussions.find(d => d.id === current.id) : undefined;
  const openDocument = (documentId: string) => {
    const doc = data?.documents.find(d => d.id === documentId); if (!doc) return;
    setSelection({ documentId, versionId: doc.versions[0].id, page: 1 }); setInline(null); setThreadsOpen(false);
    window.scrollTo({ top: 0 });
  };
  const openInline = (discussion: Discussion) => {
    if (!discussion.documentId || !discussion.documentVersionId || !discussion.anchor || !data) return;
    const latest = data.documents.find(d => d.id === discussion.documentId)?.versions[0]?.id;
    setSelection({ documentId: discussion.documentId, versionId: discussion.documentVersionId, page: discussion.pageNumber || 1, historical: latest !== discussion.documentVersionId });
    setInline({ key: `${discussion.documentId}:${discussion.documentVersionId}:${discussion.pageNumber || 1}`, kind: 'thread', id: discussion.id, at: anchorPoint(discussion.anchor.rects) });
    setThreadsOpen(false);
  };
  const openReference = (discussion: Discussion) => {
    if (discussion.documentId && discussion.documentVersionId) { setSelection({ documentId: discussion.documentId, versionId: discussion.documentVersionId, page: discussion.pageNumber || 1, historical: true }); setThreadsOpen(false); }
  };

  const folders = useMemo(() => data?.folders ?? [], [data]);
  const rows = useMemo<Row[]>(() => {
    if (!data) return [];
    const fileRow = (d: RoomData['documents'][number], meta = ''): Row => {
      const v = d.versions[0];
      return { kind: 'file', id: d.id, name: d.name, meta, ext: v.type, size: Number(v.fileSize ?? 0), updated: v.createdAt ? Date.parse(v.createdAt) : 0, versionId: v.id,
        thumb: v.hasThumbnail ? fileUrl(d.id, v.id, data.room.id, true) : null };
    };
    const q = query.trim().toLowerCase();
    if (q) return data.documents.filter(d => d.name.toLowerCase().includes(q)).map(d => fileRow(d, ['Home', ...ancestorsOf(folders, d.folderId).map(f => f.name)].join(' / ')));
    const count = (folderId: string) => {
      const sub = folders.filter(f => f.parentId === folderId).length; const files = data.documents.filter(d => d.folderId === folderId).length;
      return [sub ? `${sub} folder${sub === 1 ? '' : 's'}` : '', files ? `${files} file${files === 1 ? '' : 's'}` : ''].filter(Boolean).join(', ');
    };
    return [...folders.filter(f => f.parentId === folder).map(f => ({ kind: 'folder' as const, id: f.id, name: f.name, meta: count(f.id) })),
      ...data.documents.filter(d => d.folderId === folder).map(d => fileRow(d))];
  }, [data, folders, folder, query]);

  const columns = useMemo<ColumnDef<Row>[]>(() => [
    { id: 'name', header: 'Name', accessorFn: r => r.name, sortingFn: (a, b) => a.original.name.localeCompare(b.original.name, undefined, { numeric: true, sensitivity: 'base' }), meta: { className: 'col-name' },
      cell: ({ row: { original: r } }) => r.kind === 'folder'
        ? <button type="button" className="name-cell" onClick={() => { setFolder(r.id); setQuery(''); }}><FolderThumb /><span className="name-text"><strong>{r.name}</strong>{r.meta && <small>{r.meta}</small>}</span></button>
        : <button type="button" className="name-cell" onClick={() => openDocument(r.id)}><FileThumb type={r.ext} src={r.thumb} /><span className="name-text"><strong>{r.name}</strong>{r.meta && <small>{r.meta}</small>}</span></button> },
    { id: 'type', header: 'Type', accessorFn: r => r.kind === 'folder' ? '' : r.ext, meta: { className: 'col-type muted' }, cell: ({ row: { original: r } }) => r.kind === 'folder' ? 'Folder' : r.ext.toUpperCase() },
    { id: 'size', header: 'Size', accessorFn: r => r.kind === 'folder' ? -1 : r.size, sortDescFirst: true, meta: { className: 'col-size muted' }, cell: ({ row: { original: r } }) => r.kind === 'folder' ? '–' : formatBytes(r.size) },
    { id: 'updated', header: 'Updated', accessorFn: r => r.kind === 'folder' ? 0 : r.updated, sortDescFirst: true, meta: { className: 'col-updated muted' }, cell: ({ row: { original: r } }) => r.kind === 'folder' ? '' : relative(r.updated) },
    { id: 'download', header: () => <span className="col-dl-head">Download</span>, enableSorting: false, meta: { className: 'col-dl' },
      cell: ({ row: { original: r } }) => r.kind === 'file' && data ? <a className="icon-btn" href={downloadUrl(data.room.id, r.id)} download aria-label={`Download ${r.name}`} title="Download"><Download size={18} aria-hidden="true" /></a> : null },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [data]);

  if (!data) return <Shell bare title="Room"><div className="page"><p role={error ? 'alert' : 'status'} className={error ? 'error' : 'muted'}>{error || 'Loading room…'}</p>
    {error && <p><button className="ghost" onClick={() => refresh().catch(err => setError(err.message))}>Retry</button> <Link href="/">All rooms</Link></p>}</div></Shell>;

  const lastUpdated = Math.max(0, ...data.documents.map(d => d.versions[0]?.createdAt ? Date.parse(d.versions[0].createdAt) : 0));
  const doc = selection ? data.documents.find(d => d.id === selection.documentId) : undefined;
  const docVersion = doc?.versions.find(v => v.id === selection?.versionId) ?? doc?.versions[0];
  const docType = fileTypeByExt(docVersion?.type ?? doc?.type);
  const crumbs = ancestorsOf(folders, folder);
  const openThreads = data.discussions.filter(d => !d.resolvedAt).length;
  const discussions = <Discussions data={data} reference={selection && docType.kind === 'pdf' ? selection : selection ? { ...selection, page: 0 } : null} refresh={refresh} numbers={numbers} openInline={openInline} openReference={openReference} />;

  // ---- Document view ------------------------------------------------------
  if (selection && doc && docVersion) {
    const path = ancestorsOf(folders, doc.folderId).map(f => f.name);
    const src = fileUrl(doc.id, selection.versionId, data.room.id);
    return <Shell bare title={doc.name}><div className="doc-view">
      <header className="doc-bar">
        <div className="doc-bar-left"><button type="button" className="icon-btn bordered" aria-label="Back to folder" onClick={() => { setSelection(null); setFolder(doc.folderId); setInline(null); }}><ArrowLeft size={16} aria-hidden="true" /></button>
          <div className="doc-title"><small>{['Home', ...path].join(' / ')}</small><strong>{doc.name}</strong></div></div>
        <div className="doc-bar-right"><Account email={data.actor.email} /><a className="ghost" href={downloadUrl(data.room.id, doc.id)} download><Download size={16} aria-hidden="true" />Download</a></div>
      </header>
      {selection.historical && <p className="historical">Showing the version referenced by this discussion. <button type="button" className="link-btn" onClick={() => openDocument(doc.id)}>Open the latest version</button></p>}
      <div className="doc-grid">
        <section className="doc-main" aria-label="Document preview">
          {docType.kind === 'pdf' ? <PdfViewer key={`${selection.documentId}:${selection.versionId}`} {...selection} roomId={id} visitId={visitId} onPage={page => setSelection(value => value && { ...value, page })}
            highlights={pageThreads.filter(d => !d.resolvedAt || openThread?.id === d.id).map(d => ({ id: d.id, number: numbers.get(d.id) || 0, rects: d.anchor!.rects, active: openThread?.id === d.id }))}
            onAnchor={data.room.archivedAt ? undefined : (anchor, at) => setInline({ key: pageKey, kind: 'bubble', anchor, at })}
            onHighlight={(threadId, at) => setInline({ key: pageKey, kind: 'thread', id: threadId, at })}
            onPageClick={() => { if (current?.kind !== 'composer') setInline(null); }}
            overlay={current?.kind === 'bubble' ? <CommentBubble at={current.at} onComment={() => setInline({ ...current, kind: 'composer' })} />
              : current?.kind === 'composer' ? <InlineComposer data={data} anchor={current.anchor} reference={selection} at={current.at} refresh={refresh} onCancel={() => { setInline(null); window.getSelection()?.removeAllRanges(); }} onDone={threadId => { window.getSelection()?.removeAllRanges(); setInline({ key: pageKey, kind: 'thread', id: threadId, at: current.at }); }} />
              : openThread ? <InlineThread data={data} discussion={openThread} number={numbers.get(openThread.id) || 0} at={current!.at} refresh={refresh} onClose={() => setInline(null)} /> : null} />
          : docType.kind === 'image' ? <img className="image-preview" src={src} alt={doc.name} />
          : docType.kind === 'sheet' ? <SheetPreview url={src} downloadHref={downloadUrl(data.room.id, doc.id)} />
          : docType.kind === 'text' ? <TextPreview url={src} />
          : <div className="preview-card"><FileThumb type={docType.ext} /><p className="preview-name">{doc.name}</p>
            <p className="muted small">{docType.label} · Version {docVersion.versionNumber} · {formatBytes(docVersion.fileSize)}</p>
            <a className="solid" href={downloadUrl(data.room.id, doc.id)} download><Download size={16} aria-hidden="true" />Download to open</a>
            <p className="muted small">This file type can&apos;t be previewed in the browser.</p></div>}
        </section>
        {discussions}
      </div>
    </div></Shell>;
  }

  // ---- Folder view --------------------------------------------------------
  return <Shell bare title={data.room.name}>
    <div className="room-banner"><div className="banner-bar"><Link href="/" className="banner-link">All rooms</Link><Account email={data.actor.email} light /></div>
      <img className="banner-wordmark" src="/brand/horseup-wordmark-white.png" alt="HorseUp" /></div>
    <div className="page room-page">
      <div className="room-head">
        <div><span className="logo-tile"><img src="/brand/horseup-mark-white.png" alt="" /></span>
          <h1>{data.room.name}</h1>
          <p className="muted small">{data.room.archivedAt ? 'Archived · ' : ''}{lastUpdated ? `Last updated ${new Date(lastUpdated).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}` : 'No documents yet'}</p></div>
        <div className="room-actions">
          {data.actor.admin && <label className="stage-select" title="Which documents everyone in this room can open. Only administrators see this.">Stage
            <select value={data.room.stageId} onChange={e => action('setRoomStage', { roomId: data.room.id, stageId: e.target.value }).then(refresh).catch(err => setError(err.message))}>
              {data.stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>}
          <button type="button" className="ghost" onClick={() => setMembersOpen(true)}><Users size={16} aria-hidden="true" />Members</button>
          <button type="button" className="ghost" onClick={() => setThreadsOpen(true)}><MessageSquare size={16} aria-hidden="true" />Discussions{openThreads ? ` (${openThreads})` : ''}</button>
          {data.documents.length > 0 && <a className="ghost" href={downloadUrl(data.room.id)} download><Download size={16} aria-hidden="true" />Download all</a>}
        </div>
      </div>
      {error && <p role="alert" className="error">{error}</p>}
      {data.actor.admin && <RoomSettings data={data} refresh={refresh} />}
      <div className="browser">
        <FolderTree label="Folders" folders={folders} current={folder} onSelect={id => { setFolder(id); setQuery(''); }} files={data.documents.map(d => ({ id: d.id, name: d.name, folderId: d.folderId }))} onOpenFile={openDocument} />
        <section className="browser-main" aria-label="Documents">
          <div className="browser-bar">
            <nav aria-label="Breadcrumb" className="crumbs">
              <button type="button" className={`crumb${folder === null ? ' is-last' : ''}`} onClick={() => { setFolder(null); setQuery(''); }} aria-current={folder === null ? 'page' : undefined}>Home</button>
              {crumbs.map((f, i) => <span key={f.id} className="crumb-part"><ChevronRight size={14} aria-hidden="true" className="crumb-sep" />
                <button type="button" className={`crumb${i === crumbs.length - 1 ? ' is-last' : ''}`} onClick={() => { setFolder(f.id); setQuery(''); }} aria-current={i === crumbs.length - 1 ? 'page' : undefined}>{f.name}</button></span>)}
            </nav>
            <label className="search"><span className="visually-hidden">Search documents</span><Search size={16} aria-hidden="true" /><input type="search" placeholder="Search…" value={query} onChange={e => setQuery(e.target.value)} /></label>
          </div>
          <DataTable label="Documents" data={rows} columns={columns} initialSort={[{ id: 'name', desc: false }]} getRowId={r => `${r.kind}:${r.id}`} pinned={r => r.kind === 'folder'} numbered
            empty={<p className="empty">{query ? 'No documents match your search.' : data.documents.length ? 'This folder is empty.' : 'No documents are available at this stage yet.'}</p>} />
        </section>
      </div>
    </div>
    <MembersModal data={data} refresh={refresh} open={membersOpen} onClose={() => setMembersOpen(false)} />
    {threadsOpen && <div className="drawer-scrim" onClick={e => { if (e.target === e.currentTarget) setThreadsOpen(false); }}>
      <div className="drawer" role="dialog" aria-modal="true" aria-label="Discussions">
        <button type="button" className="ghost drawer-close" onClick={() => setThreadsOpen(false)}>Close</button>
        {discussions}
      </div></div>}
  </Shell>;
}
