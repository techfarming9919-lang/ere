"""
Central Website Adapter / Configuration Layer
=============================================
ALL site-specific knowledge about the West Bengal ISGPP GP Profile portal lives here.
If the website markup changes, edit ONLY this file.

Target: https://gpims.wb.gov.in/ISGPP_ProtectedPage/GPProfile.aspx
Technology detected: ASP.NET Web Forms (dependent dropdowns via __doPostBack, __VIEWSTATE, __EVENTVALIDATION).
"""

TARGET_URL = "https://gpims.wb.gov.in/ISGPP_ProtectedPage/GPProfile.aspx"

# ---------------------------------------------------------------------------
# FINANCIAL YEAR — now USER-SELECTABLE (no longer hard-locked to 2024-2025)
# ---------------------------------------------------------------------------
# The crawler works for whichever Financial Year the user picks in the UI.
# These are only the DEFAULT values used until the user chooses a year.
DEFAULT_FINANCIAL_YEAR_VALUE = "2425"        # the <option value> for 2024-2025
DEFAULT_FINANCIAL_YEAR_TEXT = "2024 - 2025"  # the exact dropdown option label on the site

# Mutable, process-wide selected Financial Year. Updated via set_financial_year().
_selected_fy = {
    "value": DEFAULT_FINANCIAL_YEAR_VALUE,
    "text": DEFAULT_FINANCIAL_YEAR_TEXT,
    "label": "2024-2025",
}


def _label_from_text(text: str) -> str:
    """Turn a dropdown label like '2024 - 2025' into a clean '2024-2025' label."""
    cleaned = "".join((text or "").split())      # remove all whitespace -> '2024-2025'
    return cleaned or "unknown"


def set_financial_year(value: str, text: str) -> dict:
    """Set the active Financial Year (called when the user selects a year in the UI)."""
    _selected_fy["value"] = (value or "").strip()
    _selected_fy["text"] = (text or "").strip()
    _selected_fy["label"] = _label_from_text(text)
    return dict(_selected_fy)


def get_financial_year() -> dict:
    return dict(_selected_fy)


def fy_value() -> str:
    return _selected_fy["value"]


def fy_text() -> str:
    return _selected_fy["text"]


def fy_label() -> str:
    return _selected_fy["label"]


def excel_filename() -> str:
    return f"GP_Contact_Data_{fy_label()}.xlsx"


# ---------------------------------------------------------------------------
# SELECTORS (verified against the real page source supplied by the user)
# ---------------------------------------------------------------------------
SELECTORS = {
    "district": "#ddlDistrict",
    "subdivision": "#ddlSubDivision",
    "block": "#ddlBlock",
    "gp": "#ddlGP",
    "financial_year": "#ddlFinyear",
    "go_button": "#BtnGO",
    # GP Profile result fields (rendered only after GO postback)
    "gp_email": "#lblGPEmail",
    "gis_mobile_1": "#lblGISMob1",
    "gis_mobile_2": "#lblGISMob2",
}

# ASP.NET hidden state fields (handled automatically by Playwright postbacks,
# documented here for the "Analyze Website" diagnostic).
ASP_NET_STATE_FIELDS = [
    "#__VIEWSTATE",
    "#__VIEWSTATEGENERATOR",
    "#__EVENTVALIDATION",
    "#__EVENTTARGET",
    "#__EVENTARGUMENT",
]

# Option labels/values that are placeholders or aggregates — never crawled.
_PLACEHOLDER_TEXTS = ("--select--", "select", "all district")
_SKIP_VALUES = ("", "0", "all district", "-1")


def is_real_option(value: str, text: str) -> bool:
    """Return True if a dropdown <option> is a real, crawlable item (not a placeholder/aggregate)."""
    v = (value or "").strip().lower()
    t = (text or "").strip().lower()
    if not t:
        return False
    if v in _SKIP_VALUES:
        return False
    if t in _PLACEHOLDER_TEXTS:
        return False
    if t.startswith("--"):
        return False
    if t.startswith("all "):   # "ALL DISTRICT" aggregate
        return False
    if "select" in t and len(t) <= 12:
        return False
    return True


def make_unique_key(district: str, subdivision: str, block: str, gp: str) -> str:
    """Unique key for duplicate prevention: District + Sub Division + Block + GP + FY."""
    return "|".join([
        (district or "").strip().upper(),
        (subdivision or "").strip().upper(),
        (block or "").strip().upper(),
        (gp or "").strip().upper(),
        fy_label(),
    ])
