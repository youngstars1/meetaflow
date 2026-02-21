import { useMemo, memo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { SkeletonChart } from '../components/Skeleton';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, LineChart, Line, AreaChart, Area, Legend,
} from 'recharts';
import {
    formatCurrency,
    getProgressPercentage,
    getTransactionCategories
} from '../utils/helpers';
import { TrendingUp, PieChart as PieIcon, Activity, BarChart3, Target, Zap, Database } from 'lucide-react';
import { motion } from 'framer-motion';

const isIncome = (t) => t.type === 'income' || t.type === 'ingreso';
const isExpense = (t) => t.type === 'expense' || t.type === 'gasto';
const isSavings = (t) => t.type === 'savings' || t.type === 'ahorro';

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.06, delayChildren: 0.1 }
    },
};

const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
};

const CHART_COLORS = [
    '#00e5c3', '#60b8f0', '#f5a623', '#f04444', '#a78bfa',
    '#34d399', '#f472b6', '#60a5fa', '#fbbf24', '#fb923c'
];

// ===== Memoized Chart Wrappers =====
const MemoizedBarChart = memo(function MemoBarChart({ data }) {
    if (!data || data.length === 0) return <EmptyChart message="Sin datos suficientes para el gráfico de barras" />;
    return (
        <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data} barGap={6}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="month" tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                    contentStyle={{
                        background: '#1a1a1b', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 10, color: '#fff', fontSize: 12, boxShadow: '0 8px 32px rgba(0,0,0,0.4)'
                    }}
                    formatter={(value) => formatCurrency(value)}
                />
                <Legend wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }} />
                <Bar dataKey="ingresos" fill="#00e5c3" radius={[4, 4, 0, 0]} name="Ingresos" />
                <Bar dataKey="gastos" fill="#f04444" radius={[4, 4, 0, 0]} name="Gastos" />
            </BarChart>
        </ResponsiveContainer>
    );
});

const MemoizedPieChart = memo(function MemoPieChart({ data }) {
    if (!data || data.length === 0) return <EmptyChart message="Sin gastos categorizados aún" />;
    return (
        <ResponsiveContainer width="100%" height={280}>
            <PieChart>
                <Pie
                    data={data}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={3}
                    dataKey="value"
                    stroke="none"
                >
                    {data.map((_, idx) => (
                        <Cell key={`pie-${idx}`} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                    ))}
                </Pie>
                <Tooltip
                    contentStyle={{
                        background: '#1a1a1b', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 10, color: '#fff', fontSize: 12
                    }}
                    formatter={(v) => formatCurrency(v)}
                />
                <Legend
                    wrapperStyle={{ fontSize: 11, color: '#a1a1aa' }}
                    formatter={(value) => value.length > 14 ? value.slice(0, 14) + '...' : value}
                />
            </PieChart>
        </ResponsiveContainer>
    );
});

const MemoizedAreaChart = memo(function MemoAreaChart({ data }) {
    if (!data || data.length === 0) return <EmptyChart message="Sin datos de tendencia disponibles" />;
    return (
        <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data}>
                <defs>
                    <linearGradient id="gradientSavings" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#00e5c3" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#00e5c3" stopOpacity={0} />
                    </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="month" tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#52525b', fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip
                    contentStyle={{
                        background: '#1a1a1b', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 10, color: '#fff', fontSize: 12
                    }}
                    formatter={(v) => formatCurrency(v)}
                />
                <Area type="monotone" dataKey="ahorro" stroke="#00e5c3" fill="url(#gradientSavings)" strokeWidth={2} name="Ahorro" />
            </AreaChart>
        </ResponsiveContainer>
    );
});

const MemoizedGoalProgress = memo(function MemoGoalProgress({ goals }) {
    if (!goals || goals.length === 0) return <EmptyChart message="Sin metas activas para mostrar" />;
    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
            {goals.map(goal => {
                const progress = getProgressPercentage(goal.currentAmount || 0, goal.targetAmount);
                return (
                    <div key={goal.id}>
                        <div className="flex-between" style={{ marginBottom: 8 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>
                                {goal.name}
                            </span>
                            <span style={{ fontSize: 11, color: 'var(--accent-primary)', fontFamily: 'Space Grotesk', fontWeight: 600 }}>
                                {progress}%
                            </span>
                        </div>
                        <div className="liquid-progress" style={{ height: 8 }}>
                            <div
                                className="liquid-progress-fill"
                                style={{ width: `${Math.min(100, progress)}%` }}
                            />
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4 }}>
                            {formatCurrency(goal.currentAmount || 0)} / {formatCurrency(goal.targetAmount)}
                        </div>
                    </div>
                );
            })}
        </div>
    );
});

const MemoizedHabitChart = memo(function MemoHabitChart({ data }) {
    if (!data || data.length === 0) return <EmptyChart message="Sin datos de hábitos esta semana" />;
    return (
        <ResponsiveContainer width="100%" height={280}>
            <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" />
                <XAxis dataKey="day" tick={{ fill: '#52525b', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#52525b', fontSize: 10 }} domain={[0, 100]} unit="%" axisLine={false} tickLine={false} />
                <Tooltip
                    contentStyle={{
                        background: '#1a1a1b', border: '1px solid rgba(255,255,255,0.08)',
                        borderRadius: 10, color: '#fff', fontSize: 12
                    }}
                    formatter={(v) => `${v}%`}
                />
                <Line type="monotone" dataKey="compliance" stroke="#60b8f0" strokeWidth={2} dot={{ r: 3, fill: '#60b8f0' }} name="Cumplimiento" />
            </LineChart>
        </ResponsiveContainer>
    );
});

function EmptyChart({ message }) {
    return (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
            <Database size={32} style={{ opacity: 0.2, marginBottom: 12 }} />
            <p style={{ fontSize: 13 }}>{message}</p>
        </div>
    );
}

// ===== "ChartCard" wrapper for premium look =====
function ChartCard({ icon: Icon, title, subtitle, children, gridSpan = 'bento-span-6' }) {
    return (
        <motion.div variants={item} className={`card-wealth shimmer-metal ${gridSpan}`}>
            <div style={{ marginBottom: 20 }}>
                <div className="card-header">
                    <div className="card-header-icon" style={{ background: 'var(--info-muted)' }}>
                        {Icon && <Icon size={16} color="var(--info)" />}
                    </div>
                    <div>
                        <h3 style={{ fontSize: 14 }}>{title}</h3>
                        {subtitle && <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</p>}
                    </div>
                </div>
            </div>
            {children}
        </motion.div>
    );
}

function Statistics() {
    const { state } = useApp();
    const { goals, transactions, routines, isLoaded } = state;

    // ===== MEMOIZED CALCULATIONS =====
    const monthlyData = useMemo(() => {
        if (transactions.length === 0) return [];
        const byMonth = {};
        transactions.forEach(t => {
            const d = new Date(t.date || t.createdAt);
            const key = d.toLocaleString('es-CL', { month: 'short', year: '2-digit' });
            if (!byMonth[key]) byMonth[key] = { month: key, ingresos: 0, gastos: 0, ahorro: 0 };
            if (isIncome(t)) byMonth[key].ingresos += Math.abs(t.amount);
            else if (isExpense(t)) byMonth[key].gastos += Math.abs(t.amount);
            else if (isSavings(t)) byMonth[key].ahorro += Math.abs(t.amount);
        });
        return Object.values(byMonth).slice(-6);
    }, [transactions]);

    const categoryData = useMemo(() => {
        const expenses = transactions.filter(isExpense);
        if (expenses.length === 0) return [];
        const cats = {};
        expenses.forEach(t => {
            const cat = t.category || 'Otros';
            cats[cat] = (cats[cat] || 0) + Math.abs(t.amount);
        });
        return Object.entries(cats)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value)
            .slice(0, 8);
    }, [transactions]);

    const savingsTrend = useMemo(() => {
        return monthlyData.map(m => ({
            month: m.month,
            ahorro: m.ingresos - m.gastos,
        }));
    }, [monthlyData]);

    const habitData = useMemo(() => {
        if (routines.length === 0) return [];
        const days = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
        const today = new Date();
        return Array.from({ length: 7 }, (_, i) => {
            const d = new Date(today);
            d.setDate(d.getDate() - (6 - i));
            const dateStr = d.toDateString();
            const total = routines.length;
            const completed = routines.filter(r =>
                (r.completedDates || []).includes(dateStr)
            ).length;
            return {
                day: days[d.getDay()],
                compliance: total > 0 ? Math.round((completed / total) * 100) : 0,
            };
        });
    }, [routines]);

    // ===== SUMMARY STATS =====
    const summaryStats = useMemo(() => {
        const totalIncome = transactions
            .filter(isIncome)
            .reduce((s, t) => s + Math.abs(t.amount), 0);
        const totalExpenses = transactions
            .filter(isExpense)
            .reduce((s, t) => s + Math.abs(t.amount), 0);
        const totalSaved = goals.reduce((s, g) => s + (g.currentAmount || 0), 0);
        const avgRoutineCompletion = habitData.length > 0
            ? Math.round(habitData.reduce((s, d) => s + d.compliance, 0) / habitData.length)
            : 0;

        return { totalIncome, totalExpenses, totalSaved, avgRoutineCompletion };
    }, [transactions, goals, habitData]);

    if (!isLoaded) {
        return (
            <div className="page-content">
                <SkeletonChart />
            </div>
        );
    }

    return (
        <motion.div
            className="page-content"
            variants={container}
            initial="hidden"
            animate="show"
        >
            <motion.div variants={item} style={{ marginBottom: 40 }}>
                <h1 className="page-title" style={{ fontSize: 36 }}>Estadísticas</h1>
                <p className="page-subtitle">Análisis completo de tu comportamiento financiero</p>
            </motion.div>

            {/* Summary Cards */}
            <div className="bento-grid" style={{ marginBottom: 32 }}>
                <motion.div variants={item} className="card-wealth bento-span-3" style={{ textAlign: 'center' }}>
                    <TrendingUp size={20} color="var(--accent-primary)" style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Ingresos Totales</div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Space Grotesk', color: '#fff' }}>
                        {formatCurrency(summaryStats.totalIncome)}
                    </div>
                </motion.div>
                <motion.div variants={item} className="card-wealth bento-span-3" style={{ textAlign: 'center' }}>
                    <Activity size={20} color="var(--danger)" style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Gastos Totales</div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Space Grotesk', color: '#fff' }}>
                        {formatCurrency(summaryStats.totalExpenses)}
                    </div>
                </motion.div>
                <motion.div variants={item} className="card-wealth bento-span-3" style={{ textAlign: 'center' }}>
                    <Target size={20} color="var(--info)" style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Capital en Metas</div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Space Grotesk', color: '#fff' }}>
                        {formatCurrency(summaryStats.totalSaved)}
                    </div>
                </motion.div>
                <motion.div variants={item} className="card-wealth bento-span-3" style={{ textAlign: 'center' }}>
                    <Zap size={20} color="var(--accent-warm)" style={{ marginBottom: 8 }} />
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Disciplina Semanal</div>
                    <div style={{ fontSize: 22, fontWeight: 700, fontFamily: 'Space Grotesk', color: '#fff' }}>
                        {summaryStats.avgRoutineCompletion}%
                    </div>
                </motion.div>
            </div>

            {/* Charts */}
            <div className="bento-grid">
                <ChartCard icon={BarChart3} title="Ingresos vs Gastos" subtitle="Últimos 6 meses" gridSpan="bento-span-6">
                    <MemoizedBarChart data={monthlyData} />
                </ChartCard>

                <ChartCard icon={PieIcon} title="Gastos por Categoría" subtitle="Distribución" gridSpan="bento-span-6">
                    <MemoizedPieChart data={categoryData} />
                </ChartCard>

                <ChartCard icon={TrendingUp} title="Tendencia de Ahorro" subtitle="Balance neto por mes" gridSpan="bento-span-6">
                    <MemoizedAreaChart data={savingsTrend} />
                </ChartCard>

                <ChartCard icon={Target} title="Progreso de Metas" subtitle={`${goals.length} metas activas`} gridSpan="bento-span-6">
                    <MemoizedGoalProgress goals={goals} />
                </ChartCard>

                <ChartCard icon={Activity} title="Cumplimiento Semanal" subtitle="Últimos 7 días de disciplina" gridSpan="bento-span-12">
                    <MemoizedHabitChart data={habitData} />
                </ChartCard>
            </div>
        </motion.div>
    );
}

export default memo(Statistics);
