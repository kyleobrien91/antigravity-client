import { getOAuthTokenInfo } from '../../server/auth-reader.js';
import { AccountsStore } from '../../accounts/store.js';
import type { Account } from '../../accounts/types.js';
import crypto from 'crypto';

export async function runExtract() {
    console.log('[Extract] Attempting to extract tokens from Antigravity IDE / Desktop app...');
    
    const info = getOAuthTokenInfo();
    if (!info || !info.refreshToken) {
        console.error('❌ Failed to extract token. Make sure you are logged into the official Antigravity app.');
        process.exit(1);
    }

    const store = new AccountsStore();
    const config = store.load();

    // The auth-reader doesn't directly expose email reliably, but we can store a placeholder or use the legacy cache
    // Let's use a dummy email if we can't find one, or prompt for it
    const email = process.env.ANTIGRAVITY_ACCOUNT_EMAIL || `extracted-${Date.now()}@local`;

    const newAccount: Account = {
        email: email,
        refresh_token: info.refreshToken,
        access_token: info.accessToken,
        expires_at: info.expiry ? Number(info.expiry.seconds) * 1000 : undefined,
        extracted_at: new Date().toISOString()
    };

    const existing = config.accounts.find(a => a.refresh_token === info.refreshToken);
    if (existing) {
        console.log(`ℹ️ Token already exists in accounts.json for ${existing.email}. Updating...`);
        Object.assign(existing, newAccount);
    } else {
        config.accounts.push(newAccount);
        console.log(`✅ Extracted new token into accounts.json as ${email}.`);
    }

    if (!config.active) {
        config.active = email;
    }

    store.save(config);
    console.log(`✅ Extraction complete. Device fingerprint: ${config.device_fingerprint}`);
}
