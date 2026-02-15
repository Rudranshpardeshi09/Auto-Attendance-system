from fastapi import APIRouter, Depends, UploadFile, File, Form, HTTPException
from sqlalchemy.orm import Session
from typing import List
import cv2
import numpy as np

from app.db.session import SessionLocal
from app.models.student import Student
from app.schemas.student import StudentCreate, Student as StudentSchema
from app.services.face_detection import face_detector
from app.services.face_embedding import face_embedding_service

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

@router.post("/", response_model=StudentSchema)
async def create_student(
    name: str = Form(...),
    student_id: str = Form(...),
    email: str = Form(None),
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Register a new student with face data.
    Uses improved DeepFace embeddings for robust face matching.
    """
    # Read image
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    
    # Detect face
    if img is None:
        print(f"Failed to decode image. Size: {len(contents)} bytes")
        raise HTTPException(status_code=400, detail="Invalid image file or format")

    print(f"Image decoded. Shape: {img.shape}")
    
    # Try detection with rotations (0, 90, 180, 270)
    # Some detectors are not rotation invariant
    faces = []
    final_img = img
    embedding = None
    
    rotations = [
        (None, "0 deg"),
        (cv2.ROTATE_90_CLOCKWISE, "90 deg"),
        (cv2.ROTATE_180, "180 deg"),
        (cv2.ROTATE_90_COUNTERCLOCKWISE, "270 deg")
    ]
    
    for rotate_code, label in rotations:
        if rotate_code is not None:
            processed_img = cv2.rotate(img, rotate_code)
        else:
            processed_img = img
        
        # Try to get embedding directly (DeepFace includes face detection)
        emb = face_embedding_service.get_embedding_with_jitter(processed_img, num_jitters=3)
        if emb is not None:
            print(f"Face detected and embedded at {label}")
            embedding = emb
            final_img = processed_img
            break
            
    if embedding is None:
        # Fallback to original detector
        for rotate_code, label in rotations:
            if rotate_code is not None:
                processed_img = cv2.rotate(img, rotate_code)
            else:
                processed_img = img
                
            detected_faces, _ = face_detector.process_frame(processed_img)
            if detected_faces:
                print(f"Face detected at {label} (fallback detector)")
                faces = detected_faces
                final_img = processed_img
                break
        
        if not faces:
            print("No faces found in any orientation.")
            raise HTTPException(status_code=400, detail="No face detected. Please use a clearer photo with good lighting.")
        
        if len(faces) > 1:
            raise HTTPException(status_code=400, detail="Multiple faces detected. Please use a photo with only one person.")
        
        # Try getting embedding with detected face region
        embedding = face_embedding_service.get_embedding(final_img, enforce_detection=False)
        
        if embedding is None:
            raise HTTPException(status_code=400, detail="Could not generate face embedding. Please try a different photo.")
    
    # Validate embedding
    if embedding is None or embedding.shape[0] < 100:
        raise HTTPException(status_code=400, detail="Face embedding failed. Please ensure face is clearly visible.")
    
    print(f"Generated embedding with shape: {embedding.shape}")
    
    # Check if student_id exists
    existing_student = db.query(Student).filter(Student.student_id == student_id).first()
    if existing_student:
        raise HTTPException(status_code=409, detail="Student ID already registered. Please use a different ID.")

    # Check if email exists (only if email is provided)
    if email:
        existing_email = db.query(Student).filter(Student.email == email).first()
        if existing_email:
            raise HTTPException(status_code=409, detail="Email already registered. Please use a different email or leave it empty.")

    # Save to DB
    db_student = Student(
        name=name,
        student_id=student_id,
        email=email,
        face_embedding=embedding.tobytes()
    )
    db.add(db_student)
    db.commit()
    db.refresh(db_student)
    
    return db_student

@router.get("/", response_model=List[StudentSchema])
def read_students(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    students = db.query(Student).offset(skip).limit(limit).all()
    return students

@router.get("/{student_id}", response_model=StudentSchema)
def read_student(student_id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    return student

@router.delete("/{student_id}")
def delete_student(student_id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if student is None:
        raise HTTPException(status_code=404, detail="Student not found")
    db.delete(student)
    db.commit()
    return {"message": f"Student {student.name} deleted successfully"}
