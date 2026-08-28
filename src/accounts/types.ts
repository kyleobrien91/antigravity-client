export interface Account {
    email: string;
    refresh_token: string;
    access_token?: string;
    expires_at?: number; // timestamp in ms
    extracted_at?: string;
    disabled?: boolean;
    quota_usage?: number; // Tracking estimated or reported quota usage (0.0 to 1.0)
    alias?: string;
}

export interface AccountsConfig {
    accounts: Account[];
    active?: string; // The email of the currently active account
    device_fingerprint?: string; // UUID for stealth device fingerprinting
}
