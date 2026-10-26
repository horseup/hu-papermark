/** HorseUp-only entrypoint: upstream app/, pages/ and middleware are not built. */
const config = {
  output: 'standalone',
  reactStrictMode: true,
  experimental: { cpus: 1, externalDir: true },
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'same-origin' },
      { key: 'X-Frame-Options', value: 'DENY' },
    ] }];
  },
};
export default config;
