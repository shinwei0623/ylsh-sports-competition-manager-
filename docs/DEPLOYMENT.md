# Deployment gate / 部署管制

## Current status
Source scaffold only. No Apps Script deployment has been performed.

## TEST setup (one-time human gate)
1. Confirm the intended TEST Apps Script **Script ID** and account ownership.
2. Confirm whether the existing spreadsheet is for TEST; do not assume the T231 spreadsheet is safe to modify.
3. Choose a supported Google Apps Script API authorization mechanism for CI and configure repository Actions secrets (never commit tokens).
4. Verify Workspace policy and script scopes. Keep TEST access DOMAIN until approved otherwise.
5. Implement and validate a dedicated TEST deployment workflow, version stamping, deployment URL verification, and rollback.

## Production gate
Production is NOT configured. Do not enable automatic production writes or releases without explicit approval.

## Data contract
Current existing spreadsheet has Settings, Events, Registrations, AuditLogs; setupComplete is FALSE. A full schema migration is still pending. Do not treat this scaffold as a working registration app.
