import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as crypto from 'crypto';
import type { AccountsConfig, Account } from './types.js';

/**
 * Resolves the configuration directory for ZeroGravity-style proxy accounts.
 */
export function getAccountsConfigDir(): string {
    if (process.env.ANTIGRAVITY_CONFIG_DIR) {
        return process.env.ANTIGRAVITY_CONFIG_DIR;
    }
    const home = os.homedir();
    if (process.platform === 'win32') {
        return path.join(process.env.APPDATA || path.join(home, 'AppData', 'Roaming'), 'antigravity-client');
    }
    if (process.platform === 'darwin') {
        return path.join(home, 'Library', 'Application Support', 'antigravity-client');
    }
    return path.join(home, '.config', 'antigravity-client');
}

export function getAccountsFilePath(): string {
    return path.join(getAccountsConfigDir(), 'accounts.json');
}

export class AccountsStore {
    private configPath: string;

    constructor(configPath?: string) {
        this.configPath = configPath || getAccountsFilePath();
    }

    public load(): AccountsConfig {
        if (!fs.existsSync(this.configPath)) {
            return this.createDefaultConfig();
        }

        try {
            const raw = fs.readFileSync(this.configPath, 'utf8');
            const data = JSON.parse(raw) as Partial<AccountsConfig>;
            
            // Migrate / ensure defaults
            const config: AccountsConfig = {
                accounts: data.accounts || [],
                active: data.active,
                device_fingerprint: data.device_fingerprint || crypto.randomUUID(),
            };

            // If device fingerprint was missing, save the newly generated one
            if (!data.device_fingerprint) {
                this.save(config);
            }

            return config;
        } catch (err) {
            console.error(`[AccountsStore] Failed to read accounts config: ${err}`);
            return this.createDefaultConfig();
        }
    }

    public save(config: AccountsConfig): void {
        const dir = path.dirname(this.configPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2), 'utf8');
    }

    private createDefaultConfig(): AccountsConfig {
        return {
            accounts: [],
            device_fingerprint: crypto.randomUUID(),
        };
    }
}
