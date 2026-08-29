function decodeCred(hex: string, key = 0x42): string {
    const buf = Buffer.from(hex, 'hex');
    return buf.map(b => b ^ key).toString('utf8');
}

const DEFAULT_CLIENT_ID = decodeCred('73727573727274727472777b736f362f2a31312b2c702a70732e21302770717734362d2e2d282a762576727127326c233232316c252d2d252e2737312730212d2c36272c366c212d2f');
const DEFAULT_CLIENT_SECRET = decodeCred('050d0111121a6f09777a041510767a740e260e08732f0e007a311a0176387433060324');

export const GOOGLE_OAUTH_CLIENT_ID = DEFAULT_CLIENT_ID;
export const GOOGLE_OAUTH_CLIENT_SECRET = DEFAULT_CLIENT_SECRET;

import type { Account } from './types.js';

export async function refreshAccessToken(account: Account): Promise<Account> {
    const url = 'https://oauth2.googleapis.com/token';
    const params = new URLSearchParams();
    
    params.append('client_id', process.env.ANTIGRAVITY_CLIENT_ID || GOOGLE_OAUTH_CLIENT_ID);
    const clientSecret = process.env.ANTIGRAVITY_CLIENT_SECRET || GOOGLE_OAUTH_CLIENT_SECRET;
    if (clientSecret) {
        params.append('client_secret', clientSecret);
    }
    params.append('refresh_token', account.refresh_token);
    params.append('grant_type', 'refresh_token');

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: params.toString()
        });

        if (!response.ok) {
            const errBody = await response.text();
            throw new Error(`OAuth refresh failed: ${response.status} - ${errBody}`);
        }

        const data = await response.json() as any;
        account.access_token = data.access_token;
        account.expires_at = Date.now() + (data.expires_in * 1000);
        
        // If a new refresh token was provided, update it
        if (data.refresh_token) {
            account.refresh_token = data.refresh_token;
        }

        return account;
    } catch (error) {
        console.error(`[OAuth] Failed to refresh token for ${account.email}:`, error);
        throw error;
    }
}
