/**
 * Auth Reader - Reads authentication data from Antigravity's state.vscdb
 *
 * Provides OAuth tokens and USS data needed by the Mock Extension Server
 * and the Launcher to authenticate independent LS instances.
 */
import { homedir } from "os";
import * as path from "path";
import * as fs from "fs";
import { execFileSync } from "child_process";
import { Topic } from "../gen/exa/unified_state_sync_pb/unified_state_sync_pb.js";
import { OAuthTokenInfo } from "../gen/exa/language_server_pb/language_server_pb.js";

/**
 * Per-OS base directory that holds VSCode-style app profiles (…/<AppName>/User/…).
 */
function profileBaseDir(): string {
    return process.platform === "darwin"
        ? path.join(homedir(), "Library", "Application Support")
        : process.platform === "win32"
        ? (process.env.APPDATA || path.join(homedir(), "AppData", "Roaming"))
        : path.join(homedir(), ".config");
}

/**
 * Candidate state.vscdb paths, in preference order.
 *
 * Antigravity ships as two products that store auth in SEPARATE profile folders:
 *   - "Antigravity"      → the standalone app (Electron, productName "Antigravity")
 *   - "Antigravity IDE"  → the IDE (VSCode fork, nameShort "Antigravity IDE")
 * A user may be logged into either, so we probe both on every platform.
 */
function stateDbCandidates(): string[] {
    const candidates: string[] = [];
    const base = profileBaseDir();
    candidates.push(
        path.join(base, "Antigravity", "User", "globalStorage", "state.vscdb"),
        path.join(base, "Antigravity IDE", "User", "globalStorage", "state.vscdb"),
    );

    // If running in WSL (or Linux with /mnt/c available), also check Windows host AppData
    if (process.platform === "linux") {
        const mntBase = "/mnt/c/Users";
        if (fs.existsSync(mntBase)) {
            try {
                const users = fs.readdirSync(mntBase);
                for (const u of users) {
                    candidates.push(
                        path.join(mntBase, u, "AppData", "Roaming", "Antigravity", "User", "globalStorage", "state.vscdb"),
                        path.join(mntBase, u, "AppData", "Roaming", "Antigravity IDE", "User", "globalStorage", "state.vscdb"),
                    );
                }
            } catch {
                // Ignore permission or readdir errors
            }
        }
    }

    // If running on Windows (or Windows Node invoked from WSL where APPDATA may differ)
    if (process.platform === "win32") {
        if (process.env.USERPROFILE) {
            candidates.push(
                path.join(process.env.USERPROFILE, "AppData", "Roaming", "Antigravity", "User", "globalStorage", "state.vscdb"),
                path.join(process.env.USERPROFILE, "AppData", "Roaming", "Antigravity IDE", "User", "globalStorage", "state.vscdb"),
            );
        }
    }

    return Array.from(new Set(candidates));
}

/**
 * Query a key from state.vscdb using better-sqlite3 with python3/sqlite3 fallbacks.
 */
function queryStateDb(dbPath: string, key: string): string | null {
    if (!fs.existsSync(dbPath)) return null;

    // 1. Try better-sqlite3
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const Database = require("better-sqlite3");
        const db = new Database(dbPath, { readonly: true });
        try {
            const row = db.prepare("SELECT value FROM ItemTable WHERE key=?").get(key) as { value: string } | undefined;
            if (row && typeof row.value === "string") return row.value;
        } finally {
            db.close();
        }
    } catch {
        // better-sqlite3 native bindings missing or failed, fall back
    }

    // 2. Fallback: query via python3/python
    const pyCommands = process.platform === "win32" ? ["python", "python3"] : ["python3", "python"];
    for (const cmd of pyCommands) {
        try {
            const script = `import sqlite3, sys; con = sqlite3.connect(sys.argv[1]); cur = con.cursor(); cur.execute("SELECT value FROM ItemTable WHERE key=?", (sys.argv[2],)); r = cur.fetchone(); print(r[0] if r else "", end="")`;
            const res = execFileSync(cmd, ["-c", script, dbPath, key], { encoding: "utf8", timeout: 3000, stdio: ["ignore", "pipe", "ignore"] });
            if (res && res.length > 0) return res;
        } catch {
            // Next python command
        }
    }

    // 3. Fallback: query via sqlite3 CLI
    try {
        const res = execFileSync("sqlite3", [dbPath, `SELECT value FROM ItemTable WHERE key='${key}';`], { encoding: "utf8", timeout: 3000, stdio: ["ignore", "pipe", "ignore"] });
        if (res && res.trim().length > 0) return res.trim();
    } catch {
        // sqlite3 CLI not found
    }

    return null;
}

/** True if this DB holds a non-empty OAuth token (the real, durable credential). */
function dbHasOAuthToken(dbPath: string): boolean {
    try {
        const raw = queryStateDb(dbPath, "antigravityUnifiedStateSync.oauthToken");
        if (!raw) return false;
        const topic = Topic.fromBinary(Buffer.from(raw, "base64"));
        const entry = topic.data.find(e => e.key === "oauthTokenInfoSentinelKey");
        return !!entry?.value?.value;
    } catch {
        return false;
    }
}

/**
 * Resolve which state.vscdb to read.
 * Priority: AG_STATE_DB override → first candidate that actually has an OAuth token
 * → first candidate that exists → the standalone path (so errors stay meaningful).
 */
function resolveStateDbPath(): string {
    const override = process.env.AG_STATE_DB?.trim();
    if (override) return override;
    const candidates = stateDbCandidates();
    return (
        candidates.find(p => fs.existsSync(p) && dbHasOAuthToken(p)) ??
        candidates.find(p => fs.existsSync(p)) ??
        candidates[0]
    );
}

export interface UssOAuthData {
    key: string;      // USS data map key (e.g. "oauthTokenInfoSentinelKey")
    value: string;    // Base64-encoded OAuthTokenInfo protobuf
}

export interface AuthData {
    apiKey: string;        // Google OAuth access token (ya29.xxx)
    email: string;
    name: string;
    ussOAuth: UssOAuthData;
}

/**
 * Read the standalone Antigravity app's convenience cache (`antigravityAuthStatus`).
 *
 * NOTE: this key is written ONLY by the standalone Antigravity app, not by the
 * Antigravity IDE (VSCode fork). Its `apiKey` is a short-lived `ya29.` access
 * token cached as a side-effect — it may be absent (IDE profile) or expired. It
 * is therefore NOT a reliable auth source; we use it only as a best-effort source
 * of email/name. The authoritative credential is the OAuth token (see below).
 */
function readLegacyAuthStatus(): { apiKey: string; email: string; name: string } {
    try {
        const raw = queryStateDb(resolveStateDbPath(), "antigravityAuthStatus");
        if (!raw) return { apiKey: "", email: "", name: "" };
        const parsed = JSON.parse(raw);
        return {
            apiKey: parsed.apiKey || "",
            email: parsed.email || "",
            name: parsed.name || "",
        };
    } catch {
        return { apiKey: "", email: "", name: "" };
    }
}

interface KeyringItem {
    label?: string;
    attributes?: {
        service?: string;
        username?: string;
    };
    secret?: string;
}

interface KeyringGeminiSecret {
    token?: {
        access_token?: string;
        refresh_token?: string;
        expiry?: string;
    };
    email?: string;
    name?: string;
    auth_method?: string;
}

/**
 * Reads token from Linux Desktop App's keyring_store.json (GNOME Libsecret fallback file).
 */
export function readLinuxKeyringToken(): OAuthTokenInfo | null {
    const candidateDirs = [
        path.join(homedir(), ".config", "Antigravity"),
        path.join(homedir(), ".config", "Antigravity IDE"),
    ];

    for (const dir of candidateDirs) {
        const kp = path.join(dir, "keyring_store.json");
        if (!fs.existsSync(kp)) continue;
        try {
            const raw = fs.readFileSync(kp, "utf8");
            const data: Record<string, KeyringItem> = JSON.parse(raw);
            for (const item of Object.values(data)) {
                if (item?.attributes?.service === "gemini" && typeof item.secret === "string") {
                    let jsonStr = item.secret;
                    // If secret is hex-encoded (standard in libsecret file backend)
                    if (/^[0-9a-fA-F]+$/.test(item.secret)) {
                        jsonStr = Buffer.from(item.secret, "hex").toString("utf8");
                    }
                    const parsed: KeyringGeminiSecret = JSON.parse(jsonStr);
                    if (parsed.token?.refresh_token || parsed.token?.access_token) {
                        const info = new OAuthTokenInfo();
                        info.accessToken = parsed.token.access_token || "";
                        info.refreshToken = parsed.token.refresh_token || "";
                        if (parsed.token.expiry) {
                            const expMs = Date.parse(parsed.token.expiry);
                            if (!isNaN(expMs)) {
                                info.expiry = { seconds: BigInt(Math.floor(expMs / 1000)) } as any;
                            }
                        }
                        return info;
                    }
                }
            }
        } catch {
            // Ignore parse errors and try next path
        }
    }
    return null;
}

/**
 * Decode the stored `OAuthTokenInfo` (refresh token, access token, expiry, ...).
 *
 * Mirrors the real client's `OAuthPreferences.getOAuthTokenInfo()`: the durable
 * credential lives in the USS `oauthToken` topic under `oauthTokenInfoSentinelKey`,
 * present in BOTH standalone and IDE profiles, or in Linux keyring_store.json.
 */
export function getOAuthTokenInfo(): OAuthTokenInfo | null {
    // 1. Check Linux desktop app keyring
    const keyringInfo = readLinuxKeyringToken();
    if (keyringInfo && keyringInfo.refreshToken) {
        return keyringInfo;
    }

    // 2. Check USS database
    const uss = readUssOAuthData();
    if (!uss.value) return null;
    try {
        return OAuthTokenInfo.fromBinary(Buffer.from(uss.value, "base64"));
    } catch {
        return null;
    }
}

/**
 * Read the auth status used by the rest of the client.
 *
 * `apiKey` is derived from `OAuthTokenInfo.accessToken` — exactly what the real
 * client does (`metadata.apiKey = getOAuthTokenInfo()?.accessToken ?? ""`). This
 * works on every profile (standalone/IDE, mac/win/linux) and does not depend on
 * the optional `antigravityAuthStatus` cache. email/name are best-effort from the
 * legacy cache (absent on IDE profiles — fine, they are display-only).
 */
export function readAuthStatus(): { apiKey: string; email: string; name: string } {
    const info = getOAuthTokenInfo();
    const apiKey = info?.accessToken ?? "";
    const legacy = readLegacyAuthStatus();
    return {
        apiKey: apiKey || legacy.apiKey,
        email: legacy.email,
        name: legacy.name,
    };
}

/**
 * Read USS OAuth topic data from state.vscdb or synthesized from keyring_store.json.
 * This is the data the LS expects to receive via SubscribeToUnifiedStateSyncTopic("uss-oauth").
 */
export function readUssOAuthData(): UssOAuthData {
    try {
        const raw = queryStateDb(resolveStateDbPath(), "antigravityUnifiedStateSync.oauthToken");
        if (raw) {
            const topicBytes = Buffer.from(raw, "base64");
            const topic = Topic.fromBinary(topicBytes);

            // Select by key name — NOT data[0]. The entry order differs between
            // profiles (e.g. the IDE profile lists authStateWithContextSentinelKey
            // first), so indexing blindly grabs the wrong entry.
            const entry = topic.data.find(e => e.key === "oauthTokenInfoSentinelKey");
            if (entry && entry.value?.value) {
                return { key: entry.key, value: entry.value.value };
            }
        }
    } catch {
        // Fallback to keyring
    }

    // Fallback: Synthesize USS payload from Linux keyring if available
    const keyringInfo = readLinuxKeyringToken();
    if (keyringInfo) {
        return {
            key: "oauthTokenInfoSentinelKey",
            value: Buffer.from(keyringInfo.toBinary()).toString("base64"),
        };
    }

    return { key: "oauthTokenInfoSentinelKey", value: "" };
}

/**
 * Read all auth data needed for independent LS operation.
 */
export function readAuthData(): AuthData {
    const status = readAuthStatus();
    const ussOAuth = readUssOAuthData();
    return { ...status, ussOAuth };
}

