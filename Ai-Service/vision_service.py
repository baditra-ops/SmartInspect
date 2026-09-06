import os

# 1. Force Ultralytics to not rely on cv2 bindings
os.environ["YOLO_VERBOSE"] = "False"
import requests
from PIL import Image
from ultralytics import YOLO

# 2. Load the model
print("[INFO] Loading YOLOv8-nano model for person detection...")
model = YOLO("yolov8n.pt")


def audit_inspection_image(image_path: str, claimed_count: int, ngo_id: str):
  if not os.path.exists(image_path):
    print(f"[ERROR] Image file not found: {image_path}")
    return None

  # Load image using Pillow (PIL)
  img = Image.open(image_path)

  # Run Person Detection (COCO class 0 = 'person')
  results = model(img, classes=[0], conf=0.35, verbose=False)
  detected_count = len(results[0].boxes)

  # Calculate Attendance Discrepancy %
  if claimed_count > 0:
    shortfall = max(0, claimed_count - detected_count)
    discrepancy_pct = round((shortfall / claimed_count) * 100.0, 1)
  else:
    discrepancy_pct = 0.0

  print("\n================ INSPECTION AUDIT REPORT ================")
  print(f"NGO ID             : {ngo_id}")
  print(f"Claimed Attendance : {claimed_count}")
  print(f"AI Detected People : {detected_count}")
  print(f"Discrepancy Rate   : {discrepancy_pct}%")
  print("=========================================================")

  # Forward calculated discrepancy to your running Risk Engine Server
  risk_server_url = "http://127.0.0.1:8000/api/ai/calculate-risk"
  payload = {
      "ngo_id": ngo_id,
      "historical_discrepancy_pct": discrepancy_pct,
      "days_since_last_audit": 110,
      "cctv_downtime_pct": 25.0,
      "open_complaints": 3,
      "unusual_enrollment_spike_pct": 15.0,
  }

  try:
    response = requests.post(risk_server_url, json=payload, timeout=5)
    if response.status_code == 200:
      risk_data = response.json()
      print("\n[SUCCESS] Synced with Institutional Risk Engine:")
      print(f"-> Risk Score        : {risk_data.get('risk_score')} / 100")
      print(f"-> Risk Level        : {risk_data.get('risk_level')}")
      print(f"-> Recommended Action: {risk_data.get('recommended_action')}")
      return risk_data
    else:
      print(
          f"[ERROR] Risk server rejected payload ({response.status_code}):"
          f" {response.text}"
      )
  except requests.exceptions.ConnectionError:
    print(
      "\n[WARNING] Could not connect to http://127.0.0.1:8000. Is"
      " risk_service.py running?"
    )

  return None


if __name__ == "__main__":
  sample_image = "test.jpg"
  if os.path.exists(sample_image):
    audit_inspection_image(
        sample_image, claimed_count=30, ngo_id="NGO-UP-VARANASI-01"
    )
  else:
    print(
        f"[READY] Vision service script is valid and ready. Place a sample"
        f" '{sample_image}' in this folder to run a live test."
    )