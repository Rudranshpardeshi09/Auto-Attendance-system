from fastapi import APIRouter
from app.api.endpoints import students, attendance, websocket

api_router = APIRouter()
api_router.include_router(students.router, prefix="/students", tags=["students"])
api_router.include_router(attendance.router, prefix="/attendance", tags=["attendance"])
api_router.include_router(websocket.router, tags=["websocket"])
