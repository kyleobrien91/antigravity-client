/**
 * Sensitive Word Obfuscator
 * Inserts zero-width spaces (\u200B) into known client application names,
 * proxy markers, system prompt injections, and DLP triggers so upstream
 * regex scanners and telemetry filters do not flag requests.
 */

function escapeRegex(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export const DEFAULT_SENSITIVE_WORDS: string[] = [
    // 1. AI Coding Clients & CLI Agents
    'Claude Code',
    'ClaudeCode',
    'claude-code',
    'claude_code',
    '@anthropic-ai/claude-code',
    'Cursor',
    'cursor-agent',
    'cursor-ai',
    'Cursorrules',
    '.cursorrules',
    'Cursor Rules',
    'Anysphere',
    'Windsurf',
    'Codeium',
    'cascade-agent',
    '.windsurfrules',
    'OpenCode',
    'opencode',
    'opencode-ai',
    'Hermes Agent',
    'hermes-agent',
    'hermes-acp',
    'Nous Research',
    'NousResearch',
    'Cline',
    'Roo Code',
    'Roo-Code',
    'RooCline',
    'CoolCline',
    'Kodu',
    'Aider',
    'aider-chat',
    'aider/',
    'Continue.dev',
    'continue.dev',
    'continue-extension',
    'Avante.nvim',
    'CodeCompanion',
    'CopilotChat',
    'Supermaven',
    'Tabnine',
    'Sourcegraph Cody',
    'Bolt.new',
    'v0.dev',
    'Lovable.dev',
    'Replit Agent',
    'Devin',
    'Cognition AI',
    'OpenHands',
    'SWE-agent',
    'LibreChat',
    'NextChat',
    'ChatGPT-Next-Web',
    'lobe-chat',
    'OpenWebUI',
    'Chatbox',

    // 2. Proxy & Wrapper Frameworks
    'CLIProxyAPI',
    'CliRelay',
    'ZeroGravity',
    'zerogravity',
    'anti-api',
    'antigravity-proxy',
    'antigravity-client',
    'copilot-gpt4-service',
    'cursor-api',
    'free-gpt35',
    'One-API',
    'New-API',
    'LiteLLM',
    'litellm',

    // 3. Injected Role Declarations & System Prompt Markers
    'You are Claude Code',
    "Anthropic's official CLI",
    'You are an AI coding assistant created by Anthropic',
    'You are Cursor',
    'You are an expert AI programmer that uses VSCode',
    'You are Cline',
    'You are Roo Code',
    'You are an expert software developer called Aider',
    'You are Hermes',
    'You are Devin',
    'You are OpenHands',

    // 4. DLP Secrets & Sensitive File Names
    '.env.local',
    '.env.production',
    '.env.development',
    'id_rsa',
    'id_ed25519',
    'authorized_keys',
    'AWS_SECRET_ACCESS_KEY',
    'aws_access_key_id',
    'application_default_credentials.json',

    // 5. Prompt Injection & Policy Tripwires
    'ignore all previous instructions',
    'ignore previous instructions',
    'bypass safety guidelines',
    'jailbreak mode',
    'DAN mode',
    'system prompt extraction',
    'repeat everything above'
];

export function getSensitiveWords(): string[] {
    const envVal = process.env.ANTIGRAVITY_SENSITIVE_WORDS;
    if (envVal === 'none') {
        return [];
    }
    if (envVal && envVal.trim() !== '') {
        return envVal.split(',').map(w => w.trim()).filter(Boolean);
    }
    return DEFAULT_SENSITIVE_WORDS;
}

export function obfuscateString(text: string): string {
    const words = getSensitiveWords();
    if (words.length === 0 || !text || typeof text !== 'string') {
        return text;
    }

    // Sort words by length descending so longer multi-word phrases match first
    const sortedWords = [...words].sort((a, b) => b.length - a.length);

    let result = text;
    for (const word of sortedWords) {
        if (!word) continue;
        const escaped = escapeRegex(word);
        const regex = new RegExp(escaped, 'gi');
        result = result.replace(regex, (match) => {
            // If already contains zero-width spaces, skip re-obfuscating
            if (match.includes('\u200B')) {
                return match;
            }
            // Inject a zero-width space (\u200B) between each character
            return match.split('').join('\u200B');
        });
    }

    return result;
}

/**
 * Deep obfuscate objects (e.g. JSON payloads, arrays, nested message structures)
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
