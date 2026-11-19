/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config) => {
    // pdfjs-dist optionally requires node-canvas; not needed in the browser
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
