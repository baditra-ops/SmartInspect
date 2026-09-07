# SmartInspect AI Service (SIH26-26095 / MoSJE)

Microservice for Automated Institutional Risk Scoring and Computer Vision Attendance Verification for the Department of Social Justice and Empowerment (MoSJE).

---

## 1. Architecture & Capabilities

The AI Service provides two core analytical pipelines:

1. **Institutional Risk Engine (`risk_meter.py`)**:
   - **Weighted Domain Hazard Scoring**: Calculates normalized risk factors (0-100) across 5 core compliance pillars:
     - **Attendance Discrepancy** (30% weight): Normalized by factor `2.2x`.
     - **Audit Recency** (20% weight): Normalized by `(days / 90) * 100`.
     - **CCTV Downtime** (20% weight): Normalized by factor `2.0x`.
     - **Grievances / Complaints** (15% weight): Normalized by factor `20.0x`.
     - **Enrollment Volatility Spike** (15% weight): Normalized by factor `1.5x`.
   - **Isolation Forest Anomaly Detection**: Evaluates multi-dimensional feature vectors against a synthetic baseline of compliant, borderline, and fraudulent institution behaviors (`contamination=0.15`, `n_estimators=100`). Anomaly outliers receive a dynamic boost penalty (up to +40 points).
   - **Risk Levels**:
     - `CRITICAL_HIGH` (Score $\ge$ 70.0): Recommended action `AUTO_TRIGGER_SURPRISE_INSPECTION`.
     - `MODERATE` (Score 40.0 - 69.9): Recommended action `QUEUE_ROUTINE_AUDIT`.
     - `COMPLIANT_LOW` (Score $<$ 40.0): Recommended action `STANDBY`.

2. **Computer Vision Attendance Verification (`vision_service.py`)**:
   - Uses YOLOv8-nano / YOLO11-nano object detection tuned for person class (`class=0`, `conf=0.20`).
   - Analyzes video feeds (local or secure Cloudinary URLs) frame-by-frame with configurable time sampling.
   - Computes average detected headcount, peak detected headcount, and discrepancy against claimed headcount.
   - Automatically flags anomalies when shortfall $\ge 20\%$.

---

## 2. API Contracts

### A. Health Check
- **Endpoint**: `GET /api/ai/health`
- **Response**:
```json
{
  "status": "online",
  "service": "SmartInspect AI Risk & Vision Engine",
  "version": "1.0.0",
  "models": {
    "risk_engine": "risk-engine-v1.0",
    "vision_model": "yolov8n-attendance-v1.0"
  }
}
```

### B. Calculate Institution Risk
- **Endpoint**: `POST /api/ai/calculate-risk`
- **Headers**: `X-API-Key: <INTERNAL_KEY>` (optional if configured)
- **Request Body**:
```json
{
  "institution_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "historical_discrepancy_pct": 25.0,
  "days_since_last_audit": 110,
  "cctv_downtime_pct": 30.0,
  "open_complaints": 3,
  "unusual_enrollment_spike_pct": 15.0
}
```
- **Response**:
```json
{
  "institution_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "ngo_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "risk_score": 78.5,
  "risk_level": "CRITICAL_HIGH",
  "recommended_action": "AUTO_TRIGGER_SURPRISE_INSPECTION",
  "anomaly_detected": true,
  "anomaly_boost_points": 14.2,
  "factor_breakdown": {
    "attendance_discrepancy_weight": 55.0,
    "inspection_recency_weight": 100.0,
    "cctv_downtime_weight": 60.0,
    "grievance_weight": 60.0,
    "enrollment_volatility_weight": 22.5
  },
  "model_version": "risk-engine-v1.0"
}
```

### C. Analyze Evidence Video Attendance
- **Endpoint**: `POST /api/ai/analyze-attendance`
- **Request Body**:
```json
{
  "institution_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "inspection_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "claimed_attendance": 35,
  "video_source": "https://res.cloudinary.com/demo/video/upload/sample.mp4",
  "sample_interval_sec": 1
}
```
- **Response**:
```json
{
  "institution_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "inspection_id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "claimed_attendance": 35,
  "detected_attendance": 22,
  "average_detected_attendance": 22,
  "peak_detected_attendance": 24,
  "discrepancy_percentage": 37.14,
  "anomaly_detected": true,
  "confidence": 0.88,
  "frames_analyzed": 28,
  "model_version": "yolov8n-attendance-v1.0"
}
```

---

## 3. Installation & Local Development

### Prerequisites
- Python 3.9+ (or virtual environment)

### Setup
```bash
# Navigate to AI service directory
cd Ai-Service

# Install dependencies
pip install -r requirements.txt

# Start FastAPI server
python risk_meter.py
# Or with uvicorn
uvicorn risk_meter:app --host 0.0.0.0 --port 8000 --reload
```

---

## 4. Ethical AI & Decision Support Disclaimer

> [!IMPORTANT]
> The AI algorithms within SmartInspect are intended solely as **decision-support tools** for authorized government officials and inspectors of the Department of Social Justice and Empowerment (MoSJE). 
> 
> - Anomaly flags and risk scores **do not constitute legal determinations of guilt or fraud**.
> - All high-risk alerts and inspection recommendations must be validated through physical, on-site inspections and verified by designated officers before taking administrative or compliance action.
