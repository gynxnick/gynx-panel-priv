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
`;

const GynxServerStyles = () => <style>{css}</style>;
export default GynxServerStyles;
