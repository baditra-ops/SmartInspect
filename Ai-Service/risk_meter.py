import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sklearn.ensemble import IsolationForest

app = FastAPI(title="DoSJE Institutional Risk Evaluation Engine")

# Enable CORS for communication with Node.js and React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# -------------------------------------------------------------
# Input Schema Definition
# -------------------------------------------------------------
class NGORiskInput(BaseModel):
    ngo_id: str
    historical_discrepancy_pct: float = Field(0.0, ge=0, le=100, description="Average % gap between claimed vs detected headcount")
    days_since_last_audit: int = Field(30, ge=0, description="Elapsed days since last on-site inspection")
    cctv_downtime_pct: float = Field(0.0, ge=0, le=100, description="Percentage of time CCTV feeds were offline or blinded")
    open_complaints: int = Field(0, ge=0, description="Number of unresolved beneficiary/citizen grievances")
    unusual_enrollment_spike_pct: float = Field(0.0, ge=0, description="Sudden spike in claimed enrollments before grant cycle")

# -------------------------------------------------------------
# Synthetic Baseline Data to Pre-fit Isolation Forest
# -------------------------------------------------------------
# Features: [discrepancy, days_since_audit, cctv_down, complaints, spike]
synthetic_baseline = np.array([
    # Standard compliant institutes
    [2.0,  15, 1.0, 0, 1.0],
    [4.0,  20, 2.0, 0, 2.0],
    [5.0,  25, 2.5, 0, 3.0],
    [6.0,  30, 3.0, 0, 2.0],
    [7.0,  35, 4.0, 0, 4.0],
    [8.0,  40, 5.0, 1, 3.0],
    [10.0, 45, 6.0, 1, 5.0],
    [11.0, 50, 5.5, 0, 4.0],
    [12.0, 55, 7.0, 1, 6.0],
    [14.0, 60, 8.0, 1, 5.0],
    [3.0,  18, 1.5, 0, 0.0],
    [9.0,  42, 4.5, 0, 3.5],
    [13.0, 58, 6.5, 1, 7.0],
    # Borderline cases
    [20.0, 75, 12.0, 2, 12.0],
    [22.0, 80, 15.0, 2, 15.0],
    # Extreme outlier / fraudulent patterns
    [45.0, 120, 35.0, 5, 40.0],
    [50.0, 150, 40.0, 6, 60.0],
    [60.0, 180, 55.0, 7, 75.0],
])

iso_forest = IsolationForest(n_estimators=100, contamination=0.15, random_state=42)
iso_forest.fit(synthetic_baseline)

# -------------------------------------------------------------
# Health Check Endpoint
# -------------------------------------------------------------
@app.get("/")
def health_check():
    return {
        "status": "online",
        "service": "DoSJE Institutional Risk Evaluation Engine",
        "version": "1.0.0"
    }

# -------------------------------------------------------------
# Risk Computation Logic
# -------------------------------------------------------------
@app.post("/api/ai/calculate-risk")
async def calculate_risk(data: NGORiskInput):
    try:
        # 1. Feature normalization (mapping variables to a 0-100 hazard scale)
        attendance_hazard = min(100.0, data.historical_discrepancy_pct * 2.2)
        recency_hazard = min(100.0, (data.days_since_last_audit / 90.0) * 100.0)
        cctv_hazard = min(100.0, data.cctv_downtime_pct * 2.0)
        complaint_hazard = min(100.0, data.open_complaints * 20.0)
        volatility_hazard = min(100.0, data.unusual_enrollment_spike_pct * 1.5)

        # 2. Domain-Weighted Baseline Score (0 - 100)
        heuristic_score = (
            (0.30 * attendance_hazard) +
            (0.20 * recency_hazard) +
            (0.20 * cctv_hazard) +
            (0.15 * complaint_hazard) +
            (0.15 * volatility_hazard)
        )

        # 3. Machine Learning Outlier Assessment (Isolation Forest)
        sample = np.array([[
            data.historical_discrepancy_pct,
            data.days_since_last_audit,
            data.cctv_downtime_pct,
            data.open_complaints,
            data.unusual_enrollment_spike_pct
        ]])

        # decision_function: positive (> 0) = inlier/normal; negative (< 0) = outlier
        decision_score = float(iso_forest.decision_function(sample)[0])
        is_anomaly = bool(iso_forest.predict(sample)[0] == -1)

        # Apply anomaly boost only if sample is detected as an outlier
        anomaly_multiplier = round(max(0.0, -decision_score * 40.0), 1) if is_anomaly else 0.0

        # 4. Final Aggregated Score (Capped between 0 and 100)
        final_risk_score = round(min(100.0, heuristic_score + anomaly_multiplier), 1)

        # 5. Risk Categorization & Actionable Directives
        if final_risk_score >= 70.0:
            level = "CRITICAL_HIGH"
            action = "AUTO_TRIGGER_SURPRISE_INSPECTION"
        elif final_risk_score >= 40.0:
            level = "MODERATE"
            action = "QUEUE_ROUTINE_AUDIT"
        else:
            level = "COMPLIANT_LOW"
            action = "STANDBY"

        return {
            "ngo_id": data.ngo_id,
            "risk_score": final_risk_score,
            "risk_level": level,
            "recommended_action": action,
            "anomaly_detected": is_anomaly,
            "anomaly_boost_points": anomaly_multiplier,
            "factor_breakdown": {
                "attendance_discrepancy_weight": round(attendance_hazard, 1),
                "inspection_recency_weight": round(recency_hazard, 1),
                "cctv_downtime_weight": round(cctv_hazard, 1),
                "grievance_weight": round(complaint_hazard, 1),
                "enrollment_volatility_weight": round(volatility_hazard, 1)
            }
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)