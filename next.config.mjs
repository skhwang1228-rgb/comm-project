// STATIC_EXPORT=1 이면 휴대용 정적 빌드(npm run build:portable)
const isStatic = process.env.STATIC_EXPORT === "1";

/** @type {import('next').NextConfig} */
const nextConfig = {
  ...(isStatic ? { output: "export", distDir: ".next-portable" } : {}),
  webpack: (config) => {
    // pdfjs-dist optionally requires node-canvas; not needed in the browser
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
