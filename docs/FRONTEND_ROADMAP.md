# gynx-panel — frontend roadmap

Scope: replace every user-facing surface of Pterodactyl with a bespoke gynx UI,
add six add-on systems, and ship a custom graph engine. Admin panel stays stock.

Companion docs:
- [EGG_SWITCHER.md](EGG_SWITCHER.md) — existing design doc; folded in below as
  add-on #4.

---

## 1. Principles

1. **One design language, one primitive set.** Every new surface composes
   `components/gynx/*` primitives. No ad-hoc colors, shadows, borders.
2. **80 / 15 / 5 color discipline.** Void Black base, purple/blue accents,
   pink only on destructive or critical CTAs. Enforced via CSS variables,
   not by hand.
3. **Glow is a reward, not a default.** Glows/rings only on focus, active
   state, or a deliberate moment (pulse on stat change, success flash).
4. **Server-driven data stays server-driven.** All state comes through
   existing easy-peasy stores + Laravel API. New add-ons are thin React
   surfaces over new `/api/client/...` endpoints.
5. **Incremental replace, never fork.** Each page migrates by swapping its
   router entry behind an AppShell — old and new can coexist during build.

---

## 2. Directory layout

```
resources/scripts/
├── components/
│   ├── gynx/                         # shared primitives (already exists)
│   │   ├── AppShell.tsx              ✓
│   │   ├── Sidebar.tsx               ✓
│   │   ├── TopBar.tsx                ✓
│   │   ├── LogoMark.tsx              ✓
│   │   ├── Panel.tsx                 NEW — standard flat panel w/ hover glow
│   │   ├── Card.tsx                  NEW — dark-slate card, optional header
│   │   ├── Pill.tsx                  NEW — status pill (live/idle/warn/err)
│   │   ├── KeyValue.tsx              NEW — label + mono value row
│   │   ├── StatBlock.tsx             → move from server/console
│   │   ├── Toolbar.tsx               NEW — floating action bar
│   │   ├── DataTable.tsx             NEW — sortable table, virtual-scroll
│   │   ├── Modal.tsx                 NEW — replaces default Dialog
│   │   ├── Dropdown.tsx              NEW — replaces headlessui Menu
│   │   ├── Tabs.tsx                  NEW — extract from StatGraphs
│   │   ├── Toast.tsx                 NEW — replaces FlashMessageRender
│   │   ├── EmptyState.tsx            NEW — icon + title + body + action
│   │   └── chart/                    NEW — custom graph engine (§4)
│   │       ├── LineChart.tsx
│   │       ├── AreaChart.tsx
│   │       ├── Sparkline.tsx
│   │       ├── useSeries.ts
│   │       └── primitives.ts
│   │
│   ├── server/
│   │   ├── console/                  ✓ migrated (needs graph swap)
│   │   ├── files/                    TODO — §5.3
│   │   ├── databases/                TODO — §5.4
│   │   ├── network/                  TODO — §5.5
│   │   ├── backups/                  TODO — §5.6
│   │   ├── settings/                 TODO — §5.7
│   │   └── addons/                   NEW — §6
│   │       ├── plugins/
│   │       ├── mods/
│   │       ├── modpacks/
│   │       ├── egg-switcher/
│   │       ├── config-editor/
│   │       └── ai-support/
│   │
│   ├── dashboard/                    TODO — §5.1
│   └── auth/                         TODO — §7
│
└── state/
    └── server/
        ├── addons.ts                 NEW — shared add-on store (search, install queue, history)
        └── alerts.ts                 NEW — panel-wide alert store (§6.7)
```

---

## 3. Shared primitives (quick specs)

| Primitive   | Composition                                                              | Variants                                          |
|-------------|--------------------------------------------------------------------------|---------------------------------------------------|
| `Panel`     | `section` + `--gynx-surface` bg + `--gynx-edge` border, 12px radius      | `flat` (default), `elevated`, `accent` (left bar) |
| `Card`      | `Panel` + `header` slot + `body` slot + optional `footer`                | `compact`, `loose`                                |
| `Pill`      | Inline flex, 6px dot + label                                             | `live` (green pulse), `idle`, `warn`, `err`       |
| `KeyValue`  | Two-column row: label in dim, value in mono                              | `copyable` (hover shows copy icon)                |
| `DataTable` | Header row, virtualized body via `react-window`, sort + filter + select  | `dense`, `default`                                |
| `Modal`     | Portal + backdrop + focus-trap, 480/640/960 sizes                        | `sheet` (right-slide), `dialog` (centered)        |
| `Dropdown`  | Floating-UI-anchored menu with keyboard nav                              | `single`, `multi`, `grouped`                      |
| `Tabs`      | Tab group extracted from StatGraphs, accepts per-tab accent              | `pill` (current), `underline`                     |
| `Toast`     | Bottom-right stack, auto-dismiss, severity color                         | `success`, `info`, `warn`, `err`                  |
| `EmptyState`| Centered icon + 2-line copy + CTA button                                 | `page`, `section`, `table`                        |

Each primitive exports both a styled component and a CSS class map so non-React
surfaces (e.g. raw xterm containers) can still match.

---

## 4. Custom graph engine (`components/gynx/chart/`)

Goal: replace Chart.js. Pure SVG. Smooth cubic-bezier lines, metric-tinted
gradient fill, first-class sparkline, per-metric comparison overlay built in.

### 4.1 Architecture

```
chart/
├── primitives.ts     # path builders (catmull-rom → cubic bezier), scale helpers
├── useSeries.ts      # ring-buffer hook: push(value), returns last N samples
├── LineChart.tsx     # main panel chart (what StatGraphs uses)
├── AreaChart.tsx     # same but with gradient fill
├── Sparkline.tsx     # inline 80x24 mini-chart for dashboard tiles
└── CompareOverlay.tsx # two-series overlay (CPU+RAM together)
```

### 4.2 Primitives (math layer)

- **Catmull-Rom to Bézier** — converts raw sample points into a smooth
  C¹-continuous SVG path. Tension param defaults to 0.5.
- **Linear + log scales** — `scale(domain, range, value)`. Both axes.
- **Nice ticks** — produce 3–5 human-readable y-axis values given domain.
- **Reducer helpers** — `min`, `max`, `p95`, `delta` for tooltip/header.

### 4.3 `useSeries` hook

```ts
const series = useSeries({ capacity: 60, initial: 0 });
series.push(newValue);          // fires on every WS sample
series.data;                    // number[] length-capped to capacity
series.last;                    // latest value
series.delta;                   // last - previous (for pulse trigger)
```

Capacity defaults to 60 (1 minute @ 1s sample). Ring buffer; no re-renders
on pushes that don't affect visible range.

### 4.4 `LineChart` props

```ts
type LineChartProps = {
  data: number[];
  domain?: [number, number];    // y-axis bounds; auto if omitted
  color: string;                 // accent (metric-specific)
  label: string;
  unit?: string;                 // "%", "MiB", "KB/s"
  height?: number;               // defaults to container
  compare?: { data: number[]; color: string; label: string }; // optional overlay
  onHover?: (value: number, index: number) => void;
};
```

### 4.5 Rendering

- Gradient fill: `<linearGradient>` stop at 40% alpha top → 0% bottom.
- Curve: single `<path>` built via Catmull-Rom primitive.
- Grid: 4 horizontal lines at white 4% opacity, no vertical grid.
- Hover: single `<line>` cursor + `<circle>` at nearest point, tooltip
  rendered via portal for z-index escape.
- Gutter: `aria-live="polite"` node announces value change for a11y.

### 4.6 Migration

Replace [StatGraphs.tsx](../resources/scripts/components/server/console/StatGraphs.tsx)
body with:

```tsx
<LineChart data={cpu.data} color={metricAccents.cpu} label="CPU" unit="%" />
```

Delete: `chart.ts`, `chart.js`, `react-chartjs-2`, `chartjs-adapter-date-fns`
from `package.json`. Saves ~200 KB gzipped.

---

## 5. Page redesigns

| Page        | Status       | Router path          | AppShell? | Graph use                |
|-------------|--------------|----------------------|-----------|--------------------------|
| Console     | ✓ migrated   | `/server/:id`        | yes       | LineChart (3 tabs)       |
| Dashboard   | partial      | `/`                  | yes       | Sparkline per server     |
| Files       | TODO         | `/server/:id/files`  | yes       | —                        |
| Databases   | TODO         | `/server/:id/databases` | yes    | —                        |
| Network     | TODO         | `/server/:id/network` | yes      | Sparkline (bandwidth)    |
| Backups     | TODO         | `/server/:id/backups` | yes      | —                        |
| Settings    | TODO         | `/server/:id/settings` | yes     | —                        |
| Auth        | TODO         | `/auth/*`            | **no**    | —                        |

### 5.1 Dashboard

Replaces default server list. Responsive grid of `ServerCard` tiles.

```
ServerCard
├── Header: server name, status pill, game-icon chip
├── Metric strip: CPU sparkline | RAM sparkline | Net sparkline
├── Row 2: allocation (IP:port, copyable), uptime
└── Footer: quick actions (Open → /server/:id, Power menu)
```

Empty state: "No servers yet. Ask your admin for a deployment." Owner-side
add button only shows if user has create permission.

Filters: search input + game-type filter + status filter (via `Dropdown`).

### 5.2 Console

Already migrated. Follow-ups:
- Swap chart engine (§4)
- Wire log-level coloring (CSS classes exist in `tailwind.css`)
- Fade-in for new terminal lines (`.gynx-fade-in` exists)
- Comparison overlay button on the chart header → CPU+RAM together

### 5.3 Files

Two-column layout.

```
Files Page
├── Left rail (240px, collapsible): file tree
│   ├── Breadcrumb at top
│   ├── Directory nodes with expand caret, file nodes w/ language icon
│   └── Right-click context menu (rename, delete, download, permissions)
│
└── Right pane: content
    ├── Toolbar: path, [Upload] [New] [Download selected] [Mass edit]
    ├── DataTable: name | size | modified | actions
    └── Editor mode (when file opened): Monaco editor w/ gynx theme
```

Monaco theme: Void Black bg, purple keyword color, cyan string, lavender
number, soft-gray comment. Editor token rules live in `editor-theme.json`.

Drag-and-drop upload on the whole pane. Mass-select checkbox column.

### 5.4 Databases

```
Databases Page
├── Header: [+ New Database] button (primary purple)
├── Empty state: "No databases yet. Your first one is free."
└── List: Card per database
    ├── Name + host badge
    ├── KeyValue rows: host, username, password (reveal on hover)
    └── Actions: [Rotate password] [Copy connection string] [Delete]
```

Connection-string builder: one-click copy in `mysql://` or JDBC format via
`Dropdown`.

### 5.5 Network

```
Network Page
├── Primary allocation card (top): IP:port, copyable
├── Secondary allocations list: DataTable w/ star-to-promote
├── Bandwidth sparkline (last hour, inbound + outbound compare)
└── [Request additional allocation] button
```

### 5.6 Backups

```
Backups Page
├── Header: [+ Create Backup] + usage meter (used / quota)
├── List: Card per backup
│   ├── Name, size, created-ago, lock state
│   ├── Progress bar if still creating
│   └── Actions: [Download] [Restore] [Lock] [Delete]
└── Empty state: "No backups yet. Automate it in Schedules."
```

Restore confirmation: modal with diff warning ("this will overwrite current
files"). Lock toggle per backup to prevent accidental rotation.

### 5.7 Settings

Tabbed page using the `Tabs` primitive.

```
Tabs: General | Startup | SFTP | Danger Zone
├── General: rename server, set description
├── Startup: docker image dropdown, JVM args, env var editor (KeyValue rows)
├── SFTP: host + port + username (mono KeyValue), password reset
└── Danger Zone: reinstall, wipe, transfer — pink-bordered Card
```

---

## 6. Add-on systems

Common pattern:
- Surface lives under `server/addons/<name>/`
- New route: `/server/:id/addons/<name>` added to sidebar under a
  collapsible "Add-ons" group
- New Laravel controller under `app/Http/Controllers/Api/Client/Addons/`
- Data cached via easy-peasy store `state/server/addons.ts`

### 6.1 Plugin Installer

**Scope:** Bukkit/Spigot/Paper/Purpur servers only (gated by egg detection).

**Sources:** Modrinth (primary, has API), Hangar (paper official),
SpigotMC (scrape / unofficial API), CurseForge (Bukkit plugin category).

**UI**
```
Plugins Page
├── Search bar + source filter (chips) + game-version filter
├── Results grid: PluginCard
│   ├── Icon, name, author, download count, latest version
│   ├── Source badge (modrinth / hangar / spigot / curseforge)
│   └── [Install] button (purple) or [Installed ✓]
├── Installed tab: list of currently installed plugins with [Update] / [Remove]
└── Activity log (collapsible): last 20 install/remove actions
```

**Data model (backend)**
```
addon_plugins
  id, server_id, source ('modrinth'|'hangar'|'spigot'|'curseforge'),
  external_id, slug, name, version, file_name, file_hash,
  installed_at, installed_by
```

**Install flow**
1. `POST /api/client/servers/:uuid/addons/plugins/install` with `{source, id, version}`
2. Laravel resolves download URL via source adapter
3. Wings downloads to `/plugins/<file>.jar`
4. Row written to `addon_plugins`
5. Prompt user to restart server (toast with "Restart now" action)

**Source adapters** in `app/Services/Addons/Sources/`:
`ModrinthAdapter`, `HangarAdapter`, `SpigotAdapter` (rate-limit aware,
stores cursor), `CurseForgeAdapter` (requires API key env var).

### 6.2 Mod Installer

Same shell as plugins but gated to Forge/Fabric/Quilt eggs. Sources:
Modrinth + CurseForge. Key addition: **version compatibility column** —
adapter returns loader + MC version metadata, UI filters results that
don't match the server's detected loader/version.

Reuses `PluginCard` → rename to `AddonCard` generic.

### 6.3 Modpack Installer

Bigger beast — a modpack install nukes current mods/config.

**UI**
```
Modpacks Page
├── Search + source filter
├── Results grid: ModpackCard (icon, name, MC version, mod count, author)
├── Install flow = full-screen wizard:
│     Step 1: preview (what gets installed, estimated size)
│     Step 2: destructive-action confirm (backup prompt)
│     Step 3: progress (download + extract, live log)
│     Step 4: success (restart CTA)
```

**Backend**
- `POST /api/client/servers/:uuid/addons/modpacks/install`
- Runs as a queued job (`InstallModpackJob`) since it can take minutes.
- Auto-triggers backup creation first (unless user opts out).
- Writes to `addon_modpack_installs` table with status lifecycle.

### 6.4 Egg Switcher

Already designed in full at [EGG_SWITCHER.md](EGG_SWITCHER.md). Frontend
surfaces:

```
Game Selector Page
├── Current game card (top): icon, name, version, [Current]
├── Grid of GameCard tiles, grouped by category (Minecraft, Rust, Valheim, etc.)
│   ├── Icon, name, short description, typical resource usage chip
│   └── Hover: lift + [Switch to this game] CTA appears
└── Switch flow modal:
    ├── Warning block: "This will wipe your current files. Last backup was X ago."
    ├── Backup-first toggle (on by default)
    └── [Cancel] / [Switch & wipe] (pink)
```

Data + API already specced in the companion doc.

### 6.5 Config Editor

**UI**
```
Config Editor Page
├── Left: file tree limited to known config paths
│   (server.properties, bukkit.yml, spigot.yml, paper-global.yml, etc.)
├── Right: editor
│   ├── Toolbar: [Save] [Reset] [Restart to apply] | format selector (auto)
│   ├── Monaco w/ gynx theme + schema validation
│   └── Bottom strip: validation errors live-panel
```

**Validation** — ship bundled JSON schemas per known config type. Custom
`server.properties` validator (flat `key=value` parser). YAML linted via
`yaml` package. JSON linted natively.

Diff view on save: modal showing what changed vs. last saved version.

### 6.6 AI Support

**UI surface**

Two entry points:

1. **Passive banner** — when the console detects a known error pattern
   (e.g. "Could not reserve enough space", crash exit codes), a dismissible
   banner shows at the top of the Console page: "AI noticed your server
   didn't start. Ask for help?" → opens panel.

2. **Ask button** — `/server/:id/addons/ai` — full chat surface.

```
AI Panel
├── Context chips (auto-attached): "last 200 log lines", "startup config", "java version"
│   user can toggle chips to include/exclude
├── Message thread (user + assistant bubbles, code blocks get gynx mono style)
├── Input: textarea + [Ask] button, Cmd+Enter to submit
└── Footer: model indicator, "your config was shared with [Gemini/OpenAI]"
```

**Backend**

- `POST /api/client/servers/:uuid/addons/ai/chat` with `{messages, context_chips}`
- Laravel resolves context chips (pulls log lines / config) server-side
- Forwards to configured provider (env: `AI_PROVIDER=gemini|openai`,
  `AI_API_KEY=...`)
- Streams response via SSE back to the client

**Privacy gate** — admin must enable AI support per-node in admin panel
(outside our scope; exposed only as a feature flag read by frontend).

### 6.7 Alert System

Panel-wide or per-node announcements set by admin, visible to users.

**UI**
```
Top of every page (when alerts active)
└── AlertBar (dismissible per-user, severity-colored)
     ├── Severity icon (info / warn / maint / critical)
     ├── Title, body, optional [Learn more] link
     └── Dismiss (X)
```

Only the top alert shows; rest accessible via bell icon in TopBar w/ badge
counter.

**Data model**
```
panel_alerts
  id, scope ('panel'|'node'), node_id (nullable),
  severity, title, body, link_url,
  starts_at, ends_at, dismissible, created_by, created_at
```

**API**
- `GET /api/client/alerts/active` (filtered to user's visible scope)
- `POST /api/client/alerts/:id/dismiss` (per-user dismissal record)

Admin side (outside scope for now, but wire API): `GET/POST/PUT/DELETE
/api/application/alerts`.

Store: `state/server/alerts.ts` polls `/active` every 60s, dedupes by id,
persists dismissals in localStorage.

---

## 7. Auth UI

Replaces the stock Pterodactyl login/register/2FA flow. No AppShell — auth
is its own layout.

```
AuthLayout (full-viewport, 2-column)
├── Left (40%): brand panel
│   ├── Iso voxel background at 8% opacity
│   ├── Logo lockup (from skills/gynx-brand/Design_6.png)
│   └── Rotating tagline (fade, 8s cycle)
└── Right (60%): auth form card
    ├── Form title
    ├── Inputs (gynx-input primitive — flat, purple ring on focus)
    ├── Primary button (purple gradient)
    ├── Secondary link (forgot / register toggle)
    └── Footer: version, support link
```

Pages:
- `/auth/login` — email + password + [Sign in]
- `/auth/register` — full name + email + password + [Create account]
- `/auth/forgot` — email + [Send reset link]
- `/auth/reset/:token` — new password + confirm + [Reset]
- `/auth/2fa` — 6-digit code input (auto-advance cells)
- `/auth/checkpoint` — "we've sent a code..." interstitial

All forms: loading state is a subtle purple shimmer on the submit button,
not a spinner.

---

## 8. Phased build order

Ordered for minimum in-flight work and earliest user-visible wins.

| Phase | Scope                                               | Est. LOC  |
|-------|-----------------------------------------------------|-----------|
| 1     | Shared primitives (§3) + custom chart engine (§4)   | ~1500     |
| 2     | Dashboard redesign (§5.1) — uses chart + card       | ~700      |
| 3     | Console chart swap + log coloring + fade-in         | ~200      |
| 4     | Files page (§5.3) — Monaco + DataTable              | ~1200     |
| 5     | Databases, Network, Backups, Settings (§5.4–5.7)    | ~1800     |
| 6     | Auth UI (§7)                                        | ~800      |
| 7     | Alert system (§6.7) — low LOC, wired everywhere     | ~500      |
| 8     | Egg Switcher (§6.4) — backend + frontend            | ~2500     |
| 9     | Plugin Installer (§6.1) — establishes addon pattern | ~2000     |
| 10    | Mod + Modpack Installers (§6.2–6.3) — reuse pattern | ~1500     |
| 11    | Config Editor (§6.5)                                | ~1000     |
| 12    | AI Support (§6.6) — gated behind admin feature flag | ~1200     |

Total ballpark: **~15K LOC frontend + ~4K LOC backend** over the full arc.

Phases 1–3 are the "tomorrow" work. Everything else is its own focused
session.

---

## 9. Non-goals

- No admin redesign. Stock Pterodactyl admin stays untouched.
- No i18n beyond what Pterodactyl ships with (defer).
- No mobile app. Mobile web responsive only.
- No migration tooling for users on the stock theme — they just see new UI
  on next deploy.

---

## 10. Open questions

1. AI provider choice at scale — flat fee (Gemini) vs. per-token (OpenAI)?
   Affects abuse mitigation design.
2. Modpack install: do we ever skip the auto-backup? Default = always on,
   but heavy modpacks can double the disk usage temporarily.
3. Config editor — YAML merge on save vs. full overwrite? Overwrite is
   safer; merge is friendlier. Picking overwrite until someone complains.
4. Alert system — do we mirror Pterodactyl's existing `user_login_ip_logs`
   dismissal pattern, or roll our own? Leaning "roll our own, keep it
   scoped to alerts".
