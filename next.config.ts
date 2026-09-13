import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Two builds out of one codebase.
 *
 * `npm run build` is the web app and is untouched by everything below: server
 * components, middleware, ISR, image optimisation and the whole SEO surface all
 * behave exactly as they did.
 *
 * `npm run build:native` sets NEXT_PUBLIC_APP_TARGET=native and produces the
 * static bundle Capacitor wraps. The flag is read in two places — here, and
 * `src/lib/platform`, where it is inlined by the compiler so the unused branch
 * is dropped from each bundle.
 */
const isNativeTarget = process.env.NEXT_PUBLIC_APP_TARGET === "native";

const nextConfig: NextConfig = {
  experimental: {
    // next/font downloads the font files at build time. On this machine that
    // fetch fails TLS verification ("Failed to fetch `Plus Jakarta Sans` from
    // Google Fonts") because Turbopack ships its own certificate bundle and
    // does not see the OS trust store. This points it at the system store.
    turbopackUseSystemTlsCerts: true,
  },

  ...(isNativeTarget
    ? {
        /**
         * Capacitor serves files off the device filesystem, so there is no
         * server to render anything. Next warns that middleware is disabled
         * under this setting rather than failing — which is what we want:
         * `src/middleware.ts` stays in place for the web build, and the two
         * jobs it does on a device are done client-side instead (locale from a
         * stored preference, the session gate by `useAuthGuard`).
         */
        output: "export" as const,

        /**
         * Its own TypeScript project.
         *
         * A developer running `next dev` while building the app is the normal
         * case, and the two collide over one generated file: the dev server
         * rewrites `.next/dev/types/routes.d.ts` the moment
         * `build-native.mjs` renames a route out of the tree, and the base
         * tsconfig includes it — so the build fails typechecking a file the dev
         * server was halfway through writing. `tsconfig.native.json` is the
         * base config minus that one include.
         *
         * A separate `distDir` was the other half of this and has been dropped:
         * setting it moves the *export* output there too, leaving `out/` empty
         * and `webDir` pointing at nothing. Dev and build already keep to
         * different subtrees of `.next`.
         */
        typescript: { tsconfigPath: "tsconfig.native.json" },

        /**
         * `/shop` must land on `out/shop/index.html`. Without this, export
         * writes `out/shop.html`, and Capacitor's local server resolves a
         * extension-less path by looking for `index.html` inside a directory of
         * that name — so every route but the root would 404 on the device.
         */
        trailingSlash: true,

        /**
         * The optimiser is a server. There isn't one, so images are served as
         * authored — which is also correct for the two remote sources the shop
         * uses, Cloudinary and the vendors' own CDNs, both of which already
         * deliver sized derivatives.
         */
        images: { unoptimized: true },
      }
    : {
        /**
         * The WEB build ships as a container, so it needs the self-contained
         * output rather than a tree that assumes `node_modules` is still beside
         * it.
         *
         * `standalone` makes `next build` trace the server's actual imports and
         * emit `.next/standalone/server.js` with only those files. The runtime
         * image then carries no `node_modules`, no source and no build tooling —
         * it went from roughly 1.4 GB of installed dependencies to a couple of
         * hundred megabytes, which on a 2 vCPU / 8 GB host shared with Mongo,
         * three Redis, two Postgres clusters and n8n is the difference between
         * affordable and not.
         *
         * ⚠ THIS CHANGES HOW THE SERVER IS STARTED, NOT WHAT IT DOES. Everything
         *   the web build relies on is still there: server components, the
         *   next-intl middleware, ISR and image optimisation. It is not
         *   `output: "export"` — that is the native branch above, and it is the
         *   one that genuinely drops middleware and the optimiser.
         *
         * ⚠ TWO DIRECTORIES ARE NOT TRACED AND MUST BE COPIED BY HAND.
         *   `public/` and `.next/static/` are deliberately excluded by Next, on
         *   the assumption a CDN serves them. Nothing here does, so the
         *   Dockerfile copies both. Forgetting either gives a site that renders
         *   its HTML correctly and has no CSS, no JavaScript and no images — a
         *   200 with a broken page, which is why the Dockerfile says so too.
         */
        output: "standalone" as const,
      }),
};

export default withNextIntl(nextConfig);
