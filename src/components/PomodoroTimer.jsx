import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { XP_REWARDS } from '../utils/gamification';
import { Play, Pause, RotateCcw, Coffee, Zap, ChevronDown, CheckCircle2, Rewind } from 'lucide-react';

const MODES = {
    focus: { label: 'Enfoque Profundo', minutes: 25, color: '#00f5d4' },
    shortBreak: { label: 'Recuperación Cognitiva', minutes: 5, color: '#70d6ff' },
    longBreak: { label: 'Reinicio del Sistema', minutes: 15, color: '#00b4d8' },
};

export default function PomodoroTimer() {
    const { dispatch } = useApp();
    const { addToast } = useToast();
    const { isDark } = useTheme();

    const [mode, setMode] = useState('focus');
    const [timeLeft, setTimeLeft] = useState(MODES.focus.minutes * 60);
    const [isRunning, setIsRunning] = useState(false);
    const [sessions, setSessions] = useState(0);
    const [isMinimized, setIsMinimized] = useState(true);
    const intervalRef = useRef(null);

    const currentMode = MODES[mode];
    const totalSeconds = currentMode.minutes * 60;

    const progress = useMemo(() => {
        return ((totalSeconds - timeLeft) / totalSeconds) * 100;
    }, [timeLeft, totalSeconds]);

    const formatTime = useCallback((seconds) => {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }, []);

    const playNotification = useCallback(() => {
        try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            const gain = ctx.createGain();
            const osc = ctx.createOscillator();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.frequency.value = 800; gain.gain.value = 0.1;
            osc.start(); osc.stop(ctx.currentTime + 0.2);
        } catch { /* audio not available */ }
    }, []);

    const completeSession = useCallback(() => {
        setIsRunning(false);
        playNotification();

        if (mode === 'focus') {
            const newSessions = sessions + 1;
            setSessions(newSessions);
            dispatch({ type: 'ADD_XP', payload: XP_REWARDS.ROUTINE_COMPLETE });
            addToast(`Enfoque ${newSessions} completado`, { type: 'xp', xpAmount: XP_REWARDS.ROUTINE_COMPLETE });

            if (newSessions % 4 === 0) {
                dispatch({ type: 'ADD_XP', payload: XP_REWARDS.ALL_ROUTINES_TODAY });
                addToast('Bono: 4 ciclos alcanzados', { type: 'xp', xpAmount: XP_REWARDS.ALL_ROUTINES_TODAY });
                setMode('longBreak');
                setTimeLeft(MODES.longBreak.minutes * 60);
            } else {
                setMode('shortBreak');
                setTimeLeft(MODES.shortBreak.minutes * 60);
            }
        } else {
            setMode('focus');
            setTimeLeft(MODES.focus.minutes * 60);
        }
    }, [mode, sessions, dispatch, addToast, playNotification]);

    useEffect(() => {
        if (isRunning && timeLeft > 0) {
            intervalRef.current = setInterval(() => {
                setTimeLeft(prev => {
                    if (prev <= 1) {
                        clearInterval(intervalRef.current);
                        completeSession();
                        return 0;
                    }
                    return prev - 1;
                });
            }, 1000);
        }
        return () => clearInterval(intervalRef.current);
    }, [isRunning, completeSession]);

    const toggleTimer = useCallback((e) => {
        e.stopPropagation();
        setIsRunning(prev => !prev);
    }, []);

    const resetTimer = useCallback((e) => {
        e.stopPropagation();
        setIsRunning(false);
        setTimeLeft(MODES[mode].minutes * 60);
    }, [mode]);

    const switchMode = useCallback((newMode) => {
        setIsRunning(false);
        setMode(newMode);
        setTimeLeft(MODES[newMode].minutes * 60);
    }, []);

    // Theme-aware colors
    const fabBg = isDark ? '#0a0a0b' : '#ffffff';
    const fabBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
    const fabShadow = isDark ? '0 10px 40px rgba(0,0,0,0.6)' : '0 10px 40px rgba(0,0,0,0.12)';
    const trackColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    const panelBg = isDark ? 'rgba(20, 20, 21, 0.95)' : 'rgba(255, 255, 255, 0.95)';
    const tabBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
    const tabActiveBg = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';

    return (
        <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 1000 }}>
            <AnimatePresence mode="wait">
                {isMinimized ? (
                    <motion.button
                        key="fab"
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        onClick={() => setIsMinimized(false)}
                        whileHover={{ scale: 1.05, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        style={{
                            width: 64, height: 64, borderRadius: '50%', background: fabBg,
                            border: `1px solid ${fabBorder}`, cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            boxShadow: fabShadow, position: 'relative', overflow: 'hidden'
                        }}
                    >
                        <svg width="64" height="64" style={{ position: 'absolute', transform: 'rotate(-90deg)' }}>
                            <circle cx="32" cy="32" r="28" fill="none" stroke={trackColor} strokeWidth="2.5" />
                            <motion.circle
                                cx="32" cy="32" r="28" fill="none"
                                stroke="var(--accent-primary)" strokeWidth="2.5" strokeLinecap="round"
                                strokeDasharray={2 * Math.PI * 28}
                                animate={{ strokeDashoffset: 2 * Math.PI * 28 * (1 - progress / 100) }}
                            />
                        </svg>
                        {isRunning ? (
                            <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk', color: 'var(--text-primary)', zIndex: 1 }}>{formatTime(timeLeft)}</div>
                        ) : (
                            <Zap size={24} color="var(--accent-primary)" style={{ zIndex: 1 }} />
                        )}
                    </motion.button>
                ) : (
                    <motion.div
                        key="panel"
                        initial={{ opacity: 0, y: 40, scale: 0.9, filter: 'blur(10px)' }}
                        animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                        exit={{ opacity: 0, y: 40, scale: 0.9, filter: 'blur(10px)' }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        style={{
                            width: 320, background: panelBg, borderRadius: 28,
                            border: '1px solid var(--border-color)', backdropFilter: 'blur(30px)',
                            padding: 24, boxShadow: '0 30px 90px rgba(0,0,0,0.3)',
                        }}
                    >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                <div style={{ padding: 8, background: 'rgba(0, 245, 212, 0.12)', borderRadius: 10 }}>
                                    <Zap size={18} color="var(--accent-primary)" />
                                </div>
                                <span className="font-title" style={{ fontWeight: 700, fontSize: 16 }}>Motor de Enfoque</span>
                            </div>
                            <button onClick={() => setIsMinimized(true)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4 }}>
                                <ChevronDown size={20} />
                            </button>
                        </div>

                        <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: tabBg, padding: 4, borderRadius: 14 }}>
                            {Object.entries(MODES).map(([key, val]) => (
                                <button key={key} onClick={() => switchMode(key)} style={{
                                    flex: 1, padding: '8px 2px', borderRadius: 10, border: 'none',
                                    background: mode === key ? tabActiveBg : 'transparent',
                                    color: mode === key ? 'var(--text-primary)' : 'var(--text-muted)',
                                    fontSize: 10, fontWeight: 700, cursor: 'pointer',
                                    textTransform: 'uppercase', letterSpacing: '0.05em', transition: 'all 0.2s'
                                }}>
                                    {val.label.split(' ')[0]}
                                </button>
                            ))}
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
                            <div style={{ position: 'relative', width: 160, height: 160 }}>
                                <svg width="160" height="160" viewBox="0 0 160 160" style={{ transform: 'rotate(-90deg)' }}>
                                    <circle cx="80" cy="80" r="74" fill="none" stroke={trackColor} strokeWidth="4" />
                                    <motion.circle
                                        cx="80" cy="80" r="74" fill="none"
                                        stroke="var(--accent-primary)" strokeWidth="4" strokeLinecap="round"
                                        strokeDasharray={2 * Math.PI * 74} animate={{ strokeDashoffset: 2 * Math.PI * 74 * (1 - progress / 100) }}
                                        transition={{ duration: 0.5 }}
                                    />
                                </svg>
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                    <div style={{ fontFamily: 'Space Grotesk', fontSize: 42, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>{formatTime(timeLeft)}</div>
                                    <div style={{ fontSize: 10, color: 'var(--accent-primary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.12em', marginTop: 2 }}>{currentMode.label}</div>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 24 }}>
                            <button onClick={resetTimer} className="btn-wealth" style={{ width: 44, height: 44, padding: 0, borderRadius: 12, background: tabBg, border: 'none', color: 'var(--text-muted)', justifyContent: 'center' }}><RotateCcw size={18} /></button>
                            <button onClick={toggleTimer} className="btn-wealth" style={{ height: 44, flex: 1, borderRadius: 12, justifyContent: 'center', fontWeight: 700 }}>
                                {isRunning ? <><Pause size={18} style={{ marginRight: 8 }} /> Pausar</> : <><Play size={18} style={{ marginRight: 8 }} /> Iniciar</>}
                            </button>
                            <button onClick={() => switchMode(mode === 'focus' ? 'shortBreak' : 'focus')} className="btn-wealth" style={{ width: 44, height: 44, padding: 0, borderRadius: 12, background: tabBg, border: 'none', color: 'var(--text-muted)', justifyContent: 'center' }}><CheckCircle2 size={18} /></button>
                        </div>

                        <div style={{ textAlign: 'center', fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                            <span>Sesiones</span>
                            <div style={{ display: 'flex', gap: 4 }}>
                                {[1, 2, 3, 4].map(i => (
                                    <div key={i} style={{ width: 5, height: 5, borderRadius: '50%', background: i <= (sessions % 4 || (sessions > 0 && sessions % 4 === 0 ? 4 : 0)) ? 'var(--accent-primary)' : trackColor }} />
                                ))}
                            </div>
                            <span style={{ fontWeight: 800, color: 'var(--text-primary)' }}>{sessions}</span>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
