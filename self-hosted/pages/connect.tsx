import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { request } from '../lib/client';
import { Shell } from '../components/Shell';

type Connection = { id: string; name: string; host: string; connectedAt: string };

// Public setup guide for the MCP connector, plus the signed-in user's connected assistants.
export default function Connect() {
  const { data: session, status } = useSession();
  const [connections, setConnections] = useState<Connection[]>(); const [error, setError] = useState(''); const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState('https://dealroom.horseup.de');
  useEffect(() => setOrigin(window.location.origin), []);
  const refresh = useCallback(async () => setConnections((await request<{ connections: Connection[] }>('/api/connections')).connections), []);
  useEffect(() => { if (status === 'authenticated') refresh().catch(err => setError(err.message)); }, [status, refresh]);
  const url = `${origin}/mcp`;
  async function remove(c: Connection) {
    if (!window.confirm(`Disconnect ${c.name}? It loses access immediately.`)) return;
    try { await request('/api/connections', { grantId: c.id }); await refresh(); } catch (err) { setError((err as Error).message); }
  }
  return <Shell email={session?.user?.email ?? undefined}><section className="workspace connect"><Link href="/">All rooms</Link>
    <h1>Use the deal room from your AI assistant</h1>
    <p>Add the deal room as a connector in Claude or another assistant that supports MCP. You sign in with your invitation email, the same as here. The assistant can then list your rooms and documents and fetch the PDFs for you.</p>
    <h2>Connector URL</h2>
    <p className="connector-url"><code>{url}</code> <button className="quiet" onClick={() => navigator.clipboard.writeText(url).then(() => setCopied(true))}>{copied ? 'Copied' : 'Copy'}</button></p>
    <ol>
      <li>In Claude, open Settings → Connectors → Add custom connector, and paste the URL.</li>
      <li>Choose Connect. A deal room page opens; sign in with your invitation email.</li>
      <li>Check the request and choose Allow access.</li>
    </ol>
    <p className="muted">Download links from the assistant work for 10 minutes. Every download is recorded for the HorseUp team. The assistant cannot read discussions or change anything.</p>
    {status === 'authenticated' && <><h2>Connected assistants</h2>
      {error && <p role="alert" className="error">{error}</p>}
      {!connections ? <p role="status">Loading…</p> : !connections.length ? <p>No assistant is connected to {session?.user?.email}.</p> :
        connections.map(c => <div className="member" key={c.id}><span>{c.name}<small>{c.host ? `${c.host} · ` : ''}connected {new Date(c.connectedAt).toLocaleDateString()}</small></span><button className="quiet" onClick={() => remove(c)}>Disconnect</button></div>)}
    </>}
  </section></Shell>;
}
