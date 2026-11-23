/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Same-origin relay for the two upstream APIs. This is a config-level rewrite,
  // NOT a server API route: the browser still sends the user's own CID / token as
  // request headers, so nothing secret is stored or held on the server. It exists
  // only because neither upstream sends CORS headers.
  async rewrites() {
    return [
      {
        source: '/p/eyecon/:path*',
        destination: 'https://api.eyecon-app.com/:path*',
      },
      {
        source: '/p/tc/:path*',
        destination: 'https://search5.truecaller.com/:path*',
      },
      {
        source: '/p/tc-eu/:path*',
        destination: 'https://search5-eu.truecaller.com/:path*',
      },
      {
        source: '/p/tc-noneu/:path*',
        destination: 'https://search5-noneu.truecaller.com/:path*',
      },
    ];
  },
};

export default nextConfig;
