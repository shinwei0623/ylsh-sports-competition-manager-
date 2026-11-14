# Sports Competition Manager / 萬用體育競賽管理系統

Status: **TEST scaffolding — not deployed**.

## Editions
- Generic: school identity is configured at first install.
- YLSH: same core, school-specific settings injected at deployment; no student data or credentials in this repository.

## Safety
- The repository is currently PUBLIC. Never commit student records, access tokens, OAuth credentials, clasp config with real IDs, or production configuration.
- Deployment to Google Apps Script is **disabled** until a verified Script ID, authorization method, and explicit release gate are configured.
- Existing T231 spreadsheet is retained; no destructive migrations.

## Project phases
1. Validate existing Sheets schema and secure first-admin bootstrap.
2. Connect a TEST GAS project and verify registration write/read with synthetic data.
3. Add CI and credentialed TEST deployment after human authorization.
4. Require manual approval for production promotion.
5. Extend check-in, printing, draws and results; load-test before release.

See `docs/DEPLOYMENT.md` for the handoff gates.
