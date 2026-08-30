import { AccountsStore } from './store.js';
import { refreshAccessToken } from './oauth.js';
import { getOAuthTokenInfo } from '../server/auth-reader.js';
import type { Account } from './types.js';

export class AccountRotator {
    private store: AccountsStore;
    private consecutiveFailures = 0;
    private maxFailures = 3;

    constructor(store: AccountsStore) {
        this.store = store;
    }

    public async getActiveAccount(): Promise<Account | null> {
        const config = this.store.load();
        if (config.accounts.length === 0) return null;

        let activeAccount = config.accounts.find(a => a.email === config.active);
        
        // If no active account is set or the active one is disabled, pick the first enabled one
        if (!activeAccount || activeAccount.disabled) {
            activeAccount = config.accounts.find(a => !a.disabled);
            if (activeAccount) {
                config.active = activeAccount.email;
                this.store.save(config);
            } else {
                return null;
            }
        }

        // Check if token needs refresh (less than 5 minutes to expiry)
        const now = Date.now();
        if (!activeAccount.access_token || !activeAccount.expires_at || (activeAccount.expires_at - now) < 5 * 60 * 1000) {
            // 1. First attempt to sync directly from local Antigravity LS / Desktop App state
            try {
                const localInfo = getOAuthTokenInfo();
                if (localInfo && localInfo.accessToken && (!localInfo.refreshToken || localInfo.refreshToken === activeAccount.refresh_token)) {
                    activeAccount.access_token = localInfo.accessToken;
                    if (localInfo.expiry?.seconds) {
                        activeAccount.expires_at = Number(localInfo.expiry.seconds) * 1000;
                    }
                    this.store.save(config);
                    return activeAccount;
                }
            } catch {
                // Fall through if local reader fails
            }

            // 2. Secondary fallback for offline/imported standalone accounts
            try {
                activeAccount = await refreshAccessToken(activeAccount);
                this.store.save(config); // Save the refreshed token
            } catch (err) {
                console.error(`[Rotator] Failed to refresh token for active account, marking as disabled`);
                activeAccount.disabled = true;
                this.store.save(config);
                return this.rotateAccount();
            }
        }

        return activeAccount;
    }

    public async reportFailure(statusCode: number): Promise<void> {
        if (statusCode === 403) {
            console.warn(`[Rotator] Received 403 PERMISSION_DENIED. Rotating immediately.`);
            this.consecutiveFailures = 0;
            await this.rotateAccount();
        } else if (statusCode === 429) {
            this.consecutiveFailures++;
            console.warn(`[Rotator] Received 429 RESOURCE_EXHAUSTED. Failure ${this.consecutiveFailures}/${this.maxFailures}`);
            if (this.consecutiveFailures >= this.maxFailures) {
                console.warn(`[Rotator] Max consecutive 429 failures reached. Rotating...`);
                this.consecutiveFailures = 0;
                await this.rotateAccount();
            }
        } else {
            // Reset on success or other errors
            this.consecutiveFailures = 0;
        }
    }

    public reportSuccess(): void {
        this.consecutiveFailures = 0;
    }

    public async rotateAccount(): Promise<Account | null> {
        const config = this.store.load();
        if (config.accounts.length <= 1) {
            console.warn(`[Rotator] Cannot rotate, only ${config.accounts.length} account(s) available.`);
            return null;
        }

        const enabledAccounts = config.accounts.filter(a => !a.disabled);
        if (enabledAccounts.length === 0) return null;

        const currentIndex = enabledAccounts.findIndex(a => a.email === config.active);
        const nextIndex = (currentIndex + 1) % enabledAccounts.length;
        const nextAccount = enabledAccounts[nextIndex];

        console.info(`[Rotator] Rotating from ${config.active} to ${nextAccount.email}`);
        config.active = nextAccount.email;
        this.store.save(config);

        // Apply randomized jitter (5-10s) as per stealth requirements
        const jitterMs = Math.floor(Math.random() * 5000) + 5000;
        console.info(`[Rotator] Applying cooldown jitter of ${jitterMs}ms before activating...`);
        await new Promise(resolve => setTimeout(resolve, jitterMs));

        return this.getActiveAccount();
    }
}
