# Architecture & Design Audit

## Executive Summary

The Antigravity Client codebase acts as a multi-protocol proxy and SDK to interface with a local Go-based Language Server. While functionally capable of stealth MITM operations and API adaptation (OpenAI, Anthropic, Gemini formats), the underlying architecture suffers from significant layering violations and tight coupling. The core library (`src/core/client.ts`) has ballooned into a "God Object" that manages transport, protocol state, and OS-level process lifecycles. Furthermore, the stealth proxy layer frequently bypasses type-safe facades to interact directly with raw Protobuf internals, creating brittle dependencies. Error propagation in critical startup sequences is overly permissive, risking silent state corruption. Strict protocol conformance is also inconsistently applied, with memory leaks present in some streaming endpoints. A comprehensive refactoring to decouple infrastructure from business logic is strongly advised.

## Module Dependency Map

```text
┌─────────────────┐       ┌───────────────┐
│                 │       │               │
│   src/cli       │──────▶│   src/proxy   │
│ (Orchestration) │       │ (HTTP & APIs) │
│                 │       │               │
└─────────────────┘       └───────┬───────┘
         │                        │
         │                        ▼
         │                ┌───────────────┐
         │                │               │
         └───────────────▶│   src/core    │◀─────────┐
                          │ (Client Auth) │          │
                          │               │          │
                          └───────┬───────┘          │
                                  │                  │ (Circular/Tight)
                                  ▼                  │
                          ┌───────────────┐          │
                          │               │          │
                          │   src/server  │──────────┘
                          │ (LS Launcher) │
                          │               │
                          └───────────────┘
```

## Findings

### 1. Layering Violation & Type Safety Bypass in Stealth Warmup
- **Severity**: 🔴 CRITICAL
- **File**: `src/proxy/stealth/warmup.ts`
- **Line numbers**: 47-50
- **Description**: The warmup sequence bypasses the robust `LanguageServerFacade` (which defines 188 type-safe methods) and instead casts `client.lsClient as any` to dynamically invoke raw RPC methods via string names (`const reqFunc = (client.lsClient as any)[method]`). This breaks module boundaries, coupling the stealth layer tightly to the internal ConnectRPC implementation details and abandoning compile-time safety.
- **Recommended Remediation**: Refactor `runWebviewWarmup` to use the typed methods provided by `client.languageServer` (the facade), or implement an interface in the facade specifically for iterating over necessary warmup commands.

### 2. Missing SSE Lifecycle Cleanup in OpenAI Proxy Stream
- **Severity**: 🔴 CRITICAL
- **File**: `src/proxy/routes/openai-routes.ts`
- **Line numbers**: 40-97 (specifically in the `/v1/chat/completions` handler)
- **Description**: The `/v1/chat/completions` endpoint implements Server-Sent Events (SSE) streaming but fails to attach `req.on('close')` or `req.on('aborted')` listeners to cancel the upstream `Cascade` session. If a client disconnects mid-stream, the upstream Language Server will continue generating tokens indefinitely, violating strict token safety requirements. (Note: This is handled correctly in the `/v1/responses` endpoint).
- **Recommended Remediation**: Add connection termination listeners (`req.on('close', cancelCascade); req.on('aborted', cancelCascade);`) in the `/v1/chat/completions` stream block to abort the active `Cascade` promise when the client disconnects.

### 3. God Object Pattern & Infrastructure Coupling in Core Client
- **Severity**: 🟠 HIGH
- **File**: `src/core/client.ts`
- **Line numbers**: 58-154
- **Description**: `AntigravityClient` acts as a God object. It not only manages the HTTP/2 transport, CSRF tokens, and Protobuf connection (`@connectrpc`), but also imports `Launcher` (`src/server/launcher.ts`) to manage OS processes and uses `AutoDetector` (`src/utils/autodetect.ts`) to scan OS ports. This creates a circular dependency where `client.ts` depends on `server/launcher.ts`, while the server/proxy layers depend back on the client.
- **Recommended Remediation**: Extract the OS-level process launching and auto-detection into a separate `ConnectionManager` or factory service. The `AntigravityClient` should only accept an endpoint URL and credentials, unaware of whether the server is standalone or attached.

### 4. Lifecycle Tangling in Proxy Server Initialization
- **Severity**: 🟡 MEDIUM
- **File**: `src/proxy/server.ts`
- **Line numbers**: 16-20
- **Description**: The `startProxyServer` HTTP creation function actively instantiates and starts a long-running background polling daemon (`QuotaMonitor`) if one is not provided. This tightly couples the HTTP server's lifecycle to background task state management.
- **Recommended Remediation**: Move the instantiation of `QuotaMonitor` out of the HTTP proxy logic entirely. It should be initialized and managed by the orchestration layer (`src/cli/commands/serve.ts`), passing only a static snapshot function or read-only interface to the proxy.

### 5. Error Masking in Critical Startup Sequences
- **Severity**: 🟡 MEDIUM
- **File**: `src/proxy/stealth/warmup.ts`
- **Line numbers**: 15-24, 55-57
- **Description**: The `runWebviewWarmup` function races critical RPC calls (like `SetUserSettings`, which enables the proxy) against a 5-second timeout, catching and suppressing errors with `console.warn`. While stealth logic requires avoiding proxy crashes, failing to set `detectAndUseProxy` silently puts the LS in an invalid state, leading to obscure failures during downstream inference.
- **Recommended Remediation**: Distinguish between transient errors on background tasks (safe to swallow) and critical startup configuration errors. The warmup sequence should throw or forcefully retry if foundational settings like `SetUserSettings` fail.

## Structural Recommendations

1. **Implement Dependency Injection**: Break the dependency cycles between `core`, `server`, and `proxy` by introducing a DI container or strict factory pattern.
2. **Enforce Facade Boundaries**: Deprecate direct access to `client.lsClient` outside of the `src/core` layer. All proxy and cli logic must route through `client.languageServer` (the facade).
3. **Standardize Stream Management**: Abstract the Server-Sent Events (SSE) logic into a unified streaming utility class to ensure cancellation hooks, jitter math, and formatting are consistently applied across all API adapter routes.

## Files Reviewed
- `src/core/client.ts`
- `src/proxy/server.ts`
- `src/proxy/routes/openai-routes.ts`
- `src/proxy/stealth/warmup.ts`
- `src/proxy/stealth/heartbeat.ts`
- `src/proxy/quota/monitor.ts`
- `src/utils/autodetect.ts`
- `src/server/launcher.ts`
- `src/cli/commands/serve.ts`