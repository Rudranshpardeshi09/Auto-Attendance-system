import { useEffect, useState } from 'react';
import api from '../services/api';
import { CalendarDays, CheckCircle, XCircle, Clock, Users, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface StudentAttendance {
    student_id: number;
    student_code: string;
    name: string;
    status: 'PRESENT' | 'ABSENT';
    time: string | null;
}

interface DailyAttendance {
    date: string;
    day_name: string;
    students: StudentAttendance[];
    present_count: number;
    absent_count: number;
}

interface AttendanceHistoryResponse {
    days: DailyAttendance[];
    total_students: number;
}

const AttendanceHistoryPage: React.FC = () => {
    const [history, setHistory] = useState<AttendanceHistoryResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedDay, setSelectedDay] = useState(0);
    const [days, setDays] = useState(7);

    useEffect(() => {
        fetchHistory();
    }, [days]);

    const fetchHistory = async () => {
        setLoading(true);
        try {
            const response = await api.get(`/attendance/history?days=${days}`);
            setHistory(response.data);
        } catch (error) {
            console.error('Failed to fetch attendance history:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    const getAttendanceRate = (day: DailyAttendance) => {
        const total = day.present_count + day.absent_count;
        return total > 0 ? Math.round((day.present_count / total) * 100) : 0;
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 rounded-3xl p-8 text-white shadow-2xl shadow-purple-500/40 relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-float" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-pink-400/20 rounded-full blur-2xl" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />

                <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-4">
                        <div className="p-3 bg-white/25 rounded-2xl backdrop-blur-sm shadow-lg shadow-white/10">
                            <CalendarDays className="w-8 h-8 drop-shadow-lg" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-extrabold text-shadow-lg drop-shadow-lg">Attendance History</h1>
                            <p className="text-white/90 font-medium text-shadow">Past {days} days attendance records</p>
                        </div>
                    </div>

                    <div className="flex gap-2 mt-4">
                        {[7, 14, 30].map((d) => (
                            <button
                                key={d}
                                onClick={() => setDays(d)}
                                className={`px-4 py-2 rounded-xl font-semibold text-sm transition-all ${days === d
                                    ? 'bg-white text-purple-600 shadow-lg shadow-white/30'
                                    : 'bg-white/20 text-white hover:bg-white/30'
                                    }`}
                            >
                                {d} Days
                            </button>
                        ))}
                    </div>
                </div>
            </motion.div>

            {/* Stats Overview */}
            {history && !loading && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-gradient-to-br from-blue-500 to-cyan-500 p-4 rounded-2xl text-white shadow-lg"
                    >
                        <Users className="w-6 h-6 mb-2 opacity-80" />
                        <p className="text-3xl font-bold">{history.total_students}</p>
                        <p className="text-sm opacity-80">Total Students</p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-gradient-to-br from-emerald-500 to-green-500 p-4 rounded-2xl text-white shadow-lg"
                    >
                        <CheckCircle className="w-6 h-6 mb-2 opacity-80" />
                        <p className="text-3xl font-bold">
                            {history.days[0]?.present_count || 0}
                        </p>
                        <p className="text-sm opacity-80">Present Today</p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-gradient-to-br from-red-500 to-orange-500 p-4 rounded-2xl text-white shadow-lg"
                    >
                        <XCircle className="w-6 h-6 mb-2 opacity-80" />
                        <p className="text-3xl font-bold">
                            {history.days[0]?.absent_count || 0}
                        </p>
                        <p className="text-sm opacity-80">Absent Today</p>
                    </motion.div>

                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-gradient-to-br from-violet-500 to-purple-500 p-4 rounded-2xl text-white shadow-lg"
                    >
                        <Clock className="w-6 h-6 mb-2 opacity-80" />
                        <p className="text-3xl font-bold">
                            {history.days[0] ? getAttendanceRate(history.days[0]) : 0}%
                        </p>
                        <p className="text-sm opacity-80">Today's Rate</p>
                    </motion.div>
                </div>
            )}

            {/* Day Selector */}
            {history && !loading && (
                <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-4">
                    <div className="flex items-center justify-between mb-4">
                        <button
                            onClick={() => setSelectedDay(Math.min(selectedDay + 1, history.days.length - 1))}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors"
                            disabled={selectedDay >= history.days.length - 1}
                        >
                            <ChevronLeft className="w-5 h-5" />
                        </button>

                        <div className="flex gap-2 overflow-x-auto px-4 py-2">
                            {history.days.slice(0, 7).map((day, index) => (
                                <button
                                    key={day.date}
                                    onClick={() => setSelectedDay(index)}
                                    className={`flex flex-col items-center min-w-[70px] p-3 rounded-xl transition-all ${selectedDay === index
                                        ? 'bg-gradient-to-br from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/30'
                                        : 'bg-slate-50 hover:bg-slate-100 text-slate-700'
                                        }`}
                                >
                                    <span className="text-xs font-medium opacity-80">{day.day_name.slice(0, 3)}</span>
                                    <span className="text-lg font-bold">{formatDate(day.date)}</span>
                                    <span className={`text-xs mt-1 ${selectedDay === index ? 'text-white' : 'text-slate-500'}`}>
                                        {day.present_count}/{day.present_count + day.absent_count}
                                    </span>
                                </button>
                            ))}
                        </div>

                        <button
                            onClick={() => setSelectedDay(Math.max(selectedDay - 1, 0))}
                            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 transition-colors"
                            disabled={selectedDay <= 0}
                        >
                            <ChevronRight className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            )}

            {/* Attendance List */}
            <div className="bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100">
                    <h3 className="text-lg font-bold text-slate-800">
                        {history?.days[selectedDay]?.day_name}, {history?.days[selectedDay]?.date}
                    </h3>
                    {history?.days[selectedDay] && (
                        <div className="flex gap-4 mt-2">
                            <span className="text-sm text-emerald-600 font-medium flex items-center gap-1">
                                <CheckCircle size={14} />
                                {history.days[selectedDay].present_count} Present
                            </span>
                            <span className="text-sm text-red-500 font-medium flex items-center gap-1">
                                <XCircle size={14} />
                                {history.days[selectedDay].absent_count} Absent
                            </span>
                        </div>
                    )}
                </div>

                <div className="max-h-[400px] overflow-y-auto">
                    {loading ? (
                        <div className="p-8 space-y-4">
                            {[1, 2, 3, 4].map(i => (
                                <div key={i} className="bg-slate-100 rounded-xl p-4 animate-pulse">
                                    <div className="h-10 bg-slate-200 rounded-lg" />
                                </div>
                            ))}
                        </div>
                    ) : history?.days[selectedDay]?.students.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                            <p>No students found</p>
                        </div>
                    ) : (
                        <AnimatePresence mode="wait">
                            <motion.div
                                key={selectedDay}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="divide-y divide-slate-100"
                            >
                                {history?.days[selectedDay]?.students.map((student, index) => (
                                    <motion.div
                                        key={student.student_id}
                                        initial={{ opacity: 0, x: -10 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.03 }}
                                        className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors"
                                    >
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold shadow-lg ${student.status === 'PRESENT'
                                            ? 'bg-gradient-to-br from-emerald-500 to-green-600 shadow-emerald-500/30'
                                            : 'bg-gradient-to-br from-red-500 to-orange-500 shadow-red-500/30'
                                            }`}>
                                            {student.name.charAt(0)}
                                        </div>

                                        <div className="flex-1">
                                            <p className="font-semibold text-slate-800">{student.name}</p>
                                            <p className="text-xs text-slate-500 font-mono">{student.student_code}</p>
                                        </div>

                                        <div className="text-right">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${student.status === 'PRESENT'
                                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                : 'bg-red-100 text-red-700 border border-red-200'
                                                }`}>
                                                {student.status === 'PRESENT' ? <CheckCircle size={12} /> : <XCircle size={12} />}
                                                {student.status}
                                            </span>
                                            {student.time && (
                                                <p className="text-xs text-slate-400 mt-1">{student.time}</p>
                                            )}
                                        </div>
                                    </motion.div>
                                ))}
                            </motion.div>
                        </AnimatePresence>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AttendanceHistoryPage;
