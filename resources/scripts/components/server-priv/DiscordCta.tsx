import * as React from 'react';
import { useState, useEffect } from 'react';
import { Icon } from './Icon';

// Optional join-the-discord prompt next to the crash logs. Dismissable
// with a localStorage flag so we don't keep nagging anyone who's already
// in the server. Re-renders nothing when dismissed.

const STORAGE_KEY = 'gynx:discord-cta-dismissed-at';
// If we ever change the invite or want to re-prompt previously-dismissed
// users, bump this — values older than the cutoff are ignored.
const DISMISS_CUTOFF = '2026-04-28';

const DISCORD_INVITE = 'https://discord.gg/gynx';

const DiscordIcon = ({ size = 14 }: { size?: number }) => (
    <svg width={size} height={size} viewBox={'0 0 24 24'} fill={'currentColor'} aria-hidden>
        <path d={'M20.317 4.37a19.79 19.79 0 0 0-4.885-1.515.075.075 0 0 0-.079.037c-.21.375-.444.864-.608 1.249a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.036A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.106c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z'} />
    </svg>
);

export const DiscordCta = () => {
    const [dismissed, setDismissed] = useState(true); // start hidden until we read storage to avoid a flash

    useEffect(() => {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        const isStale = !stored || stored < DISMISS_CUTOFF;
        setDismissed(!isStale);
    }, []);

    if (dismissed) return null;

    const onDismiss = () => {
        window.localStorage.setItem(STORAGE_KEY, new Date().toISOString().slice(0, 10));
        setDismissed(true);
    };

    return (
        <div
            className={'panel'}
            style={{
                padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: 14,
                background: 'linear-gradient(135deg, rgba(88, 101, 242, 0.10), rgba(124, 58, 237, 0.06))',
                border: '1px solid rgba(88, 101, 242, 0.28)',
            }}
        >
            <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: 'rgba(88, 101, 242, 0.16)',
                color: '#a5b4fc',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
            }}>
                <DiscordIcon size={18} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                    fontFamily: "'Space Grotesk', sans-serif",
                    fontSize: 13.5, fontWeight: 600, color: 'var(--text)',
                }}>
                    Join the gynx Discord
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-soft)', marginTop: 2 }}>
                    Live support, mod recommendations, and the place we drop status updates first.
                </div>
            </div>
            <a
                href={DISCORD_INVITE}
                target={'_blank'}
                rel={'noopener noreferrer'}
                className={'btn btn-primary'}
                style={{ flexShrink: 0 }}
            >
                <DiscordIcon size={12} />
                Join
            </a>
            <button
                className={'icon-btn'}
                onClick={onDismiss}
                title={'Dismiss'}
                style={{ width: 26, height: 26, flexShrink: 0 }}
            >
                <Icon name={'plus'} size={11} style={{ transform: 'rotate(45deg)' }} />
            </button>
        </div>
    );
};

export default DiscordCta;
