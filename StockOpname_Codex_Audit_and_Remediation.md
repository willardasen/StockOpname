# StockOpname — Comprehensive Code Review, Security Audit & Autonomous Remediation

Act as a Senior Software Engineer, Application Security Engineer, Software Architect, and QA Engineer. Perform a comprehensive, production-readiness code review of my StockOpname desktop application, then implement and verify justified improvements autonomously within the approval boundaries below.

## 1. Repository context

- Repository: https://github.com/willardasen/StockOpname
- Target branch: `update-cal-type-size`
- Application: Offline-first desktop inventory management and stocktaking system.
- Review scope: Entire target branch, not only the differences from `main`.

### Technology stack

- Frontend: React 19, TypeScript, Vite 7
- Desktop framework: Tauri 2
- Native backend: Rust
- Database: SQLite, SQLx, Tauri SQL Plugin
- State management: Zustand 5
- Routing: React Router 7
- Styling: Tailwind CSS 4, Radix UI, shadcn/ui
- Virtualization: TanStack React Virtual
- Password hashing: bcrypt
- Excel export: SheetJS (`xlsx`)
- Native filesystem and dialog: Tauri plugins

Verify these technologies and versions against the current manifests and lockfiles.

### Current architecture

```text
React Views / Components
          |
    Hooks / Zustand Stores
          |
    Repository Layer
          |
    Tauri SQL Plugin
          |
        SQLite

React Frontend
          |
      Tauri IPC
          |
     Rust Commands
          |
   SQLite / Filesystem
```

The application includes authentication, product management, brand management, stock-in, stock-out, stock adjustment, global stocktaking, transaction history, sales reports, Excel export, database backup/restore, and stock reset.

## 2. Mandatory instructions and approval boundaries

- Read `AGENTS.md` and any applicable nested repository instructions before starting.
- Verify that the target branch is `update-cal-type-size`. Record the starting commit and working-tree status. If the branch is incorrect, do not modify another branch or switch in a way that risks existing changes; report the blocker if it cannot be resolved safely.
- Perform a read-only audit and establish a baseline before implementing fixes. After the audit and planning phases, proceed autonomously with authorized remediation as defined in Section 17.
- Preserve all pre-existing user changes, including staged, unstaged, and untracked work. Never reset, overwrite, or revert unrelated work.
- Do not commit, push, merge, or create pull requests without explicit approval.
- Never execute destructive operations against production or existing user databases. Use isolated temporary databases and environments for validation.
- Inspect the actual implementation rather than making assumptions based on filenames.
- Trace business logic across components, hooks, stores, repositories, Rust commands, and database queries.
- Avoid generic recommendations that are not applicable to this project.
- Preserve the offline-first desktop architecture unless there is a compelling, evidence-based reason to change it.
- Distinguish confirmed issues, potential risks, intentional business behavior, and optional improvements.
- Identify existing good practices and avoid unnecessary refactoring.
- Do not expose credentials, password hashes, or sensitive business data in reports or logs.
- During remediation, you may modify source code, configuration, tests, and documentation as needed. Make justified dependency updates only when compatible, necessary, and verified; keep manifests and lockfiles consistent.

Request explicit approval before changing fundamental inventory business rules, implementing destructive or backward-incompatible database migrations, removing existing features, performing a major architectural rewrite, introducing external paid services, accessing or modifying real production databases, or committing/pushing/merging changes. Continue independent safe work when another finding is blocked on approval. Do not treat approval as permission to disregard sandbox or environment restrictions.

## 3. Security audit

### A. Authentication and authorization

Review:

- `src/repositories/AuthRepo.ts`
- `src/stores/authStore.ts`
- `src/components/common/ProtectedRoute.tsx`
- `src/repositories/db.ts`
- `src-tauri/src/commands.rs`
- `src-tauri/src/stock_reset.rs`

Preliminary inspection identified the following areas requiring verification:

1. Authentication state is determined by the existence of a user object in `localStorage`.
2. Frontend route protection relies on Zustand authentication state.
3. A hardcoded default administrator credential exists in database initialization.
4. Database initialization contains a plaintext password fallback outside the Tauri environment.
5. Password hashes are retrieved into the frontend before verification by Rust.
6. Several database operations accept user IDs originating from the frontend.
7. Some transaction operations fall back to the first available database user when the supplied user ID is invalid.
8. The database schema intentionally has no user roles.
9. Rust commands and SQL plugin operations may not enforce consistent authentication and authorization boundaries.

Investigate:

- Authentication bypass and session tampering.
- Stale sessions after database restoration.
- Password hashing, password policy, and login brute-force protection.
- Unauthorized database operations and user impersonation.
- User management and account deletion.
- Authorization of destructive operations.
- Exposure of sensitive information and credential leakage.
- Session expiration or inactivity locking where appropriate.

Use a realistic threat model for an offline desktop application. Distinguish between ordinary application users, compromised webview content, malicious imported files, and attackers who already have operating-system-level access. Do not blindly recommend JWT, OAuth, or a remote authentication server unless justified.

### B. Tauri security

Review:

- `src-tauri/tauri.conf.json`
- `src-tauri/tauri.dev.conf.json`
- `src-tauri/capabilities/default.json`
- `src-tauri/src/lib.rs`
- All registered Tauri commands.

Specifically investigate:

- Content Security Policy currently configured as `null`.
- Broad filesystem permissions, including `fs:read-all` and `fs:write-all`.
- Direct SQL execution permissions exposed to the frontend.
- Tauri IPC trust boundaries and principle of least privilege.
- Command-level authentication and authorization.
- Arbitrary file read/write risks.
- Path validation and symbolic-link handling.
- Webview injection and XSS exposure.
- Development versus production configuration.
- Whether sensitive operations should be migrated into narrowly scoped Rust commands.

Evaluate practical exploitability instead of treating every permissive configuration as an automatically confirmed vulnerability.

### C. Dependency security

Review `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, and `src-tauri/Cargo.lock`.

Check known vulnerabilities and CVEs, vulnerable transitive dependencies, outdated or unmaintained packages, supply-chain risks, unnecessary dependencies, compatibility and version conflicts, and Rust and JavaScript dependency security.

Pay particular attention to the installed SheetJS `xlsx` version, including its distribution source and any applicable vulnerabilities. Use current vulnerability databases where available. Do not invent CVEs or report unverified dependency vulnerabilities as confirmed findings. Evaluate runtime exposure and upgrade compatibility.

## 4. Database integrity and transaction safety

This section is one of the highest priorities because incorrect inventory quantities can directly affect business operations.

Review:

- `src/repositories/db.ts`
- `src/repositories/ProductRepo.ts`
- `src/repositories/TransactionRepo.ts`
- `src/repositories/GlobalOpnameRepo.ts`
- `src/repositories/stockWrites.ts`
- `src/stores/productStore.ts`
- `src/stores/transactionStore.ts`
- `src/stores/brandStore.ts`

### A. Atomicity and concurrency

Preliminary inspection indicates several inventory operations update product stock and transaction history through separate database calls.

Investigate:

- Missing atomic database transactions and partial writes when operations fail.
- Race conditions, lost updates, concurrent stock-in and stock-out.
- Repeated form submissions and duplicate transactions.
- Database locking and busy errors.
- Failure during product creation with initial stock.
- Failure during transaction editing, deletion, or stock adjustment.
- Application termination during database writes.
- Multi-window or multi-process concurrency.

Review whether `trackStockWrite()` actually serializes stock modifications or merely tracks pending writes and prevents concurrent resets. Determine which operations require a real SQLite transaction or a dedicated Rust-side transaction service.

Verify transaction behavior with the SQLx connection pool. Do not assume that executing `BEGIN` and `COMMIT` through separate frontend plugin calls guarantees connection affinity or atomicity.

### B. Database schema

Review all tables, constraints, relationships, migrations, indexes, and data types. Check:

- Missing `NOT NULL` and `CHECK` constraints.
- Negative inventory quantities, invalid transaction quantities, decimal quantities where integers are required, numeric overflow, and JavaScript safe-integer limitations.
- Invalid `pcs_per_box` or `calculation_type` values.
- Duplicate product variants.
- Referential integrity and foreign-key enforcement across pooled connections.
- Cascade deletion behavior and orphaned records.
- Case-sensitive versus case-insensitive uniqueness.
- Database normalization and whether brands/related attributes should reference IDs instead of mutable names.
- Missing or inefficient indexes, query performance, and execution plans.

### C. Database migrations

Investigate repeated startup `ALTER TABLE` statements, swallowed migration errors, lack of explicit schema version tracking, migration atomicity, compatibility with older production databases, interrupted migrations, data preservation, rollback/recovery, and whether automatic creation of missing initial-stock transactions could produce inaccurate historical records.

Recommend and, where safe, implement a versioned incremental migration strategy that preserves existing user data. Never fabricate missing historical data or silently discard incompatible records.

## 5. Inventory business logic audit

Review all inventory operations end to end.

### A. Stock-in and stock-out

Verify correct additions and deductions, validation at UI and persistence boundaries, prevention of unintended negative stock, behavior with insufficient inventory, inactive/deleted products, initial stock creation, duplicate submissions, historical transaction dates, correct user attribution, and consistency between current inventory and transaction history.

### B. Transaction editing and deletion

Pay special attention to `TransactionRepo.ts`.

Preliminary inspection indicates:

- Stock quantities and transaction records are updated separately.
- Editing an old transaction updates its own stock snapshot but may leave subsequent snapshots unchanged.
- Adjustment transactions store absolute differences using `Math.abs(diff)`.
- Deleting an adjustment transaction appears to remove the record without reverting inventory changes.
- Invalid user IDs can be replaced with another user's ID.

Investigate the correctness of these behaviors. Determine whether the inventory ledger can reliably reconstruct historical stock and explain any limitations. Evaluate whether historical transactions should be editable/deletable or corrected through compensating transactions. Do not change the existing business policy without explaining the consequences and obtaining approval.

### C. BOX and SIZE calculation types

This is a particular focus of the target branch. Review:

- `src/components/common/ProductFormModal.tsx`
- `src/components/transactions/StockTransactionForm.tsx`
- `src/components/transactions/StockTransactionTable.tsx`
- `src/hooks/useProductForm.ts`
- `src/hooks/useStockOpname.ts`
- `src/views/BrandManager.tsx`
- `src/views/StockOpname.tsx`
- `src/views/StockTransactionPage.tsx`
- `src/views/SalesReport.tsx`
- `src/repositories/ProductRepo.ts`
- `src/types/database.ts`

Verify:

- BOX-to-PCS conversion and SIZE-based quantities.
- Consistent units: Box, Pcs, Pasang.
- Correct calculations across all screens.
- Zero, negative, decimal, empty, and extremely large inputs.
- Incorrect rounding and parsing.
- Switching products or calculation types.
- Changing `pcs_per_box` after historical transactions exist.
- Changing a brand's calculation type.
- Duplicate variants across brands, colors, type numbers, and sizes.
- Backward compatibility with products created before SIZE support.
- Historical reports for products whose brand metadata changes.
- Whether totals incorrectly combine different units of measurement.

Identify duplicated calculation logic and evaluate whether a centralized inventory-domain utility would improve correctness.

### D. Global stocktaking

Review `src/views/StockOpname.tsx`, `src/hooks/useStockOpname.ts`, and `src/repositories/GlobalOpnameRepo.ts`.

Investigate global versus per-product stocktaking, brand-specific stocktaking, the `UNIQUE` constraint on `global_opname.date` despite the presence of a brand field, multiple brands on the same day, duplicate or overwritten records, stale inventory during physical counting, accuracy of system stock/physical stock/differences, daily stock-in/out totals, historical reporting, and whether global stocktaking intentionally records discrepancies without modifying individual inventory.

Determine intended business behavior before recommending schema or logic changes.

### E. Stock reset

Review `src-tauri/src/stock_reset.rs`, `src/components/common/ResetStockAction.tsx`, `src/repositories/stockWrites.ts`, and `src/repositories/db.ts`.

Verify password reauthentication, authorization, atomicity and rollback, concurrent reset versus inventory writes, multiple reset requests, reset versus restoration, deletion of transaction and stocktaking history, preservation of users/products/brands/master data, reset auditability, backup requirements, and UI/Zustand state consistency after reset.

The Rust implementation already uses `BEGIN IMMEDIATE` and contains unit tests for password validation, master-data preservation, and rollback. Review these safeguards and identify missing coverage rather than assuming the reset operation is entirely unprotected.

## 6. Database backup and restore

Review `src-tauri/src/commands.rs`, `src/views/Layout.tsx`, `src/repositories/db.ts`, and `src/repositories/stockWrites.ts`.

Preliminary inspection indicates the database uses WAL mode while backup and restore rely on `std::fs::copy()`.

Investigate:

- Whether copying only the main SQLite file omits committed data still present in WAL.
- Backup consistency during active writes, corruption risks, WAL/SHM file handling, and connection-pool lifecycle.
- Importing invalid, corrupted, incompatible, or malicious database files.
- File extension versus actual database validation, integrity checks, and schema compatibility.
- Atomic database replacement, automatic backup before restoration, and rollback on failure.
- Concurrent operations during restoration and stale authenticated sessions afterward.
- Development versus production database path consistency.
- Filesystem permissions for backup files and exposure of password hashes or sensitive business information.

Evaluate whether SQLite's native backup API or another SQLite-supported consistent snapshot mechanism is more appropriate than direct file copying. Prioritize prevention of permanent data loss.

## 7. Architecture and software design

Review the overall project structure:

```text
src/
  components/
    common/
    transactions/
    ui/
  hooks/
  lib/
  repositories/
  stores/
  types/
  utils/
  views/

src-tauri/
  capabilities/
  src/
    commands.rs
    lib.rs
    main.rs
    stock_reset.rs
```

Evaluate separation of concerns, dependency direction, SOLID where practical, DRY/KISS/YAGNI, repository pattern consistency, business logic placement, coupling/cohesion, separation of presentation/application/domain/persistence logic, Zustand store responsibilities, direct database access outside repositories, circular dependencies, single source of truth, type safety across TypeScript and Rust, error propagation, scalability, and maintainability.

Determine whether introducing a lightweight service or domain layer would be beneficial, especially for transactions, authentication, calculations, and restoration. Do not recommend Clean Architecture, DDD, microservices, or additional frameworks simply for architectural purity. Recommend the minimum architecture necessary for a reliable desktop inventory system.

## 8. Frontend and React code quality

Review all React components, views, hooks, and Zustand stores. Investigate:

- Incorrect `useEffect` dependencies, stale closures, async race conditions, unnecessary re-renders, inefficient state subscriptions, and redundant derived state.
- Improper lifecycle handling and missing cleanup.
- Unsafe type assertions, excessive `any`, null/undefined handling, and inconsistent errors.
- Duplicated logic and components with too many responsibilities.
- Loading and error states, form submission, optimistic updates, and refresh after mutations.
- Accessibility, keyboard navigation, confirmation dialogs, and accidental destructive actions.

Pay particular attention to `StockOpname.tsx`, `BrandManager.tsx`, `ProductFormModal.tsx`, `StockTransactionPage.tsx`, and `StockTransactionTable.tsx`. Identify components that genuinely benefit from decomposition, but do not split components solely because of line count.

## 9. Performance and scalability

Evaluate the application at approximately 1,000, 10,000, and 100,000 products, and with large historical transaction datasets. These are stress-test scenarios, not assumed actual business requirements.

Investigate unbounded queries, inefficient joins and aggregations, N+1 queries, missing indexes, full-table scans, leading-wildcard searches, SQL functions that prevent index utilization, search debounce, pagination, hardcoded limits, whether the 5,000-product limit silently omits inventory, initialization overhead, React rendering, Zustand subscriptions, virtualization, Excel memory usage, database lock contention, startup time, bundle size, and Rust blocking operations.

Recognize existing optimizations, including lazy-loaded views, virtualized tables, and dynamic Excel imports. Only recommend additional optimizations when justified by measurable or realistically demonstrated bottlenecks.

## 10. Date, time, and reporting correctness

Review the mixture of SQLite `CURRENT_TIMESTAMP`, JavaScript `new Date()`, `toISOString()`, local-time formatting, `date-fns`, and manually constructed transaction dates.

Check UTC versus local timezone inconsistencies, midnight boundaries, daily/monthly reports, historical ordering, backdated transactions, inclusive/exclusive date ranges, and behavior across operating-system timezones. Pay particular attention to Indonesian timezones, including UTC+7.

Review Excel export for correct quantities, units, dates, large dataset handling, spreadsheet formula injection where applicable, consistency with displayed data, sensitive data exposure, file overwrite, and error handling.

## 11. Rust code quality

Review all Rust source files for error handling, panics, unnecessary production `unwrap()` usage, blocking operations, async runtime behavior, SQLx transaction correctness, connection management, resource cleanup, frontend-facing errors, filesystem safety, command argument validation, password verification, serialization, and platform compatibility.

Distinguish acceptable `unwrap()` usage in tests from unsafe production usage.

## 12. Testing and quality assurance

Identify missing test coverage across frontend, repositories, inventory business logic, migrations, and native commands. Inspect existing Rust stock-reset tests.

Recommend and implement practical tests covering unit tests, repository integration tests with isolated SQLite databases, inventory calculations, authentication/authorization, concurrency, failure injection/rollback, migrations, backup/restore, React components, end-to-end desktop workflows where feasible, and regression tests.

At minimum, design and run applicable tests for:

1. Concurrent stock-out transactions.
2. Failure after updating stock but before inserting transaction history.
3. Editing and deleting historical transactions.
4. Deleting positive and negative stock adjustments.
5. Creating a product with initial stock.
6. BOX and SIZE calculations.
7. Multiple brand stocktaking records on the same day.
8. Negative and invalid quantities.
9. Database backup while WAL contains committed changes.
10. Importing an invalid database.
11. Interrupted restoration.
12. Stock reset during pending inventory writes.
13. Invalid authentication state.
14. Stale sessions after restoration.
15. Transaction dates around local midnight.
16. Migration from an older database version.

If a test depends on an unresolved business decision, describe it and do not silently encode an assumed policy.

## 13. Static analysis and verification

Where the environment permits, establish a baseline and repeat relevant checks after changes:

```bash
git status --short
git branch --show-current
git rev-parse HEAD

npm run lint
npm run build
npm audit

cargo check --manifest-path src-tauri/Cargo.toml --locked
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --locked -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --locked
```

Use `cargo audit` if available. During the initial audit, install dependencies or generate build artifacts only in an isolated environment when necessary and permitted. Do not modify the original working tree or lockfiles during that phase.

During remediation, targeted formatting and reviewed dependency updates are permitted when necessary for authorized changes. Do not run `npm audit fix` blindly, automated broad refactoring, or destructive Git commands. Do not change unrelated files to resolve pre-existing warnings.

If a command cannot run due to missing dependencies, platform requirements, network access, or Tauri system libraries, explicitly report the limitation. Never claim a test passed without running it.

## 14. Dead code and maintainability

Identify unused imports, components, functions, dependencies, duplicate functionality, obsolete comments, debug logs, temporary scripts, development-only code exposed in production, unnecessary assets, inconsistent naming/conventions, and missing documentation.

Review `README.md`, `AGENTS.md`, development setup, production build instructions, and database recovery documentation. Remove dead code only after verifying that it is genuinely unused.

## 15. Required audit output

Provide the review report in Bahasa Indonesia while retaining standard English technical terminology. Record baseline findings in `AUDIT_REPORT.md` after the read-only audit; continue updating the report as remediation progresses. Do not stop after writing the initial report.

### A. Executive summary

Explain overall code quality, architecture maturity, security posture, database reliability, inventory correctness, production readiness, important risks, and existing strengths.

### B. Current architecture

Provide verified technology stack, Mermaid architecture diagram, directory analysis, data flow, authentication flow, inventory transaction flow, backup/restore flow, trust boundaries, and architectural strengths and weaknesses.

### C. Project scorecard

Score each category from 0–10 and justify the score. Explain scoring criteria and avoid false precision.

| Category | Score | Justification |
|---|---|---|
| Security | | |
| Authentication and authorization | | |
| Architecture | | |
| Code quality | | |
| Database integrity | | |
| Business logic correctness | | |
| Reliability and recovery | | |
| Performance | | |
| Maintainability | | |
| Test coverage | | |
| Production readiness | | |

### D. Findings

Classify findings by severity:

- **Critical:** Severe, realistically exploitable security issues or credible permanent data loss.
- **High:** Significant security, inventory integrity, or reliability issues.
- **Medium:** Important correctness, maintainability, or performance problems.
- **Low:** Minor improvements.
- **Informational:** Observations and optional enhancements.

For each finding provide:

- Finding ID, title, severity, confidence level, and category.
- Status: Confirmed / Potential / Requires verification.
- File path and exact line numbers (identify the reviewed commit where relevant).
- Relevant code evidence, root cause, triggering conditions.
- Technical and business impact.
- Safe reproduction scenario.
- Recommended and alternative solutions where appropriate.
- Estimated effort, regression risk, and suggested tests.

Consolidate duplicate findings that share the same root cause.

### E. Prioritized remediation roadmap

- **P0 — Immediate:** Severe security risks, corruption, permanent data loss, incorrect inventory balances.
- **P1 — High priority:** Authentication, transaction safety, database reliability, backup/restore improvements.
- **P2 — Medium priority:** Architecture, testing, maintainability, business logic consolidation.
- **P3 — Optional:** Performance, developer experience, minor code quality improvements.

For each recommendation include affected files, dependencies, estimated effort, expected benefit, and regression risk. Identify the highest-value incremental improvements without rewriting the entire application.

### F. Proposed target architecture

Provide a pragmatic target architecture only if justified. Explain which existing components remain, which responsibilities move, which operations stay in TypeScript, which sensitive or atomic operations move to Rust, database access structure, centralized inventory logic, and preservation of existing features and data.

### G. Verdict

Conclude whether the application is suitable for daily business operations and real inventory data, what scenarios could cause incorrect balances or data loss, what must be fixed before production use, the five highest-impact improvements, and whether incremental refactoring or major redesign is justified.

## 16. Preliminary inspection and limitations

The preliminary observations in this prompt are based on selected source files and the repository tree on branch `update-cal-type-size`, not a completed security audit or executed test suite. Verify each observation independently against the current branch and discover additional issues.

Clearly disclose files/modules reviewed, tests and commands actually executed, unverified findings, environment limitations, assumptions about intended business behavior, and areas requiring manual validation. Do not exaggerate the number or severity of issues.

## 17. Autonomous review, remediation, and verification

**Do not stop after producing the code review report or the implementation plan.** Act as the lead engineer responsible for improving this application's security, reliability, correctness, maintainability, and production readiness. Execute these phases sequentially, subject to Section 2.

### Phase 1 — Comprehensive audit

- Perform the entire code review and security audit above.
- Inspect the entire codebase, identify confirmed bugs, vulnerabilities, architectural weaknesses, data integrity issues, and missing tests.
- Establish a baseline using available build, lint, and testing commands.
- Produce a prioritized list of findings.

### Phase 2 — Implementation planning

Create a structured remediation plan based on severity, dependencies, effort, and regression risk. Prioritize:

1. Security vulnerabilities.
2. Database corruption and data loss prevention.
3. Inventory calculation and transaction correctness.
4. Authentication and authorization.
5. Backup and restoration reliability.
6. Error handling.
7. Automated testing.
8. Architecture and code quality.
9. Performance optimization.
10. Documentation and dead code cleanup.

### Phase 3 — Implement fixes

Proceed autonomously with confirmed, justified improvements.

- Fix root causes rather than symptoms.
- Implement changes in small, logically grouped increments.
- Follow `AGENTS.md` and existing project conventions.
- Preserve functionality, workflows, offline-first architecture, and existing production database compatibility.
- Implement safe migrations where necessary and add regression tests for every significant fix.
- Avoid unnecessary dependencies and overengineering.
- Remove dead code only after confirming it is unused.
- Do not introduce breaking changes without justification and required approval.
- For ordinary bug fixes, security hardening, non-breaking refactoring, and testing improvements, proceed without requesting individual approval.
- For risky decisions, follow the explicit approval boundaries in Section 2. Document deferred work and continue independent safe fixes.

### Phase 4 — Continuous verification

After every logical group of changes:

- Review the Git diff, including unintended file modifications.
- Run relevant lint/type checks, frontend build, Rust checks/tests, and regression tests.
- Verify existing functionality remains intact and fix introduced regressions before continuing.

Use isolated temporary SQLite databases. Never use real business inventory data for destructive testing. Do not suppress lint errors, disable security controls, or remove failing tests simply to make verification pass.

### Phase 5 — Final review

Perform another comprehensive review of the modified codebase. Verify original findings, identify newly introduced issues, review remaining risks, verify inventory consistency and migration safety, verify backup/restore behavior, and identify remaining limitations and technical debt.

Repeat review and remediation where necessary until no additional confirmed high-priority issues remain that can safely be addressed within the available environment. Do not claim production readiness merely because automated checks pass.

### Phase 6 — Final report

Provide a comprehensive final report in Bahasa Indonesia containing:

- Executive summary.
- Original findings and severity.
- Issues resolved, partially resolved, remaining, and deferred pending approval (with reasons).
- Files modified and architectural changes.
- Database schema and migration changes.
- Security improvements.
- Tests added and actual test, lint, build, and dependency audit results.
- Dependency changes and regression risks.
- Before-and-after project scorecard with evidence-based justification.
- Remaining production-readiness requirements.
- Manual testing checklist and safe deployment/rollback considerations.
- Final working-tree status and confirmation that no commits, pushes, merges, or pull requests were made without approval.

Maintain `AUDIT_REPORT.md` to track findings, implementation progress, decisions, and verification results. Do not claim that an issue is fixed unless the implementation has been verified. Do not claim a test passed unless it was actually executed.

Work autonomously through all phases. Only pause for decisions requiring approval, genuine blockers, or significant risks to existing functionality or user data. If the available environment cannot complete the full audit, leave a clear record of completed work and actionable remaining tasks.

**Ultimate goal:** Make StockOpname a secure, reliable, maintainable, and production-ready desktop inventory application without unnecessary architectural complexity or loss of existing business data.
