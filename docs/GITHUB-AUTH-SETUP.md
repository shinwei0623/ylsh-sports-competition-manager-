# GitHub Actions → GAS authorization gate

Target Script ID: `1F-3XwShUcQMI60GKC6m7adYXLtYLY1HBljTlBVJmkyhKqW5WkK566lFg`
Target spreadsheet ID: `1G51HIDYbe7e4eshzfKCJVnD5Q4L14l0Fm_8C-7D0Cz8`

## Status
User confirmed the Apps Script API is enabled for T231. This does not provide CI OAuth credentials. No deployment has occurred.

## Security
- Do NOT paste refresh tokens or clasp credentials in a chat, issue, commit, or public workflow log.
- This repository is public; use encrypted GitHub Actions secrets, not files in source control.
- Before pushing to the existing Script ID, export/backup the live GAS files and verify the intended project.
- Test the GitHub workflow on the TEST branch only; require manual approval for production.
- Verify that T231's Workspace policy permits the chosen OAuth flow.

## Required authorization
1. Obtain a supported OAuth credential for the Google identity that owns/edits the target Apps Script project, using an approved local or browser-based authentication flow.
2. Store it only in the repository's GitHub Actions encrypted secrets, with least-privilege access.
3. Validate identity and target Script ID before any push.
4. Publish a new immutable GAS version, deploy TEST, and verify the resulting /exec URL.

A secret alone does not establish a safe deployment. Do not enable an automatic write workflow until these gates pass.
