import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useSession } from 'next-auth/react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { action, request } from '../../lib/client';
import type { RoomData } from '../../lib/room-types';
import { Shell } from '../../components/Shell';
import { RoomSettings } from '../../components/RoomSettings';
import { Discussions } from '../../components/Discussions';
const PdfViewer = dynamic(() => import('../../components/PdfViewer'), { ssr: false });
export default function InvestorRoom() {
  const router = useRouter(); const { status } = useSession(); const id = typeof router.query.id === 'string' ? router.query.id : '';
  const [data, setData] = useState<RoomData>(); const [error, setError] = useState(''); const [visitId, setVisitId] = useState<string>();
  const [selection, setSelection] = useState<{ documentId: string; versionId: string; page: number; historical?: boolean } | null>(null);
  const [tab, setTab] = useState('documents'); const started = useRef('');
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
  useEffect(() => {
    if (!data) return;
    setSelection(current => { const document = data.documents.find(d => d.id === current?.documentId); if (current && document) return current.historical ? current : { ...current, versionId: document.versions[0].id, page: current.versionId === document.versions[0].id ? current.page : 1 };
      const first = data.documents[0]; return first ? { documentId: first.id, versionId: first.versions[0].id, page: 1 } : null; });
  }, [data]);
  useEffect(() => { if (!data) return; const timer = setInterval(() => { if (document.visibilityState === 'visible') refresh().catch(err => { setError(err.message); setData(undefined); setSelection(null); }); }, 30000); return () => clearInterval(timer); }, [Boolean(data), refresh]);
  return <Shell email={data?.actor.email}><div className="room-workspace"><Link href="/">All rooms</Link>
    {error && <p role="alert" className="error">{error} <button className="quiet" onClick={() => refresh().catch(err => setError(err.message))}>Retry</button></p>}
    {!data ? <p role="status">{error ? 'This room is unavailable for your account.' : 'Loading room…'}</p> : <><div className="room-heading"><h1>{data.room.name}</h1><span className="muted">{data.room.archivedAt ? 'Archived' : data.stages.find(s => s.id === data.room.stageId)?.name}</span></div>
      {data.actor.admin && <RoomSettings data={data} refresh={refresh} />}
      <nav className="mobile-tabs" aria-label="Room sections">{['documents', 'viewer', 'discussions'].map(name => <button key={name} className={tab === name ? '' : 'quiet'} aria-pressed={tab === name} onClick={() => setTab(name)}>{name[0].toUpperCase() + name.slice(1)}</button>)}</nav>
      <div className={`room-grid show-${tab}`}><nav className="documents" aria-label="Room documents"><h2>Documents</h2>{data.documents.map(d => <button className={selection?.documentId === d.id ? 'selected document-link' : 'quiet document-link'} key={d.id} onClick={() => { setSelection({ documentId: d.id, versionId: d.versions[0].id, page: 1 }); setTab('viewer'); }}>{d.name}<small>Version {d.versions[0].versionNumber}</small></button>)}{!data.documents.length && <p>No documents are available at this stage yet.</p>}</nav>
      <section className="viewer"><h2>{data.documents.find(d => d.id === selection?.documentId)?.name || 'Document preview'}</h2>{selection?.historical && <p className="historical">Showing the version referenced by this discussion. Select the document from the list to return to the latest version.</p>}
      {selection ? <PdfViewer key={`${selection.documentId}:${selection.versionId}`} {...selection} roomId={id} visitId={visitId} onPage={page => setSelection(current => current && { ...current, page })} /> : <p className="empty">Select a document to start reading.</p>}</section>
      <Discussions data={data} reference={selection} refresh={refresh} openReference={discussion => { if (discussion.documentId && discussion.documentVersionId) { setSelection({ documentId: discussion.documentId, versionId: discussion.documentVersionId, page: discussion.pageNumber || 1, historical: true }); setTab('viewer'); } }} />
    </div></>}
  </div></Shell>;
}
