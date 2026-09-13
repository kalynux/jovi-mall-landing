# syntax=docker/dockerfile:1
#
# The customer storefront and marketing site. Unlike the three dashboards, this is
# NOT a bundle behind nginx — it is a running Node server, and it has to be:
#
#   * `src/middleware.ts` resolves the locale and gates sessions on every request;
#   * pages are server components that fetch from the API at request time;
#   * ISR revalidates on a timer;
#   * `next/image` optimises on demand.
#
# Static hosting would drop all four. (`output: "export"` does exist in this
# repository — it is the NATIVE branch in next.config.ts, for the Capacitor app,
# and it is a different product.)
#
# ⚠ BUILT IN CI, NEVER ON THE HOST. The VPS is 2 vCPU / 8 GB and already runs
#   Mongo, three Redis, two Postgres clusters, n8n and three backend services.
#   `.github/workflows/release.yml` builds this on GitHub's runners and pushes it
#   to GHCR; Dokploy only ever pulls.
#
# ⚠ THIS BUILD IS NOT HERMETIC, AND THAT IS DELIBERATE UPSTREAM.
#   `/pricing` refuses to publish without real prices — `assertCopyMatchesCatalog`
#   compares the page's claims against the live plan catalogue — so `next build`
#   FAILS when the API is unreachable. There is no offline fallback and adding one
#   would mean shipping invented prices, which is the thing that check exists to
#   prevent.
#
#   So the build needs `https://api.wi-mall.com` reachable from the builder. It is:
#   verified 200 on /api/health on 2026-09-13, from the public internet, which is
#   where GitHub's runners sit. ⚠ If a build ever fails here with a pricing error,
#   check the API before looking at this file.

# ─── Stage 1: dependencies ───────────────────────────────────────────────────
# Split from the build so a source-only change reuses the install layer.
FROM node:22-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./

# `npm ci` not `npm install`: exactly the lockfile, and a failure if the two
# disagree.
#
# ⚠ THIS IS ALSO WHERE sharp COMES FROM, AND IT IS LOAD-BEARING FOR PRODUCT
#   IMAGES. sharp is an optionalDependency of next (0.34.5 here) and is what
#   `next/image` uses to optimise on the server. Installing on alpine pulls the
#   musl build, which is correct for this base image — but it is ALSO why the
#   runtime stage copies it explicitly rather than trusting the standalone tracer.
RUN npm ci

# ─── Stage 2: build ──────────────────────────────────────────────────────────
FROM node:22-alpine AS build

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Next reads `.env.production` because `next build` sets NODE_ENV=production. It
# has no `--mode` flag, unlike the Vite dashboards, so the filename IS the
# selector and there is nothing to pass here.
#
# ⚠ `.env.local` WOULD BEAT IT AND IS EXCLUDED FROM THE CONTEXT FOR THAT REASON.
#   See .dockerignore. A developer's copy points at localhost:8022; if it reached
#   this stage the image would be built against a host that does not exist in
#   production, the build would still succeed, and the site would fail at runtime
#   with no clue as to why.
RUN npm run build

# ─── CONFIGURATION GUARD ─────────────────────────────────────────────────────
# Prove the bundle was built against `.env.production` before this image can
# exist. Next inlines every NEXT_PUBLIC_ value at build time, so a build that
# never saw that file still SUCCEEDS — on the default in src/lib, pointed at
# localhost.
#
# ⚠ PRESENCE OF THE PRODUCTION HOST, NOT ABSENCE OF localhost. A correct bundle
#   contains both: the localhost URL survives as an unreachable fallback in the
#   source. Asserting localhost is absent fails every legitimate build — measured
#   on the sibling dashboards before this guard was written.
RUN grep -rq "api[.]wi-mall[.]com" .next/ || ( \
      echo "FATAL: the production API host is not in the build output."; \
      echo "  .env.production was not read by this build."; \
      echo "  Check that .dockerignore does not exclude it."; \
      exit 1 )

# ─── Stage 3: run ────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
# ⚠ HOSTNAME=0.0.0.0 IS REQUIRED, NOT TIDINESS. Next's standalone server binds
#   localhost by default, which inside a container means the container itself —
#   Traefik would get connection refused on every request while the process looked
#   perfectly healthy in the logs.
ENV HOSTNAME=0.0.0.0
ENV PORT=3000
# Heap ceiling BELOW the container ceiling (512 MB in the compose file), so V8
# collects hard instead of the kernel killing the process. A killed container
# drops every in-flight request; a GC pause does not. Same reasoning as the
# backend services.
ENV NODE_OPTIONS=--max-old-space-size=384
# Next phones home with anonymous build telemetry. Off in a container, where
# nobody can answer the prompt it would otherwise print.
ENV NEXT_TELEMETRY_DISABLED=1

# Run unprivileged. The server writes nothing outside the ISR cache it owns.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# ⚠ THESE THREE COPIES ARE NOT INTERCHANGEABLE, AND OMITTING EITHER OF THE LAST
#   TWO GIVES A 200 WITH A BROKEN PAGE.
#
#   `.next/standalone` is the traced server — server.js plus only the modules it
#   actually imports. `public/` and `.next/static/` are deliberately NOT traced by
#   Next, on the assumption that a CDN serves them. Nothing here does. Without
#   `.next/static` the HTML renders and there is no CSS and no JavaScript; without
#   `public/` every image and icon 404s. Neither produces a server error.
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/public ./public

# ⚠ sharp, COPIED EXPLICITLY RATHER THAN TRUSTED TO THE TRACER.
#   `next/image` needs it to optimise on the server, and it is loaded through a
#   dynamic require that the standalone tracer does not always follow. When it is
#   missing the failure is not a build error — it is every product image on the
#   shop failing at request time, in production, on a page that worked in dev.
#   `@img/*` holds sharp's platform binaries and is useless without it, so the two
#   are copied together.
COPY --from=build --chown=nextjs:nodejs /app/node_modules/sharp ./node_modules/sharp
COPY --from=build --chown=nextjs:nodejs /app/node_modules/@img ./node_modules/@img

USER nextjs

EXPOSE 3000

# ⚠ LIVENESS, NOT READINESS, AND IT HITS `/` ON PURPOSE.
#   `/` passes through the next-intl middleware and redirects to a locale, so a
#   3xx here proves the server AND the middleware are alive — a better signal than
#   a static file would give. Anything under 500 counts as alive; only a server
#   error or a dead socket fails.
#
#   It must never become a readiness check on the API. If a jovi-mall blip could
#   fail this, Docker would restart a storefront that is itself perfectly healthy,
#   and the marketing pages — which need no API at all — would go down with it.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "require('http').get({host:'127.0.0.1',port:3000,path:'/'},r=>process.exit(r.statusCode<500?0:1)).on('error',()=>process.exit(1))"

# `server.js` is what `output: "standalone"` emits at the root of the traced tree.
# Not `next start` — that needs the full next CLI and node_modules, which is
# exactly what this image does not carry.
CMD ["node", "server.js"]
