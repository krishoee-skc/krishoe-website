# KRISHOE Operations Blueprint

This app is becoming a connected system for three channels:

1. Factory production
2. Wholesale and retail market sales
3. Online shop and customer accounts

## Phase 1: Current Foundation

- Admin Operations dashboard at `/admin/operations`
- Persistence through the backend selector: local JSON by default, Postgres when `DATA_BACKEND=postgres`
- Quick entry forms for raw material, worker task, production batch, finished stock, vehicle dispatch, stock movement, customer ledger, and ledger transaction
- Raw material stock and reorder alert model
- Worker task progress with camera zone references
- Production batch progress: planned, finished, WIP, rejected
- Finished goods stock by channel
- Fast-moving and slow-moving design report
- Vehicle dispatch tracking
- Cash, cheque, credit, and customer ledger summary
- Customer ledger detail page with transaction history and printable ledger view

## Phase 2: Real Data Entry

Create deeper forms and database tables for:

- Raw material purchase, issue, and return with supplier invoice
- Product design and bill of materials
- Production batch start/finish
- Worker task assignment and daily output
- Quality check pass/fail/rework
- Finished goods transfer to wholesale, retail, and online stock
- Vehicle loading sheet and market return
- Customer ledger transaction: cash, cheque, credit, adjustment, due aging

## Phase 3: CCTV Integration

CCTV should not be mixed directly with accounting records. Recommended model:

- Register camera zones: Cutting, Sole Press, Finishing, Packing, Gate
- Attach camera zone and timestamp to worker task, QC issue, and dispatch event
- Later integrate with NVR/camera vendor API for playback links

## Phase 4: Reports

Build reports for:

- Raw material consumption per design
- Worker productivity
- QC rejection rate
- Factory WIP aging
- Finished goods stock aging
- Fast/slow design demand
- Vehicle-wise loaded/returned/sold
- Customer receivable aging
- Cash vs cheque vs credit collection

## Phase 5: Postgres Migration

Local JSON is useful for development only. Production should move to Postgres with:

- Foreign keys
- Unique invoice numbers
- Ledger transaction immutability
- Stock movement audit trail
- Daily backup
- Role-based admin access

Current migration prep:

- Versioned admin backup package at `/api/admin/backup`
- Backup counts and integrity summary for migration comparison
- Backend selector scaffold in `lib/data-backend.ts`
- Postgres adapter scaffold notes in `docs/postgres-adapter-scaffold.md`
- Postgres schema draft in `docs/schema.sql`
- Step-by-step migration plan in `docs/postgres-migration-plan.md`
