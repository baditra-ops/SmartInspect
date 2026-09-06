import os
import imageio
from PIL import Image
import numpy as np
import requests
from ultralytics import YOLO

# 1. Load YOLOv8-nano model
print("[INFO] Loading YOLOv8-nano model for video headcount...")
model = YOLO("yolov8n.pt")

def analyze_video_feed(video_path: str, claimed_count: int, ngo_id: str, sample_interval_sec: int = 1):
    if not os.path.exists(video_path):
        print(f"[ERROR] Video file not found: {video_path}")
        return None

    print(f"\n--- Processing Video: {video_path} for NGO [{ngo_id}] ---")
    
    # Open video reader using imageio-ffmpeg
    reader = imageio.get_reader(video_path)
    fps = reader.get_meta_data().get('fps', 25)
    frame_step = max(1, int(fps * sample_interval_sec))
    
    headcounts = []
    frame_idx = 0

    for i, frame in enumerate(reader):
        if i % frame_step != 0:
            continue

        pil_frame = Image.fromarray(frame)

        # Person detection (conf lowered to 0.20 to catch seated/back-row people)
        results = model(pil_frame, classes=[0], conf=0.20, verbose=False)
        person_count = len(results[0].boxes)
        headcounts.append(person_count)
        
        frame_idx += 1
        print(f"Frame {frame_idx} (Sec ~{int(i / fps)}s): Detected {person_count} attendees")
        
        if frame_idx >= 30:
            break

    reader.close()

    if not headcounts:
        print("[ERROR] Could not extract frames from video.")
        return None

    avg_detected = int(round(np.mean(headcounts)))
    max_detected = int(np.max(headcounts))

    # Attendance Discrepancy %
    if claimed_count > 0:
        shortfall = max(0, claimed_count - avg_detected)
        discrepancy_pct = round((shortfall / claimed_count) * 100.0, 2)
    else:
        discrepancy_pct = 0.0

    print("\n================ VIDEO INSPECTION SUMMARY ================")
    print(f"NGO ID              : {ngo_id}")
    print(f"Claimed Attendance  : {claimed_count}")
    print(f"Avg Detected People : {avg_detected} (Peak: {max_detected})")
    print(f"Discrepancy Rate    : {discrepancy_pct}%")
    print("==========================================================")

    # Sync with Risk Service on Port 8000
    risk_server_url = "http://127.0.0.1:8000/api/ai/calculate-risk"
    payload = {
        "ngo_id": ngo_id,
        "historical_discrepancy_pct": discrepancy_pct,
        "cctv_downtime_pct": 25.0,
        "unverified_beneficiary_pct": 20.0,
        "days_since_last_audit": 110,
        "inspection_evasion_count": 1,
        "open_complaints": 3,
        "unusual_enrollment_spike_pct": 15.0
    }

    try:
        response = requests.post(risk_server_url, json=payload, timeout=5)
        if response.status_code == 200:
            risk_result = response.json()
            print("\n[SUCCESS] Synced with Institutional Risk Engine:")
            print(f"-> Risk Score        : {risk_result['risk_score']} / 100")
            print(f"-> Risk Level        : {risk_result['risk_level']}")
            print(f"-> Recommended Action: {risk_result['recommended_action']}")
            return risk_result
        else:
            print(f"[ERROR] Risk server error: {response.status_code}")
    except requests.exceptions.ConnectionError:
        print("\n[WARNING] Could not connect to http://127.0.0.1:8000. Start risk_service.py to receive the score.")

    return None

if __name__ == "__main__":
    video_file = "sample_classroom.mp4"
    analyze_video_feed(video_file, claimed_count=35, ngo_id="NGO-UP-8841")