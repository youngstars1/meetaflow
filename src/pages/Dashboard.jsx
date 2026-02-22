import { useMemo, useCallback, useState } from 'react';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { usePrivacy, PrivacyAmount } from '../context/PrivacyContext';
import { useTheme } from '../context/ThemeContext';
import { SkeletonStatCards, SkeletonGoalCards } from '../components/Skeleton';
import {
    formatCurrency,
    getProgressPercentage,
    formatDateShort,
    formatDate,
} from '../utils/helpers';
import { calculateLevel, getLevelTitle, getXPForNextLevel, getLevelIcon, evaluateBadges, countEarnedBadges, BADGES } from '../utils/gamification';
import { generateDailyMissions, calculateDecisionMetrics, detectDayPatterns, detectCategoryTrends } from '../utils/patterns';
import { predictGoalCompletion, getGoalPaceStatus } from '../utils/projections';
import { time } from '../utils/timeEngine';
import EmailVerificationBanner from '../components/EmailVerification';
import {
    TrendingUp, TrendingDown, Target, Zap, Eye, EyeOff,
    PiggyBank, ArrowUpRight, ArrowDownRight, Award, Activity,
    Flame, Plus, ShieldCheck, Trophy, Gem, Crown, BarChart3,
    Wallet, Calendar, AlertTriangle, Info, CheckCircle,
    Shield, Receipt, Heart, ChevronRight, Sparkles, Brain,
    DollarSign, Repeat, Clock, ArrowRight, X
} from 'lucide-react';

const isIncome = (t) => t.type === 'income' || t.type === 'ingreso';
const isExpense = (t) => t.type === 'expense' || t.type === 'gasto';

const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.06 } },
};

const item = {
    hidden: { y: 12, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }
};

/* ─── Animated Number ─── */
function AnimNum({ value, duration = 800 }) {
    const [display, setDisplay] = useState(0);
    const ref = useMemo(() => ({ current: null }), []);

    useMemo(() => {
        let start = null;
        const animate = (ts) => {
            if (!start) start = ts;
            const p = Math.min((ts - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setDisplay(Math.round(eased * value));
            if (p < 1) requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }, [value, duration]);

    return <>{formatCurrency(display)}</>;
}

/* ─── Cash Flow Timeline ─── */
function CashFlowTimeline({ income, fixed, variable, available, goals }) {
    const nodes = [
        { label: 'Ingresos', value: income, color: '#00e5c3', icon: DollarSign },
        { label: 'Fijos', value: fixed, color: '#f04444', icon: Repeat },
        { label: 'Variables', value: variable, color: '#f5a623', icon: Wallet },
        { label: 'Disponible', value: available, color: '#60b8f0', icon: Shield },
        { label: 'Metas', value: goals, color: '#a855f7', icon: Target },
    ];

    return (
        <div className="dashboard-cashflow">
            {nodes.map((node, i) => (
                <div key={node.label} className="dashboard-cashflow-node">
                    <div className="dashboard-cashflow-circle" style={{ background: `${node.color}12`, borderColor: `${node.color}30` }}>
                        <node.icon size={14} color={node.color} />
                    </div>
                    <div className="dashboard-cashflow-info">
                        <span className="dashboard-cashflow-label">{node.label}</span>
                        <PrivacyAmount>
                            <span className="dashboard-cashflow-value" style={{ color: node.color }}>
                                {formatCurrency(node.value)}
                            </span>
                        </PrivacyAmount>
                    </div>
                    {i < nodes.length - 1 && <div className="dashboard-cashflow-arrow"><ChevronRight size={12} /></div>}
                </div>
            ))}
        </div>
    );
}

/* ─── Score Ring ─── */
function ScoreRing({ score, size = 72 }) {
    const radius = (size - 8) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (score / 100) * circumference;
    const color = score >= 70 ? '#00e5c3' : score >= 40 ? '#f5a623' : '#f04444';

    return (
        <div style={{ position: 'relative', width: size, height: size }}>
            <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
                <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="4" />
                <motion.circle
                    cx={size / 2} cy={size / 2} r={radius}
                    fill="none" stroke={color} strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    initial={{ strokeDashoffset: circumference }}
                    animate={{ strokeDashoffset: offset }}
                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                />
            </svg>
            <div style={{
                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
            }}>
                <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'Space Grotesk', color }}>{score}</span>
                <span style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Score</span>
            </div>
        </div>
    );
}

export default function Dashboard() {
    const { isDark } = useTheme();
    const { state, dispatch } = useApp();
    const { addToast } = useToast();
    const { isPrivate, togglePrivacy } = usePrivacy();
    const { goals, transactions, routines, gamification, isLoaded } = state;
    const fixedExpenses = state.fixedExpenses || [];
    const [quickAmount, setQuickAmount] = useState('');

    // ═════ FINANCIAL STATS ═════
    const stats = useMemo(() => {
        const income = transactions.filter(isIncome).reduce((s, t) => s + Math.abs(t.amount), 0);
        const expenses = transactions.filter(isExpense).reduce((s, t) => s + Math.abs(t.amount), 0);
        const totalSaved = goals.reduce((s, g) => s + (g.currentAmount || 0), 0);
        const fixedTotal = fixedExpenses.filter(e => e.active !== false).reduce((s, e) => {
            const amt = parseFloat(e.amount) || 0;
            if (e.frequency === 'weekly') return s + amt * 4.33;
            if (e.frequency === 'yearly') return s + amt / 12;
            return s + amt;
        }, 0);
        const balance = income - expenses;
        const available = Math.max(0, income - fixedTotal - (expenses - fixedTotal > 0 ? expenses - fixedTotal : expenses * 0.3));
        const savingsRate = income > 0 ? Math.round((balance / income) * 100) : 0;
        const pressureIndex = income > 0 ? Math.round((fixedTotal / income) * 100) : 0;
        const fixedPercent = income > 0 ? Math.round((fixedTotal / income) * 100) : 0;
        const savingsPercent = income > 0 ? Math.round((totalSaved / income) * 100) : 0;

        // Financial Score (0-100)
        let financialScore = 50;
        if (savingsRate > 20) financialScore += 15;
        else if (savingsRate > 10) financialScore += 8;
        if (pressureIndex < 50) financialScore += 15;
        else if (pressureIndex < 70) financialScore += 5;
        else financialScore -= 10;
        if (goals.length > 0) financialScore += 10;
        if (routines.length > 0) financialScore += 5;
        const bestStreak = Math.max(0, ...routines.map(r => r.streak || 0));
        if (bestStreak >= 7) financialScore += 5;
        financialScore = Math.max(0, Math.min(100, financialScore));

        // Status
        const totalExpenseRatio = income > 0 ? (fixedTotal + (expenses > fixedTotal ? expenses - fixedTotal : expenses * 0.3)) / income : 1;
        let status = 'stable';
        if (totalExpenseRatio > 0.9) status = 'risk';
        else if (totalExpenseRatio > 0.7) status = 'tight';

        return { income, expenses, totalSaved, balance, savingsRate, fixedTotal, available, pressureIndex, fixedPercent, savingsPercent, financialScore, status };
    }, [transactions, goals, fixedExpenses, routines]);

    // ═════ 3-MONTH PROJECTION ═════
    const projection90 = useMemo(() => {
        const monthlySavings = Math.max(0, stats.balance);
        return stats.totalSaved + monthlySavings * 3;
    }, [stats]);

    // ═════ GOALS WITH PREDICTIONS ═════
    const goalsWithPredictions = useMemo(() =>
        goals.filter(g => g.targetAmount > 0).slice(0, 4).map(goal => {
            const prediction = predictGoalCompletion(goal, transactions);
            const pace = getGoalPaceStatus(goal);
            const progress = getProgressPercentage(goal.currentAmount || 0, goal.targetAmount);
            return { ...goal, prediction, pace, progress };
        }),
        [goals, transactions]);

    // ═════ ROUTINES / DISCIPLINE ═════
    const discipline = useMemo(() => {
        const today = time.todayString();
        const total = routines.length;
        const completed = routines.filter(r => (r.completedDates || []).includes(today)).length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        const bestStreak = Math.max(0, ...routines.map(r => r.streak || 0));
        const currentStreak = routines.reduce((max, r) => Math.max(max, r.streak || 0), 0);
        return { total, completed, percent, bestStreak, currentStreak };
    }, [routines]);

    // ═════ GAMIFICATION ═════
    const level = useMemo(() => calculateLevel(gamification.totalXP), [gamification.totalXP]);
    const levelTitle = useMemo(() => getLevelTitle(level), [level]);
    const xpProgress = useMemo(() => getXPForNextLevel(gamification.totalXP), [gamification.totalXP]);
    const levelIcon = useMemo(() => getLevelIcon(level), [level]);

    // ═════ MISSIONS / FOCUS ═════
    const missions = useMemo(() => generateDailyMissions(state), [state]);
    const focusMission = useMemo(() => missions.find(m => !m.completed) || missions[0], [missions]);

    // ═════ INTELLIGENCE ═════
    const decisionMetrics = useMemo(() => calculateDecisionMetrics(transactions), [transactions]);
    const dayPatterns = useMemo(() => detectDayPatterns(transactions), [transactions]);
    const categoryTrends = useMemo(() => detectCategoryTrends(transactions), [transactions]);

    const insights = useMemo(() => {
        const all = [];
        // Fixed costs insight
        if (stats.pressureIndex > 0) {
            all.push({
                type: stats.pressureIndex > 70 ? 'warning' : 'info',
                message: `Tus gastos fijos representan el ${stats.pressureIndex}% de tu ingreso.`,
                icon: 'Repeat',
            });
        }
        // Category-specific insights
        categoryTrends.forEach(t => {
            all.push({ type: t.type === 'increase' ? 'warning' : 'success', icon: t.icon, message: t.message });
        });
        // Decision insights
        decisionMetrics.insights.forEach(i => all.push(i));
        // Day patterns
        dayPatterns.forEach(p => all.push({ type: 'info', icon: p.icon, message: p.message }));

        return all.slice(0, 3);
    }, [stats, categoryTrends, decisionMetrics, dayPatterns]);

    // ═════ ALERTS ═════
    const alerts = useMemo(() => {
        const a = [];
        if (stats.pressureIndex > 70) {
            a.push({ type: 'danger', message: `Gastos fijos superan el 70% de tu ingreso (${stats.pressureIndex}%)` });
        }
        categoryTrends.filter(t => t.type === 'increase').forEach(t => {
            a.push({ type: 'warning', message: t.message });
        });
        // Days without activity
        if (transactions.length > 0) {
            const lastTx = new Date(transactions[0]?.date || transactions[0]?.createdAt);
            const daysSince = Math.floor((new Date() - lastTx) / (1000 * 60 * 60 * 24));
            if (daysSince >= 5) {
                a.push({ type: 'warning', message: `${daysSince} días sin registrar actividad financiera` });
            }
        }
        return a.slice(0, 3);
    }, [stats, categoryTrends, transactions]);

    // ═════ RECENT TRANSACTIONS ═════
    const recentTransactions = useMemo(() => transactions.slice(0, 5), [transactions]);

    // Weekly comparison
    const weeklyComparison = useMemo(() => {
        const now = new Date();
        const oneWeekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
        const twoWeeksAgo = new Date(now - 14 * 24 * 60 * 60 * 1000);
        const thisWeek = transactions.filter(t => isExpense(t) && new Date(t.date) >= oneWeekAgo).reduce((s, t) => s + Math.abs(t.amount), 0);
        const lastWeek = transactions.filter(t => isExpense(t) && new Date(t.date) >= twoWeeksAgo && new Date(t.date) < oneWeekAgo).reduce((s, t) => s + Math.abs(t.amount), 0);
        if (lastWeek === 0) return null;
        const diff = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
        return diff;
    }, [transactions]);

    // ═════ MONTHLY HEATMAP ═════
    const heatmapData = useMemo(() => {
        const today = new Date();
        const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        const data = [];
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = new Date(today.getFullYear(), today.getMonth(), d).toDateString();
            const hasActivity = routines.some(r => (r.completedDates || []).includes(dateStr));
            const isFuture = d > today.getDate();
            data.push({ day: d, active: hasActivity, future: isFuture, today: d === today.getDate() });
        }
        return data;
    }, [routines]);

    const handleQuickTransaction = useCallback((type) => {
        const amount = parseFloat(quickAmount);
        if (!amount || amount <= 0) { addToast('Ingresa un monto válido', { type: 'warning' }); return; }
        dispatch({
            type: 'ADD_TRANSACTION',
            payload: {
                amount,
                type: type === 'ingreso' ? 'ingreso' : 'gasto',
                category: type === 'ingreso' ? 'otros_ingresos' : 'otros_gastos',
                note: 'Registro rápido',
                date: new Date().toISOString(),
            }
        });
        addToast(
            type === 'ingreso' ? `Ingreso: ${formatCurrency(amount)}` : `Gasto: ${formatCurrency(amount)}`,
            { type: type === 'ingreso' ? 'success' : 'info', xpAmount: 10 }
        );
        setQuickAmount('');
    }, [quickAmount, dispatch, addToast]);

    if (!isLoaded) {
        return <div className="page-content"><SkeletonStatCards /><SkeletonGoalCards /></div>;
    }

    const statusConfig = {
        stable: { label: 'Estable', color: '#00e5c3', bg: 'rgba(0,229,195,0.08)', border: 'rgba(0,229,195,0.15)', emoji: '🟢' },
        tight: { label: 'Ajustado', color: '#f5a623', bg: 'rgba(245,166,35,0.08)', border: 'rgba(245,166,35,0.15)', emoji: '🟡' },
        risk: { label: 'Riesgo', color: '#f04444', bg: 'rgba(240,68,68,0.08)', border: 'rgba(240,68,68,0.15)', emoji: '🔴' },
    };
    const currentStatus = statusConfig[stats.status];

    return (
        <motion.div className="page-content" variants={container} initial="hidden" animate="show">
            <EmailVerificationBanner />

            {/* ═══════ ALERTS ═══════ */}
            {alerts.length > 0 && (
                <motion.div variants={item} className="dashboard-alerts">
                    <div className="dashboard-alerts-header">
                        <AlertTriangle size={14} />
                        <span>Alertas</span>
                    </div>
                    {alerts.map((alert, i) => (
                        <div key={i} className={`dashboard-alert-item dashboard-alert-${alert.type}`}>
                            <span>{alert.message}</span>
                        </div>
                    ))}
                </motion.div>
            )}

            {/* ═══════ BLOCK 1 — FINANCIAL STATUS HERO ═══════ */}
            <motion.div variants={item} className="dashboard-hero-card">
                <div className="dashboard-hero-left">
                    <div className="dashboard-hero-label">Saldo Real Disponible</div>
                    <PrivacyAmount>
                        <div className="dashboard-hero-balance">
                            {formatCurrency(stats.available)}
                        </div>
                    </PrivacyAmount>
                    <div className="dashboard-hero-metrics">
                        <div className="dashboard-hero-metric">
                            <span className="dashboard-hero-metric-label">Ingresos</span>
                            <PrivacyAmount>
                                <span className="dashboard-hero-metric-value" style={{ color: 'var(--success)' }}>
                                    +{formatCurrency(stats.income)}
                                </span>
                            </PrivacyAmount>
                        </div>
                        <div className="dashboard-hero-metric">
                            <span className="dashboard-hero-metric-label">Gastos</span>
                            <PrivacyAmount>
                                <span className="dashboard-hero-metric-value" style={{ color: 'var(--danger)' }}>
                                    -{formatCurrency(stats.expenses)}
                                </span>
                            </PrivacyAmount>
                        </div>
                        <div className="dashboard-hero-metric">
                            <span className="dashboard-hero-metric-label">Ahorro Proyectado</span>
                            <PrivacyAmount>
                                <span className="dashboard-hero-metric-value" style={{ color: '#a855f7' }}>
                                    {formatCurrency(stats.totalSaved)}
                                </span>
                            </PrivacyAmount>
                        </div>
                    </div>
                </div>
                <div className="dashboard-hero-right">
                    <div className="dashboard-status-badge" style={{
                        background: currentStatus.bg,
                        borderColor: currentStatus.border,
                        color: currentStatus.color,
                    }}>
                        <span>{currentStatus.emoji}</span>
                        <span>{currentStatus.label}</span>
                    </div>
                    <button
                        onClick={togglePrivacy}
                        className="dashboard-privacy-btn"
                        aria-label={isPrivate ? 'Mostrar montos' : 'Ocultar montos'}
                    >
                        {isPrivate ? <EyeOff size={14} /> : <Eye size={14} />}
                        {isPrivate ? 'Mostrar' : 'Ocultar'}
                    </button>
                </div>

                {/* Cash Flow Timeline */}
                <CashFlowTimeline
                    income={stats.income}
                    fixed={stats.fixedTotal}
                    variable={Math.max(0, stats.expenses - stats.fixedTotal)}
                    available={stats.available}
                    goals={stats.totalSaved}
                />

                {/* Watermarks */}
                <div className="dashboard-hero-watermark">METAFLOW</div>
            </motion.div>

            {/* ═══════ BENTO GRID ═══════ */}
            <div className="bento-grid" style={{ marginTop: 24 }}>

                {/* ═══════ BLOCK 2A — PRESSURE INDEX ═══════ */}
                <motion.div variants={item} className="card-wealth bento-span-6">
                    <div className="card-header">
                        <div className="card-header-icon" style={{ background: 'var(--warning-muted)' }}>
                            <BarChart3 size={16} color="var(--warning)" />
                        </div>
                        <h3 style={{ fontSize: 14, flex: 1 }}>Presión & Score Financiero</h3>
                        <span className={`stat-pill ${stats.pressureIndex > 70 ? 'negative' : stats.pressureIndex > 50 ? 'neutral' : 'positive'}`} style={{ fontSize: 10 }}>
                            {stats.pressureIndex}% Presión
                        </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                        <ScoreRing score={stats.financialScore} />
                        <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>% Gastos Fijos</div>
                                    <div className="liquid-progress" style={{ height: 5 }}>
                                        <motion.div className="liquid-progress-fill"
                                            style={{ background: stats.fixedPercent > 70 ? 'var(--danger)' : stats.fixedPercent > 50 ? 'var(--warning)' : 'var(--success)' }}
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(100, stats.fixedPercent)}%` }}
                                            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                                        />
                                    </div>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{stats.fixedPercent}%</div>
                                </div>
                                <div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>% Tasa de Ahorro</div>
                                    <div className="liquid-progress" style={{ height: 5 }}>
                                        <motion.div className="liquid-progress-fill"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${Math.min(100, Math.max(0, stats.savingsRate))}%` }}
                                            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                                        />
                                    </div>
                                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{stats.savingsRate}%</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* ═══════ BLOCK 2B — 3-MONTH PROJECTION ═══════ */}
                <motion.div variants={item} className="card-wealth bento-span-6">
                    <div className="card-header">
                        <div className="card-header-icon" style={{ background: 'var(--info-muted)' }}>
                            <TrendingUp size={16} color="var(--info)" />
                        </div>
                        <h3 style={{ fontSize: 14 }}>Proyección a 90 Días</h3>
                    </div>
                    <div style={{ textAlign: 'center', padding: '8px 0' }}>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.7, marginBottom: 16 }}>
                            Si mantienes este ritmo,<br />tu capital será:
                        </p>
                        <PrivacyAmount>
                            <div style={{
                                fontSize: 36, fontWeight: 800, fontFamily: 'Space Grotesk',
                                background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text',
                                WebkitTextFillColor: 'transparent', letterSpacing: '-0.03em', lineHeight: 1,
                            }}>
                                {formatCurrency(projection90)}
                            </div>
                        </PrivacyAmount>
                        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 12 }}>
                            en 90 días
                        </p>
                    </div>
                </motion.div>

                {/* ═══════ BLOCK 3 — FOCUS TODAY ═══════ */}
                <motion.div variants={item} className="card-wealth bento-span-4">
                    <div className="card-header">
                        <div className="card-header-icon" style={{ background: 'rgba(245,166,35,0.08)' }}>
                            <Flame size={16} color="#f5a623" />
                        </div>
                        <h3 style={{ fontSize: 14 }}>Foco del Día</h3>
                    </div>
                    {focusMission ? (
                        <div style={{ textAlign: 'center', padding: '8px 0' }}>
                            <div style={{
                                fontSize: 44, fontWeight: 800, fontFamily: 'Space Grotesk',
                                color: discipline.percent === 100 ? 'var(--success)' : 'var(--text-primary)',
                                letterSpacing: '-0.03em', lineHeight: 1, marginBottom: 8,
                            }}>
                                {discipline.percent}%
                            </div>
                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
                                {discipline.completed} de {discipline.total} completados
                            </div>
                            <div style={{
                                padding: '12px 16px', borderRadius: 10,
                                background: focusMission.completed ? 'var(--success-muted)' : 'var(--bg-elevated)',
                                border: `1px solid ${focusMission.completed ? 'var(--success-subtle)' : 'var(--border-secondary)'}`,
                                marginBottom: 12,
                            }}>
                                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
                                    {focusMission.title}
                                </div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{focusMission.description}</div>
                                <span className="stat-pill positive" style={{ fontSize: 9, marginTop: 8, display: 'inline-flex' }}>
                                    +{focusMission.xp} XP
                                </span>
                            </div>
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 13 }}>
                            Crea rutinas para activar tu foco diario.
                        </div>
                    )}
                </motion.div>

                {/* ═══════ BLOCK 3B — QUICK ACTION ═══════ */}
                <motion.div variants={item} className="card-wealth bento-span-4">
                    <div className="card-header">
                        <div className="card-header-icon" style={{ background: 'var(--success-muted)' }}>
                            <Plus size={16} color="var(--accent-primary)" />
                        </div>
                        <h3 style={{ fontSize: 14 }}>Acción Rápida</h3>
                    </div>
                    <input
                        type="number"
                        className="wealth-input"
                        placeholder="Monto..."
                        value={quickAmount}
                        onChange={e => setQuickAmount(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleQuickTransaction('ingreso')}
                        style={{ marginBottom: 12 }}
                    />
                    <div style={{ display: 'flex', gap: 8 }}>
                        <button className="btn-wealth" style={{ flex: 1, fontSize: 12, justifyContent: 'center' }} onClick={() => handleQuickTransaction('ingreso')}>
                            <ArrowUpRight size={14} /> Ingreso
                        </button>
                        <button className="btn-wealth btn-wealth-outline" style={{ flex: 1, fontSize: 12, justifyContent: 'center', borderColor: 'var(--danger-subtle)', color: 'var(--danger)' }} onClick={() => handleQuickTransaction('gasto')}>
                            <ArrowDownRight size={14} /> Gasto
                        </button>
                    </div>
                </motion.div>

                {/* ═══════ BLOCK 4A — DISCIPLINE & PROGRESS ═══════ */}
                <motion.div variants={item} className="card-wealth bento-span-4 shimmer-metal">
                    <div className="card-header">
                        <div className="card-header-icon" style={{ background: 'var(--success-muted)' }}>
                            <Award size={16} color="var(--accent-primary)" />
                        </div>
                        <h3 style={{ fontSize: 14 }}>Disciplina & Progreso</h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <span style={{ fontSize: 32 }}>{levelIcon}</span>
                        <div>
                            <div style={{ fontSize: 17, fontWeight: 700, fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>{levelTitle}</div>
                            <div style={{ fontSize: 12, color: 'var(--accent-primary)', fontWeight: 500 }}>Nivel {level} · {gamification.totalXP.toLocaleString()} XP</div>
                        </div>
                    </div>
                    <div className="liquid-progress" style={{ height: 6, marginBottom: 8 }}>
                        <motion.div className="liquid-progress-fill"
                            initial={{ width: 0 }}
                            animate={{ width: `${xpProgress.progress}%` }}
                            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                        />
                    </div>
                    <div className="flex-between" style={{ marginBottom: 16 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{xpProgress.current} / {xpProgress.needed} XP</span>
                    </div>

                    {/* Streak */}
                    <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderTop: '1px solid var(--border-secondary)' }}>
                        <div style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
                                🔥 {discipline.currentStreak}
                            </div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Racha Actual</div>
                        </div>
                        <div style={{ width: 1, background: 'var(--border-secondary)' }} />
                        <div style={{ flex: 1, textAlign: 'center' }}>
                            <div style={{ fontSize: 22, fontWeight: 800, fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>
                                🏆 {discipline.bestStreak}
                            </div>
                            <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Mejor Racha</div>
                        </div>
                    </div>

                    {/* Mini Heatmap */}
                    <div style={{ paddingTop: 12, borderTop: '1px solid var(--border-secondary)' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Actividad del Mes</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
                            {heatmapData.map(d => (
                                <div key={d.day} style={{
                                    aspectRatio: '1', borderRadius: 3,
                                    background: d.future ? 'transparent' : d.active ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                                    border: d.today ? '1.5px solid var(--accent-primary)' : d.future ? '1px solid rgba(255,255,255,0.03)' : 'none',
                                    opacity: d.future ? 0.3 : d.active ? 1 : 0.4,
                                }} title={`Día ${d.day}`} />
                            ))}
                        </div>
                    </div>
                </motion.div>

                {/* ═══════ BLOCK 4 — INTELLIGENT GOALS ═══════ */}
                <motion.div variants={item} className="card-wealth bento-span-8">
                    <div className="flex-between" style={{ marginBottom: 20 }}>
                        <div className="card-header" style={{ marginBottom: 0 }}>
                            <div className="card-header-icon" style={{ background: 'var(--success-muted)' }}>
                                <Target size={16} color="var(--accent-primary)" />
                            </div>
                            <h3 style={{ fontSize: 14 }}>Metas Inteligentes</h3>
                        </div>
                        <span className="stat-pill neutral">{goals.length} metas</span>
                    </div>
                    {goalsWithPredictions.length === 0 ? (
                        <div className="empty-state" style={{ padding: '40px 20px' }}>
                            <Target size={32} className="empty-state-icon" />
                            <h2 style={{ fontSize: 16 }}>Sin metas aún</h2>
                            <p style={{ fontSize: 13 }}>Crea tu primera meta para empezar a construir tu futuro financiero.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
                            {goalsWithPredictions.map(goal => {
                                const paceColor = goal.pace === 'ahead' ? 'var(--success)' : goal.pace === 'on-track' ? 'var(--info)' : goal.pace === 'behind' ? 'var(--danger)' : 'var(--text-muted)';
                                const paceLabel = goal.pace === 'ahead' ? 'Adelantado' : goal.pace === 'on-track' ? 'En tiempo' : goal.pace === 'behind' ? 'Atrasado' : goal.pace === 'completed' ? '¡Completado!' : '–';
                                return (
                                    <div key={goal.id} style={{
                                        padding: '16px', borderRadius: 12,
                                        background: 'var(--bg-elevated)', border: '1px solid var(--border-secondary)',
                                        transition: 'all 0.15s',
                                    }}>
                                        <div className="flex-between" style={{ marginBottom: 8 }}>
                                            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '60%' }}>
                                                {goal.name}
                                            </span>
                                            <span style={{
                                                fontSize: 13, fontFamily: 'Space Grotesk', fontWeight: 700,
                                                color: goal.progress >= 100 ? 'var(--success)' : 'var(--text-secondary)',
                                            }}>
                                                {goal.progress}%
                                            </span>
                                        </div>
                                        <div className="liquid-progress" style={{ height: 4, marginBottom: 10 }}>
                                            <motion.div className="liquid-progress-fill"
                                                initial={{ width: 0 }}
                                                animate={{ width: `${Math.min(100, goal.progress)}%` }}
                                                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                                            />
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                                            <PrivacyAmount>{formatCurrency(goal.currentAmount || 0)}</PrivacyAmount>
                                            {' / '}
                                            <PrivacyAmount>{formatCurrency(goal.targetAmount)}</PrivacyAmount>
                                        </div>
                                        {goal.prediction && !goal.prediction.insufficient && !goal.prediction.completed && (
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>
                                                <Clock size={10} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                                Est: {formatDate(goal.prediction.projectedDate)}
                                            </div>
                                        )}
                                        <div style={{
                                            display: 'inline-flex', alignItems: 'center', gap: 4,
                                            fontSize: 10, fontWeight: 600, color: paceColor,
                                            background: `${paceColor}12`, padding: '2px 8px', borderRadius: 20,
                                        }}>
                                            {goal.prediction?.daysAhead > 0 && <TrendingUp size={10} />}
                                            {goal.prediction?.daysAhead < 0 && <TrendingDown size={10} />}
                                            {paceLabel}
                                            {goal.prediction?.daysAhead !== undefined && goal.prediction.daysAhead !== 0 && !goal.prediction.completed && (
                                                <span>({Math.abs(goal.prediction.daysAhead)}d)</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </motion.div>

                {/* ═══════ BLOCK 5 — FINANCIAL INTELLIGENCE ═══════ */}
                <motion.div variants={item} className="card-wealth bento-span-6">
                    <div className="card-header">
                        <div className="card-header-icon" style={{ background: 'rgba(168,85,247,0.08)' }}>
                            <Brain size={16} color="#a855f7" />
                        </div>
                        <h3 style={{ fontSize: 14 }}>Inteligencia Financiera</h3>
                    </div>

                    {insights.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {insights.map((insight, i) => {
                                const insightColor = insight.type === 'warning' ? 'var(--danger)' : insight.type === 'success' ? 'var(--success)' : 'var(--info)';
                                const insightBg = insight.type === 'warning' ? 'var(--danger-muted)' : insight.type === 'success' ? 'var(--success-muted)' : 'var(--info-muted)';
                                return (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 10,
                                        padding: '10px 12px', borderRadius: 10,
                                        background: insightBg,
                                        fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6,
                                    }}>
                                        <Sparkles size={14} color={insightColor} style={{ flexShrink: 0, marginTop: 3 }} />
                                        {insight.message}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                            Registra más movimientos para activar insights de inteligencia financiera.
                        </div>
                    )}
                </motion.div>

                {/* ═══════ BLOCK 7 — RECENT ACTIVITY ═══════ */}
                <motion.div variants={item} className="card-wealth bento-span-6">
                    <div className="flex-between" style={{ marginBottom: 20 }}>
                        <div className="card-header" style={{ marginBottom: 0 }}>
                            <div className="card-header-icon" style={{ background: 'var(--info-muted)' }}>
                                <Wallet size={16} color="var(--info)" />
                            </div>
                            <h3 style={{ fontSize: 14 }}>Actividad Reciente</h3>
                        </div>
                        {weeklyComparison !== null && (
                            <span className={`stat-pill ${weeklyComparison <= 0 ? 'positive' : 'negative'}`} style={{ fontSize: 10 }}>
                                {weeklyComparison <= 0 ? <TrendingDown size={10} /> : <TrendingUp size={10} />}
                                {Math.abs(weeklyComparison)}% vs sem. pasada
                            </span>
                        )}
                    </div>

                    {recentTransactions.length === 0 ? (
                        <div className="empty-state" style={{ padding: '32px 20px' }}>
                            <Activity size={28} className="empty-state-icon" style={{ opacity: 0.15 }} />
                            <p style={{ fontSize: 13, marginTop: 12, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                                Tu progreso comienza con tu primer movimiento registrado.
                            </p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {recentTransactions.map(t => (
                                <div key={t.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '10px 12px', borderRadius: 10,
                                    transition: 'background 0.15s',
                                }}>
                                    <div style={{
                                        width: 32, height: 32, borderRadius: 10,
                                        background: isIncome(t) ? 'var(--success-muted)' : 'var(--danger-muted)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    }}>
                                        {isIncome(t) ? <ArrowUpRight size={14} color="var(--success)" /> :
                                            <ArrowDownRight size={14} color="var(--danger)" />}
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{t.note || t.category || 'Sin nota'}</div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                            {t.category} · {formatDateShort(t.date || t.createdAt)}
                                        </div>
                                    </div>
                                    <PrivacyAmount>
                                        <span style={{
                                            fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 14,
                                            color: isIncome(t) ? 'var(--success)' : 'var(--danger)',
                                        }}>
                                            {isExpense(t) ? '-' : '+'}{formatCurrency(Math.abs(t.amount))}
                                        </span>
                                    </PrivacyAmount>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>
            </div>
        </motion.div>
    );
}
