import { useState, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import { SkeletonRoutines } from '../components/Skeleton';
import { calculateLevel, getLevelTitle, getXPForNextLevel, XP_REWARDS } from '../utils/gamification';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, Trash2, Edit3, ShieldCheck, Zap, Activity, Book, Target, CheckCircle2,
    Flame, Award, Dumbbell, Wallet, Type, Tag, FileText, TrendingUp, TrendingDown,
    Calendar, Lightbulb, AlertTriangle, Crown, ChevronRight, ChevronDown, ChevronUp
} from 'lucide-react';

const anim = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { y: 16, opacity: 0 }, show: { y: 0, opacity: 1, transition: { duration: 0.5, ease: [.16, 1, .3, 1] } } };

const CATEGORIES = {
    dinero: { label: 'Finanzas', icon: Wallet, color: 'var(--accent-primary)' },
    salud: { label: 'Salud', icon: Dumbbell, color: '#ff5d5d' },
    estudio: { label: 'Aprendizaje', icon: Book, color: '#70d6ff' },
    disciplina: { label: 'Enfoque', icon: Target, color: '#a29bfe' },
    otros: { label: 'Otros', icon: Activity, color: 'var(--text-muted)' },
};

const DIFFICULTIES = {
    baja: { label: 'Baja', color: 'var(--accent-primary)', mult: 0.8 },
    media: { label: 'Media', color: 'var(--warning)', mult: 1.0 },
    alta: { label: 'Alta', color: 'var(--danger)', mult: 1.5 },
};

const IMPACT_LABELS = { alta: 'Alto', media: 'Medio', baja: 'Bajo' };

function getDayStr(date) { return new Date(date).toDateString(); }
function daysBetween(a, b) { return Math.round(Math.abs(new Date(a) - new Date(b)) / 864e5); }

export default function Routines() {
    const { state, dispatch } = useApp();
    const { addToast } = useToast();
    const { routines, gamification, isLoaded } = state;
    const [showForm, setShowForm] = useState(false);
    const [editingRoutine, setEditingRoutine] = useState(null);
    const [formData, setFormData] = useState({ name: '', category: 'dinero', frequency: 'daily', objective: '', difficulty: 'media' });

    const today = getDayStr(new Date());
    const level = useMemo(() => calculateLevel(gamification.totalXP), [gamification.totalXP]);
    const xpProgress = useMemo(() => getXPForNextLevel(gamification.totalXP), [gamification.totalXP]);

    // ─── Routine Metrics ─────────────────────────────
    const routineMetrics = useMemo(() => routines.map(r => {
        const dates = r.completedDates || [];
        const isToday = dates.includes(today);
        const streak = r.streak || 0;
        // Best streak from completed dates
        let bestStreak = streak;
        if (dates.length > 1) {
            const sorted = [...dates].map(d => new Date(d)).sort((a, b) => a - b);
            let cur = 1, best = 1;
            for (let i = 1; i < sorted.length; i++) {
                if (daysBetween(sorted[i], sorted[i - 1]) === 1) { cur++; best = Math.max(best, cur); }
                else cur = 1;
            }
            bestStreak = Math.max(streak, best);
        }
        // 30-day completion rate
        const last30 = [];
        for (let i = 0; i < 30; i++) {
            const d = new Date(); d.setDate(d.getDate() - i);
            last30.push(getDayStr(d));
        }
        const completions30 = last30.filter(d => dates.includes(d)).length;
        const rate30 = Math.round((completions30 / 30) * 100);
        // Missed yesterday check
        const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
        const missedYesterday = !dates.includes(getDayStr(yesterday)) && !isToday;
        return { ...r, isToday, streak, bestStreak, rate30, completions30, missedYesterday };
    }), [routines, today]);

    // ─── Discipline Score (0-100) ────────────────────
    const disciplineScore = useMemo(() => {
        if (routines.length === 0) return 0;
        // 7-day completion rate (40% weight)
        const last7 = [];
        for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); last7.push(getDayStr(d)); }
        const totalChecks7 = routines.length * 7;
        const completed7 = routines.reduce((s, r) => s + last7.filter(d => (r.completedDates || []).includes(d)).length, 0);
        const rate7 = totalChecks7 > 0 ? completed7 / totalChecks7 : 0;
        // Max streak contribution (30% weight)
        const maxStreak = Math.max(...routines.map(r => r.streak || 0), 0);
        const streakScore = Math.min(1, maxStreak / 30);
        // Weekly consistency (30% weight)
        const avgRate = routineMetrics.length > 0 ? routineMetrics.reduce((s, r) => s + r.rate30, 0) / routineMetrics.length / 100 : 0;
        return Math.round(rate7 * 40 + streakScore * 30 + avgRate * 30);
    }, [routines, routineMetrics]);

    // ─── Today Focus ─────────────────────────────────
    const todayStats = useMemo(() => {
        const total = routines.length;
        const completed = routineMetrics.filter(r => r.isToday).length;
        const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
        const allDone = total > 0 && completed === total;
        const bonusXP = allDone ? XP_REWARDS.ALL_ROUTINES_TODAY : 0;
        const pending = routineMetrics.filter(r => !r.isToday);
        return { total, completed, pct, allDone, bonusXP, pending };
    }, [routines, routineMetrics]);

    // ─── Heatmap Data (last 35 days, 5 weeks) ────────
    const heatmapData = useMemo(() => {
        const days = [];
        for (let i = 34; i >= 0; i--) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const ds = getDayStr(d);
            const total = routines.length;
            const completed = routines.filter(r => (r.completedDates || []).includes(ds)).length;
            const pct = total > 0 ? completed / total : 0;
            days.push({ date: d, ds, pct, completed, total, day: d.getDay(), label: d.getDate() });
        }
        return days;
    }, [routines]);

    // ─── Insights ────────────────────────────────────
    const insights = useMemo(() => {
        const ins = [];
        if (routines.length === 0) return ins;
        // Consistency vs last week
        const thisWeek = [], lastWeek = [];
        for (let i = 0; i < 7; i++) { const d = new Date(); d.setDate(d.getDate() - i); thisWeek.push(getDayStr(d)); }
        for (let i = 7; i < 14; i++) { const d = new Date(); d.setDate(d.getDate() - i); lastWeek.push(getDayStr(d)); }
        const thisRate = routines.reduce((s, r) => s + thisWeek.filter(d => (r.completedDates || []).includes(d)).length, 0) / Math.max(1, routines.length * 7);
        const lastRate = routines.reduce((s, r) => s + lastWeek.filter(d => (r.completedDates || []).includes(d)).length, 0) / Math.max(1, routines.length * 7);
        const diff = Math.round((thisRate - lastRate) * 100);
        if (diff > 0) ins.push({ icon: TrendingUp, color: 'var(--success)', msg: `Eres ${diff}% más consistente que la semana pasada.` });
        else if (diff < 0) ins.push({ icon: TrendingDown, color: 'var(--danger)', msg: `Tu consistencia bajó ${Math.abs(diff)}% vs la semana pasada.` });
        // Weakest day
        const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const dayCounts = [0, 0, 0, 0, 0, 0, 0];
        const dayTotals = [0, 0, 0, 0, 0, 0, 0];
        for (let i = 0; i < 28; i++) {
            const d = new Date(); d.setDate(d.getDate() - i);
            const dow = d.getDay();
            dayTotals[dow] += routines.length;
            routines.forEach(r => { if ((r.completedDates || []).includes(getDayStr(d))) dayCounts[dow]++; });
        }
        const dayRates = dayTotals.map((t, i) => t > 0 ? dayCounts[i] / t : 1);
        const weakest = dayRates.indexOf(Math.min(...dayRates));
        if (dayRates[weakest] < 0.5) ins.push({ icon: Calendar, color: 'var(--warning)', msg: `Rompes racha mayormente los ${dayNames[weakest]}. Planifica ese día.` });
        // Motivational
        if (ins.length < 3) ins.push({ icon: Lightbulb, color: 'var(--accent-primary)', msg: 'Completar todos los hábitos diarios incrementa tu probabilidad de ahorro en 32%.' });
        return ins.slice(0, 3);
    }, [routines]);

    // ─── Handlers ────────────────────────────────────
    const handleComplete = useCallback((routine) => {
        if ((routine.completedDates || []).includes(today)) { addToast('Ya completado hoy', { type: 'info' }); return; }
        const xpEarned = Math.round(XP_REWARDS.ROUTINE_COMPLETE * (DIFFICULTIES[routine.difficulty || 'media'].mult));
        dispatch({ type: 'COMPLETE_ROUTINE', payload: { id: routine.id, date: today, xp: xpEarned } });
        addToast(`¡Hábito cumplido! +${xpEarned} XP`, { type: 'success' });
    }, [dispatch, addToast, today]);

    const openNew = useCallback(() => {
        setEditingRoutine(null);
        setFormData({ name: '', category: 'dinero', frequency: 'daily', objective: '', difficulty: 'media' });
        setShowForm(true);
    }, []);

    const openEdit = useCallback((routine) => {
        setEditingRoutine(routine);
        setFormData({ name: routine.name, category: routine.category, frequency: routine.frequency, objective: routine.objective || '', difficulty: routine.difficulty || 'media' });
        setShowForm(true);
    }, []);

    const handleSubmit = useCallback((e) => {
        e.preventDefault();
        const data = { ...formData, streak: editingRoutine ? editingRoutine.streak : 0, completedDates: editingRoutine ? editingRoutine.completedDates : [] };
        if (editingRoutine) { dispatch({ type: 'UPDATE_ROUTINE', payload: { ...data, id: editingRoutine.id } }); addToast('Hábito actualizado', { type: 'success' }); }
        else { dispatch({ type: 'ADD_ROUTINE', payload: data }); addToast('Nuevo hábito creado', { type: 'success' }); }
        setShowForm(false); setEditingRoutine(null);
    }, [formData, editingRoutine, dispatch, addToast]);

    const handleDelete = useCallback((id) => { dispatch({ type: 'DELETE_ROUTINE', payload: id }); addToast('Hábito eliminado', { type: 'warning' }); }, [dispatch, addToast]);

    // ─── Heatmap color ───────────────────────────────
    const heatColor = (pct) => {
        if (pct >= 1) return 'var(--success)';
        if (pct >= 0.7) return 'rgba(0,229,195,0.5)';
        if (pct >= 0.3) return 'rgba(0,229,195,0.25)';
        if (pct > 0) return 'rgba(0,229,195,0.1)';
        return 'var(--bg-elevated)';
    };

    const scoreColor = disciplineScore >= 70 ? 'var(--success)' : disciplineScore >= 40 ? 'var(--warning)' : 'var(--danger)';

    if (!isLoaded) return <div className="page-content"><SkeletonRoutines /></div>;

    // ═══════════════════ RENDER ═══════════════════════
    return (
        <motion.div className="page-content" variants={anim} initial="hidden" animate="show">

            {/* ━━━━━ EMPTY STATE ━━━━━ */}
            {routines.length === 0 ? (
                <motion.div variants={fadeUp} className="card-wealth" style={{ textAlign: 'center', padding: '72px 32px' }}>
                    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6, ease: [.16, 1, .3, 1] }}>
                        <div style={{ width: 72, height: 72, borderRadius: 20, margin: '0 auto 24px', background: 'rgba(0,229,195,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Flame size={32} color="var(--accent-primary)" strokeWidth={1.5} />
                        </div>
                        <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 22, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>
                            Tu disciplina define tu patrimonio.
                        </h2>
                        <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 440, margin: '0 auto 32px', lineHeight: 1.7 }}>
                            Los hábitos pequeños se convierten en capital compuesto. Empieza con uno.
                        </p>
                        <button className="btn-wealth" onClick={openNew} style={{ padding: '14px 32px', fontSize: 14 }}>
                            <Plus size={16} /> Crear Primer Hábito
                        </button>
                        <div style={{ marginTop: 32, padding: '14px 20px', borderRadius: 12, background: 'rgba(0,229,195,0.04)', border: '1px solid rgba(0,229,195,0.08)', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                            <Lightbulb size={14} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                            Usuarios con 3+ hábitos activos ahorran 2.4x más consistentemente.
                        </div>
                    </motion.div>
                </motion.div>
            ) : (<>

                {/* ━━━━━ BLOCK 1: DISCIPLINE HERO ━━━━━ */}
                <motion.div variants={fadeUp} className="dashboard-hero-card shimmer-metal" style={{ marginBottom: 24 }}>
                    <div className="dashboard-hero-watermark">🔥</div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
                        {/* Left: Score */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                            <div style={{ position: 'relative', width: 96, height: 96 }}>
                                <svg width={96} height={96} style={{ transform: 'rotate(-90deg)' }}>
                                    <circle cx={48} cy={48} r={42} stroke="rgba(255,255,255,0.04)" strokeWidth={5} fill="none" />
                                    <motion.circle cx={48} cy={48} r={42} stroke={scoreColor} strokeWidth={5} fill="none"
                                        strokeDasharray={264} initial={{ strokeDashoffset: 264 }}
                                        animate={{ strokeDashoffset: 264 - (disciplineScore / 100) * 264 }}
                                        transition={{ duration: 1.2, ease: [.16, 1, .3, 1] }} strokeLinecap="round"
                                    />
                                    <motion.circle cx={48} cy={48} r={42} stroke={scoreColor} strokeWidth={5} fill="none"
                                        strokeDasharray={264} initial={{ strokeDashoffset: 264 }}
                                        animate={{ strokeDashoffset: 264 - (disciplineScore / 100) * 264 }}
                                        transition={{ duration: 1.2, ease: [.16, 1, .3, 1] }} strokeLinecap="round"
                                        style={{ filter: 'blur(4px)', opacity: 0.4 }}
                                    />
                                </svg>
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                                    <div style={{ fontFamily: 'Space Grotesk', fontSize: 28, fontWeight: 800, color: scoreColor, letterSpacing: '-0.03em', lineHeight: 1 }}>{disciplineScore}</div>
                                    <div style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Score</div>
                                </div>
                            </div>
                            <div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 4 }}>Motor de Disciplina</div>
                                <div style={{ fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em', marginBottom: 2 }}>
                                    {disciplineScore >= 70 ? 'Consistencia Sólida' : disciplineScore >= 40 ? 'Construyendo Momentum' : 'Fase de Activación'}
                                </div>
                                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                    Racha máxima: <span style={{ color: 'var(--warning)', fontWeight: 700 }}>{Math.max(...routines.map(r => r.streak || 0), 0)} días</span>
                                    {' · '}{routines.length} hábito{routines.length !== 1 ? 's' : ''} activo{routines.length !== 1 ? 's' : ''}
                                </div>
                            </div>
                        </div>

                        {/* Right: Level & XP */}
                        <div style={{ textAlign: 'right', minWidth: 200 }}>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Autoridad</div>
                            <div style={{ fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 800, marginBottom: 4 }}>{getLevelTitle(level)} · Nivel {level}</div>
                            <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 2, overflow: 'hidden', marginBottom: 4 }}>
                                <motion.div initial={{ width: 0 }} animate={{ width: `${xpProgress.progress}%` }} transition={{ duration: 1, ease: [.16, 1, .3, 1] }}
                                    style={{ height: '100%', background: 'var(--accent-gradient)', boxShadow: '0 0 8px rgba(0,245,212,0.3)' }} />
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{xpProgress.current}/{xpProgress.needed} XP · {xpProgress.progress}%</div>
                            <button className="btn-wealth" onClick={openNew} style={{ marginTop: 10, padding: '6px 16px', fontSize: 11 }}><Plus size={12} /> Nuevo Hábito</button>
                        </div>
                    </div>
                </motion.div>

                {/* ━━━━━ BLOCK 2: TODAY FOCUS ━━━━━ */}
                <motion.div variants={fadeUp} className="card-wealth" style={{ marginBottom: 24, borderColor: todayStats.allDone ? 'rgba(0,229,195,0.2)' : undefined }}>
                    <div className="card-header" style={{ marginBottom: 12 }}>
                        <div className="card-header-icon" style={{ background: todayStats.allDone ? 'var(--success-muted)' : 'rgba(255,165,0,0.08)' }}>
                            {todayStats.allDone ? <CheckCircle2 size={16} color="var(--success)" /> : <Flame size={16} color="var(--warning)" />}
                        </div>
                        <h3 style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>Enfoque del Día</h3>
                        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{todayStats.completed}/{todayStats.total} completados</span>
                    </div>

                    {/* Progress bar */}
                    <div className="liquid-progress" style={{ height: 6, marginBottom: 16 }}>
                        <motion.div className="liquid-progress-fill" style={{ background: todayStats.allDone ? 'var(--success)' : 'var(--accent-gradient)' }}
                            initial={{ width: 0 }} animate={{ width: `${todayStats.pct}%` }} transition={{ duration: 0.8, ease: [.16, 1, .3, 1] }} />
                    </div>

                    {todayStats.allDone ? (
                        <div style={{ textAlign: 'center', padding: '16px 0' }}>
                            <div style={{ fontSize: 20, marginBottom: 4 }}>🏆</div>
                            <div style={{ fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 800, color: 'var(--success)', marginBottom: 4 }}>Disciplina perfecta hoy.</div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>+{XP_REWARDS.ALL_ROUTINES_TODAY} XP de bonificación diaria</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {todayStats.pending.map(r => {
                                const cat = CATEGORIES[r.category] || CATEGORIES.otros;
                                const CatIcon = cat.icon;
                                return (
                                    <div key={r.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 10, background: 'var(--bg-elevated)', transition: 'background 0.15s' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                            <CatIcon size={14} color={cat.color} />
                                            <span style={{ fontSize: 13, fontWeight: 600 }}>{r.name}</span>
                                            {r.streak > 0 && <span style={{ fontSize: 10, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 2 }}><Flame size={10} />{r.streak}</span>}
                                        </div>
                                        <button onClick={() => handleComplete(r)} className="btn-wealth" style={{ padding: '4px 14px', fontSize: 11 }}>Completar</button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </motion.div>

                {/* ━━━━━ BLOCK 3: HABIT CARDS ━━━━━ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
                    {routineMetrics.map(rm => {
                        const cat = CATEGORIES[rm.category] || CATEGORIES.otros;
                        const CatIcon = cat.icon;
                        const diff = DIFFICULTIES[rm.difficulty || 'media'];
                        const streakActive = rm.streak > 0;
                        const streakColor = rm.streak >= 7 ? 'var(--success)' : rm.streak >= 3 ? 'var(--warning)' : 'var(--danger)';
                        return (
                            <motion.div key={rm.id} variants={fadeUp} className="card-wealth" style={{ padding: 0, overflow: 'hidden' }}>
                                <div style={{ display: 'flex' }}>
                                    {/* Color bar */}
                                    <div style={{ width: 4, background: cat.color, flexShrink: 0 }} />

                                    {/* Content */}
                                    <div style={{ flex: 1, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16 }}>
                                        {/* Icon */}
                                        <div style={{ width: 40, height: 40, borderRadius: 10, background: cat.color + '15', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                            <CatIcon size={18} color={cat.color} />
                                        </div>

                                        {/* Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                                <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>{rm.name}</h3>
                                                <span style={{ fontSize: 9, padding: '2px 6px', borderRadius: 4, background: diff.color + '18', color: diff.color, fontWeight: 700, textTransform: 'uppercase' }}>{diff.label}</span>
                                            </div>
                                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                                {[
                                                    { label: 'Racha', value: `${rm.streak}d`, color: streakActive ? streakColor : 'var(--text-muted)' },
                                                    { label: 'Mejor', value: `${rm.bestStreak}d` },
                                                    { label: '30d', value: `${rm.rate30}%`, color: rm.rate30 >= 70 ? 'var(--success)' : rm.rate30 >= 40 ? 'var(--warning)' : 'var(--danger)' },
                                                    { label: 'Impacto', value: IMPACT_LABELS[rm.difficulty || 'media'], color: diff.color },
                                                ].map(m => (
                                                    <div key={m.label}>
                                                        <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{m.label}</div>
                                                        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk', color: m.color }}>{m.value}</div>
                                                    </div>
                                                ))}
                                            </div>
                                            {rm.missedYesterday && rm.streak === 0 && (
                                                <div style={{ marginTop: 6, fontSize: 11, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 4, opacity: 0.8 }}>
                                                    <AlertTriangle size={10} /> Racha rota — vuelve a empezar hoy
                                                </div>
                                            )}
                                        </div>

                                        {/* Actions */}
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                                            {streakActive && (
                                                <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
                                                    style={{ color: 'var(--warning)', display: 'flex', alignItems: 'center' }}>
                                                    <Flame size={18} />
                                                </motion.div>
                                            )}
                                            <button onClick={() => openEdit(rm)} className="onboarding-remove-btn" style={{ width: 28, height: 28, opacity: 0.4 }}><Edit3 size={12} /></button>
                                            <button onClick={() => handleDelete(rm.id)} className="onboarding-remove-btn" style={{ width: 28, height: 28, opacity: 0.3 }}><Trash2 size={12} /></button>
                                        </div>
                                    </div>

                                    {/* Big streak / completion */}
                                    <div style={{ width: 80, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', borderLeft: '1px solid var(--border-secondary)', background: 'var(--bg-primary)', flexShrink: 0, cursor: 'pointer' }}
                                        onClick={() => !rm.isToday && handleComplete(rm)}>
                                        {rm.isToday ? (
                                            <><CheckCircle2 size={22} color="var(--success)" /><div style={{ fontSize: 9, color: 'var(--success)', marginTop: 4, textTransform: 'uppercase', fontWeight: 700 }}>Hecho</div></>
                                        ) : (
                                            <><div style={{ fontFamily: 'Space Grotesk', fontSize: 24, fontWeight: 800, color: rm.streak > 0 ? streakColor : 'var(--text-muted)', letterSpacing: '-0.03em' }}>{rm.streak}</div>
                                                <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>días</div></>
                                        )}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>

                {/* ━━━━━ BLOCK 4: HEATMAP ━━━━━ */}
                <motion.div variants={fadeUp} className="card-wealth" style={{ marginBottom: 24 }}>
                    <div className="card-header" style={{ marginBottom: 16 }}>
                        <div className="card-header-icon"><Calendar size={16} color="var(--accent-primary)" /></div>
                        <h3 style={{ fontSize: 14, fontWeight: 700 }}>Mapa de Consistencia</h3>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 'auto' }}>Últimos 35 días</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                        {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map(d => (
                            <div key={d} style={{ fontSize: 9, color: 'var(--text-muted)', textAlign: 'center', marginBottom: 4, fontWeight: 600 }}>{d}</div>
                        ))}
                        {/* Pad start to align with day of week */}
                        {heatmapData.length > 0 && Array.from({ length: (heatmapData[0].date.getDay() + 6) % 7 }).map((_, i) => (
                            <div key={`pad-${i}`} />
                        ))}
                        {heatmapData.map((d, i) => (
                            <motion.div key={d.ds}
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.015, duration: 0.3 }}
                                title={`${d.label}: ${d.completed}/${d.total} completados`}
                                style={{
                                    aspectRatio: '1', borderRadius: 4, background: heatColor(d.pct),
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: 9, color: d.pct >= 0.7 ? '#0a0a0b' : 'var(--text-muted)',
                                    fontWeight: d.pct >= 1 ? 700 : 400, cursor: 'default',
                                    border: d.ds === today ? '1.5px solid var(--accent-primary)' : '1px solid transparent',
                                }}>
                                {d.label}
                            </motion.div>
                        ))}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, justifyContent: 'flex-end' }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Menos</span>
                        {[0, 0.2, 0.5, 0.8, 1].map(p => (
                            <div key={p} style={{ width: 12, height: 12, borderRadius: 3, background: heatColor(p) }} />
                        ))}
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Más</span>
                    </div>
                </motion.div>

                {/* ━━━━━ BLOCK 5: INSIGHTS ━━━━━ */}
                {insights.length > 0 && (
                    <motion.div variants={fadeUp} className="card-wealth" style={{ marginBottom: 24 }}>
                        <div className="card-header" style={{ marginBottom: 8 }}>
                            <div className="card-header-icon" style={{ background: 'rgba(0,229,195,0.06)' }}><Lightbulb size={16} color="var(--accent-primary)" /></div>
                            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Inteligencia de Disciplina</h3>
                        </div>
                        {insights.map((ins, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderTop: i > 0 ? '1px solid var(--border-secondary)' : 'none' }}>
                                <ins.icon size={14} color={ins.color} style={{ marginTop: 2, flexShrink: 0 }} />
                                <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{ins.msg}</span>
                            </div>
                        ))}
                    </motion.div>
                )}
            </>)}

            {/* ━━━━━ MODAL ━━━━━ */}
            <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingRoutine ? 'Configurar Rutina' : 'Nueva Rutina de Disciplina'}>
                <form onSubmit={handleSubmit}>
                    <div className="form-group"><label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>NOMBRE DEL HÁBITO</label><div style={{ position: 'relative' }}><Type size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} /><input className="wealth-input" style={{ paddingLeft: 40 }} placeholder="Ej: Registrar gastos diarios" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required autoFocus /></div></div>
                    <div className="form-group"><label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>OBJETIVO / DISCIPLINA</label><div style={{ position: 'relative' }}><ShieldCheck size={14} style={{ position: 'absolute', left: 14, top: 18, color: 'var(--text-muted)' }} /><textarea className="wealth-input" style={{ paddingLeft: 40, paddingTop: 14, minHeight: 80, resize: 'none' }} placeholder="¿Cómo te acerca a tu libertad financiera?" value={formData.objective} onChange={e => setFormData({ ...formData, objective: e.target.value })} /></div></div>
                    <div className="bento-grid" style={{ gridAutoRows: 'auto', gap: 16 }}>
                        <div className="bento-span-6 form-group"><label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>CATEGORÍA</label><div style={{ position: 'relative' }}><Tag size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} /><select className="wealth-input" style={{ paddingLeft: 40 }} value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} required>{Object.entries(CATEGORIES).map(([v, d]) => <option key={v} value={v}>{d.label}</option>)}</select></div></div>
                        <div className="bento-span-6 form-group"><label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>DIFICULTAD</label><div style={{ position: 'relative' }}><Zap size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} /><select className="wealth-input" style={{ paddingLeft: 40 }} value={formData.difficulty} onChange={e => setFormData({ ...formData, difficulty: e.target.value })} required>{Object.entries(DIFFICULTIES).map(([v, d]) => <option key={v} value={v}>{d.label} (x{d.mult} XP)</option>)}</select></div></div>
                    </div>
                    <div className="form-group" style={{ marginBottom: 32 }}><label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>FRECUENCIA</label><div style={{ position: 'relative' }}><Activity size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} /><select className="wealth-input" style={{ paddingLeft: 40 }} value={formData.frequency} onChange={e => setFormData({ ...formData, frequency: e.target.value })} required><option value="daily">Diariamente</option><option value="weekdays">Días laborales</option><option value="weekly">Semanalmente</option></select></div></div>
                    <div className="form-actions" style={{ border: 'none', padding: 0 }}>
                        <button type="button" className="btn-wealth btn-wealth-outline" style={{ height: 48, paddingInline: 24 }} onClick={() => setShowForm(false)}>Cancelar</button>
                        <button type="submit" className="btn-wealth" style={{ flex: 1, height: 48, justifyContent: 'center' }}>{editingRoutine ? 'Guardar Cambios' : 'Crear Hábito'}</button>
                    </div>
                </form>
            </Modal>
        </motion.div>
    );
}
