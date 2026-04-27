# gynx-panel — remaining work

Session-by-session progress. Each item names the scope, not the implementer; most land as one focused PR.

## shipped

### session 1 (f60ca508 and earlier)
- Design system scaffold (tokens, fonts, globals).
- App shell: Sidebar + TopBar + AppShell composer.
- Server Console page redesigned end-to-end.
- Button system restyled across the whole panel.
- `install-bundle.sh` / `uninstall-bundle.sh`.

### session 2 (current)
- **Design realignment** to the strict 80/15/5 rule — "glow is a reward, not a default." Stripped ambient gradient blobs from the canvas, replaced with a subtle dark-slate gradient + structural grid + noise overlay. Panels default to flat `#1F2937` with `rgba(255,255,255,0.05)` edges; hover reveals the purple edge + lift.
- **Metric-aware stat tiles** — CPU blue, RAM purple, Disk yellow, Network cyan, Status green. Progress bars appear when a tile has a defined limit. Severity prop flips the accent to yellow/red on threshold cross.
- **ServerDetailsBlock reordered** — Status (prominent) → Connection (IP + copy) → CPU / RAM / Disk / Network, stacked vertically in the right column.
- **Unified ChartPanel** with CPU / RAM / Network tabs (replaces the three side-by-side chart blocks). Taller chart body for readability, metric-tinted line per tab.
- **Terminal chrome** stripped of default glow — `#05070B` background, neutral edge, purple ring only on input focus.
- **Top-nav tabs** icon + group labels (`manage` / `monitor` / `config`). Active tab = purple pill, hover = blue flash.
- **SubNavigation strip** restyled with glassy backdrop + purple pill for the active tab.
- **Egg Switcher design doc** at `docs/EGG_SWITCHER.md` — full architecture, API spec, data model, build phases. Nothing implemented yet.

---

## next up — UI polish

### P0 — high-traffic, visibly stock

- [ ] **Dashboard** (`resources/scripts/components/dashboard/DashboardContainer.tsx` + `ServerRow.tsx`).
  - Server row → a glassy card with the same severity-bar treatment as StatBlock (status-green / warn-yellow / off-gray).
  - Server avatar: switch from boring-avatar to a gradient monogram of the server name initial.
  - Hover: `translateY(-2px)` + purple edge glow (reuse `gynx-panel-hoverable`).
  - Empty state: centered illustration + "Deploy your first server" CTA (use pink `gynx-btn-destructive` for the rare case).

- [ ] **File Manager** (`resources/scripts/components/server/files/`).
  - Breadcrumb row: pill-style, gradient-underline on the active segment.
  - File row: blue row-hover (matches new sub-nav), left-side file-type icon badge, right-aligned quick actions revealed on hover.
  - Upload zone: flat panel default, cyan border when dragging.

- [ ] **Auth pages** (`resources/scripts/routers/AuthenticationRouter.tsx` + `components/auth/`).
  - Centered panel on the now-minimal background (no more gradient blobs).
  - Logo above the form, tagline below.
  - Input group: purple focus ring + glow on focus *only*.

### P1 — frequently used

- [ ] **Databases** — card treatment + copy-host/port/user/pass.
- [ ] **Schedules** — per-schedule card with next-fire pill.
- [ ] **Backups** — progress bar during backup creation (cyan fill); destructive delete in pink.
- [ ] **Account Overview**.
- [ ] **Dashboard activity log** — timeline treatment.

### P2 — settings surfaces

- [ ] Users / Subusers, Network / Allocations, Startup, Settings, API Keys, SSH Keys, Activity Log.

### cross-cutting polish

- [ ] **Alerts / flash messages** — metric-tinted left bar (info=blue, success=green, warn=yellow, error=red), flat background.
- [ ] **Dialog** — larger radius, no default glow. Confirm buttons: primary=purple, destructive=pink.
- [ ] **Inputs** — focus ring audit across all types (text, select, textarea, file).
- [ ] **Loading / Spinner** — replace with the `.gynx-shimmer` skeleton pattern where it fits; keep the spinner for indeterminate waits but recolor to purple.
- [ ] **ScreenBlock** (NotFound / ServerError) — flat bg, centered panel, gx monogram.
- [ ] **i18n** — pull hard-coded strings (`manage` / `monitor` / `config`, `server`, `you`, `workspace`) into locale files.
- [ ] **Terminal log coloring** — wire info/ok/warn/err CSS classes into `Console.tsx` by detecting log level from line content. Classes already exist in `tailwind.css`.
- [ ] **Fade-in for new terminal lines** — `.gynx-fade-in` class ready; needs hook-in at `Console.tsx`.

---

## next up — Egg Switcher (see [docs/EGG_SWITCHER.md](docs/EGG_SWITCHER.md))

Implementation phases. Each is a self-contained PR.

- [ ] **Phase 1 — migrations + models**. Three tables (`egg_switch_rules`, `server_egg_switch_overrides`, `egg_switch_logs`), Eloquent models, relationship tests. Backend-only, invisible.
- [ ] **Phase 2 — service layer + policies + permission key**. `EggSwitcherService`, `EggSwitchPolicy`, `control.egg-switch` permission.
- [ ] **Phase 3 — client API endpoints**. Four endpoints (§3.4 of the doc). Feature + unit tests.
- [ ] **Phase 4 — React feature**. Egg picker grid, confirm dialog, progress panel. Ships behind `GYNX_EGG_SWITCHER=1` feature flag.
- [ ] **Phase 5 — admin Blade UI**. Global rules page + per-server overrides tab.
- [ ] **Phase 6 — audit log surfacing**. Read endpoint + history drawer on the Game page.
- [ ] **Phase 7 — `install-full.sh`**. Full-stack deploy script (vs the assets-only `install-bundle.sh`).
- [ ] **Phase 8 — remove feature flag**. Ship to prod.

Rough budget: ~8–10 focused sessions for the whole Egg Switcher.

---

## operational / deploy

- [ ] **CI build** — GitHub Action that runs `yarn build:production` on push to main and uploads `public/assets/` as an artifact. Makes deploys on Node-less panel hosts trivial.
- [ ] **Upstream merge rehearsal** — first real sync against the next `pterodactyl/panel:v1.11.x` tag. Document the conflict areas for the runbook.
- [ ] **Staging panel** — a throwaway Pterodactyl on a scratch VM with a test server, so design iteration stops being blind.

---

## known bugs

- [ ] **Dashboard `ServerCard` remount loop** — original symptom: status pill stuck on "connecting" forever, network tab floods with thousands of `/resources` requests within seconds, panel rate-limiter trips (429s). **Workaround is working** — at `resources/scripts/components/dashboard/ServerCard.tsx` polling has been pulled out of React entirely into a module-level pump (single shared `setInterval`, per-uuid subscriber set, persistent `STATS_CACHE`). The pump fires regardless of how many times any ServerCard remounts, so the visible bug is gone.
  - **Root cause (still TBD)**: the dashboard subtree was remount-cycling fast enough that *every* React-lifecycle attempt to own the polling failed (useEffect refs reset, useState wiped, even setIntervals torn down before their first tick). Three previous attempts (`62092bb2`, `78e985d1`, `40b9aa02`) all failed because they kept the polling owned by the component lifecycle. The module-level pump (`5233cd93`) sidesteps the issue entirely.
  - **Why it's still worth fixing**: render churn keeps wasting CPU even though we no longer feel it on the network side. Probably also masking other state-sync bugs.
  - **Likely culprits to investigate next**: (1) `useSWR` revalidation in `DashboardContainer` swapping the `servers` array reference with each fire and somehow tripping a Suspense / error boundary above `<Pagination>`; (2) the `RouteFader` in `AppShell.tsx` keying on `location.pathname` while `DashboardContainer` calls `window.history.replaceState` on every page change; (3) an upstream React error being swallowed by an error boundary that silently rebuilds the subtree.
  - **Repro for the *root cause***: open the staging dashboard with React DevTools → Profiler → record. Should show the dashboard subtree remount-cycling at sub-second cadence. Then chase the highest-frequency commit upward.

- [ ] **Slow `/resources` proxy** — related to the above. Even when a single request makes it through, response time is consistently ~10–20 seconds. That's panel → Wings, not Wings itself (verified by hand-`curl` from the VPS). Probably PHP-FPM / cURL config, possibly DNS resolution latency for the node FQDN. Once the remount loop is fixed, this becomes the next bottleneck.

---

## major upcoming systems

Each is a multi-session project. Listed roughly in the order I'd ship them, easiest blast-radius first.

### 1. Subdomain Manager (Cloudflare API)
Replace `123.45.67.89:25565` with `myserver.play.gynx.gg` for users.

- **Backend**: CloudflareAdapter (HTTP client, scoped API token), `subdomain_records` table linking `server_id` ↔ `subdomain` ↔ CF zone+record id, service layer for create/update/delete.
- **Admin**: page to register parent zones (`play.gynx.gg`) + their CF API tokens (stored via the existing Integrations admin).
- **User**: server tab → "Domain" → pick from available subdomains, claim one. Show as the connection address on the server card instead of IP:port.
- **DNS**: A record for the server's IP, plus optional SRV record for Minecraft port-mapping so the user doesn't need a port.
- Rough budget: 2-3 sessions.

### 2. One-line installer
Single command that bootstraps either a fresh Pterodactyl + gynx-panel install OR a gynx-panel-only deploy on an existing Pterodactyl.

- Detection: check for existing Pterodactyl install (`/var/www/pterodactyl` or `/etc/pterodactyl/config.yml`).
- New install path: invokes Pterodactyl's stock installer first, then layers gynx-panel on top via the existing `scripts/reinstall-panel.sh`.
- Existing install path: jumps straight to the gynx layer.
- Handles deps (PHP, MariaDB, Composer, Node, Redis, nginx, certbot).
- Rough budget: 1-2 sessions.

### 3. License Key System
Internal license/entitlement system, similar to the existing Discord bot key flow. **Decision: Option B — built into each panel's admin.** Each panel issues, manages, and validates its own keys; no central dashboard.

- DB: `license_keys` (id, key, label, status, expires_at, limits json), `license_key_usages` (key_id, timestamp, ip, ua, scope).
- Admin: `Admin → Licenses` page with create / list / revoke / reset.
- Per-key fields: label, expiry, optional max-servers/max-users limit, feature flag set.
- Panel-side: middleware that validates a `License-Key` header on `/api/client/*` calls (or wherever we wire it).
- Logging: ring-buffer per key for last N validations (DB or Redis).

### 4. Admin Theme Redesign
Replaces the current AdminLTE-based admin UI with gynx-branded surfaces. **Decision: pragmatic path — keep AdminLTE structure, replace its CSS with our design tokens.**

⚠ This was previously a non-goal ("Admin panel redesign (AdminLTE stays)" — kept that wording in mind, scoping to CSS-token work only so the structural HTML stays compatible with future Pterodactyl admin updates).

- Override AdminLTE's color palette via `:root` overrides — body bg, sidebar, navbar, content cards.
- Bring in `Inter` / `Space Grotesk` over AdminLTE's default font stack.
- Use our existing `--gynx-edge`, `--gynx-surface`, etc. tokens via cascading specificity.
- Buttons (`.btn-primary` etc.) get the gradient + glow we use elsewhere.
- Tables get the dark surface treatment.
- Forms get the focus ring + 2px highlight.
- Keep all classes / IDs / data attributes intact so behavior is unchanged.

### 5. Optimization (cross-cutting, ongoing)
Not a single task — a quality bar applied to every other piece.

- Profile dashboard render churn (the remount loop from "known bugs").
- Audit `/resources` proxy slowness (panel ↔ Wings).
- Lazy-load addon installer search results / images (modpack icons).
- Cache `getServers()` SWR more aggressively + dedupe.
- Bundle splitting audit (current `bundle.4669cdfe.js` is 556 KiB).

---

## explicit non-goals

- Light-theme variant.
- Replacing Chart.js.
- "Performance mode" toggle (design spec §12) — deferred until the activity pulse feature in §12 is in scope; solo toggle with no feature to toggle adds UI for no benefit yet.
