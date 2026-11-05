import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/router';
import { request } from '../lib/client';
import { Shell } from '../components/Shell';

// Opened from the opt-out link in notification emails. Loading the page only
// reads the state; turning emails off or back on needs a click, so link
// scanners change nothing.
type Status = { room: string; roomId: string; subscribed: boolean };

export default function Unsubscribe() {
  const router = useRouter();
  const m = typeof router.query.m === 'string' ? router.query.m : '';
  const t = typeof router.query.t === 'string' ? router.query.t : '';
  const [view, setView] = useState<'loading' | 'invalid' | 'ready'>('loading');
  const [status, setStatus] = useState<Status | null>(null);
  const [changed, setChanged] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!router.isReady) return;
    if (!m || !t) { setView('invalid'); return; }
    request<Status>(`/api/unsubscribe?m=${encodeURIComponent(m)}&t=${encodeURIComponent(t)}`)
      .then(result => { setStatus(result); setView('ready'); })
      .catch(() => setView('invalid'));
  }, [router.isReady, m, t]);

  async function update(subscribed: boolean) {
    setBusy(true); setError('');
    try {
      setStatus(await request<Status>('/api/unsubscribe', { m, t, ...(subscribed ? { resubscribe: true } : {}) }));
      setChanged(true);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  let title = 'Email notifications';
  let body: ReactNode = <p role="status" className="muted">Loading…</p>;
  if (view === 'invalid') {
    title = 'This link is not valid';
    body = <p>The link may be incomplete. Open it again from the email, or sign in to the deal room and change your email settings inside the room.</p>;
  } else if (view === 'ready' && status) {
    const room = <strong>{status.room}</strong>;
    if (status.subscribed && !changed) {
      title = 'Stop notification emails?';
      body = <><p>You get emails when there are new documents or replies in {room}. You keep access to the room either way.</p>
        <button disabled={busy} onClick={() => update(false)}>Stop notification emails</button></>;
    } else if (status.subscribed) {
      title = 'Notification emails are back on';
      body = <><p role="status">You will get emails again when there are new documents or replies in {room}.</p>
        <button className="quiet" disabled={busy} onClick={() => update(false)}>Stop them again</button></>;
    } else {
      title = changed ? 'You are unsubscribed' : 'You are already unsubscribed';
      body = <><p role="status">You will no longer get notification emails for {room}. You keep access to the room, and we will still tell you if your access ends.</p>
        <button disabled={busy} onClick={() => update(true)}>Turn notification emails back on</button></>;
    }
  }

  return <Shell><section className="login">
    <a href="https://horseup.de"><img className="page-logo" src="https://horseup.de/logo.png" alt="HorseUp" width={80} /></a>
    <h1>{title}</h1>
    {body}
    {error && <p role="alert" className="error">{error}</p>}
  </section></Shell>;
}
