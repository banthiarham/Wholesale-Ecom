/** @type {import('next').NextConfig} */
const apiOrigin = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000"

// Uploaded images are normally referenced by relative path (/uploads/...) and
// proxied by the rewrite below, so they need no remote pattern. This covers the
// case where something emits an absolute URL against the API host instead.
const apiRemotePattern = (() => {
  try {
    const { protocol, hostname } = new URL(apiOrigin)
    return [{ protocol: protocol.replace(":", ""), hostname }]
  } catch {
    return []
  }
})()

const nextConfig = {
  // Emits a self-contained server bundle (.next/standalone) so the production
  // image only needs the traced dependencies rather than a full node_modules.
  output: "standalone",
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${apiOrigin}/api/v1/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${apiOrigin}/uploads/:path*`,
      },
    ]
  },
  images: {
    remotePatterns: [
      // Seed/demo placeholder imagery
      { protocol: "https", hostname: "picsum.photos" },
      { protocol: "https", hostname: "fastly.picsum.photos" }, // picsum.photos redirects here
      { protocol: "https", hostname: "images.unsplash.com" },
      ...apiRemotePattern,
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
