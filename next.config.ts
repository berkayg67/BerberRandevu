import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  async redirects() {
    // Şimdilik ana adres demo dükkâna gider; tanıtım sayfası sonra eklenecek.
    return [{ source: "/", destination: "/berber-demo", permanent: false }];
  },
};

export default nextConfig;
