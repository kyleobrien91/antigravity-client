# Codebase Strategic Audit: antigravity-client

## 1. Executive Summary

An in-depth audit of the `antigravity-client` repository reveals a functional but unpolished codebase bridging Node.js architectures with Google's Antigravity Language Server. While core mechanics for ConnectRPC and Cascade Event parsing are solid, the codebase exhibits substantial technical debt in error handling, type safety, test coverage, and lifecycle management. The overall hygiene score is **Moderate (6.5/10)**. Immediate remediation is required for unhandled promise rejections, broad untyped constructs, and brittle subprocess lifecycles to elevate this client to production-grade stability.

---

## 2. Structural Hygiene & Directory Audit

### 2.1 Missing Test Scaffolding
The codebase severely lacks structured test coverage isolating individual layers. The root `test/` directory contains numerous flat files acting as smoke tests rather than modular unit tests.
- **Action:** Introduce hierarchical test directories (`test/core/`, `test/server/`, `test/proxy/`, `test/cli/`). Many smoke tests should migrate into structural unit tests asserting discrete functionality instead of relying on `console.log` validations.

### 2.2 Unclean Artifacts / Outdated Backups
The repository contains `.bak` files that were left inside `src/agent/`:
- `src/agent/agent.ts.bak`
- `src/agent/files.ts.bak`
- `src/agent/terminal.ts.bak`
**Impact:** Unnecessary cruft inflating the source tree.

### 2.3 Hardcoded Generated Schemas
While `src/gen/` correctly isolates protobuf implementations, `src/facade/` generated bindings (like `services.ts`) aggressively assert `as any` across their signatures.

---

## 3. Implementation Completeness Gap Analysis

### 3.1 Stubbed Enum Branches / Missing Throw Boundaries
- Inside `src/gen/exa/cortex_pb/cortex_pb.ts`: Several enums represent unimplemented capabilities natively stubbed (e.g., `ERROR_CODE_UNIMPLEMENTED`, `TASK_STATUS_TODO`). While generated, upstream schemas show features the client lacks awareness of.
- The web-poc shim (`src/server/web-poc/preload-shim.js`) implements empty function stubs (e.g. `updateActiveAgentCount: function () { return Promise.resolve(); }`) that mask critical telemetry gaps.

### 3.2 Floating Promises
Multiple execution paths dispatch asynchronous work without awaiting or attaching `catch` blocks. This can crash Node.js violently under high load.
- `src/server/launcher.ts:427`: `this.doStart(true).catch(...)` is correctly caught, but its invocation context is inside a floating `setTimeout` causing potential race conditions on shutdown.
- `src/server/mcp/registry.ts:98`: `entry.cascade.cancel().catch(() => {})` swallows exceptions silently during cancellation cascades.

---

## 4. Bad Practices & Code Quality Hotspots

### 4.1 "Any" Type Proliferation & Loose Casts
The codebase heavily over-relies on `any` for dynamic payloads and generated stubs.
- **Facade Generators:** `src/facade/services.ts` casts every request and response: `const req = new (PB as any)... return (res as any) as T...`. This completely bypasses TypeScript's compile-time safety.
- **Event Boundaries:** `src/core/cascade/index.ts` leverages `any` heavily for event listeners (`(handler as any)`).
- **Data Schemas:** `src/facade/inputs.ts` resolves numerous dates and custom inputs simply to `any` instead of `Date | string` or `Record<string, unknown>`.

### 4.2 Error Swallowing (Silent Try/Catch)
A pervasive and dangerous anti-pattern is catching errors and doing absolutely nothing, blinding observability.
- `src/server/web-poc/preload-shim.js:18`: `try { console.debug... } catch (e) {}`
- `src/server/web-poc/preload-shim.js:59`: `notifClickListeners.forEach(function (cb) { try { cb(payload); } catch (e) {} });`
- `src/server/launcher.ts:271`: `try { fs.appendFileSync(...) } catch (e) { }`
- **Impact:** Failed file writes, failing browser shims, and broken telemetry events are completely hidden.

### 4.3 Child Process Leaks & Subprocess Fragility
The use of `spawn` and `exec` requires rigid cleanup routines that are currently volatile.
- `src/server/mock-extension-server.ts:474`: `req.setTimeout(500, () => req.destroy())` destroys requests forcefully without notifying the underlying handler.
- The `lsProcess` inside `src/server/launcher.ts` uses a hardcoded `SIGKILL` timeout after 5 seconds if graceful exits fail. If the launcher itself receives a `SIGKILL`, it orphans the Language Server binary causing "port already in use" errors on restart.

---

## 5. Actionable Remediation Strategy

### Phase 1: Harden Event Loops & Subprocesses (High Priority)
1. **Graceful Subprocess Exits:** Intercept `SIGINT`, `SIGTERM`, and `process.on('exit')` rigidly in the main CLI entry points to recursively tear down spawned `lsProcess` and Chrome browser processes.
2. **Remove Silent Catches:** Audit `src/server/launcher.ts` and `preload-shim.js`. Replace empty `catch (e) {}` blocks with `console.warn` or graceful telemetry fallback logging.

### Phase 2: Type Safety & Architecture (Medium Priority)
1. **Eliminate `any` in Facades:** Modify `scripts/generate_facade.ts` to output strongly typed `new (PB as typeof TargetMessage)(...)` instead of defaulting to `any` during generation.
2. **Strict Event Typings:** Refactor `Cascade` to use `EventEmitter<CascadeEventMap>` rather than loosely bound `any` arrays for listeners.

### Phase 3: Testing Infrastructure (Low Priority, Long Term)
1. **Structural TDD:** Move smoke tests inside `test/` to strict directories (`test/core`, `test/proxy`).
2. **Framework Integration:** Adopt a lightweight runner utilizing the native `node:test` suite consistently, replacing `test/run_all_tests.ts` with a glob-based native test runner configuration.
