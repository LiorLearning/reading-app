/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: ['firebasestorage.googleapis.com', 'storage.googleapis.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.firebasestorage.googleapis.com',
      },
      {
        protocol: 'https',
        hostname: '**.storage.googleapis.com',
      },
    ],
    // Enable image optimization
    formats: ['image/avif', 'image/webp'],
  },
  // Enable experimental features for better performance
  experimental: {
    optimizePackageImports: ['lucide-react', '@radix-ui/react-icons', 'firebase', 'firebase/firestore', 'firebase/auth', 'firebase/storage'],
  },
  // Compiler optimizations
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error', 'warn'] } : false,
  },
  // Don't fail build on ESLint warnings
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  // Exclude non-page files from pages directory
  pageExtensions: ['tsx', 'ts', 'jsx', 'js'],
  
  // Disable Pages Router - we only use App Router
  // Note: src/pages files are treated as routes by Next.js Pages Router
  // They should be made dynamic or moved to avoid SSR issues
  
  webpack: (config, { isServer }) => {
    // Handle Node.js built-in modules for client-side code
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        'child_process': false,
        'stream': false,
        'fs': false,
        'net': false,
        'tls': false,
        'crypto': false,
      };
      
      // Ignore Node.js protocol imports in client-side code
      config.resolve.alias = {
        ...config.resolve.alias,
        'node:child_process': false,
        'node:stream': false,
        'node:fs': false,
        'node:net': false,
        'node:tls': false,
        'node:crypto': false,
      };
    }
    
    // Use IgnorePlugin to prevent webpack from trying to bundle Node.js modules on client-side only
    if (!isServer) {
      const webpack = require('webpack');
      config.plugins.push(
        new webpack.IgnorePlugin({
          resourceRegExp: /^node:/,
        })
      );
    }
    
    // Exclude @openai/agents from client-side bundle due to Node.js dependencies
    if (!isServer) {
      config.externals = config.externals || [];
      config.externals.push({
        '@openai/agents': 'commonjs @openai/agents',
        '@openai/agents/realtime': 'commonjs @openai/agents/realtime',
        '@openai/agents-core': 'commonjs @openai/agents-core',
      });
    }
    
    return config;
  },
}

module.exports = nextConfig
