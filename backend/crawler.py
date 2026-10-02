"""
Playwright crawler engine for the WB ISGPP GP Profile portal (ASP.NET Web Forms).

Handles dependent-dropdown __doPostBack cascades, the fixed Financial Year 2024-2025
constraint, retries with backoff, resume, and START/PAUSE/RESUME/STOP control.
"""
import asyncio
import os
import time
from datetime import datetime, timezone, timedelta
from collections import deque
from typing import List, Dict, Optional, Callable

from playwright.async_api import async_playwright

import database as db
from website_adapter import (
    TARGET_URL, SELECTORS, ASP_NET_STATE_FIELDS,
    fy_value, fy_text, fy_label,
    is_real_option, make_unique_key,
)

# Make sure Playwright finds the browser installed during setup.
if os.path.isdir("/pw-browsers"):
    os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/pw-browsers")

_LAUNCH_ARGS = ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"]

# Runtime toggles shared by stateless ops (analyze/discover/test). Updated via /api/settings.
RUNTIME = {"headless": True}


# ===========================================================================
# Low level Playwright helpers
# ===========================================================================
async def _options(page, selector) -> List[Dict[str, str]]:
    try:
        raw = await page.eval_on_selector_all(
            f"{selector} option",
            "els => els.map(e => ({value: e.value, text: (e.textContent||'').trim()}))",
        )
    except Exception:
        return []
    return raw


def _real_options(raw) -> List[Dict[str, str]]:
    return [o for o in raw if is_real_option(o["value"], o["text"])]


def _sig(raw) -> tuple:
    return tuple((o["value"], o["text"]) for o in raw)


async def _selected_value(page, selector) -> Optional[str]:
    try:
        return await page.eval_on_selector(selector, "el => el.value")
    except Exception:
        return None


async def _wait_child_populated(page, child_selector, before_sig, timeout_s) -> bool:
    """Wait until a dependent dropdown is repopulated after a postback."""
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        raw = await _options(page, child_selector)
        if raw:
            real = _real_options(raw)
            changed = _sig(raw) != before_sig
            if real and changed:
                return True
        await asyncio.sleep(0.25)
    # Fallback: accept if there is at least one real option even if signature matched.
    return bool(_real_options(await _options(page, child_selector)))


async def _select_parent(page, parent_selector, value, child_selector, timeout_s) -> bool:
    """Select a value in a parent dropdown and wait for its child to repopulate (postback)."""
    before = _sig(await _options(page, child_selector))
    try:
        await page.select_option(parent_selector, value=value)
    except Exception:
        # The select_option sometimes races with the __doPostBack navigation.
        pass
    try:
        await page.wait_for_load_state("domcontentloaded", timeout=timeout_s * 1000)
    except Exception:
        pass
    return await _wait_child_populated(page, child_selector, before, timeout_s)


async def _ensure_financial_year(page, timeout_s) -> bool:
    """Select the user-chosen financial year and hard-verify. Returns False only if that
    year is genuinely NOT available on the site.
    Slow-network tolerant: waits for the FY dropdown to appear and for the postback to settle."""
    target_value = fy_value()
    target_text = fy_text()
    # 1) Wait for the FY dropdown options to be present (page may still be loading on a slow net).
    raw = await _options(page, SELECTORS["financial_year"])
    deadline = time.monotonic() + min(timeout_s, 25)
    while time.monotonic() < deadline and not raw:
        await asyncio.sleep(0.5)
        raw = await _options(page, SELECTORS["financial_year"])
    values = {o["value"] for o in raw}
    texts = {o["text"] for o in raw}
    if target_value not in values and target_text not in texts:
        return False  # truly not available

    # 2) Already on the chosen year?
    current = await _selected_value(page, SELECTORS["financial_year"])
    if current == target_value:
        return True

    # 3) Select it, then patiently poll for the ASP.NET postback to settle.
    try:
        await page.select_option(SELECTORS["financial_year"], value=target_value)
    except Exception:
        pass
    deadline = time.monotonic() + timeout_s
    while time.monotonic() < deadline:
        try:
            await page.wait_for_load_state("domcontentloaded", timeout=3000)
        except Exception:
            pass
        v = await _selected_value(page, SELECTORS["financial_year"])
        if v == target_value:
            return True
        await asyncio.sleep(0.5)
    v = await _selected_value(page, SELECTORS["financial_year"])
    return v == target_value


async def list_financial_years(timeout_s: int = 90) -> Dict:
    """Open the portal and return the real Financial Year options so the user can pick one."""
    try:
        async with _Browser(headless=RUNTIME["headless"]) as b:
            await _goto(b.page, timeout_s)
            raw = await _options(b.page, SELECTORS["financial_year"])
            deadline = time.monotonic() + min(timeout_s, 25)
            while time.monotonic() < deadline and not raw:
                await asyncio.sleep(0.5)
                raw = await _options(b.page, SELECTORS["financial_year"])
            options = [o for o in raw if is_real_option(o["value"], o["text"])]
            return {
                "success": True,
                "options": options,
                "selected": {"value": fy_value(), "text": fy_text(), "label": fy_label()},
            }
    except Exception as e:
        return {"success": False, "options": [], "message": f"{e.__class__.__name__}: {e}",
                "selected": {"value": fy_value(), "text": fy_text(), "label": fy_label()}}


async def _extract_profile(page, timeout_s) -> Dict[str, str]:
    """After GO, wait for the GP Profile and extract the 3 contact fields."""
    await page.wait_for_selector(SELECTORS["gp_email"], timeout=timeout_s * 1000, state="attached")

    async def text(sel):
        try:
            return (await page.eval_on_selector(sel, "el => (el.textContent||'').trim()")) or ""
        except Exception:
            return ""

    return {
        "email": await text(SELECTORS["gp_email"]),
        "mob1": await text(SELECTORS["gis_mobile_1"]),
        "mob2": await text(SELECTORS["gis_mobile_2"]),
    }


def _status_for(email, mob1, mob2) -> str:
    if email and mob1 and mob2:
        return "SUCCESS"
    return "PARTIAL"


class _Browser:
    """Async context manager wrapping a Playwright chromium page."""
    def __init__(self, headless=True):
        self.headless = headless

    async def __aenter__(self):
        self._pw = await async_playwright().start()
        self.browser = await self._pw.chromium.launch(headless=self.headless, args=_LAUNCH_ARGS)
        self.context = await self.browser.new_context(
            user_agent=("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                        "(KHTML, like Gecko) Chrome/124.0 Safari/537.36"),
            viewport={"width": 1366, "height": 900},
        )
        self.page = await self.context.new_page()
        return self

    async def __aexit__(self, *exc):
        for closer in (getattr(self, "context", None), getattr(self, "browser", None)):
            try:
                await closer.close()
            except Exception:
                pass
        try:
            await self._pw.stop()
        except Exception:
            pass


async def _goto(page, timeout_s, retries: int = 3):
    """Navigate to the portal with retries — the govt site can be slow on first load."""
    last = None
    for attempt in range(retries):
        try:
            await page.goto(TARGET_URL, wait_until="domcontentloaded", timeout=timeout_s * 1000)
            return
        except Exception as e:
            last = e
            await asyncio.sleep(2 + attempt * 2)
    raise last


# ===========================================================================
# Stateless operations: Analyze, Discover options, Test single GP
# ===========================================================================
async def analyze_website(timeout_s: int = 90) -> Dict:
    detected, missing = {}, []
    try:
        async with _Browser(headless=RUNTIME["headless"]) as b:
            await _goto(b.page, timeout_s)
            check = {
                "District dropdown": SELECTORS["district"],
                "Sub Division dropdown": SELECTORS["subdivision"],
                "Block dropdown": SELECTORS["block"],
                "Gram Panchayat dropdown": SELECTORS["gp"],
                "Financial Year dropdown": SELECTORS["financial_year"],
                "GO button": SELECTORS["go_button"],
            }
            for label, sel in check.items():
                el = await b.page.query_selector(sel)
                detected[label] = bool(el)
                if not el:
                    missing.append(label)
            # ASP.NET state fields
            state = {}
            for sel in ASP_NET_STATE_FIELDS:
                state[sel] = bool(await b.page.query_selector(sel))
            # Financial year availability (for the user-selected year)
            fy_raw = await _options(b.page, SELECTORS["financial_year"])
            fy_available = any(o["value"] == fy_value() or o["text"] == fy_text() for o in fy_raw)
            districts = _real_options(await _options(b.page, SELECTORS["district"]))
            ok = not missing and fy_available
            label = fy_label()
            return {
                "success": ok,
                "detected": detected,
                "missing": missing,
                "aspnet_state_fields": state,
                "selected_financial_year": label,
                "financial_year_available": fy_available,
                "financial_year_options": [o["text"] for o in fy_raw],
                "district_count": len(districts),
                "districts": [o["text"] for o in districts],
                "message": (f"Website structure detected successfully. Financial Year {label} is available."
                            if ok else
                            (f"Financial Year {label} is NOT available on the site — pick a different year."
                             if not fy_available else
                             f"Could not detect: {', '.join(missing)}")),
            }
    except Exception as e:
        return {"success": False, "detected": detected, "missing": missing,
                "message": f"Could not reach / analyze the website: {e.__class__.__name__}: {e}"}


async def discover(level: str, district: str = None, subdivision: str = None,
                   block: str = None, timeout_s: int = 90) -> Dict:
    """Return dropdown options for a cascade level: districts|subdivisions|blocks|gps."""
    try:
        async with _Browser(headless=RUNTIME["headless"]) as b:
            await _goto(b.page, timeout_s)
            # Fix FY first so the hierarchy is built under 2024-2025.
            if not await _ensure_financial_year(b.page, timeout_s):
                return {"success": False, "options": [],
                        "message": "Financial Year 2024-2025 not available — STOPPED."}
            if level == "districts":
                return {"success": True, "options": _real_options(await _options(b.page, SELECTORS["district"]))}
            await _select_parent(b.page, SELECTORS["district"], district, SELECTORS["subdivision"], timeout_s)
            if level == "subdivisions":
                return {"success": True, "options": _real_options(await _options(b.page, SELECTORS["subdivision"]))}
            await _select_parent(b.page, SELECTORS["subdivision"], subdivision, SELECTORS["block"], timeout_s)
            if level == "blocks":
                return {"success": True, "options": _real_options(await _options(b.page, SELECTORS["block"]))}
            await _select_parent(b.page, SELECTORS["block"], block, SELECTORS["gp"], timeout_s)
            return {"success": True, "options": _real_options(await _options(b.page, SELECTORS["gp"]))}
    except Exception as e:
        return {"success": False, "options": [], "message": f"{e.__class__.__name__}: {e}"}


async def test_single_gp(district_v, district_t, subdivision_v, subdivision_t,
                         block_v, block_t, gp_v, gp_t, timeout_s: int = 90) -> Dict:
    try:
        async with _Browser(headless=RUNTIME["headless"]) as b:
            await _goto(b.page, timeout_s)
            if not await _ensure_financial_year(b.page, timeout_s):
                return {"success": False, "message": f"Financial Year {fy_label()} not available on the site — pick a different year."}
            await _select_parent(b.page, SELECTORS["district"], district_v, SELECTORS["subdivision"], timeout_s)
            await _select_parent(b.page, SELECTORS["subdivision"], subdivision_v, SELECTORS["block"], timeout_s)
            await _select_parent(b.page, SELECTORS["block"], block_v, SELECTORS["gp"], timeout_s)
            await b.page.select_option(SELECTORS["gp"], value=gp_v)
            try:
                await b.page.wait_for_load_state("domcontentloaded", timeout=timeout_s * 1000)
            except Exception:
                pass
            if not await _ensure_financial_year(b.page, timeout_s):
                return {"success": False, "message": f"Financial Year {fy_label()} not available on the site — pick a different year."}
            async with b.page.expect_navigation(wait_until="domcontentloaded", timeout=timeout_s * 1000):
                await b.page.click(SELECTORS["go_button"])
            data = await _extract_profile(b.page, timeout_s)
            status = _status_for(data["email"], data["mob1"], data["mob2"])
            return {
                "success": True, "status": status,
                "district": district_t, "subdivision": subdivision_t, "block": block_t, "gp": gp_t,
                "financial_year": fy_label(),
                "email": data["email"], "mob1": data["mob1"], "mob2": data["mob2"],
            }
    except Exception as e:
        return {"success": False, "message": f"{e.__class__.__name__}: {e}"}


# ===========================================================================
# Full crawl manager with START / PAUSE / RESUME / STOP
# ===========================================================================
class CrawlManager:
    def __init__(self):
        self.state = "idle"          # idle | running | paused | stopping | done | error
        self.logs = deque(maxlen=3000)
        self._task: Optional[asyncio.Task] = None
        self.cfg = {"delay_min_ms": 500, "delay_max_ms": 1500,
                    "profile_timeout_s": 60, "max_retries": 3, "headless": True}
        self._reset_runtime()

    def _reset_runtime(self):
        self.current = {"district": "", "subdivision": "", "block": "", "gp": ""}
        self.progress = {
            "districts": {"done": 0, "total": 0},
            "subdivisions": {"done": 0, "total": 0},
            "blocks": {"done": 0, "total": 0},
            "gps": {"done": 0, "total": 0},
        }
        self.counts = {"successful": 0, "partial": 0, "failed": 0, "duplicates": 0}
        self.totals = {"districts": 0, "subdivisions": 0, "blocks": 0}
        self.start_ts: Optional[float] = None
        self.end_ts: Optional[float] = None
        self._processed_since_start = 0

    # ---- logging -------------------------------------------------------
    def log(self, msg: str, level: str = "INFO"):
        ts = datetime.now().strftime("%H:%M:%S")
        self.logs.append({"time": ts, "level": level, "msg": msg})

    # ---- public controls ----------------------------------------------
    def start(self, cfg: dict = None, retry_failed: bool = False):
        if self.state in ("running", "paused"):
            return {"ok": False, "message": "A crawl is already in progress."}
        if cfg:
            self.cfg.update({k: v for k, v in cfg.items() if k in self.cfg})
        self._reset_runtime()
        self.state = "running"
        self.start_ts = time.monotonic()
        self.end_ts = None
        db.init_db()
        self.log(f"Crawler started (retry_failed={retry_failed})", "SUCCESS")
        self._task = asyncio.create_task(self._run(retry_failed))
        return {"ok": True}

    def pause(self):
        if self.state == "running":
            self.state = "paused"
            self.log("Crawler paused", "WARN")
            return {"ok": True}
        return {"ok": False, "message": "Not running."}

    def resume(self):
        if self.state == "paused":
            self.state = "running"
            self.log("Crawler resumed", "SUCCESS")
            return {"ok": True}
        return {"ok": False, "message": "Not paused."}

    def stop(self):
        if self.state in ("running", "paused"):
            self.state = "stopping"
            self.log("Stop requested — finishing current GP then halting", "WARN")
            return {"ok": True}
        return {"ok": False, "message": "Not running."}

    async def _gate(self):
        """Honour pause/stop between units of work. Returns True if should stop."""
        while self.state == "paused":
            await asyncio.sleep(0.4)
        return self.state == "stopping"

    def _elapsed_str(self):
        if not self.start_ts:
            return "00:00:00"
        end = self.end_ts or time.monotonic()
        return str(timedelta(seconds=int(end - self.start_ts)))

    def status(self):
        elapsed = (self.end_ts or time.monotonic()) - self.start_ts if self.start_ts else 0
        speed = (self._processed_since_start / (elapsed / 60)) if elapsed > 1 else 0.0
        remaining_gps = max(self.progress["gps"]["total"] - self.progress["gps"]["done"], 0)
        eta = (remaining_gps / speed * 60) if speed > 0 else 0
        counts_db = db.get_counts()
        return {
            "state": self.state,
            "current": self.current,
            "progress": self.progress,
            "counts": {**self.counts,
                       "successful": counts_db["successful"],
                       "partial": counts_db["partial"],
                       "failed": counts_db["failed"]},
            "totals": self.totals,
            "db": counts_db,
            "speed_per_min": round(speed, 1),
            "elapsed": self._elapsed_str(),
            "eta": str(timedelta(seconds=int(eta))) if eta else "--:--:--",
            "financial_year": fy_label(),
            "logs": list(self.logs)[-200:],
            "config": self.cfg,
        }

    def summary_meta(self):
        return {
            "total_districts": self.totals["districts"],
            "total_subdivisions": self.totals["subdivisions"],
            "total_blocks": self.totals["blocks"],
            "duplicates": self.counts["duplicates"],
            "start_time": datetime.fromtimestamp(time.time() - ((time.monotonic() - self.start_ts) if self.start_ts else 0)).strftime("%Y-%m-%d %H:%M:%S") if self.start_ts else "",
            "end_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S") if self.state == "done" else "",
            "elapsed": self._elapsed_str(),
        }

    async def _delay(self):
        import random
        lo, hi = self.cfg["delay_min_ms"], self.cfg["delay_max_ms"]
        await asyncio.sleep(random.uniform(lo, hi) / 1000.0)

    # ---- the crawl -----------------------------------------------------
    async def _process_gp(self, page, d_t, sd_t, b_t, gp_v, gp_t) -> None:
        to = self.cfg["profile_timeout_s"]
        retries = self.cfg["max_retries"]
        self.current = {"district": d_t, "subdivision": sd_t, "block": b_t, "gp": gp_t}
        db.mark_discovered(d_t, sd_t, b_t, gp_t)

        existing = db.record_status(d_t, sd_t, b_t, gp_t)
        if existing in ("SUCCESS", "PARTIAL"):
            self.counts["duplicates"] += 1
            self.log(f"Duplicate/skip (already {existing}): {gp_t}", "DEBUG")
            return

        attempt, last_err = 0, ""
        while attempt < retries:
            attempt += 1
            if await self._gate():
                return
            try:
                self.log(f"GP discovered: {gp_t}")
                await page.select_option(SELECTORS["gp"], value=gp_v)
                try:
                    await page.wait_for_load_state("domcontentloaded", timeout=to * 1000)
                except Exception:
                    pass
                if not await _ensure_financial_year(page, to):
                    self.log(f"Financial Year {fy_label()} not available — STOPPING crawler", "ERROR")
                    self.state = "stopping"
                    return
                self.log("Opening GP Profile (clicking GO)")
                async with page.expect_navigation(wait_until="domcontentloaded", timeout=to * 1000):
                    await page.click(SELECTORS["go_button"])
                data = await _extract_profile(page, to)
                status = _status_for(data["email"], data["mob1"], data["mob2"])
                db.save_record(d_t, sd_t, b_t, gp_t, data["email"], data["mob1"], data["mob2"], status)
                self.log(f"GP Email ID: {data['email'] or '[blank]'} | GIS Mob1: {data['mob1'] or '[blank]'} | GIS Mob2: {data['mob2'] or '[blank]'}")
                self.log(f"Record saved [{status}]: {gp_t}", "SUCCESS")
                if status == "SUCCESS":
                    self.counts["successful"] += 1
                else:
                    self.counts["partial"] += 1
                self._processed_since_start += 1
                return
            except Exception as e:
                last_err = f"{e.__class__.__name__}: {e}"
                self.log(f"Attempt {attempt}/{retries} failed for {gp_t}: {last_err}", "ERROR")
                db.save_error(d_t, sd_t, b_t, gp_t, "PROFILE_LOAD", last_err, attempt)
                await asyncio.sleep(min(2 ** attempt, 8))  # exponential backoff
                try:
                    await _goto(page, to)
                    await _ensure_financial_year(page, to)
                    await _select_parent(page, SELECTORS["district"], self._cur_dv, SELECTORS["subdivision"], to)
                    await _select_parent(page, SELECTORS["subdivision"], self._cur_sdv, SELECTORS["block"], to)
                    await _select_parent(page, SELECTORS["block"], self._cur_bv, SELECTORS["gp"], to)
                except Exception:
                    pass
        # all retries exhausted
        db.save_record(d_t, sd_t, b_t, gp_t, "", "", "", "FAILED", last_err)
        self.counts["failed"] += 1
        self._processed_since_start += 1
        self.log(f"GP FAILED after {retries} retries: {gp_t}", "ERROR")

    async def _run(self, retry_failed: bool):
        to = self.cfg["profile_timeout_s"]
        try:
            async with _Browser(headless=self.cfg["headless"]) as b:
                page = b.page
                await _goto(page, to)
                self.log(f"Target loaded: {TARGET_URL}")
                if not await _ensure_financial_year(page, to):
                    self.log(f"Financial Year {fy_label()} NOT available on the site — crawler STOPPED.", "ERROR")
                    self.state = "error"
                    return
                self.log(f"Financial Year verified: {fy_label()}", "SUCCESS")

                districts = _real_options(await _options(page, SELECTORS["district"]))
                self.totals["districts"] = len(districts)
                self.progress["districts"]["total"] = len(districts)
                self.log(f"{len(districts)} districts discovered")

                for d in districts:
                    if await self._gate():
                        break
                    self._cur_dv = d["value"]
                    self.log(f"District discovered: {d['text']}")
                    await _select_parent(page, SELECTORS["district"], d["value"], SELECTORS["subdivision"], to)
                    await _ensure_financial_year(page, to)
                    subdivs = _real_options(await _options(page, SELECTORS["subdivision"]))
                    self.progress["subdivisions"] = {"done": 0, "total": len(subdivs)}
                    self.totals["subdivisions"] += len(subdivs)

                    for sd in subdivs:
                        if await self._gate():
                            break
                        self._cur_sdv = sd["value"]
                        self.log(f"Sub Division discovered: {sd['text']}")
                        await _select_parent(page, SELECTORS["subdivision"], sd["value"], SELECTORS["block"], to)
                        await _ensure_financial_year(page, to)
                        blocks = _real_options(await _options(page, SELECTORS["block"]))
                        self.progress["blocks"] = {"done": 0, "total": len(blocks)}
                        self.totals["blocks"] += len(blocks)

                        for blk in blocks:
                            if await self._gate():
                                break
                            self._cur_bv = blk["value"]
                            self.log(f"Block discovered: {blk['text']}")
                            await _select_parent(page, SELECTORS["block"], blk["value"], SELECTORS["gp"], to)
                            await _ensure_financial_year(page, to)
                            gps = _real_options(await _options(page, SELECTORS["gp"]))
                            self.progress["gps"] = {"done": 0, "total": len(gps)}

                            for gp in gps:
                                if await self._gate():
                                    break
                                await self._process_gp(page, d["text"], sd["text"], blk["text"], gp["value"], gp["text"])
                                self.progress["gps"]["done"] += 1
                                self.log("Moving to next GP", "DEBUG")
                                await self._delay()
                                if self.state == "stopping":
                                    break
                            self.progress["blocks"]["done"] += 1
                            if self.state == "stopping":
                                break
                        self.progress["subdivisions"]["done"] += 1
                        if self.state == "stopping":
                            break
                    self.progress["districts"]["done"] += 1
                    if self.state == "stopping":
                        break

                self.end_ts = time.monotonic()
                if self.state == "stopping":
                    self.state = "idle"
                    self.log("Crawler stopped by user. Progress saved — RESUME to continue.", "WARN")
                else:
                    self.state = "done"
                    self.log("Crawl complete.", "SUCCESS")
        except Exception as e:
            self.end_ts = time.monotonic()
            self.state = "error"
            self.log(f"Crawler crashed: {e.__class__.__name__}: {e}. Progress saved — RESUME to continue.", "ERROR")


manager = CrawlManager()
