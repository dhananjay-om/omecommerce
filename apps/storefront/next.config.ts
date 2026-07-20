import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app has its own lockfile, but sibling lockfiles exist higher up
  // (the backend's, the admin app's, and an unrelated one in the user's
  // home directory) — pin the root explicitly so Turbopack doesn't guess wrong.
  turbopack: {
    root: path.join(import.meta.dirname),
  },
};

export default nextConfig;
