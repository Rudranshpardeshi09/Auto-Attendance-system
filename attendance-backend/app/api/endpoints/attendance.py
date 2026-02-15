from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, date, timedelta
import cv2
import numpy as np

from app.db.session import SessionLocal
from app.models.attendance import Attendance
from app.models.student import Student
from app.schemas.attendance import Attendance as AttendanceSchema, AttendanceHistoryResponse, DailyAttendance, StudentAttendanceStatus
from app.services.face_detection import face_detector
from app.services.face_embedding import face_embedding_service

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/mark")
async def mark_attendance(
    file: UploadFile = File(...),
    skip_liveness: bool = Query(True, description="Skip liveness check"),
    db: Session = Depends(get_db)
):
    """
    Accepts an image (camera frame), detects face, matches embedding,
    and marks attendance for the matched student.
    Uses DeepFace embeddings for robust face recognition.
    """
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail="Invalid image file")

        # Detect face in the image
        faces, _ = face_detector.process_frame(img)

        if not faces:
            return {"success": False, "message": "No face detected"}

        if len(faces) > 1:
            return {"success": False, "message": "Multiple faces detected. Please show only one face."}

        # Get embedding using DeepFace
        embedding = face_embedding_service.get_embedding(img, enforce_detection=False)

        if embedding is None:
            # Fallback: try with rotation
            rotations = [cv2.ROTATE_90_CLOCKWISE, cv2.ROTATE_180, cv2.ROTATE_90_COUNTERCLOCKWISE]
            for rotate_code in rotations:
                rotated = cv2.rotate(img, rotate_code)
                embedding = face_embedding_service.get_embedding(rotated, enforce_detection=False)
                if embedding is not None:
                    break

        if embedding is None:
            return {"success": False, "message": "Could not generate face embedding. Please try again."}

        # Fetch all registered students and their embeddings
        students = db.query(Student).filter(Student.is_active == True).all()

        if not students:
            return {"success": False, "message": "No students registered in the system"}

        # Build dictionary of embeddings
        known_embeddings = {}
        for student in students:
            if student.face_embedding:
                try:
                    stored_embedding = np.frombuffer(student.face_embedding, dtype=np.float32)
                    # Check if embedding size matches (old vs new format)
                    if stored_embedding.shape[0] == embedding.shape[0]:
                        known_embeddings[student.id] = stored_embedding
                except Exception as e:
                    print(f"Error loading embedding for student {student.id}: {e}")

        if not known_embeddings:
            return {"success": False, "message": "No compatible face data available. Students may need to re-register."}

        # Find best match using cosine distance
        matched_id, distance = face_embedding_service.find_best_match(
            embedding, known_embeddings, threshold=0.6
        )

        # Convert numpy types to native Python for JSON serialization
        distance_float = float(distance) if distance is not None else float('inf')

        if matched_id is None:
            return {"success": False, "message": "Face not recognized", "distance": distance_float}

        # Get matched student
        matched_student = db.query(Student).filter(Student.id == matched_id).first()

        # Check if already marked today
        today_start = datetime.combine(date.today(), datetime.min.time())
        existing_attendance = db.query(Attendance).filter(
            Attendance.student_id == matched_id,
            Attendance.timestamp >= today_start
        ).first()

        if existing_attendance:
            return {
                "success": True,
                "message": f"Attendance already marked for {matched_student.name} today",
                "student_name": matched_student.name,
                "student_id": matched_student.student_id,
                "already_marked": True,
                "timestamp": existing_attendance.timestamp.isoformat()
            }

        # Create new attendance record
        new_attendance = Attendance(
            student_id=matched_id,
            status="PRESENT"
        )
        db.add(new_attendance)
        db.commit()
        db.refresh(new_attendance)

        return {
            "success": True,
            "message": f"Attendance marked for {matched_student.name}",
            "student_name": matched_student.name,
            "student_id": matched_student.student_id,
            "already_marked": False,
            "timestamp": new_attendance.timestamp.isoformat(),
            "match_confidence": float(1 - distance_float)
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Error in mark_attendance: {e}")
        import traceback
        traceback.print_exc()
        return {"success": False, "message": f"Server error: {str(e)}"}

@router.get("/", response_model=List[AttendanceSchema])
def read_attendance(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    # Filter out orphaned attendance records (where student was deleted)
    return db.query(Attendance).filter(
        Attendance.student_id.isnot(None)
    ).order_by(Attendance.timestamp.desc()).offset(skip).limit(limit).all()


@router.get("/history", response_model=AttendanceHistoryResponse)
def get_attendance_history(
    days: int = Query(7, ge=1, le=30, description="Number of days of history"),
    db: Session = Depends(get_db)
):
    """
    Get attendance history for the past N days.
    Returns daily breakdown with PRESENT/ABSENT status for each student.
    """
    # Get all active students
    students = db.query(Student).filter(Student.is_active == True).all()

    if not students:
        return AttendanceHistoryResponse(days=[], total_students=0)

    # Calculate date range
    today = date.today()
    start_date = today - timedelta(days=days - 1)

    # Get all attendance records in the date range
    start_datetime = datetime.combine(start_date, datetime.min.time())
    attendance_records = db.query(Attendance).filter(
        Attendance.timestamp >= start_datetime
    ).all()

    # Build attendance lookup: {date_str: {student_id: attendance_record}}
    attendance_by_date = {}
    for record in attendance_records:
        date_str = record.timestamp.date().isoformat()
        if date_str not in attendance_by_date:
            attendance_by_date[date_str] = {}
        attendance_by_date[date_str][record.student_id] = record

    # Build response for each day
    daily_list = []
    current_date = start_date

    while current_date <= today:
        date_str = current_date.isoformat()
        day_name = current_date.strftime("%A")

        student_statuses = []
        present_count = 0

        for student in students:
            if date_str in attendance_by_date and student.id in attendance_by_date[date_str]:
                status = "PRESENT"
                record = attendance_by_date[date_str][student.id]
                time_str = record.timestamp.strftime("%I:%M %p")
                present_count += 1
            else:
                status = "ABSENT"
                time_str = None

            student_statuses.append(StudentAttendanceStatus(
                student_id=student.id,
                student_code=student.student_id,
                name=student.name,
                status=status,
                time=time_str
            ))

        daily_list.append(DailyAttendance(
            date=date_str,
            day_name=day_name,
            students=student_statuses,
            present_count=present_count,
            absent_count=len(students) - present_count
        ))

        current_date += timedelta(days=1)

    # Reverse to show most recent first
    daily_list.reverse()

    return AttendanceHistoryResponse(
        days=daily_list,
        total_students=len(students)
    )
