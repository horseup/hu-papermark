import type { GetServerSideProps } from 'next';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../../lib/auth';
import { db } from '../../../lib/db';
import { mayConnect, oauthProvider } from '../../../lib/oauth';
import { Shell } from '../../../components/Shell';

type Props = { uid: string; client: string; host: string; email: string } | { uid: string; error: string };

// Consent screen for an AI connector. Signing in uses the normal email link;
// the user then approves this one client explicitly.
export const getServerSideProps: GetServerSideProps<Props> = async ({ req, res, params }) => {
  res.setHeader('Cache-Control', 'no-store');
  const uid = String(params?.uid ?? '');
  let details;
  try { details = await oauthProvider().interactionDetails(req, res); } catch { return { props: { uid, error: 'This connection request has expired or was opened in another browser. Start it again from your AI assistant.' } }; }
  if (details.uid !== uid) return { props: { uid, error: 'This connection request is not valid. Start it again from your AI assistant.' } };
  const session = await getServerSession(req, res, authOptions);
  const email = session?.user?.email?.trim().toLowerCase();
  if (!email) return { redirect: { destination: `/login?callbackUrl=${encodeURIComponent(`/oauth/interaction/${uid}`)}`, permanent: false } };
  const user = await db.user.findUnique({ where: { email }, select: { emailVerified: true } });
  if (!user?.emailVerified || !(await mayConnect(email))) return { props: { uid, error: 'This email address has no active deal room access.' } };
  const client = await oauthProvider().Client.find(String(details.params.client_id));
  if (!client) return { props: { uid, error: 'The AI assistant is no longer registered. Start the connection again.' } };
  const redirect = String(details.params.redirect_uri ?? '');
  let host = redirect; try { host = new URL(redirect).host || redirect; } catch { /* custom scheme */ }
  return { props: { uid, client: client.clientName ?? 'An AI assistant', host, email } };
};

export default function Consent(props: Props) {
  return <Shell><section className="login"><h1>Connect an AI assistant</h1>
    {'error' in props ? <p role="alert" className="error">{props.error}</p> : <>
      <p><strong>{props.client}</strong> wants to access the HorseUp deal room as <strong>{props.email}</strong>.</p>
      <p className="muted">It returns you to <strong>{props.host}</strong> afterwards. Only continue if you started this connection yourself.</p>
      <h2>It will be able to</h2>
      <ul>
        <li>see the names of your rooms and the documents in them,</li>
        <li>request download links for those documents. Each link works for 10 minutes.</li>
      </ul>
      <p className="muted">It cannot see discussions, invite or remove people, or change anything. Each download is recorded for the HorseUp team, the same as in the browser. Access ends when you disconnect it on the Connect page or when your room access ends.</p>
      <div className="consent-actions">
        <form method="post" action={`/oauth/interaction/${encodeURIComponent(props.uid)}/allow`}><button>Allow access</button></form>
        <form method="post" action={`/oauth/interaction/${encodeURIComponent(props.uid)}/deny`}><button className="quiet">Cancel</button></form>
      </div>
    </>}
  </section></Shell>;
}
