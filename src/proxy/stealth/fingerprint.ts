import { AccountsStore } from '../../accounts/store.js';

export function getDeviceFingerprint(): string {
    if (process.env.ANTIGRAVITY_DEVICE_FINGERPRINT) {
        return process.env.ANTIGRAVITY_DEVICE_FINGERPRINT;
    }
    const store = new AccountsStore();
    const config = store.load();
    return config.device_fingerprint || '00000000-0000-0000-0000-000000000000';
}

export function getIdeVersion(): string {
    return process.env.ANTIGRAVITY_IDE_VERSION || '1.107.0';
}

export function getExtensionVersion(): string {
    return process.env.ANTIGRAVITY_EXTENSION_VERSION || '0.2.0';
}
