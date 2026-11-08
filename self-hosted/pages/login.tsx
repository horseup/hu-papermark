import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { signIn, useSession } from 'next-auth/react';
import { Shell } from '../components/Shell';

// NextAuth redirects here with ?error=<code> when a sign-in step fails.
function linkError(code: unknown) {
  if (typeof code !== 'string' || !code) return '';
  if (code === 'Verification') return 'This sign-in link was already used or has expired. Each link works once, for 15 minutes. Request a new link and open the newest email.';
  if (code === 'AccessDenied') return 'This email address no longer has access to the deal room. Contact the HorseUp team if you think this is a mistake.';
  return 'This sign-in link could not be used. Request a new link to continue.';
}

function safeDestination(value: unknown) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') ? value : '/';
}

export default function Login() {
  const router = useRouter();
  const { status } = useSession();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const destination = safeDestination(router.query.callbackUrl);
  // Someone who is already signed in (for example after clicking a used link a second time) goes straight in.
  useEffect(() => { if (router.isReady && status === 'authenticated') router.replace(destination); }, [router, status, destination]);
  if (status === 'loading' || status === 'authenticated') return <Shell><section className="login"><p role="status">Opening your deal room…</p></section></Shell>;
  const showSent = sent || Boolean(router.query.sent);
  const message = error || (showSent ? '' : linkError(router.query.error));
  return <Shell><section className="login"><h1>Your HorseUp deal room</h1><p>Sign in with the email address on your invitation to review documents and join the conversation.</p>
    {showSent ? <div role="status"><h2>Check your inbox</h2><p>If this address has access, a personal sign-in link is on its way. The link expires in 15 minutes.</p><button className="quiet" onClick={() => { setSent(false); router.replace('/login'); }}>Use another email</button></div> :
    <form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try {
      const result = await signIn('email', { email, callbackUrl: destination, redirect: false });
      if (result?.error) throw new Error('Unable to send your sign-in link. Please try again.'); setSent(true);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }}>
      <label>Email address<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <button disabled={busy}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button>
    </form>}
    {message && <p role="alert" className="error">{message}</p>}
    <p className="muted">Access is by invitation. Room activity and document viewing time are recorded for the HorseUp team.</p>
  </section></Shell>;
}
