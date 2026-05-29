import * as React from 'react';
import { ServerContext } from '@/state/server';
import { Icon } from './Icon';

// Visible warning rendered across every server-scoped page when the current
// viewer is a root admin looking at a server they don't own (and aren't a
// subuser of). Backend ServerController populates server.impersonation only
// in that case; we render nothing otherwise.
//
// Two affordances:
//   - "Back to admin" sends the admin to the legacy /admin/servers/{id}
//     edit page for the same server (full-page navigation, not SPA — the
//     admin section is a Blade-rendered area outside the React bundle).
//   - The amber chrome + shield icon make it visually distinct from
//     AlertBar (which is informational/blue) so nobody mistakes an
//     impersonation session for their own server.

export const ImpersonationBanner = () => {
    const impersonation = ServerContext.useStoreState((s) => s.server.data?.impersonation);
    const internalId = ServerContext.useStoreState((s) => s.server.data?.internalId);

    if (!impersonation) return null;

    const adminUrl = internalId !== undefined ? `/admin/servers/view/${internalId}` : '/admin/servers';

    return (
        <div
            role={'alert'}
            style={{
                background: 'linear-gradient(135deg, rgba(251, 191, 36, 0.14), rgba(251, 191, 36, 0.06))',
                borderBottom: '1px solid rgba(251, 191, 36, 0.40)',
                padding: '10px 16px',
                display: 'flex', alignItems: 'center', gap: 12,
            }}
        >
            <div style={{
                width: 28, height: 28, borderRadius: 6,
                background: 'rgba(251, 191, 36, 0.18)', color: '#fbbf24',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
            }}>
                <Icon name={'shield'} size={14} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 13, fontWeight: 600, color: '#fbbf24',
                    letterSpacing: 0.2,
                }}>
                    Admin view — you are not the owner of this server
                </div>
                <div style={{
                    fontSize: 12, color: 'var(--text-soft)', marginTop: 2,
                    fontFamily: "'JetBrains Mono', monospace",
                }}>
                    owner: {impersonation.ownerUsername || '—'}
                    {impersonation.ownerEmail ? ` · ${impersonation.ownerEmail}` : ''}
                    {' · actions are logged against your account'}
                </div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <a
                    href={'/'}
                    className={'btn btn-sm'}
                    title={'Return to your own servers'}
                >
                    <Icon name={'chevron-right'} size={11} style={{ transform: 'rotate(180deg)' }} />
                    My servers
                </a>
                <a
                    href={adminUrl}
                    className={'btn btn-sm'}
                    title={'Return to the admin server detail page'}
                >
                    <Icon name={'shield'} size={11} />
                    Back to admin
                </a>
            </div>
        </div>
    );
};

export default ImpersonationBanner;
