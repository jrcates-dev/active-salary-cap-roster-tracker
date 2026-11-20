import type { NextConfig } from "next";

/**
 * The site is fully static: every page is prerendered from one JSON snapshot and
 * written to `out/`, which any static host (GitHub Pages, Vercel) can serve.
 * On GitHub Pages a project site lives under `/<repo-name>`, so the deploy
 * workflow sets PAGES_BASE_PATH; locally it is empty.
 */
const basePath = process.env.PAGES_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  // Client code fetches the static contract files (/data/contracts/<key>.json) and
  // has to prefix them with the base path itself.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  trailingSlash: true,
  // Cache Components and partial prefetching turn on partial prerendering, which a
  // static export cannot use. Nothing here renders at request time, so neither is needed.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
