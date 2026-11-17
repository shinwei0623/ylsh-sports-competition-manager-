# Fresh T231 TEST installation (2026-11-17)

Canonical NEW Google Sheets database:
https://docs.google.com/spreadsheets/d/1yRNiNw_gaFqUwl9xJ3qeb_r63He7uh4BUQ4kXyHoJ58/edit

Owner / deployment identity: t231@gapp.ylsh.ilc.edu.tw
Environment: TEST only. GitHub Actions automatic GAS deployment: DISABLED.
Old spreadsheet, GAS deployment and registration data must not be modified or deleted.

## Current verified state
- Fresh native Google Sheet created under T231, 19 tabs with headers.
- Settings: environment=TEST, defaultDailyIndividualLimit=2, relayCountSeparate=TRUE, registrationEnabled=FALSE, deploymentApproval=REQUIRED, setupComplete=FALSE.
- GAS Script ID: NOT YET CREATED. Do not reuse the obsolete/404 Script ID.
- Web App URL: NOT YET DEPLOYED.
- Repository remains a TEST scaffold. UI, registration limit validation, and end-to-end QA are not yet complete.

## Manual GAS installation gate
1. Sign into https://script.google.com/home/projects with T231; create a NEW standalone Apps Script project named 校園體育競賽管理系統_TEST.
2. Record the newly generated Script ID and share the project editor URL for verification.
3. Upload or paste the repository GAS source files and HTML file to the NEW project; do not point any installer at the old Script ID.
4. In Project Settings -> Script Properties, set ENVIRONMENT=TEST, SPREADSHEET_ID=1yRNiNw_gaFqUwl9xJ3qeb_r63He7uh4BUQ4kXyHoJ58, ADMIN_EMAIL=t231@gapp.ylsh.ilc.edu.tw.
5. Run read-only smoke tests and authorize as T231. Existing source contains DEMO functions: do not run seed/clear functions.
6. Only after integration, security, mobile, registration rules and end-to-end QA: manually deploy a TEST web app; capture its actual /exec URL and verify.
7. Production deployment requires a separate explicit human approval.

Known compatibility issue: SportEventCatalog.gs must use Events headers from the fresh sheet. No claims of successful deploy until actual verification.
