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

// ---- helpers --------------------------------------------------------------

const offsetToLine = (content: string, offset: number): number => {
    let line = 1;
    for (let i = 0; i < offset && i < content.length; i++) {
        if (content[i] === '\n') line++;
    }
    return line;
};
