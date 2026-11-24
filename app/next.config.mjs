/** @type {import('next').NextConfig} */
const staticExport = process.env.STATIC_EXPORT === '1';

const nextConfig = {
  reactStrictMode: true,
};

if (staticExport) {
  // Cloudflare Pages serves plain static files, so there is no Next.js runtime
  // and config-level rewrites are not available. The app reaches both upstream
  // APIs through the Cloudflare Worker configured in NEXT_PUBLIC_CORS_PROXY_TEMPLATE.
  nextConfig.output = 'export';
} else {
  // Local-dev fallback relay. This is a config-level rewrite, NOT a server API
  // route: the browser still sends the user's own CID / token as request headers.
  nextConfig.rewrites = async () => [
    { source: '/p/eyecon/:path*', destination: 'https://api.eyecon-app.com/:path*' },
    { source: '/p/tc/:path*', destination: 'https://search5.truecaller.com/:path*' },
    { source: '/p/tc-eu/:path*', destination: 'https://search5-eu.truecaller.com/:path*' },
    { source: '/p/tc-noneu/:path*', destination: 'https://search5-noneu.truecaller.com/:path*' },
  ];
}

export default nextConfig;

import('@opennextjs/cloudflare').then(m => m.initOpenNextCloudflareForDev());
