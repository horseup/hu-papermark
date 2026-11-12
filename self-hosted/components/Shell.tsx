import type { ReactNode } from 'react';
import Link from 'next/link';
import Head from 'next/head';
import { signOut } from 'next-auth/react';

export type AdminTab = 'rooms' | 'documents' | 'stages';
const TABS: { id: AdminTab; label: string }[] = [{ id: 'rooms', label: 'Rooms' }, { id: 'documents', label: 'Documents' }, { id: 'stages', label: 'Stages' }];

export function Account({ email, light = false }: { email?: string; light?: boolean }) {
  if (!email) return null;
  return <div className={`account${light ? ' light' : ''}`}><span>{email}</span><button type="button" className="link-btn" onClick={() => signOut({ callbackUrl: '/login' })}>Sign out</button></div>;
}

export function SiteFooter() {
  return <footer className="site-foot"><div className="foot-inner">
    <div className="foot-group"><span>HorseUp GmbH i.G. · Gutenbergstraße 27, 21465 Reinbek</span><a href="mailto:investors@horseup.de">investors@horseup.de</a><a href="https://horseup.de">horseup.de</a></div>
    <div className="foot-group"><Link href="/connect">Deal room MCP · dealroom.horseup.de/mcp</Link><a href="https://github.com/horseup/hu-papermark">Source code · AGPL</a></div>
  </div></footer>;
}

/** Page frame. `bare` pages (rooms) draw their own header over the banner. */
export function Shell({ children, email, admin = false, tab, bare = false, title = 'Deal room' }: {
  children: ReactNode; email?: string; admin?: boolean; tab?: AdminTab; bare?: boolean; title?: string;
}) {
  return <><Head><title>{`${title} · HorseUp`}</title><meta name="viewport" content="width=device-width, initial-scale=1" /></Head>
    {!bare && <header className="topbar">
      <div className="topbar-left"><Link href="/" className="brand"><img src="/brand/horseup-mark-white.png" alt="" className="brand-tile" />Deal room</Link>
        {admin && <nav className="topnav" aria-label="Main">{TABS.map(t => <Link key={t.id} href={`/?tab=${t.id}`} className={`nav${tab === t.id ? ' is-on' : ''}`} aria-current={tab === t.id ? 'page' : undefined}>{t.label}</Link>)}</nav>}
      </div>
      <Account email={email} />
    </header>}
    <main>{children}</main><SiteFooter /></>;
}
