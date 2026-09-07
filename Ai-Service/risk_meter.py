import os
from typing import Optional
import numpy as np
from fastapi import FastAPI, HTTPException, Header, Depends, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sklearn.ensemble import IsolationForest

from vision_service import analyze_video_feed

app = FastAPI(
    title="SmartInspect AI Risk & Vision Engine",
    description="Department of Social Justice & Empowerment (MoSJE) - Institutional Risk & Headcount Analytics",
    version="1.0.0"
)

# Optional service-to-service API key authentication
INTERNAL_API_KEY = os.environ.get("AI_SERVICE_API_KEY", "")

# Enable CORS for communication with Node.js and client applications
ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


async def verify_api_key(x_api_key: Optional[str] = Header(None)):
    """Optional internal security check when AI_SERVICE_API_KEY is configured."""
    if INTERNAL_API_KEY:
        if not x_api_key or x_api_key != INTERNAL_API_KEY:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unauthorized: Invalid or missing X-API-Key header."
            )
    return True


# -------------------------------------------------------------
# Input & Output Schema Definitions
# -------------------------------------------------------------
class RiskFactorBreakdown(BaseModel):
    attendance_discrepancy_weight: float
    inspection_recency_weight: float
    cctv_downtime_weight: float
    grievance_weight: float
    enrollment_volatility_weight: float


class NGORiskInput(BaseModel):
    institution_id: Optional[str] = Field(None, description="UUID or identifier of the institution")
    ngo_id: Optional[str] = Field(None, description="Legacy identifier alias for institution_id")
    historical_discrepancy_pct: float = Field(0.0, ge=0.0, le=100.0, description="Average % gap between claimed vs detected headcount")
    days_since_last_audit: int = Field(30, ge=0, description="Elapsed days since last on-site inspection")
    cctv_downtime_pct: float = Field(0.0, ge=0.0, le=100.0, description="Percentage of time CCTV feeds were offline or blinded")
    open_complaints: int = Field(0, ge=0, description="Number of unresolved beneficiary/citizen grievances")
    unusual_enrollment_spike_pct: float = Field(0.0, ge=0.0, description="Sudden spike in claimed enrollments before grant cycle")


class RiskEvaluationResponse(BaseModel):
    institution_id: str
    ngo_id: str
    risk_score: float
    risk_level: str
    recommended_action: str
    anomaly_detected: bool
    anomaly_boost_points: float
    factor_breakdown: RiskFactorBreakdown
    model_version: str = "risk-engine-v1.0"


class AttendanceAnalysisInput(BaseModel):
    institution_id: Optional[str] = Field(None, description="Institution UUID")
    inspection_id: Optional[str] = Field(None, description="Inspection UUID")
    claimed_attendance: int = Field(0, ge=0, description="Headcount claimed in register or checklist")
    video_source: str = Field(..., description="Local file path or remote Cloudinary video URL")
    sample_interval_sec: int = Field(1, ge=1, le=10, description="Frame sampling interval in seconds")


class AttendanceAnalysisResponse(BaseModel):
    institution_id: Optional[str] = None
    inspection_id: Optional[str] = None
    claimed_attendance: int
    detected_attendance: int
    average_detected_attendance: int
    peak_detected_attendance: int
    discrepancy_percentage: float
    anomaly_detected: bool
    confidence: float
    frames_analyzed: int
    model_version: str = "yolov8n-attendance-v1.0"


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
# Health Check Endpoints
# -------------------------------------------------------------
@app.get("/")
@app.get("/api/ai/health")
def health_check():
    return {
        "status": "online",
        "service": "SmartInspect AI Risk & Vision Engine",
        "version": "1.0.0",
        "models": {
            "risk_engine": "risk-engine-v1.0",
            "vision_model": "yolov8n-attendance-v1.0"
        }
    }


# -------------------------------------------------------------
# Risk Computation Endpoint
# -------------------------------------------------------------
@app.post("/api/ai/calculate-risk", response_model=RiskEvaluationResponse, dependencies=[Depends(verify_api_key)])
async def calculate_risk(data: NGORiskInput):
    try:
        target_id = data.institution_id or data.ngo_id or "UNKNOWN_INSTITUTION"

        # 1. Feature normalization (mapping variables to a 0-100 hazard scale)
        attendance_hazard = min(100.0, data.historical_discrepancy_pct * 2.2)
        recency_hazard = min(100.0, (data.days_since_last_audit / 90.0) * 100.0)
        cctv_hazard = min(100.0, data.cctv_downtime_pct * 2.0)
        complaint_hazard = min(100.0, data.open_complaints * 20.0)
        volatility_hazard = min(100.0, data.unusual_enrollment_spike_pct * 1.5)

        # 2. Domain-Weighted Baseline Score (0 - 100)
        # Weights: Attendance Discrepancy (30%), Recency (20%), CCTV Downtime (20%), Complaints (15%), Volatility (15%)
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

        decision_score = float(iso_forest.decision_function(sample)[0])
        is_anomaly = bool(iso_forest.predict(sample)[0] == -1)

        # Apply anomaly boost only if sample is detected as an outlier
        anomaly_multiplier = round(max(0.0, -decision_score * 40.0), 1) if is_anomaly else 0.0

        # 4. Final Aggregated Score (Capped strictly between 0 and 100)
        final_risk_score = round(min(100.0, max(0.0, heuristic_score + anomaly_multiplier)), 1)

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

        return RiskEvaluationResponse(
            institution_id=target_id,
            ngo_id=target_id,
            risk_score=final_risk_score,
            risk_level=level,
            recommended_action=action,
            anomaly_detected=is_anomaly,
            anomaly_boost_points=anomaly_multiplier,
            factor_breakdown=RiskFactorBreakdown(
                attendance_discrepancy_weight=round(attendance_hazard, 1),
                inspection_recency_weight=round(recency_hazard, 1),
                cctv_downtime_weight=round(cctv_hazard, 1),
                grievance_weight=round(complaint_hazard, 1),
                enrollment_volatility_weight=round(volatility_hazard, 1)
            ),
            model_version="risk-engine-v1.0"
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Risk calculation failed: {str(e)}"
        )


# -------------------------------------------------------------
# Computer Vision Attendance Analysis Endpoint
# -------------------------------------------------------------
@app.post("/api/ai/analyze-attendance", response_model=AttendanceAnalysisResponse, dependencies=[Depends(verify_api_key)])
async def analyze_attendance(data: AttendanceAnalysisInput):
    try:
        analysis_result = analyze_video_feed(
            video_source=data.video_source,
            claimed_count=data.claimed_attendance,
            institution_id=data.institution_id,
            inspection_id=data.inspection_id,
            sample_interval_sec=data.sample_interval_sec
        )

        if not analysis_result:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Computer vision pipeline could not extract frames or process the video feed."
            )

        return AttendanceAnalysisResponse(**analysis_result)

    except HTTPException:
        raise
    except FileNotFoundError as fnf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(fnf))
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Attendance analysis failed: {str(e)}"
        )


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)