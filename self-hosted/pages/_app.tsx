import type { AppProps } from 'next/app';
import { SessionProvider } from 'next-auth/react';
import 'react-pdf/dist/Page/TextLayer.css';
import '../styles/app.css';
import '../styles/fonts.css';
import '../styles/room.css';
export default function App({ Component, pageProps }: AppProps) {
  return <SessionProvider session={pageProps.session}><Component {...pageProps} /></SessionProvider>;
}
