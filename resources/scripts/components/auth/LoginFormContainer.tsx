import React, { forwardRef, useEffect, useState } from 'react';
import { Form } from 'formik';
import styled, { keyframes, css } from 'styled-components/macro';
import tw from 'twin.macro';
import { useStoreState } from 'easy-peasy';
import FlashMessageRender from '@/components/FlashMessageRender';
import LogoMark from '@/components/gynx/LogoMark';
import { brand } from '@/state/settings';

type Props = React.DetailedHTMLProps<React.FormHTMLAttributes<HTMLFormElement>, HTMLFormElement> & {
    title?: string;
};

// ----- rotating tagline ------------------------------------------------------

const useRotatingTagline = (taglines: string[], intervalMs = 5500) => {
    const [i, setI] = useState(0);
    useEffect(() => {
        if (taglines.length <= 1) return;
        const id = window.setInterval(() => setI((n) => (n + 1) % taglines.length), intervalMs);
        return () => window.clearInterval(id);
    }, [intervalMs, taglines.length]);
    return taglines[i] ?? taglines[0] ?? '';
};

// ----- scaffolding -----------------------------------------------------------

const Shell = styled.div`
    ${tw`min-h-screen w-full flex flex-col md:flex-row`};
    background: var(--gynx-void);
    position: relative;
    z-index: 1;
`;

const BrandPanel = styled.aside`
    ${tw`relative flex flex-col items-center justify-center md:items-start md:justify-between p-8 md:p-12`};
    width: 100%;
    @media (min-width: 768px) { width: 40%; min-height: 100vh; }

    /* denser iso voxel here than the global body::before (8% vs 3.5%) */
    background:
        radial-gradient(900px 600px at 20% 110%, rgba(124, 58, 237, 0.15), transparent 55%),
        radial-gradient(700px 500px at 110% -10%, rgba(34, 211, 238, 0.08), transparent 60%),
        linear-gradient(160deg, #0B0B0F 0%, #12101B 100%);
    overflow: hidden;

    &::before {
        content: '';
        position: absolute;
        inset: 0;
        background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='80' height='92' viewBox='0 0 80 92'><g stroke='rgba(255,255,255,0.9)' stroke-width='1' fill='none'><path d='M 0 23 L 40 0 L 80 23 L 40 46 Z'/><line x1='0' y1='23' x2='0' y2='69'/><line x1='80' y1='23' x2='80' y2='69'/><line x1='40' y1='46' x2='40' y2='92'/><path d='M 0 69 L 40 92 L 80 69'/></g></svg>");
        background-size: 80px 92px;
        opacity: 0.08;
        mask-image: radial-gradient(ellipse at center, black 40%, transparent 95%);
        -webkit-mask-image: radial-gradient(ellipse at center, black 40%, transparent 95%);
        pointer-events: none;
    }
`;

const BrandLockup = styled.div`
    ${tw`relative z-10 flex items-center mb-8 md:mb-0`};
`;

const fadeIn = keyframes`
    from { opacity: 0; transform: translateY(6px); }
    to   { opacity: 1; transform: translateY(0); }
`;

const Tagline = styled.p`
    ${tw`relative z-10 hidden md:block`};
    max-width: 28ch;
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    font-size: 32px;
    font-weight: 500;
    line-height: 1.2;
    color: var(--gynx-text);
    margin: 0;
    animation: ${fadeIn} .7s ease-out both;
`;

const BrandFoot = styled.div`
    ${tw`relative z-10 hidden md:flex items-center gap-4`};
    font-size: 11px;
    font-family: 'Inter', sans-serif;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--gynx-text-mute);

    a {
        color: var(--gynx-text-dim);
        text-decoration: none;
        transition: color .15s ease;
    }
    a:hover { color: var(--gynx-text); }
`;

// ----- form side ------------------------------------------------------------

const FormSide = styled.div`
    ${tw`flex-1 flex items-center justify-center p-6 md:p-10`};
    position: relative;
`;

const FormCard = styled.div`
    ${tw`w-full relative rounded-xl`};
    max-width: 440px;
    background: var(--gynx-surface);
    border: 1px solid var(--gynx-edge);
    padding: 32px;
    box-shadow: 0 24px 60px -20px rgba(0, 0, 0, 0.5);

    @media (max-width: 640px) {
        padding: 24px;
    }
`;

const Title = styled.h2`
    ${tw`m-0 mb-1`};
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    font-size: 22px;
    font-weight: 600;
    letter-spacing: -0.01em;
    color: var(--gynx-text);
`;

const Lede = styled.p`
    ${tw`m-0 mb-6`};
    font-family: 'Inter', sans-serif;
    font-size: 13px;
    color: var(--gynx-text-dim);
`;

// Shimmer overlay for the submit button when Formik is submitting. Scoped via
// FormFrame below so only this form's submit button picks it up.
const shimmer = keyframes`
    0%   { background-position: -200% 0; }
    100% { background-position:  200% 0; }
`;

const FormFrame = styled(Form)`
    /* Containers (LoginContainer, ForgotPasswordContainer, etc.) pass
       css=tw\`w-full flex\` as a legacy holdover. Force vertical stack. */
    && {
        margin: 0;
        display: flex !important;
        flex-direction: column !important;
        gap: 16px;
        width: 100%;
    }

    /* Immediate children become full-width rows regardless of the old
       inline wrappers (<div css={tw\`mt-6\`}> etc.). Reset their spacing
       since the gap above already supplies rhythm. */
    > * {
        width: 100%;
        margin-top: 0 !important;
    }

    /* First field has no wrapper div in some containers — patch it. */
    > div > div > div {
        width: 100%;
    }

    label {
        color: var(--gynx-text-dim) !important;
        font-family: 'Inter', sans-serif !important;
        text-transform: none !important;
        font-size: 12px !important;
        letter-spacing: 0.02em !important;
        font-weight: 500 !important;
        margin-bottom: 6px !important;
        display: block !important;
    }

    input[type='text'],
    input[type='email'],
    input[type='password'],
    input[type='number'] {
        display: block !important;
        width: 100% !important;
        min-height: 42px !important;
        padding: 10px 12px !important;
        background: rgba(15, 17, 26, 0.95) !important;
        border: 1px solid var(--gynx-edge) !important;
        color: var(--gynx-text) !important;
        border-radius: 8px !important;
        font-family: 'Inter', sans-serif !important;
        font-size: 14px !important;
        transition: border-color .15s ease, box-shadow .15s ease, background .15s ease;
    }

    input[type='text']:hover,
    input[type='email']:hover,
    input[type='password']:hover,
    input[type='number']:hover {
        border-color: var(--gynx-edge-2) !important;
    }

    input[type='text']:focus,
    input[type='email']:focus,
    input[type='password']:focus,
    input[type='number']:focus {
        border-color: rgba(124, 58, 237, 0.55) !important;
        box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.18) !important;
        outline: none !important;
        background: rgba(19, 21, 31, 0.98) !important;
    }

    /* The submit button — always gynx-purple gradient. Shimmer on load. */
    button[type='submit'] {
        width: 100% !important;
        min-height: 44px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        padding: 0 18px !important;
        border-radius: 10px !important;
        border: 0 !important;
        background: linear-gradient(135deg, #7C3AED 0%, #9B5BFF 100%) !important;
        color: #fff !important;
        font-family: 'Inter', sans-serif !important;
        font-size: 14px !important;
        font-weight: 600 !important;
        letter-spacing: 0.02em !important;
        cursor: pointer !important;
        position: relative;
        overflow: hidden;
        transition: box-shadow .18s ease, transform .18s ease;
    }

    button[type='submit']:hover:not([disabled]) {
        box-shadow: 0 10px 28px -10px rgba(124, 58, 237, 0.6);
        transform: translateY(-1px);
    }

    button[type='submit']:active:not([disabled]) {
        transform: translateY(0);
    }

    button[type='submit'][disabled],
    button[type='submit'].loading {
        background: linear-gradient(
            90deg,
            rgba(124, 58, 237, 0.9) 0%,
            rgba(192, 132, 252, 0.95) 50%,
            rgba(124, 58, 237, 0.9) 100%
        ) !important;
        background-size: 200% 100%;
        animation: ${shimmer} 1.6s linear infinite;
        color: #fff !important;
        cursor: wait !important;
    }

    /* Trailing "Forgot password?" / "Return to Login" links get a softer
       look and center-align — the containers wrap them in text-center. */
    a {
        color: var(--gynx-text-dim);
        text-decoration: none;
        transition: color .15s ease;
        font-family: 'Inter', sans-serif;
        font-size: 12px;
        letter-spacing: 0.04em;
        text-transform: none;
    }
    a:hover {
        color: var(--gynx-text);
    }

    /* Error text under fields */
    .input-help.error {
        color: #F87171 !important;
        font-size: 12px;
        margin-top: 4px;
    }
    .input-help {
        color: var(--gynx-text-mute);
        font-size: 12px;
        margin-top: 4px;
    }
`;

const Footer = styled.p`
    ${tw`text-center mt-6`};
    font-size: 11px;
    color: var(--gynx-text-mute);
    font-family: 'Inter', sans-serif;
    letter-spacing: 0.04em;

    a {
        color: var(--gynx-text-dim);
        text-decoration: none;
    }
    a:hover { color: var(--gynx-text); }
`;

// ----- exported component ---------------------------------------------------

export default forwardRef<HTMLFormElement, Props>(({ title, children, ...props }, ref) => {
    const settings = useStoreState((state) => state.settings.data as any);
    const brandCfg = brand(settings);
    const tagline = useRotatingTagline(brandCfg.authTaglines);

    return (
        <Shell>
            <BrandPanel>
                <BrandLockup aria-label={brandCfg.siteName}>
                    <LogoMark size={72} url={brandCfg.logoUrl} alt={brandCfg.siteName} />
                </BrandLockup>

                <Tagline key={tagline}>{tagline}</Tagline>

                <BrandFoot>
                    <span>© {new Date().getFullYear()} {brandCfg.siteName}</span>
                    {brandCfg.footerCopy && (
                        <>
                            <span aria-hidden>·</span>
                            <span>{brandCfg.footerCopy}</span>
                        </>
                    )}
                </BrandFoot>
            </BrandPanel>

            <FormSide>
                <FormCard>
                    {title && <Title>{title}</Title>}
                    <Lede>{brandCfg.authLede}</Lede>
                    <FlashMessageRender css={tw`mb-4`} />
                    <FormFrame {...props} ref={ref}>
                        {children}
                    </FormFrame>
                    <Footer>
                        © 2015 – {new Date().getFullYear()}&nbsp;
                        <a
                            rel={'noopener nofollow noreferrer'}
                            href={'https://pterodactyl.io'}
                            target={'_blank'}
                        >
                            Pterodactyl Software
                        </a>
                    </Footer>
                </FormCard>
            </FormSide>
        </Shell>
    );
});
