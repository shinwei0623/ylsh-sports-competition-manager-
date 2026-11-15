# 宜蘭高中體育競賽管理系統

## Current source and deployment status

`gas/integrated/` is the integrated application source, recovered from the existing GAS deployment and maintained here. The source snapshot was compared file by file with immutable Apps Script version **3** (released 2026-11-15 08:22 Asia/Taipei); all four files matched exactly. See `docs/source-snapshot.json` for hashes. The original recovery commit is retained in Git history.

The current candidate is **INTEGRATED-2.0.1-test**, with shared registration/admin navigation, privacy and scoped authorization fixes, retry handling and isolated acceptance tests. **It has not been uploaded to or deployed over the existing GAS site.** The existing site remains on INTEGRATED-2.0.0, version 3.

The root-level `Code.gs`, `Index.html`, `AdminApi.gs`, `DemoData.gs` and root manifest are the **historical test-demo-0.3 scaffold**. They are retained for the existing CI and traceability. Do not mix these files with the integrated app or upload the repository root to the existing GAS project.

## Local acceptance

Requires Node.js 22+; no packages, credentials or Google account required:

```sh
node --test tests/integrated.test.mjs
```

Tests execute the actual GAS functions using an in-memory Spreadsheet service. They cover shared workflows, scoped data access, denied operations, repeat submissions, injected write failures, time windows, category draw separation and print HTML generation. They do **not** establish Google session behavior, real Sheets latency, camera support, A4 pagination or live deployment correctness.

The unchanged GitHub workflows still validate the historical root scaffold. A green check from those workflows is **not** an integrated-app acceptance result. Run the command above for the candidate and read `docs/ACCEPTANCE.md`.

## Deployment

Google OAuth / GitHub Actions automatic deployment remains paused by user decision. Manual Apps Script editor deployment is supported; see `docs/DEPLOYMENT.md`. Do not run the installer, migrate the existing database, change access settings, clean DEMO records or update an existing deployment without the user's scoped approval.

No student records, credentials, real Script Properties or production binding configuration are stored in this public repository.
