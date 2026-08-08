import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    // next/font downloads the font files at build time. On this machine that
    // fetch fails TLS verification ("Failed to fetch `Plus Jakarta Sans` from
    // Google Fonts") because Turbopack ships its own certificate bundle and
    // does not see the OS trust store. This points it at the system store.
    turbopackUseSystemTlsCerts: true,
  },
};

export default withNextIntl(nextConfig);
