import React, { useRef, useState, useEffect } from 'react';
import { Camera, Save, RefreshCw, Check, X, Upload, UserPlus } from 'lucide-react';
import api from '../services/api';
import { motion } from 'framer-motion';

const StudentForm = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [capturedImage, setCapturedImage] = useState<string | null>(null);
    const [isCameraActive, setIsCameraActive] = useState(false);
    const [cameraInitializing, setCameraInitializing] = useState(false);
    const [loading, setLoading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<string>('');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [formData, setFormData] = useState({
        name: '',
        student_id: '',
        email: ''
    });

    const startCamera = async () => {
        setCameraInitializing(true);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 640, height: 480 },
            });
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await new Promise<void>((resolve, reject) => {
                    if (!videoRef.current) { reject(new Error('Video ref lost')); return; }
                    videoRef.current.onloadedmetadata = () => {
                        videoRef.current?.play().then(() => resolve()).catch(reject);
                    };
                });
                setIsCameraActive(true);
            }
        } catch {
            setMessage({ type: 'error', text: 'Failed to access camera. Please check permissions.' });
        } finally {
            setCameraInitializing(false);
        }
    };

    const capturePhoto = () => {
        if (!videoRef.current || !canvasRef.current) return;
        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        canvasRef.current.width = 640;
        canvasRef.current.height = 480;
        ctx.drawImage(videoRef.current, 0, 0, 640, 480);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg');
        setCapturedImage(dataUrl);
        stopCamera();
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
        setIsCameraActive(false);
    };

    /* ──── Face alignment guide overlay ──── */
    useEffect(() => {
        const overlay = overlayRef.current;
        const video = videoRef.current;
        if (!overlay || !video || !isCameraActive) return;

        let animId: number;
        const draw = () => {
            const ctx = overlay.getContext('2d');
            if (!ctx) return;

            const rect = video.getBoundingClientRect();
            overlay.width = rect.width;
            overlay.height = rect.height;
            ctx.clearRect(0, 0, overlay.width, overlay.height);

            const cx = overlay.width / 2;
            const cy = overlay.height / 2;
            const rx = overlay.width * 0.2;
            const ry = overlay.height * 0.35;

            // Dim outside oval
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.42)';
            ctx.fillRect(0, 0, overlay.width, overlay.height);
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx + 4, ry + 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Animated dashed oval border
            const time = performance.now() / 800;
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            ctx.lineWidth = 2.5;
            ctx.strokeStyle = 'rgba(139, 92, 246, 0.9)';
            ctx.setLineDash([10, 6]);
            ctx.lineDashOffset = -time * 8;
            ctx.stroke();
            ctx.setLineDash([]);

            // Corner markers
            const markLen = 18;
            const corners = [
                { x: cx - rx, y: cy - ry, dx: 1, dy: 1 },
                { x: cx + rx, y: cy - ry, dx: -1, dy: 1 },
                { x: cx - rx, y: cy + ry, dx: 1, dy: -1 },
                { x: cx + rx, y: cy + ry, dx: -1, dy: -1 },
            ];
            ctx.strokeStyle = '#8b5cf6';
            ctx.lineWidth = 3;
            ctx.lineCap = 'round';
            corners.forEach(({ x, y, dx, dy }) => {
                ctx.beginPath();
                ctx.moveTo(x, y + dy * markLen);
                ctx.lineTo(x, y);
                ctx.lineTo(x + dx * markLen, y);
                ctx.stroke();
            });

            // Instruction text
            ctx.textAlign = 'center';
            ctx.font = `600 ${Math.round(overlay.width * 0.028)}px Inter, system-ui, sans-serif`;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillText('Position your face inside the oval', cx, cy + ry + Math.round(overlay.height * 0.07));

            animId = requestAnimationFrame(draw);
        };

        draw();
        return () => cancelAnimationFrame(animId);
    }, [isCameraActive]);

    /* Cleanup on unmount */
    useEffect(() => {
        return () => {
            if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
        };
    }, []);

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setCapturedImage(reader.result as string);
                stopCamera();
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);
        setUploadProgress('');

        if (!capturedImage) {
            setMessage({ type: 'error', text: 'Please capture or upload a face photo' });
            return;
        }

        setLoading(true);
        try {
            setUploadProgress('Processing image...');
            const res = await fetch(capturedImage);
            const blob = await res.blob();
            const file = new File([blob], "face.jpg", { type: "image/jpeg" });

            setUploadProgress('Detecting face...');
            const data = new FormData();
            data.append('file', file);
            data.append('name', formData.name);
            data.append('student_id', formData.student_id);
            data.append('email', formData.email);

            setUploadProgress('Registering student...');
            await api.post('/students/', data);

            setUploadProgress('');
            setMessage({ type: 'success', text: '✓ Student registered successfully!' });
            setFormData({ name: '', student_id: '', email: '' });
            setCapturedImage(null);
        } catch (error: any) {
            setUploadProgress('');
            let errorMsg = 'Registration failed. Please try again.';

            if (error.response) {
                if (error.response.status === 409) {
                    errorMsg = "❌ Student ID already exists! Please use a unique ID.";
                } else if (error.response.status === 400) {
                    const detail = error.response.data?.detail || '';
                    if (detail.includes('No face detected')) {
                        errorMsg = "❌ No face detected. Please ensure your face is clearly visible and well-lit.";
                    } else if (detail.includes('Multiple faces')) {
                        errorMsg = "❌ Multiple faces detected. Please ensure only one person is in the photo.";
                    } else {
                        errorMsg = `❌ ${detail}`;
                    }
                } else if (error.response.data?.detail) {
                    errorMsg = `❌ ${error.response.data.detail}`;
                }
            } else if (error.request) {
                errorMsg = "❌ Server not responding. Please check if backend is running on port 8000.";
            }

            setMessage({ type: 'error', text: errorMsg });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden relative">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-cyan-500 via-blue-600 to-violet-600 p-6 relative overflow-hidden"
            >
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl animate-float" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-indigo-400/20 rounded-full blur-2xl" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />

                <div className="relative z-10 flex items-center gap-4">
                    <div className="p-3 bg-white/25 rounded-2xl backdrop-blur-sm shadow-lg shadow-white/10">
                        <UserPlus className="text-white w-6 h-6 drop-shadow-lg" />
                    </div>
                    <div>
                        <h3 className="text-xl font-extrabold text-white text-shadow-lg drop-shadow-lg">
                            Register New Student
                        </h3>
                        <p className="text-white/90 text-sm font-medium text-shadow">Enter student details and capture face data</p>
                    </div>
                </div>
            </motion.div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6 relative z-10">
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Full Name</label>
                        <input
                            type="text"
                            required
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none bg-white/80 backdrop-blur-sm hover:border-slate-300"
                            placeholder="e.g. John Doe"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Student ID</label>
                        <input
                            type="text"
                            required
                            value={formData.student_id}
                            onChange={e => setFormData({ ...formData, student_id: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none bg-white/80 backdrop-blur-sm hover:border-slate-300"
                            placeholder="e.g. STU-2024-001"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Email (Optional)</label>
                        <input
                            type="email"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                            className="w-full px-4 py-3 rounded-xl border-2 border-slate-200 focus:ring-4 focus:ring-primary-500/20 focus:border-primary-500 transition-all outline-none bg-white/80 backdrop-blur-sm hover:border-slate-300"
                            placeholder="student@school.edu"
                        />
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="block text-sm font-semibold text-slate-700">Face Photo</label>

                    {/* Camera preview with face guide overlay */}
                    <div className="relative aspect-video rounded-2xl bg-slate-900 border-2 border-slate-200 group shadow-inner overflow-hidden">
                        {/* Placeholder */}
                        {!isCameraActive && !capturedImage && !cameraInitializing && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-slate-50 rounded-2xl">
                                <div className="text-center space-y-2">
                                    <div className="p-4 bg-white rounded-full shadow-sm mx-auto w-fit">
                                        <Camera size={32} className="text-primary-300" />
                                    </div>
                                    <p className="text-sm font-medium text-slate-500">No photo captured</p>
                                </div>
                            </div>
                        )}

                        {cameraInitializing && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 rounded-2xl">
                                <div className="text-center space-y-3">
                                    <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto" />
                                    <p className="text-sm font-medium text-white">Starting camera...</p>
                                </div>
                            </div>
                        )}

                        <video
                            ref={videoRef}
                            className={`w-full h-full object-cover rounded-2xl ${!isCameraActive ? 'hidden' : ''}`}
                            playsInline
                            muted
                        />

                        {/* Face guide overlay canvas */}
                        <canvas
                            ref={overlayRef}
                            className={`absolute inset-0 w-full h-full pointer-events-none ${!isCameraActive ? 'hidden' : ''}`}
                        />

                        {capturedImage && !isCameraActive && (
                            <img src={capturedImage} alt="Captured" className="w-full h-full object-cover rounded-2xl" />
                        )}

                        {isCameraActive && (
                            <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-4 z-10">
                                <button
                                    type="button"
                                    onClick={capturePhoto}
                                    className="px-8 py-3 bg-white text-slate-900 rounded-full font-bold shadow-2xl hover:bg-slate-50 transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
                                >
                                    <div className="w-4 h-4 rounded-full bg-red-500 animate-pulse" />
                                    Capture Photo
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-4">
                        {!isCameraActive && !cameraInitializing ? (
                            <button
                                type="button"
                                onClick={startCamera}
                                className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border-2 border-primary-200 hover:border-primary-500 text-primary-700 hover:text-primary-800 bg-gradient-to-br from-primary-50 to-transparent hover:from-primary-100 transition-all font-semibold shadow-sm hover:shadow-md hover:shadow-primary-500/20"
                            >
                                <Camera size={18} />
                                {capturedImage ? 'Retake Photo' : 'Use Camera'}
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={stopCamera}
                                disabled={cameraInitializing}
                                className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border-2 border-red-200 hover:border-red-500 text-red-700 hover:text-red-800 bg-gradient-to-br from-red-50 to-transparent hover:from-red-100 transition-all font-semibold shadow-sm hover:shadow-md disabled:opacity-50"
                            >
                                <X size={18} />
                                Cancel Camera
                            </button>
                        )}

                        <label className="flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl border-2 border-accent-200 hover:border-accent-500 text-accent-700 hover:text-accent-800 bg-gradient-to-br from-accent-50 to-transparent hover:from-accent-100 transition-all font-semibold shadow-sm hover:shadow-md hover:shadow-accent-500/20 cursor-pointer">
                            <Upload size={18} />
                            Upload Image
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={handleFileUpload}
                            />
                        </label>
                    </div>

                    <canvas ref={canvasRef} className="hidden" width={640} height={480} />
                </div>

                {message && (
                    <div className={`p-4 rounded-2xl flex items-center gap-3 ${message.type === 'success' ? 'bg-gradient-to-r from-emerald-50 to-emerald-100/50 text-emerald-700 border-2 border-emerald-200 shadow-lg shadow-emerald-500/10' : 'bg-gradient-to-r from-red-50 to-red-100/50 text-red-700 border-2 border-red-200 shadow-lg shadow-red-500/10'}`}>
                        {message.type === 'success' ? <Check size={20} className="shrink-0" /> : <X size={20} className="shrink-0" />}
                        <p className="text-sm font-semibold">{message.text}</p>
                    </div>
                )}

                {uploadProgress && (
                    <div className="p-4 rounded-2xl flex items-center gap-3 bg-gradient-to-r from-blue-50 to-blue-100/50 text-blue-700 border-2 border-blue-200 shadow-lg shadow-blue-500/10">
                        <RefreshCw className="animate-spin shrink-0" size={20} />
                        <p className="text-sm font-semibold">{uploadProgress}</p>
                    </div>
                )}

                <button
                    type="submit"
                    disabled={loading || !capturedImage}
                    className="w-full py-4 bg-gradient-to-r from-primary-600 to-accent-600 text-white rounded-2xl font-bold shadow-xl shadow-primary-500/30 hover:shadow-2xl hover:shadow-primary-500/40 hover:from-primary-700 hover:to-accent-700 active:scale-[0.98] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-xl flex items-center justify-center gap-2"
                >
                    {loading ? <RefreshCw className="animate-spin" size={20} /> : <Save size={20} />}
                    {loading ? 'Registering...' : 'Complete Registration'}
                </button>
            </form>
        </div>
    );
};

export default StudentForm;
