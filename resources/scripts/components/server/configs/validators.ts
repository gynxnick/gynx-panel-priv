import { ConfigFormat } from './known-configs';

export interface ValidationError {
    line: number;
    message: string;
    severity: 'error' | 'warn';
}

/** Validate `content` for a given format. Returns an empty array on clean input. */
export const validate = (content: string, format: ConfigFormat): ValidationError[] => {
    switch (format) {
        case 'json': return validateJson(content);
        case 'properties': return validateProperties(content);
        case 'yaml': return validateYamlLite(content);
        case 'toml': return validateTomlLite(content);
        case 'ini': return validateIni(content);
        case 'xml': return validateXmlLite(content);
        default: return [];
    }
};

// ---- JSON ------------------------------------------------------------------

const validateJson = (content: string): ValidationError[] => {
    if (content.trim() === '') return [];
    try {
        JSON.parse(content);
        return [];
    } catch (e: any) {
        const msg = String(e?.message ?? 'Invalid JSON');
        // V8 messages carry the offset as "at position N"; translate to a line.
        const m = /position\s+(\d+)/.exec(msg);
        const line = m ? offsetToLine(content, parseInt(m[1], 10)) : 1;
        return [{ line, message: msg, severity: 'error' }];
    }
};

// ---- .properties ----------------------------------------------------------

const validateProperties = (content: string): ValidationError[] => {
    const errors: ValidationError[] = [];
    content.split(/\r?\n/).forEach((raw, i) => {
        const line = raw.trimStart();
        if (line === '' || line.startsWith('#') || line.startsWith('!')) return;
        if (!line.includes('=') && !line.includes(':')) {
            errors.push({
                line: i + 1,
                message: 'Expected a key=value entry (or a #/! comment)',
                severity: 'error',
            });
        }
    });
    return errors;
};

// ---- YAML (lightweight — we don't bundle js-yaml) ------------------------

const validateYamlLite = (content: string): ValidationError[] => {
    const errors: ValidationError[] = [];
    content.split(/\r?\n/).forEach((line, i) => {
        // Hard-tab indentation is a common YAML gotcha.
        if (/^\t/.test(line)) {
            errors.push({
                line: i + 1,
                message: 'YAML does not allow tab indentation — use spaces',
                severity: 'error',
            });
        }
        // Unclosed quoted strings are easy to spot: a line that starts with
        // `key:` but ends with an odd number of unescaped quote characters.
        const afterColon = line.split(':').slice(1).join(':');
        if (afterColon) {
            const quotes = (afterColon.match(/(?<!\\)"/g) || []).length;
            if (quotes % 2 === 1) {
                errors.push({
                    line: i + 1,
                    message: 'Unclosed double-quoted string',
                    severity: 'warn',
                });
            }
        }
    });
    return errors;
};

// ---- TOML (lightweight) ---------------------------------------------------

const validateTomlLite = (content: string): ValidationError[] => {
    const errors: ValidationError[] = [];
    let inMultilineString = false;
    content.split(/\r?\n/).forEach((raw, i) => {
        const trimmed = raw.trim();
        if (trimmed === '' || trimmed.startsWith('#')) return;

        // Balance triple-quoted multiline strings.
        const tripleOccurrences = (raw.match(/"""/g) || []).length;
        if (tripleOccurrences % 2 === 1) inMultilineString = !inMultilineString;
        if (inMultilineString) return;

        // Section headers: [name] or [[name]] — brackets must match.
        if (trimmed.startsWith('[')) {
            const opens = (trimmed.match(/\[/g) || []).length;
            const closes = (trimmed.match(/]/g) || []).length;
            if (opens !== closes) {
                errors.push({ line: i + 1, message: 'Unbalanced [ ] in table header', severity: 'error' });
            }
            return;
        }

        // Everything else should be key = value.
        if (!trimmed.includes('=')) {
            errors.push({ line: i + 1, message: 'Expected a key = value entry', severity: 'error' });
        }
    });
    return errors;
};

// ---- INI / CFG (ARK, Palworld, Unreal-style) ------------------------------
// Lenient: INI files in the wild carry exotic value syntax (ARK's
// OverrideNamedEngramEntries=(...), arrays, quoted blobs). We only flag the
// genuinely-broken shape — a non-comment, non-section line with no '=' — and
// only as a warning so a valid-but-unusual file never reads as "invalid".

const validateIni = (content: string): ValidationError[] => {
    const errors: ValidationError[] = [];
    content.split(/\r?\n/).forEach((raw, i) => {
        const line = raw.trim();
        if (line === '' || line.startsWith(';') || line.startsWith('#')) return;
        if (line.startsWith('[') && line.endsWith(']')) return; // [section]
        if (!line.includes('=')) {
            errors.push({
                line: i + 1,
                message: 'Expected a [section], key=value, or ; comment',
                severity: 'warn',
            });
        }
    });
    return errors;
};

// ---- XML (7 Days to Die serverconfig.xml, etc.) ---------------------------
// Lightweight well-formedness: strip comments/declarations/CDATA, then walk
// the remaining tags keeping an open-tag stack. Reports unclosed or
// mismatched tags. Not a full parser — enough to catch the typos that stop a
// server booting without false-flagging valid markup.

const validateXmlLite = (content: string): ValidationError[] => {
    const errors: ValidationError[] = [];

    // Blank out the bits that legitimately contain angle-brackets so they
    // don't confuse the tag walk (keep length/newlines for line numbers).
    const blank = (s: string) => s.replace(/[^\n]/g, ' ');
    const cleaned = content
        .replace(/<!--[\s\S]*?-->/g, blank)
        .replace(/<!\[CDATA\[[\s\S]*?]]>/g, blank)
        .replace(/<\?[\s\S]*?\?>/g, blank)
        .replace(/<![^>]*>/g, blank);

    const stack: { name: string; offset: number }[] = [];
    const tagRe = /<(\/?)([a-zA-Z_][\w:.-]*)([^>]*?)(\/?)>/g;
    let m: RegExpExecArray | null;
    while ((m = tagRe.exec(cleaned)) !== null) {
        const [, closing, name, , selfClose] = m;
        if (closing) {
            const top = stack.pop();
            if (!top) {
                errors.push({ line: offsetToLine(content, m.index), message: `Unexpected closing </${name}>`, severity: 'error' });
            } else if (top.name !== name) {
                errors.push({ line: offsetToLine(content, m.index), message: `Mismatched tag: expected </${top.name}>, found </${name}>`, severity: 'error' });
            }
        } else if (!selfClose) {
            stack.push({ name, offset: m.index });
        }
    }
    for (const open of stack) {
        errors.push({ line: offsetToLine(content, open.offset), message: `Unclosed <${open.name}> tag`, severity: 'error' });
    }

    return errors.slice(0, 20);
};

// ---- helpers --------------------------------------------------------------

const offsetToLine = (content: string, offset: number): number => {
    let line = 1;
    for (let i = 0; i < offset && i < content.length; i++) {
        if (content[i] === '\n') line++;
    }
    return line;
};
