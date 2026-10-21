// Everything here is behind a login, so nothing should be indexed, framed or sniffed.
const securityHeaders = [
    { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
    poweredByHeader: false,
    async headers() {
        return [{ source: '/:path*', headers: securityHeaders }];
    },
};

export default nextConfig;
