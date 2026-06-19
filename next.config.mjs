import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // pnpm symlinks node_modules into a store under the user home dir, which makes
  // Next's file-tracing root inference walk up into C:\Users\<user> and hit the
  // locked "Application Data" junction. Pin the tracing root to this project.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
