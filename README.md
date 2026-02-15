# Student Attendance System

A full-stack web application for automated student attendance tracking using facial recognition and liveness detection.

## 🎯 Features

- **Facial Recognition**: Automatic student identification using deep learning models
- **Liveness Detection**: Prevents spoofing with real-time liveness detection
- **Face Embedding**: Advanced face encoding for accurate identification
- **Real-time Updates**: WebSocket support for live attendance updates
- **Student Management**: Add, view, and manage student records
- **Attendance History**: Track attendance records over time
- **Dashboard**: Visual overview of attendance data

## 🏗️ Project Structure

```
student-attendance/
├── attendance-backend/      # FastAPI backend
│   ├── app/
│   │   ├── main.py         # Application entry point
│   │   ├── api/            # API routes
│   │   ├── models/         # Database models
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── services/       # Business logic (face recognition, etc.)
│   │   ├── core/           # Configuration
│   │   └── db/             # Database setup
│   └── requirements.txt     # Python dependencies
│
└── attendance-frontend/     # React + TypeScript frontend
    ├── src/
    │   ├── components/     # Reusable UI components
    │   ├── pages/          # Page components
    │   ├── services/       # API services
    │   └── App.tsx         # Root component
    └── package.json        # Node dependencies
```

## 🚀 Getting Started

### Prerequisites

- Python 3.8+
- Node.js 16+ and npm/yarn/pnpm
- A webcam for facial recognition features

### Backend Setup

1. **Navigate to backend directory**
   ```bash
   cd attendance-backend
   ```

2. **Create and activate virtual environment**
   ```bash
   # Windows
   python -m venv venv
   venv\Scripts\activate
   
   # Linux/Mac
   python3 -m venv venv
   source venv/bin/activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure environment variables**
   ```bash
   # Create .env file in attendance-backend directory
   echo DATABASE_URL=sqlite:///./attendance.db > .env
   ```

5. **Run the server**
   ```bash
   python -m uvicorn app.main:app --reload
   ```
   
   The API will be available at `http://localhost:8000`
   
   API Documentation: `http://localhost:8000/docs`

### Frontend Setup

1. **Navigate to frontend directory**
   ```bash
   cd attendance-frontend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure API endpoint** (if needed)
   - Update `src/services/api.ts` with your backend URL

4. **Run development server**
   ```bash
   npm run dev
   ```
   
   The application will be available at `http://localhost:5173`

## 📚 API Endpoints

### Students
- `GET /api/students` - Get all students
- `POST /api/students` - Register a new student
- `GET /api/students/{id}` - Get student details

### Attendance
- `GET /api/attendance` - Get attendance records
- `POST /api/attendance` - Mark attendance
- `GET /api/attendance/{student_id}` - Get student attendance history

### WebSocket
- `WS /ws/attendance` - Real-time attendance updates

## 🔐 Security Features

- Real-time liveness detection to prevent spoofing
- Face embedding for secure student identification
- Face detection using pre-trained models

## 🛠️ Tech Stack

### Backend
- **Framework**: FastAPI
- **Database**: SQLAlchemy with SQLite
- **Face Recognition**: OpenCV, dlib
- **WebSocket**: FastAPI WebSockets

### Frontend
- **Framework**: React 18+
- **Language**: TypeScript
- **Build Tool**: Vite
- **Styling**: CSS3
- **HTTP Client**: Axios

## 📝 Configuration

### Backend Configuration
Edit `.env` file in the `attendance-backend` directory:
```
DATABASE_URL=sqlite:///./attendance.db
DEBUG=True
```

### Frontend Configuration
Edit `src/services/api.ts` to set the API base URL:
```typescript
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
```

## 🚢 Deployment

### Backend (FastAPI)
```bash
pip install gunicorn
gunicorn app.main:app --workers 4 --worker-class uvicorn.workers.UvicornWorker
```

### Frontend (React)
```bash
npm run build
# Deploy the 'dist' folder to your hosting service
```

## 📦 Dependencies

### Core Python Packages
- fastapi
- uvicorn
- sqlalchemy
- pydantic
- opencv-python
- dlib

### Core Node Packages
- react
- typescript
- axios
- vite

See `requirements.txt` and `package.json` for complete dependency lists.

## 🐛 Troubleshooting

### Backend Issues
- **Port 8000 already in use**: Change port with `--port 8001`
- **Database errors**: Delete `attendance.db` and restart the server
- **Face recognition not working**: Ensure camera permissions are granted

### Frontend Issues
- **API connection failed**: Check if backend is running on `http://localhost:8000`
- **Module not found**: Run `npm install` again
- **Port 5173 in use**: Specify different port with `npm run dev -- --port 5174`

## 📄 License

This project is licensed under the MIT License.

## 👥 Contributing

1. Create a feature branch (`git checkout -b feature/amazing-feature`)
2. Commit your changes (`git commit -m 'Add amazing feature'`)
3. Push to the branch (`git push origin feature/amazing-feature`)
4. Open a Pull Request

## 📞 Support

For issues and questions, please refer to the project's issue tracker or contact the development team.

---

**Made with ❤️ for educational purposes**
