import * as React from 'react';

/**
 * gynx.gg server-panel HI-FI styles — translated 1:1 from the wireframe
 * handoff (~/Desktop/Gynx/wireframe/styles.css).
 *
 * Rendered as a plain <style> tag (the same pattern the wireframe itself
 * uses) instead of styled-components createGlobalStyle, because the latter
 * was silently failing to inject in this codebase. Plain <style> always
 * works regardless of toolchain quirks.
 *
 * Scoped under .gynx-server-priv so it doesn't leak into the legacy admin
 * / dashboard layouts. Mounted from <ServerShell/>.
 */
const css = `
.gynx-server-priv {
  --void: #0b0b0f;
  --void-2: #0e0e14;
  --slate: #1f2937;
  --slate-2: #161b24;
  --line: rgba(255,255,255,0.07);
  --line-2: rgba(255,255,255,0.12);
  --text: #e9e9ef;
  --text-soft: #9ca3af;
  --text-faint: #6b7280;
  --purple: #7c3aed;
  --purple-glow: rgba(124,58,237,0.55);
  --blue: #22d3ee;
  --blue-glow: rgba(34,211,238,0.5);
  --pink: #ec4899;
  --pink-glow: rgba(236,72,153,0.5);
  --green: #34d399;
  --warn: #f59e0b;
}
.gynx-server-priv {
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  background: var(--void);
  color: var(--text);
  -webkit-font-smoothing: antialiased;
  font-feature-settings: "ss01", "cv11";
}
.gynx-server-priv * { box-sizing: border-box; }
.gynx-server-priv .app {
  width: 100%; min-height: 100vh;
  background:
    radial-gradient(circle at 80% -10%, rgba(124,58,237,0.18) 0, transparent 50%),
    radial-gradient(circle at -10% 100%, rgba(34,211,238,0.1) 0, transparent 50%),
    var(--void);
  position: relative;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.gynx-server-priv .app::before {
  content: "";
  position: fixed; inset: 0;
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence baseFrequency='0.85' numOctaves='2' seed='3'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.7 0'/></filter><rect width='120' height='120' filter='url(%23n)' opacity='0.18'/></svg>");
  opacity: 0.35;
  pointer-events: none;
  mix-blend-mode: overlay;
  z-index: 1;
}
.gynx-server-priv .app::after {
  content: "";
  position: fixed; inset: 0;
  background-image:
    linear-gradient(to right, rgba(255,255,255,0.025) 1px, transparent 1px),
    linear-gradient(to bottom, rgba(255,255,255,0.025) 1px, transparent 1px);
  background-size: 32px 32px;
  pointer-events: none;
  z-index: 0;
  mask-image: radial-gradient(ellipse at center, black 30%, transparent 80%);
}
.gynx-server-priv .layer { position: relative; z-index: 2; }

.gynx-server-priv .font-head { font-family: 'Space Grotesk', sans-serif; letter-spacing: -0.02em; }
.gynx-server-priv .font-mono { font-family: 'JetBrains Mono', 'Space Mono', monospace; font-feature-settings: "ss02", "cv11"; }

.gynx-server-priv .topbar {
  height: 56px;
  display: flex; align-items: center;
  padding: 0 20px;
  gap: 16px;
  border-bottom: 1px solid var(--line);
  background: rgba(11,11,15,0.6);
  backdrop-filter: blur(20px);
  flex-shrink: 0;
  position: relative;
  z-index: 10;
}
.gynx-server-priv .logo {
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 20px;
  letter-spacing: -0.03em;
  display: flex; align-items: center; gap: 2px;
  color: var(--text);
}
.gynx-server-priv .logo-dot {
  width: 6px; height: 6px;
  background: var(--purple);
  border-radius: 50%;
  box-shadow: 0 0 10px var(--purple-glow);
  margin: 0 1px;
}
.gynx-server-priv .divider-v { width: 1px; height: 22px; background: var(--line-2); }
.gynx-server-priv .server-pill {
  display: flex; align-items: center; gap: 8px;
  padding: 5px 10px;
  border-radius: 7px;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--line);
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
  cursor: pointer;
}
.gynx-server-priv .search {
  width: 280px;
  max-width: 30vw;
  height: 32px;
  border-radius: 8px;
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--line);
  display: flex; align-items: center;
  padding: 0 10px;
  gap: 8px;
  color: var(--text-faint);
  font-size: 13px;
}
.gynx-server-priv .search .kbd {
  margin-left: auto;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--line);
  color: var(--text-faint);
}
.gynx-server-priv .icon-btn {
  width: 32px; height: 32px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 8px;
  border: 1px solid var(--line);
  background: rgba(255,255,255,0.03);
  color: var(--text-soft);
  cursor: pointer;
}
.gynx-server-priv .icon-btn:hover { background: rgba(255,255,255,0.06); color: var(--text); }
.gynx-server-priv .avatar {
  width: 30px; height: 30px;
  border-radius: 50%;
  background: linear-gradient(135deg, #7c3aed 0%, #22d3ee 100%);
  border: 1px solid var(--line-2);
  display: inline-flex; align-items: center; justify-content: center;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 600;
  font-size: 12px;
  color: white;
}

.gynx-server-priv .server-header {
  padding: 18px 24px 0;
  border-bottom: 1px solid var(--line);
}
.gynx-server-priv .server-title-row {
  display: flex; align-items: center; gap: 14px;
  flex-wrap: wrap; row-gap: 8px;
}
.gynx-server-priv .server-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.02em;
  white-space: nowrap;
  color: var(--text);
  margin: 0;
}
.gynx-server-priv .meta-text {
  font-family: 'JetBrains Mono', monospace;
  font-size: 12px;
  color: var(--text-faint);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0;
}
.gynx-server-priv .meta-text .sep { margin: 0 8px; opacity: 0.4; }

.gynx-server-priv .status-pill {
  display: inline-flex; align-items: center; gap: 7px;
  padding: 4px 10px 4px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
}
.gynx-server-priv .status-pill.running {
  background: rgba(52,211,153,0.12);
  color: #6ee7b7;
  border: 1px solid rgba(52,211,153,0.3);
}
.gynx-server-priv .status-pill.starting,
.gynx-server-priv .status-pill.stopping {
  background: rgba(245,158,11,0.12);
  color: #fde68a;
  border: 1px solid rgba(245,158,11,0.3);
}
.gynx-server-priv .status-pill.starting .pulse,
.gynx-server-priv .status-pill.stopping .pulse {
  background: #f59e0b;
  box-shadow: 0 0 8px #f59e0b;
}
.gynx-server-priv .status-pill.offline {
  background: rgba(255,255,255,0.05);
  color: var(--text-faint);
  border: 1px solid var(--line);
}
.gynx-server-priv .status-pill.offline .pulse {
  background: var(--text-faint);
  box-shadow: none;
  animation: none;
}
.gynx-server-priv .status-pill .pulse {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #34d399;
  box-shadow: 0 0 8px #34d399;
  animation: gynxPulse 2s ease-in-out infinite;
}
@keyframes gynxPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50%      { opacity: 0.6; transform: scale(1.15); }
}

.gynx-server-priv .btn {
  display: inline-flex; align-items: center; gap: 7px;
  height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  font-family: 'Inter', sans-serif;
  font-size: 13px;
  font-weight: 500;
  border: 1px solid var(--line);
  background: rgba(255,255,255,0.03);
  color: var(--text);
  cursor: pointer;
  transition: all 0.15s ease;
}
.gynx-server-priv .btn:hover { background: rgba(255,255,255,0.07); border-color: var(--line-2); }
.gynx-server-priv .btn-primary {
  background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
  border-color: rgba(124,58,237,0.6);
  color: white;
  box-shadow: 0 0 0 1px rgba(124,58,237,0.3), 0 4px 16px rgba(124,58,237,0.35);
}
.gynx-server-priv .btn-primary:hover {
  box-shadow: 0 0 0 1px rgba(124,58,237,0.5), 0 4px 20px rgba(124,58,237,0.55);
  filter: brightness(1.1);
}
.gynx-server-priv .btn-danger {
  background: rgba(236,72,153,0.08);
  border-color: rgba(236,72,153,0.35);
  color: #f9a8d4;
}
.gynx-server-priv .btn-danger:hover {
  background: rgba(236,72,153,0.15);
  border-color: rgba(236,72,153,0.55);
  box-shadow: 0 0 16px rgba(236,72,153,0.25);
}
.gynx-server-priv .btn-sm { height: 28px; padding: 0 10px; font-size: 12px; }

.gynx-server-priv .tabs {
  display: flex; gap: 4px;
  margin-top: 16px;
  position: relative;
  overflow-x: auto;
  scrollbar-width: none;
}
.gynx-server-priv .tabs::-webkit-scrollbar { display: none; }
.gynx-server-priv .tab {
  padding: 10px 14px;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-soft);
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color 0.15s ease;
  display: inline-flex; align-items: center; gap: 6px;
  position: relative;
  white-space: nowrap; flex-shrink: 0;
  text-decoration: none;
}
.gynx-server-priv .tab:hover { color: var(--text); }
.gynx-server-priv .tab.active {
  color: white;
  border-bottom-color: var(--purple);
}
.gynx-server-priv .tab.active::after {
  content: "";
  position: absolute;
  left: 0; right: 0; bottom: -2px;
  height: 2px;
  background: var(--purple);
  box-shadow: 0 0 12px var(--purple-glow);
}
.gynx-server-priv .tab .badge {
  padding: 1px 6px;
  background: rgba(255,255,255,0.08);
  border-radius: 10px;
  font-size: 10px;
  font-family: 'JetBrains Mono', monospace;
  color: var(--text-faint);
}
.gynx-server-priv .tab .badge.new {
  background: rgba(124,58,237,0.2);
  color: #c4b5fd;
  border: 1px solid rgba(124,58,237,0.4);
}

.gynx-server-priv .main {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 16px;
  padding: 16px 20px 20px;
  min-height: 0;
}
.gynx-server-priv .main.no-rail { grid-template-columns: 1fr; }
.gynx-server-priv .col { display: flex; flex-direction: column; gap: 12px; min-height: 0; min-width: 0; }

.gynx-server-priv .panel {
  background: linear-gradient(180deg, rgba(31,41,55,0.55) 0%, rgba(22,27,36,0.55) 100%);
  border: 1px solid var(--line);
  border-radius: 12px;
  backdrop-filter: blur(14px);
  position: relative;
  overflow: hidden;
}
.gynx-server-priv .panel::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 12px;
  padding: 1px;
  background: linear-gradient(180deg, rgba(255,255,255,0.07), transparent 40%);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
          mask-composite: exclude;
  pointer-events: none;
}

.gynx-server-priv .stat-row {
  display: grid;
  grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 10px;
}
.gynx-server-priv .stat {
  padding: 12px 14px;
  display: flex; align-items: center; gap: 10px;
  min-height: 64px;
  min-width: 0;
}
.gynx-server-priv .stat-info { flex: 1; min-width: 0; }
.gynx-server-priv .stat-label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-faint);
  font-weight: 500;
  display: flex; align-items: center; gap: 6px;
}
.gynx-server-priv .stat-value {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 19px;
  font-weight: 600;
  letter-spacing: -0.02em;
  margin-top: 2px;
  color: white;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.gynx-server-priv .stat-value .unit { font-size: 12px; color: var(--text-faint); margin-left: 3px; font-weight: 400; }
.gynx-server-priv .stat-spark { width: 52px; height: 30px; flex-shrink: 0; }

.gynx-server-priv .console-panel {
  flex: 1;
  display: flex; flex-direction: column;
  min-height: 0;
}
.gynx-server-priv .console-header {
  height: 44px;
  padding: 0 14px;
  border-bottom: 1px solid var(--line);
  display: flex; align-items: center; gap: 12px;
  flex-shrink: 0;
  background: rgba(0,0,0,0.2);
}
.gynx-server-priv .console-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 13px; font-weight: 600;
  display: flex; align-items: center; gap: 8px;
}
.gynx-server-priv .live-dot {
  width: 6px; height: 6px;
  background: #34d399;
  border-radius: 50%;
  box-shadow: 0 0 8px #34d399;
  animation: gynxPulse 1.8s ease-in-out infinite;
}
.gynx-server-priv .console-meta {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-faint);
}
.gynx-server-priv .console-actions { display: flex; gap: 4px; margin-left: auto; }
.gynx-server-priv .console-action {
  width: 28px; height: 28px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 6px;
  color: var(--text-faint);
  cursor: pointer;
}
.gynx-server-priv .console-action:hover { background: rgba(255,255,255,0.06); color: var(--text); }
.gynx-server-priv .console-action.toggle.on { color: var(--blue); }

.gynx-server-priv .console-body {
  flex: 1;
  overflow: auto;
  padding: 14px 16px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12.5px;
  line-height: 1.7;
  color: #d1d5db;
  background: rgba(0,0,0,0.25);
  min-height: 360px;
}
.gynx-server-priv .console-body::-webkit-scrollbar { width: 8px; }
.gynx-server-priv .console-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 4px; }
.gynx-server-priv .line { white-space: pre-wrap; word-break: break-word; padding: 1px 0; }
.gynx-server-priv .line .ts { color: var(--text-faint); }
.gynx-server-priv .line .lvl-info { color: #9ca3af; }
.gynx-server-priv .line .lvl-ok { color: var(--blue); }
.gynx-server-priv .line .lvl-warn { color: var(--warn); }
.gynx-server-priv .line .lvl-err { color: var(--pink); }
.gynx-server-priv .line .player { color: var(--purple); }
.gynx-server-priv .line .ev { color: #c4f5ff; }

.gynx-server-priv .console-input {
  height: 44px;
  display: flex; align-items: center;
  padding: 0 14px;
  gap: 10px;
  border-top: 1px solid var(--line);
  background: rgba(0,0,0,0.3);
  flex-shrink: 0;
}
.gynx-server-priv .prompt {
  color: var(--purple);
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px; font-weight: 700;
}
.gynx-server-priv .console-input-field {
  flex: 1;
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  color: var(--text);
  background: transparent;
  border: none;
  outline: none;
}
.gynx-server-priv .console-input-field::placeholder { color: var(--text-faint); }
.gynx-server-priv .console-input .hint {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-faint);
  display: flex; align-items: center; gap: 6px;
}
.gynx-server-priv .console-input .kbd {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10px;
  padding: 2px 5px;
  border-radius: 3px;
  background: rgba(255,255,255,0.06);
  border: 1px solid var(--line-2);
}
.gynx-server-priv .cursor {
  display: inline-block;
  width: 7px; height: 14px;
  background: var(--blue);
  vertical-align: text-bottom;
  margin-left: 2px;
  animation: gynxBlink 1s steps(2) infinite;
  box-shadow: 0 0 6px var(--blue-glow);
}
@keyframes gynxBlink { 50% { opacity: 0; } }

.gynx-server-priv .rail-card { padding: 14px; display: flex; flex-direction: column; gap: 10px; }
.gynx-server-priv .rail-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 13px; font-weight: 600;
  display: flex; align-items: center; justify-content: space-between;
  color: var(--text);
}
.gynx-server-priv .rail-title .more {
  font-size: 11px; color: var(--text-faint); font-weight: 400; cursor: pointer;
}
.gynx-server-priv .rail-title .more:hover { color: var(--purple); }

.gynx-server-priv .ai-card { padding: 0; position: relative; overflow: hidden; }
.gynx-server-priv .ai-card-bg {
  position: absolute; inset: 0;
  background: radial-gradient(circle at 20% 0%, rgba(124,58,237,0.25), transparent 60%),
              radial-gradient(circle at 100% 100%, rgba(34,211,238,0.15), transparent 60%);
  pointer-events: none;
}
.gynx-server-priv .ai-card-inner { padding: 14px; position: relative; z-index: 1; }
.gynx-server-priv .ai-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 9px 3px 7px;
  border-radius: 999px;
  background: rgba(124,58,237,0.18);
  border: 1px solid rgba(124,58,237,0.4);
  font-size: 11px;
  font-weight: 600;
  color: #c4b5fd;
  letter-spacing: 0.02em;
}
.gynx-server-priv .ai-msg {
  font-size: 13.5px;
  line-height: 1.5;
  color: #e5e7eb;
  margin-top: 10px;
}
.gynx-server-priv .ai-msg .hl { color: var(--blue); font-family: 'JetBrains Mono', monospace; font-size: 12.5px; }
.gynx-server-priv .ai-actions { display: flex; gap: 6px; margin-top: 12px; }

.gynx-server-priv .activity-list { display: flex; flex-direction: column; gap: 10px; }
.gynx-server-priv .activity-item { display: flex; align-items: center; gap: 10px; }
.gynx-server-priv .head-avatar {
  width: 24px; height: 24px;
  border-radius: 4px;
  background: linear-gradient(135deg, #475569, #1f2937);
  border: 1px solid var(--line-2);
  flex-shrink: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 9px;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-faint);
}
.gynx-server-priv .activity-text {
  flex: 1; min-width: 0;
  font-size: 12.5px;
  color: var(--text-soft);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.gynx-server-priv .activity-text .name { color: var(--text); font-family: 'JetBrains Mono', monospace; font-size: 12px; margin-right: 4px; }
.gynx-server-priv .activity-text.evt-join .verb { color: var(--green); }
.gynx-server-priv .activity-text.evt-leave .verb { color: var(--text-faint); }
.gynx-server-priv .activity-text.evt-die .verb { color: var(--pink); }
.gynx-server-priv .activity-text.evt-cmd .verb { color: var(--purple); }
.gynx-server-priv .activity-time {
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  color: var(--text-faint);
}

.gynx-server-priv .player-list {
  display: flex; flex-direction: column;
  gap: 4px;
  margin: 4px -6px 0;
}
.gynx-server-priv .player-row {
  display: flex; align-items: center; gap: 10px;
  padding: 6px 8px;
  border-radius: 8px;
  transition: background .15s ease;
}
.gynx-server-priv .player-row:hover { background: rgba(255,255,255,0.03); }
.gynx-server-priv .player-avatar {
  width: 26px; height: 26px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(124,58,237,0.18), rgba(34,211,238,0.12));
  border: 1px solid var(--line-2);
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 600;
  font-size: 10px;
  color: #c4b5fd;
  text-transform: uppercase;
}
.gynx-server-priv .player-name {
  flex: 1; min-width: 0;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12.5px;
  color: var(--text);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.gynx-server-priv .player-actions {
  display: flex; gap: 4px; align-items: center;
  flex-shrink: 0;
}
.gynx-server-priv .player-action {
  width: 26px; height: 26px;
  display: inline-flex; align-items: center; justify-content: center;
  border-radius: 6px;
  background: transparent;
  border: 1px solid var(--line);
  color: var(--text-soft);
  cursor: pointer;
  transition: all .15s ease;
  padding: 0;
}
.gynx-server-priv .player-action:hover:not(:disabled) {
  background: rgba(124,58,237,0.1);
  border-color: rgba(124,58,237,0.4);
  color: var(--text);
}
.gynx-server-priv .player-action.admin { color: #fcd34d; }
.gynx-server-priv .player-action.admin:hover:not(:disabled) {
  background: rgba(252,211,77,0.10);
  border-color: rgba(252,211,77,0.4);
  color: #fde68a;
}
.gynx-server-priv .player-action.danger { color: #f87171; }
.gynx-server-priv .player-action.danger:hover:not(:disabled) {
  background: rgba(248,113,113,0.10);
  border-color: rgba(248,113,113,0.4);
  color: #fca5a5;
}
.gynx-server-priv .player-action:disabled { opacity: .4; cursor: not-allowed; }

.gynx-server-priv .game-tag {
  display: inline-flex; align-items: center;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: lowercase;
  color: #c4b5fd;
  background: rgba(124,58,237,0.14);
  border: 1px solid rgba(124,58,237,0.35);
  font-family: 'Inter', sans-serif;
  margin-left: 6px;
}

.gynx-server-priv .empty-roster {
  padding: 22px 12px;
  text-align: center;
  font-size: 12px;
  color: var(--text-faint);
}

.gynx-server-priv .spin {
  animation: gynxSpin 0.9s linear infinite;
  display: inline-flex;
}
@keyframes gynxSpin { to { transform: rotate(360deg); } }

.gynx-server-priv .quick-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.gynx-server-priv .quick-btn {
  display: flex; align-items: center; gap: 7px;
  padding: 9px;
  border-radius: 7px;
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--line);
  font-size: 11.5px;
  color: var(--text);
  cursor: pointer;
  white-space: nowrap;
  min-width: 0; overflow: hidden;
  font-family: inherit;
}
.gynx-server-priv .quick-btn span { overflow: hidden; text-overflow: ellipsis; }
.gynx-server-priv .quick-btn:hover { background: rgba(124,58,237,0.1); border-color: rgba(124,58,237,0.4); }

.gynx-server-priv .row { display: flex; align-items: center; }
.gynx-server-priv .gap-4 { gap: 4px; }
.gynx-server-priv .gap-6 { gap: 6px; }
.gynx-server-priv .gap-8 { gap: 8px; }
.gynx-server-priv .spacer { flex: 1; }

/* ============== shared sub-page primitives ============== */
.gynx-server-priv .sub-main {
  flex: 1;
  display: flex; flex-direction: column;
  gap: 14px;
  padding: 16px 20px 20px;
  min-height: 0;
}
.gynx-server-priv .page-header {
  display: flex; align-items: center; gap: 14px;
  margin-bottom: 4px;
}
.gynx-server-priv .page-title {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.02em;
  color: var(--text);
}
.gynx-server-priv .page-sub {
  font-size: 13px;
  color: var(--text-faint);
}
.gynx-server-priv .seg {
  display: inline-flex;
  background: rgba(0,0,0,0.25);
  border: 1px solid var(--line);
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}
.gynx-server-priv .seg-btn {
  padding: 6px 12px;
  border-radius: 6px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--text-soft);
  cursor: pointer;
  display: inline-flex; align-items: center; gap: 6px;
  white-space: nowrap;
  background: transparent;
  border: 0;
  font-family: inherit;
}
.gynx-server-priv .seg-btn.active {
  background: rgba(124,58,237,0.18);
  color: white;
  box-shadow: inset 0 0 0 1px rgba(124,58,237,0.4);
}
.gynx-server-priv .seg-btn:hover:not(.active) { color: var(--text); }
.gynx-server-priv .seg-btn .count {
  font-size: 10px;
  padding: 1px 5px;
  border-radius: 8px;
  background: rgba(255,255,255,0.06);
  color: var(--text-faint);
  font-family: 'JetBrains Mono', monospace;
}
.gynx-server-priv .search-lg {
  height: 40px;
  border-radius: 10px;
  background: rgba(0,0,0,0.25);
  border: 1px solid var(--line);
  display: flex; align-items: center;
  padding: 0 14px;
  gap: 10px;
  color: var(--text-faint);
  font-size: 14px;
  flex: 1;
  min-width: 0;
}
.gynx-server-priv .search-lg input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-family: inherit;
  font-size: 14px;
  color: var(--text);
}
.gynx-server-priv .search-lg input::placeholder { color: var(--text-faint); }
.gynx-server-priv .chip {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 5px 10px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 500;
  background: rgba(255,255,255,0.04);
  border: 1px solid var(--line);
  color: var(--text-soft);
  cursor: pointer;
  white-space: nowrap;
}
.gynx-server-priv .chip.active {
  background: rgba(124,58,237,0.15);
  border-color: rgba(124,58,237,0.4);
  color: white;
}
.gynx-server-priv .chip:hover:not(.active) { background: rgba(255,255,255,0.07); color: var(--text); }
.gynx-server-priv .tag {
  font-size: 10px;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(255,255,255,0.05);
  border: 1px solid var(--line);
  color: var(--text-soft);
  white-space: nowrap;
  display: inline-block;
}
.gynx-server-priv .tag.featured {
  background: rgba(124,58,237,0.15);
  border-color: rgba(124,58,237,0.4);
  color: #c4b5fd;
}
.gynx-server-priv .tag.compat {
  background: rgba(52,211,153,0.12);
  border-color: rgba(52,211,153,0.3);
  color: #6ee7b7;
}
.gynx-server-priv .tag.warn {
  background: rgba(245,158,11,0.12);
  border-color: rgba(245,158,11,0.3);
  color: #fcd34d;
}
.gynx-server-priv .notice {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  font-size: 12.5px;
  background: rgba(34,211,238,0.08);
  border: 1px solid rgba(34,211,238,0.25);
  color: #a5f3fc;
}
.gynx-server-priv .notice.warn {
  background: rgba(245,158,11,0.08);
  border-color: rgba(245,158,11,0.25);
  color: #fde68a;
}
.gynx-server-priv .notice.purple {
  background: rgba(124,58,237,0.1);
  border-color: rgba(124,58,237,0.3);
  color: #ddd6fe;
}

/* generic table */
.gynx-server-priv .tbl { width: 100%; border-collapse: collapse; font-size: 12.5px; }
.gynx-server-priv .tbl th, .gynx-server-priv .tbl td {
  padding: 10px 14px;
  text-align: left;
  border-bottom: 1px solid var(--line);
}
.gynx-server-priv .tbl th {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-faint);
  font-weight: 600;
  background: rgba(0,0,0,0.15);
}
.gynx-server-priv .tbl tr:hover td { background: rgba(255,255,255,0.025); }
.gynx-server-priv .tbl tr.selected td { background: rgba(124,58,237,0.08); }
.gynx-server-priv .tbl td.mono { font-family: 'JetBrains Mono', monospace; font-size: 12px; color: var(--text-soft); }
.gynx-server-priv .tbl td.dim { color: var(--text-faint); }

/* file tree + crumbs */
.gynx-server-priv .files-layout { flex: 1; display: grid; grid-template-columns: 220px 1fr; gap: 16px; min-height: 0; }
.gynx-server-priv .file-tree { display: flex; flex-direction: column; gap: 1px; padding: 4px; overflow: auto; }
.gynx-server-priv .tree-node {
  padding: 5px 8px;
  border-radius: 6px;
  font-size: 12.5px;
  color: var(--text-soft);
  cursor: pointer;
  display: flex; align-items: center; gap: 7px;
  font-family: 'JetBrains Mono', monospace;
}
.gynx-server-priv .tree-node:hover { background: rgba(255,255,255,0.04); color: var(--text); }
.gynx-server-priv .tree-node.active { background: rgba(124,58,237,0.12); color: white; }
.gynx-server-priv .file-row { cursor: pointer; }
.gynx-server-priv .file-row .fname { font-family: 'JetBrains Mono', monospace; color: white; display: flex; gap: 8px; align-items: center; }
.gynx-server-priv .file-row .fname svg { color: var(--text-faint); }
.gynx-server-priv .file-row.dir .fname svg { color: #fbbf24; }
.gynx-server-priv .crumbs {
  display: flex; align-items: center; gap: 6px;
  font-family: 'JetBrains Mono', monospace; font-size: 12.5px;
  color: var(--text-faint);
  padding: 0 4px;
}
.gynx-server-priv .crumbs .seg-crumb { color: var(--text); cursor: pointer; padding: 2px 6px; border-radius: 4px; display: inline-flex; align-items: center; gap: 4px; }
.gynx-server-priv .crumbs .seg-crumb:hover { background: rgba(255,255,255,0.05); }
.gynx-server-priv .crumbs .sep { color: var(--text-faint); }

/* code editor preview */
.gynx-server-priv .code-pane {
  flex: 1;
  background: #07070a;
  border: 1px solid var(--line);
  border-radius: 10px;
  overflow: auto;
  font-family: 'JetBrains Mono', monospace;
  font-size: 12.5px;
  line-height: 1.7;
  padding: 14px 16px 14px 8px;
  display: flex;
}
.gynx-server-priv .ln-col { display: flex; flex-direction: column; padding-right: 14px; border-right: 1px solid var(--line); margin-right: 14px; color: var(--text-faint); text-align: right; user-select: none; }
.gynx-server-priv .ln-col span { display: block; }
.gynx-server-priv .code-col { flex: 1; }
.gynx-server-priv .tk-key { color: #c4b5fd; }
.gynx-server-priv .tk-str { color: #6ee7b7; }
.gynx-server-priv .tk-num { color: #fcd34d; }
.gynx-server-priv .tk-com { color: #6b7280; font-style: italic; }
.gynx-server-priv .tk-pun { color: var(--text-faint); }

/* schedule timeline */
.gynx-server-priv .timeline {
  flex: 1; min-height: 0;
  overflow: auto;
  display: flex; flex-direction: column;
  padding: 4px;
}
.gynx-server-priv .tl-grid {
  display: grid;
  grid-template-columns: 200px repeat(24, 1fr);
  align-items: center;
  column-gap: 0;
}
.gynx-server-priv .tl-hour {
  padding: 6px 0;
  border-left: 1px solid var(--line);
  font-size: 10.5px;
  color: var(--text-faint);
  font-family: 'JetBrains Mono', monospace;
  text-align: center;
}
.gynx-server-priv .tl-row {
  display: grid;
  grid-template-columns: 200px 1fr;
  border-top: 1px solid var(--line);
  min-height: 56px;
  align-items: center;
}
.gynx-server-priv .tl-name { padding: 0 14px; }
.gynx-server-priv .tl-name h5 { font-family: 'Space Grotesk', sans-serif; font-size: 13px; margin: 0 0 2px; color: white; font-weight: 600; }
.gynx-server-priv .tl-name span { font-size: 11px; color: var(--text-faint); font-family: 'JetBrains Mono', monospace; }
.gynx-server-priv .tl-track { position: relative; height: 100%; display: flex; align-items: center; }
.gynx-server-priv .tl-bg {
  position: absolute; inset: 12px 0;
  background: repeating-linear-gradient(
    to right,
    rgba(255,255,255,0.04) 0,
    rgba(255,255,255,0.04) 1px,
    transparent 1px,
    transparent calc(100% / 24)
  );
  border-radius: 6px;
}
.gynx-server-priv .tl-event {
  position: absolute;
  height: 28px;
  border-radius: 6px;
  display: flex; align-items: center;
  padding: 0 10px;
  font-size: 11px;
  font-family: 'JetBrains Mono', monospace;
  color: white;
  box-shadow: 0 2px 12px rgba(0,0,0,0.4);
  cursor: pointer;
}
.gynx-server-priv .tl-event.next { box-shadow: 0 0 0 2px rgba(124,58,237,0.5), 0 4px 16px rgba(124,58,237,0.4); }
.gynx-server-priv .tl-marker {
  position: absolute;
  top: 0; bottom: 0;
  width: 2px;
  background: linear-gradient(180deg, transparent, var(--blue), transparent);
  box-shadow: 0 0 8px var(--blue);
  z-index: 5;
}

/* backup row */
.gynx-server-priv .backup-row {
  border-radius: 10px;
  border: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(31,41,55,0.55), rgba(22,27,36,0.55));
  padding: 14px 16px;
  display: grid;
  grid-template-columns: 50px 1fr 110px 100px 110px auto;
  gap: 14px;
  align-items: center;
}
.gynx-server-priv .backup-row:hover { border-color: rgba(124,58,237,0.4); }
.gynx-server-priv .backup-icon {
  width: 40px; height: 40px;
  border-radius: 8px;
  background: linear-gradient(135deg, #4c1d95, #1e3a8a);
  display: flex; align-items: center; justify-content: center;
  color: white;
}
.gynx-server-priv .backup-icon.auto { background: linear-gradient(135deg, #0e7490, #1e3a8a); }
.gynx-server-priv .backup-name { font-family: 'Space Grotesk', sans-serif; font-size: 14px; color: white; font-weight: 600; }
.gynx-server-priv .backup-meta { font-size: 11.5px; color: var(--text-faint); font-family: 'JetBrains Mono', monospace; margin-top: 3px; }

/* user row */
.gynx-server-priv .user-row {
  border-radius: 10px;
  border: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(31,41,55,0.55), rgba(22,27,36,0.55));
  padding: 12px 16px;
  display: grid;
  grid-template-columns: 44px 1fr 130px 130px auto;
  gap: 14px;
  align-items: center;
}
.gynx-server-priv .user-row:hover { border-color: rgba(124,58,237,0.4); }
.gynx-server-priv .user-avatar {
  width: 36px; height: 36px;
  border-radius: 8px;
  background: linear-gradient(135deg, #7c3aed, #22d3ee);
  display: flex; align-items: center; justify-content: center;
  color: white;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
}
.gynx-server-priv .role-badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 3px 9px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 500;
  font-family: 'Space Grotesk', sans-serif;
}
.gynx-server-priv .role-owner { background: rgba(245,158,11,0.12); color: #fde68a; border: 1px solid rgba(245,158,11,0.3); }
.gynx-server-priv .role-admin { background: rgba(124,58,237,0.15); color: #c4b5fd; border: 1px solid rgba(124,58,237,0.4); }
.gynx-server-priv .role-mod   { background: rgba(34,211,238,0.12); color: #67e8f9; border: 1px solid rgba(34,211,238,0.3); }
.gynx-server-priv .role-viewer{ background: rgba(255,255,255,0.05); color: var(--text-soft); border: 1px solid var(--line); }

/* shared kv grid (databases / startup / settings) */
.gynx-server-priv .kv-grid {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 12px 24px;
  padding: 16px;
}
.gynx-server-priv .kv-grid label {
  font-size: 12.5px;
  color: var(--text-soft);
  padding-top: 7px;
}
.gynx-server-priv .kv-grid label .hint { display: block; font-size: 11px; color: var(--text-faint); margin-top: 2px; line-height: 1.4; }
.gynx-server-priv .kv-grid input,
.gynx-server-priv .kv-grid select,
.gynx-server-priv .kv-grid textarea {
  height: 34px;
  background: rgba(0,0,0,0.25);
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 0 10px;
  color: var(--text);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12.5px;
  outline: none;
  width: 100%;
}
.gynx-server-priv .kv-grid textarea { height: 80px; padding: 8px 10px; resize: none; }
.gynx-server-priv .kv-grid input:focus,
.gynx-server-priv .kv-grid select:focus,
.gynx-server-priv .kv-grid textarea:focus {
  border-color: rgba(124,58,237,0.5);
  box-shadow: 0 0 0 3px rgba(124,58,237,0.15);
}

/* section card (settings, network) */
.gynx-server-priv .section-card {
  border-radius: 12px;
  border: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(31,41,55,0.45), rgba(22,27,36,0.45));
  overflow: hidden;
}
.gynx-server-priv .section-head {
  padding: 14px 18px;
  border-bottom: 1px solid var(--line);
  display: flex; align-items: center; gap: 12px;
  background: rgba(0,0,0,0.15);
}
.gynx-server-priv .section-head h3 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 14px;
  font-weight: 600;
  margin: 0;
  color: white;
}
.gynx-server-priv .section-head .desc { font-size: 12px; color: var(--text-faint); }

/* toggle switch */
.gynx-server-priv .switch {
  width: 36px; height: 20px;
  border-radius: 10px;
  background: rgba(255,255,255,0.1);
  position: relative;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid var(--line);
  flex-shrink: 0;
}
.gynx-server-priv .switch.on { background: var(--purple); border-color: var(--purple); box-shadow: 0 0 8px rgba(124,58,237,0.5); }
.gynx-server-priv .switch::after {
  content: "";
  position: absolute;
  top: 2px; left: 2px;
  width: 14px; height: 14px;
  border-radius: 50%;
  background: white;
  transition: all 0.15s ease;
}
.gynx-server-priv .switch.on::after { left: 18px; }

/* db card */
.gynx-server-priv .db-card {
  border-radius: 12px;
  border: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(31,41,55,0.55), rgba(22,27,36,0.55));
  padding: 18px;
  display: flex; flex-direction: column; gap: 12px;
}
.gynx-server-priv .db-card .name {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 16px;
  font-weight: 600;
  color: white;
  display: flex; align-items: center; gap: 8px;
}
.gynx-server-priv .conn-string {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11.5px;
  color: var(--text-soft);
  background: rgba(0,0,0,0.3);
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 10px 12px;
  display: flex; align-items: center; gap: 10px;
  overflow: hidden;
}
.gynx-server-priv .conn-string .v { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* startup variable card */
.gynx-server-priv .var-card {
  border: 1px solid var(--line);
  background: rgba(0,0,0,0.2);
  border-radius: 8px;
  padding: 12px 14px;
}
.gynx-server-priv .var-card .vk {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  color: var(--text-faint);
  letter-spacing: 0.04em;
  margin-bottom: 5px;
}
.gynx-server-priv .var-card .vh {
  font-size: 11.5px;
  color: var(--text-soft);
  margin-top: 6px;
  line-height: 1.4;
}

/* striped progress (backups in-progress card) */
.gynx-server-priv .stripe-progress {
  height: 6px;
  border-radius: 3px;
  background: rgba(255,255,255,0.06);
  overflow: hidden;
  position: relative;
}
.gynx-server-priv .stripe-progress > div {
  height: 100%;
  background: linear-gradient(90deg, var(--purple), var(--blue));
  box-shadow: 0 0 8px rgba(124,58,237,0.5);
  position: relative;
}
.gynx-server-priv .stripe-progress > div::after {
  content: "";
  position: absolute; inset: 0;
  background: repeating-linear-gradient(
    45deg,
    rgba(255,255,255,0.15) 0,
    rgba(255,255,255,0.15) 6px,
    transparent 6px,
    transparent 12px
  );
  animation: stripeShift 1.5s linear infinite;
}
@keyframes stripeShift {
  to { background-position: 24px 0; }
}

/* sub-page stat strip */
.gynx-server-priv .strip {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}
.gynx-server-priv .strip .stat {
  padding: 14px 16px;
  border-radius: 10px;
  border: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(31,41,55,0.4), rgba(22,27,36,0.4));
  display: block;
  min-height: 0;
}
.gynx-server-priv .strip .stat .sl { font-size: 10.5px; text-transform: uppercase; letter-spacing: 0.07em; color: var(--text-faint); font-weight: 600; }
.gynx-server-priv .strip .stat .sv { font-family: 'Space Grotesk', sans-serif; font-size: 22px; font-weight: 600; color: white; margin-top: 4px; }
.gynx-server-priv .strip .stat .sd { font-size: 11px; color: var(--text-faint); margin-top: 4px; font-family: 'JetBrains Mono', monospace; }

/* installer */
.gynx-server-priv .install-layout {
  flex: 1;
  display: grid;
  grid-template-columns: 220px 1fr 340px;
  gap: 16px;
  min-height: 0;
}
.gynx-server-priv .install-layout.no-detail { grid-template-columns: 220px 1fr; }
.gynx-server-priv .install-side {
  display: flex; flex-direction: column;
  gap: 10px;
  overflow: auto;
}
.gynx-server-priv .side-section { display: flex; flex-direction: column; gap: 6px; }
.gynx-server-priv .side-label {
  font-size: 10.5px;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--text-faint);
  padding: 4px 10px;
  font-weight: 600;
}
.gynx-server-priv .side-item {
  padding: 7px 10px;
  border-radius: 7px;
  font-size: 13px;
  color: var(--text-soft);
  cursor: pointer;
  display: flex; align-items: center; gap: 9px;
}
.gynx-server-priv .side-item:hover { background: rgba(255,255,255,0.04); color: var(--text); }
.gynx-server-priv .side-item.active {
  background: rgba(124,58,237,0.12);
  color: white;
  box-shadow: inset 0 0 0 1px rgba(124,58,237,0.3);
}
.gynx-server-priv .side-item .ct {
  margin-left: auto;
  font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px;
  color: var(--text-faint);
}
.gynx-server-priv .item-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 12px;
  align-content: start;
  overflow: auto;
  padding-right: 4px;
}
.gynx-server-priv .item-card {
  border-radius: 12px;
  border: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(31,41,55,0.55), rgba(22,27,36,0.55));
  padding: 14px;
  display: flex; flex-direction: column;
  gap: 10px;
  cursor: pointer;
  transition: all 0.15s ease;
  position: relative;
}
.gynx-server-priv .item-card:hover {
  border-color: rgba(124,58,237,0.45);
  background: linear-gradient(180deg, rgba(40,30,60,0.6), rgba(22,27,36,0.6));
  box-shadow: 0 4px 20px rgba(124,58,237,0.15);
}
.gynx-server-priv .item-card.selected {
  border-color: var(--purple);
  background: linear-gradient(180deg, rgba(50,30,80,0.7), rgba(22,27,36,0.7));
  box-shadow: 0 0 0 1px rgba(124,58,237,0.5), 0 4px 24px rgba(124,58,237,0.3);
}
.gynx-server-priv .item-head { display: flex; gap: 12px; align-items: flex-start; }
.gynx-server-priv .item-icon {
  width: 48px; height: 48px;
  border-radius: 10px;
  background: linear-gradient(135deg, #4c1d95, #1e3a8a);
  border: 1px solid var(--line-2);
  flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 700;
  font-size: 18px;
  color: white;
  position: relative;
  overflow: hidden;
}
.gynx-server-priv .item-icon::after {
  content: "";
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.2), transparent 60%);
}
.gynx-server-priv .item-name {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 15px;
  font-weight: 600;
  color: white;
}
.gynx-server-priv .item-author {
  font-size: 12px;
  color: var(--text-faint);
  font-family: 'JetBrains Mono', monospace;
}
.gynx-server-priv .item-desc {
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--text-soft);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.gynx-server-priv .item-meta {
  display: flex; align-items: center; gap: 12px;
  font-size: 11px;
  color: var(--text-faint);
  font-family: 'JetBrains Mono', monospace;
}
.gynx-server-priv .item-meta .m { display: inline-flex; align-items: center; gap: 4px; }
.gynx-server-priv .item-tags { display: flex; gap: 4px; flex-wrap: wrap; }

.gynx-server-priv .detail-panel {
  display: flex; flex-direction: column;
  border-radius: 12px;
  border: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(31,41,55,0.55), rgba(22,27,36,0.55));
  overflow: hidden;
  min-height: 0;
}
.gynx-server-priv .detail-hero {
  padding: 16px 16px 14px;
  border-bottom: 1px solid var(--line);
  position: relative;
  background: radial-gradient(circle at 80% 0%, rgba(124,58,237,0.2), transparent 60%);
}
.gynx-server-priv .detail-body {
  padding: 14px 16px;
  overflow: auto;
  flex: 1;
}
.gynx-server-priv .detail-body h4 {
  font-family: 'Space Grotesk', sans-serif;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-faint);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  margin: 0 0 8px;
}
.gynx-server-priv .detail-body p {
  font-size: 12.5px;
  line-height: 1.55;
  color: var(--text-soft);
  margin: 0 0 14px;
}
.gynx-server-priv .detail-body ul {
  font-size: 12px;
  line-height: 1.7;
  color: var(--text-soft);
  margin: 0 0 14px;
  padding: 0;
  list-style: none;
}
.gynx-server-priv .detail-body li {
  display: flex; gap: 8px;
  padding: 4px 0;
  border-bottom: 1px solid var(--line);
}
.gynx-server-priv .detail-body li:last-child { border: none; }
.gynx-server-priv .detail-body li .k { color: var(--text-faint); flex: 1; }
.gynx-server-priv .detail-body li .v { color: var(--text); font-family: 'JetBrains Mono', monospace; font-size: 11.5px; }
.gynx-server-priv .detail-foot {
  padding: 12px 14px;
  border-top: 1px solid var(--line);
  background: rgba(0,0,0,0.25);
  display: flex; gap: 8px;
}

/* config drawer rows */
.gynx-server-priv .cfg-row {
  display: flex; flex-direction: column; gap: 4px;
  margin-bottom: 12px;
}
.gynx-server-priv .cfg-row label {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-faint);
  font-weight: 600;
}
.gynx-server-priv .cfg-row input,
.gynx-server-priv .cfg-row select {
  height: 34px;
  background: rgba(0,0,0,0.25);
  border: 1px solid var(--line);
  border-radius: 7px;
  padding: 0 10px;
  color: var(--text);
  font-family: 'JetBrains Mono', monospace;
  font-size: 12.5px;
  outline: none;
}
.gynx-server-priv .cfg-row input:focus,
.gynx-server-priv .cfg-row select:focus {
  border-color: rgba(124,58,237,0.5);
  box-shadow: 0 0 0 3px rgba(124,58,237,0.15);
}

/* subdomain manager */
.gynx-server-priv .sd-grid {
  display: grid;
  grid-template-columns: 1fr 320px;
  gap: 16px;
  flex: 1;
  min-height: 0;
}
.gynx-server-priv .sd-list {
  display: flex; flex-direction: column;
  gap: 8px;
  overflow: auto;
}
.gynx-server-priv .sd-row {
  border-radius: 10px;
  border: 1px solid var(--line);
  background: linear-gradient(180deg, rgba(31,41,55,0.55), rgba(22,27,36,0.55));
  padding: 14px 16px;
  display: grid;
  grid-template-columns: 1fr 130px 110px 90px;
  gap: 14px;
  align-items: center;
}
.gynx-server-priv .sd-row:hover { border-color: rgba(124,58,237,0.4); }
.gynx-server-priv .sd-row.primary {
  border-color: rgba(124,58,237,0.45);
  background: linear-gradient(180deg, rgba(40,30,60,0.55), rgba(22,27,36,0.55));
}
.gynx-server-priv .sd-domain {
  font-family: 'JetBrains Mono', monospace;
  font-size: 14px;
  color: white;
  display: flex; align-items: center; gap: 8px;
}
.gynx-server-priv .sd-domain .sub { color: var(--purple); }
.gynx-server-priv .sd-domain .root { color: var(--text-soft); }
.gynx-server-priv .sd-meta {
  font-size: 11px;
  color: var(--text-faint);
  font-family: 'JetBrains Mono', monospace;
  margin-top: 3px;
}
.gynx-server-priv .sd-status {
  display: inline-flex; align-items: center; gap: 6px;
  font-size: 11.5px;
  font-family: 'JetBrains Mono', monospace;
}
.gynx-server-priv .sd-status .dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: var(--green);
  box-shadow: 0 0 6px var(--green);
}
.gynx-server-priv .sd-status.pending .dot { background: var(--warn); box-shadow: 0 0 6px var(--warn); animation: gynxPulse 2s ease-in-out infinite; }

.gynx-server-priv .dom-picker { display: flex; flex-direction: column; gap: 6px; }
.gynx-server-priv .dom-item {
  padding: 8px 12px;
  border-radius: 8px;
  background: rgba(255,255,255,0.03);
  border: 1px solid var(--line);
  font-family: 'JetBrains Mono', monospace;
  font-size: 13px;
  display: flex; align-items: center; gap: 10px;
  cursor: pointer;
  color: var(--text-soft);
}
.gynx-server-priv .dom-item:hover { background: rgba(255,255,255,0.06); }
.gynx-server-priv .dom-item.active {
  background: rgba(124,58,237,0.15);
  border-color: rgba(124,58,237,0.4);
  color: white;
}
.gynx-server-priv .dom-item .ct {
  font-size: 10.5px;
  color: var(--text-faint);
  font-family: 'JetBrains Mono', monospace;
  margin-left: auto;
}

.gynx-server-priv .progress {
  height: 4px;
  border-radius: 2px;
  background: rgba(255,255,255,0.06);
  overflow: hidden;
}
.gynx-server-priv .progress > div {
  height: 100%;
  background: linear-gradient(90deg, var(--purple), var(--blue));
  box-shadow: 0 0 8px rgba(124,58,237,0.5);
}
`;

const GynxServerStyles = () => <style>{css}</style>;
export default GynxServerStyles;
