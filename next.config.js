/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // El service worker vive en /public/sw.js y se registra manualmente
  // desde app/register-sw.tsx (sin dependencia de build extra).
};
module.exports = nextConfig;
