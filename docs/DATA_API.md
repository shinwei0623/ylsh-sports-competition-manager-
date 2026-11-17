# Shared data and API contract

Source root: `gas/integrated`. Both pages use the same server functions and Script Properties. The existing SPREADSHEET_ID and ADMIN_EMAIL remain configured in Apps Script, never hardcoded in source.

All API calls return `{ok,data,error,meta:{requestId,build}}`. Client code must handle both transport errors and `ok:false`.

| Consumer | Interface | Returned data / permission |
|---|---|---|
| Registration | apiBootstrap | Published events/categories, caller's own registrations/check-ins, public school/theme settings, navigation URLs |
| Competition lookup | apiListCompetition(eventId) | Published event, minimal labels, draw positions, scheduled/ongoing/finished matches without score fields, official results |
| Registration | apiSubmitRegistration(input) | Authenticated account; event/category/capacity/member validation; stable requestId; required name/studentId/class; resumable SUBMITTING record |
| Registration | apiCancelRegistration(id) | Owner or system admin, authenticated; checked-in registrations require a separate correction workflow |
| Management | apiAdminModel | System-wide for system admin; event/class filtered for other supported roles; roles/audit only for system admin |
| Competition editing | apiSaveEvent / apiSaveCategory | System/global event admin for creation; assigned event admin for editing; old and new parents both checked |
| Check-in | apiCheckIn | Assigned check-in/event admin or system admin; only approved/already checked-in registration |
| Draw | apiGenerateDraw | Event/system admin; approved registrations; separate category groups; persisted plan and bulk append |
| Schedule/results | apiSaveMatch / apiSaveResult | Event/system admin; valid participants from the same event; matches use requestId for creation |
| System | apiSaveSettings / apiSaveRole | System admin only; roles restricted to EVENT_ADMIN, CHECKIN, CLASS_ADMIN |
| Installation | installOrUpgradeSystem | Configured system admin only; never invoked automatically by navigation or synchronization |

Role scopes: SYSTEM/*, EVENT/eventId, CLASS/className (CLASS_ADMIN only). A missing operation scope is not a wildcard for an event-scoped manager. UI visibility is not the authorization boundary.

Existing sheet columns are retained; no new columns are required by this candidate. Recovery metadata uses existing AuditLogs rows. Request-derived IDs are used for new events/matches. SUBMITTING is an intermediate registration status; it is never eligible for check-in/draw/results.

Capacity currently means active registrations/teams, not member headcount. Student duplicate detection is per event using required studentId. Gender/grade eligibility, school roster validation, bracket advancement, ties/scoring automation, notifications and post-check-in correction workflows are not established by these tests.
