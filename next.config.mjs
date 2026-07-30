/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3000/api/v1/:path*",
      },
      {
        source: "/uploads/:path*",
        destination: "http://localhost:3000/uploads/:path*",
      },
    ]
  },
  images: {
    remotePatterns: [
      // Seed/demo placeholder imagery
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" }, // picsum.photos redirects here
      { protocol: "https", hostname: "images.unsplash.com" },
    ],
    // The dev-time image optimizer proxies every unique url+size+quality through
    // its own fetch/sharp pipeline, which is a common source of flaky 500s against
    // external hosts (redirects, upstream rate limits, transient network errors).
    // Serving images unoptimized in development sidesteps that pipeline entirely;
    // production keeps full optimization.
    unoptimized: process.env.NODE_ENV !== "production",
  },
}

export default nextConfig