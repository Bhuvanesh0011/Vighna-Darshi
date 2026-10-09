import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

APP_DIR = Path(__file__).resolve().parent
PROJECT_DIR = APP_DIR.parent.parent
load_dotenv(APP_DIR / ".env")

app = FastAPI(
    title="Vighna-Darshi API",
    description="Logistics disruption dashboard API",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restrict to your deployed frontend origin before production.
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

def get_supabase():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_KEY")
    if not url or not key:
        raise HTTPException(
            status_code=503,
            detail="Supabase is not configured. Set SUPABASE_URL and SUPABASE_KEY in vighna-bodha-v2/app/.env."
        )
    try:
        from supabase import create_client
        return create_client(url, key)
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Could not initialize Supabase: {exc}")

class AlertCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=5000)
    severity: str = "warning"
    created_by: str = "admin"

class IncidentCreate(BaseModel):
    incident_type: str = Field(min_length=1, max_length=100)
    description: str = Field(min_length=1, max_length=5000)
    vehicle_id: str = "KA01AB1234"
    reported_by: str = "partner"

@app.get("/api/health")
def health():
    return {"system": "Vighna-Darshi", "status": "online"}

@app.get("/api/alerts")
def list_alerts():
    db = get_supabase()
    try:
        result = db.table("alerts").select("*").order("created_at", desc=True).limit(100).execute()
        return {"alerts": result.data or []}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not read alerts from Supabase. Check the SQL setup and key. Details: {exc}")

@app.post("/api/alerts", status_code=201)
def create_alert(payload: AlertCreate):
    db = get_supabase()
    row = {
        "title": payload.title.strip(),
        "description": payload.description.strip(),
        "severity": payload.severity.lower(),
        "created_by": payload.created_by,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "active": True,
    }
    try:
        result = db.table("alerts").insert(row).execute()
        if not result.data:
            raise HTTPException(status_code=502, detail="Supabase did not return the created alert.")
        return {"alert": result.data[0]}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not save alert to Supabase. Check the SQL setup and key. Details: {exc}")

@app.get("/api/incidents")
def list_incidents():
    db = get_supabase()
    try:
        result = db.table("incidents").select("*").order("created_at", desc=True).limit(100).execute()
        return {"incidents": result.data or []}
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not read incidents from Supabase. Check the SQL setup and key. Details: {exc}")

@app.post("/api/incidents", status_code=201)
def create_incident(payload: IncidentCreate):
    db = get_supabase()
    row = {
        "incident_type": payload.incident_type.strip(),
        "description": payload.description.strip(),
        "vehicle_id": payload.vehicle_id,
        "reported_by": payload.reported_by,
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    try:
        result = db.table("incidents").insert(row).execute()
        if not result.data:
            raise HTTPException(status_code=502, detail="Supabase did not return the created incident.")
        return {"incident": result.data[0]}
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Could not save incident to Supabase. Check the SQL setup and key. Details: {exc}")

# Keep the existing simulator endpoints so the original demo controls continue to work.
@app.get("/vehicle")
def get_vehicle():
    return {
        "vehicle": {
            "vehicle_id": "VEH-001",
            "driver": "Driver 01",
            "status": "moving",
            "current_location": "Chennai Port",
            "destination": "Kavaraipettai",
            "speed_kmph": 40,
            "delay_minutes": 0,
        },
        "route": ["Chennai Port", "Ennore", "Kavaraipettai"],
        "current_route_index": 0,
    }

@app.get("/")
def root():
    return {"system": "Vighna-Darshi", "status": "online", "docs": "/docs", "frontend": "/index.html"}

# Serve the existing static frontend from the same FastAPI server.
app.mount("/", StaticFiles(directory=str(PROJECT_DIR), html=True), name="frontend")
