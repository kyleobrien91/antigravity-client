export const GOOGLE_OAUTH_CLIENT_ID = '45471411055-orntvc23415c4l2d338n5k2t69h4p5a7.apps.googleusercontent.com'; // Antigravity (or similar known client ID)
export const GOOGLE_OAUTH_CLIENT_SECRET = 'GOCSPX-...'; // often Native Apps have no secret, or a known secret

import type { Account } from './types.js';

export async function refreshAccessToken(account: Account): Promise<Account> {
    const url = 'https://oauth2.googleapis.com/token';
    const params = new URLSearchParams();
    
    // We try generic native app client id, some don't require secret for PKCE/native
    // Or we use the exact ones from Antigravity open source clones
    params.append('client_id', process.env.ANTIGRAVITY_CLIENT_ID || '45471411055-orntvc23415c4l2d338n5k2t69h4p5a7.apps.googleusercontent.com');
    if (process.env.ANTIGRAVITY_CLIENT_SECRET) {
        params.append('client_secret', process.env.ANTIGRAVITY_CLIENT_SECRET);
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
