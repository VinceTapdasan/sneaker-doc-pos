# Backend Hardening Checklist

Reusable audit checklist derived from the SneakerDoc POS backend audit (2026-03-13).
Use this when building or reviewing any NestJS + Drizzle + Supabase backend.

---

## HIGH — Must Fix Before Demo/Launch

### 1. DTO Validation on All Endpoints
- [ ] `class-validator` and `class-transformer` installed
- [ ] Global `ValidationPipe` registered in `main.ts` with `whitelist: true` and `transform: true`
- [ ] Every `@Body()` parameter uses a DTO class (no inline `body: { ... }` types)
- [ ] DTOs have proper decorators: `@IsString()`, `@IsNumber()`, `@IsOptional()`, `@IsIn([...])` for enums, `@Matches()` for date formats
- [ ] Nested objects use `@ValidateNested({ each: true })` + `@Type(() => ...)`
- [ ] `forbidNonWhitelisted: false` for safer rollout (strips unknown fields silently)

### 2. Auth Guards on ALL Endpoints
- [ ] Every controller has `@UseGuards(SupabaseAuthGuard)` at class level or on every route
- [ ] GET/list endpoints are NOT accidentally unprotected (common miss — guards only on write routes)
- [ ] Role-based guards (`@Roles(...)`) applied where needed

### 3. Race Conditions on Sequential ID Generation
- [ ] Any `MAX(id) + 1` pattern uses `pg_advisory_xact_lock()` or database sequences
- [ ] Transaction number / invoice number generation is concurrency-safe
- [ ] Test: two simultaneous requests should never get the same number

### 4. Role Escalation Prevention
- [ ] "Update user role" endpoint restricted to highest privilege level (superadmin)
- [ ] Admins cannot promote themselves or others to superadmin
- [ ] Role changes are audit-logged with before/after values

### 5. File Upload Restrictions
- [ ] File type allowlist enforced server-side (not just frontend)
- [ ] Extension validation via regex: `^\.?(jpg|jpeg|png|webp|heic)$` (adjust per use case)
- [ ] Presigned URL generation checks user has access to the parent resource (e.g., transaction branch)

### 6. Email Domain Allowlist (Optional)
- [ ] Consider `ALLOWED_EMAIL_DOMAINS` env var for OAuth-based auto-provisioning
- [ ] When set, only emails from listed domains can create accounts
- [ ] When unset, provisioning is open (useful for early-stage / internal tools)

---

## MEDIUM — Fix Before Production Traffic

### 7. Soft-Delete Instead of Hard Delete
- [ ] All user-facing "delete" operations use soft-delete (`deletedAt` column)
- [ ] ALL queries filter `isNull(deletedAt)` — check SELECT, SUM, COUNT, and JOIN queries
- [ ] Dedicated "deleted/archived" view for admin recovery
- [ ] Hard delete reserved for GDPR/compliance or admin-only cleanup

### 8. Branch/Tenant Scoping on Every Endpoint
- [ ] Multi-branch/multi-tenant systems scope ALL queries to the user's branch
- [ ] Superadmin bypasses scope (sees all); admin/staff always scoped
- [ ] Single-record operations (GET by ID, UPDATE, DELETE) verify branch ownership before acting
- [ ] Reports and aggregation queries apply branch filters server-side (not trusting frontend params)

### 9. Resource Existence Checks on Foreign Keys
- [ ] Onboarding / assignment endpoints verify the target resource exists and is active
- [ ] Branch assignment checks `branches.isActive = true`
- [ ] Don't rely solely on DB foreign key constraints — they don't check `isActive`

### 10. Negative Balance / Underflow Guards
- [ ] Any upsert that adjusts a running total checks the result won't go negative
- [ ] Financial operations (deposits, refunds, credits) validate bounds before writing
- [ ] Return clear error messages: "Balance for X cannot go below zero"

### 11. Required Fields Based on Context
- [ ] Conditional required fields enforced server-side (e.g., `origin` required when `method = bank_deposit`)
- [ ] Don't rely on frontend form logic alone — backend must enforce the same rules

### 12. Distinct Audit Types for Distinct Actions
- [ ] Soft-delete and status-change-to-cancelled are different actions — use different audit types
- [ ] Every meaningful state change has its own audit type constant
- [ ] Audit log should answer "what happened?" without ambiguity

### 13. Superadmin Bypass for Ownership Requirements
- [ ] Superadmin should not be blocked by "must have own branch" checks
- [ ] Superadmin can act on behalf of any branch (pass target branch explicitly)
- [ ] Regular users remain scoped to their own branch

---

## LOW — Fix for Operational Excellence

### 14. Audit Log Resilience
- [ ] `AuditService.log()` wrapped in try/catch — audit failures never break primary operations
- [ ] Failed audit writes logged to stderr/Logger with full context (action, entity, error)
- [ ] Consider async/fire-and-forget for audit writes if latency matters

### 15. External Service Error Surfacing
- [ ] SMS, email, and payment gateway calls throw on failure (not silently return)
- [ ] Explicit user-triggered sends (e.g., "Send SMS" button) surface errors to the caller
- [ ] Auto-triggered background sends (e.g., reschedule notification) catch errors without blocking the primary operation
- [ ] All external API calls log before/after with status codes

### 16. Date Validation on Financial Records
- [ ] Expense/transaction creation rejects future dates
- [ ] Backdating limited to a reasonable window (e.g., 7 days) to prevent data manipulation
- [ ] Admin override available if legitimate late entries are needed

### 17. Consistent Delete Patterns
- [ ] Pick one pattern (soft-delete vs hard-delete) and apply consistently across all entities
- [ ] Document which entities use which pattern and why
- [ ] Ensure cascading deletes don't accidentally hard-delete soft-deleted parent's children

---

## Cross-Cutting Concerns

### Logging
- [ ] No silent `catch { return null }` blocks — every catch logs the error
- [ ] External API calls log request intent and response status
- [ ] Decision points (guards, feature flags, fallbacks) log what was decided and why
- [ ] Use structured `[Component]` prefixes for log filtering

### Money Handling
- [ ] All monetary values stored as integers (scaled by constant factor, e.g., 100,000)
- [ ] `toScaled()` / `fromScaled()` helpers used consistently — never raw float math
- [ ] API responses return human-readable amounts; database stores scaled integers

### Frontend-Backend Alignment
- [ ] Every `lib/api.ts` endpoint has a matching backend route
- [ ] Parameter names match between frontend calls and backend DTOs (e.g., `dateKey` not `date`)
- [ ] Response shapes match what the frontend destructures

### Migration Safety
- [ ] New columns are nullable or have defaults — never break existing rows
- [ ] Schema changes tested against production-like data volume
- [ ] Drizzle schema file matches actual database state (verify with `drizzle-kit pull` if available)
