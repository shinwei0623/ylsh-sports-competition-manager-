# Deployment — integrated candidate, manual path

Google OAuth / Actions automatic deployment remains paused. It is not a prerequisite for source synchronization or local acceptance. Existing workflows are unchanged and never upload this candidate.

## Source roots

- `gas/integrated/`: recovered and patched integrated application, candidate INTEGRATED-2.0.1-test.
- Repository root GAS files: historical test-demo-0.3 scaffold, not the deployed integrated app. Existing CI checks these only.
- Recovery commit and `docs/source-snapshot.json`: exact source of existing Apps Script immutable version 3.

Use a verified isolated TEST project and isolated synthetic-data spreadsheet for Google-runtime acceptance. The existing in-use project must not be assumed disposable from its TEST title. `.clasp.integrated.json.example` contains placeholders and must never be uploaded as actual credentials/configuration. Do not add real binding IDs to this public repository.

## Prepared changes to the existing website (not executed)

| Item | Scope and impact |
|---|---|
| Source files | Replace 程式碼.gs with candidate Code.gs, and update Index.html / Admin.html |
| Data schema | No new columns; do not run installOrUpgradeSystem for this patch |
| Properties | Preserve SPREADSHEET_ID, ADMIN_EMAIL and existing target bindings |
| Audience | Preserve existing signed-in Google-account access and execute-as settings. The candidate manifest is DOMAIN for isolated TEST only; do not blindly copy it over the existing manifest |
| Data behavior | Stronger authorization and publication filters; only approved records may check in/draw; new registrations require member name, studentId and class; existing DEMO pending rows remain pending |
| Recovery | Existing AuditLogs stores request fingerprints/draw plans; SUBMITTING rows resume on same request; no existing rows are cleaned or migrated |
| QR | Third-party QR image requests removed; text ID remains; local QR generation/iPhone camera verification pending |
| Deployment | Create a new immutable version and update the same existing Deployment ID, preserving its URL, only after scoped approval and required review |

## Rollback

1. Before touching the existing environment, export its current four files and preserve a spreadsheet copy with original access permissions. Reconfirm that the target still points to version 3; if it changed, compare again first.
2. Retain current Script Properties, manifest, executeAs/access and Deployment ID; do not print secrets in logs or commit them.
3. If a release causes a regression, change the same deployment back to immutable version 3 in Manage deployments. The URL remains unchanged.
4. Deployment rollback restores code only. It does not undo data written after release. Preserve audit logs and identify any new records before separately approved data repair/restoration; never blindly overwrite the spreadsheet backup.
5. A pending SUBMITTING record or draw plan requires recovery under the patched version or reviewed administrative repair. Do not silently claim code rollback fixes pending data.

No step above was executed on the existing environment during synchronization. Actual existing-site deployment, spreadsheet backup writes, synthetic live test writes and DEMO cleanup require the user's explicit scoped approval.
