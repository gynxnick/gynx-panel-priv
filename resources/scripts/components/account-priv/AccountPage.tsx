import * as React from 'react';
import { useLocation } from 'react-router-dom';
import { Icon } from '@/components/server-priv/Icon';
import UpdatePasswordForm from '@/components/dashboard/forms/UpdatePasswordForm';
import UpdateEmailAddressForm from '@/components/dashboard/forms/UpdateEmailAddressForm';
import ConfigureTwoFactorForm from '@/components/dashboard/forms/ConfigureTwoFactorForm';
import FlashMessageRender from '@/components/FlashMessageRender';

// /account overview — restyled to match the server-priv shell. The forms
// themselves (password / email / 2FA) are reused as-is from the legacy
// dashboard; only the chrome around them is reskinned. Each card is a
// .panel under the same .gynx-server-priv scope so all the design tokens
// (fonts, borders, radii) carry over without duplicating CSS.

interface SectionProps {
    title: string;
    description: string;
    icon: React.ComponentProps<typeof Icon>['name'];
    flashKey?: string;
    children: React.ReactNode;
}

const Section = ({ title, description, icon, flashKey, children }: SectionProps) => (
    <div className={'panel'} style={{ padding: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
            <div
                style={{
                    width: 36, height: 36, borderRadius: 8,
                    background: 'rgba(124, 58, 237, 0.10)',
                    border: '1px solid rgba(124, 58, 237, 0.28)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--purple)', flexShrink: 0,
                }}
            >
                <Icon name={icon} size={16} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
                <div
                    style={{
                        fontFamily: "'Space Grotesk', sans-serif",
                        fontSize: 14, fontWeight: 600, color: 'var(--text)',
                    }}
                >
                    {title}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-soft)', lineHeight: 1.5, marginTop: 2 }}>
                    {description}
                </div>
            </div>
        </div>
        {flashKey && <FlashMessageRender byKey={flashKey} />}
        <div className={'account-form-host'}>
            {children}
        </div>
    </div>
);

export const AccountPage = () => {
    const { state } = useLocation<undefined | { twoFactorRedirect?: boolean }>();

    return (
        <>
            <div className={'sub-main'} style={{ padding: '20px 24px 32px' }}>
                <div className={'page-header'}>
                    <div>
                        <div className={'page-title'}>Profile &amp; security</div>
                        <div className={'page-sub'}>
                            Update your sign-in credentials and two-step verification. These apply to every server on your account.
                        </div>
                    </div>
                </div>

                {state?.twoFactorRedirect && (
                    <div className={'notice warn'} style={{ marginBottom: 14 }}>
                        <Icon name={'shield'} size={14} />
                        Your account must have two-factor authentication enabled in order to continue.
                    </div>
                )}

                <div
                    style={{
                        display: 'grid', gap: 14,
                        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
                    }}
                >
                    <Section
                        title={'Password'}
                        description={'Sign-in password. Changing it logs out all existing sessions.'}
                        icon={'shield'}
                        flashKey={'account:password'}
                    >
                        <UpdatePasswordForm />
                    </Section>

                    <Section
                        title={'Email address'}
                        description={'Where we send security notifications and account recovery codes.'}
                        icon={'send'}
                        flashKey={'account:email'}
                    >
                        <UpdateEmailAddressForm />
                    </Section>

                    <Section
                        title={'Two-step verification'}
                        description={'Adds a TOTP code on top of your password. Enable in any authenticator app.'}
                        icon={'check'}
                        flashKey={'account:two-step'}
                    >
                        <ConfigureTwoFactorForm />
                    </Section>
                </div>
            </div>

            {/* Local overrides so the legacy form inputs / buttons read as
                native to the dark priv panel chrome. The .account-form-host
                scope keeps these from leaking out to other surfaces that
                still depend on the legacy gray-on-gray look. */}
            <style>{`
                .account-form-host input[type="text"],
                .account-form-host input[type="email"],
                .account-form-host input[type="password"] {
                    background: var(--surface-2) !important;
                    border: 1px solid var(--line-2) !important;
                    color: var(--text) !important;
                    border-radius: 8px !important;
                    padding: 9px 12px !important;
                    font-size: 13px !important;
                    box-shadow: none !important;
                    transition: border-color .15s ease;
                }
                .account-form-host input[type="text"]:focus,
                .account-form-host input[type="email"]:focus,
                .account-form-host input[type="password"]:focus {
                    border-color: var(--purple) !important;
                    outline: none !important;
                }
                .account-form-host label {
                    color: var(--text-soft) !important;
                    font-size: 11px !important;
                    text-transform: uppercase !important;
                    letter-spacing: 0.06em !important;
                    font-family: 'JetBrains Mono', monospace !important;
                    margin-bottom: 6px !important;
                }
                .account-form-host .input-help {
                    color: var(--text-faint) !important;
                    font-size: 11px !important;
                    margin-top: 6px !important;
                }
                .account-form-host .input-help.error {
                    color: #f87171 !important;
                }
                .account-form-host button[type="submit"],
                .account-form-host button:not([type]) {
                    background: var(--purple) !important;
                    border: 1px solid var(--purple) !important;
                    color: white !important;
                    border-radius: 8px !important;
                    height: 34px !important;
                    padding: 0 14px !important;
                    font-size: 13px !important;
                    font-family: 'Space Grotesk', sans-serif !important;
                    font-weight: 500 !important;
                    transition: filter .15s ease;
                }
                .account-form-host button[type="submit"]:hover,
                .account-form-host button:not([type]):hover {
                    filter: brightness(1.1);
                }
                .account-form-host button[type="submit"][disabled],
                .account-form-host button:not([type])[disabled] {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </>
    );
};

export default AccountPage;
