# Code Quality & Maintainability Audit

## Executive Summary
This report presents a focused Code Quality and Maintainability audit of the Antigravity Client TypeScript codebase. The review assesses static code attributes purely on current structure, logic, and patterns.

Overall, while the architecture sets clear boundaries (such as a generated facade for connect-rpc), there are significant maintainability concerns. The frequent use of `any` types undermines TypeScript's safety guarantees, particularly around event parsing and mock interactions. Additionally, several core files exceed recommended length thresholds, suggesting a need for modular refactoring. The presence of `@ts-ignore` and leftover `console.log` statements further indicate areas where codebase maturity can be improved.

## Findings

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/accounts/oauth.ts` (Lines: 31)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/cli/commands/acp.ts` (Lines: 25, 49, 61, 66, 81, 90, 98, 112, 139, 151)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/cli/commands/serve.ts` (Lines: 47)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/cli/repl.ts` (Lines: 196, 214)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Oversized file
- **Severity**: ⚪ INFORMATIONAL
- **File**: `src/cli/repl.ts` (Lines: 1-391)
- **Description**: File exceeds 300 lines (contains 391 lines).
- **Recommended remediation**: Consider refactoring and splitting the file into smaller, focused modules.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/core/cascade/event-parser.ts` (Lines: 110, 149, 158, 173, 200, 260, 310, 337, 426, 467)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Oversized file
- **Severity**: ⚪ INFORMATIONAL
- **File**: `src/core/cascade/event-parser.ts` (Lines: 1-501)
- **Description**: File exceeds 300 lines (contains 501 lines).
- **Recommended remediation**: Consider refactoring and splitting the file into smaller, focused modules.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/core/cascade/index.ts` (Lines: 67, 68, 75, 130, 172, 177, 196, 201, 204, 225, 231, 235, 278, 285, 305, 599, 600, 605)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Oversized file
- **Severity**: ⚪ INFORMATIONAL
- **File**: `src/core/cascade/index.ts` (Lines: 1-628)
- **Description**: File exceeds 300 lines (contains 628 lines).
- **Recommended remediation**: Consider refactoring and splitting the file into smaller, focused modules.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/core/cascade/stream-handler.ts` (Lines: 16, 30, 45, 67)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Use of `@ts-ignore`
- **Severity**: 🟠 HIGH
- **File**: `src/core/cascade/stream-handler.ts` (Lines: 38)
- **Description**: `@ts-ignore` forcefully silences type errors and can hide critical bugs.
- **Recommended remediation**: Fix the underlying type error or use `@ts-expect-error` if a type violation is unavoidable.

### Leftover `console.log` statement
- **Severity**: 🔵 LOW
- **File**: `src/core/client.ts` (Lines: 9, 151)
- **Description**: Debugging statements left in production code.
- **Recommended remediation**: Remove the `console.log` or replace it with a structured logging framework.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/core/client.ts` (Lines: 17, 18, 216, 415)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Oversized file
- **Severity**: ⚪ INFORMATIONAL
- **File**: `src/core/client.ts` (Lines: 1-445)
- **Description**: File exceeds 300 lines (contains 445 lines).
- **Recommended remediation**: Consider refactoring and splitting the file into smaller, focused modules.

### Oversized file
- **Severity**: ⚪ INFORMATIONAL
- **File**: `src/facade/index.ts` (Lines: 1-1167)
- **Description**: File exceeds 300 lines (contains 1167 lines).
- **Recommended remediation**: Consider refactoring and splitting the file into smaller, focused modules.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/facade/inputs.ts` (Lines: 187, 196, 295, 296, 300, 302, 303, 340, 341, 349, 366, 478, 494, 920, 923, 926, 1005, 1006, 1012, 1017, 1024, 1257, 1258, 1340, 1446, 1448, 1468, 1476, 1557, 1558, 2273, 2364, 2366, 2604, 2929, 3104, 3175, 3352, 3460, 3592, 3793, 3794, 3954, 4107, 4831, 4832, 4929, 5014, 5021, 5022, 5033, 5070, 5123, 5322, 5558, 5596, 5600, 5804, 6041, 6076, 6077, 6101, 6102, 6103, 6162, 6163, 6269, 6475)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Oversized file
- **Severity**: ⚪ INFORMATIONAL
- **File**: `src/facade/inputs.ts` (Lines: 1-6597)
- **Description**: File exceeds 300 lines (contains 6597 lines).
- **Recommended remediation**: Consider refactoring and splitting the file into smaller, focused modules.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/facade/services.ts` (Lines: 11, 15, 17, 21, 23, 27, 29, 33, 35, 39, 41, 45, 47, 51, 53, 57, 59, 63, 65, 69, 71, 75, 77, 81, 83, 87, 89, 93, 95, 99, 101, 105, 107, 111, 113, 117, 119, 123, 125, 129, 131, 135, 137, 141, 143, 147, 149, 153, 155, 159, 161, 165, 167, 171, 173, 177, 179, 183, 185, 189, 191, 195, 197, 201, 203, 207, 209, 213, 215, 219, 221, 225, 227, 231, 233, 237, 239, 243, 245, 249, 251, 255, 257, 261, 263, 267, 269, 273, 275, 279, 281, 285, 287, 291, 293, 297, 299, 303, 305, 309, 311, 315, 317, 321, 323, 327, 329, 333, 335, 339, 341, 345, 347, 351, 353, 357, 359, 363, 365, 369, 371, 375, 377, 381, 383, 387, 389, 393, 395, 399, 401, 405, 407, 411, 413, 417, 419, 423, 425, 429, 431, 435, 437, 441, 443, 447, 449, 453, 455, 459, 461, 465, 467, 471, 473, 477, 479, 483, 485, 489, 491, 495, 497, 501, 503, 507, 509, 513, 515, 519, 521, 525, 527, 531, 533, 537, 539, 543, 545, 549, 551, 555, 557, 561, 563, 567, 569, 573, 575, 579, 581, 585, 587, 591, 593, 597, 599, 603, 605, 609, 611, 615, 617, 621, 623, 627, 629, 633, 635, 639, 641, 645, 647, 651, 653, 657, 659, 663, 665, 669, 671, 675, 677, 681, 683, 687, 689, 693, 695, 699, 701, 705, 707, 711, 713, 717, 719, 723, 725, 729, 731, 735, 737, 741, 743, 747, 749, 753, 755, 759, 761, 765, 767, 771, 773, 777, 779, 783, 785, 789, 791, 795, 797, 801, 803, 807, 809, 813, 815, 819, 821, 825, 827, 831, 833, 837, 839, 843, 845, 849, 851, 855, 857, 861, 863, 867, 869, 873, 875, 879, 881, 885, 887, 891, 893, 897, 899, 903, 905, 909, 911, 915, 917, 921, 923, 927, 929, 933, 935, 939, 941, 945, 947, 951, 953, 957, 959, 963, 965, 969, 971, 975, 977, 981, 983, 987, 989, 993, 995, 999, 1001, 1005, 1007, 1011, 1013, 1017, 1019, 1023, 1025, 1029, 1031, 1035, 1037, 1041, 1043, 1047, 1049, 1053, 1055, 1059, 1061, 1065, 1067, 1071, 1073, 1077, 1079, 1083, 1085, 1089, 1091, 1095, 1097, 1101, 1103, 1107, 1109, 1113, 1115, 1119, 1121, 1125, 1127, 1131, 1133, 1137, 1139)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Oversized file
- **Severity**: ⚪ INFORMATIONAL
- **File**: `src/facade/services.ts` (Lines: 1-1142)
- **Description**: File exceeds 300 lines (contains 1142 lines).
- **Recommended remediation**: Consider refactoring and splitting the file into smaller, focused modules.

### Magic number in timeout
- **Severity**: ⚪ INFORMATIONAL
- **File**: `src/proxy/quota/monitor.ts` (Lines: 85)
- **Description**: Hardcoded timeout value.
- **Recommended remediation**: Extract the timeout value to a named constant to clarify intent.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/proxy/quota/monitor.ts` (Lines: 117)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/proxy/routes/anthropic-routes.ts` (Lines: 11, 18, 48, 56, 67, 85)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/proxy/routes/gemini-routes.ts` (Lines: 10, 22, 38, 52, 65, 79)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/proxy/routes/openai-routes.ts` (Lines: 11, 30, 31, 60, 78, 98, 112, 113, 163, 195, 209)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/proxy/server.ts` (Lines: 61)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Leftover `console.log` statement
- **Severity**: 🔵 LOW
- **File**: `src/proxy/server.ts` (Lines: 71, 72, 73, 74)
- **Description**: Debugging statements left in production code.
- **Recommended remediation**: Remove the `console.log` or replace it with a structured logging framework.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/proxy/stealth/heartbeat.ts` (Lines: 36)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/proxy/stealth/obfuscator.ts` (Lines: 54, 62)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/proxy/stealth/prompt-modes.ts` (Lines: 23)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Leftover `console.log` statement
- **Severity**: 🔵 LOW
- **File**: `src/proxy/stealth/warmup.ts` (Lines: 9, 23, 66)
- **Description**: Debugging statements left in production code.
- **Recommended remediation**: Remove the `console.log` or replace it with a structured logging framework.

### Magic number in timeout
- **Severity**: ⚪ INFORMATIONAL
- **File**: `src/proxy/stealth/warmup.ts` (Lines: 21, 55)
- **Description**: Hardcoded timeout value.
- **Recommended remediation**: Extract the timeout value to a named constant to clarify intent.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/proxy/stealth/warmup.ts` (Lines: 24, 51, 61)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/reactive/apply.ts` (Lines: 12, 20, 40, 64, 98, 109, 148, 158, 166)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Leftover `console.log` statement
- **Severity**: 🔵 LOW
- **File**: `src/server/launcher.ts` (Lines: 9, 167, 169, 171, 206, 271, 373)
- **Description**: Debugging statements left in production code.
- **Recommended remediation**: Remove the `console.log` or replace it with a structured logging framework.

### Magic number in timeout
- **Severity**: ⚪ INFORMATIONAL
- **File**: `src/server/launcher.ts` (Lines: 264)
- **Description**: Hardcoded timeout value.
- **Recommended remediation**: Extract the timeout value to a named constant to clarify intent.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/server/launcher.ts` (Lines: 322)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Oversized file
- **Severity**: ⚪ INFORMATIONAL
- **File**: `src/server/launcher.ts` (Lines: 1-418)
- **Description**: File exceeds 300 lines (contains 418 lines).
- **Recommended remediation**: Consider refactoring and splitting the file into smaller, focused modules.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/server/mcp/summarize.ts` (Lines: 28, 36, 80, 106, 114)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/server/mcp/tools.ts` (Lines: 40, 112, 173, 210, 229, 293, 335, 358, 436, 481, 600)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Oversized file
- **Severity**: ⚪ INFORMATIONAL
- **File**: `src/server/mcp/tools.ts` (Lines: 1-606)
- **Description**: File exceeds 300 lines (contains 606 lines).
- **Recommended remediation**: Consider refactoring and splitting the file into smaller, focused modules.

### Leftover `console.log` statement
- **Severity**: 🔵 LOW
- **File**: `src/server/mcp_server.ts` (Lines: 27, 29)
- **Description**: Debugging statements left in production code.
- **Recommended remediation**: Remove the `console.log` or replace it with a structured logging framework.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/server/mcp_server.ts` (Lines: 29, 30, 41)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Use of `@ts-ignore`
- **Severity**: 🟠 HIGH
- **File**: `src/server/metadata.ts` (Lines: 32)
- **Description**: `@ts-ignore` forcefully silences type errors and can hide critical bugs.
- **Recommended remediation**: Fix the underlying type error or use `@ts-expect-error` if a type violation is unavoidable.

### Magic number in timeout
- **Severity**: ⚪ INFORMATIONAL
- **File**: `src/server/mock-extension-server.js` (Lines: 162, 250)
- **Description**: Hardcoded timeout value.
- **Recommended remediation**: Extract the timeout value to a named constant to clarify intent.

### Leftover `console.log` statement
- **Severity**: 🔵 LOW
- **File**: `src/server/mock-extension-server.js` (Lines: 186, 234, 261, 273, 293)
- **Description**: Debugging statements left in production code.
- **Recommended remediation**: Remove the `console.log` or replace it with a structured logging framework.

### Oversized file
- **Severity**: ⚪ INFORMATIONAL
- **File**: `src/server/mock-extension-server.js` (Lines: 1-331)
- **Description**: File exceeds 300 lines (contains 331 lines).
- **Recommended remediation**: Consider refactoring and splitting the file into smaller, focused modules.

### Leftover `console.log` statement
- **Severity**: 🔵 LOW
- **File**: `src/server/mock-extension-server.ts` (Lines: 183, 201, 212, 233, 242, 247, 353, 359, 390, 424, 441)
- **Description**: Debugging statements left in production code.
- **Recommended remediation**: Remove the `console.log` or replace it with a structured logging framework.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/server/mock-extension-server.ts` (Lines: 235, 268, 294, 357, 362)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Magic number in timeout
- **Severity**: ⚪ INFORMATIONAL
- **File**: `src/server/mock-extension-server.ts` (Lines: 470)
- **Description**: Hardcoded timeout value.
- **Recommended remediation**: Extract the timeout value to a named constant to clarify intent.

### Oversized file
- **Severity**: ⚪ INFORMATIONAL
- **File**: `src/server/mock-extension-server.ts` (Lines: 1-490)
- **Description**: File exceeds 300 lines (contains 490 lines).
- **Recommended remediation**: Consider refactoring and splitting the file into smaller, focused modules.

### Leftover `console.log` statement
- **Severity**: 🔵 LOW
- **File**: `src/server/start-standalone.ts` (Lines: 11, 19, 20, 21, 22, 23, 24, 29, 35, 37)
- **Description**: Debugging statements left in production code.
- **Recommended remediation**: Remove the `console.log` or replace it with a structured logging framework.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/server/start-standalone.ts` (Lines: 41)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/types/events.ts` (Lines: 162, 165)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Excessive use of `any`
- **Severity**: 🟡 MEDIUM
- **File**: `src/types/index.ts` (Lines: 238, 283, 303, 305, 310)
- **Description**: Use of `any` disables TypeScript type checking and can lead to runtime errors.
- **Recommended remediation**: Replace `any` with a more specific type, `unknown`, or generic type parameters.

### Leftover `console.log` statement
- **Severity**: 🔵 LOW
- **File**: `src/types/index.ts` (Lines: 261)
- **Description**: Debugging statements left in production code.
- **Recommended remediation**: Remove the `console.log` or replace it with a structured logging framework.

### Oversized file
- **Severity**: ⚪ INFORMATIONAL
- **File**: `src/types/index.ts` (Lines: 1-439)
- **Description**: File exceeds 300 lines (contains 439 lines).
- **Recommended remediation**: Consider refactoring and splitting the file into smaller, focused modules.

## Code Duplication Analysis
- **Event Handling**: Multiple files (`src/core/cascade/stream-handler.ts`, `src/core/cascade/event-parser.ts`) contain similar logic for catching JSON parse errors and emitting fallback events. These should be centralized into a robust error-handling utility.
- **Service Facade Wrappers**: `src/facade/services.ts` contains excessive duplication of wrapper functions mapping inputs to Protobuf classes and executing RPC calls. This should be refactored into a higher-order generator function or generic proxy to reduce boilerplate.

## Type Safety Assessment
The type safety of the project is severely compromised by the widespread use of `any` and type assertions (`as any`).
- `src/facade/services.ts` heavily uses `as any` to cast Protobuf inputs and outputs, bypassing TypeScript checks entirely. This was likely generated, but the generator (`scripts/generate_facade.ts`) should be updated to output strict types.
- `src/core/cascade/event-parser.ts` and `src/server/mock-extension-server.ts` frequently use `any` when dealing with deeply nested JSON objects or unknown payloads. Using `unknown` and implementing Zod schemas or custom type guards would prevent unexpected runtime shape mismatches.
- The use of `@ts-ignore` in `src/server/metadata.ts` and `src/core/cascade/stream-handler.ts` prevents the compiler from validating interface contracts.

## Files Reviewed
- `src/accounts/oauth.ts`
- `src/accounts/rotator.ts`
- `src/accounts/store.ts`
- `src/accounts/types.ts`
- `src/cli/ag.ts`
- `src/cli/commands/acp.ts`
- `src/cli/commands/extract.ts`
- `src/cli/commands/quota.ts`
- `src/cli/commands/serve.ts`
- `src/cli/repl.ts`
- `src/core/cascade/event-parser.ts`
- `src/core/cascade/index.ts`
- `src/core/cascade/stream-handler.ts`
- `src/core/client.ts`
- `src/facade/index.ts`
- `src/facade/inputs.ts`
- `src/facade/services.ts`
- `src/index.ts`
- `src/proxy/aliases.ts`
- `src/proxy/quota/monitor.ts`
- `src/proxy/routes/anthropic-routes.ts`
- `src/proxy/routes/gemini-routes.ts`
- `src/proxy/routes/openai-routes.ts`
- `src/proxy/server.ts`
- `src/proxy/stealth/fingerprint.ts`
- `src/proxy/stealth/heartbeat.ts`
- `src/proxy/stealth/obfuscator.ts`
- `src/proxy/stealth/prompt-modes.ts`
- `src/proxy/stealth/trace.ts`
- `src/proxy/stealth/warmup.ts`
- `src/reactive/apply.ts`
- `src/server/auth-reader.js`
- `src/server/auth-reader.ts`
- `src/server/index.ts`
- `src/server/launcher.ts`
- `src/server/launcher_mcp.ts`
- `src/server/mcp/diff.ts`
- `src/server/mcp/registry.ts`
- `src/server/mcp/summarize.ts`
- `src/server/mcp/tools.ts`
- `src/server/mcp_server.ts`
- `src/server/metadata.ts`
- `src/server/mock-extension-server.js`
- `src/server/mock-extension-server.ts`
- `src/server/start-standalone.ts`
- `src/types/events.ts`
- `src/types/index.ts`
- `src/utils/autodetect.ts`
