import styled from 'styled-components/macro';
import tw from 'twin.macro';

/**
 * Server / account sub-navigation strip.
 *
 * Spec:
 *   - Active tab → purple pill (not underline; pill reads as "current" faster)
 *   - Hover    → blue highlight on inactive tabs
 *   - Subtle glass effect on the strip itself
 *   - Tabs are compact, icons render before the label
 */

const SubNavigation = styled.div`
    ${tw`w-full overflow-x-auto`};
    background: rgba(17, 19, 28, 0.55);
    border-bottom: 1px solid var(--gynx-edge);
    backdrop-filter: blur(12px) saturate(130%);
    -webkit-backdrop-filter: blur(12px) saturate(130%);

    & > div {
        ${tw`flex items-center text-sm mx-auto px-6 py-2 gap-1`};
        max-width: 1440px;

        & > a {
            ${tw`inline-flex items-center px-3 py-2 text-gynx-text-dim no-underline whitespace-nowrap rounded-md`};
            font-weight: 500;
            letter-spacing: 0.01em;
            transition: color .2s ease, background .2s ease;

            /* Hover on inactive: soft neutral. Keeps the cyan-for-active
               reading clean instead of fighting a cyan-hover. */
            &:hover {
                color: #fff;
                background: rgba(255, 255, 255, 0.04);
            }

            /* Active = cyan pill. Purple is reserved for actions (buttons);
               state uses blue. */
            &:active,
            &.active {
                color: #fff;
                background: rgba(34, 211, 238, 0.16);
                box-shadow: inset 0 0 0 1px rgba(34, 211, 238, 0.45);
            }

            &.active:hover {
                /* Keep active state louder than inactive hover */
                background: rgba(34, 211, 238, 0.22);
            }
        }
    }
`;

export default SubNavigation;
