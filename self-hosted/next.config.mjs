import { fileURLToPath } from 'node:url';
/** HorseUp-only entrypoint: upstream app/, pages/ and middleware are not built. */
const config = {
  output: 'standalone',
  outputFileTracingRoot: fileURLToPath(new URL('../', import.meta.url)),
  reactStrictMode: true,
  experimental: { cpus: 1, externalDir: true },
  poweredByHeader: false,
  // ESM-only server packages are loaded by Node at runtime instead of being bundled.
  serverExternalPackages: ['oidc-provider', '@modelcontextprotocol/sdk', 'archiver'],
  // Public OAuth and MCP paths. The provider catch-all is a fallback, so the
  // consent page (dynamic route /oauth/interaction/[uid]) is matched first.
  async rewrites() {
    return {
      afterFiles: [
        { source: '/mcp', destination: '/api/mcp' },
        { source: '/.well-known/oauth-protected-resource', destination: '/api/oauth-resource' },
        { source: '/.well-known/oauth-protected-resource/mcp', destination: '/api/oauth-resource' },
        { source: '/.well-known/oauth-authorization-server', destination: '/api/oauth/.well-known/oauth-authorization-server' },
        { source: '/.well-known/openid-configuration', destination: '/api/oauth/.well-known/openid-configuration' },
        { source: '/oauth/interaction/:uid/:step(allow|deny)', destination: '/api/oauth-interaction?uid=:uid&step=:step' },
      ],
      fallback: [{ source: '/oauth/:path*', destination: '/api/oauth/:path*' }],
    };
  },
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
