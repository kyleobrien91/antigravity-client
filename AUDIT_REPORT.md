# Independent Code Audit Report — antigravity-client

## Executive Summary

This comprehensive audit of the `antigravity-client` TypeScript codebase synthesizes the findings of an independent, 7-dimensional technical review conducted across **Defensive Coding & Input Validation**, **Architecture & Design**, **Code Quality & Maintainability**, **Error Handling & Resilience**, **Testing & Quality Assurance**, **Performance & Resource Management**, and **Configuration & Build**.

Overall, the codebase demonstrates a high level of domain sophistication in reverse-engineering and adapting the proprietary Language Server protocols (ConnectRPC/Protobuf), SSE stream generation, and multi-format LLM translation (OpenAI, Anthropic, Gemini, ACP). However, the implementation exhibits several severe security vulnerabilities, critical architectural layering violations, unhandled stream lifecycle leaks, and systemic testing gaps that must be remediated before production deployment.

### Top 3 Critical Risks
1. **Arbitrary Code Execution & Path Traversal Vulnerabilities (🔴 CRITICAL)**: The mock extension server passes unsanitized command line strings directly into `child_process.spawn({ shell: true })` and writes files without verifying that target paths reside within trusted workspace boundaries.
2. **Resource & Token Leaks on Stream Disconnects (🔴 CRITICAL)**: SSE streaming endpoints (notably `/v1/chat/completions`) fail to register client disconnect handlers (`req.on('close')`), causing orphan Cascade sessions on the Language Server to continue consuming tokens indefinitely.
3. **Pervasive Type Safety Bypasses & Layering Violations (🟠 HIGH)**: Critical paths frequently cast core clients and Protobuf transports to `any`, bypassing the `LanguageServerFacade` and creating brittle couplings to internal implementation details.

---

## Findings by Severity

### 🔴 Critical Findings

| ID | Title | Module / File | Line(s) | Description | Recommended Remediation |
|---|---|---|---|---|---|
| **SEC-01** | Arbitrary Shell Command Execution via Unsanitized `spawn` | `src/server/mock-extension-server.ts` | 264–267 | Raw `req.commandLine` is passed into `spawn` with `shell: true` without input sanitization or argument separation. | Disable `shell: true`. Parse commands into explicit executable binaries and argument arrays; validate against an allowlist. |
| **SEC-02** | Path Traversal / Unrestricted File Overwrite | `src/server/mock-extension-server.ts` | 226–232 | `writeCascadeEdit` resolves paths via `fileURLToPath` without enforcing workspace boundaries, enabling overwrites of arbitrary host files. | Enforce that resolved `targetPath` starts with the canonical `workspacePath` (`path.resolve()`, `path.normalize()`). |
| **ARCH-01** | Missing SSE Lifecycle Cleanup in OpenAI Chat Stream | `src/proxy/routes/openai-routes.ts` | 40–97 | `/v1/chat/completions` does not handle `req.on('close')`/`req.on('aborted')`, leaking background token generation on client abort. | Attach abort listeners to cancel active `Cascade` promises immediately upon connection closure. |
| **ARCH-02** | Type Safety Bypass in Stealth Warmup Sequence | `src/proxy/stealth/warmup.ts` | 47–50 | Warmup sequence casts `client.lsClient as any` to dynamically invoke raw RPC strings, completely bypassing the typed facade. | Route all warmup invocations strictly through the typed `LanguageServerFacade`. |

---

### 🟠 High Findings

| ID | Title | Module / File | Line(s) | Description | Recommended Remediation |
|---|---|---|---|---|---|
| **ARCH-03** | God Object & Circular Coupling in Core Client | `src/core/client.ts` | 58–154 | `AntigravityClient` conflates transport management, OS process launching (`Launcher`), and port detection (`AutoDetector`). | Extract process spawning and discovery into a dedicated `ConnectionManager` factory. |
| **PERF-01** | Unbounded SSE Buffer Accumulation | `src/proxy/routes/*.ts`, `src/cli/commands/acp.ts` | Various | Accumulating raw message and thinking chunks in memory during long conversations without backpressure or stream limits. | Enforce streaming chunk backpressure and discard intermediate buffer state once flushed to socket. |
| **ERR-01** | Silent Error Swallowing in Accounts Store | `src/accounts/store.ts` | 32–45 | Bare catch blocks swallow authentication disk reads, returning empty account arrays without diagnostic logging. | Catch specific errors (`ENOENT`), log warnings with context, and re-throw on corrupted JSON. |
| **SEC-03** | Missing HTTP Request Body Validation | `src/proxy/server.ts` | 53–70 | Raw `JSON.parse(body)` passed directly to route handlers without runtime type or schema validation. | Implement runtime schema parsing using a library like Zod or TypeBox prior to handler dispatch. |
| **TEST-01** | Major Unit Test Coverage Gaps | `src/accounts/*`, `src/proxy/routes/*` | All | Zero unit test coverage exists for token rotation, authentication stores, or Gemini/Anthropic payload translation. | Add deterministic unit test suites using mock HTTP fixtures and memory stores. |

---

### 🟡 Medium Findings

| ID | Title | Module / File | Line(s) | Description | Recommended Remediation |
|---|---|---|---|---|---|
| **CONF-01** | Relaxed TypeScript Compiler Settings | `tsconfig.json` | 1–25 | Compiler is missing `strictNullChecks`, `noImplicitAny`, and `exactOptionalPropertyTypes`. | Enable full `strict: true` along with `noImplicitOverride` and `noUncheckedIndexedAccess`. |
| **CONF-02** | Lack of Standardized Linter and Formatter | Root / `package.json` | — | No ESLint or Prettier configuration exists, leading to divergent formatting across modules. | Add ESLint and Prettier configs with pre-commit git hooks (`husky` / `lint-staged`). |
| **QUAL-01** | Pervasive `any` Type Annotations | Multiple files | ~40 instances | Widespread usage of `any` in event payloads, Protobuf responses, and JSON-RPC params. | Replace all `any` usages with generated Protobuf interfaces or explicit generic parameters. |
| **CLI-01** | Unsafe CLI Option Argument Indexing | `src/cli/ag.ts` | 13–14 | Accessing `process.argv[portIndex + 1]` without bounds checking yields `NaN` on trailing flags. | Adopt a production CLI framework like `commander` or `cac`. |

---

## Architecture & Design Assessment

```text
┌─────────────────────────────────────────────────────────────┐
│                         CLI Layer                           │
│     src/cli/ag.ts  ───▶  src/cli/commands/{acp,serve,quota} │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                        Proxy Layer                          │
│     src/proxy/server.ts  ───▶  src/proxy/routes/*           │
│     src/proxy/stealth/*  ───▶  src/proxy/quota/monitor.ts   │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                         Core SDK                            │
│     src/core/client.ts   ───▶  src/core/cascade.ts          │
│     src/core/facade.ts   ───▶  src/gen/** (Protobuf)        │
└──────────────────────────────┬──────────────────────────────┘
                               │ (Tight Coupling / Circular)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                    Server & Process Layer                   │
│     src/server/launcher.ts  ───▶  src/server/mock-ext.ts    │
└─────────────────────────────────────────────────────────────┘
```

---

## Sweeping Strategic Recommendations

1. **Security Hardening (Immediate Priority)**:
   - Restrict `MockExtensionServer.writeCascadeEdit` to the active project root workspace.
   - Refactor `ExecuteCommand` to run binaries with explicit argument vectors rather than shell interpolation (`shell: false`).

2. **Decouple Core SDK from Process Management**:
   - Extract `Launcher` and `AutoDetector` from `AntigravityClient`. The SDK should strictly be an API client. Process management belongs in a separate utility module.

3. **Standardize Streaming & Lifecycle Protocol**:
   - Create a single `SseStreamHandler` utility class that automatically binds socket `close`/`abort` listeners to the upstream `Cascade` instance.

4. **Upgrade Build & Type-Safety Rigor**:
   - Enable strict compiler flags in `tsconfig.json`.
   - Install ESLint, Prettier, and Zod for incoming HTTP schema validation.

---

## Appendix: Source Files Audited
- `src/core/client.ts`
- `src/core/cascade.ts`
- `src/core/facade.ts`
- `src/server/launcher.ts`
- `src/server/mock-extension-server.ts`
- `src/proxy/server.ts`
- `src/proxy/routes/openai-routes.ts`
- `src/proxy/routes/anthropic-routes.ts`
- `src/proxy/routes/gemini-routes.ts`
- `src/proxy/stealth/warmup.ts`
- `src/proxy/stealth/heartbeat.ts`
- `src/proxy/stealth/trace.ts`
- `src/proxy/quota/monitor.ts`
- `src/accounts/store.ts`
- `src/accounts/rotator.ts`
- `src/accounts/oauth.ts`
- `src/cli/ag.ts`
- `src/cli/commands/acp.ts`
- `src/cli/commands/serve.ts`
- `src/cli/commands/quota.ts`
- `test/test_cascade_golden_path.ts`
- `test/test_openai_responses.ts`
- `test/test_acp_stdio.ts`
- `test/test_save_document.ts`
- `test/run_all_tests.ts`
- `package.json`
- `tsconfig.json`
