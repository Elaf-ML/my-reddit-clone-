/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Warning: This allows production deployment with ESLint errors
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;