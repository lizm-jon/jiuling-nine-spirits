import type { NextConfig } from 'next';

const isGitHubPages = process.env.GITHUB_ACTIONS === 'true';

const nextConfig: NextConfig = {
  output: 'export',
  images: { unoptimized: true },
  basePath: isGitHubPages ? '/jiuling-nine-spirits' : '',
  assetPrefix: isGitHubPages ? '/jiuling-nine-spirits/' : undefined,
  trailingSlash: true,
};

export default nextConfig;
