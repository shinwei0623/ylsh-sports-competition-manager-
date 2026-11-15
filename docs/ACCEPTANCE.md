# Integration acceptance — 2026-11-16 (Asia/Taipei)

## Verified provenance and live observations

- Knowledge baseline: `27beab92a661615b0d4d05238c3ff2d20deeb16c`.
- Sports repository baseline: `a2d2f33671c7bd00d98665aa6d3ce8031e779df1`, `test/initial-gas-ci`.
- Existing GAS project, deployment and spreadsheet binding were read directly in Apps Script. Project title: YLSH Sports Manager TEST. The existing in-use target is not treated as disposable merely because its title says TEST.
- Deployment manager: active version 3, INTEGRATED-2.0.0, released 2026-11-15 08:22, execute as deploying user, access signed-in Google accounts.
- Editor snapshot and immutable version 3: Code.gs 18,977 characters, Index.html 12,847, Admin.html 26,282, appsscript.json 193; all four matched exactly.
- Prior live read-only inspection: registration and admin pages load with INTEGRATED 2.0; 5 DEMO competitions and 30 pending DEMO registrations. Admin identity and 8 management sections load. No live registration, approval, check-in, draw or result write was performed.
- The older independent SPORTS MANAGER DEMO Site was not found among connected owned Sites. Its original hosting project remains unverified. The active GAS Admin.html already implements the blue/gold administration interface and is being preserved, rather than reconstructed.

## Candidate changes

1. Preserve recovered UI and common API envelope; add server-derived navigation between registration and management.
2. Public responses omit contact details, account emails, student identity, request IDs, draft events, draft matches and provisional scores. Public participant labels use team/class/registration ID pending an approved name-publication policy.
3. Enforce event/class role scopes on reads and writes; protect installer; restrict role assignment and cross-parent edits.
4. Registration validates required member names, student IDs and classes, capacity, open/close time and category membership. A stable request ID prevents repeat writes; SUBMITTING records resume missing members after an injected failure, with request fingerprint verification.
5. Check-in requires approval and repairs a half-completed parent update on retry. Draw uses a persisted plan, bulk writes, category-separated groups and retry recovery. Event/match creation uses stable request-derived IDs.
6. Correct admin competition filter, expose printing on mobile navigation, preserve fields omitted by event edit forms, and use Asia/Taipei display time.
7. Remove the third-party QR image URL. Text registration IDs and the existing scanner/manual check-in paths remain. A tested local QR generator is still pending; this is an explicit limitation, not a completed QR replacement.

## Test evidence

Command: `node --test tests/integrated.test.mjs`.

See `test-output.txt` for the final exact output. Tests run with actual candidate GAS code and mocked Google services; test records use example.test addresses and synthetic students only. Print checks validate generated HTML and escaping, not paper/PDF pagination.

The initial 26-case suite against captured 2.0.0 reported 4 pass / 22 fail; this demonstrates that the assertions detect baseline behavior differences. These are not 22 distinct vulnerabilities. The candidate suite was expanded after independent review to cover half-completed registration/check-in/draw writes, draft match privacy, missing IDs and idempotent event/match creation.

## Required before production acceptance

- Isolated real GAS/Sheets test deployment and browser → GAS → Sheet write/read verification, using approved synthetic data only.
- Real non-admin, event-manager, class-manager and check-in accounts; unavailable/blank Session.getActiveUser behavior. Mock sessions cannot establish this.
- iPhone Safari layout, camera/QR support and a local QR generator.
- A4 print preview/PDF pagination and actual printer verification.
- Failure behavior on real Sheets (including ambiguous service success), load/quotas and large draw-plan cell limits. Persisted plans are a recovery mechanism, not a multi-sheet database transaction.
- Confirm real event rules and required fields, publication policy and pilot competition; backup and separately approved DEMO cleanup.

No automatic deployment, live spreadsheet change, schema migration, role change or DEMO cleanup occurred during this task. This candidate is **not production accepted**.
