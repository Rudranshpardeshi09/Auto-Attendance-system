import { useEffect, useState } from 'react';
import api from '../services/api';
import { Search, User, Trash2, AlertCircle, CheckCircle, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

type FilterType = 'all' | 'active' | 'inactive';

const StudentList = () => {
    const [students, setStudents] = useState<any[]>([]);
    const [filteredStudents, setFilteredStudents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<FilterType>('all');
    const [deleteLoading, setDeleteLoading] = useState<number | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

    useEffect(() => {
        fetchStudents();
    }, []);

    useEffect(() => {
        filterAndSearchStudents();
    }, [students, searchQuery, filterType]);

    const fetchStudents = async () => {
        try {
            const res = await api.get('/students/');
            setStudents(res.data);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const filterAndSearchStudents = () => {
        let filtered = students;

        // Apply filter
        if (filterType === 'active') {
            filtered = filtered.filter(s => s.is_active);
        } else if (filterType === 'inactive') {
            filtered = filtered.filter(s => !s.is_active);
        }

        // Apply search
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            filtered = filtered.filter(s =>
                s.name.toLowerCase().includes(query) ||
                s.student_id.toLowerCase().includes(query) ||
                (s.email && s.email.toLowerCase().includes(query))
            );
        }

        setFilteredStudents(filtered);
    };

    const handleDelete = async (id: number) => {
        if (deleteConfirm !== id) {
            setDeleteConfirm(id);
            setTimeout(() => setDeleteConfirm(null), 3000);
            return;
        }

        setDeleteLoading(id);
        try {
            await api.delete(`/students/${id}`);
            setStudents(prev => prev.filter(s => s.id !== id));
            setDeleteConfirm(null);
        } catch (error) {
            console.error('Delete failed:', error);
        } finally {
            setDeleteLoading(null);
        }
    };

    return (
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 flex flex-col h-[600px] overflow-hidden relative">
            {/* Vibrant Gradient Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-rose-500 via-pink-600 to-purple-600 p-6 relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl animate-float" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-pink-400/20 rounded-full blur-2xl" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />

                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/25 rounded-2xl backdrop-blur-sm shadow-lg shadow-white/10">
                            <Users className="text-white w-6 h-6 drop-shadow-lg" />
                        </div>
                        <div>
                            <h3 className="text-xl font-extrabold text-white text-shadow-lg drop-shadow-lg">
                                Enrolled Students
                            </h3>
                            <p className="text-white/90 text-sm font-medium text-shadow">Manage registered students and their data</p>
                        </div>
                    </div>

                    {/* Filter Pills */}
                    <div className="flex gap-2">
                        {(['all', 'active', 'inactive'] as FilterType[]).map((type) => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={`px-4 py-2 rounded-xl font-semibold text-xs uppercase tracking-wide transition-all duration-300 ${filterType === type
                                    ? 'bg-white text-pink-600 shadow-lg shadow-white/30'
                                    : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'
                                    }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>
            </motion.div>

            {/* Search Bar */}
            <div className="px-6 py-4 bg-white/40 backdrop-blur-sm border-b border-slate-100/50 relative z-10">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input
                        type="text"
                        placeholder="Search by name, ID, or email..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 rounded-2xl border-2 border-slate-200 focus:border-primary-500 focus:ring-4 focus:ring-primary-500/10 transition-all outline-none bg-white/80 backdrop-blur-sm"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-auto relative z-10">
                {loading && (
                    <div className="p-8 space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="bg-white/60 rounded-2xl p-4 animate-pulse">
                                <div className="h-12 bg-slate-200 rounded-xl" />
                            </div>
                        ))}
                    </div>
                )}

                {!loading && filteredStudents.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full text-slate-400 p-8">
                        <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                            <User size={32} className="opacity-30" />
                        </div>
                        <p className="text-lg font-semibold text-slate-600">
                            {searchQuery || filterType !== 'all' ? 'No students found' : 'No students enrolled yet'}
                        </p>
                        <p className="text-sm text-slate-400 mt-2">
                            {searchQuery ? 'Try a different search term' : 'Add students to get started'}
                        </p>
                    </div>
                )}

                {!loading && filteredStudents.length > 0 && (
                    <div className="p-6 space-y-3">
                        <AnimatePresence mode="popLayout">
                            {filteredStudents.map((student, index) => (
                                <motion.div
                                    key={student.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-slate-100 hover:border-primary-300 hover:shadow-lg hover:shadow-primary-500/10 transition-all duration-300 group"
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Avatar */}
                                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-primary-500/30 group-hover:scale-110 transition-transform">
                                            {student.name.charAt(0)}
                                        </div>

                                        {/* Info */}
                                        <div className="flex-1 min-w-0">
                                            <p className="font-bold text-slate-900 group-hover:text-primary-700 transition-colors truncate">
                                                {student.name}
                                            </p>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span className="font-mono text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded-md">
                                                    {student.student_id}
                                                </span>
                                                {student.email && (
                                                    <span className="text-xs text-slate-400 truncate">
                                                        {student.email}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Status Badge */}
                                        <div className="flex items-center gap-3">
                                            <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${student.is_active
                                                ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                                                : 'bg-red-100 text-red-700 border border-red-200'
                                                }`}>
                                                {student.is_active ? <CheckCircle size={12} /> : <AlertCircle size={12} />}
                                                {student.is_active ? 'Active' : 'Inactive'}
                                            </span>

                                            {/* Delete Button */}
                                            <button
                                                onClick={() => handleDelete(student.id)}
                                                disabled={deleteLoading === student.id}
                                                className={`p-2.5 rounded-xl transition-all ${deleteConfirm === student.id
                                                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/30 hover:bg-red-600'
                                                    : 'bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 border border-transparent'
                                                    }`}
                                            >
                                                {deleteLoading === student.id ? (
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <Trash2 size={16} />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {deleteConfirm === student.id && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            className="mt-3 pt-3 border-t border-red-100 text-sm text-red-600 font-medium"
                                        >
                                            Click again to confirm deletion
                                        </motion.div>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>
                    </div>
                )}
            </div>
        </div>
    );
};

export default StudentList;
