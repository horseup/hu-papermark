import { fileURLToPath } from 'node:url';
/** HorseUp-only entrypoint: upstream app/, pages/ and middleware are not built. */
const config = {
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../', import.meta.url)),
  reactStrictMode: true,
  experimental: { cpus: 1, externalDir: true },
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'same-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    ] }];
  },
};
export default config;
