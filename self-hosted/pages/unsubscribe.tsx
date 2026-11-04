import { useState } from 'react';
import { useRouter } from 'next/router';
import { request } from '../lib/client';
import { Shell } from '../components/Shell';
// A confirmation step keeps link scanners from opting people out on GET.
export default function Unsubscribe() {
  const router = useRouter();
  const [state, setState] = useState<'idle' | 'busy' | 'done'>('idle'); const [error, setError] = useState('');
  const m = typeof router.query.m === 'string' ? router.query.m : ''; const t = typeof router.query.t === 'string' ? router.query.t : '';
  return <Shell><section className="login"><h1>Email notifications</h1>
    {state === 'done' ? <p role="status">You will no longer receive notification emails for this room. You can turn them back on inside the room.</p> : <>
      <p>Stop notification emails about new documents and discussions in this deal room? You keep access to the room.</p>
      <button disabled={!m || !t || state === 'busy'} onClick={async () => { setState('busy'); setError(''); try { await request('/api/unsubscribe', { m, t }); setState('done'); } catch (err) { setError((err as Error).message); setState('idle'); } }}>Stop notification emails</button>
    </>}
    {error && <p role="alert" className="error">{error}</p>}
  </section></Shell>;
}
