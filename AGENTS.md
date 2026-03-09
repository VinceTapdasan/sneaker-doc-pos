# AGENTS.md — SneakerPOS

## Project Overview
SneakerPOS is a point-of-sale system for a sneaker cleaning shop. pnpm monorepo with two packages:
- `backend/` — NestJS 11 + Drizzle ORM + Supabase Auth
- `frontend/` — Next.js 15 App Router + TanStack Query + shadcn/ui + Tailwind CSS v4

Database is Supabase Postgres. Auth is Supabase (Google OAuth + JWT).

## Quick Start
```bash
pnpm install          # from root — installs both packages
pnpm dev              # frontend on :3000
pnpm backend          # backend on :3001 (watch mode)
```

Env files required (not committed):
- `backend/.env` — see `backend/.env.example`
- `frontend/.env` (or `.env.local`) — see `frontend/.env.example`

## Architecture References
- `ARCHITECTURE.md` — full system walkthrough (schema, auth flow, patterns, non-obvious decisions)
- `RBAC.md` — role-based access control: route protection matrix, guard layers, enforcement details

Read these before making significant changes.

## Codebase Structure

### Backend (`backend/`)
NestJS module-per-feature layout:
```
backend/src/
  app.module.ts            # root module — imports all feature modules
  auth/                    # SupabaseAuthGuard, RolesGuard, @Roles decorator
  db/                      # DrizzleService, schema.ts, constants.ts
  audit/                   # AuditService (@Global — available everywhere)
  transactions/            # core feature: CRUD, payments, item status
  services/                # service catalog (primary / add_on)
  promos/                  # discount codes (soft-delete)
  expenses/                # daily operating costs
  customers/               # customer lookup by phone
  users/                   # user provisioning, role management
  branches/                # multi-branch support
  deposits/                # monthly deposit tracking per payment method
  uploads/                 # presigned URL generation for image uploads
  email/                   # Resend integration (scaffold)
  supabase/                # Supabase client wrapper
  utils/money.ts           # toScaled() / fromScaled() — money conversion
```

Each feature module follows: `module.ts` → `controller.ts` → `service.ts` → `dto/*.ts`

### Frontend (`frontend/`)
```
frontend/
  app/(auth)/login/        # login page
  app/(app)/               # all protected routes (shared layout with sidebar)
  app/auth/callback/       # Supabase OAuth callback handler
  app/onboarding/          # branch selection for new users
  components/              # shared components, shadcn/ui in components/ui/
  components/deposits/     # DepositHistoryDialog
  hooks/                   # TanStack Query hooks (one file per domain)
  lib/api.ts               # all API calls — single apiFetch<T>() helper
  lib/types.ts             # all domain type definitions
  lib/ph-geo.ts            # PH geography data: province → city → barangay[], plus lookup helpers
  lib/constants.ts         # enums and constants
  lib/utils.ts             # cn(), formatPeso(), formatDate(), formatAddress(), etc.
  columns/                 # TanStack Table column definitions
  providers/               # React context providers (QueryClient, etc.)
  proxy.ts                 # Next.js edge middleware (session gate)
  middleware.ts            # re-exports proxy.ts
```

## Key Conventions

### Backend
- **Module pattern**: every feature is a NestJS module with its own controller and service. Business logic lives in services, never controllers.
- **Auth**: `@UseGuards(SupabaseAuthGuard)` on every protected route. Add `@UseGuards(SupabaseAuthGuard, RolesGuard)` + `@Roles(...)` for role-restricted routes. Any module using `RolesGuard` must import `UsersModule`.
- **DTOs**: use class-based DTOs in `dto/` subdirectories for request validation.
- **Money**: all monetary values stored as `bigint` in centavos (×100,000). Use `toScaled()` before DB writes and `fromScaled()` after reads. `AMOUNT_CONVERSION_RATE=100000`. Never store or return raw centavo values to the frontend.
- **Audit**: call `this.audit.log(...)` after any meaningful mutation. `AuditModule` is `@Global()` — inject `AuditService` directly, no module import needed.
- **Schema**: defined in `backend/src/db/schema.ts` using Drizzle. Relations are for query builder only — actual FK constraints are inline on columns via `.references()`.
- **Migrations**: `pnpm db:generate` creates SQL files in `backend/migrations/`. `pnpm db:migrate` runs them. **NOTE: drizzle-kit is broken for squash migrations** (`checkValue.replace` TypeError). Apply schema changes directly via `psql ALTER TABLE` statements for now.
- **TypeScript**: `noImplicitAny: false`, `strictNullChecks: true`. Module system is `nodenext`.
- **Formatting**: Prettier with `singleQuote: true`, `trailingComma: 'all'`.

### Frontend
- **All API calls go through `lib/api.ts`** — never raw `fetch()` in components.
- **All domain types in `lib/types.ts`** — never redeclare inline.
- **TanStack Query for all server state** — `useState` only for ephemeral UI state (modals, filters).
- **Query hooks in `hooks/use{Domain}Query.ts`** — one file per domain, export query keys alongside hooks. Never define `useQuery`/`useMutation` inline in page components.
- **Forms**: `react-hook-form` + `zod` + `@hookform/resolvers`. Form components live in `components/forms/`.
- **Components**: named exports only (`export function`, never `export default` for components). Use `cn()` for conditional classNames. Extend `ComponentProps<'element'>` for prop interfaces.
- **Mobile-first**: base styles for mobile, use `sm:`/`md:`/`lg:` breakpoint prefixes to scale up. Grids start single-column. Tables wrap with `overflow-x-auto`.
- **Design tokens**: `bg-zinc-950` (primary dark), `bg-zinc-50` (page bg), `border-zinc-200` (borders), `text-zinc-400`/`text-zinc-500` (muted text), `bg-blue-500` (accent, sparingly).
- **Motion**: `150-200ms ease-out` transitions only. No infinite animations.
- **UI library**: shadcn/ui (new-york style, neutral base, CSS variables). Icon libraries: `lucide-react` and `@phosphor-icons/react`.
- **Routing**: Next.js App Router. `(auth)` and `(app)` are route groups (no URL effect). Protected route layouts use `RequireAdmin` / `RequireSuperadmin` / `OnboardingCheck` components.
- **Money on frontend**: received as decimal strings (`"1234.56"`), formatted with `formatPeso()`. Frontend never handles centavos.
- **TypeScript**: strict mode. `@typescript-eslint/no-unused-vars` errors on unused vars (prefix with `_` to ignore).
- **Formatting**: Prettier with `singleQuote: true`, `trailingComma: 'all'`, `semi: true`, `printWidth: 100`.

## Adding a New Feature

### Backend
1. Generate or create a new module folder under `backend/src/{feature}/`
2. Create `{feature}.module.ts`, `{feature}.controller.ts`, `{feature}.service.ts`
3. Add DTOs in `{feature}/dto/`
4. If the feature needs a new table, add it to `backend/src/db/schema.ts` and apply via `psql ALTER TABLE` (drizzle-kit migrate is broken — see Migrations note above)
5. Register the module in `app.module.ts`
6. Add `@UseGuards(SupabaseAuthGuard)` to protected routes. Add `RolesGuard` + `@Roles(...)` if role-restricted (import `UsersModule` in the module).
7. Call `this.audit.log(...)` for mutations worth auditing

### Frontend
1. Create route folder under `frontend/app/(app)/{feature}/`
2. Add `page.tsx` (server component shell) and client component(s)
3. Add types to `frontend/lib/types.ts`
4. Add API methods to `frontend/lib/api.ts` under the appropriate namespace
5. Create query hooks in `frontend/hooks/use{Feature}Query.ts`
6. If role-restricted, wrap with `RequireAdmin` or `RequireSuperadmin` in `layout.tsx`
7. Add the route prefix to `protectedPrefixes` in `frontend/proxy.ts`

## Testing
- Backend: Jest (`pnpm --filter backend test`). Test files: `*.spec.ts` in `src/`.
- Frontend: `pnpm --filter frontend lint` for linting.

## PH Address Fields

Customers and branches both have fully structured PH addresses:

**DB columns** (both `customers` and `branches` tables):
- `street_name` — street/purok (e.g. "Purok III")
- `barangay`
- `city` — city or municipality
- `province`
- `country` — defaults to "Philippines"

**Frontend geography data** (`frontend/lib/ph-geo.ts`):
- `PH_GEO` — nested object: `{ [province]: { [city]: string[] } }` (barangays array)
- `getAllBarangays()` — flat sorted list of all barangays for datalist autocomplete
- `getLocationByBarangay(barangay)` — reverse lookup returning `{ city, province }` — used for auto-populate
- `COUNTRY_DEFAULT = 'Philippines'`

**Formatting** (`frontend/lib/utils.ts`):
- `formatAddress({ streetName, barangay, city, province })` — renders as `"Purok III Dapitan, Cordova, Cebu"`. Each part is title-cased via `toTitleCase()`. Returns `'—'` if all parts are empty.

**CustomerLookupSection layout** (3+2 grid):
- Row 1 (`grid-cols-3`): Street Name/Purok | Barangay (datalist) | City
- Row 2 (`grid-cols-2`): Province | Country (static, read-only)
- Barangay auto-populates City + Province via `getLocationByBarangay()`
- Uses `const { onChange: brgyOnChange, ...rest } = register('customerBarangay')` to avoid RHF onChange override

## Deposits Module

Monthly deposit tracking per payment method (GCash, Cash, Card, Bank Deposit).

**Backend**: `backend/src/deposits/` — upsert endpoint adds to existing monthly total per branch+method.

**Frontend**:
- `frontend/components/deposits/DepositHistoryDialog.tsx` — shows deposit history per method
- Dashboard collection channel strip — each method card has `+ Add` button that opens deposit input dialog
- `frontend/hooks/useDepositsQuery.ts` — `useDepositsQuery(year, month, branchId)` + `useUpsertDepositMutation`

## Staff Management

Admins can view, edit profiles, manage documents, change roles, and deactivate staff — all from `/users`.

**Edit Profile dialog** (`components/users/EditStaffDialog.tsx`):
- Fields: Full Name, Nickname, Contact Number, Birthday, Address, Emergency Contact Name + Number
- `PATCH /users/:id/profile` — admin/superadmin only

**Documents dialog** (`components/users/StaffDocumentsDialog.tsx`):
- Uploads files (images, PDF, DOC) directly to Supabase Storage bucket: `staff-documents`
- Path pattern: `{userId}/{timestamp}.{ext}`
- After upload, saves public URL + label to `staff_documents` table via `POST /users/:id/documents`
- Delete removes the DB record (`DELETE /users/:id/documents/:docId`) — storage file is orphaned (acceptable)
- `GET /users/:id/documents` — fetch all docs for a staff member

**Required**: Create a **public** `staff-documents` bucket in Supabase Storage dashboard.

**Backend endpoints** (`users.controller.ts`):
- `GET /users/:id` — fetch single user (admin+)
- `PATCH /users/:id/profile` — update profile fields (admin+)
- `GET /users/:id/documents` — list documents (admin+)
- `POST /users/:id/documents` — add document record (admin+)
- `DELETE /users/:id/documents/:docId` — remove document record (admin+)

## Creator Tracking (`createdById`)

All major entities now track who created them:
- `transactions` / `expenses` — use `staffId` (existing)
- `services`, `promos`, `branches` — new `created_by_id` UUID FK → `users.id` (added in migration 0015)

## QR Scanner

`frontend/components/ui/qr-scan-dialog.tsx` — dialog that scans a claim stub QR code and navigates to the transaction.

- **Camera mode** (default): uses native `BarcodeDetector` API (Chromium/Chrome only) + `getUserMedia({ video: { facingMode: 'environment' } })`. Scan loop via `requestAnimationFrame` calling `detector.detect(videoRef)`. Shows scan reticle overlay.
- **Manual mode** (fallback): text input for transaction number. Activates automatically if `BarcodeDetector` is not available or camera access is denied.
- **Toggle button**: switches between camera and manual modes.
- `BarcodeDetector` is declared manually — not in TS lib: `declare class BarcodeDetector { ... }`
- Always call `stopCamera()` on dialog close: cancels RAF + stops all MediaStream tracks.

**Placement**:
- Sidebar: button rendered right after the Dashboard nav item (visible to all users, not admin-only)
- Dashboard page (`app/(app)/page.tsx`): Scan QR button in the quick-actions bar, also visible to all users

## Photo Upload

Photos (before/after images per transaction item) use a **presigned URL pattern** — the backend never handles the file bytes, only generates a short-lived signed upload URL.

**Flow:**
1. Frontend calls `POST /uploads/presigned-url` — backend validates item exists, generates a Supabase Storage signed upload URL + permanent public URL for path `sneakers/{txnId}/{itemId}/{type}/{timestamp}.jpg`, returns both.
2. Frontend compresses the file client-side (always real JPEG output) and PUT's it directly to the signed URL — no backend involved in the file transfer.
3. Frontend PATCH's `PATCH /transactions/{txnId}/items/{itemId}` with `{ beforeImageUrl }` or `{ afterImageUrl }` to store the permanent public URL in the DB.

**Key files:**
- `backend/src/uploads/` — `uploads.module.ts`, `uploads.controller.ts`, `uploads.service.ts`, `dto/presigned-url.dto.ts`
- `frontend/hooks/useUploadPhoto.ts` — `useUploadPhotoMutation(txnId)`: validation, compression, presigned URL fetch, PUT to storage, PATCH DB
- `frontend/columns/transaction-items-columns.tsx` — `ImageCell`: upload placeholder (camera icon), uploading spinner, image thumbnail
- `frontend/app/(app)/transactions/[id]/page.tsx` — hidden `<input type="file">`, `handleUploadClick`, `handleFileChange`, `uploadingItemIds` state

**Required environment variable:**
- `backend/.env`: `SUPABASE_STORAGE_BUCKET=sneaker-photos` — must be a **public** bucket in Supabase Storage

**Client-side compression (`browser-image-compression`):**
- Every file — even small ones — always runs through compression to guarantee real JPEG bytes on output. Skipping compression for a "small" file would upload PNG/WebP bytes with `Content-Type: image/jpeg`, corrupting the stored image.
- Target: 1280px max dimension, 0.82 JPEG quality (~150–600 KB per photo)
- Raw file size cap: 20 MB (before compression)
- iOS HEIC: Safari converts to JPEG before JS sees the `File` — no special handling needed
- Android empty MIME type: `file.type === ''` is accepted; compression will fail loudly if the file isn't an image

**Fault tolerance:**
- Compression failure → falls back to original file if ≤ 20 MB
- PUT failure → 1 automatic retry after 1.5s
- DB save failure after successful upload → distinct error: "Photo uploaded but failed to save. Please upload again to link it." (re-uploading overwrites the link; orphaned storage file is harmless)

---

## Common Pitfalls
- **Money**: forgetting `toScaled()`/`fromScaled()` will produce values off by 100,000×.
- **RolesGuard without UsersModule**: will throw a DI error at runtime. Always import `UsersModule` in any module that uses `@Roles(...)`.
- **Soft delete vs hard delete**: promos use soft delete (`isActive = false`), transactions use hard delete (cascade). Don't mix them up.
- **Price snapshots**: `transaction_items.price` is a snapshot. Don't join against `services.price` for historical transaction values.
- **Audit log immutability**: never add update/delete operations on `audit_log`. `performedBy` has no FK constraint intentionally.
- **drizzle-kit migrate is broken**: `checkValue.replace` TypeError on squash migrations. Apply all schema changes via `psql ALTER TABLE` directly against the DB.
- **DB changes are not deployed automatically**: deploying code does not apply DB migrations. Run `ALTER TABLE` statements manually in Supabase Dashboard SQL Editor against production before or alongside deploying.
- **Barangay onChange override**: when using `register('customerBarangay')` with a custom `onChange`, destructure first — `const { onChange, ...rest } = register(...)` — then call `onChange(e)` inside your custom handler. Spreading `{...register(...)}` then adding `onChange` silently overrides RHF's handler.
- **BarcodeDetector not in TS lib**: declare it manually with `declare class BarcodeDetector { ... }`. Do not install a type package — just the local declaration is enough.
- **Photo upload — never skip compression**: bypassing `imageCompression` for "small" files uploads non-JPEG bytes with a JPEG Content-Type header, corrupting the image. Always run the compression step.
- **Photo upload — bucket must be public**: private buckets require signed read URLs that expire. The current implementation stores permanent `publicUrl` values in the DB and displays them directly. If the bucket is private, images will 403 after the signed URL expires.
- **`SUPABASE_STORAGE_BUCKET` missing**: the presigned-url endpoint will throw at runtime if this env var is not set in `backend/.env`.
- **`staff-documents` bucket must be public**: the `StaffDocumentsDialog` uses `getPublicUrl()` and stores permanent URLs. If the bucket is private, document links will 403. Create it as public in Supabase Storage dashboard.
- **drizzle-kit generate is interactive**: `pnpm drizzle-kit generate` may prompt interactively for rename detection. Write manual SQL migrations and register them in `migrations/meta/_journal.json` instead. Run `pnpm drizzle-kit migrate` to apply.
