import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // upload de PDF do currículo via server action (padrão é 1 MB)
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};

export default nextConfig;
