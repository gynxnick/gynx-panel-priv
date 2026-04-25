import React, { useEffect } from 'react';
import styled from 'styled-components/macro';
import { useStoreState } from 'easy-peasy';
import ContentContainer from '@/components/elements/ContentContainer';
import { CSSTransition } from 'react-transition-group';
import tw from 'twin.macro';
import FlashMessageRender from '@/components/FlashMessageRender';
import { ApplicationStore } from '@/state';
import { brand } from '@/state/settings';

export interface PageContentBlockProps {
    title?: string;
    className?: string;
    showFlashKey?: string;
    /**
     * Opt-in flag for pages with editor-style content (config editor, file
     * manager, console) that benefit from filling the viewport width instead
     * of hitting the 1200px ContentContainer cap. Adds a small horizontal
     * gutter so content doesn't slam into the sidebar.
     */
    wide?: boolean;
}

const WideContainer = styled.div`
    ${tw`w-full`};
    padding: 0 1.5rem;
    @media (max-width: 640px) {
        padding: 0 1rem;
    }
`;

const PageContentBlock: React.FC<PageContentBlockProps> = ({ title, showFlashKey, className, wide, children }) => {
    // Always suffix the tab title with the brand siteName so the panel
    // identifies itself in browser tabs/history. ServerContentBlock and
    // friends pass titles like "Console" or "Files"; the suffix turns
    // those into "Console · gynx panel".
    const siteName = useStoreState((s: ApplicationStore) => brand(s.settings.data).siteName);
    useEffect(() => {
        if (title) {
            document.title = siteName ? `${title} · ${siteName}` : title;
        } else if (siteName) {
            document.title = siteName;
        }
    }, [title, siteName]);

    const Container: React.FC<{ children: React.ReactNode; className?: string }> = wide
        ? ({ children, className }) => (
              <WideContainer className={className} css={tw`my-4 sm:my-6`}>
                  {children}
              </WideContainer>
          )
        : ({ children, className }) => (
              <ContentContainer css={tw`my-4 sm:my-6 px-4 sm:px-6`} className={className}>
                  {children}
              </ContentContainer>
          );

    return (
        <CSSTransition timeout={150} classNames={'fade'} appear in>
            <>
                <Container className={className}>
                    {showFlashKey && <FlashMessageRender byKey={showFlashKey} css={tw`mb-4`} />}
                    {children}
                </Container>
                <ContentContainer css={tw`mb-6 mt-8`}>
                    <p
                        css={tw`text-center text-[10px] font-display lowercase`}
                        style={{
                            letterSpacing: '0.28em',
                            color: 'rgba(156, 163, 175, 0.35)',
                        }}
                    >
                        gynx.gg &mdash; host smarter. play harder.
                    </p>
                </ContentContainer>
            </>
        </CSSTransition>
    );
};

export default PageContentBlock;
