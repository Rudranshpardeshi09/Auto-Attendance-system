from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional
from app.models.attendance import AttendanceStatus

class AttendanceBase(BaseModel):
    student_id: Optional[int] = None  # Optional to handle deleted students
    status: AttendanceStatus = AttendanceStatus.PRESENT

class AttendanceCreate(AttendanceBase):
    student_id: int  # Required for creation
    pass

class Attendance(AttendanceBase):
    id: int
    timestamp: datetime
    
    class Config:
        from_attributes = True


# New schemas for attendance history

class StudentAttendanceStatus(BaseModel):
    """Status of a single student for a specific day."""
    student_id: int
    student_code: str  # The student's ID code (e.g., "IC-2k22-100")
    name: str
    status: str  # "PRESENT" or "ABSENT"
    time: Optional[str] = None  # Time of attendance if present (e.g., "09:30 AM")


class DailyAttendance(BaseModel):
    """Attendance summary for a single day."""
    date: str  # ISO format date (e.g., "2026-02-08")
    day_name: str  # Day name (e.g., "Monday")
    students: List[StudentAttendanceStatus]
    present_count: int
    absent_count: int


class AttendanceHistoryResponse(BaseModel):
    """Response for attendance history endpoint."""
    days: List[DailyAttendance]
    total_students: int
