"""
WebSocket endpoint for real-time face recognition and attendance marking.
Uses DeepFace Facenet512 embeddings with multi-frame confirmation
to ensure accurate, reliable attendance marking.
"""
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from sqlalchemy import func
import cv2
import numpy as np
import base64
import json
from datetime import datetime, timedelta, date
from collections import defaultdict

from app.db.session import SessionLocal
from app.services.face_detection import face_detector
from app.services.face_embedding import face_embedding_service
from app.models.student import Student
from app.models.attendance import Attendance, AttendanceStatus

router = APIRouter()

# ──────────────────────────────────────────────────────────────
#  In-memory cache for known face embeddings (refreshed every 60s)
# ──────────────────────────────────────────────────────────────
known_faces_cache: dict = {}
active_students_cache: dict = {}
last_cache_update: datetime = datetime.min

# Number of consecutive frames a face must match before attendance is marked
CONFIRMATION_FRAMES_REQUIRED = 3
# Maximum cosine distance to accept as a match
MATCH_THRESHOLD = 0.45


def update_cache(db: Session) -> None:
    """Refresh the embedding cache from the database every 60 seconds."""
    global known_faces_cache, last_cache_update, active_students_cache

    if datetime.now() - last_cache_update > timedelta(minutes=1):
        students = db.query(Student).filter(Student.is_active == True).all()
        known_faces_cache = {}
        active_students_cache = {}
        for s in students:
            if s.face_embedding is not None:
                emb = np.frombuffer(s.face_embedding, dtype=np.float32)
                # Only use embeddings whose dimensionality matches Facenet512
                if emb.shape[0] == 512:
                    known_faces_cache[s.id] = emb
                    active_students_cache[s.id] = s
        last_cache_update = datetime.now()


def _crop_face(frame: np.ndarray, bbox: tuple, margin: float = 0.3) -> np.ndarray:
    """
    Crop a face region from the frame with a percentage margin.
    Ensures the crop doesn't go out of bounds.
    """
    h, w = frame.shape[:2]
    x, y, fw, fh = bbox
    mx = int(fw * margin)
    my = int(fh * margin)
    x1 = max(0, x - mx)
    y1 = max(0, y - my)
    x2 = min(w, x + fw + mx)
    y2 = min(h, y + fh + my)
    return frame[y1:y2, x1:x2]


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()

    db = SessionLocal()
    update_cache(db)

    # Multi-frame confirmation tracker:  student_id -> consecutive_match_count
    confirmation_tracker: dict[int, int] = defaultdict(int)
    last_matched_id: int | None = None

    # Set of student IDs already marked in THIS session (avoid repeated DB writes)
    session_marked: set[int] = set()

    try:
        while True:
            update_cache(db)
            data = await websocket.receive_text()

            # ── Decode base64 image ─────────────────────────────────
            if "," in data:
                _, encoded = data.split(",", 1)
            else:
                encoded = data

            try:
                nparr = np.frombuffer(base64.b64decode(encoded), np.uint8)
                img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            except Exception:
                continue

            if img is None:
                continue

            # ── Detect faces ────────────────────────────────────────
            faces, _ = face_detector.process_frame(img)

            detected_results = []

            if faces:
                for bbox in faces:
                    x, y, fw, fh = bbox

                    # Crop face with margin for the embedding model
                    face_crop = _crop_face(img, bbox, margin=0.35)

                    # Get DeepFace embedding
                    embedding = face_embedding_service.get_embedding(
                        face_crop, enforce_detection=False
                    )

                    # If crop failed, try full frame
                    if embedding is None:
                        embedding = face_embedding_service.get_embedding(
                            img, enforce_detection=False
                        )

                    student_id = None
                    dist = float("inf")
                    name = "Unknown"
                    marked = False
                    confirmed = False

                    if embedding is not None and known_faces_cache:
                        student_id, dist = face_embedding_service.find_best_match(
                            embedding, known_faces_cache, threshold=MATCH_THRESHOLD
                        )

                    if student_id is not None:
                        student = active_students_cache.get(student_id)
                        if student:
                            name = student.name

                            # ── Multi-frame confirmation ────────────
                            if student_id == last_matched_id:
                                confirmation_tracker[student_id] += 1
                            else:
                                # New face or different person — reset all counters
                                confirmation_tracker.clear()
                                confirmation_tracker[student_id] = 1

                            last_matched_id = student_id
                            frames_so_far = confirmation_tracker[student_id]
                            confirmed = frames_so_far >= CONFIRMATION_FRAMES_REQUIRED

                            # ── Mark attendance once confirmed ──────
                            if confirmed and student_id not in session_marked:
                                today = datetime.now().date()
                                existing = (
                                    db.query(Attendance)
                                    .filter(
                                        Attendance.student_id == student_id,
                                        func.date(Attendance.timestamp) == today,
                                    )
                                    .first()
                                )

                                if not existing:
                                    new_record = Attendance(
                                        student_id=student_id,
                                        status=AttendanceStatus.PRESENT,
                                    )
                                    db.add(new_record)
                                    db.commit()
                                    marked = True
                                else:
                                    marked = False  # already marked today

                                session_marked.add(student_id)
                    else:
                        # Unknown face — reset tracker
                        last_matched_id = None
                        confirmation_tracker.clear()

                    confidence = max(0, float(1 - dist)) if dist != float("inf") else 0

                    detected_results.append(
                        {
                            "name": name,
                            "confidence": round(confidence, 3),
                            "marked": marked,
                            "confirmed": confirmed,
                            "bbox": {"x": int(x), "y": int(y), "w": int(fw), "h": int(fh)},
                            "frames_confirmed": confirmation_tracker.get(
                                student_id, 0
                            )
                            if student_id
                            else 0,
                            "frames_required": CONFIRMATION_FRAMES_REQUIRED,
                        }
                    )

            # Send response back to client
            await websocket.send_json({"detected": detected_results})

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"WebSocket error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()
