import React, { forwardRef, useEffect, useState } from 'react';
import { Form } from 'formik';
import styled, { keyframes, css } from 'styled-components/macro';
import tw from 'twin.macro';
import { useStoreState } from 'easy-peasy';
import FlashMessageRender from '@/components/FlashMessageRender';
import LogoMark from '@/components/gynx/LogoMark';

type Props = React.DetailedHTMLProps<React.FormHTMLAttributes<HTMLFormElement>, HTMLFormElement> & {
    title?: string;
};

// ----- rotating tagline ------------------------------------------------------

const TAGLINES = [
    'host smarter. play harder.',
    'your server, fully unleashed.',
    'performance without compromise.',
    'where your world runs better.',
    'powering your worlds — instantly, reliably.',
] as const;

const useRotatingTagline = (intervalMs = 5500) => {
    const [i, setI] = useState(0);
    useEffect(() => {
        const id = window.setInterval(() => setI((n) => (n + 1) % TAGLINES.length), intervalMs);
        return () => window.clearInterval(id);
    }, [intervalMs]);
    return TAGLINES[i];
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
    ${tw`relative z-10 flex items-center gap-4 mb-8 md:mb-0`};
`;

const BrandWord = styled.span`
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    font-size: 28px;
    font-weight: 600;
    letter-spacing: 0.02em;
    color: var(--gynx-text);
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
    margin: 0;

    button[type='submit'] {
        ${css`
            width: 100%;
            position: relative;
            overflow: hidden;
        `}
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
    }

    /* Inputs in the auth form should always read dark regardless of the
       legacy 'light' prop still being passed by the containers. */
    input[type='text'],
    input[type='email'],
    input[type='password'],
    input[type='number'] {
        background: rgba(15, 17, 26, 0.95) !important;
        border: 1px solid var(--gynx-edge) !important;
        color: var(--gynx-text) !important;
        border-radius: 8px !important;
        transition: border-color .15s ease, box-shadow .15s ease;
    }

    input[type='text']:focus,
    input[type='email']:focus,
    input[type='password']:focus,
    input[type='number']:focus {
        border-color: rgba(124, 58, 237, 0.55) !important;
        box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.18);
        outline: none;
    }

    label {
        color: var(--gynx-text-dim) !important;
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
    const tagline = useRotatingTagline();
    const logoUrl = useStoreState((state) => (state.settings.data as any)?.logoUrl as string | null | undefined);

    return (
        <Shell>
            <BrandPanel>
                <BrandLockup>
                    <LogoMark size={40} url={logoUrl ?? undefined} />
                    <BrandWord>gynx.gg</BrandWord>
                </BrandLockup>

                <Tagline key={tagline}>{tagline}</Tagline>

                <BrandFoot>
                    <span>© {new Date().getFullYear()} gynx.gg</span>
                    <span aria-hidden>·</span>
                    <a href={'https://gynx.gg'} target={'_blank'} rel={'noreferrer'}>gynx.gg</a>
                </BrandFoot>
            </BrandPanel>

            <FormSide>
                <FormCard>
                    {title && <Title>{title}</Title>}
                    <Lede>manage your game servers with speed and control.</Lede>
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
