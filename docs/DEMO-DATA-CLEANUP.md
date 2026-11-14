# Demo data lifecycle / 模擬資料管理

## User requirement
The administrator must be able to remove demonstration records from the web admin console without manually editing Google Sheets.

## UI
管理後台 → 系統設定 → 測試資料管理
- Show preview counts by entity (Events, Registrations, CheckIns, etc.).
- Primary action: **清除模擬資料**.
- Confirmation includes number of records, asks administrator to enter `CLEAR DEMO`, and displays a result/trace ID.
- Disable action during execution; show progress and retryable errors.

## Data contract
- All generated demo entities have `dataOrigin=DEMO` and a stable `demoBatchId`.
- Production/imported records default to `REAL`; missing origin is **not** treated as demo.
- Never use names, dates, row numbers or an entire sheet as deletion criteria.
- Preview and deletion must use the same explicit IDs/batch scope; verify the scope again under a lock.
- Remove dependent demo records first; reject deletion if any real records reference a demo entity.
- Keep immutable audit of actor, batch, counts, requestId and outcome; retain a recoverable backup/snapshot before hard delete.
- Require server-verified system-admin role. A client-provided email/role is never authority.
- Use idempotent requestId; repeated clicks do not delete more records.
- Restrict to TEST by default; production action is disabled unless separately approved.

## Existing spreadsheet migration
The current T231 workbook has Events and Registrations but does not yet have a dataOrigin/demoBatchId column. Add columns with an idempotent migration, never classify preexisting rows as demo. Until migration, the delete button must remain disabled.

## Acceptance criteria
1. Generate 5 demo events and 30 demo registrations, then preview correct counts.
2. Delete demo batch via admin UI; no manual Sheet editing.
3. Existing non-demo records and headers are unchanged.
4. Audit and backup exist; repeated requestId is safe.
5. Non-admin cannot preview protected details or delete.
6. Any mixed demo/real dependency blocks deletion safely.
7. UI works on iPhone Safari and desktop.
