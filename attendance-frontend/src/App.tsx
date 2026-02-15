import { useState } from 'react';
import { LayoutDashboard, UserPlus, ScanFace, Users, Menu, X, CalendarDays } from 'lucide-react';
import AttendifyLogo from './components/AttendifyLogo';
import { motion, AnimatePresence } from 'framer-motion';

import DashboardPage from './pages/DashboardPage';
import AttendancePage from './pages/AttendancePage';
import AttendanceHistoryPage from './pages/AttendanceHistoryPage';
import StudentForm from './components/StudentForm';
import StudentList from './components/StudentList';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'attendance', label: 'Mark Attendance', icon: ScanFace },
    { id: 'history', label: 'Attendance History', icon: CalendarDays },
    { id: 'register', label: 'Register Student', icon: UserPlus },
    { id: 'students', label: 'Students', icon: Users },
  ];

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Modern Sidebar */}
      <motion.div
        initial={false}
        animate={{ width: isSidebarOpen ? 280 : 88 }}
        className="bg-white/80 backdrop-blur-xl border-r border-white/20 shadow-2xl z-20 flex flex-col transition-all duration-300 ease-in-out relative"
      >
        {/* Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary-50/50 to-transparent pointer-events-none" />

        <div className="p-6 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="bg-gradient-to-br from-primary-600 to-accent-600 p-2 rounded-2xl shadow-lg shadow-primary-500/30 ring-1 ring-white/50 animate-pulse-glow">
              <AttendifyLogo size={28} />
            </div>
            {isSidebarOpen && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex flex-col"
              >
                <h1 className="text-xl font-bold bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
                  Attendify
                </h1>
                <span className="text-[10px] font-semibold tracking-wider text-primary-600 uppercase">Attendance System</span>
              </motion.div>
            )}
          </div>
          <button
            onClick={toggleSidebar}
            className="p-2 hover:bg-white/50 rounded-xl text-slate-400 hover:text-primary-600 transition-all border border-transparent hover:border-white/50 hover:shadow-sm"
          >
            {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-2 relative z-10">
          {menuItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl transition-all duration-300 group relative overflow-hidden ${isActive
                  ? 'bg-gradient-to-r from-primary-600 to-accent-600 text-white shadow-lg shadow-primary-500/25 ring-1 ring-white/20'
                  : 'text-slate-500 hover:bg-white/50 hover:text-slate-900 hover:shadow-sm'
                  }`}
              >
                <item.icon
                  className={`w-6 h-6 shrink-0 transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'
                    }`}
                />

                {isSidebarOpen && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="font-medium tracking-wide"
                  >
                    {item.label}
                  </motion.span>
                )}

                {/* Active Indicator Dot */}
                {!isSidebarOpen && isActive && (
                  <div className="absolute right-2 w-1.5 h-1.5 rounded-full bg-white shadow-sm" />
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-4 relative z-10">
          <div className={`
            flex items-center gap-3 p-3 rounded-2xl border transition-all duration-300
            ${isSidebarOpen
              ? 'bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-xl border-slate-700'
              : 'justify-center border-transparent'
            }
          `}>
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-white font-bold text-sm shadow-inner ring-1 ring-white/10">
              AD
            </div>
            {isSidebarOpen && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="overflow-hidden">
                <p className="text-sm font-bold truncate">Administrator</p>
                <p className="text-xs text-slate-400 truncate">admin@school.edu</p>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {/* Header Background Decoration */}
        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-primary-50/50 to-transparent pointer-events-none" />

        <main className="flex-1 overflow-y-auto p-4 sm:p-8 z-10 scroll-smooth">
          <div className="max-w-7xl mx-auto space-y-8">
            <header className="mb-8">
              <h2 className="text-3xl font-bold text-slate-900 tracking-tight">
                {activeTab === 'dashboard' && 'Dashboard Overview'}
                {activeTab === 'attendance' && 'Mark Attendance'}
                {activeTab === 'history' && 'Attendance History'}
                {activeTab === 'register' && 'Register New Student'}
                {activeTab === 'students' && 'Student Management'}
              </h2>
              <p className="text-slate-500 mt-2 text-lg">
                {activeTab === 'dashboard' && 'View attendance statistics and recent records.'}
                {activeTab === 'attendance' && 'Use face recognition to mark student attendance.'}
                {activeTab === 'history' && 'View past 7 days attendance with daily breakdown.'}
                {activeTab === 'register' && 'Add a new student to the system with face data.'}
                {activeTab === 'students' && 'View and manage all registered students.'}
              </p>
            </header>

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
              >
                {activeTab === 'dashboard' && <DashboardPage />}
                {activeTab === 'attendance' && <AttendancePage />}
                {activeTab === 'history' && <AttendanceHistoryPage />}
                {activeTab === 'register' && (
                  <div className="max-w-xl mx-auto">
                    <StudentForm />
                  </div>
                )}
                {activeTab === 'students' && <StudentList />}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
