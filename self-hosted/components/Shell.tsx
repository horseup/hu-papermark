import type { ReactNode } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { signOut } from 'next-auth/react';
export function Shell({ children, email }: { children: ReactNode; email?: string }) {
  return <><Head><title>HorseUp · Deal room</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
    <header className="topbar"><Link href="/" className="brand">HorseUp <span>Deal room</span></Link>
      {email && <div className="account"><span>{email}</span><button className="quiet" onClick={() => signOut({ callbackUrl: '/login' })}>Sign out</button></div>}
    </header><main>{children}</main><footer><a href="https://github.com/horseup/hu-papermark/tree/codex/investor-rooms">Source code · AGPL</a></footer></>;
}
