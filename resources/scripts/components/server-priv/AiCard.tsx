import * as React from 'react';
import { useEffect, useState } from 'react';
import { ServerContext } from '@/state/server';
import { Icon } from './Icon';
import { getAiStatus, askAi, AiStatus } from '@/api/server/ai';
import { httpErrorToHuman } from '@/api/http';
import loadDirectory from '@/api/server/files/loadDirectory';
import getFileContents from '@/api/server/files/getFileContents';

// Real gynx.ai diagnostic card. Replaces the "coming soon" placeholder.
// Backend is provider-agnostic — v1 ships with Gemini.
//
// UX: collapsed state is a one-line teaser + "Ask gynx.ai" button. Once
// the user opens it the card grows to fit a textarea + response. The
// "analyze last crash" shortcut auto-fetches the freshest crash file
// from /crash-reports or /logs/crashes and submits with a canned
// question — the most common ask, optimized to one click.

const CRASH_DIRS = ['/crash-reports', '/logs/crashes'];

const fetchLatestCrash = async (uuid: string): Promise<{ name: string; content: string } | null> => {
    let best: { name: string; path: string; modifiedAt: Date } | null = null;
    for (const dir of CRASH_DIRS) {
        try {
            const files = await loadDirectory(uuid, dir);
            for (const f of files) {
                if (!f.isFile || !/\.(txt|log)$/i.test(f.name)) continue;
                if (!best || f.modifiedAt.getTime() > best.modifiedAt.getTime()) {
                    best = { name: f.name, path: `${dir}/${f.name}`, modifiedAt: f.modifiedAt };
                }
            }
        } catch {
            // Probe failures are fine — Minecraft only creates these
            // dirs after the first crash.
        }
    }
    if (!best) return null;
    const content = await getFileContents(uuid, best.path);
    return { name: best.name, content };
};

interface AnswerState {
    text: string;
    provider: string;
    remaining: number;
    cap: number;
}

export const AiCard = () => {
    const uuid = ServerContext.useStoreState((s) => s.server.data!.uuid);

    const [status, setStatus] = useState<AiStatus | null>(null);
    const [open, setOpen] = useState(false);
    const [question, setQuestion] = useState('');
    const [busy, setBusy] = useState<'asking' | 'crash' | null>(null);
    const [answer, setAnswer] = useState<AnswerState | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [crashAttached, setCrashAttached] = useState<string | null>(null);

    useEffect(() => {
        let alive = true;
        getAiStatus(uuid)
            .then((s) => alive && setStatus(s))
            .catch(() => alive && setStatus({ available: false, provider: null, remainingToday: 0, dailyCap: 0 }));
        return () => { alive = false; };
    }, [uuid]);

    if (!status) {
        return (
            <div className={'panel ai-card'} style={{ minHeight: 90 }}>
                <div className={'ai-card-bg'} />
                <div className={'ai-card-inner'}>
                    <span className={'ai-badge'}>gynx ai</span>
                    <p className={'ai-msg'} style={{ marginTop: 8 }}>checking availability…</p>
                </div>
            </div>
        );
    }

    if (!status.available) {
        // Provider not configured / disabled. Render the original
        // teaser so the slot reads as "feature on the roadmap" rather
        // than a broken UI.
        return (
            <div className={'panel ai-card'}>
                <div className={'ai-card-bg'} />
                <div className={'ai-card-inner'}>
                    <div className={'row'} style={{ justifyContent: 'space-between' }}>
                        <span className={'ai-badge'}>gynx ai</span>
                        <span style={{ fontSize: 10, color: 'var(--text-faint)', fontFamily: "'JetBrains Mono',monospace" }}>
                            coming soon
                        </span>
                    </div>
                    <p className={'ai-msg'}>
                        gynx ai will diagnose crashes and suggest fixes from the panel. Not yet enabled here.
                    </p>
                </div>
            </div>
        );
    }

    const submit = async (q: string, crashContent?: string) => {
        if (!q.trim()) return;
        setBusy('asking');
        setError(null);
        try {
            const ans = await askAi(uuid, {
                question: q.trim(),
                ...(crashContent ? { crash: crashContent } : {}),
            });
            setAnswer({
                text: ans.text,
                provider: ans.provider,
                remaining: ans.remainingToday,
                cap: ans.dailyCap,
            });
            setStatus((s) => (s ? { ...s, remainingToday: ans.remainingToday } : s));
        } catch (e) {
            setError(httpErrorToHuman(e as Error));
        } finally {
            setBusy(null);
        }
    };

    const onAnalyzeLastCrash = async () => {
        setBusy('crash');
        setError(null);
        setOpen(true);
        try {
            const crash = await fetchLatestCrash(uuid);
            if (!crash) {
                setError('No crash files found in /crash-reports or /logs/crashes.');
                return;
            }
            setCrashAttached(crash.name);
            await submit(`Why did this server crash, and what should I do to fix it?`, crash.content);
        } catch (e) {
            setError(httpErrorToHuman(e as Error));
        } finally {
            // submit() owns the asking state; only clear if the crash fetch
            // itself errored before we got there.
            setBusy((b) => (b === 'crash' ? null : b));
        }
    };

    const onAsk = async () => {
        await submit(question);
    };

    const noQuotaLeft = status.remainingToday <= 0;

    return (
        <div className={'panel ai-card'} style={{ overflow: 'hidden' }}>
            <div className={'ai-card-bg'} />
            <div className={'ai-card-inner'} style={{ position: 'relative', zIndex: 1 }}>
                <div className={'row'} style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                    <span className={'ai-badge'}>gynx ai</span>
                    <span style={{
                        fontSize: 10, color: 'var(--text-faint)',
                        fontFamily: "'JetBrains Mono',monospace",
                    }}>
                        {status.remainingToday}/{status.dailyCap} today · {status.provider}
                    </span>
                </div>

                {!open && !answer ? (
                    <>
                        <p className={'ai-msg'}>
                            Diagnose crashes, broken startup, or weird behaviour. Paste a problem or run the one-click crash analyzer.
                        </p>
                        <div className={'ai-actions'}>
                            <button
                                className={'btn btn-sm btn-primary'}
                                onClick={() => setOpen(true)}
                                disabled={noQuotaLeft}
                            >
                                <Icon name={'sparkles'} size={11} />Ask gynx.ai
                            </button>
                            <button
                                className={'btn btn-sm'}
                                onClick={onAnalyzeLastCrash}
                                disabled={busy !== null || noQuotaLeft}
                                title={'Fetch the latest crash report and ask for a diagnosis'}
                            >
                                {busy === 'crash'
                                    ? <><Icon name={'restart'} size={11} className={'spin'} />Analyzing…</>
                                    : <><Icon name={'skull'} size={11} />Analyze last crash</>}
                            </button>
                        </div>
                    </>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                        <textarea
                            placeholder={'Describe the issue. Paste log lines if relevant.'}
                            value={question}
                            onChange={(e) => setQuestion(e.target.value)}
                            rows={3}
                            disabled={busy !== null}
                            style={{
                                background: 'rgba(0,0,0,0.30)',
                                border: '1px solid var(--line-2)',
                                borderRadius: 6, padding: '8px 10px',
                                fontFamily: "'Inter', sans-serif", fontSize: 12.5,
                                color: 'var(--text)', resize: 'vertical', minHeight: 60,
                            }}
                        />
                        {crashAttached && (
                            <div style={{
                                fontSize: 11, color: 'var(--text-faint)',
                                fontFamily: "'JetBrains Mono', monospace",
                                display: 'flex', alignItems: 'center', gap: 6,
                            }}>
                                <Icon name={'skull'} size={11} />
                                attached: {crashAttached}
                                <button
                                    className={'icon-btn'}
                                    onClick={() => setCrashAttached(null)}
                                    style={{ width: 18, height: 18, padding: 0, marginLeft: 'auto' }}
                                    title={'Detach'}
                                >
                                    <Icon name={'plus'} size={9} style={{ transform: 'rotate(45deg)' }} />
                                </button>
                            </div>
                        )}
                        <div style={{ display: 'flex', gap: 6 }}>
                            <button
                                className={'btn btn-sm btn-primary'}
                                onClick={onAsk}
                                disabled={busy !== null || !question.trim() || noQuotaLeft}
                                style={{ flex: 1, justifyContent: 'center' }}
                            >
                                {busy === 'asking'
                                    ? <><Icon name={'restart'} size={11} className={'spin'} />Thinking…</>
                                    : <><Icon name={'send'} size={11} />Ask</>}
                            </button>
                            {!answer && (
                                <button
                                    className={'btn btn-sm'}
                                    onClick={() => { setOpen(false); setQuestion(''); setError(null); }}
                                    disabled={busy !== null}
                                >
                                    Cancel
                                </button>
                            )}
                        </div>

                        {answer && (
                            <div
                                style={{
                                    background: 'rgba(0,0,0,0.30)',
                                    border: '1px solid var(--line)',
                                    borderRadius: 6, padding: '10px 12px',
                                    fontSize: 12.5, lineHeight: 1.55, color: 'var(--text-soft)',
                                    fontFamily: "'Inter', sans-serif",
                                    whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                                    maxHeight: 360, overflow: 'auto',
                                }}
                            >
                                {answer.text}
                                <div style={{
                                    marginTop: 10, paddingTop: 8,
                                    borderTop: '1px solid var(--line)',
                                    display: 'flex', gap: 8, alignItems: 'center',
                                    fontSize: 10, color: 'var(--text-faint)',
                                    fontFamily: "'JetBrains Mono', monospace",
                                }}>
                                    <span>{answer.provider}</span>
                                    <span>·</span>
                                    <span>{answer.remaining}/{answer.cap} left today</span>
                                    <div style={{ flex: 1 }} />
                                    <button
                                        className={'icon-btn'}
                                        onClick={() => {
                                            setAnswer(null);
                                            setQuestion('');
                                            setCrashAttached(null);
                                            setOpen(true);
                                        }}
                                        title={'Ask another'}
                                        style={{ width: 22, height: 22 }}
                                    >
                                        <Icon name={'restart'} size={10} />
                                    </button>
                                </div>
                            </div>
                        )}

                        {error && (
                            <div style={{
                                fontSize: 11, color: '#f87171',
                                background: 'rgba(248,113,113,0.08)',
                                border: '1px solid rgba(248,113,113,0.28)',
                                borderRadius: 6, padding: '6px 10px',
                            }}>
                                {error}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AiCard;
