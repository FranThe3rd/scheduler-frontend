import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev assets are blocked for any host other than localhost. Phones on the
  // same Wi-Fi open this server by its LAN address, so allow private ranges.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*"],
};

export default nextConfig;
