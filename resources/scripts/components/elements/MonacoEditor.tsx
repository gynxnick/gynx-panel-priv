import * as React from 'react';
import { useEffect, useRef } from 'react';
import Editor, { useMonaco, loader, OnMount } from '@monaco-editor/react';

/**
 * Gynx-themed Monaco editor — drop-in replacement for `CodemirrorEditor`.
 * Same prop shape so callers (FileEditPage) swap one import line and
 * everything else carries over. Monaco itself is loaded from the
 * `@monaco-editor/react` default CDN on first mount; no webpack plugin
 * required.
 *
 * Highlights:
 *   - `gynx-dark` theme registered once at module-load time matches the
 *     panel's void / purple / neon palette.
 *   - MIME -> language ID mapping covers the catalog formats; unknown
 *     types fall back to `plaintext`.
 *   - Ctrl/⌘+S registered as an editor action so the existing save
 *     keybinding from CodemirrorEditor still works.
 *   - `fetchContent` callback registers a getter the parent can call at
 *     save time, matching the CodemirrorEditor pattern.
 */

export interface MonacoEditorProps {
    style?: React.CSSProperties;
    /** Buffer to load into the editor on mount. */
    initialContent?: string;
    /** Used to derive the language when `mode` is unset. */
    filename?: string;
    /** MIME of the file content. Used to pick the Monaco language. */
    mode?: string;
    /** Parent registers its content-getter here for save-time reads. */
    fetchContent: (callback: () => Promise<string>) => void;
    /** Called when the user presses Ctrl/⌘+S inside the editor. */
    onContentSaved?: () => void;
    /** Called when the language changes (e.g. filename-based detection). */
    onModeChanged?: (mime: string) => void;
    /** Live content updates as the user types. */
    onChange?: (value: string) => void;
}

// MIME -> Monaco language id. Monaco ships a fixed set of language modes;
// the catalog formats all map cleanly (properties / ini both go to 'ini'
// since Monaco has no 'properties' language and the highlighting is
// near-identical for key=value pairs).
const LANG_FOR_MIME: Record<string, string> = {
    'text/x-properties': 'ini',
    'text/x-yaml': 'yaml',
    'text/x-toml': 'ini', // close enough for Monaco; better than plaintext
    'application/json': 'json',
    'application/xml': 'xml',
    'text/xml': 'xml',
    'text/x-sh': 'shell',
    'text/x-shellscript': 'shell',
    'text/x-dockerfile': 'dockerfile',
    'text/html': 'html',
    'text/css': 'css',
    'text/javascript': 'javascript',
    'application/javascript': 'javascript',
    'text/typescript': 'typescript',
    'text/markdown': 'markdown',
    'text/plain': 'plaintext',
};

// Filename-extension fallback when MIME isn't useful.
const LANG_FOR_EXT: Record<string, string> = {
    yml: 'yaml',
    yaml: 'yaml',
    json: 'json',
    toml: 'ini',
    xml: 'xml',
    ini: 'ini',
    properties: 'ini',
    conf: 'ini',
    cfg: 'ini',
    sh: 'shell',
    md: 'markdown',
    html: 'html',
    css: 'css',
    js: 'javascript',
    ts: 'typescript',
};

const languageFor = (mode?: string, filename?: string): string => {
    if (mode && LANG_FOR_MIME[mode]) return LANG_FOR_MIME[mode];
    if (filename) {
        const dot = filename.lastIndexOf('.');
        if (dot > 0) {
            const ext = filename.substring(dot + 1).toLowerCase();
            if (LANG_FOR_EXT[ext]) return LANG_FOR_EXT[ext];
        }
    }
    return 'plaintext';
};

const GYNX_THEME = 'gynx-dark';

// Gynx-themed Monaco palette. Defines once; defineTheme is idempotent so
// reload during dev hot-reload is fine.
const defineGynxTheme = (monaco: typeof import('monaco-editor')) => {
    monaco.editor.defineTheme(GYNX_THEME, {
        base: 'vs-dark',
        inherit: true,
        rules: [
            { token: 'comment', foreground: '6B7280', fontStyle: 'italic' },
            { token: 'keyword', foreground: '9B5BFF' },
            { token: 'string', foreground: '67E8F9' },
            { token: 'number', foreground: 'FBBF24' },
            { token: 'type', foreground: 'C4B5FD' },
            { token: 'tag', foreground: '9B5BFF' },
            { token: 'attribute.name', foreground: 'C4B5FD' },
            { token: 'attribute.value', foreground: '67E8F9' },
        ],
        colors: {
            'editor.background': '#0B0B0F',
            'editor.foreground': '#E5E7EB',
            'editorLineNumber.foreground': '#4B5563',
            'editorLineNumber.activeForeground': '#9CA3AF',
            'editor.lineHighlightBackground': '#14141C',
            'editor.selectionBackground': '#7C3AED44',
            'editorCursor.foreground': '#A78BFA',
            'editorWhitespace.foreground': '#1F2937',
            'editor.findMatchHighlightBackground': '#22D3EE33',
            'editor.findMatchBackground': '#7C3AED66',
            'editorIndentGuide.background1': '#1F2937',
            'editorIndentGuide.activeBackground1': '#374151',
        },
    });
};

// Use the default jsdelivr CDN. Override at app boot if you need to host
// Monaco assets internally.
loader.config({ 'vs/nls': { availableLanguages: { '*': 'en' } } });

const MonacoEditor: React.FC<MonacoEditorProps> = ({
    style,
    initialContent = '',
    filename,
    mode,
    fetchContent,
    onContentSaved,
    onModeChanged,
    onChange,
}) => {
    const monacoApi = useMonaco();
    const editorRef = useRef<Parameters<OnMount>[0] | null>(null);

    const language = languageFor(mode, filename);

    // Register the gynx theme + apply it whenever Monaco becomes available.
    useEffect(() => {
        if (!monacoApi) return;
        defineGynxTheme(monacoApi as typeof import('monaco-editor'));
        monacoApi.editor.setTheme(GYNX_THEME);
    }, [monacoApi]);

    // Emit a mode-changed callback when the language we derived from
    // filename differs from the prop the parent thinks is active.
    useEffect(() => {
        if (!onModeChanged) return;
        const target = mode || ({ ini: 'text/x-properties', yaml: 'text/x-yaml', json: 'application/json', xml: 'application/xml', plaintext: 'text/plain' } as Record<string, string>)[language] || 'text/plain';
        if (target !== mode) onModeChanged(target);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [language]);

    const handleMount: OnMount = (editor, monaco) => {
        editorRef.current = editor;

        // Re-apply theme (covers the case where useMonaco hadn't fired yet).
        defineGynxTheme(monaco as typeof import('monaco-editor'));
        monaco.editor.setTheme(GYNX_THEME);

        // Save shortcut — registers as an editor action so it shows up in
        // the command palette too.
        editor.addAction({
            id: 'gynx-save',
            label: 'Save',
            keybindings: [
                monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS,
            ],
            run: () => {
                onContentSaved?.();
            },
        });

        // Hand the value-getter to the parent (parity with CodemirrorEditor).
        fetchContent(() => Promise.resolve(editor.getValue()));
    };

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 0, ...style }}>
            <Editor
                defaultValue={initialContent}
                defaultLanguage={language}
                language={language}
                theme={GYNX_THEME}
                onMount={handleMount}
                onChange={(v) => onChange?.(v ?? '')}
                options={{
                    automaticLayout: true,
                    fontFamily: '"JetBrains Mono", ui-monospace, monospace',
                    fontSize: 13.5,
                    fontLigatures: true,
                    minimap: { enabled: false },
                    scrollBeyondLastLine: false,
                    smoothScrolling: true,
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                    renderLineHighlight: 'all',
                    roundedSelection: true,
                    tabSize: 2,
                    wordWrap: 'on',
                    wrappingIndent: 'indent',
                    bracketPairColorization: { enabled: true },
                    guides: { indentation: true, bracketPairs: true },
                    padding: { top: 12, bottom: 12 },
                    scrollbar: { verticalScrollbarSize: 10, horizontalScrollbarSize: 10 },
                }}
            />
        </div>
    );
};

export default MonacoEditor;
