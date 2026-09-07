import os
import tempfile
import urllib.parse
from typing import Optional, Dict, Any, List
import imageio
import numpy as np
from PIL import Image
import requests

# Model paths
YOLO_MODEL_PATH = os.environ.get("YOLO_MODEL_PATH", "yolov8n.pt")

# Lazy-loaded YOLO model cache
_yolo_model = None

def get_yolo_model():
    """Lazy load YOLO model to avoid unnecessary memory overhead if only risk scoring is called."""
    global _yolo_model
    if _yolo_model is None:
        from ultralytics import YOLO
        model_path = YOLO_MODEL_PATH if os.path.exists(YOLO_MODEL_PATH) else "yolov8n.pt"
        print(f"[INFO] Loading YOLO model from {model_path}...")
        _yolo_model = YOLO(model_path)
    return _yolo_model


def is_safe_url(url: str) -> bool:
    """Validate URL scheme and format to avoid SSRF vulnerabilities."""
    try:
        parsed = urllib.parse.urlparse(url)
        # Allow http and https schemes, reject localhost/private IP ranges if needed in strict mode
        if parsed.scheme not in ("http", "https"):
            return False
        if not parsed.netloc:
            return False
        return True
    except Exception:
        return False


def analyze_video_feed(
    video_source: str,
    claimed_count: int = 0,
    institution_id: Optional[str] = None,
    inspection_id: Optional[str] = None,
    sample_interval_sec: int = 1,
    max_frames_to_sample: int = 30,
) -> Dict[str, Any]:
    """
    Analyzes video footage to detect people/headcount, calculate attendance metrics,
    and compute discrepancy rate against claimed headcount.

    :param video_source: Local file path or secure remote URL (Cloudinary).
    :param claimed_count: Number of attendees claimed by the institution/inspector.
    :param institution_id: Identifier of the institution.
    :param inspection_id: Identifier of the inspection.
    :param sample_interval_sec: Seconds between sampled frames.
    :param max_frames_to_sample: Maximum number of frames to inspect per video.
    :return: Structured dictionary with detected metrics.
    """
    temp_file_created = False
    local_video_path = video_source

    try:
        # If source is a URL, validate and safely stream to a temporary file
        if video_source.startswith("http://") or video_source.startswith("https://"):
            if not is_safe_url(video_source):
                raise ValueError(f"Invalid or unsafe video URL: {video_source}")

            print(f"[INFO] Downloading remote video stream from: {video_source}")
            resp = requests.get(video_source, stream=True, timeout=30)
            resp.raise_for_status()

            temp_file = tempfile.NamedTemporaryFile(suffix=".mp4", delete=False)
            local_video_path = temp_file.name
            temp_file_created = True

            with open(local_video_path, "wb") as f:
                for chunk in resp.iter_content(chunk_size=65536):
                    if chunk:
                        f.write(chunk)

        if not os.path.exists(local_video_path):
            raise FileNotFoundError(f"Video file not found at: {local_video_path}")

        print(f"\n--- Processing Video: {local_video_path} for Institution [{institution_id or 'N/A'}] ---")

        model = get_yolo_model()
        reader = imageio.get_reader(local_video_path)
        fps = reader.get_meta_data().get("fps", 25)
        if fps <= 0:
            fps = 25
        frame_step = max(1, int(fps * sample_interval_sec))

        headcounts: List[int] = []
        confidences: List[float] = []
        frame_idx = 0

        for i, frame in enumerate(reader):
            if i % frame_step != 0:
                continue

            pil_frame = Image.fromarray(frame)

            # Person detection (class 0 in COCO dataset is 'person')
            # conf=0.20 to accurately catch seated or partially occluded individuals
            results = model(pil_frame, classes=[0], conf=0.20, verbose=False)
            boxes = results[0].boxes
            person_count = len(boxes)
            headcounts.append(person_count)

            if len(boxes) > 0 and hasattr(boxes, "conf") and len(boxes.conf) > 0:
                avg_frame_conf = float(np.mean(boxes.conf.cpu().numpy()))
                confidences.append(avg_frame_conf)

            frame_idx += 1
            if frame_idx >= max_frames_to_sample:
                break

        reader.close()

        if not headcounts:
            raise ValueError("Could not extract or decode frames from the video.")

        avg_detected = int(round(float(np.mean(headcounts))))
        peak_detected = int(np.max(headcounts))
        overall_confidence = round(float(np.mean(confidences)), 2) if confidences else 0.85

        # Calculate discrepancy rate against claimed attendance
        if claimed_count > 0:
            shortfall = max(0, claimed_count - avg_detected)
            discrepancy_pct = round((shortfall / claimed_count) * 100.0, 2)
            anomaly_detected = discrepancy_pct >= 20.0
        else:
            discrepancy_pct = 0.0
            anomaly_detected = False

        result = {
            "institution_id": institution_id,
            "inspection_id": inspection_id,
            "claimed_attendance": claimed_count,
            "detected_attendance": avg_detected,
            "average_detected_attendance": avg_detected,
            "peak_detected_attendance": peak_detected,
            "discrepancy_percentage": discrepancy_pct,
            "anomaly_detected": anomaly_detected,
            "confidence": overall_confidence,
            "frames_analyzed": len(headcounts),
            "model_version": "yolov8n-attendance-v1.0",
        }

        print("\n================ VIDEO INSPECTION SUMMARY ================")
        print(f"Institution ID      : {institution_id}")
        print(f"Claimed Attendance  : {claimed_count}")
        print(f"Avg Detected People : {avg_detected} (Peak: {peak_detected})")
        print(f"Discrepancy Rate    : {discrepancy_pct}%")
        print(f"Anomaly Flagged     : {anomaly_detected}")
        print("==========================================================")

        return result

    finally:
        # Clean up temporary downloaded file
        if temp_file_created and os.path.exists(local_video_path):
            try:
                os.remove(local_video_path)
            except Exception as cleanup_err:
                print(f"[WARNING] Failed to remove temp file {local_video_path}: {cleanup_err}")


if __name__ == "__main__":
    video_file = "sample_classroom.mp4"
    if os.path.exists(video_file):
        res = analyze_video_feed(video_file, claimed_count=35, institution_id="DEMO-INST-001")
        print("Result:", res)
    else:
        print(f"Sample video '{video_file}' not found.")