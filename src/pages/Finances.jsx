import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { usePrivacy, PrivacyAmount } from '../context/PrivacyContext';
import Modal from '../components/Modal';
import { SkeletonTransactions } from '../components/Skeleton';
import {
    formatCurrency,
    formatDate,
    formatDateShort,
    getTransactionCategories,
} from '../utils/helpers';
import { time } from '../utils/timeEngine';
import {
    classifyExpense, EXPENSE_TYPES,
    calculateDecisionMetrics, detectCategoryTrends, detectDayPatterns,
} from '../utils/patterns';
import {
    Plus, Trash2, ArrowUpRight, ArrowDownRight, Wallet,
    Search, PiggyBank, Calendar, FileText, Tag, DollarSign,
    Target, AlertTriangle, TrendingUp, TrendingDown, Shield,
    ChevronRight, Activity, BarChart3, Zap, X, Eye, EyeOff,
    ArrowRight, Lightbulb, Repeat, Filter, Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Constants ────────────────────────────────────────────────
const MONTH_NAMES = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

const RANGE_OPTIONS = [
    { key: 'month', label: 'Este Mes' },
    { key: '30d', label: '30 días' },
    { key: '7d', label: '7 días' },
    { key: 'all', label: 'Todo' },
];

const CATEGORY_ICONS = {
    alimentacion: '🍽️', transporte: '🚗', entretenimiento: '🎬',
    servicios: '⚡', educacion: '📚', salud: '💊', ropa: '👕',
    hogar: '🏠', otros_gastos: '📦', salario: '💰', freelance: '💻',
    negocio: '🏢', inversiones: '📈', otros_ingresos: '💵',
    ahorro_meta: '🎯',
};

const FREQUENCIES = [
    { value: 'weekly', multiplier: 4.33 },
    { value: 'monthly', multiplier: 1 },
    { value: 'yearly', multiplier: 1 / 12 },
];

const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const item = {
    hidden: { y: 16, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};

// ─── Category label helper ────────────────────────────────────
function getCategoryLabel(type, category) {
    const cats = getTransactionCategories(type);
    return cats.find(c => c.value === category)?.label || category || '—';
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FINANCES — Premium Financial Control Center
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function Finances() {
    const { state, dispatch } = useApp();
    const { addToast } = useToast();
    const { transactions, goals, fixedExpenses = [], profile = {}, isLoaded } = state;

    // ─── Form State ──────────────────────────────────
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        type: 'gasto', amount: '', category: '', date: new Date().toISOString().split('T')[0], note: '', goalId: '',
    });

    // ─── Filter State ────────────────────────────────
    const [range, setRange] = useState('month');
    const [filterCategory, setFilterCategory] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [includeRecurring, setIncludeRecurring] = useState(true);
    const [activeTypeFilter, setActiveTypeFilter] = useState('todos');
    const searchTimeout = useRef(null);
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Debounce search
    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => setDebouncedSearch(searchQuery), 250);
        return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
    }, [searchQuery]);

    // ─── Time Boundaries ─────────────────────────────
    const now = time.now();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const monthLabel = `${MONTH_NAMES[currentMonth]} ${currentYear}`;

    const rangeBoundary = useMemo(() => {
        const n = time.now();
        switch (range) {
            case 'month': return time.startOfMonth();
            case '30d': { const d = new Date(n); d.setDate(d.getDate() - 30); return d; }
            case '7d': { const d = new Date(n); d.setDate(d.getDate() - 7); return d; }
            default: return new Date(0);
        }
    }, [range]);

    // ─── Monthly Income (from profile) ───────────────
    const monthlyIncome = useMemo(() => {
        return (profile.incomeSources || []).reduce((s, src) => s + (parseFloat(src.amount) || 0), 0);
    }, [profile.incomeSources]);

    // ─── Fixed Expenses Total (monthly) ──────────────
    const totalFixedMonthly = useMemo(() => {
        return (fixedExpenses || []).filter(e => e.active !== false).reduce((sum, e) => {
            const amt = parseFloat(e.amount) || 0;
            const freq = FREQUENCIES.find(f => f.value === e.frequency);
            return sum + amt * (freq?.multiplier || 1);
        }, 0);
    }, [fixedExpenses]);

    // ─── Month Transactions ──────────────────────────
    const monthTransactions = useMemo(() => {
        const start = time.startOfMonth();
        return transactions.filter(t => new Date(t.date || t.createdAt) >= start);
    }, [transactions]);

    // ─── Variable Expenses This Month ────────────────
    const variableExpenses = useMemo(() => {
        return monthTransactions.filter(t => t.type === 'gasto').reduce((s, t) => s + t.amount, 0);
    }, [monthTransactions]);

    // ─── Income This Month (from transactions) ───────
    const transactionIncome = useMemo(() => {
        return monthTransactions.filter(t => t.type === 'ingreso').reduce((s, t) => s + t.amount, 0);
    }, [monthTransactions]);

    // ─── Savings This Month ──────────────────────────
    const monthlySavings = useMemo(() => {
        return monthTransactions.filter(t => t.type === 'ahorro').reduce((s, t) => s + t.amount, 0);
    }, [monthTransactions]);

    // ─── Real Available Balance ──────────────────────
    const effectiveIncome = useMemo(() => Math.max(monthlyIncome, transactionIncome), [monthlyIncome, transactionIncome]);
    const realAvailable = useMemo(() => effectiveIncome - totalFixedMonthly - variableExpenses - monthlySavings, [effectiveIncome, totalFixedMonthly, variableExpenses, monthlySavings]);

    // ─── Financial Status ────────────────────────────
    const totalExpenseRatio = useMemo(() => {
        return effectiveIncome > 0 ? ((totalFixedMonthly + variableExpenses) / effectiveIncome) * 100 : 0;
    }, [totalFixedMonthly, variableExpenses, effectiveIncome]);

    const financialStatus = useMemo(() => {
        if (totalExpenseRatio <= 60) return { label: 'Estable', color: 'var(--success)', bg: 'var(--success-muted)', border: 'var(--success-subtle)', icon: Shield };
        if (totalExpenseRatio <= 80) return { label: 'Ajustado', color: 'var(--warning)', bg: 'var(--warning-muted)', border: 'var(--warning-subtle)', icon: AlertTriangle };
        return { label: 'Riesgo', color: 'var(--danger)', bg: 'var(--danger-muted)', border: 'var(--danger-subtle)', icon: AlertTriangle };
    }, [totalExpenseRatio]);

    // ─── Pressure Index ──────────────────────────────
    const fixedPressure = useMemo(() => effectiveIncome > 0 ? Math.round((totalFixedMonthly / effectiveIncome) * 100) : 0, [totalFixedMonthly, effectiveIncome]);
    const totalPressure = useMemo(() => Math.round(totalExpenseRatio), [totalExpenseRatio]);
    const financialScore = useMemo(() => {
        let score = 100;
        score -= Math.max(0, totalPressure - 50);
        score -= fixedPressure > 70 ? 20 : fixedPressure > 50 ? 10 : 0;
        if (monthlySavings > 0) score += 5;
        return Math.max(0, Math.min(100, score));
    }, [totalPressure, fixedPressure, monthlySavings]);

    // ─── Smart Alerts ────────────────────────────────
    const alerts = useMemo(() => {
        const a = [];
        if (fixedPressure > 70) a.push({ severity: 'danger', message: `Costos fijos al ${fixedPressure}% del ingreso. Supera el 70% recomendado.` });
        else if (fixedPressure > 50) a.push({ severity: 'warning', message: `Costos fijos al ${fixedPressure}%. Acercándose al límite recomendado.` });

        const trends = detectCategoryTrends(transactions);
        const increasing = trends.filter(t => t.type === 'increase');
        if (increasing.length > 0) {
            const top = increasing[0];
            a.push({ severity: 'warning', message: `${getCategoryLabel('gasto', top.category)} aumentó ${top.change}% vs mes pasado.` });
        }

        const lastTx = transactions[0];
        if (lastTx) {
            const daysSince = time.daysSince(lastTx.date || lastTx.createdAt);
            if (daysSince >= 4) a.push({ severity: 'warning', message: `No registras movimientos hace ${daysSince} días.` });
        } else if (transactions.length === 0) {
            a.push({ severity: 'warning', message: 'Aún no has registrado movimientos. Comienza hoy.' });
        }

        if (realAvailable < 0) a.push({ severity: 'danger', message: 'Tu saldo disponible es negativo. Revisa tus gastos.' });
        return a.slice(0, 3);
    }, [fixedPressure, transactions, realAvailable]);

    // ─── Decision Metrics ────────────────────────────
    const decisionMetrics = useMemo(() => calculateDecisionMetrics(monthTransactions), [monthTransactions]);

    // ─── Filtered Transactions ───────────────────────
    const filteredTransactions = useMemo(() => {
        let list = transactions.filter(t => new Date(t.date || t.createdAt) >= rangeBoundary);
        if (activeTypeFilter !== 'todos') list = list.filter(t => t.type === activeTypeFilter);
        if (filterCategory) list = list.filter(t => t.category === filterCategory);
        if (debouncedSearch) {
            const q = debouncedSearch.toLowerCase();
            list = list.filter(t =>
                (t.note && t.note.toLowerCase().includes(q)) ||
                (t.category && t.category.toLowerCase().includes(q)) ||
                getCategoryLabel(t.type, t.category).toLowerCase().includes(q)
            );
        }
        return list;
    }, [transactions, rangeBoundary, activeTypeFilter, filterCategory, debouncedSearch]);

    // ─── Previous Period Comparison ──────────────────
    const previousPeriodMap = useMemo(() => {
        const periodMs = time.now() - rangeBoundary;
        const prevStart = new Date(rangeBoundary.getTime() - periodMs);
        const prevEnd = rangeBoundary;
        const prevTx = transactions.filter(t => {
            const d = new Date(t.date || t.createdAt);
            return d >= prevStart && d < prevEnd;
        });
        const map = {};
        prevTx.forEach(t => {
            const cat = t.category || 'otros';
            if (t.type === 'gasto') {
                map[cat] = (map[cat] || 0) + t.amount;
            }
        });
        return map;
    }, [transactions, rangeBoundary]);

    const currentPeriodCategoryMap = useMemo(() => {
        const map = {};
        filteredTransactions.forEach(t => {
            const cat = t.category || 'otros';
            if (t.type === 'gasto') {
                map[cat] = (map[cat] || 0) + t.amount;
            }
        });
        return map;
    }, [filteredTransactions]);

    // ─── Available Categories (for filter) ───────────
    const availableCategories = useMemo(() => {
        const cats = new Set();
        transactions.forEach(t => { if (t.category) cats.add(t.category); });
        return Array.from(cats);
    }, [transactions]);

    // ─── Handlers ────────────────────────────────────
    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        const amount = Number(formData.amount);
        if (!amount || amount <= 0) { addToast('Ingresa un monto válido', { type: 'warning' }); return; }
        const transaction = {
            type: formData.type,
            amount,
            category: formData.category,
            date: formData.date ? new Date(formData.date).toISOString() : new Date().toISOString(),
            note: formData.note,
        };
        dispatch({ type: 'ADD_TRANSACTION', payload: transaction });
        if (formData.type === 'ahorro' && formData.goalId) {
            dispatch({ type: 'ADD_SAVINGS_TO_GOAL', payload: { goalId: formData.goalId, amount } });
        }
        addToast(`Registro guardado: ${formatCurrency(amount)}`, { type: 'success' });
        setFormData({ type: 'gasto', amount: '', category: '', date: new Date().toISOString().split('T')[0], note: '', goalId: '' });
        setShowForm(false);
    }, [formData, dispatch, addToast]);

    const handleDelete = useCallback((id) => {
        dispatch({ type: 'DELETE_TRANSACTION', payload: id });
        addToast('Movimiento eliminado', {
            type: 'warning',
            action: { label: 'Deshacer', onClick: () => dispatch({ type: 'UNDO_LAST' }) },
        });
    }, [dispatch, addToast]);

    const typeLabels = { ingreso: 'INGRESO', gasto: 'GASTO', ahorro: 'AHORRO' };

    // ─── Loading ─────────────────────────────────────
    if (!isLoaded) return <div className="page-content"><SkeletonTransactions /></div>;

    // ═══════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════
    return (
        <motion.div className="page-content" variants={container} initial="hidden" animate="show">

            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                BLOCK 1 — FINANCIAL MONTH HERO
               ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <motion.div variants={item} className="dashboard-hero-card shimmer-metal" style={{ marginBottom: 24 }}>
                <div className="dashboard-hero-watermark">$</div>

                {/* Status & Month */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
                    <div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 6 }}>
                            Control Financiero · {monthLabel}
                        </div>
                        <div className="dashboard-hero-label">SALDO DISPONIBLE REAL</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="dashboard-status-badge" style={{ background: financialStatus.bg, borderColor: financialStatus.border, color: financialStatus.color }}>
                            <financialStatus.icon size={13} />
                            {financialStatus.label}
                        </div>
                        <button className="btn-wealth" onClick={() => setShowForm(true)} style={{ padding: '8px 16px', fontSize: 12 }}>
                            <Plus size={14} /> Registrar
                        </button>
                    </div>
                </div>

                {/* Hero Balance */}
                <PrivacyAmount>
                    <motion.div
                        className="dashboard-hero-balance"
                        style={{ color: realAvailable >= 0 ? 'var(--text-primary)' : 'var(--danger)' }}
                        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    >
                        {formatCurrency(realAvailable)}
                    </motion.div>
                </PrivacyAmount>

                {/* Metrics Row */}
                <div className="dashboard-hero-metrics" style={{ marginBottom: 0 }}>
                    <div className="dashboard-hero-metric">
                        <span className="dashboard-hero-metric-label">Ingreso</span>
                        <PrivacyAmount>
                            <span className="dashboard-hero-metric-value" style={{ color: 'var(--success)' }}>
                                {formatCurrency(effectiveIncome)}
                            </span>
                        </PrivacyAmount>
                    </div>
                    <div className="dashboard-hero-metric">
                        <span className="dashboard-hero-metric-label">Gastos Fijos</span>
                        <PrivacyAmount>
                            <span className="dashboard-hero-metric-value" style={{ color: 'var(--danger)' }}>
                                −{formatCurrency(totalFixedMonthly)}
                            </span>
                        </PrivacyAmount>
                    </div>
                    <div className="dashboard-hero-metric">
                        <span className="dashboard-hero-metric-label">Variables</span>
                        <PrivacyAmount>
                            <span className="dashboard-hero-metric-value" style={{ color: 'var(--warning)' }}>
                                −{formatCurrency(variableExpenses)}
                            </span>
                        </PrivacyAmount>
                    </div>
                    <div className="dashboard-hero-metric">
                        <span className="dashboard-hero-metric-label">Ahorro</span>
                        <PrivacyAmount>
                            <span className="dashboard-hero-metric-value" style={{ color: 'var(--accent-primary)' }}>
                                {formatCurrency(monthlySavings)}
                            </span>
                        </PrivacyAmount>
                    </div>
                </div>

                {/* Cash Flow Timeline */}
                <div className="dashboard-cashflow">
                    {[
                        { label: 'Ingreso', value: effectiveIncome, color: 'var(--success)', icon: <ArrowUpRight size={13} /> },
                        { label: 'Fijos', value: totalFixedMonthly, color: 'var(--danger)', icon: <Repeat size={13} /> },
                        { label: 'Variables', value: variableExpenses, color: 'var(--warning)', icon: <ArrowDownRight size={13} /> },
                        { label: 'Disponible', value: realAvailable, color: realAvailable >= 0 ? 'var(--accent-primary)' : 'var(--danger)', icon: <Wallet size={13} /> },
                        { label: 'Metas', value: monthlySavings, color: 'var(--accent-secondary)', icon: <Target size={13} /> },
                    ].map((node, i, arr) => (
                        <div key={node.label} className="dashboard-cashflow-node">
                            <div className="dashboard-cashflow-circle" style={{ borderColor: node.color, color: node.color }}>
                                {node.icon}
                            </div>
                            <div className="dashboard-cashflow-info">
                                <span className="dashboard-cashflow-label">{node.label}</span>
                                <PrivacyAmount>
                                    <span className="dashboard-cashflow-value" style={{ color: node.color }}>
                                        {formatCurrency(Math.abs(node.value))}
                                    </span>
                                </PrivacyAmount>
                            </div>
                            {i < arr.length - 1 && (
                                <div className="dashboard-cashflow-arrow"><ChevronRight size={14} /></div>
                            )}
                        </div>
                    ))}
                </div>
            </motion.div>


            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                BLOCK 2 — PRESSURE + ALERTS
               ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <div className="bento-grid" style={{ marginBottom: 24 }}>
                {/* Left: Pressure Index */}
                <motion.div variants={item} className="card-wealth bento-span-5">
                    <div className="card-header">
                        <div className="card-header-icon" style={{ background: totalPressure > 70 ? 'var(--danger-muted)' : totalPressure > 50 ? 'var(--warning-muted)' : 'var(--success-muted)' }}>
                            <BarChart3 size={16} color={totalPressure > 70 ? 'var(--danger)' : totalPressure > 50 ? 'var(--warning)' : 'var(--success)'} />
                        </div>
                        <h3 style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>Presión Financiera</h3>
                    </div>

                    {/* Score ring + metrics */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
                        {/* Mini ring */}
                        <div style={{ position: 'relative', width: 80, height: 80, flexShrink: 0 }}>
                            <svg width="80" height="80" viewBox="0 0 80 80">
                                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--bg-elevated)" strokeWidth="6" />
                                <motion.circle
                                    cx="40" cy="40" r="34" fill="none"
                                    stroke={financialScore >= 70 ? 'var(--success)' : financialScore >= 40 ? 'var(--warning)' : 'var(--danger)'}
                                    strokeWidth="6"
                                    strokeLinecap="round"
                                    strokeDasharray={`${2 * Math.PI * 34}`}
                                    initial={{ strokeDashoffset: 2 * Math.PI * 34 }}
                                    animate={{ strokeDashoffset: 2 * Math.PI * 34 * (1 - financialScore / 100) }}
                                    transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                                    transform="rotate(-90 40 40)"
                                />
                            </svg>
                            <div style={{
                                position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
                                alignItems: 'center', justifyContent: 'center',
                            }}>
                                <span style={{
                                    fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 800,
                                    color: financialScore >= 70 ? 'var(--success)' : financialScore >= 40 ? 'var(--warning)' : 'var(--danger)',
                                }}>{financialScore}</span>
                                <span style={{ fontSize: 8, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Score</span>
                            </div>
                        </div>

                        {/* Metrics */}
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 12 }}>
                            {/* Fixed % */}
                            <div>
                                <div className="flex-between" style={{ marginBottom: 4 }}>
                                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Costos Fijos</span>
                                    <span style={{ fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 700, color: fixedPressure > 70 ? 'var(--danger)' : fixedPressure > 50 ? 'var(--warning)' : 'var(--text-primary)' }}>
                                        {fixedPressure}%
                                    </span>
                                </div>
                                <div className="liquid-progress" style={{ height: 4 }}>
                                    <motion.div className="liquid-progress-fill"
                                        style={{ background: fixedPressure > 70 ? 'var(--danger)' : fixedPressure > 50 ? 'var(--warning)' : 'var(--accent-gradient)' }}
                                        initial={{ width: 0 }} animate={{ width: `${Math.min(100, fixedPressure)}%` }}
                                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                                    />
                                </div>
                            </div>
                            {/* Total % */}
                            <div>
                                <div className="flex-between" style={{ marginBottom: 4 }}>
                                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Gastos Totales</span>
                                    <span style={{ fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 700, color: totalPressure > 80 ? 'var(--danger)' : totalPressure > 60 ? 'var(--warning)' : 'var(--text-primary)' }}>
                                        {totalPressure}%
                                    </span>
                                </div>
                                <div className="liquid-progress" style={{ height: 4 }}>
                                    <motion.div className="liquid-progress-fill"
                                        style={{ background: totalPressure > 80 ? 'var(--danger)' : totalPressure > 60 ? 'var(--warning)' : 'var(--accent-gradient)' }}
                                        initial={{ width: 0 }} animate={{ width: `${Math.min(100, totalPressure)}%` }}
                                        transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                                    />
                                </div>
                            </div>
                            {/* Impulse Index */}
                            <div>
                                <div className="flex-between" style={{ marginBottom: 4 }}>
                                    <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Índice Impulsivo</span>
                                    <span style={{ fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 700, color: decisionMetrics.impulseIndex > 30 ? 'var(--danger)' : 'var(--text-primary)' }}>
                                        {decisionMetrics.impulseIndex}%
                                    </span>
                                </div>
                                <div className="liquid-progress" style={{ height: 4 }}>
                                    <motion.div className="liquid-progress-fill"
                                        style={{ background: decisionMetrics.impulseIndex > 30 ? 'var(--danger)' : decisionMetrics.impulseIndex > 15 ? 'var(--warning)' : 'var(--accent-gradient)' }}
                                        initial={{ width: 0 }} animate={{ width: `${Math.min(100, decisionMetrics.impulseIndex)}%` }}
                                        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </motion.div>

                {/* Right: Smart Alerts */}
                <motion.div variants={item} className="card-wealth bento-span-7">
                    <div className="card-header">
                        <div className="card-header-icon" style={{ background: alerts.length > 0 ? 'var(--warning-muted)' : 'var(--success-muted)' }}>
                            <Activity size={16} color={alerts.length > 0 ? 'var(--warning)' : 'var(--success)'} />
                        </div>
                        <h3 style={{ fontSize: 14, fontWeight: 700, flex: 1 }}>Alertas Inteligentes</h3>
                        {alerts.length > 0 && (
                            <span style={{
                                fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 999,
                                background: 'var(--danger-muted)', color: 'var(--danger)', letterSpacing: '0.05em',
                            }}>{alerts.length}</span>
                        )}
                    </div>

                    {alerts.length === 0 ? (
                        <div style={{ padding: '20px 0', textAlign: 'center' }}>
                            <Shield size={24} style={{ color: 'var(--success)', marginBottom: 8 }} />
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Todo en orden. Sin alertas activas.</div>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {alerts.map((alert, i) => (
                                <motion.div
                                    key={i}
                                    className={`dashboard-alert-item dashboard-alert-${alert.severity}`}
                                    initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.08, duration: 0.4 }}
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <AlertTriangle size={13} />
                                        <span>{alert.message}</span>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}

                    {/* Insights from Decision Engine */}
                    {decisionMetrics.insights.length > 0 && (
                        <div style={{ marginTop: 16, paddingTop: 12, borderTop: '1px solid var(--border-secondary)' }}>
                            {decisionMetrics.insights.slice(0, 2).map((insight, i) => (
                                <div key={i} style={{
                                    display: 'flex', alignItems: 'flex-start', gap: 8, padding: '8px 0',
                                    fontSize: 12, color: insight.type === 'success' ? 'var(--success)' : insight.type === 'warning' ? 'var(--warning)' : 'var(--info)',
                                }}>
                                    <Lightbulb size={13} style={{ marginTop: 1, flexShrink: 0 }} />
                                    <span style={{ lineHeight: 1.5 }}>{insight.message}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>
            </div>


            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                BLOCK 3 — INTELLIGENT FILTERS
               ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <motion.div variants={item} className="card-wealth" style={{ marginBottom: 24, padding: '16px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                    {/* Range Selector */}
                    <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', borderRadius: 10, padding: 3 }}>
                        {RANGE_OPTIONS.map(opt => (
                            <button
                                key={opt.key}
                                onClick={() => setRange(opt.key)}
                                style={{
                                    padding: '6px 14px', borderRadius: 8, border: 'none',
                                    background: range === opt.key ? 'var(--accent-primary)' : 'transparent',
                                    color: range === opt.key ? '#0a0a0b' : 'var(--text-muted)',
                                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                            >{opt.label}</button>
                        ))}
                    </div>

                    {/* Type Tabs */}
                    <div style={{ display: 'flex', gap: 4, background: 'var(--bg-elevated)', borderRadius: 10, padding: 3 }}>
                        {[
                            { key: 'todos', label: 'Todos' },
                            { key: 'ingreso', label: 'Ingresos' },
                            { key: 'gasto', label: 'Gastos' },
                            { key: 'ahorro', label: 'Ahorros' },
                        ].map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTypeFilter(tab.key)}
                                style={{
                                    padding: '6px 14px', borderRadius: 8, border: 'none',
                                    background: activeTypeFilter === tab.key ? 'var(--accent-primary)' : 'transparent',
                                    color: activeTypeFilter === tab.key ? '#0a0a0b' : 'var(--text-muted)',
                                    fontSize: 12, fontWeight: 600, cursor: 'pointer',
                                    transition: 'all 0.15s ease',
                                }}
                            >{tab.label}</button>
                        ))}
                    </div>

                    {/* Spacer */}
                    <div style={{ flex: 1 }} />

                    {/* Category Filter */}
                    <div style={{ position: 'relative' }}>
                        <Filter size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <select
                            className="wealth-input"
                            style={{ paddingLeft: 30, paddingRight: 12, fontSize: 12, height: 34, minWidth: 140, background: 'var(--bg-elevated)', border: '1px solid var(--border-secondary)' }}
                            value={filterCategory}
                            onChange={e => setFilterCategory(e.target.value)}
                        >
                            <option value="">Todas las categorías</option>
                            {availableCategories.map(cat => (
                                <option key={cat} value={cat}>{getCategoryLabel('gasto', cat)}</option>
                            ))}
                        </select>
                    </div>

                    {/* Search */}
                    <div style={{ position: 'relative' }}>
                        <Search size={13} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                        <input
                            className="wealth-input"
                            style={{ paddingLeft: 30, fontSize: 12, height: 34, width: 180, background: 'var(--bg-elevated)', border: '1px solid var(--border-secondary)' }}
                            placeholder="Buscar movimientos..."
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                        />
                        {searchQuery && (
                            <button
                                onClick={() => setSearchQuery('')}
                                style={{
                                    position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                                    background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 2,
                                }}
                            ><X size={12} /></button>
                        )}
                    </div>

                    {/* Include Recurring Toggle */}
                    <button
                        onClick={() => setIncludeRecurring(!includeRecurring)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 5,
                            padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border-secondary)',
                            background: includeRecurring ? 'var(--accent-primary)' : 'var(--bg-elevated)',
                            color: includeRecurring ? '#0a0a0b' : 'var(--text-muted)',
                            fontSize: 11, fontWeight: 600, cursor: 'pointer',
                            transition: 'all 0.15s',
                        }}
                        title="Incluir gastos recurrentes"
                    >
                        <Repeat size={12} /> Fijos
                    </button>
                </div>

                {/* Active Filters Summary */}
                {(filterCategory || debouncedSearch || activeTypeFilter !== 'todos') && (
                    <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: 'var(--text-muted)' }}>
                        <span>Mostrando {filteredTransactions.length} resultado{filteredTransactions.length !== 1 ? 's' : ''}</span>
                        {(filterCategory || debouncedSearch) && (
                            <button
                                onClick={() => { setFilterCategory(''); setSearchQuery(''); setActiveTypeFilter('todos'); }}
                                style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', cursor: 'pointer', fontSize: 11, fontWeight: 600 }}
                            >Limpiar filtros</button>
                        )}
                    </div>
                )}
            </motion.div>


            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                BLOCK 4 — CONTEXTUAL TRANSACTIONS
               ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <motion.div variants={item}>
                {filteredTransactions.length === 0 ? (
                    /* ── PREMIUM EMPTY STATE ── */
                    <div className="card-wealth" style={{ textAlign: 'center', padding: '64px 32px' }}>
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <div style={{
                                width: 72, height: 72, borderRadius: 20, margin: '0 auto 24px',
                                background: 'var(--success-muted)', display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                            }}>
                                <Activity size={32} color="var(--accent-primary)" strokeWidth={1.5} />
                            </div>
                            <h2 style={{ fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>
                                Tu progreso financiero comienza con tu primer movimiento.
                            </h2>
                            <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: 420, margin: '0 auto 32px', lineHeight: 1.7 }}>
                                Cada registro mejora tus proyecciones financieras y entrena a tu asistente de inteligencia.
                            </p>
                            <button className="btn-wealth" onClick={() => setShowForm(true)} style={{ padding: '14px 32px', fontSize: 14 }}>
                                <Plus size={16} /> Registrar Primer Movimiento
                            </button>
                            <div style={{
                                marginTop: 32, padding: '14px 20px', borderRadius: 12,
                                background: 'rgba(0, 229, 195, 0.04)', border: '1px solid rgba(0, 229, 195, 0.08)',
                                display: 'inline-flex', alignItems: 'center', gap: 8,
                                fontSize: 12, color: 'var(--text-secondary)', maxWidth: 460,
                            }}>
                                <Lightbulb size={14} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
                                Usuarios que registran 5 movimientos en su primera semana duplican su tasa de ahorro.
                            </div>
                        </motion.div>
                    </div>
                ) : (
                    /* ── TRANSACTION LIST ── */
                    <div className="card-wealth" style={{ padding: 0, overflow: 'hidden' }}>
                        <AnimatePresence mode="popLayout">
                            {filteredTransactions.map((t, idx) => {
                                const isExpense = t.type === 'gasto';
                                const isIncome = t.type === 'ingreso';
                                const catLabel = getCategoryLabel(t.type, t.category);
                                const catIcon = CATEGORY_ICONS[t.category] || '📦';
                                const classification = isExpense ? classifyExpense(t.category) : null;
                                const expenseType = classification ? EXPENSE_TYPES[classification.toUpperCase()] : null;

                                // Previous period comparison
                                let comparison = null;
                                if (isExpense && t.category && previousPeriodMap[t.category] && currentPeriodCategoryMap[t.category]) {
                                    const prev = previousPeriodMap[t.category];
                                    const curr = currentPeriodCategoryMap[t.category];
                                    const change = prev > 0 ? Math.round(((curr - prev) / prev) * 100) : 0;
                                    if (Math.abs(change) >= 10) {
                                        comparison = { change, up: change > 0 };
                                    }
                                }

                                // Goal link
                                const linkedGoal = t.type === 'ahorro' ? goals.find(g => g.id === t.goalId) : null;

                                return (
                                    <motion.div
                                        key={t.id}
                                        layout
                                        initial={{ opacity: 0, y: 8 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, x: -20, height: 0 }}
                                        transition={{ delay: Math.min(idx * 0.02, 0.3), duration: 0.35 }}
                                        style={{
                                            padding: '18px 24px',
                                            borderBottom: '1px solid var(--border-secondary)',
                                            display: 'flex', alignItems: 'center', gap: 16,
                                            transition: 'background 0.15s',
                                        }}
                                        className="tx-row"
                                    >
                                        {/* Icon */}
                                        <div style={{
                                            width: 42, height: 42, borderRadius: 12,
                                            background: isIncome ? 'var(--success-muted)' : isExpense ? 'var(--danger-muted)' : 'rgba(0, 229, 195, 0.06)',
                                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                                            fontSize: 18, flexShrink: 0,
                                        }}>
                                            {catIcon}
                                        </div>

                                        {/* Info */}
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                    {t.note || catLabel}
                                                </span>
                                                {expenseType && (
                                                    <span style={{
                                                        fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 4,
                                                        background: `${expenseType.color}15`, color: expenseType.color,
                                                        letterSpacing: '0.04em', textTransform: 'uppercase', flexShrink: 0,
                                                    }}>{expenseType.label}</span>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, fontSize: 11, color: 'var(--text-muted)' }}>
                                                <span>{time.relative(t.date || t.createdAt)}</span>
                                                <span style={{ opacity: 0.3 }}>·</span>
                                                <span>{catLabel}</span>
                                                {linkedGoal && (
                                                    <>
                                                        <span style={{ opacity: 0.3 }}>·</span>
                                                        <span style={{ color: 'var(--accent-primary)', fontWeight: 500 }}>
                                                            <Target size={10} style={{ verticalAlign: 'text-bottom', marginRight: 3 }} />
                                                            {linkedGoal.name}
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                        </div>

                                        {/* Amount + Context */}
                                        <div style={{ textAlign: 'right', flexShrink: 0 }}>
                                            <PrivacyAmount>
                                                <div style={{
                                                    fontFamily: 'Space Grotesk', fontSize: 16, fontWeight: 700,
                                                    color: isExpense ? 'var(--danger)' : 'var(--success)',
                                                    letterSpacing: '-0.01em',
                                                }}>
                                                    {isExpense ? '−' : '+'}{formatCurrency(t.amount)}
                                                </div>
                                            </PrivacyAmount>
                                            {comparison && (
                                                <div style={{
                                                    fontSize: 10, fontWeight: 600, marginTop: 2,
                                                    color: comparison.up ? 'var(--danger)' : 'var(--success)',
                                                    display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 3,
                                                }}>
                                                    {comparison.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                                                    {comparison.up ? '↑' : '↓'} {Math.abs(comparison.change)}% vs periodo anterior
                                                </div>
                                            )}
                                        </div>

                                        {/* Delete */}
                                        <button
                                            onClick={() => handleDelete(t.id)}
                                            className="onboarding-remove-btn"
                                            style={{ width: 30, height: 30, flexShrink: 0, opacity: 0.4 }}
                                            title="Eliminar"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>

                        {/* Result Count Footer */}
                        <div style={{
                            padding: '12px 24px',
                            fontSize: 11, color: 'var(--text-muted)',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        }}>
                            <span>{filteredTransactions.length} movimiento{filteredTransactions.length !== 1 ? 's' : ''}</span>
                            <button className="btn-wealth" onClick={() => setShowForm(true)} style={{ padding: '6px 14px', fontSize: 11 }}>
                                <Plus size={12} /> Nuevo
                            </button>
                        </div>
                    </div>
                )}
            </motion.div>


            {/* ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                MODAL — New Transaction Form
               ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ */}
            <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Nuevo Movimiento">
                <form onSubmit={handleSubmit}>
                    {/* Type Selector */}
                    <div className="form-group">
                        <label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>TIPO DE REGISTRO</label>
                        <div style={{ display: 'flex', gap: 8, background: 'var(--bg-elevated)', padding: 4, borderRadius: 12 }}>
                            {['ingreso', 'gasto', 'ahorro'].map(type => (
                                <button key={type} type="button" className="btn-wealth" style={{
                                    flex: 1, border: 'none',
                                    background: formData.type === type ? 'var(--accent-primary)' : 'transparent',
                                    color: formData.type === type ? '#0a0a0b' : 'var(--text-muted)',
                                    boxShadow: formData.type === type ? '0 0 15px rgba(0, 245, 212, 0.2)' : 'none',
                                    transition: 'all 0.2s ease',
                                }} onClick={() => setFormData({ ...formData, type, category: '' })}>
                                    {typeLabels[type]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Amount + Date */}
                    <div className="bento-grid" style={{ gridAutoRows: 'auto', gap: 16 }}>
                        <div className="bento-span-6 form-group">
                            <label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>MONTO</label>
                            <div style={{ position: 'relative' }}>
                                <DollarSign size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input className="wealth-input" style={{ paddingLeft: 40 }} type="number" placeholder="0"
                                    value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                    required min="1"
                                />
                            </div>
                        </div>
                        <div className="bento-span-6 form-group">
                            <label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>FECHA</label>
                            <div style={{ position: 'relative' }}>
                                <Calendar size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input className="wealth-input" style={{ paddingLeft: 40 }} type="date"
                                    value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })}
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    {/* Category */}
                    <div className="form-group">
                        <label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>CATEGORÍA</label>
                        <div style={{ position: 'relative' }}>
                            <Tag size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                            <select className="wealth-input" style={{ paddingLeft: 40 }}
                                value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}
                                required
                            >
                                <option value="">Selecciona una categoría...</option>
                                {getTransactionCategories(formData.type).map(cat => (
                                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Goal Link (Savings only) */}
                    {formData.type === 'ahorro' && (
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>VINCULAR A META</label>
                            <div style={{ position: 'relative' }}>
                                <Target size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                                <select className="wealth-input" style={{ paddingLeft: 40 }}
                                    value={formData.goalId} onChange={e => setFormData({ ...formData, goalId: e.target.value })}
                                >
                                    <option value="">Ninguna meta específica</option>
                                    {goals.map(g => (
                                        <option key={g.id} value={g.id}>{g.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    {/* Note */}
                    <div className="form-group" style={{ marginBottom: 32 }}>
                        <label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>NOTA (OPCIONAL)</label>
                        <div style={{ position: 'relative' }}>
                            <FileText size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input className="wealth-input" style={{ paddingLeft: 40 }} placeholder="¿Qué registraste?"
                                value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="form-actions" style={{ border: 'none', padding: 0 }}>
                        <button type="button" className="btn-wealth btn-wealth-outline" style={{ height: 48, paddingInline: 24 }} onClick={() => setShowForm(false)}>Cancelar</button>
                        <button type="submit" className="btn-wealth" style={{ flex: 1, height: 48, justifyContent: 'center' }}>Guardar Movimiento</button>
                    </div>
                </form>
            </Modal>
        </motion.div>
    );
}
