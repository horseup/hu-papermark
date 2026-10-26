import { useState } from 'react';
import { useRouter } from 'next/router';
import { signIn } from 'next-auth/react';
import { Shell } from '../components/Shell';
export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  return <Shell><section className="login"><h1>Your HorseUp deal room</h1><p>Sign in with the email address on your invitation to review documents and join the conversation.</p>
    {sent || router.query.sent ? <div role="status"><h2>Check your inbox</h2><p>If this address has access, a personal sign-in link is on its way. The link expires in 15 minutes.</p><button className="quiet" onClick={() => { setSent(false); router.replace('/login'); }}>Use another email</button></div> :
    <form onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try {
      const destination = typeof router.query.callbackUrl === 'string' && router.query.callbackUrl.startsWith('/') && !router.query.callbackUrl.startsWith('//') ? router.query.callbackUrl : '/';
      const result = await signIn('email', { email, callbackUrl: destination, redirect: false });
      if (result?.error) throw new Error('Unable to send your sign-in link. Please try again.'); setSent(true);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); } }}>
      <label>Email address<input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} /></label>
      <button disabled={busy}>{busy ? 'Sending…' : 'Email me a sign-in link'}</button>
    </form>}
    {(error || router.query.error) && <p role="alert" className="error">{error || 'This sign-in link could not be used. Request a new link to continue.'}</p>}
    <p className="muted">Access is by invitation. Room activity and document viewing time are recorded for the HorseUp team.</p>
  </section></Shell>;
}
