# Phase 15 — Order Management Enhancement (Admin + Storefront)

> Numbering note: `plan/14` was never materialized as a file in this folder — the
> storefront build (`apps/storefront`) was planned and executed directly against
> ~20 code comments/commits referencing "plan/14 Phase N" without a saved doc. This
> plan is `15` to avoid colliding with those existing references, not because 14 is
> reserved for anything else.
>
> Stack correction: the prompt this plan is based on describes a generic
> Node/Express/MySQL/Prisma/React stack. This project's actual stack is
> Express + **PostgreSQL** + Prisma, with **two separate Next.js 16 apps**
> (`apps/admin`, `apps/storefront`), not a single React SPA. Everything below
> targets the real stack, not the prompt's generic template assumptions — same
> adaptation this project has made for every prior phase.

---

## 0. Context — what already exists vs. what's actually being asked for

`plan/08-order-management.md` already designed an ambitious order architecture
(snapshotted lines/addresses, two decoupled status machines, saga checkout,
fulfillment, returns/RMA). Two research passes against the live codebase confirm
**a real, working subset of that design is built** — this is not a green field.
Building this phase means (a) closing genuine gaps, (b) surfacing data that's
already captured but never returned by any API, and (c) a large amount of new
UI. It does **not** mean re-architecting the order domain from scratch.

### 0.1 Already built — reuse, do not rebuild

| Area | What exists |
|---|---|
| **Schema** | `Order`, `OrderLine`, `OrderAddress` (billing+shipping snapshot, unique per type), `OrderTaxLine`, `PaymentTransaction` (append-only ledger), `Fulfillment` + `FulfillmentLine` (tracking fields live *on* `Fulfillment`: `trackingNumber`, `carrier`, `shippedAt`), `OrderReturn` + `OrderReturnLine`, `ShippingMethod`, `TaxClass`, `OrderNumberCounter` |
| **Usecases** | `CompleteCheckout` (saga: reserve → price → tax/ship → create order → capture payment → commit/release), `GetOrder`, `ListOrders` (paginated, filters on status/financialStatus/email), `FulfillOrder` (per-line qty, creates `Fulfillment`), `RefundOrder` (proportional refund + tax, optional restock via the real inventory ledger), `CancelOrder` (= full `RefundOrder` + restock, blocked once any line is fulfilled) |
| **Admin UI** | `apps/admin/src/app/(dashboard)/orders/` — list page (Order#/Email/Status/Financial/Fulfillment/Total/Created, email+status query filters, Prev/Next pagination), detail page (status badges, Fulfill/Refund/Cancel dialogs via Server Actions, lines table, totals card) |
| **Storefront UI** | `apps/storefront/src/app/account/orders/page.tsx` — list only (Order/Date/Payment/Fulfillment/Total), and a one-time `checkout/success/[orderId]` receipt page (not linked from history) |
| **RBAC** | Real DB-backed permission system (`AdminUser→Role→Permission`), JWT-embedded at login, `authorize('code')` middleware. Existing order-relevant codes: `orders:refund`, `orders:cancel` |
| **Wallet** | Fully working ledger (`Wallet`, `WalletTransaction`), `CreditWallet` usecase already supports `source: 'REFUND'` — just never called from the order module |
| **Idempotency** | `idempotent(routeName)` middleware, already guarding checkout; reusable for any new money-moving POST |
| **Eventing** | `OutboxWriter`/`OutboxRelay` (transactional outbox → BullMQ), already emits `OrderPaid`, `OrderRefunded`, `OrderCancelled`; one consumer (`order-confirmation.worker.ts`) simulates (logs only) an email on `OrderPaid` |
| **Dialogs/toasts/skeletons** | `dialog.tsx`, `sonner.tsx`, `skeleton.tsx` all installed in both apps; dialog is the established confirm-before-destructive-action pattern (`cancel-dialog.tsx` etc.) |

### 0.2 Confirmed absent — real gaps this plan closes

| Gap | Evidence |
|---|---|
| **API never returns addresses, payments, tracking, or returns** | `PrismaOrderRepository.findByPublicId` does `include: { lines: true }` only. The data is *written* (addresses at checkout, tracking at fulfillment) but no endpoint reads it back. This alone blocks half the admin/storefront requirements. |
| **No invoice concept at all** | `order.prisma`'s own header comment: *"a formatted invoice is a presentation concern, deferred."* No model, no numbering, no PDF. |
| **No shipment/tracking as a rich concept** | Tracking fields exist on `Fulfillment` but: no carrier tracking URL, no estimated delivery, no live "current tracking status" separate from the fulfillment's own status, no packing slip. |
| **No order status history / activity log** | Status columns are overwritten in place. Outbox events exist but aren't a queryable per-order timeline (not indexed for it, nothing reads them back). |
| **No order notes** (internal or customer-facing) | No model. |
| **No email log, no real email sending** | Zero email infrastructure in the repo — no provider SDK, no template, no queue-of-sends table. The one consumer that reacts to `OrderPaid` only logs `[simulated] sending order confirmation email`. |
| **No CSV/Excel export anywhere** | Confirmed via repo-wide search — no package, no usecase. |
| **No PDF generation anywhere** | Confirmed via repo-wide search — no package, no usecase. |
| **Cancellation never touches the wallet** | `CancelOrder`/`RefundOrder` only record a simulated `PaymentTransaction(REFUND)`; `CreditWallet` is never called. |
| **No "Close Order"** | Not in `OrderStatus`, no usecase. |
| **Admin grid has no Actions column, no advanced filters (date range, customer name), no sort, no export** | Confirmed reading `orders/page.tsx`. |
| **Admin detail page has no customer-info, addresses, timeline, notes, or attachments sections** | Confirmed reading `orders/[id]/page.tsx`. |
| **Storefront has no order detail page, no tracking, no invoice download, no reorder** | Confirmed — `account/orders/` has exactly one file. |
| **Some routes are unauthenticated-but-not-permission-gated** | `GET /orders`, `GET /orders/:publicId`, `POST /orders/:publicId/fulfillments` have no `authorize(...)` at all today — only global JWT auth. |

---

## 1. Decisions made now (defaults chosen, documented so they can be revisited)

Same discipline as the storefront plan: pick a defensible default, document the
reasoning, keep moving — rather than blocking on a round-trip for every call.

### 1.1 Status model: keep two decoupled machines, extend both, add a derived display label

The prompt's flat status list (`Pending, Confirmed, Processing, Packed, Shipped,
Delivered, Completed, Cancelled, Refunded, Closed`) mixes three *orthogonal*
concerns that `plan/08` deliberately split apart (order lifecycle vs. payment vs.
fulfillment) specifically to avoid invalid state combinations (e.g. "shipped but
unpaid" must be representable). Flattening it into one enum would be a real
regression from this project's own documented design principle.

**Decision:** extend the existing enums, don't flatten them:

| Enum | Today | Extended to |
|---|---|---|
| `OrderStatus` | `PENDING, PROCESSING, ON_HOLD, COMPLETED, CANCELLED` | **+ `CONFIRMED`, `CLOSED`** |
| `FinancialStatus` (Payment Status) | `PENDING, AUTHORIZED, PAID, PARTIALLY_REFUNDED, REFUNDED, VOIDED` | **+ `PARTIALLY_PAID`, `FAILED`** |
| `FulfillmentStatus` | `UNFULFILLED, PARTIALLY_FULFILLED, FULFILLED, RETURNED` | unchanged — already matches the prompt exactly |
| `ShipmentStatus` (per-`Fulfillment`) | `PENDING, SHIPPED, DELIVERED, CANCELLED` | **+ `PACKED`** |

"Packed / Shipped / Delivered" from the prompt's list map onto `ShipmentStatus`
(a fulfillment's own lifecycle), not `OrderStatus`. "Refunded" maps onto
`FinancialStatus` (already exists). The admin/storefront UI gets a small pure
`deriveDisplayStatus(order)` function producing one Shopify-style label +
color for the grid/badges — computed for display only, never stored — so the
merchant-facing experience matches the prompt's mental model while the data
model stays factored. This function is a genuinely new, well-scoped piece of
domain logic, documented with a truth table in Phase 0a.

Enum extension is a `prisma/migrations/*` hand-written migration (existing
project convention — Prisma's diff engine doesn't always match this project's
raw-SQL structures cleanly) plus a `db-migration-verifier` pass, exactly like
every prior enum/column change in this codebase.

### 1.2 Email: build the real plumbing, keep delivery simulated by default

No email provider is configured anywhere in this environment (no SMTP/API
credentials). Rather than block the whole "Email Actions" module on that:

- Build a real `EmailSender` port (`send({to, subject, html, meta})`) and an
  `EmailLog` table — every "send" is recorded for real (queryable history,
  satisfies the "Maintain email history" requirement literally).
- Ship a `SimulatedEmailSender` adapter by default (same pattern as
  `TestPaymentGateway`) that logs + writes the `EmailLog` row but doesn't call
  a real provider — swapping in a real one (Resend/SES/SMTP) later is a
  one-file adapter change, not a redesign.
- This is called out explicitly in the plan and to the user before Phase 6 —
  if real delivery is wanted, provide provider credentials and the adapter
  swap is small.

### 1.3 Cancellation refund target: admin choice, wallet wired for real

Today cancellation always does a simulated gateway refund and never touches
the wallet, even though `CreditWallet` is fully functional. Decision: the
cancel action gets a `refundTo: 'ORIGINAL_PAYMENT_METHOD' | 'WALLET'` field
(defaulting to `ORIGINAL_PAYMENT_METHOD`, today's behavior, so nothing breaks).
Choosing `WALLET` calls `CreditWallet.execute({ source: 'REFUND', bucket:
'STORE_CREDIT', ... })` for real — this is the one part of "refund wallet (if
applicable)" that's actually wireable today without new infrastructure.

### 1.4 PDF generation: Puppeteer (HTML → PDF), not a programmatic PDF library

Invoice and packing-slip layouts are naturally HTML/CSS (logo, tables, tax
breakdown) — hand-building them with a programmatic API like `pdfkit` is far
more code and harder to keep visually in sync with the admin UI's own styling.
**Decision:** `puppeteer` renders a server-rendered HTML template (reusing the
same design tokens as the admin app) to PDF. Heavier dependency than `pdfkit`,
but this project already has no PDF capability at all, so there's no existing
investment to preserve either way, and HTML templates are dramatically easier
to maintain and to keep matching the invoice preview shown in the browser.

### 1.5 CSV/Excel export: `csv-stringify` for CSV, `exceljs` for Excel

Both are small, well-maintained, no native bindings. CSV export is a simple
streamed response; Excel needs real cell formatting (currency columns), which
plain CSV can't express — hence two libraries, not one "just do CSV" shortcut.

### 1.6 Barcode/QR on invoice: skip for v1

Explicitly optional in the prompt ("Barcode / QR (optional)"). No existing
need for it downstream (no warehouse scanning workflow in this codebase), so
it's cut from v1 and notable as a fast-follow if a real barcode-scanning
fulfillment flow is ever built.

---

## 2. Database schema changes

All migrations hand-written + `db-migration-verifier`-checked, matching this
project's established safe-migration pattern (raw SQL, exact Prisma naming
conventions, `prisma migrate resolve --applied` after direct `psql` apply).

### 2.1 Extend existing enums (§1.1)
`OrderStatus` +`CONFIRMED`,+`CLOSED` · `FinancialStatus` +`PARTIALLY_PAID`,+`FAILED` · `ShipmentStatus` +`PACKED`.

### 2.2 New tables

**`order_status_history`** — the real activity/audit timeline the prompt asks for by name.
```
id BIGINT PK, order_id FK, event_type TEXT        -- 'STATUS_CHANGED','PAYMENT_RECEIVED','INVOICE_CREATED',
                                                     -- 'SHIPMENT_CREATED','TRACKING_ADDED','EMAIL_SENT',
                                                     -- 'NOTE_ADDED','CANCELLED','REFUNDED','CLOSED', ...
from_value TEXT NULL, to_value TEXT NULL           -- e.g. old/new status, for STATUS_CHANGED rows
message TEXT NULL                                  -- human-readable line for the timeline UI
actor_type ENUM('ADMIN','SYSTEM','CUSTOMER'), actor_id BIGINT NULL, actor_name TEXT NULL
created_at TIMESTAMPTZ
INDEX (order_id, created_at)
```
Written by every usecase that mutates an order (`FulfillOrder`, `RefundOrder`,
`CancelOrder`, the new `CreateInvoice`/`CreateShipment`/`CloseOrder`/email
usecases) — same call sites that already write an outbox event get a sibling
`orderHistory.record(...)` call in the same transaction. This is intentionally
a *separate* table from `outbox_event`: the outbox is delivery infrastructure
(polled, marked published, not order-scoped for reads); this table is a
read-optimized, order-scoped, permanent record — different access pattern,
different retention (outbox rows are transient once published).

**`order_note`**
```
id BIGINT PK, order_id FK, type ENUM('INTERNAL','CUSTOMER'), body TEXT
created_by BIGINT NULL (admin_user), created_at TIMESTAMPTZ
INDEX (order_id, type)
```

**`order_invoice`**
```
id BIGINT PK, public_id UUID, order_id FK, invoice_number TEXT UNIQUE (per-website sequence,
  same pattern as order_number_counter), status ENUM('DRAFT','ISSUED')
subtotal, discount_total, tax_total, grand_total NUMERIC(18,4) (snapshot at issue time)
pdf_storage_key TEXT NULL (MinIO/S3, reusing the existing media-storage adapter)
created_at, created_by BIGINT NULL
INDEX (order_id)
```
`order_invoice_line` mirrors the invoiced subset of `order_line` (supports
**partial invoicing** the same way `FulfillmentLine` supports partial
shipment): `invoice_id FK, order_line_id FK, qty, unit_price, tax_amount, row_total`.

**`shipment_tracking`** — promotes tracking to a first-class, queryable concept
without breaking `Fulfillment` (which stays the shipment record itself, per
the schema's existing "folded shipment into Fulfillment" decision — this adds
what's missing rather than introducing a competing model):
```
id BIGINT PK, fulfillment_id FK UNIQUE, carrier TEXT, carrier_tracking_url TEXT NULL
estimated_delivery_at TIMESTAMPTZ NULL, current_status TEXT (carrier's own status string,
  independent of ShipmentStatus — "In Transit", "Out for Delivery", etc.)
shipping_notes TEXT NULL, packing_slip_storage_key TEXT NULL
updated_at TIMESTAMPTZ
```

**`order_email_log`**
```
id BIGINT PK, order_id FK, email_type TEXT ('CONFIRMATION','INVOICE','SHIPMENT','CANCELLATION','REFUND','CUSTOM')
to_email TEXT, subject TEXT, status ENUM('SENT','FAILED'), provider_ref TEXT NULL
sent_by BIGINT NULL (admin_user; null = system-triggered), created_at TIMESTAMPTZ
INDEX (order_id, created_at)
```

**`order_attachment`** — invoice PDF / packing slip / any admin-uploaded file, listed on the detail page's "Attachments" section (reuses the existing `MediaStorage`/S3 adapter, not a new upload pipeline):
```
id BIGINT PK, order_id FK, kind ENUM('INVOICE','PACKING_SLIP','OTHER')
storage_key TEXT, filename TEXT, uploaded_by BIGINT NULL, created_at TIMESTAMPTZ
```

### 2.3 `Order`/`OrderLine` additions
`Order.customerIp TEXT NULL` (captured at checkout, req.ip — a genuinely new
field the prompt asks for by name). `Order.closedAt TIMESTAMPTZ NULL`. No other
column changes — `qtyInvoiced` is derivable from `order_invoice_line` (sum),
not a denormalized column, avoiding a second source of truth.

---

## 3. Backend API (all new/changed routes)

Everything under existing `authenticate` (admin JWT) + new `authorize(...)`
codes below; store routes under `requireCustomer` (existing customer JWT).

### 3.1 New permission codes (added to `prisma/seed.ts`'s permission list + super-admin role)
`orders:view`, `orders:fulfill`, `orders:invoice`, `orders:email`, `orders:close`, `orders:export`
(`orders:refund`, `orders:cancel` already exist and are reused as-is).
Also **retroactively gates** the 3 currently-ungated routes (`GET /orders`,
`GET /orders/:publicId`, `POST /orders/:publicId/fulfillments`) behind
`orders:view`/`orders:fulfill` respectively — closing the real gap found in
research, not just adding new surface.

### 3.2 Admin routes

| Method | Path | Notes |
|---|---|---|
| `GET` | `/admin/v1/orders` | extend existing: + `paymentStatus`, `fulfillmentStatus`, `dateFrom`/`dateTo`, `customerName`, `orderId` filters; `sortBy=createdAt\|grandTotal\|customerName`, `sortDir` |
| `GET` | `/admin/v1/orders/:id` | extend `OrderViewDto`: + `customer{name,email,phone}`, `addresses[]`, `payments[]`, `fulfillments[]` (with tracking), `returns[]`, `customerIp`, `notes[]` |
| `GET` | `/admin/v1/orders/:id/history` | new — `order_status_history` timeline |
| `GET` | `/admin/v1/orders/export` | new — CSV/Excel, `format=csv\|xlsx`, same filters as the list |
| `POST` | `/admin/v1/orders/:id/notes` | new — add internal or customer note |
| `POST` | `/admin/v1/orders/:id/invoice` | new — create invoice (all-or-selected lines, for partial invoicing) |
| `GET` | `/admin/v1/orders/:id/invoices` | new — list invoices (multi-invoice support) |
| `GET` | `/admin/v1/orders/:id/invoice/:invoiceId` | new — invoice detail/preview data |
| `GET` | `/admin/v1/orders/:id/invoice/:invoiceId/pdf` | new — stream the PDF |
| `POST` | `/admin/v1/orders/:id/invoice/:invoiceId/regenerate` | new |
| `POST` | `/admin/v1/orders/:id/shipment` | extends `FulfillOrder`: + carrier, trackingUrl, shipmentDate, shippingNotes → writes `Fulfillment` + `shipment_tracking` |
| `GET` | `/admin/v1/orders/:id/shipment/:fulfillmentId/packing-slip` | new — PDF |
| `POST` | `/admin/v1/orders/:id/cancel` | extend: + `reason`, `refundTo` (§1.3) |
| `POST` | `/admin/v1/orders/:id/close` | new — guarded: `COMPLETED`/fully-delivered, no pending shipment/refund |
| `POST` | `/admin/v1/orders/:id/send-email` | new — `type` + optional custom subject/body |
| `GET` | `/admin/v1/orders/:id/email-log` | new |

### 3.3 Store (customer) routes

| Method | Path | Notes |
|---|---|---|
| `GET` | `/store/v1/me/orders` | extend existing (`customer.module.ts`): + search/pagination/filter params, `itemsCount` |
| `GET` | `/store/v1/me/orders/:id` | new — full detail (addresses, items, price summary, shipment+tracking, timeline) |
| `GET` | `/store/v1/me/orders/:id/invoice` | new — PDF stream |
| `GET` | `/store/v1/me/orders/:id/tracking` | new — tracking number/carrier/URL/status/history |
| `POST` | `/store/v1/me/orders/:id/reorder` | new — adds every orderable line back to the customer's active cart (creating one via the existing `ensureCart` pattern if needed), skips lines whose variant no longer exists/is inactive, returns which lines were skipped |

All new routes: Zod-validated bodies/queries (existing `parse()`/schemas.ts
convention), `asyncHandler` wrapper, RFC 9457 error shape via existing
`shared/domain/errors.ts` types — no new error-handling pattern invented.

---

## 4. Backend architecture (clean layering, matching existing modules exactly)

New usecases live in `src/modules/order/application/`, one file each, same
constructor-injection style as every existing usecase in this module:
`CreateInvoice`, `GetInvoicePdf`, `CreateShipment`, `GetPackingSlipPdf`,
`CloseOrder`, `SendOrderEmail`, `AddOrderNote`, `GetOrderHistory`,
`ExportOrders`, `Reorder` (customer-facing, likely lives in `order` module
since it operates on `Order`/`Cart`, injected into `customer.module.ts`'s
composition the same way `ListCustomerOrders` already crosses that boundary).

New ports (`domain/ports.ts`): `EmailSender`, `PdfRenderer`
(`render(html): Promise<Buffer>`, wraps Puppeteer so usecases stay
unit-testable against a fake). New repository methods on the existing
`OrderRepository` interface rather than parallel repositories: `recordHistory`,
`addNote`, `createInvoice`, `listInvoices`, `updateFulfillmentTracking`, etc.
— consistent with how `CartRepository`/`OrderRepository` already centralize
persistence for this module.

`PrismaOrderRepository.findByPublicId` (and the equivalent list query) gets
extended `include` clauses — the single biggest unlock in this whole plan,
since it's what makes every "missing section" in both UIs possible at all.

---

## 5. Phased delivery (backend-gap-first, one committed vertical slice per phase — this project's established discipline throughout both the admin and storefront builds)

**Phase 15.0 — Backend foundation** (blocks everything else)
- 0a. Enum extensions + migration + `deriveDisplayStatus` + `db-migration-verifier`
- 0b. `order_status_history` + `order_note` tables; wire `recordHistory` into every existing mutating usecase (`FulfillOrder`, `RefundOrder`, `CancelOrder`, `CompleteCheckout`)
- 0c. `PrismaOrderRepository` full-detail query (addresses/payments/fulfillments/returns) + extended `OrderViewDto`
- 0d. RBAC: new permission codes, seed update, gate the 3 previously-ungated routes
- 0e. Wallet-refund wiring (§1.3) on cancel/refund

**Phase 15.1 — Invoicing backend**: `order_invoice(+line)`, `CreateInvoice`/`GetInvoicePdf`/list routes, Puppeteer + HTML invoice template, S3 storage of the rendered PDF (reuses existing `MediaStorage`).

**Phase 15.2 — Shipment/tracking backend**: `shipment_tracking` table, extended `POST .../shipment`, packing-slip PDF, `shipment_tracking` upserts on fulfillment create/update.

**Phase 15.3 — Email backend**: `EmailSender` port + `SimulatedEmailSender`, `order_email_log`, `SendOrderEmail` usecase + 5 templated types + custom, wired to the confirmation/invoice/shipment/cancellation/refund trigger points (manual send now; auto-send on event is a fast-follow once a real provider exists).

**Phase 15.4 — Close Order + export backend**: `CloseOrder` usecase + guards, CSV/Excel export usecase + route.

**Phase 15.5 — Admin: Order Grid** — Actions column (first real use of the existing `dropdown-menu.tsx` primitive: View/Invoice/Shipment/Cancel/Download Invoice/More), advanced filters (status/payment/fulfillment/date-range/customer-name/order-id — extends the existing plain-`<form>` GET convention), sortable headers (reuses Products' `SortableHeader` pattern, not yet used by Orders), CSV/Excel export button, Customer Name + Payment Method columns.

**Phase 15.6 — Admin: Order Details rebuild** — Customer Info, Addresses, full Items table (qty invoiced/shipped/refunded columns), complete Price Summary (discount/coupon/wallet-used/shipping/tax/fees/paid/refunded/remaining), Timeline (from `order_status_history`), Notes (internal+customer, add-note form), Attachments (invoice PDF/packing slip links).

**Phase 15.7 — Admin: Invoice UI** — create/preview/download/email/regenerate, multi-invoice list for partial shipment.

**Phase 15.8 — Admin: Shipment UI** — create shipment (line+qty picker), tracking fields, packing slip download, email shipment confirmation, timeline update.

**Phase 15.9 — Admin: Cancel/Close UI** — reason selector, refund-target choice, confirmation dialog (extends existing `cancel-dialog.tsx`), Close Order action + guard messaging.

**Phase 15.10 — Admin: Email Actions UI** — manual send buttons + history table.

**Phase 15.11 — Storefront: My Orders enhancements** — search/filter/pagination, Items Count column, row actions (View/Track/Download Invoice/Reorder).

**Phase 15.12 — Storefront: Order Details page** (new — doesn't exist today) — all sections per spec + invoice download + shipment/tracking block.

**Phase 15.13 — Storefront: Tracking page** — carrier link-out, tracking history.

**Phase 15.14 — Verification & docs** — OpenAPI/Swagger generation for the full order surface (new — no existing API docs in this repo, `zod-to-openapi` or equivalent over the existing Zod schemas), full backend suite green, headless-browser sweep of every new/changed page, `plan/08` amended with a short "see plan/15 for the concrete build-out" pointer.

Every phase: integration tests appended to `test/integration/order-api.test.ts`
(existing `describe.skipIf(!INTEGRATION)` + `adminRequest(app, await
getAdminToken(app))` convention, no new test infra), `db-migration-verifier`
for any schema change, `tsc --noEmit && next build && eslint` for UI phases, a
real headless-Chromium pass before commit, one focused commit per phase —
identical discipline to the admin-UI and storefront builds already completed
in this project.

---

## 6. UI requirements checklist (mapped to phases above)

Loading states/skeletons → `skeleton.tsx` (installed, first real usage).
Toasts → `sonner` (installed, mounted, first real usage — every mutating
action in Phases 15.5–15.13 gets a `toast.success`/`toast.error`).
Confirmation dialogs → extend the existing `dialog.tsx` pattern. Role-based
permissions → §3.1's new codes, checked both server-side (`authorize`) and
client-side (hide actions the logged-in admin's JWT permissions don't include —
new small `hasPermission()` helper reading the admin session, mirrors nothing
existing today since no admin UI currently branches on permissions). Print
support → the browser-native print dialog against the same HTML invoice
template used for PDF generation (one template, two consumption paths).
Mobile responsive → same Tailwind breakpoint discipline as every prior phase.

---

## 7. What's explicitly out of scope for this pass

- **Real email delivery** (needs provider credentials — §1.2's adapter seam is built, swap-in is separate).
- **Barcode/QR on invoices** (§1.6).
- **Auto-send-on-event emails** (manual "Send Email" actions only, per the prompt's own Module 1 §8 list — auto-triggering off `OrderPaid`/`OrderCancelled` outbox events is a natural fast-follow once Phase 15.3 lands, since the trigger plumbing (outbox → worker) already exists for exactly this).
- **Return/RMA UI** — `OrderReturn`/`OrderReturnLine` tables and refund-with-restock logic already exist backend-side (per §0.1) and aren't touched by this plan; a dedicated Returns UI is a separate, later scope, not requested in this prompt.
- **MySQL** — this project is Postgres; the prompt's "MySQL" is a template artifact, not followed.
