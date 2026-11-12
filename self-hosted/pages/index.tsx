import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ChevronRight } from 'lucide-react';
import { request, type Workspace } from '../lib/client';
import { type AdminTab, Shell } from '../components/Shell';
import { StageSettings } from '../components/StageSettings';
import { RoomCreator } from '../components/RoomCreator';
const Library = dynamic(() => import('../components/Library'), { ssr: false });

export default function Overview() {
  const { status } = useSession(); const router = useRouter();
  const [data, setData] = useState<Workspace>(); const [error, setError] = useState('');
  const refresh = useCallback(async () => { setData(await request<Workspace>('/api/workspace')); }, []);
  useEffect(() => { if (status === 'unauthenticated') router.replace('/login'); if (status === 'authenticated') refresh().catch(err => setError(err.message)); }, [status, refresh, router]);
  const requested = typeof router.query.tab === 'string' ? router.query.tab : '';
  const tab: AdminTab = requested === 'documents' || requested === 'stages' ? requested : 'rooms';
  const admin = Boolean(data?.actor.admin);
  return <Shell email={data?.actor.email} admin={admin} tab={admin ? tab : undefined} title={admin ? tab[0].toUpperCase() + tab.slice(1) : 'Your rooms'}>
    <div className="page">
      {error && <p role="alert" className="error">{error} <button className="ghost" onClick={() => refresh().then(() => setError('')).catch(err => setError(err.message))}>Retry</button></p>}
      {!data ? <p role="status" className="muted">Loading your workspace…</p>
        : admin && tab === 'documents' ? <Library data={data} refresh={refresh} />
        : admin && tab === 'stages' ? <><div className="page-head"><div><h1>Stages</h1></div></div><StageSettings stages={data.stages} refresh={refresh} /></>
        : <>
          <div className="page-head"><div><h1>{admin ? 'Rooms' : 'Your rooms'}</h1>
            <p className="muted">{admin ? 'One room per investor. Each room shows the shared folders with the documents its stage allows.' : 'Open a room to review the latest documents and ask questions.'}</p></div></div>
          {admin && <RoomCreator data={data} />}
          <ul className="room-list">{data.rooms.map(room => <li key={room.id}><Link className="room-row" href={`/rooms/${room.id}`}>
            <span><strong>{room.name}</strong><small>{room.archivedAt ? 'Archived' : data.stages.find(s => s.id === room.stageId)?.name}</small></span><ChevronRight size={16} aria-hidden="true" /></Link></li>)}</ul>
          {!data.rooms.length && <p className="empty">{admin ? 'No investor rooms yet. Add access stages, upload documents, then create your first room.' : 'There are no active rooms for this email address.'}</p>}
          <p className="muted small"><Link href="/connect">Use the deal room from Claude or another AI assistant</Link></p>
        </>}
    </div>
  </Shell>;
}
