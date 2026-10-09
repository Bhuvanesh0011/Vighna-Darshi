
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from datetime import datetime

app = FastAPI(
    title="Vighna Bodha - Live Logistics Simulator",
    description="Virtual vehicle, accident detection, alerts and rerouting",
    version="2.0"
)

vehicle = {
    "vehicle_id": "VEH-001",
    "driver": "Driver 01",
    "status": "moving",
    "current_location": "Chennai Port",
    "destination": "Kavaraipettai",
    "speed_kmph": 40,
    "delay_minutes": 0
}

route = [
    "Chennai Port",
    "Ennore",
    "Kavaraipettai"
]

alternative_route = [
    "Chennai Port",
    "Madhavaram Bypass",
    "Minjur",
    "Kavaraipettai"
]

current_route_index = 0

delivery = {
    "package_id": "PKG-001",
    "destination": "Kavaraipettai",
    "priority": "critical",
    "status": "in_transit"
}

alerts = []


class AccidentRequest(BaseModel):
    vehicle_id: str
    location: str
    severity: str = "high"
    reason: str = "Road accident"


@app.get("/")
def root():
    return {
        "system": "Vighna Bodha",
        "status": "online",
        "mode": "live simulation"
    }


@app.get("/vehicle")
def get_vehicle():
    return {
        "vehicle": vehicle,
        "route": route,
        "current_route_index": current_route_index
    }


@app.post("/simulation/move")
def move_vehicle():
    global current_route_index

    if vehicle["status"] in ["accident", "rerouting"]:
        return {
            "message": "Vehicle cannot move during current state",
            "vehicle": vehicle
        }

    if current_route_index < len(route) - 1:
        current_route_index += 1
        vehicle["current_location"] = route[current_route_index]

        return {
            "message": "Vehicle moved",
            "vehicle_id": vehicle["vehicle_id"],
            "current_location": vehicle["current_location"],
            "status": vehicle["status"]
        }

    return {
        "message": "Vehicle reached destination",
        "vehicle": vehicle
    }


@app.post("/simulation/accident")
def simulate_accident(data: AccidentRequest):
    if data.vehicle_id != vehicle["vehicle_id"]:
        raise HTTPException(
            status_code=404,
            detail="Vehicle not found"
        )

    vehicle["status"] = "accident"
    vehicle["current_location"] = data.location
    vehicle["delay_minutes"] = 90

    alert = {
        "alert_id": len(alerts) + 1,
        "timestamp": datetime.now().isoformat(),
        "type": "ACCIDENT",
        "vehicle_id": data.vehicle_id,
        "location": data.location,
        "severity": data.severity,
        "reason": data.reason,
        "message": (
            f"Vehicle {data.vehicle_id} has met with an accident "
            f"at {data.location}. Estimated delay: 90 minutes."
        ),
        "read": False
    }

    alerts.append(alert)
    delivery["status"] = "delayed"

    return {
        "event": "ACCIDENT_DETECTED",
        "vehicle": vehicle,
        "delivery": delivery,
        "alert": alert
    }


@app.get("/alerts")
def get_alerts():
    return {
        "count": len(alerts),
        "alerts": alerts
    }


@app.get("/impact")
def impact_analysis():
    if vehicle["status"] != "accident":
        return {
            "status": "no_active_disruption",
            "message": "No accident currently detected"
        }

    return {
        "disruption": {
            "type": "road_accident",
            "location": vehicle["current_location"],
            "severity": "high"
        },
        "impact": {
            "affected_vehicles": 1,
            "affected_deliveries": 1,
            "critical_deliveries": 1,
            "estimated_delay_minutes": 90
        },
        "affected_vehicle": vehicle["vehicle_id"],
        "affected_delivery": delivery["package_id"]
    }


@app.post("/simulation/reroute")
def reroute_vehicle():
    if vehicle["status"] != "accident":
        raise HTTPException(
            status_code=400,
            detail="No accident requiring rerouting"
        )

    old_route = route.copy()

    vehicle["status"] = "rerouted"
    vehicle["delay_minutes"] = 25

    delivery["status"] = "in_transit"

    return {
        "event": "REROUTE_COMPLETED",
        "vehicle_id": vehicle["vehicle_id"],
        "old_route": old_route,
        "new_route": alternative_route,
        "avoided_location": "Ennore",
        "original_delay_minutes": 90,
        "new_delay_minutes": 25,
        "delay_reduction_minutes": 65,
        "delivery_status": delivery["status"],
        "message": "Vehicle successfully rerouted."
    }


@app.get("/delivery")
def get_delivery():
    return delivery


@app.get("/simulation/status")
def simulation_status():
    return {
        "vehicle": vehicle,
        "delivery": delivery,
        "route": route,
        "alternative_route": alternative_route,
        "active_alerts": alerts,
        "simulation": {
            "accident_detected": vehicle["status"] == "accident",
            "rerouted": vehicle["status"] == "rerouted"
        }
    }

@app.post("/alerts/{alert_id}/send-to-partner")
def send_alert_to_partner(alert_id: int):
    for alert in alerts:
        if alert["alert_id"] == alert_id:
            alert["sent_to_partner"] = True
            alert["partner_id"] = "DP-001"
            alert["partner_read"] = False
            return {"status": "sent", "alert": alert, "delivery_partner": "DP-001"}
    raise HTTPException(status_code=404, detail="Alert not found")

@app.get("/partner/alerts")
def get_partner_alerts():
    partner_alerts = [a for a in alerts if a.get("sent_to_partner") is True and a.get("partner_id") == "DP-001" and a.get("partner_read") is False]
    return {"count": len(partner_alerts), "alerts": partner_alerts}

@app.post("/partner/alerts/{alert_id}/read")
def mark_partner_alert_read(alert_id: int):
    for alert in alerts:
        if alert["alert_id"] == alert_id and alert.get("partner_id") == "DP-001":
            alert["partner_read"] = True
            return {"status": "read", "alert_id": alert_id}
    raise HTTPException(status_code=404, detail="Partner alert not found")
