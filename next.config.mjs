/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // three.js ships untranspiled ESM in places; Next handles it, but keeping the
  // heavy 3D deps out of the server bundle avoids needless work during dev.
  experimental: {
    optimizePackageImports: ['@react-three/drei'],
    // TypeScript 7 is the native compiler and no longer exposes the JS
    // compiler API Next.js used to call directly; this routes typechecking
    // through the TS CLI instead. Without it, dev server startup throws.
    useTypeScriptCli: true,
  },
};

export default nextConfig;
