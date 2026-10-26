import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { request, type Workspace } from '../lib/client';
import { Shell } from '../components/Shell';
import { StageSettings } from '../components/StageSettings';
import { RoomCreator } from '../components/RoomCreator';
const Library = dynamic(() => import('../components/Library'), { ssr: false });
export default function Overview() {
  const { status } = useSession(); const router = useRouter();
  const [data, setData] = useState<Workspace>(); const [error, setError] = useState('');
  const refresh = useCallback(async () => { setData(await request<Workspace>('/api/workspace')); }, []);
  useEffect(() => { if (status === 'unauthenticated') router.replace('/login'); if (status === 'authenticated') refresh().catch(err => setError(err.message)); }, [status, refresh, router]);
  return <Shell email={data?.actor.email}><div className="workspace"><h1>{data?.actor.admin ? 'Investor rooms' : 'Your rooms'}</h1>
    {error && <p role="alert" className="error">{error} <button className="quiet" onClick={() => refresh().then(() => setError('')).catch(err => setError(err.message))}>Retry</button></p>}
    {!data ? <p role="status">Loading your workspace…</p> : <><p className="muted">{data.actor.admin ? 'Manage investor access and conversations from one shared document library.' : 'Open a room to review the latest published documents and ask questions.'}</p>
      {data.actor.admin && <RoomCreator data={data} />}
      <div className="room-list">{data.rooms.map(room => <Link className="room-row" key={room.id} href={`/rooms/${room.id}`}><span><strong>{room.name}</strong><small>{room.archivedAt ? 'Archived' : data.stages.find(s => s.id === room.stageId)?.name}</small></span><span>Open room →</span></Link>)}</div>
      {!data.rooms.length && <p className="empty">{data.actor.admin ? 'No investor rooms yet. Add access stages below, then create your first room.' : 'There are no active rooms for this email address.'}</p>}
      {data.actor.admin && <><Library data={data} refresh={refresh} /><StageSettings stages={data.stages} refresh={refresh} /></>}
    </>}
  </div></Shell>;
}
