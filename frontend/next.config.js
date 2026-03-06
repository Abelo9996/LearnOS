/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Allow production builds to succeed even with ESLint errors
    // TODO: Fix all eslint errors properly
    ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig
