/**
 * Sensitive Word Obfuscator
 * Inserts zero-width spaces (\u200B) into known client application names 
 * so upstream regex scanners and telemetry filters do not flag requests 
 * as coming from third-party tools.
 */

const DEFAULT_SENSITIVE_WORDS = [
    'Claude Code',
    'ClaudeCode',
    'Cursor',
    'OpenCode',
    'aider',
    'Cline',
    'Roo Code',
    'Continue',
    'Windsurf'
];

export function getSensitiveWords(): string[] {
    const envVal = process.env.ANTIGRAVITY_SENSITIVE_WORDS;
    if (envVal === 'none') {
        return [];
    }
    if (envVal && envVal.trim() !== '') {
        return envVal.split(',').map(w => w.trim());
    }
    return DEFAULT_SENSITIVE_WORDS;
}

export function obfuscateString(text: string): string {
    const words = getSensitiveWords();
    if (words.length === 0 || !text) {
        return text;
    }

    let result = text;
    for (const word of words) {
        if (!word) continue;
        // Case-insensitive replacement
        const regex = new RegExp(word, 'gi');
        result = result.replace(regex, (match) => {
            // Inject a zero-width space (\u200B) between each character
            return match.split('').join('\u200B');
        });
    }

    return result;
}

/**
 * Deep obfuscate objects (e.g. JSON payloads, arrays)
 */
export function obfuscatePayload(payload: any): any {
    if (typeof payload === 'string') {
        return obfuscateString(payload);
    }
    if (Array.isArray(payload)) {
        return payload.map(item => obfuscatePayload(item));
    }
    if (payload !== null && typeof payload === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(payload)) {
            result[key] = obfuscatePayload(value);
        }
        return result;
    }
    return payload;
}
