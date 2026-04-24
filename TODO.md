# gynx-panel — remaining work

Session 1 delivered: design system, app shell (Sidebar + TopBar + AppShell), redesigned Server Console, restyled buttons / tabs / footer, bundle installer. Everything below runs on the new shell and tokens, so each entry is a *rewrite* of a stock page against the new design, not a full-scratch build.

Priority order reflects customer surface area (how often customers touch the page) × design impact (how much the stock version visibly clashes with the new shell).

## P0 — high-traffic, visibly stock

- [ ] **Dashboard** (`resources/scripts/components/dashboard/DashboardContainer.tsx` + `ServerRow.tsx`).
  - Server row → a glassy card with bottom-accent severity bar (mirror StatBlock treatment).
  - Server avatar: switch from boring-avatar to a gradient monogram of the server name initial.
  - Hover: translateY(-2px) + purple glow on the border.
  - Empty state: centered illustration + "Deploy your first server" CTA (use pink `.gynx-cta`).

- [ ] **File Manager** (`resources/scripts/components/server/files/`).
  - Breadcrumb row: pill-style, gradient-underline on the active segment.
  - File row: subtle purple row-hover, left-side file-type icon badge, right-aligned quick actions revealed on hover.
  - Upload zone: glassy drop-target, neon border when dragging.

- [ ] **Auth pages** (`resources/scripts/routers/AuthenticationRouter.tsx` + under `components/auth/`).
  - Centered glass card on the full-bleed gradient background.
  - Logo above the form, tagline below.
  - Input group with purple focus ring + glow.

## P1 — frequently used

- [ ] **Databases** (`components/server/databases/`).
- [ ] **Schedules** (`components/server/schedules/`) — stat-tile treatment for each schedule card.
- [ ] **Backups** (`components/server/backups/`) — progress bar with gradient fill during backup creation.
- [ ] **Account Overview** (`components/dashboard/AccountOverviewContainer.tsx`).

## P2 — settings surfaces

- [ ] **Users / Subusers** (`components/server/users/`).
- [ ] **Network / Allocations** (`components/server/network/`).
- [ ] **Startup** (`components/server/startup/`).
- [ ] **Settings** (`components/server/settings/`).
- [ ] **API Keys** (`components/dashboard/AccountApiContainer.tsx`).
- [ ] **SSH Keys** (`components/dashboard/AccountSSHContainer.tsx`).
- [ ] **Activity Log** (`components/dashboard/activity/`, `components/server/activity/`).

## cross-cutting polish

- [ ] **Alerts / flash messages** (`components/elements/alert/`) — gradient-border variants, glassy background, no more stock rounded-sm look.
- [ ] **Dialog** (`components/elements/dialog/`) — larger radius, `gynx-modal` shadow preset, gradient header bar.
- [ ] **Inputs** (`components/elements/inputs/`) — confirm `:focus` ring matches the brand purple across all types; currently only styled via Tailwind's `@tailwindcss/forms` plugin defaults.
- [ ] **Loading / Spinner** (`components/elements/Spinner.tsx`) — replace the color with purple, add a neon pulse halo.
- [ ] **ScreenBlock** (NotFound / ServerError) — full-bleed ambient background, centered glass card, gx monogram.
- [ ] **i18n** — strings in the new shell (TopBar eyebrows "workspace", "server", "you") are hard-coded English. Move to `i18n.ts` / locale files.

## operational / deploy

- [ ] **CI build** — GitHub Action that runs `yarn build:production` on push to main and uploads the `public/assets/` as an artifact. Makes deploy on a Node-less panel host trivial (download the artifact, run `install-bundle.sh`).
- [ ] **Upstream merge rehearsal** — first real upstream sync against `pterodactyl/panel:v1.11.12` (or whatever the next tag is). Document the conflict areas for the runbook.
- [ ] **Staging panel** — without one, design iteration is blind. Spin up a throwaway Pterodactyl on a scratch VM with a single test server to validate each PR.

## nice-to-haves (explicit non-goals for now)

- Light-theme variant. The brand is dark-first; a light mode is a future project, not a session target.
- Admin panel redesign. Out of scope — admin is internal, AdminLTE stays.
- Replacing Chart.js. It works, it's themed via our palette; no need.
