# Deploying storefront and marketing site

Operational doc for **this app only**. The one-time, cross-repo setup — DNS
records, the `production` branches, the plan seed — lives in
**`frontend/DEPLOY-FRONTENDS.md`** and is not repeated here.

| | |
|---|---|
| Serves | **https://wi-mall.com** |
| Talks to | https://api.wi-mall.com (jovi-mall) + https://track.wi-mall.com (geo-tracker) |
| Dokploy project | `Wi-Mall-Frontend` |
| Dokploy stack | `wi-landing` (type: Compose, source: **Raw**) |
| Image | `ghcr.io/kalynux/wimall-landing` |
| Runtime | Next.js standalone server on port 3000 |
| Replicas | 1 |
| Release branch | `production` (cut from `main`) |

## Files in this repo

| File | What it does |
|---|---|
| `Dockerfile` | Two-stage build. Read the comments before changing it — each warning in there is a failure that actually happened. |
| `.dockerignore` | Keeps developer env overrides and the native project out of the image. ⚠ A `*.local` env file reaching the build would silently win over `.env.production`. |
| `deploy/docker-compose.prod.yml` | The stack. Already loaded into Dokploy; this is the source of truth to re-paste from. |
| `.env.production` | **Committed on purpose.** Every value is inlined into the public bundle at build time, so none of it is secret — and CI has no other way to learn the production hosts. |
| `.github/workflows/release.yml` | Builds and pushes the image on `production`. Deploys nothing. |
| `.github/workflows/ci.yml` | Checks every push and PR. Publishes nothing. |

## Releasing a change

```bash
git checkout production
git merge main          # or commit directly
git push
```

Then: watch **Actions** for a green *Release image*, and press **Deploy** on the
`wi-landing` stack in Dokploy.

> ⚠ **Deploy WITHOUT `--build`.** The service uses `image:`, so there is nothing
> to build — but Dokploy offers to build on the host by default, and a build next
> to a 1.5 GB mongod on an 8 GB box ends with the kernel killing the database.

Nothing deploys automatically. That is deliberate; `release.yml` carries the
wiring for the other choice, skipped unless a `DOKPLOY_DEPLOY_URL` secret exists.

## Configuration lives in two places, and the split matters

**Build time — `.env.production`, in this repo.** The API host and everything else the
app reads. Next inlines these into the
JavaScript, so **the image IS the configuration**: changing this file does nothing
to a running container, it takes a new image.

**Deploy time — the Dokploy Environment tab.** Three values that only decide which
image is pulled and which hostname routes to it: `GHCR_OWNER`, `LANDING_TAG`,
`SITE_HOST`. The app never reads them. ⚠ **Nothing secret belongs in either
place** — one is committed and the other is public configuration.

**One exception the app does read at runtime: `API_INTERNAL_URL`.** The compose
file sets it to `http://jovi-mall:8022`, so the server's own API reads (`/shop`,
ISR revalidation) stay on `dokploy-network` instead of leaving through the public
IP and coming back in. That round trip is what made every `/shop` an 11 s 500 on
2026-09-21. Browsers and the CI build still use `NEXT_PUBLIC_API_URL`. Set it
blank in the Environment tab to go back to the public URL.

## Rolling back

`LANDING_TAG` is `production`, a **moving** tag — it changes on every release, so on
its own there is nothing to go back to. Every build prints an immutable alternative
in its Actions summary:

```
LANDING_TAG=sha-1a2b3c4
```

Paste that over `production` in the Environment tab and press **Deploy**.

## Verifying

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://wi-mall.com/
curl -s -o /dev/null -w '%{http_code} -> %{redirect_url}\n' http://wi-mall.com/   # must redirect
curl -s -o /dev/null -w '%{http_code}\n' https://wi-mall.com/en/shop        # deep link, hard refresh
```

Then open it and **sign in**. A 200 only proves the server is serving; it says
nothing about whether the bundle can reach its API.

## Shell access

```bash
ssh <user>@100.89.182.51      # tailnet only; the public IP answers on 80/443
cd /etc/dokploy/compose/compose-hack-multi-byte-protocol-edlz1q/code
docker compose -p compose-hack-multi-byte-protocol-edlz1q logs -f
```

⚠ The `-p` flag is not optional. Without it compose invents a project name from
the directory and operates on a **second**, empty stack — the error then says
nothing about the cause.

## 🔴 This build needs a populated plan catalogue, or it fails

`/pricing` refuses to publish without real prices: `assertCopyMatchesCatalog`
compares the page's hand-written sentences against the live plan catalogue. That is
deliberate — the alternative is shipping invented prices.

**Measured on 2026-09-13: the production catalogue was EMPTY** (0 plans for all
three roles) because the production `jovi_mall` database was created fresh with no
development data carried up. The build failed with:

```
Error occurred prerendering page "/en/pricing"
Marketing copy no longer matches the public plan catalog:
  • plan "starter" is no longer in the catalog, but ... still describe it
```

⚠ **The copy is not stale — the database is empty.** Seed it once, on the server:

```bash
cd /etc/dokploy/compose/wimallbackend-wimallbackend-xe7md3/code
docker compose -p wimallbackend-wimallbackend-xe7md3 --env-file .env \
  -f docker-compose.yml run --rm jovi-mall-toolbox npm run seed:plans
```

It is an idempotent upsert and creates exactly the codes the copy expects. A guard
at the top of `release.yml` now checks this and names the failure in five seconds
rather than 280 pages into a build log.

## Why this one is a server, not nginx

The three dashboards are static bundles. This is not, and cannot be: locale
middleware runs on every request, pages are server components that fetch at
request time, ISR revalidates on a timer, and `next/image` optimises on demand.
Static hosting would drop all four.

`output: "standalone"` is what keeps it affordable — the image carries the traced
server instead of ~1.4 GB of `node_modules`. ⚠ Two directories are **not** traced
and are copied by hand in the Dockerfile: `public/` and `.next/static/`. Missing
either gives correct HTML with no CSS, no JavaScript or no images — a 200 with a
broken page.

⚠ `sharp` is copied explicitly too. `next/image` needs it and it is loaded through
a dynamic require the tracer does not reliably follow. Without it, every product
image fails at request time in production on a page that worked in development.

## The www redirect

`www.wi-mall.com` redirects to the bare domain, scheme and path preserved, via a
Traefik `redirectregex`. One canonical origin matters here for two concrete
reasons: `NEXT_PUBLIC_SITE_URL` is `https://wi-mall.com` and every canonical tag,
sitemap entry and OpenGraph URL is built from it, so a www twin is duplicate
content; and the auth cookie is host-scoped, so a customer signed in on one host is
not signed in on the other — which presents as a session that randomly disappears.

⚠ The `$1` in that label is not a typo. Compose eats a single `$` as a variable;
`$$` escapes it to a literal for Traefik. Verified: compose **refuses** the
single-`$` form outright.

## Troubleshooting

### The image will not pull — `manifest unknown`

Three causes, in the order they are likely:

1. **The `production` branch has never been pushed**, so no image exists. Check the
   repo's Actions tab for a green *Release image* run.
2. **The tag in the Environment tab does not exist.** A `sha-` tag is only created
   by the build that produced it; a typo is indistinguishable from a missing image.
3. **Dokploy's registry credential expired.** One credential (`ghcr.io`, user
   `kalynux`) serves every stack on this host — if the backend images also stop
   pulling, it is this. Settings → Registry.

### The page loads but every request fails

Almost always CORS or the baked-in API host, and they are distinguishable:

- Open the browser console. `Access-Control-Allow-Origin` missing → the origin is
  not in the backend's allowlist. **Verified present on 2026-09-13** for all four
  production origins, so suspect a changed hostname rather than the backend.
- Requests going to `localhost` → the image was built without its production env
  file. That should be impossible: the Dockerfile has a guard that fails the build
  if the production host is not in the bundle. If you see it, the guard was removed.

### A deep link 404s or renders blank on a hard refresh

This is the failure the `base` setting exists to prevent. Test it:

```bash
curl -s -o /dev/null -w '%{http_code}\n' https://wi-mall.com/en/shop
curl -s -I https://wi-mall.com/assets/ | head -1        # must be 404, never 200
```

A blank page with a console error about MIME types means index.html is asking for
assets at a path relative to the current URL. ⚠ Do not fix that in nginx — the fix
is the base path at build time, and the comment in `vite.config.ts` explains why.

### An Environment change seems to do nothing

Press **Deploy**, not Restart. A container reads its environment when it is
*created*; a restart re-runs the same container with the same values. Dokploy's own
banner says this, and it cost the backend deploy a round trip.
