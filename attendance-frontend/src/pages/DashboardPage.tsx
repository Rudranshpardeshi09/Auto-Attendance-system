import { useEffect, useState } from 'react';
import api from '../services/api';
import { Users, CheckCircle, Clock, CalendarDays, TrendingUp } from 'lucide-react';
import { motion } from 'framer-motion';

interface AttendanceRecord {
    id: number;
    student_id: number;
    timestamp: string;
    status: string;
    student?: {
        name: string;
        student_id: string;
    };
}

interface Student {
    id: number;
    name: string;
    student_id: string;
}

const DashboardPage: React.FC = () => {
    const [students, setStudents] = useState<Student[]>([]);
    const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const [studentsRes, attendanceRes] = await Promise.all([
                api.get('/students/'),
                api.get('/attendance/')
            ]);
            setStudents(studentsRes.data);
            setAttendanceRecords(attendanceRes.data);
        } catch (error) {
            console.error('Failed to fetch data:', error);
        } finally {
            setLoading(false);
        }
    };

    // Calculate today's attendance
    const today = new Date().toDateString();
    const todayAttendance = attendanceRecords.filter(
        record => new Date(record.timestamp).toDateString() === today
    );

    // Get student name by ID
    const getStudentById = (studentId: number) => {
        return students.find(s => s.id === studentId);
    };

    const stats = [
        {
            label: 'Total Students',
            value: students.length,
            icon: Users,
            gradient: 'from-violet-500 via-purple-500 to-fuchsia-500',
            shadowColor: 'shadow-purple-500/40'
        },
        {
            label: 'Present Today',
            value: todayAttendance.length,
            icon: CheckCircle,
            gradient: 'from-emerald-400 via-green-500 to-teal-500',
            shadowColor: 'shadow-emerald-500/40'
        },
        {
            label: 'Attendance Rate',
            value: students.length > 0 ? `${Math.round((todayAttendance.length / students.length) * 100)}%` : '0%',
            icon: TrendingUp,
            gradient: 'from-amber-400 via-orange-500 to-red-500',
            shadowColor: 'shadow-orange-500/40'
        }
    ];

    return (
        <div className="space-y-8">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {stats.map((stat, index) => (
                    <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className={`bg-gradient-to-br ${stat.gradient} p-6 rounded-3xl shadow-xl ${stat.shadowColor} text-white relative overflow-hidden group card-hover`}
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-15 group-hover:opacity-25 transition-opacity">
                            <stat.icon size={80} />
                        </div>
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative z-10">
                            <div className="p-3 bg-white/25 w-fit rounded-2xl mb-4 backdrop-blur-sm shadow-lg shadow-black/10">
                                <stat.icon className="w-6 h-6 text-white drop-shadow-md" />
                            </div>
                            <p className="text-white/90 font-semibold mb-1 text-shadow-sm">{stat.label}</p>
                            <p className="text-4xl font-extrabold text-shadow drop-shadow-lg">{stat.value}</p>
                        </div>
                    </motion.div>
                ))}
            </div>

            {/* Today's Attendance */}
            <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-gradient-to-br from-primary-600 to-accent-600 rounded-2xl shadow-lg shadow-primary-500/30">
                            <CalendarDays className="text-white" size={20} />
                        </div>
                        <div>
                            <h3 className="text-xl font-bold text-slate-800">Today's Attendance</h3>
                            <p className="text-sm text-slate-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        </div>
                    </div>
                </div>

                <div className="p-6">
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="bg-slate-100 rounded-2xl p-4 animate-pulse">
                                    <div className="h-12 bg-slate-200 rounded-xl" />
                                </div>
                            ))}
                        </div>
                    ) : todayAttendance.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Clock size={32} className="text-slate-400" />
                            </div>
                            <p className="text-lg font-semibold text-slate-600">No attendance recorded today</p>
                            <p className="text-sm text-slate-400 mt-2">Attendance records will appear here</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {todayAttendance.map((record, index) => {
                                const student = getStudentById(record.student_id);
                                return (
                                    <motion.div
                                        key={record.id}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="bg-slate-50 rounded-2xl p-4 flex items-center gap-4 hover:bg-white hover:shadow-md hover:border-primary-200 border border-transparent transition-all"
                                    >
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary-500/30">
                                            {student?.name?.charAt(0) || '?'}
                                        </div>
                                        <div className="flex-1">
                                            <p className="font-bold text-slate-800">{student?.name || 'Unknown'}</p>
                                            <p className="text-sm text-slate-500 font-mono">{student?.student_id || record.student_id}</p>
                                        </div>
                                        <div className="text-right">
                                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                                                <CheckCircle size={12} />
                                                Present
                                            </span>
                                            <p className="text-xs text-slate-400 mt-1">
                                                {new Date(record.timestamp).toLocaleTimeString()}
                                            </p>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DashboardPage;
