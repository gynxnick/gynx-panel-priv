import * as React from 'react';
import styled from 'styled-components/macro';
import tw from 'twin.macro';
import { useStoreState } from 'easy-peasy';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faExclamationTriangle, faTimesCircle } from '@fortawesome/free-solid-svg-icons';
import { ApplicationStore } from '@/state';

/**
 * Surfaces the panel's license status as a top-of-shell banner.
 *
 *   - valid       → renders nothing
 *   - unlicensed  → renders nothing on the user side; admin sees it inside
 *                   the License page already, so a panel-wide nag would just
 *                   be noise for end users on a fresh install
 *   - unreachable → quiet warning bar (yellow) — server is up, license server
 *                   isn't reachable. Cached state still applies.
 *   - invalid     → loud red bar — admin needs to fix this. Shown to root
 *                   admins only since end users can't act on it.
 *
 * The actual *enforcement* (refusing requests, hiding features) is left to
 * controllers/middleware that depend on a valid license. This component is
 * UX only.
 */

const Bar = styled.div<{ $variant: 'warn' | 'err' }>`
    ${tw`flex items-center gap-3 px-4 py-2.5 text-sm`};
    background: ${({ $variant }) =>
        $variant === 'err' ? 'rgba(248, 113, 113, 0.1)' : 'rgba(252, 211, 77, 0.1)'};
    border-bottom: 1px solid ${({ $variant }) =>
        $variant === 'err' ? 'rgba(248, 113, 113, 0.4)' : 'rgba(252, 211, 77, 0.4)'};
    color: ${({ $variant }) => ($variant === 'err' ? '#FCA5A5' : '#FCD34D')};
    font-family: 'Inter', sans-serif;

    a {
        color: inherit;
        text-decoration: underline;
    }
`;

const LicenseBanner: React.FC = () => {
    const license = useStoreState((s: ApplicationStore) => s.settings.data?.license);
    const rootAdmin = useStoreState((s: ApplicationStore) => s.user.data?.rootAdmin ?? false);

    if (!license) return null;

    if (license.status === 'invalid') {
        // Loud red bar for everyone — end users hitting /api/client/* get
        // 423s right now, so they should know it's a panel-wide issue, not
        // user error. Admins get an action link; everyone else gets a
        // "contact your admin" pointer.
        return (
            <Bar $variant={'err'} role={'alert'}>
                <FontAwesomeIcon icon={faTimesCircle} />
                <div>
                    <strong>Panel license is invalid.</strong>{' '}
                    {license.message || 'Some features are disabled until this is resolved.'}{' '}
                    {rootAdmin
                        ? <>Fix it in <a href={'/admin/license'}>Admin → License</a>.</>
                        : 'Contact your panel admin.'}
                </div>
            </Bar>
        );
    }

    if (license.status === 'unreachable' && rootAdmin) {
        return (
            <Bar $variant={'warn'} role={'status'}>
                <FontAwesomeIcon icon={faExclamationTriangle} />
                <div>
                    <strong>License server unreachable.</strong>{' '}
                    Cached status is still in effect — no action needed unless this persists.
                </div>
            </Bar>
        );
    }

    return null;
};

export default LicenseBanner;
