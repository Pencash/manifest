# Current MEIMS Baseline

This directory preserves the current working FAO Malawi M&E Activity Tracker baseline used for further development.

## Snapshot
- 19 projects
- 509 activities
- Source application: app.html
- Master data snapshot: data/master/master-data.json

## Existing interface and functions
- Programme Dashboard
- Activities Tracker
- Projects management
- Interactive Review Sessions
- Reports & Data
- Dynamic project/activity add, edit and delete
- Search and filters
- Activity progress display with completed and remaining portions
- Status/progress controls
- Budget summary, budget by mode of implementation, and budget by project
- Project-linked A/B/C fields (FOUR BETTER, CPF Thematic Area, CPF Output)
- Local JSON backup and CSV activity export/import workflow in the current application

## Business rules already present
- Completed -> 100% progress
- Not Started -> 0% progress
- Cancelled -> 0% progress
- Delayed -> red

## Important development rule
Do not replace the baseline data or redesign the interface without an explicit change request. Build new functionality as incremental, version-controlled changes.
