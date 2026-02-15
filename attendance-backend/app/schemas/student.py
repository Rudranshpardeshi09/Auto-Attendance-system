from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class StudentBase(BaseModel):
    name: str
    student_id: str
    email: Optional[str] = None

class StudentCreate(StudentBase):
    pass

class Student(StudentBase):
    id: int
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True
