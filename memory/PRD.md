# ISGPP GP Profile Crawler — PRD

## Problem statement
Migrated from the user's previous Emergent account. A Playwright-based web crawler for the
West Bengal ISGPP GP Profile portal (https://gpims.wb.gov.in/ISGPP_ProtectedPage/GPProfile.aspx),
an ASP.NET Web Forms site with dependent dropdowns (District → Sub Division → Block → Gram Panchayat)
and a Financial Year selector. It extracts GP Email ID + 2 GIS mobile numbers per GP and exports to Excel.

### Original bug reported
The Financial Year was HARD-CODED to 2024-2025 (`value=2425`). When that year wasn't present/selected,
the crawler reported "Financial Year 2024-2025 not found" and returned empty/wrong data.

### Requested change (scoped)
Make the Financial Year MANUALLY SELECTABLE. Do not change anything else.

## What's been implemented (2026-06, this account)
- Migrated the full app into /app (backend FastAPI + SQLite, frontend React/CRACO).
- Installed Playwright 1.63 + matching chromium-headless-shell (build 1243) in /pw-browsers; openpyxl.
- **Financial Year is now user-selectable** (default 2024-2025):
  - `website_adapter.py`: replaced fixed FY constants with a mutable selected-FY state
    (`set_financial_year`, `get_financial_year`, `fy_value/fy_text/fy_label`, `excel_filename`).
  - `crawler.py`: `_ensure_financial_year` uses the selected year; added `list_financial_years()`;
    all log/error messages now reference the selected year dynamically.
  - `server.py`: new `GET /api/financial-years` (reads real options from the site) and
    `POST /api/financial-year` (sets the active year; blocked while a crawl is running).
    `/config`, `/summary`, `/export` reflect the selected year.
  - `database.py` / `excel_export.py`: records, unique_key, summary and filename use the selected FY.
  - Frontend: new `FySelector.jsx` in the header (replaces the old "LOCKED FY" badge). Loads years
    from the site, lets the user pick, or add a year manually (label + option value). Disabled while
    a crawl is active. Export filename hint + AnalyzeDialog + TestGpModal reflect the selected year.

## IMPORTANT runtime note
- The target government portal `gpims.wb.gov.in` is **NOT reachable from the Emergent cloud container**
  (firewall/geo-block — verified HTTP 000 timeout). So the live operations
  (Analyze / Discover / Test Single GP / Start Crawl / Load years from site) can only run on the
  user's LOCAL machine (Windows start_backend.bat / start_frontend.bat), where the portal is reachable.
- Everything NOT requiring the live site (FY selection/state, config, records, summary, Excel export)
  works in the cloud preview and is verified.

## Backlog / future
- Optional: cache last-fetched FY options so the dropdown is instant.
- Optional: persist selected FY across backend restarts (currently in-memory, resets to 2024-2025).
