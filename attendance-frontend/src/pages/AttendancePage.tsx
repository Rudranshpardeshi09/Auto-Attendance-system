import React, { useRef, useState, useCallback, useEffect } from 'react';
import {
    Camera, CheckCircle2, XCircle, ScanFace, UserCheck,
    Clock, Wifi, WifiOff, ShieldCheck, Volume2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/* ─────────────────── Types ─────────────────── */
interface DetectedFace {
    name: string;
    confidence: number;
    marked: boolean;
    confirmed: boolean;
    bbox: { x: number; y: number; w: number; h: number };
    frames_confirmed: number;
    frames_required: number;
}

interface MarkedStudent {
    name: string;
    time: string;
}

/* ────────────── Success Sound (inline) ────────────── */
const playSuccessSound = () => {
    try {
        const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.setValueAtTime(1108, ctx.currentTime + 0.1);
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.4);
    } catch { /* ignore audio errors */ }
};

/* ═══════════════════════════════════════════════════════
   AttendancePage — Real-time face recognition attendance
   ═══════════════════════════════════════════════════════ */
const AttendancePage: React.FC = () => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const wsRef = useRef<WebSocket | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const [isCameraActive, setIsCameraActive] = useState(false);
    const [wsConnected, setWsConnected] = useState(false);
    const [detected, setDetected] = useState<DetectedFace[]>([]);
    const [markedStudents, setMarkedStudents] = useState<MarkedStudent[]>([]);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [sessionStart, setSessionStart] = useState<Date | null>(null);
    const [error, setError] = useState<string | null>(null);

    /* ──── Live clock ──── */
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    /* ──── Connect WebSocket ──── */
    const connectWS = useCallback(() => {
        const ws = new WebSocket('ws://localhost:8000/api/v1/ws');
        ws.onopen = () => setWsConnected(true);
        ws.onclose = () => setWsConnected(false);
        ws.onerror = () => setWsConnected(false);
        ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                const faces: DetectedFace[] = data.detected || [];
                setDetected(faces);

                // Check for newly marked students
                faces.forEach((f) => {
                    if (f.marked) {
                        playSuccessSound();
                        setMarkedStudents((prev) => {
                            // Avoid duplicates
                            if (prev.some((s) => s.name === f.name)) return prev;
                            return [
                                { name: f.name, time: new Date().toLocaleTimeString() },
                                ...prev,
                            ];
                        });
                    }
                });
            } catch {
                /* ignore parse errors */
            }
        };
        wsRef.current = ws;
    }, []);

    /* ──── Start Camera + WS ──── */
    const startSession = async () => {
        setError(null);
        setDetected([]);
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 640, height: 480 },
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
                setIsCameraActive(true);
                setSessionStart(new Date());
                connectWS();

                // Auto-capture frames every 1.5s
                intervalRef.current = setInterval(() => sendFrame(), 1500);
            }
        } catch {
            setError('Failed to access camera. Please check permissions.');
        }
    };

    /* ──── Stop everything ──── */
    const stopSession = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
        if (videoRef.current) videoRef.current.srcObject = null;
        setIsCameraActive(false);
        setWsConnected(false);
        setDetected([]);
    }, []);

    /* ──── Capture & send one frame ──── */
    const sendFrame = () => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        if (!videoRef.current || !canvasRef.current) return;

        const ctx = canvasRef.current.getContext('2d');
        if (!ctx) return;

        canvasRef.current.width = 640;
        canvasRef.current.height = 480;
        ctx.drawImage(videoRef.current, 0, 0, 640, 480);
        const dataUrl = canvasRef.current.toDataURL('image/jpeg', 0.7);
        wsRef.current.send(dataUrl);
    };

    /* ──── Draw overlay (guideline + bboxes) ──── */
    useEffect(() => {
        const overlay = overlayCanvasRef.current;
        const video = videoRef.current;
        if (!overlay || !video || !isCameraActive) return;

        let animId: number;
        const draw = () => {
            const ctx = overlay.getContext('2d');
            if (!ctx) return;

            // Match overlay size to the displayed video
            const rect = video.getBoundingClientRect();
            overlay.width = rect.width;
            overlay.height = rect.height;

            const scaleX = rect.width / 640;
            const scaleY = rect.height / 480;

            ctx.clearRect(0, 0, overlay.width, overlay.height);

            // ── Face alignment oval guide ──
            const cx = overlay.width / 2;
            const cy = overlay.height / 2;
            const rx = overlay.width * 0.18;
            const ry = overlay.height * 0.32;

            const hasConfirmed = detected.some((d) => d.confirmed);
            const hasFace = detected.length > 0;

            // Darken area outside the oval
            ctx.save();
            ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
            ctx.fillRect(0, 0, overlay.width, overlay.height);
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx + 4, ry + 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Oval border
            ctx.beginPath();
            ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
            ctx.lineWidth = 3;
            if (hasConfirmed) {
                ctx.strokeStyle = '#10b981'; // green for confirmed
            } else if (hasFace) {
                ctx.strokeStyle = '#fbbf24'; // amber when face visible
            } else {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.setLineDash([12, 8]);
            }
            ctx.stroke();
            ctx.setLineDash([]);

            // Instruction text
            ctx.textAlign = 'center';
            ctx.font = `600 ${Math.round(overlay.width * 0.028)}px Inter, system-ui, sans-serif`;
            ctx.fillStyle = hasConfirmed
                ? '#10b981'
                : hasFace
                    ? '#fbbf24'
                    : 'rgba(255, 255, 255, 0.85)';
            const label = hasConfirmed
                ? '✓ Face Confirmed!'
                : hasFace
                    ? 'Hold still — verifying...'
                    : 'Position your face inside the oval';
            ctx.fillText(label, cx, cy + ry + Math.round(overlay.height * 0.06));

            // ── Draw bounding boxes ──
            detected.forEach((d) => {
                const bx = d.bbox.x * scaleX;
                const by = d.bbox.y * scaleY;
                const bw = d.bbox.w * scaleX;
                const bh = d.bbox.h * scaleY;

                ctx.strokeStyle = d.confirmed ? '#10b981' : '#8b5cf6';
                ctx.lineWidth = 2;
                ctx.strokeRect(bx, by, bw, bh);

                // Name label
                const labelText = `${d.name}  ${Math.round(d.confidence * 100)}%`;
                ctx.font = `700 ${Math.round(overlay.width * 0.022)}px Inter, system-ui, sans-serif`;
                const metrics = ctx.measureText(labelText);
                const lw = metrics.width + 16;
                const lh = 26;

                ctx.fillStyle = d.confirmed ? 'rgba(16, 185, 129, 0.85)' : 'rgba(139, 92, 246, 0.85)';
                const lx = bx;
                const ly = by - lh - 4;
                ctx.beginPath();
                ctx.roundRect(lx, ly, lw, lh, 6);
                ctx.fill();

                ctx.fillStyle = '#ffffff';
                ctx.fillText(labelText, lx + 8, ly + 18);

                // Confirmation progress bar
                if (!d.confirmed && d.frames_required > 0) {
                    const progress = Math.min(d.frames_confirmed / d.frames_required, 1);
                    const barW = bw;
                    const barH = 4;
                    const barY = by + bh + 6;

                    ctx.fillStyle = 'rgba(255,255,255,0.25)';
                    ctx.beginPath();
                    ctx.roundRect(bx, barY, barW, barH, 2);
                    ctx.fill();

                    ctx.fillStyle = '#8b5cf6';
                    ctx.beginPath();
                    ctx.roundRect(bx, barY, barW * progress, barH, 2);
                    ctx.fill();
                }
            });

            animId = requestAnimationFrame(draw);
        };

        draw();
        return () => cancelAnimationFrame(animId);
    }, [isCameraActive, detected]);

    /* ──── Cleanup on unmount ──── */
    useEffect(() => {
        return () => {
            if (intervalRef.current) clearInterval(intervalRef.current);
            if (wsRef.current) wsRef.current.close();
            if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
        };
    }, []);

    /* ──── Session timer ──── */
    const sessionDuration = sessionStart
        ? Math.floor((currentTime.getTime() - sessionStart.getTime()) / 1000)
        : 0;
    const formatDuration = (s: number) => {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    };

    /* ═════════════════════ RENDER ═════════════════════ */
    return (
        <div className="max-w-5xl mx-auto space-y-6">
            {/* ──── Header Card ──── */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600 rounded-3xl p-8 text-white shadow-2xl shadow-purple-500/40 relative overflow-hidden animate-gradient"
            >
                <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl animate-float" />
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-pink-400/20 rounded-full blur-2xl" />
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />

                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-white/25 rounded-2xl backdrop-blur-sm shadow-lg shadow-white/10">
                            <ScanFace className="w-8 h-8 drop-shadow-lg" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-extrabold text-shadow-lg drop-shadow-lg">Mark Attendance</h1>
                            <p className="text-white/90 font-medium text-shadow">AI-powered face recognition • Auto-capture mode</p>
                        </div>
                    </div>

                    {/* Live clock */}
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2">
                            <Clock className="w-4 h-4" />
                            <span className="font-mono font-bold text-sm tracking-wider">
                                {currentTime.toLocaleTimeString()}
                            </span>
                        </div>
                        {isCameraActive && (
                            <div className="flex items-center gap-2 bg-white/15 backdrop-blur-sm rounded-xl px-4 py-2">
                                <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" />
                                <span className="font-mono font-bold text-sm">{formatDuration(sessionDuration)}</span>
                            </div>
                        )}
                    </div>
                </div>
            </motion.div>

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* ──── Camera Feed Card ──── */}
                <div className="xl:col-span-2 bg-white rounded-3xl shadow-xl border border-slate-100 overflow-hidden">
                    <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-3">
                            <Camera className="text-primary-600" />
                            Camera Feed
                        </h2>
                        <div className="flex items-center gap-2">
                            {wsConnected ? (
                                <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                                    <Wifi size={12} /> Connected
                                </span>
                            ) : isCameraActive ? (
                                <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-200">
                                    <WifiOff size={12} /> Connecting...
                                </span>
                            ) : null}
                        </div>
                    </div>

                    <div className="relative aspect-video bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden">
                        {/* Placeholder when camera is off */}
                        {!isCameraActive && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 bg-gradient-to-br from-slate-800 via-slate-900 to-purple-900/30">
                                <motion.div
                                    className="p-6 bg-gradient-to-br from-slate-700/60 to-slate-800/60 rounded-full mb-4 shadow-xl"
                                    animate={{ scale: [1, 1.05, 1], opacity: [0.5, 0.7, 0.5] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                >
                                    <Camera size={48} className="text-purple-400" />
                                </motion.div>
                                <p className="text-lg font-medium text-slate-300">Camera is off</p>
                                <p className="text-sm text-slate-500 mt-1">Click "Start Session" to begin auto-scanning</p>
                            </div>
                        )}

                        {/* Video element */}
                        <video
                            ref={videoRef}
                            className={`w-full h-full object-cover ${!isCameraActive ? 'hidden' : ''}`}
                            playsInline
                            muted
                        />

                        {/* Overlay canvas for face guide + bounding boxes */}
                        <canvas
                            ref={overlayCanvasRef}
                            className={`absolute inset-0 w-full h-full pointer-events-none ${!isCameraActive ? 'hidden' : ''}`}
                        />

                        {/* Hidden capture canvas */}
                        <canvas ref={canvasRef} className="hidden" width={640} height={480} />
                    </div>

                    {/* Action buttons */}
                    <div className="p-5 bg-slate-50 flex flex-wrap gap-4 justify-center">
                        {!isCameraActive ? (
                            <button
                                onClick={startSession}
                                className="flex items-center gap-3 px-8 py-4 bg-gradient-to-r from-primary-600 to-accent-600 text-white rounded-2xl font-bold shadow-xl shadow-primary-500/30 hover:shadow-2xl hover:shadow-primary-500/40 hover:scale-[1.02] active:scale-[0.98] transition-all"
                            >
                                <ScanFace size={24} />
                                Start Session
                            </button>
                        ) : (
                            <>
                                <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-700 text-sm font-semibold">
                                    <ShieldCheck size={16} />
                                    Auto-scanning enabled
                                </div>
                                <button
                                    onClick={stopSession}
                                    className="flex items-center gap-3 px-6 py-3 bg-white text-slate-700 rounded-2xl font-bold border-2 border-slate-200 hover:border-red-300 hover:bg-red-50 hover:text-red-700 transition-all"
                                >
                                    <XCircle size={20} />
                                    End Session
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* ──── Session Activity Panel ──── */}
                <div className="bg-white rounded-3xl shadow-xl border border-slate-100 flex flex-col overflow-hidden">
                    <div className="p-5 border-b border-slate-100">
                        <h3 className="text-lg font-bold text-slate-800 flex items-center gap-3">
                            <div className="p-2 bg-primary-100 rounded-xl">
                                <UserCheck className="text-primary-600" size={18} />
                            </div>
                            Session Log
                        </h3>
                        <p className="text-xs text-slate-400 mt-1">Students marked in this session</p>
                    </div>

                    {/* Live detected face info */}
                    {detected.length > 0 && (
                        <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Now Detecting</p>
                            {detected.map((d, i) => (
                                <div key={i} className="flex items-center gap-3 mb-2 last:mb-0">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm text-white shadow-md ${d.confirmed
                                        ? 'bg-gradient-to-br from-emerald-500 to-emerald-600'
                                        : 'bg-gradient-to-br from-primary-500 to-primary-600'
                                        }`}>
                                        {d.name.charAt(0)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-bold text-slate-800 truncate">{d.name}</p>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            {/* Confidence bar */}
                                            <div className="flex-1 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all duration-500 ${d.confidence > 0.7 ? 'bg-emerald-500' : d.confidence > 0.5 ? 'bg-amber-500' : 'bg-red-400'
                                                        }`}
                                                    style={{ width: `${Math.round(d.confidence * 100)}%` }}
                                                />
                                            </div>
                                            <span className="text-[10px] font-bold text-slate-400 w-8 text-right">
                                                {Math.round(d.confidence * 100)}%
                                            </span>
                                        </div>
                                    </div>
                                    {d.confirmed && (
                                        <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Marked students log */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {markedStudents.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-400 py-12">
                                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                                    <Volume2 size={20} className="opacity-30" />
                                </div>
                                <p className="text-sm font-medium text-slate-500">No attendance yet</p>
                                <p className="text-xs text-slate-400 mt-1 text-center max-w-[180px]">
                                    Recognized students will appear here with a sound alert
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                                    Marked ({markedStudents.length})
                                </p>
                                {markedStudents.map((s, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 border border-emerald-100"
                                    >
                                        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center text-white font-bold text-sm shadow">
                                            {s.name.charAt(0)}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-emerald-800 truncate">{s.name}</p>
                                            <p className="text-[10px] text-emerald-600 font-medium">{s.time}</p>
                                        </div>
                                        <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                                    </motion.div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Session stats footer */}
                    {markedStudents.length > 0 && (
                        <div className="p-4 border-t border-slate-100 bg-gradient-to-r from-emerald-50 to-teal-50">
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-semibold text-emerald-700">Total Present</span>
                                <span className="font-extrabold text-emerald-800 text-lg">{markedStudents.length}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Error message */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="bg-gradient-to-r from-red-50 to-red-100/50 border-2 border-red-200 rounded-2xl p-6 flex items-center gap-4"
                    >
                        <div className="p-3 bg-red-100 rounded-xl">
                            <XCircle className="text-red-600" size={24} />
                        </div>
                        <div>
                            <p className="font-bold text-red-800">{error}</p>
                            <p className="text-sm text-red-600 mt-1">
                                Please ensure your camera is connected and permissions are granted.
                            </p>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default AttendancePage;
