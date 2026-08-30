# Codebase Cleanup Strategy (CLEANUP_STRAT.md)

## Executive Summary

The `antigravity-client` repository represents a significant engineering effort in bridging standard developer tooling with the Antigravity Language Server. However, rapid iteration and the porting of stealth subsystems from the Rust `zero-gravity` project have introduced architectural friction, technical debt, and redundancy.

The most high-impact cleanup opportunities include:
1. **Removing dead and checked-in generated code:** `.bak` files and accidentally tracked compiled `.js` files in source directories.
2. **Modernizing the test suite:** Transitioning from manual, `console.log`-based smoke tests to robust, automated testing using the native `node:test` module.
3. **Streamlining module boundaries:** Consolidating proxy routing logic, CLI REPL complexities, and stealth capability abstractions.
4. **Refining the build and type system:** Aligning `package.json` module types with `tsconfig` output targets to prevent Node module resolution confusion.

Executing this strategy will significantly lower the maintenance burden, improve contributor ergonomics, and establish a more stable foundation for integrating upstream protocol changes.

## Architecture & Module Streamlining

### Proxy Routes Consolidation
Currently, `src/proxy/routes/` splits logic across `openai-routes.ts`, `anthropic-routes.ts`, and `gemini-routes.ts`. There are duplicated patterns in handling HTTP payloads, token streaming mechanisms, and connection lifecycle management.
- **Recommendation:** Extract common request validation, SSE streaming lifecycles, and downstream connection closure safety mechanisms into a centralized `proxy/core/` module. The individual route files should act strictly as schema translation layers.

### CLI REPL Refactoring
The CLI REPL (`src/cli/repl.ts`) is currently a monolithic file (nearly 400 lines) that mixes UI concerns (terminal coloring, input parsing) with core cascade workflow logic.
- **Recommendation:** Decouple the UI presentation layer from the workflow logic. Move the terminal interaction code into a dedicated `cli/ui/` directory, keeping `repl.ts` focused strictly on the event loop integration with the `Cascade` class.

### Test Suite Modernization
Many files in the `test/` directory (e.g., `test_launch_standalone.ts`, `test_cascade_golden_path.ts`) function as manual smoke scripts rather than true unit/integration tests.
- **Recommendation:** Migrate these scripts to use the native `node:test` and `node:assert` modules. Ensure tests are fully automatable and can run headlessly without manual visual verification. Create shared setup/teardown helpers to skip end-to-end tests cleanly when the local Language Server binary is unavailable.

## Dead Code & Redundancy Inventory

The following files are obsolete, redundant, or incorrectly tracked by version control, and should be safely deleted:

1. **Backup Source Files:**
   - `src/agent/agent.ts.bak`
   - `src/agent/files.ts.bak`
   - `src/agent/terminal.ts.bak`
   *Reason:* Version control eliminates the need for manual `.bak` files in the repository.

2. **Accidentally Checked-In Build Artifacts:**
   - `src/server/auth-reader.js`
   - `src/server/mock-extension-server.js`
   - `src/server/web-poc/preload-shim.js` (Verify if this is generated or required as raw JS by Electron)
   *Reason:* The project is configured to output compiled artifacts to `dist/`. These compiled `.js` files sit next to their `.ts` source files and can confuse module resolution or linters.

3. **Scripts Cleanup:**
   - Review `/scripts/` directory for any duplicated generation scripts that are no longer part of the current active protobuf generation pipeline (e.g., `generate_from_js.ts` vs `generate_proto.ts`).

## Build & Dependency Optimization

### TypeScript Configuration Alignment
- `package.json` enforces `"type": "commonjs"`, yet `tsconfig.json` dictates `"module": "NodeNext"` and `"moduleResolution": "NodeNext"`. This mismatch can lead to ambiguous runtime module resolution, especially given the `.js` imports inside `.ts` files.
- **Recommendation:** Choose a consistent module system. If CommonJS is required, configure TypeScript to strictly output CommonJS. If ESM is the goal, update `package.json` to `"type": "module"` and fix all local import extensions.

### Dependency Management
- The project runs tests via `tsx`, but builds using `tsc`.
- **Recommendation:** Ensure all dependencies used only for scripts and tests (like `tsx`) are strictly contained in `devDependencies`. Lock file (`package-lock.json`) dependencies are well-pinned, but periodically reviewing unused packages (via a tool like `depcheck`) is recommended.

## Actionable Phased Roadmap

**Phase 1: Housekeeping (Low Risk)**
1. Delete all `.bak` files in `src/agent/`.
2. Delete compiled `.js` files in `src/server/` (except `preload-shim.js` if it's intentionally raw).
3. Update `.gitignore` to strictly exclude `*.js` in `src/` (while allowing `dist/` logic as needed).
4. Run `npm test` and `npm run build` to verify the codebase remains intact.

**Phase 2: Build System Stabilization (Medium Risk)**
1. Resolve the CommonJS vs. NodeNext module resolution ambiguity across `package.json` and `tsconfig.json`.
2. Ensure strict compilation passes via `tsconfig.build.json` without relying on legacy loose types.
3. Validate that standard build artifacts are correctly copied (e.g., via `scripts/copy-web-poc-assets.ts`).

**Phase 3: Proxy & CLI Modularization (Medium Risk)**
1. Refactor `src/cli/repl.ts` by extracting terminal formatting and input handling.
2. Abstract common stream lifecycle and SSE handling out of the three distinct proxy route files.
3. Verify changes manually using the local Mock Extension Server setup.

**Phase 4: Test Suite Overhaul (High Effort, Low Risk)**
1. Progressively rewrite individual `test_*.ts` files using `node:test`.
2. Introduce a `test/helpers/` module for mocking connections and gracefully skipping tests missing external binaries.
3. Integrate the updated test suite into the main `npm test` script executed by `tsx test/run_all_tests.ts`.
