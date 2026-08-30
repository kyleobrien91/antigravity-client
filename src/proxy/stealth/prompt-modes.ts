/**
 * System Prompt Modes
 * Controls how the proxy handles the upstream Antigravity system prompt.
 * 
 * - `native`: Retains official AG instructions, bidirectional tool mapping.
 * - `stealth`: Strips AG identity, injects client tools/prompts.
 * - `minimal`: Replaces prompt entirely.
 */

export type SystemMode = 'native' | 'stealth' | 'minimal';

export function getSystemMode(): SystemMode {
    const mode = process.env.ANTIGRAVITY_SYSTEM_MODE;
    if (mode === 'stealth' || mode === 'minimal') {
        return mode;
    }
    return 'native';
}

/**
 * Transforms the user/system prompt payload based on the active mode.
 */
export function transformPrompt(originalClientMessages: any[], upstreamSystemContext: string | null = null): any[] {
    const mode = getSystemMode();
    const messages = [...originalClientMessages];

    if (mode === 'native') {
        // In native mode, we keep the upstream system context if available, 
        // or we expect the LS to inject it. We do NOT strip tools.
        // We just pass the user messages forward (obfuscated).
        return messages;
    }

    if (mode === 'stealth') {
        // In stealth mode, we inject the client's system prompt and strip out AG specific markers.
        // E.g., remove references to "You are Antigravity".
        return messages.map(m => {
            if (m.role === 'system' && typeof m.content === 'string') {
                return { ...m, content: m.content.replace(/Antigravity/gi, 'Assistant') };
            }
            return m;
        });
    }

    if (mode === 'minimal') {
        // Remove system messages or compress them drastically
        return messages.filter(m => m.role !== 'system');
    }

    return messages;
}
