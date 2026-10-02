"""
FastAPI backend for the WB ISGPP GP Profile Data Crawler.
The Financial Year is user-selectable (default: 2024-2025).
"""
import logging
from fastapi import FastAPI, APIRouter
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import io
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import database as db
import excel_export
import crawler
from crawler import manager
import website_adapter as wa
from website_adapter import TARGET_URL

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("gp_crawler")

app = FastAPI(title="GP Profile Crawler API")
api = APIRouter(prefix="/api")

db.init_db()


# --------------------------------------------------------------------------
# Models
# --------------------------------------------------------------------------
class DiscoverReq(BaseModel):
    level: str                       # districts | subdivisions | blocks | gps
    district: Optional[str] = None
    subdivision: Optional[str] = None
    block: Optional[str] = None


class TestGPReq(BaseModel):
    district_value: str
    district_text: str
    subdivision_value: str
    subdivision_text: str
    block_value: str
    block_text: str
    gp_value: str
    gp_text: str


class StartReq(BaseModel):
    delay_min_ms: Optional[int] = None
    delay_max_ms: Optional[int] = None
    profile_timeout_s: Optional[int] = None
    max_retries: Optional[int] = None
    headless: Optional[bool] = None


class SettingsReq(BaseModel):
    headless: Optional[bool] = None
    profile_timeout_s: Optional[int] = None
    delay_min_ms: Optional[int] = None
    delay_max_ms: Optional[int] = None
    max_retries: Optional[int] = None


class FinancialYearReq(BaseModel):
    value: str
    text: str


# --------------------------------------------------------------------------
# Meta
# --------------------------------------------------------------------------
@api.get("/")
async def root():
    fy = wa.get_financial_year()
    return {"service": "GP Profile Crawler", "financial_year": fy["label"],
            "financial_year_label": fy["text"], "target_url": TARGET_URL}


@api.get("/config")
async def get_config():
    fy = wa.get_financial_year()
    return {"target_url": TARGET_URL,
            "financial_year": fy["label"],
            "financial_year_label": fy["text"],
            "financial_year_value": fy["value"],
            "crawler": manager.cfg}


@api.post("/settings")
async def set_settings(req: SettingsReq):
    data = {k: v for k, v in req.model_dump().items() if v is not None}
    manager.cfg.update({k: v for k, v in data.items() if k in manager.cfg})
    if "headless" in data:
        crawler.RUNTIME["headless"] = bool(data["headless"])
    return {"ok": True, "crawler": manager.cfg, "runtime": crawler.RUNTIME}


# --------------------------------------------------------------------------
# Financial Year — list available years + set the active one
# --------------------------------------------------------------------------
@api.get("/financial-years")
async def financial_years():
    return await crawler.list_financial_years()


@api.post("/financial-year")
async def set_financial_year(req: FinancialYearReq):
    if manager.state in ("running", "paused"):
        return {"ok": False, "message": "Stop the crawl before changing the Financial Year."}
    fy = wa.set_financial_year(req.value, req.text)
    manager.log(f"Financial Year set to {fy['label']}", "SUCCESS")
    return {"ok": True, "financial_year": fy}


# --------------------------------------------------------------------------
# Analyze / Discover / Test
# --------------------------------------------------------------------------
@api.post("/analyze")
async def analyze():
    return await crawler.analyze_website()


@api.post("/discover")
async def discover(req: DiscoverReq):
    return await crawler.discover(req.level, req.district, req.subdivision, req.block)


@api.post("/test-gp")
async def test_gp(req: TestGPReq):
    return await crawler.test_single_gp(
        req.district_value, req.district_text, req.subdivision_value, req.subdivision_text,
        req.block_value, req.block_text, req.gp_value, req.gp_text,
    )


# --------------------------------------------------------------------------
# Crawl control
# --------------------------------------------------------------------------
@api.post("/crawl/start")
async def crawl_start(req: StartReq):
    cfg = {k: v for k, v in req.model_dump().items() if v is not None}
    return manager.start(cfg)


@api.post("/crawl/retry-failed")
async def crawl_retry():
    # Re-walk hierarchy; already-successful GPs are skipped, FAILED ones re-attempted.
    return manager.start(retry_failed=True)


@api.post("/crawl/pause")
async def crawl_pause():
    return manager.pause()


@api.post("/crawl/resume")
async def crawl_resume():
    if manager.state in ("idle", "error", "done"):
        return manager.start()      # resume = restart walk, skips completed GPs
    return manager.resume()


@api.post("/crawl/stop")
async def crawl_stop():
    return manager.stop()


@api.get("/crawl/status")
async def crawl_status():
    return manager.status()


# --------------------------------------------------------------------------
# Records / Summary / Errors
# --------------------------------------------------------------------------
@api.get("/records")
async def records(status: Optional[str] = None, district: Optional[str] = None,
                  search: Optional[str] = None, missing: bool = False,
                  limit: int = 100, offset: int = 0):
    return db.get_records(status, district, search, missing, limit, offset)


@api.get("/summary")
async def summary():
    counts = db.get_counts()
    return {"financial_year": wa.fy_label(), "counts": counts,
            "meta": manager.summary_meta(), "completeness": db.completeness_report()}


@api.get("/errors")
async def errors():
    return {"errors": db.get_errors()}


@api.post("/reset")
async def reset():
    if manager.state in ("running", "paused"):
        return {"ok": False, "message": "Stop the crawl before resetting."}
    db.reset_all()
    return {"ok": True}


# --------------------------------------------------------------------------
# Export
# --------------------------------------------------------------------------
@api.get("/export")
async def export(scope: str = "all"):
    data = excel_export.build_workbook(scope, manager.summary_meta())
    base = wa.excel_filename()
    fname = base if scope == "all" else base.replace(".xlsx", f"_{scope}.xlsx")
    return StreamingResponse(
        io.BytesIO(data),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{fname}"'},
    )


@api.get("/logs/download")
async def logs_download():
    lines = [f"[{l['time']}] {l['level']}: {l['msg']}" for l in list(manager.logs)]
    return StreamingResponse(io.BytesIO(("\n".join(lines)).encode()),
                             media_type="text/plain",
                             headers={"Content-Disposition": 'attachment; filename="crawler_logs.txt"'})


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
