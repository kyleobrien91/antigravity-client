# Zero-Gravity (ZG) Roadmap & Status Matrix

This document tracks the roadmap and implementation status for integrating stealth, webview lifecycle emulation, multi-protocol proxies, and native tool execution into **`antigravity-client`**, synthesizing the best architectural paradigms from [`zero-gravity`](https://github.com/zhe-gu/zero-gravity) and official Antigravity Language Server (`ls_core`) protocols.

---

## 1. Architectural Vision

To provide a production-grade, headless client, runtime environment, and protocol gateway that uses Google's authentic Language Server Go binary as its core engine. Outbound gRPC/TLS traffic to Google Cloud originates directly from Google's compiled binary (guaranteeing 100% authentic BoringSSL JA3/JA4 TLS fingerprints and HTTP/2 framing), while a faithful local Mock Extension Server and multi-protocol proxy interface external AI tools (**OpenCode**, **OpenClaw**, **Hermes Agent**, **Msty**, **Claude Code**, **Cursor**, **Aider**, **Cline**) seamlessly.

```text
Real Antigravity ls_core (Official Go binary)
        ↓  [Connect-RPC / HTTP/2 TLS + Named Pipe Liveness]
faithful local runtime substrate (antigravity-client)
  ├── Mock Extension Server (USS state sync, ExecuteCommand, SaveDocument)
  ├── Authentic Connect-RPC / Protobuf facade (@bufbuild/protobuf)
  └── Stealth Subsystem (Outbound TLS shield, zero-width obfuscator, fingerprint & jitter)
        ↓
native Cascade (Authoritative Agent/Tool Loop)
        ↓
thin protocol gateway (Inside antigravity-client)
        ↓
Outward Projections:
  ├── OpenAI Responses API (POST /v1/responses - Primary OpenCode Target)
  ├── OpenAI Chat Completions (POST /v1/chat/completions)
  ├── Agent Client Protocol (ACP v2 JSON-RPC over stdio)
  ├── Anthropic Messages API (POST /v1/messages)
  ├── Google Gemini API (POST /v1beta/models/*)
  └── Interactive CLI & Diagnostics (ag extract / ag serve / ag fingerprint)
```

---

## 2. Implementation Status Matrix

### Phase 1: Core Substrate & Headless LS Lifecycle
| Capability | Status | Implementation Details |
| :--- | :---: | :--- |
| **Headless LS Process Launcher** | `COMPLETED` | `src/server/launcher.ts` — spawns binary with pipe liveness & CSRF tokens |
| **Named Pipe Liveness Protocol** | `COMPLETED` | Cross-platform named pipe (`\\.\pipe\server_<hex>` / Unix sockets) |
| **Typed Protobuf Message Classes** | `COMPLETED` | `src/gen/` — 25+ packages compiled via `@bufbuild/protobuf` & `@connectrpc` |
| **Connect-RPC HTTP/2 TLS Client** | `COMPLETED` | `src/core/client.ts` — TLS handshake with bundled `cert.pem` & CSRF header |
| **Multi-Platform SQLite Token Discovery**| `COMPLETED` | `src/server/auth-reader.ts` — read-only SQLite URI extraction from `state.vscdb` |
| **Unified State Sync (USS) OAuth** | `COMPLETED` | `src/server/mock-extension-server.ts` — active `SubscribeToUnifiedStateSyncTopic` |
| **Native Cascade Session Engine** | `COMPLETED` | `src/core/cascade/` — `CascadeStreamHandler` & `CascadeEventParser` |

### Phase 2: Stealth Subsystem & Lifecycle Emulation
| Capability | Status | Implementation Details |
| :--- | :---: | :--- |
| **Zero Outbound Node TLS (Binary Shield)**| `COMPLETED` | 100% of outbound Google Cloud traffic routed through LS Go binary |
| **Zero-Width Space Sensitive Word Shield**| `COMPLETED` | `src/proxy/stealth/obfuscator.ts` — `\u200B` injection for client names |
| **Device Fingerprint & Versioning** | `COMPLETED` | `src/proxy/stealth/fingerprint.ts` — IDE version & device ID synchronization |
| **System Prompt Transformation Modes** | `COMPLETED` | `src/proxy/stealth/prompt-modes.ts` — `native`, `stealth`, and `minimal` modes |
| **Multi-Account Storage & Rotation** | `COMPLETED` | `src/accounts/` — `oauth.ts`, `rotator.ts`, `store.ts` for automated rotation |
| **Webview Startup Warmup Sequence** | `PENDING` | `src/proxy/stealth/warmup.ts` — 13-RPC initialization sequence (50-200ms jitter) |
| **Background Heartbeat Loop with Jitter** | `PENDING` | `src/proxy/stealth/heartbeat.ts` — 30s $\pm 500\text{ms}$ periodic keep-alive |
| **In-Memory Quota & Credit Monitor** | `PENDING` | `src/proxy/quota/monitor.ts` — 60s cache polling; expose `GET /v1/quota` |
| **Structured JSON Call Tracing** | `PENDING` | `src/proxy/stealth/trace.ts` — file-based per-call traces in `~/.config/antigravity/` |

### Phase 3: Multi-Protocol Gateway & Tool Fidelity
| Capability | Status | Implementation Details |
| :--- | :---: | :--- |
| **OpenAI Chat Completions (`/v1/chat/completions`)** | `COMPLETED` | `src/proxy/routes/openai-routes.ts` — streaming & non-streaming responses |
| **Dynamic Models Catalog (`/v1/models`)** | `COMPLETED` | `src/proxy/routes/openai-routes.ts` & `src/proxy/aliases.ts` |
| **Anthropic Messages API (`/v1/messages`)** | `COMPLETED` | `src/proxy/routes/anthropic-routes.ts` — Claude Code / Cursor compatibility |
| **Google Gemini API (`/v1beta/models/*`)** | `COMPLETED` | `src/proxy/routes/gemini-routes.ts` — native Gemini payload mapping |
| **CLI Suite (`ag extract`, `ag serve`, `ag fingerprint`)** | `COMPLETED` | `src/cli/ag.ts`, `src/cli/commands/` |
| **Docker Standalone Runtime** | `COMPLETED` | `docker/Dockerfile`, `docker/docker-compose.template.yml` |
| **Submodule Tracking** | `COMPLETED` | `zero-gravity` submodule linked under `./zero-gravity` |
| **OpenAI Responses API (`POST /v1/responses`)** | `PENDING` | 6-stage SSE lifecycle for OpenCode compatibility |
| **Real `SaveDocument` Disk Persistence** | `PENDING` | `src/server/mock-extension-server.ts` — decode request & persist to disk |
| **Agent Client Protocol (ACP v2 Stdio Server)** | `PENDING` | `src/cli/commands/acp.ts` — JSON-RPC 2.0 stdio server |
| **Comprehensive Master Test Suite** | `PENDING` | `test/test_cascade_golden_path.ts` & `test/run_all_tests.ts` |

---

## 3. Immediate Action Plan

1. **Implement Webview Startup Warmup & Heartbeat Loop**:
   - Add `src/proxy/stealth/warmup.ts` (13-RPC burst on boot) and `src/proxy/stealth/heartbeat.ts` (30s $\pm 500\text{ms}$ timer).
2. **Implement Real `SaveDocument` Disk Handler**:
   - Update `src/server/mock-extension-server.ts` to decode `SaveDocumentRequest` via `@bufbuild/protobuf` and write file modifications to disk.
3. **Add First-Class OpenAI Responses API (`POST /v1/responses`)**:
   - Update `src/proxy/routes/openai-routes.ts` to support the full 6-stage SSE lifecycle (`response.created` $\dots$ `response.completed`).
4. **Add Quota & Credit Monitor**:
   - Implement `src/proxy/quota/monitor.ts` and add `GET /v1/quota` & `GET /v1/credits` endpoints to `src/proxy/server.ts`.
5. **Implement ACP v2 Stdio Server**:
   - Build `src/cli/commands/acp.ts` and wire `ag acp` CLI command.
6. **Master Automated Test Suite**:
   - Build `test/test_cascade_golden_path.ts` and `test/run_all_tests.ts` to assert end-to-end multi-turn coding and tool execution.
