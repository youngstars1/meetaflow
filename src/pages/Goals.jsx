import { useState, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { PrivacyAmount } from '../context/PrivacyContext';
import WealthRing from '../components/WealthRing';
import Modal from '../components/Modal';
import GoalImageUpload, { getLocalGoalImage } from '../components/GoalImageUpload';
import { SkeletonGoalCards } from '../components/Skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import { formatCurrency, getProgressPercentage, calculateSavingsRecommendation, daysRemaining, getPriorityLabel } from '../utils/helpers';
import { time } from '../utils/timeEngine';
import { predictGoalCompletion, getGoalPaceStatus } from '../utils/projections';
import {
    Plus, Edit3, Trash2, PiggyBank, Target, ArrowUpRight, Calendar, Shield, Zap,
    TrendingUp, TrendingDown, Clock, Type, DollarSign, Tag, FileText, ChevronRight,
    AlertTriangle, Lightbulb, BarChart3, ChevronDown, ChevronUp, Activity
} from 'lucide-react';

const anim = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const fadeUp = { hidden: { y: 16, opacity: 0 }, show: { y: 0, opacity: 1, transition: { duration: 0.5, ease: [.16, 1, .3, 1] } } };

const PRIORITY_COLORS = { alta: 'var(--danger)', media: 'var(--warning)', baja: 'var(--info)' };
const PACE_CONFIG = {
    ahead: { label: 'Adelantado', color: 'var(--success)', icon: TrendingUp, bg: 'var(--success-muted)' },
    'on-track': { label: 'En Tiempo', color: 'var(--accent-primary)', icon: Shield, bg: 'rgba(0,229,195,0.06)' },
    behind: { label: 'Atrasado', color: 'var(--danger)', icon: AlertTriangle, bg: 'var(--danger-muted)' },
    completed: { label: 'Completado', color: 'var(--success)', icon: Shield, bg: 'var(--success-muted)' },
    unknown: { label: 'Sin datos', color: 'var(--text-muted)', icon: Clock, bg: 'var(--bg-elevated)' },
};

export default function Goals() {
    const { state, dispatch } = useApp();
    const { addToast } = useToast();
    const { goals, transactions, profile = {}, fixedExpenses = [], isLoaded } = state;
    const [showForm, setShowForm] = useState(false);
    const [showDetail, setShowDetail] = useState(null);
    const [showAddSavings, setShowAddSavings] = useState(null);
    const [editingGoal, setEditingGoal] = useState(null);
    const [savingsAmount, setSavingsAmount] = useState('');
    const [expandedSim, setExpandedSim] = useState(null);
    const [simExtra, setSimExtra] = useState(50000);
    const [formData, setFormData] = useState({
        name: '', targetAmount: '', deadline: '', description: '', priority: 'media', icon: 'Target', imageUrl: '',
    });

    // ─── Monthly income ──────────────────────────────
    const monthlyIncome = useMemo(() =>
        (profile.incomeSources || []).reduce((s, src) => s + (parseFloat(src.amount) || 0), 0), [profile.incomeSources]);

    // ─── Savings velocity (monthly avg from transactions) ──
    const savingsVelocity = useMemo(() => {
        const savingsTx = transactions.filter(t => t.type === 'ahorro');
        if (savingsTx.length === 0) return 0;
        const sorted = [...savingsTx].sort((a, b) => new Date(a.date) - new Date(b.date));
        const first = new Date(sorted[0].date || sorted[0].createdAt);
        const last = time.now();
        const months = Math.max(1, (last - first) / (1000 * 60 * 60 * 24 * 30));
        return savingsTx.reduce((s, t) => s + t.amount, 0) / months;
    }, [transactions]);

    // ─── Goal computations ───────────────────────────
    const sortedGoals = useMemo(() =>
        [...goals].sort((a, b) => ({ alta: 0, media: 1, baja: 2 }[a.priority] || 1) - ({ alta: 0, media: 1, baja: 2 }[b.priority] || 1)),
        [goals]);

    const goalMetrics = useMemo(() => sortedGoals.map(goal => {
        const progress = getProgressPercentage(goal.currentAmount || 0, goal.targetAmount);
        const remaining = Math.max(0, goal.targetAmount - (goal.currentAmount || 0));
        const pace = getGoalPaceStatus(goal);
        const prediction = predictGoalCompletion(goal, transactions);
        const days = daysRemaining(goal.deadline);
        const monthsLeft = Math.max(1, days / 30);
        const monthlyRequired = remaining / monthsLeft;
        const goalImg = goal.imageUrl || getLocalGoalImage(goal.id);
        const daysAhead = prediction.daysAhead || 0;
        return { ...goal, progress, remaining, pace, prediction, days, monthsLeft, monthlyRequired, goalImg, daysAhead };
    }), [sortedGoals, transactions]);

    // ─── Overview aggregates ─────────────────────────
    const overview = useMemo(() => {
        const totalAssigned = goals.reduce((s, g) => s + (g.currentAmount || 0), 0);
        const totalTarget = goals.reduce((s, g) => s + g.targetAmount, 0);
        const avgProgress = goals.length > 0 ? Math.round(goals.reduce((s, g) => s + getProgressPercentage(g.currentAmount || 0, g.targetAmount), 0) / goals.length) : 0;
        const totalRemaining = Math.max(0, totalTarget - totalAssigned);
        const monthsToAll = savingsVelocity > 0 ? Math.ceil(totalRemaining / savingsVelocity) : null;
        const estimatedDate = monthsToAll ? new Date(time.now().getTime() + monthsToAll * 30 * 24 * 60 * 60 * 1000) : null;
        const requiredVelocity = goals.length > 0 ? goals.reduce((s, g) => {
            const rem = Math.max(0, g.targetAmount - (g.currentAmount || 0));
            const d = daysRemaining(g.deadline);
            return s + (d > 0 ? rem / (d / 30) : 0);
        }, 0) : 0;
        let momentum = 'on-track';
        if (savingsVelocity >= requiredVelocity * 1.1) momentum = 'ahead';
        else if (savingsVelocity < requiredVelocity * 0.85) momentum = 'behind';
        return { totalAssigned, totalTarget, avgProgress, totalRemaining, monthsToAll, estimatedDate, momentum, requiredVelocity };
    }, [goals, savingsVelocity]);

    // ─── Insights ────────────────────────────────────
    const insights = useMemo(() => {
        const ins = [];
        if (goalMetrics.length === 0) return ins;
        const topGoal = goalMetrics[0];
        if (topGoal && overview.totalAssigned > 0) {
            const pct = Math.round(((topGoal.currentAmount || 0) / overview.totalAssigned) * 100);
            if (pct > 50) ins.push({ icon: Target, msg: `Estás asignando ${pct}% de tu ahorro a ${topGoal.name}.` });
        }
        if (savingsVelocity > 0 && overview.monthsToAll) {
            ins.push({ icon: Clock, msg: `Al ritmo actual, completarás todas tus metas en ${overview.monthsToAll} meses.` });
        }
        const behindGoals = goalMetrics.filter(g => g.pace === 'behind');
        if (behindGoals.length > 0) {
            ins.push({ icon: AlertTriangle, msg: `${behindGoals.length} meta${behindGoals.length > 1 ? 's' : ''} necesita${behindGoals.length > 1 ? 'n' : ''} más ahorro mensual para cumplir el plazo.` });
        }
        if (ins.length < 3 && savingsVelocity > 0) {
            ins.push({ icon: Lightbulb, msg: `Tu velocidad de ahorro promedio es ${formatCurrency(Math.round(savingsVelocity))}/mes.` });
        }
        return ins.slice(0, 3);
    }, [goalMetrics, overview, savingsVelocity]);

    // ─── Handlers ────────────────────────────────────
    const openNew = useCallback(() => {
        setEditingGoal(null);
        setFormData({ name: '', targetAmount: '', deadline: '', description: '', priority: 'media', icon: 'Target', imageUrl: '' });
        setShowForm(true);
    }, []);

    const openEdit = useCallback((goal) => {
        setEditingGoal(goal);
        setFormData({ name: goal.name, targetAmount: goal.targetAmount.toString(), deadline: goal.deadline ? goal.deadline.split('T')[0] : '', description: goal.description || '', priority: goal.priority || 'media', icon: goal.icon || 'Target', imageUrl: goal.imageUrl || getLocalGoalImage(goal.id) || '' });
        setShowForm(true);
    }, []);

    const handleSubmit = useCallback((e) => {
        e.preventDefault();
        const goalData = { name: formData.name, targetAmount: Number(formData.targetAmount), deadline: formData.deadline, description: formData.description, priority: formData.priority, icon: formData.icon, imageUrl: formData.imageUrl, currentAmount: editingGoal ? editingGoal.currentAmount : 0, createdAt: editingGoal ? editingGoal.createdAt : new Date().toISOString() };
        if (editingGoal) { dispatch({ type: 'UPDATE_GOAL', payload: { ...goalData, id: editingGoal.id } }); addToast('Meta actualizada', { type: 'success' }); }
        else { dispatch({ type: 'ADD_GOAL', payload: goalData }); addToast('Meta creada', { type: 'success' }); }
        setShowForm(false);
    }, [formData, editingGoal, dispatch, addToast]);

    const handleDelete = useCallback((goalId) => {
        dispatch({ type: 'DELETE_GOAL', payload: goalId });
        setShowDetail(null);
        addToast('Meta eliminada', { type: 'warning' });
    }, [dispatch, addToast]);

    const handleAddSavings = useCallback(async (e) => {
        e.preventDefault();
        const amount = Number(savingsAmount);
        if (!amount || amount <= 0) return;
        const g = showAddSavings;
        dispatch({ type: 'ADD_SAVINGS_TO_GOAL', payload: { goalId: g.id, amount } });
        dispatch({ type: 'ADD_TRANSACTION', payload: { type: 'ahorro', amount, category: 'ahorro_meta', date: new Date().toISOString(), note: `Ahorro para: ${g.name}` } });
        addToast(`${formatCurrency(amount)} añadidos`, { type: 'success' });
        setSavingsAmount(''); setShowAddSavings(null);
    }, [savingsAmount, showAddSavings, dispatch, addToast]);

    if (!isLoaded) return <div className="page-content"><SkeletonGoalCards /></div>;

    // ═══════════════════════ RENDER ═══════════════════
    return (
        <motion.div className="page-content" variants={anim} initial="hidden" animate="show">

            {/* ━━━━━ EMPTY STATE ━━━━━ */}
            {sortedGoals.length === 0 ? (
                <motion.div variants={fadeUp} className="card-wealth" style={{ textAlign: 'center', padding: '72px 32px' }}>
                    <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.6, ease: [.16, 1, .3, 1] }}>
                        <div style={{ width: 72, height: 72, borderRadius: 20, margin: '0 auto 24px', background: 'var(--success-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Target size={32} color="var(--accent-primary)" strokeWidth={1.5} />
                        </div>
                        <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 22, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>
                            Define hacia dónde trabaja tu dinero.
                        </h2>
                        <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 440, margin: '0 auto 32px', lineHeight: 1.7 }}>
                            Metas claras incrementan la disciplina de ahorro en 2x. Cada peso que asignas tiene un propósito.
                        </p>
                        <button className="btn-wealth" onClick={openNew} style={{ padding: '14px 32px', fontSize: 14 }}>
                            <Plus size={16} /> Crear tu Primera Meta
                        </button>
                        <div style={{ marginTop: 32, padding: '14px 20px', borderRadius: 12, background: 'rgba(0,229,195,0.04)', border: '1px solid rgba(0,229,195,0.08)', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
                            <Lightbulb size={14} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                            Usuarios con metas definidas ahorran 3.2x más que los que no las tienen.
                        </div>
                    </motion.div>
                </motion.div>
            ) : (<>

                {/* ━━━━━ BLOCK 1: OVERVIEW HERO ━━━━━ */}
                <motion.div variants={fadeUp} className="dashboard-hero-card shimmer-metal" style={{ marginBottom: 24 }}>
                    <div className="dashboard-hero-watermark">$</div>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 20 }}>
                        <div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6 }}>
                                Motor de Metas · {goals.length} activa{goals.length !== 1 ? 's' : ''}
                            </div>
                            <div className="dashboard-hero-label">CAPITAL ASIGNADO A METAS</div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            {(() => {
                                const m = PACE_CONFIG[overview.momentum]; return (
                                    <div className="dashboard-status-badge" style={{ background: m.bg, color: m.color, borderColor: m.color + '30' }}>
                                        <m.icon size={13} /> {m.label}
                                    </div>
                                );
                            })()}
                            <button className="btn-wealth" onClick={openNew} style={{ padding: '8px 16px', fontSize: 12 }}><Plus size={14} /> Nueva Meta</button>
                        </div>
                    </div>

                    <PrivacyAmount>
                        <motion.div className="dashboard-hero-balance" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
                            {formatCurrency(overview.totalAssigned)}
                        </motion.div>
                    </PrivacyAmount>

                    <div className="dashboard-hero-metrics" style={{ marginBottom: 0 }}>
                        <div className="dashboard-hero-metric">
                            <span className="dashboard-hero-metric-label">Valor Total Metas</span>
                            <PrivacyAmount><span className="dashboard-hero-metric-value">{formatCurrency(overview.totalTarget)}</span></PrivacyAmount>
                        </div>
                        <div className="dashboard-hero-metric">
                            <span className="dashboard-hero-metric-label">Progreso Promedio</span>
                            <span className="dashboard-hero-metric-value" style={{ color: 'var(--accent-primary)' }}>{overview.avgProgress}%</span>
                        </div>
                        <div className="dashboard-hero-metric">
                            <span className="dashboard-hero-metric-label">Falta por Asignar</span>
                            <PrivacyAmount><span className="dashboard-hero-metric-value" style={{ color: 'var(--warning)' }}>{formatCurrency(overview.totalRemaining)}</span></PrivacyAmount>
                        </div>
                        <div className="dashboard-hero-metric">
                            <span className="dashboard-hero-metric-label">Velocidad Mensual</span>
                            <PrivacyAmount><span className="dashboard-hero-metric-value" style={{ color: 'var(--success)' }}>{formatCurrency(Math.round(savingsVelocity))}</span></PrivacyAmount>
                        </div>
                    </div>

                    {/* Progress Timeline */}
                    <div className="dashboard-cashflow" style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-secondary)' }}>
                        {[
                            { label: 'Hoy', pct: 0, color: 'var(--text-primary)' },
                            { label: '25%', pct: 25, color: overview.avgProgress >= 25 ? 'var(--success)' : 'var(--text-muted)' },
                            { label: '50%', pct: 50, color: overview.avgProgress >= 50 ? 'var(--success)' : 'var(--text-muted)' },
                            { label: '75%', pct: 75, color: overview.avgProgress >= 75 ? 'var(--success)' : 'var(--text-muted)' },
                            { label: '✓ Meta', pct: 100, color: overview.avgProgress >= 100 ? 'var(--success)' : 'var(--text-muted)' },
                        ].map((node, i, arr) => (
                            <div key={node.label} className="dashboard-cashflow-node">
                                <div className="dashboard-cashflow-circle" style={{ borderColor: node.color, color: node.color, width: 36, height: 36, fontSize: 10, fontWeight: 700 }}>
                                    {node.pct <= overview.avgProgress ? '✓' : `${node.pct}%`}
                                </div>
                                <div className="dashboard-cashflow-info">
                                    <span className="dashboard-cashflow-label" style={{ color: node.color }}>{node.label}</span>
                                </div>
                                {i < arr.length - 1 && <div className="dashboard-cashflow-arrow"><ChevronRight size={14} /></div>}
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* ━━━━━ BLOCK 2: SMART GOAL CARDS ━━━━━ */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
                    {goalMetrics.map((gm, idx) => {
                        const paceConf = PACE_CONFIG[gm.pace] || PACE_CONFIG.unknown;
                        const isSimOpen = expandedSim === gm.id;
                        const simMonthsLeft = gm.remaining > 0 && (savingsVelocity + simExtra) > 0 ? Math.ceil(gm.remaining / (savingsVelocity + simExtra)) : null;
                        const currentMonths = gm.remaining > 0 && savingsVelocity > 0 ? Math.ceil(gm.remaining / savingsVelocity) : null;
                        const monthsSaved = currentMonths && simMonthsLeft ? currentMonths - simMonthsLeft : 0;

                        return (
                            <motion.div key={gm.id} variants={fadeUp} className="card-wealth" style={{ padding: 0, overflow: 'hidden' }}>
                                <div style={{ display: 'flex', gap: 0 }}>
                                    {/* Image */}
                                    <div style={{ width: 140, minHeight: 160, flexShrink: 0, position: 'relative', overflow: 'hidden', background: 'linear-gradient(135deg, var(--bg-elevated), var(--bg-primary))' }}>
                                        {gm.goalImg ? (
                                            <img src={gm.goalImg} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                                        ) : (
                                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)', opacity: 0.2 }}><Target size={48} strokeWidth={1} /></div>
                                        )}
                                        <div style={{ position: 'absolute', top: 8, left: 8, padding: '3px 8px', borderRadius: 6, fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', background: PRIORITY_COLORS[gm.priority] + '20', color: PRIORITY_COLORS[gm.priority] }}>
                                            {gm.priority}
                                        </div>
                                    </div>

                                    {/* Info */}
                                    <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minWidth: 0 }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                                                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>{gm.name}</h3>
                                                <div style={{ display: 'flex', gap: 6 }}>
                                                    <button onClick={() => { openEdit(gm); }} className="onboarding-remove-btn" style={{ width: 28, height: 28, opacity: 0.5 }}><Edit3 size={12} /></button>
                                                    <button onClick={() => setShowAddSavings(gm)} className="btn-wealth" style={{ padding: '4px 12px', fontSize: 11 }}><PiggyBank size={12} /> Ahorrar</button>
                                                </div>
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                                <PrivacyAmount>
                                                    <span style={{ fontFamily: 'Space Grotesk', fontSize: 15, fontWeight: 700, color: 'var(--accent-primary)' }}>{formatCurrency(gm.currentAmount || 0)}</span>
                                                </PrivacyAmount>
                                                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>/ {formatCurrency(gm.targetAmount)}</span>
                                                <div style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: paceConf.bg, color: paceConf.color, display: 'flex', alignItems: 'center', gap: 3 }}>
                                                    <paceConf.icon size={10} />
                                                    {gm.pace === 'ahead' && gm.daysAhead > 0 ? `${gm.daysAhead}d adelantado` : gm.pace === 'behind' && gm.daysAhead < 0 ? `${Math.abs(gm.daysAhead)}d atrasado` : paceConf.label}
                                                </div>
                                            </div>

                                            {/* Progress Bar */}
                                            <div className="liquid-progress" style={{ height: 6, marginBottom: 12 }}>
                                                <motion.div className="liquid-progress-fill" style={{ background: paceConf.color === 'var(--danger)' ? 'var(--danger)' : 'var(--accent-gradient)' }}
                                                    initial={{ width: 0 }} animate={{ width: `${gm.progress}%` }} transition={{ duration: 1, ease: [.16, 1, .3, 1] }} />
                                            </div>

                                            {/* Metrics row */}
                                            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                                {[
                                                    { label: 'Completado', value: `${gm.progress}%` },
                                                    { label: 'Plazo', value: gm.days > 0 ? `${gm.days} días` : 'Vencido' },
                                                    { label: 'Req. mensual', value: formatCurrency(Math.round(gm.monthlyRequired)) },
                                                    { label: 'Velocidad', value: formatCurrency(Math.round(savingsVelocity)) },
                                                ].map(m => (
                                                    <div key={m.label} style={{ minWidth: 80 }}>
                                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{m.label}</div>
                                                        <div style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Space Grotesk' }}>{m.value}</div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Warning if behind */}
                                        {gm.pace === 'behind' && gm.monthlyRequired > savingsVelocity && (
                                            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: 'var(--danger-muted)', fontSize: 11, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                <AlertTriangle size={12} />
                                                Necesitas +{formatCurrency(Math.round(gm.monthlyRequired - savingsVelocity))}/mes para cumplir el plazo.
                                            </div>
                                        )}
                                    </div>

                                    {/* Big Percentage */}
                                    <div style={{ width: 90, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, borderLeft: '1px solid var(--border-secondary)', background: 'var(--bg-primary)' }}>
                                        <div style={{ textAlign: 'center' }}>
                                            <div style={{ fontFamily: 'Space Grotesk', fontSize: 32, fontWeight: 800, color: gm.progress >= 100 ? 'var(--success)' : 'var(--text-primary)', letterSpacing: '-0.03em' }}>{gm.progress}</div>
                                            <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase' }}>%</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Simulator Toggle */}
                                <button onClick={() => setExpandedSim(isSimOpen ? null : gm.id)} style={{
                                    width: '100%', padding: '8px 24px', background: 'var(--bg-elevated)', border: 'none', borderTop: '1px solid var(--border-secondary)',
                                    color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, transition: 'all 0.15s',
                                }}>
                                    <Zap size={12} /> Simular Aceleración {isSimOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                                </button>
                                <AnimatePresence>
                                    {isSimOpen && (
                                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden', borderTop: '1px solid var(--border-secondary)' }}>
                                            <div style={{ padding: '16px 24px', background: 'var(--bg-elevated)' }}>
                                                <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 10 }}>¿Cuánto extra podrías ahorrar al mes?</div>
                                                <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                                    {[25000, 50000, 100000, 200000].map(amt => (
                                                        <button key={amt} onClick={() => setSimExtra(amt)} style={{
                                                            padding: '6px 14px', borderRadius: 8, border: '1px solid', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                                            borderColor: simExtra === amt ? 'var(--accent-primary)' : 'var(--border-secondary)',
                                                            background: simExtra === amt ? 'rgba(0,229,195,0.08)' : 'transparent',
                                                            color: simExtra === amt ? 'var(--accent-primary)' : 'var(--text-muted)',
                                                        }}>+{formatCurrency(amt)}</button>
                                                    ))}
                                                </div>
                                                {monthsSaved > 0 ? (
                                                    <div style={{ padding: '10px 16px', borderRadius: 10, background: 'var(--success-muted)', fontSize: 13, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 8 }}>
                                                        <Zap size={14} />
                                                        <span>Con +{formatCurrency(simExtra)}/mes alcanzas esta meta <strong>{monthsSaved} mes{monthsSaved > 1 ? 'es' : ''} antes</strong>.</span>
                                                    </div>
                                                ) : (
                                                    <div style={{ padding: '10px 16px', borderRadius: 10, background: 'var(--bg-card)', fontSize: 12, color: 'var(--text-muted)' }}>
                                                        Registra más ahorros para obtener proyecciones precisas.
                                                    </div>
                                                )}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </motion.div>
                        );
                    })}
                </div>

                {/* ━━━━━ BLOCK 4: PRIORITY DISTRIBUTION ━━━━━ */}
                {goals.length > 1 && (
                    <motion.div variants={fadeUp} className="card-wealth" style={{ marginBottom: 24 }}>
                        <div className="card-header">
                            <div className="card-header-icon"><BarChart3 size={16} color="var(--accent-primary)" /></div>
                            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Distribución de Capital</h3>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                            {goalMetrics.map(gm => {
                                const pct = overview.totalTarget > 0 ? Math.round(((gm.currentAmount || 0) / overview.totalTarget) * 100) : 0;
                                return (
                                    <div key={gm.id}>
                                        <div className="flex-between" style={{ marginBottom: 4 }}>
                                            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{gm.name}</span>
                                            <span style={{ fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 700 }}>{pct}%</span>
                                        </div>
                                        <div className="liquid-progress" style={{ height: 6 }}>
                                            <motion.div className="liquid-progress-fill" style={{ background: PRIORITY_COLORS[gm.priority] || 'var(--accent-gradient)' }}
                                                initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: [.16, 1, .3, 1] }} />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </motion.div>
                )}

                {/* ━━━━━ BLOCK 5: INTELLIGENCE INSIGHTS ━━━━━ */}
                {insights.length > 0 && (
                    <motion.div variants={fadeUp} className="card-wealth" style={{ marginBottom: 24 }}>
                        <div className="card-header" style={{ marginBottom: 8 }}>
                            <div className="card-header-icon" style={{ background: 'rgba(0,229,195,0.06)' }}>
                                <Lightbulb size={16} color="var(--accent-primary)" />
                            </div>
                            <h3 style={{ fontSize: 14, fontWeight: 700 }}>Inteligencia de Metas</h3>
                        </div>
                        {insights.map((ins, i) => (
                            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderTop: i > 0 ? '1px solid var(--border-secondary)' : 'none' }}>
                                <ins.icon size={14} color="var(--accent-primary)" style={{ marginTop: 2, flexShrink: 0 }} />
                                <span style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{ins.msg}</span>
                            </div>
                        ))}
                    </motion.div>
                )}
            </>)}

            {/* ━━━━━ MODALS ━━━━━ */}
            <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingGoal ? 'Editar Meta' : 'Nueva Meta Financiera'}>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 24 }}><GoalImageUpload goalId={editingGoal?.id || 'new-goal-temp'} currentImageUrl={formData.imageUrl} onImageChange={(url) => setFormData({ ...formData, imageUrl: url || '' })} /></div>
                    <div className="form-group"><label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>NOMBRE DE LA META</label><div style={{ position: 'relative' }}><Type size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} /><input className="wealth-input" style={{ paddingLeft: 40 }} placeholder="Ej: Viaje a Japón" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required autoFocus /></div></div>
                    <div className="bento-grid" style={{ gridAutoRows: 'auto', gap: 16 }}>
                        <div className="bento-span-6 form-group"><label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>MONTO OBJETIVO</label><div style={{ position: 'relative' }}><DollarSign size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} /><input className="wealth-input" style={{ paddingLeft: 40 }} type="number" placeholder="0" value={formData.targetAmount} onChange={e => setFormData({ ...formData, targetAmount: e.target.value })} required min="1" /></div></div>
                        <div className="bento-span-6 form-group"><label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>FECHA LÍMITE</label><div style={{ position: 'relative' }}><Calendar size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} /><input className="wealth-input" style={{ paddingLeft: 40 }} type="date" value={formData.deadline} onChange={e => setFormData({ ...formData, deadline: e.target.value })} required /></div></div>
                    </div>
                    <div className="form-group"><label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>PRIORIDAD</label><div style={{ position: 'relative' }}><Tag size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} /><select className="wealth-input" style={{ paddingLeft: 40 }} value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })}><option value="alta">Alta (Urgente)</option><option value="media">Media (Importante)</option><option value="baja">Baja (Opcional)</option></select></div></div>
                    <div className="form-group" style={{ marginBottom: 32 }}><label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>DESCRIPCIÓN (OPCIONAL)</label><div style={{ position: 'relative' }}><FileText size={14} style={{ position: 'absolute', left: 14, top: 24, color: 'var(--text-muted)' }} /><textarea className="wealth-input" style={{ paddingLeft: 40, minHeight: 80, resize: 'none', paddingTop: 12 }} placeholder="Detalles..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} /></div></div>
                    <div className="form-actions" style={{ border: 'none', padding: 0 }}>
                        <button type="button" className="btn-wealth btn-wealth-outline" style={{ height: 48, paddingInline: 24 }} onClick={() => setShowForm(false)}>Cancelar</button>
                        <button type="submit" className="btn-wealth" style={{ flex: 1, height: 48, justifyContent: 'center' }}>{editingGoal ? 'Guardar Cambios' : 'Crear Meta'}</button>
                    </div>
                </form>
            </Modal>

            {/* Detail Modal */}
            <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title={showDetail?.name || ''}>
                {showDetail && (() => {
                    const gm = goalMetrics.find(g => g.id === showDetail.id) || showDetail;
                    const paceConf = PACE_CONFIG[gm.pace || 'unknown'];
                    const rec = calculateSavingsRecommendation(gm.remaining || (gm.targetAmount - (gm.currentAmount || 0)), gm.deadline);
                    return (
                        <div className="fade-and-slide">
                            {gm.goalImg && <div style={{ borderRadius: 12, overflow: 'hidden', height: 160, marginBottom: 24 }}><img src={gm.goalImg} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" /></div>}
                            <div style={{ display: 'flex', gap: 24, marginBottom: 24, alignItems: 'center' }}>
                                <WealthRing current={gm.currentAmount || 0} target={gm.targetAmount} size={100} strokeWidth={4} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                        <span style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: PRIORITY_COLORS[gm.priority] }}>{getPriorityLabel(gm.priority)}</span>
                                        <span style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 700, background: paceConf.bg, color: paceConf.color }}>{paceConf.label}</span>
                                    </div>
                                    <h2 className="font-title" style={{ fontSize: 20, marginBottom: 8 }}>{gm.name}</h2>
                                    <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>{gm.description || 'Sin descripción.'}</p>
                                </div>
                            </div>
                            <div className="bento-grid" style={{ gridAutoRows: 'auto', gap: 10, marginBottom: 20 }}>
                                {[{ l: 'Ahorrado', v: formatCurrency(gm.currentAmount || 0), c: 'var(--success)' }, { l: 'Objetivo', v: formatCurrency(gm.targetAmount) }, { l: 'Faltante', v: formatCurrency(Math.max(0, gm.targetAmount - (gm.currentAmount || 0))), c: 'var(--warning)' }].map(x => (
                                    <div key={x.l} className="bento-span-4 card-wealth" style={{ padding: 14 }}>
                                        <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 4 }}>{x.l}</div>
                                        <PrivacyAmount><div style={{ fontSize: 16, fontWeight: 700, fontFamily: 'Space Grotesk', color: x.c }}>{x.v}</div></PrivacyAmount>
                                    </div>
                                ))}
                            </div>
                            <div className="card-wealth" style={{ background: 'rgba(0,245,212,0.03)', borderColor: 'rgba(0,245,212,0.1)', marginBottom: 20 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <Clock size={20} color="var(--accent-primary)" />
                                    <div>
                                        <div style={{ fontSize: 13, fontWeight: 700 }}>Ahorro Recomendado</div>
                                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                            <PrivacyAmount><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(rec.weekly)}/semana</span></PrivacyAmount> o <PrivacyAmount><span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(rec.monthly)}/mes</span></PrivacyAmount>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="form-actions" style={{ marginTop: 24, border: 'none', padding: 0 }}>
                                <button className="btn-wealth btn-wealth-outline" onClick={() => handleDelete(showDetail.id)} style={{ color: 'var(--danger)', borderColor: 'rgba(255,93,93,0.2)' }}><Trash2 size={14} /> Eliminar</button>
                                <button className="btn-wealth btn-wealth-outline" onClick={() => { setShowDetail(null); openEdit(showDetail); }}><Edit3 size={14} /> Editar</button>
                                <button className="btn-wealth" style={{ flex: 1 }} onClick={() => { setShowDetail(null); setShowAddSavings(showDetail); }}><PiggyBank size={14} /> Ahorrar</button>
                            </div>
                        </div>
                    );
                })()}
            </Modal>

            {/* Savings Modal */}
            <Modal isOpen={!!showAddSavings} onClose={() => setShowAddSavings(null)} title="Añadir Ahorro">
                {showAddSavings && (
                    <form onSubmit={handleAddSavings}>
                        <div style={{ textAlign: 'center', marginBottom: 24 }}>
                            <WealthRing current={showAddSavings.currentAmount || 0} target={showAddSavings.targetAmount} size={120} />
                            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>{showAddSavings.name}</div>
                        </div>
                        <div className="form-group"><label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>¿CUÁNTO VAS A AHORRAR?</label><div style={{ position: 'relative' }}><DollarSign size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} /><input className="wealth-input" style={{ paddingLeft: 40 }} type="number" placeholder="0" value={savingsAmount} onChange={e => setSavingsAmount(e.target.value)} required autoFocus /></div></div>
                        <div className="form-actions" style={{ border: 'none', padding: 0, marginTop: 24 }}>
                            <button type="button" className="btn-wealth btn-wealth-outline" style={{ height: 48 }} onClick={() => setShowAddSavings(null)}>Cancelar</button>
                            <button type="submit" className="btn-wealth" style={{ flex: 1, height: 48, justifyContent: 'center' }}>Confirmar Ahorro</button>
                        </div>
                    </form>
                )}
            </Modal>
        </motion.div>
    );
}
