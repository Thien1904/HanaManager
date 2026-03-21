/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',  // Cho phép load ảnh từ Supabase Storage
      },
    ],
  },
}

module.exports = nextConfig
