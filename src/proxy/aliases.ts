import * as fs from 'fs';
import * as path from 'path';
import { getAccountsConfigDir } from '../accounts/store.js';

export interface ModelAliases {
    [alias: string]: string;
}

export function loadAliases(): ModelAliases {
    let aliases: ModelAliases = {};

    // 1. Check default aliases file
    const aliasFile = path.join(getAccountsConfigDir(), 'aliases.json');
    if (fs.existsSync(aliasFile)) {
        try {
            const data = fs.readFileSync(aliasFile, 'utf8');
            aliases = JSON.parse(data);
        } catch (err) {
            console.error(`[Aliases] Failed to parse aliases.json: ${err}`);
        }
    }

    // 2. Override with env vars (e.g. "gpt-4o:gemini-3-flash,opus-4.6:gemini-3.1-pro")
    const envVar = process.env.ANTIGRAVITY_MODEL_ALIASES;
    if (envVar) {
        const pairs = envVar.split(',');
        for (const pair of pairs) {
            const [alias, target] = pair.split(':');
            if (alias && target) {
                aliases[alias.trim()] = target.trim();
            }
        }
    }

    return aliases;
}

export function resolveModel(model: string): string {
    const aliases = loadAliases();
    // Default compatibility aliases
    const builtInAliases: ModelAliases = {
        'gpt-4o': 'gemini-3-flash',
        'gpt-4': 'gemini-3.1-pro',
        'opus-4.6': 'gemini-3.1-pro',
        'claude-3-5-sonnet': 'gemini-3-flash',
        'sonnet-4.6': 'gemini-3-flash'
    };
    
    if (aliases[model]) return aliases[model];
    if (builtInAliases[model]) return builtInAliases[model];
    
    return model;
}

export function saveAliases(aliases: ModelAliases): void {
    const aliasFile = path.join(getAccountsConfigDir(), 'aliases.json');
    const dir = path.dirname(aliasFile);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(aliasFile, JSON.stringify(aliases, null, 2), 'utf8');
}
