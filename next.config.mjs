/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    // Suppress "Critical dependency: require function is used in a way..."
    // from @vladmandic/face-api (dynamic require inside the package)
    config.ignoreWarnings = [
      ...(config.ignoreWarnings ?? []),
      { module: /face-api/, message: /Critical dependency: require function/ },
    ];
    return config;
  },
};

export default nextConfig;
