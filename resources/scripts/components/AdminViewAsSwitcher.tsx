import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
    faUserShield,
    faSearch,
    faTimes,
    faServer,
    faChevronLeft,
    faSpinner,
    faUndo,
} from '@fortawesome/free-solid-svg-icons';
import { AdminUser, AdminUserServer, searchAdminUsers, getAdminUserServers } from '@/api/adminAccess';
import { httpErrorToHuman } from '@/api/http';

// In-panel "view as user" switcher for staff. Lives in the main nav and
// opens a command-palette: search any user (name / email / id), see their
// servers, and jump straight into the normal server dashboard for one of
// them. The per-server ImpersonationBanner + activity logging handle the
// "you are not the owner / actions are logged" side once you're in.

const C = {
    void: '#0B0B0F',
    surface: '#14141C',
    surface2: '#1B1D27',
    edge: 'rgba(255,255,255,0.08)',
    purple: '#7C3AED',
    text: '#E5E7EB',
    dim: '#9CA3AF',
    mute: '#6B7280',
    pink: '#EC4899',
};

export default () => {
    const history = useHistory();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [selected, setSelected] = useState<AdminUser | null>(null);
    const [servers, setServers] = useState<AdminUserServer[]>([]);
    const [loadingServers, setLoadingServers] = useState(false);

    const inputRef = useRef<HTMLInputElement | null>(null);

    const reset = useCallback(() => {
        setQuery('');
        setUsers([]);
        setSelected(null);
        setServers([]);
        setError(null);
    }, []);

    const close = useCallback(() => {
        setOpen(false);
        reset();
    }, [reset]);

    // Esc closes; focus the input on open.
    useEffect(() => {
        if (!open) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close();
        };
        window.addEventListener('keydown', onKey);
        const t = window.setTimeout(() => inputRef.current?.focus(), 30);
        return () => {
            window.removeEventListener('keydown', onKey);
            window.clearTimeout(t);
        };
    }, [open, close]);

    // Debounced user search (skipped while a user is selected).
    useEffect(() => {
        if (!open || selected) return;
        const q = query.trim();
        if (q.length < 1) {
            setUsers([]);
            setLoadingUsers(false);
            return;
        }
        let alive = true;
        setLoadingUsers(true);
        setError(null);
        const id = window.setTimeout(() => {
            searchAdminUsers(q)
                .then((u) => alive && setUsers(u))
                .catch((e) => alive && setError(httpErrorToHuman(e as Error)))
                .finally(() => alive && setLoadingUsers(false));
        }, 280);
        return () => {
            alive = false;
            window.clearTimeout(id);
        };
    }, [query, open, selected]);

    const pickUser = (u: AdminUser) => {
        setSelected(u);
        setServers([]);
        setLoadingServers(true);
        setError(null);
        getAdminUserServers(u.id)
            .then(setServers)
            .catch((e) => setError(httpErrorToHuman(e as Error)))
            .finally(() => setLoadingServers(false));
    };

    const openServer = (s: AdminUserServer) => {
        close();
        history.push(`/server/${s.identifier}`);
    };

    const returnToMine = () => {
        close();
        history.push('/');
    };

    return (
        <>
            <button
                type={'button'}
                onClick={() => setOpen(true)}
                title={'View as user'}
                aria-label={'View as user'}
                style={triggerBtn}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(124,58,237,0.16)';
                    e.currentTarget.style.color = '#C4B5FD';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                    e.currentTarget.style.color = C.dim;
                }}
            >
                <FontAwesomeIcon icon={faUserShield} />
            </button>

            {open && (
                <div
                    onMouseDown={(e) => e.target === e.currentTarget && close()}
                    style={{
                        position: 'fixed',
                        inset: 0,
                        zIndex: 9999,
                        background: 'rgba(0,0,0,0.62)',
                        backdropFilter: 'blur(3px)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        justifyContent: 'center',
                        padding: '12vh 16px 16px',
                    }}
                >
                    <div
                        role={'dialog'}
                        aria-label={'View as user'}
                        style={{
                            width: '100%',
                            maxWidth: 560,
                            maxHeight: '72vh',
                            display: 'flex',
                            flexDirection: 'column',
                            background: C.surface,
                            border: `1px solid ${C.edge}`,
                            borderRadius: 16,
                            boxShadow: '0 30px 80px -20px rgba(0,0,0,0.7)',
                            overflow: 'hidden',
                            fontFamily: "'Inter', system-ui, sans-serif",
                        }}
                    >
                        {/* Header strip */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '12px 14px',
                                background: `linear-gradient(135deg, rgba(124,58,237,0.18), rgba(34,211,238,0.06))`,
                                borderBottom: `1px solid ${C.edge}`,
                            }}
                        >
                            {selected ? (
                                <button
                                    type={'button'}
                                    onClick={() => {
                                        setSelected(null);
                                        setServers([]);
                                        window.setTimeout(() => inputRef.current?.focus(), 20);
                                    }}
                                    style={iconBtn}
                                    title={'Back to search'}
                                >
                                    <FontAwesomeIcon icon={faChevronLeft} />
                                </button>
                            ) : (
                                <FontAwesomeIcon icon={faUserShield} style={{ color: C.purple }} />
                            )}
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                    style={{
                                        fontFamily: "'Space Grotesk', sans-serif",
                                        fontWeight: 600,
                                        fontSize: 14,
                                        color: C.text,
                                    }}
                                >
                                    {selected ? selected.username : 'View as user'}
                                </div>
                                <div
                                    style={{
                                        fontSize: 11.5,
                                        color: C.dim,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                    }}
                                >
                                    {selected
                                        ? selected.email
                                        : 'Admin viewing mode — actions are logged against your account'}
                                </div>
                            </div>
                            <button type={'button'} onClick={close} style={iconBtn} title={'Close'}>
                                <FontAwesomeIcon icon={faTimes} />
                            </button>
                        </div>

                        {/* Search (hidden once a user is picked) */}
                        {!selected && (
                            <div style={{ padding: '12px 14px', borderBottom: `1px solid ${C.edge}` }}>
                                <div
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 10,
                                        background: C.void,
                                        border: `1px solid ${C.edge}`,
                                        borderRadius: 10,
                                        padding: '10px 12px',
                                    }}
                                >
                                    <FontAwesomeIcon icon={faSearch} style={{ color: C.mute, fontSize: 13 }} />
                                    <input
                                        ref={inputRef}
                                        value={query}
                                        onChange={(e) => setQuery(e.target.value)}
                                        placeholder={'Search by username, email, or ID…'}
                                        style={{
                                            flex: 1,
                                            background: 'transparent',
                                            border: 0,
                                            outline: 'none',
                                            color: C.text,
                                            fontSize: 14,
                                        }}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Body */}
                        <div style={{ overflowY: 'auto', flex: 1 }}>
                            {error && <div style={{ padding: 16, color: C.pink, fontSize: 13 }}>{error}</div>}

                            {/* User results */}
                            {!selected &&
                                !error &&
                                (loadingUsers ? (
                                    <div style={emptyMsg}>
                                        <FontAwesomeIcon icon={faSpinner} spin /> Searching…
                                    </div>
                                ) : query.trim().length < 1 ? (
                                    <div style={emptyMsg}>Type a name, email, or user ID to begin.</div>
                                ) : users.length === 0 ? (
                                    <div style={emptyMsg}>No users match “{query.trim()}”.</div>
                                ) : (
                                    users.map((u) => (
                                        <button
                                            key={u.id}
                                            type={'button'}
                                            onClick={() => pickUser(u)}
                                            style={rowBtn}
                                            onMouseEnter={(e) => (e.currentTarget.style.background = C.surface2)}
                                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                        >
                                            <span style={avatar}>{u.username.slice(0, 2).toUpperCase()}</span>
                                            <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                                                <span style={rowTitle}>
                                                    {u.username}
                                                    {u.rootAdmin && <span style={adminTag}>admin</span>}
                                                </span>
                                                <span style={rowSub}>
                                                    {u.email} · #{u.id}
                                                </span>
                                            </span>
                                            <FontAwesomeIcon
                                                icon={faChevronLeft}
                                                style={{ transform: 'rotate(180deg)', color: C.mute, fontSize: 12 }}
                                            />
                                        </button>
                                    ))
                                ))}

                            {/* Server list for the picked user */}
                            {selected &&
                                !error &&
                                (loadingServers ? (
                                    <div style={emptyMsg}>
                                        <FontAwesomeIcon icon={faSpinner} spin /> Loading servers…
                                    </div>
                                ) : servers.length === 0 ? (
                                    <div style={emptyMsg}>{selected.username} owns no servers.</div>
                                ) : (
                                    servers.map((s) => (
                                        <button
                                            key={s.uuid}
                                            type={'button'}
                                            onClick={() => openServer(s)}
                                            style={rowBtn}
                                            onMouseEnter={(e) => (e.currentTarget.style.background = C.surface2)}
                                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                        >
                                            <span style={{ ...avatar, background: 'rgba(34,211,238,0.16)', color: '#67E8F9' }}>
                                                <FontAwesomeIcon icon={faServer} style={{ fontSize: 12 }} />
                                            </span>
                                            <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                                                <span style={rowTitle}>{s.name}</span>
                                                <span style={rowSub}>
                                                    {s.identifier}
                                                    {s.status ? ` · ${s.status}` : ''}
                                                </span>
                                            </span>
                                            <FontAwesomeIcon
                                                icon={faChevronLeft}
                                                style={{ transform: 'rotate(180deg)', color: C.mute, fontSize: 12 }}
                                            />
                                        </button>
                                    ))
                                ))}
                        </div>

                        {/* Footer */}
                        <div
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '10px 14px',
                                borderTop: `1px solid ${C.edge}`,
                            }}
                        >
                            <button type={'button'} onClick={returnToMine} style={returnBtn}>
                                <FontAwesomeIcon icon={faUndo} style={{ marginRight: 6 }} />
                                Return to my servers
                            </button>
                            <span style={{ flex: 1 }} />
                            <span style={{ fontSize: 11, color: C.mute }}>Esc to close</span>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

const triggerBtn: React.CSSProperties = {
    width: 34,
    height: 34,
    borderRadius: 9,
    border: 0,
    background: 'rgba(255,255,255,0.04)',
    color: C.dim,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 14,
    transition: 'background 0.15s ease, color 0.15s ease',
    flexShrink: 0,
};

const iconBtn: React.CSSProperties = {
    width: 30,
    height: 30,
    borderRadius: 8,
    border: 0,
    background: 'rgba(255,255,255,0.05)',
    color: C.dim,
    cursor: 'pointer',
    flexShrink: 0,
};

const rowBtn: React.CSSProperties = {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '11px 14px',
    border: 0,
    borderBottom: `1px solid rgba(255,255,255,0.04)`,
    background: 'transparent',
    cursor: 'pointer',
    transition: 'background 0.12s ease',
};

const avatar: React.CSSProperties = {
    width: 34,
    height: 34,
    borderRadius: 9,
    background: 'rgba(124,58,237,0.18)',
    color: '#C4B5FD',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    fontFamily: "'Space Grotesk', sans-serif",
    flexShrink: 0,
};

const rowTitle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13.5,
    fontWeight: 600,
    color: C.text,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
};

const rowSub: React.CSSProperties = {
    display: 'block',
    fontSize: 11.5,
    color: C.dim,
    fontFamily: "'JetBrains Mono', monospace",
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
};

const adminTag: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    color: '#fbbf24',
    background: 'rgba(251,191,36,0.14)',
    padding: '1px 6px',
    borderRadius: 999,
    marginLeft: 2,
};

const emptyMsg: React.CSSProperties = {
    padding: '28px 16px',
    textAlign: 'center',
    color: C.mute,
    fontSize: 13,
};

const returnBtn: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    border: `1px solid ${C.edge}`,
    background: 'rgba(255,255,255,0.03)',
    color: C.text,
    fontSize: 12.5,
    fontWeight: 600,
    padding: '7px 12px',
    borderRadius: 9,
    cursor: 'pointer',
};
