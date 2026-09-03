import path from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: __dirname,
  turbopack: {
    root: __dirname,
  },
  images: {
    unoptimized: true,
  },
  async redirects() {
    return [
      { source: "/companion", destination: "/", permanent: true },
      { source: "/api/site-mochi/sprite/:path*", destination: "/sprites/:path*", permanent: true },
    ];
  },
  async rewrites() {
    return {
      beforeFiles: [
        { source: "/api/companion/sync", destination: "/companion-gone.json" },
        { source: "/api/companion/sync/", destination: "/companion-gone.json" },
        { source: "/api/companion/trello", destination: "/companion-gone.json" },
        { source: "/api/companion/trello/", destination: "/companion-gone.json" },
      ],
    };
  },
  async headers() {
    return [
      {
        source: "/companion-gone.json",
        headers: [
          { key: "Cache-Control", value: "public, max-age=120, s-maxage=120" },
          { key: "Content-Type", value: "application/json; charset=utf-8" },
        ],
      },
    ];
  },
  webpack: (config) => {
    config.resolve = config.resolve || {}
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@react-native-async-storage/async-storage": false,
      "pino-pretty": false,
    }
    return config
  },
}

export default nextConfig
