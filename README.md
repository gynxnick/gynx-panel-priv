# gynx-panel

A private fork of [Pterodactyl Panel][upstream] with the client-facing React SPA rewritten in the gynx.gg identity. The backend PHP, admin panel, and auth Blade templates are intentionally left untouched — this fork only reworks what customers see.

Upstream's original README is preserved at [README.pterodactyl.md](README.pterodactyl.md). Full attribution is maintained under Pterodactyl's MIT license ([LICENSE.md](LICENSE.md)).

---

## what's in session 1

This repo is the **scaffold**. One page is fully redesigned; everything else still works but uses the redesigned shell and design tokens, which is enough to make the whole panel look gynx-native. Follow-up sessions fill in the remaining pages — see [TODO.md](TODO.md).

- **Design system** in [tailwind.config.js](tailwind.config.js) — cyber purple, neon blue, void-black base, pulse pink reserved for CTAs; Space Grotesk + Inter; 8/12/16 radius scale; shadow and gradient presets. Legacy token names (`blue`, `cyan`, `gray`) are remapped so upstream class usage adopts the new identity without touching thousands of call sites.
- **Global CSS layer** in [resources/scripts/assets/tailwind.css](resources/scripts/assets/tailwind.css) — font imports, ambient gradient + grid background, glass panel / button / pill / eyebrow component classes.
- **New shell** at [resources/scripts/components/gynx/](resources/scripts/components/gynx/):
  - [Sidebar.tsx](resources/scripts/components/gynx/Sidebar.tsx) — 72 px icon rail with `gx` monogram, dashboard / admin / account / sign-out.
  - [TopBar.tsx](resources/scripts/components/gynx/TopBar.tsx) — two variants (Dashboard + Server). Server variant pulls name/description/status/allocation from `ServerContext` and renders a live status pill.
  - [AppShell.tsx](resources/scripts/components/gynx/AppShell.tsx) — two-column composer: sidebar + main (header slot + tabs slot + content).
  - [LogoMark.tsx](resources/scripts/components/gynx/LogoMark.tsx) — inline SVG `gx` monogram with gradient fill + glow filter.
- **Routers** [DashboardRouter.tsx](resources/scripts/routers/DashboardRouter.tsx) and [ServerRouter.tsx](resources/scripts/routers/ServerRouter.tsx) now mount `AppShell` instead of the stock `NavigationBar` + `SubNavigation` pair.
- **Server Console** fully redesigned:
  - [ServerConsoleContainer.tsx](resources/scripts/components/server/console/ServerConsoleContainer.tsx) — new grid: terminal takes the left 3/4, power actions + stacked stat tiles take the right 1/4, live charts along the bottom.
  - [StatBlock.tsx](resources/scripts/components/server/console/StatBlock.tsx) — glassy tile with gradient-lined icon badge, auto-fit value, severity-coded bottom accent (purple/neon → amber → red).
  - [ChartBlock.tsx](resources/scripts/components/server/console/ChartBlock.tsx) — glassy panel with gradient underline and scan-line top edge.
  - [style.module.css](resources/scripts/components/server/console/style.module.css) — rebuilt terminal chrome: deep-void background, purple border, gradient scrollbar, purple caret in the command input.
- **Shared button system** at [resources/scripts/components/elements/button/style.module.css](resources/scripts/components/elements/button/style.module.css) — primary becomes a purple gradient with glow; text variant goes to slate-with-purple-hover; danger becomes a red gradient. Every `<Button>` / `<Button.Text>` / `<Button.Danger>` call site in the panel (including `PowerButtons`, dialog confirms, form submits) picks up the new look automatically.
- **Footer** rebrands `Pterodactyl© …` to `gynx.gg — host smarter. play harder.` in [PageContentBlock.tsx](resources/scripts/components/elements/PageContentBlock.tsx).
- **SubNavigation** tab strip restyled in [SubNavigation.tsx](resources/scripts/components/elements/SubNavigation.tsx) — gradient underline on active tabs instead of the stock cyan bar.

Everything not listed above is still stock Pterodactyl behavior, just riding on the new design tokens (so, e.g., the File Manager already has purple accents on hover without a rewrite). The actual component rewrites for those pages are the follow-up work.

---

## development

### first-time setup (on a build host with Node + yarn)

```bash
git clone git@github.com:gynxnick/gynx-panel.git
cd gynx-panel
yarn install
```

### live dev against a panel install

Pterodactyl's webpack dev server expects a running panel backend. Easiest path: point the dev build at your production or staging panel via HOT reload. See upstream [BUILDING.md](README.pterodactyl.md) for the full flow; TL;DR:

```bash
yarn watch           # rebuild on change
# and in another shell, the PHP panel is already serving at e.g. https://panel.gynx.gg
```

### production build

```bash
yarn install
yarn build:production
```

Output lands in `public/assets/` (the webpack manifest plus hashed bundle files). That directory is what the installer ships to the live panel.

---

## deploying to a live panel

### one-shot, all files: install-bundle.sh

The build host (the one that ran `yarn build:production`) should have this repo checked out with its `public/assets/` freshly populated. From there:

```bash
# on the panel host — copy or clone the built repo to /opt/gynx-panel, then:
sudo /opt/gynx-panel/install-bundle.sh
# or custom panel path:
sudo /opt/gynx-panel/install-bundle.sh -p /srv/pterodactyl
```

What it does, in order:

1. Verifies `public/assets/manifest.json` and at least one `bundle.*.js` exist (catches stale / empty builds).
2. Backs up the live panel's entire `public/assets/` to `backups/<utc-timestamp>/assets/` (and updates the `backups/latest` symlink).
3. Replaces the panel's `public/assets/` with the built one. The stale directory is removed first so leftover chunk files from the old build don't linger.
4. Chowns to match the panel directory's owner (usually `www-data`).
5. Runs `php artisan view:clear` and `php artisan cache:clear`.

Hard-refresh the browser (`Ctrl+Shift+R`) to pick up the new bundle.

### rollback

```bash
# from the most recent install:
sudo /opt/gynx-panel/uninstall-bundle.sh --from-backup latest

# from a specific install:
sudo /opt/gynx-panel/uninstall-bundle.sh --from-backup 20260424T010203Z

# list available backups:
sudo /opt/gynx-panel/uninstall-bundle.sh -l
```

Before restoring, the uninstaller snapshots the **current** (gynx) assets to `backups/<ts>.pre-rollback/` — so if you roll back and then want to re-deploy the same gynx build, you can restore that snapshot without rebuilding.

---

## keeping in sync with upstream

```bash
# one-time: add upstream remote (done automatically if you used git fork workflow)
git remote add upstream https://github.com/pterodactyl/panel.git

# periodic: pull new tags / security patches
git fetch upstream
git merge upstream/v1.11.x       # or cherry-pick specific fixes
```

Merge conflicts will be concentrated in the files we've rewritten. The design system (`tailwind.config.js`, `tailwind.css`, everything under `resources/scripts/components/gynx/`) should never conflict — those are net-new. The conflict risk is the files we modified in place: `DashboardRouter.tsx`, `ServerRouter.tsx`, `SubNavigation.tsx`, `PageContentBlock.tsx`, `ServerConsoleContainer.tsx`, `StatBlock.tsx`, `ChartBlock.tsx`, `style.module.css`, `button/style.module.css`.

---

## licensing & attribution

Pterodactyl Panel is © Dane Everitt and contributors, MIT-licensed. This fork preserves that license in full ([LICENSE.md](LICENSE.md)) and credits upstream in [README.pterodactyl.md](README.pterodactyl.md). gynx-panel is a skin on top of that work, not a replacement project.

---

gynx.gg — host smarter. play harder.

[upstream]: https://github.com/pterodactyl/panel
