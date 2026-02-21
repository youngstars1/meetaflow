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
} from '../utils/helpers';
import { calculateLevel, getLevelTitle, getXPForNextLevel, getLevelIcon, evaluateBadges, countEarnedBadges, BADGES } from '../utils/gamification';
import { generateDailyMissions, calculateDecisionMetrics, detectDayPatterns, detectCategoryTrends } from '../utils/patterns';
import { time } from '../utils/timeEngine';
import EmailVerificationBanner from '../components/EmailVerification';
import {
    TrendingUp, TrendingDown, Target, Zap, Eye, EyeOff,
    PiggyBank, ArrowUpRight, ArrowDownRight, Award, Activity,
    Flame, Plus, ShieldCheck, Trophy, Gem, Crown, BarChart3,
    Wallet, Layers, Calendar, AlertTriangle, Info, CheckCircle,
    Shield, Receipt, Heart, ChevronRight, Sparkles
} from 'lucide-react';

const isIncome = (t) => t.type === 'income' || t.type === 'ingreso';
const isExpense = (t) => t.type === 'expense' || t.type === 'gasto';
const isSavings = (t) => t.type === 'savings' || t.type === 'ahorro';

const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.04, delayChildren: 0.06 } },
};

const item = {
    hidden: { y: 12, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } }
};

const BADGE_ICONS = {
    Zap, ShieldCheck, Shield: ShieldCheck, Gem, TrendingUp, Wallet,
    Crown, Trophy, Activity, BarChart3, Target, Layers, Heart
};

const MISSION_ICONS = { Receipt, CheckCircle, PiggyBank, Shield };

// ─── Small stat card shown in hero ─────────
function HeroStat({ label, value, color, prefix = '' }) {
    return (
        <div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, fontWeight: 500 }}>
                {label}
            </div>
            <PrivacyAmount>
                <span style={{ fontSize: 17, fontWeight: 700, fontFamily: 'Space Grotesk', color, letterSpacing: '-0.01em' }}>
                    {prefix}{value}
                </span>
            </PrivacyAmount>
        </div>
    );
}

// ─── Metric card for bento grid ─────────
function MetricCard({ icon: Icon, iconColor, iconBg, label, value, sub, pill, pillType = 'neutral' }) {
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{
                    width: 32, height: 32, borderRadius: 10,
                    background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                    <Icon size={16} color={iconColor} />
                </div>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>{label}</span>
                {pill && <span className={`stat-pill ${pillType}`} style={{ marginLeft: 'auto', fontSize: 10 }}>{pill}</span>}
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, fontFamily: 'Space Grotesk', color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1.1 }}>
                {value}
            </div>
            {sub && <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{sub}</div>}
        </div>
    );
}

export default function Dashboard() {
    const { isDark } = useTheme();
    const { state, dispatch } = useApp();
    const { addToast } = useToast();
    const { isPrivate, togglePrivacy } = usePrivacy();
    const { goals, transactions, routines, gamification, isLoaded } = state;
    const [quickAmount, setQuickAmount] = useState('');

    // ═════ MEMOIZED STATS ═════
    const stats = useMemo(() => {
        const income = transactions.filter(isIncome).reduce((s, t) => s + Math.abs(t.amount), 0);
        const expenses = transactions.filter(isExpense).reduce((s, t) => s + Math.abs(t.amount), 0);
        const totalSaved = goals.reduce((s, g) => s + (g.currentAmount || 0), 0);
        const balance = income - expenses;
        const savingsRate = income > 0 ? Math.round((balance / income) * 100) : 0;
        return { income, expenses, totalSaved, balance, savingsRate };
    }, [transactions, goals]);

    const topGoals = useMemo(() =>
        goals.filter(g => g.targetAmount > 0)
            .sort((a, b) => (b.priority === 'high' ? 1 : 0) - (a.priority === 'high' ? 1 : 0))
            .slice(0, 4),
        [goals]);

    const recentTransactions = useMemo(() => transactions.slice(0, 5), [transactions]);

    const level = useMemo(() => calculateLevel(gamification.totalXP), [gamification.totalXP]);
    const levelTitle = useMemo(() => getLevelTitle(level), [level]);
    const xpProgress = useMemo(() => getXPForNextLevel(gamification.totalXP), [gamification.totalXP]);
    const levelIcon = useMemo(() => getLevelIcon(level), [level]);
    const earnedBadgeCount = useMemo(() => countEarnedBadges(state), [state]);
    const allBadges = useMemo(() => evaluateBadges(state), [state]);

    const todaysRoutines = useMemo(() => {
        const today = time.todayString();
        const total = routines.length;
        const completed = routines.filter(r => (r.completedDates || []).includes(today)).length;
        return { total, completed, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
    }, [routines]);

    const missions = useMemo(() => generateDailyMissions(state), [state]);
    const completedMissions = useMemo(() => missions.filter(m => m.completed).length, [missions]);

    const decisionMetrics = useMemo(() => calculateDecisionMetrics(transactions), [transactions]);
    const dayPatterns = useMemo(() => detectDayPatterns(transactions), [transactions]);
    const categoryTrends = useMemo(() => detectCategoryTrends(transactions), [transactions]);
    const allInsights = useMemo(() => [
        ...decisionMetrics.insights,
        ...dayPatterns.map(p => ({ type: 'info', icon: p.icon, message: p.message })),
        ...categoryTrends.map(t => ({ type: t.type === 'increase' ? 'warning' : 'success', icon: t.icon, message: t.message })),
    ].slice(0, 4), [decisionMetrics, dayPatterns, categoryTrends]);

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

    return (
        <motion.div className="page-content" variants={container} initial="hidden" animate="show">
            <EmailVerificationBanner />

            {/* ═══════ HERO CARD ═══════ */}
            <motion.div
                variants={item}
                style={{
                    position: 'relative', overflow: 'hidden',
                    borderRadius: 20, padding: '36px 36px 28px',
                    background: isDark
                        ? 'linear-gradient(145deg, rgba(12, 14, 20, 0.95), rgba(17, 20, 30, 0.9))'
                        : 'linear-gradient(145deg, #ffffff, #f4f5f7)',
                    border: `1px solid ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)'}`,
                    marginBottom: 24,
                    backdropFilter: 'blur(20px)',
                }}
            >
                {/* Watermark logo */}
                <img src="/metaflow.svg" alt="" style={{
                    position: 'absolute', right: 24, bottom: 20,
                    width: 72, height: 72,
                    opacity: isDark ? 0.2 : 0.08,
                    pointerEvents: 'none', userSelect: 'none',
                }} />

                {/* Giant text watermark */}
                <div style={{
                    position: 'absolute', right: -16, bottom: -28,
                    fontSize: 130, fontWeight: 900, fontFamily: 'Space Grotesk',
                    color: isDark ? 'rgba(255,255,255,0.015)' : 'rgba(0,0,0,0.02)',
                    letterSpacing: '-0.04em', userSelect: 'none', pointerEvents: 'none', lineHeight: 1,
                }}>METAFLOW</div>

                {/* Top row: title + privacy */}
                <div className="flex-between" style={{ marginBottom: 28 }}>
                    <div>
                        <div style={{
                            fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase',
                            letterSpacing: '0.1em', marginBottom: 8, fontWeight: 600,
                        }}>Capital destinado a metas</div>
                        <PrivacyAmount>
                            <div style={{
                                fontSize: 48, fontWeight: 800, fontFamily: 'Space Grotesk',
                                color: 'var(--text-primary)', letterSpacing: '-0.03em', lineHeight: 1,
                            }}>{formatCurrency(stats.totalSaved)}</div>
                        </PrivacyAmount>
                    </div>
                    <button
                        onClick={togglePrivacy}
                        aria-label={isPrivate ? 'Mostrar montos' : 'Ocultar montos'}
                        style={{
                            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
                            border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                            borderRadius: 10, padding: '8px 14px',
                            color: 'var(--text-secondary)', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', gap: 6,
                            fontSize: 12, fontWeight: 500, transition: 'all 0.15s',
                        }}
                    >
                        {isPrivate ? <EyeOff size={14} /> : <Eye size={14} />}
                        {isPrivate ? 'Mostrar' : 'Ocultar'}
                    </button>
                </div>

                {/* Bottom stats */}
                <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 20 }}>
                    <div style={{ display: 'flex', gap: 32 }}>
                        <HeroStat label="Ingresos" value={formatCurrency(stats.income)} color="var(--success)" prefix="+ " />
                        <HeroStat label="Gastos" value={formatCurrency(stats.expenses)} color="var(--danger)" prefix="- " />
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4, fontWeight: 500 }}>
                            Saldo actual
                        </div>
                        <PrivacyAmount>
                            <span style={{
                                fontSize: 22, fontWeight: 800, fontFamily: 'Space Grotesk',
                                color: stats.balance >= 0 ? 'var(--text-primary)' : 'var(--danger)',
                            }}>
                                {stats.balance >= 0 ? '' : '-'}{formatCurrency(Math.abs(stats.balance))}
                            </span>
                        </PrivacyAmount>
                    </div>
                </div>
            </motion.div>

            {/* ═══════ BENTO GRID ═══════ */}
            <div className="bento-grid">

                {/* ─── Quick Transaction ─── */}
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

                {/* ─── Level & XP ─── */}
                <motion.div variants={item} className="card-wealth bento-span-4 shimmer-metal">
                    <div className="card-header">
                        <div className="card-header-icon" style={{ background: 'var(--success-muted)' }}>
                            <Award size={16} color="var(--accent-primary)" />
                        </div>
                        <h3 style={{ fontSize: 14 }}>Tu Progreso</h3>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                        <span style={{ fontSize: 32 }}>{levelIcon}</span>
                        <div>
                            <div style={{ fontSize: 17, fontWeight: 700, fontFamily: 'Space Grotesk', color: 'var(--text-primary)' }}>{levelTitle}</div>
                            <div style={{ fontSize: 12, color: 'var(--accent-primary)', fontWeight: 500 }}>Nivel {level} · {gamification.totalXP.toLocaleString()} XP</div>
                        </div>
                    </div>
                    <div className="liquid-progress" style={{ height: 6 }}>
                        <motion.div className="liquid-progress-fill"
                            initial={{ width: 0 }}
                            animate={{ width: `${xpProgress.progress}%` }}
                            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                        />
                    </div>
                    <div className="flex-between" style={{ marginTop: 8 }}>
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{xpProgress.current} / {xpProgress.needed} XP</span>
                        <span className="stat-pill positive" style={{ fontSize: 10 }}>
                            <Flame size={10} />
                            {earnedBadgeCount}/{BADGES.length}
                        </span>
                    </div>
                </motion.div>

                {/* ─── Discipline / Routines ─── */}
                <motion.div variants={item} className="card-wealth bento-span-4">
                    <div className="card-header">
                        <div className="card-header-icon" style={{ background: 'var(--info-muted)' }}>
                            <Activity size={16} color="var(--info)" />
                        </div>
                        <h3 style={{ fontSize: 14 }}>Disciplina del Día</h3>
                    </div>
                    <div style={{ textAlign: 'center', padding: '4px 0' }}>
                        <div style={{
                            fontSize: 44, fontWeight: 800, fontFamily: 'Space Grotesk',
                            color: todaysRoutines.percent === 100 ? 'var(--success)' : 'var(--text-primary)',
                            letterSpacing: '-0.03em', lineHeight: 1,
                        }}>
                            {todaysRoutines.percent}%
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 8, marginBottom: 12 }}>
                            {todaysRoutines.completed} de {todaysRoutines.total} completados
                        </div>
                        <div className="liquid-progress" style={{ height: 5 }}>
                            <motion.div className="liquid-progress-fill"
                                initial={{ width: 0 }}
                                animate={{ width: `${todaysRoutines.percent}%` }}
                                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                            />
                        </div>
                    </div>
                </motion.div>

                {/* ─── Daily Missions ─── */}
                <motion.div variants={item} className="card-wealth bento-span-6">
                    <div className="flex-between" style={{ marginBottom: 16 }}>
                        <div className="card-header" style={{ marginBottom: 0 }}>
                            <div className="card-header-icon" style={{ background: 'var(--warning-muted)' }}>
                                <Zap size={16} color="var(--warning)" />
                            </div>
                            <h3 style={{ fontSize: 14 }}>Misiones del Día</h3>
                        </div>
                        <span className="stat-pill positive" style={{ fontSize: 10 }}>
                            {completedMissions}/{missions.length}
                        </span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {missions.map(m => {
                            const MIcon = MISSION_ICONS[m.icon] || Zap;
                            return (
                                <div key={m.id} style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: '10px 12px', borderRadius: 10,
                                    background: m.completed ? 'var(--success-muted)' : 'var(--bg-elevated)',
                                    border: `1px solid ${m.completed ? 'var(--success-subtle)' : 'var(--border-secondary)'}`,
                                    transition: 'all 0.2s',
                                }}>
                                    <div style={{
                                        width: 28, height: 28, borderRadius: 8,
                                        background: m.completed ? 'var(--success-subtle)' : 'var(--bg-elevated)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    }}>
                                        {m.completed ? <CheckCircle size={14} color="var(--success)" /> : <MIcon size={14} color="var(--text-muted)" />}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{
                                            fontSize: 13, fontWeight: 500,
                                            color: m.completed ? 'var(--success)' : 'var(--text-primary)',
                                            textDecoration: m.completed ? 'line-through' : 'none',
                                            opacity: m.completed ? 0.7 : 1,
                                        }}>
                                            {m.title}
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{m.description}</div>
                                    </div>
                                    <span className="stat-pill positive" style={{ fontSize: 9, flexShrink: 0 }}>+{m.xp} XP</span>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>

                {/* ─── Financial Intelligence ─── */}
                <motion.div variants={item} className="card-wealth bento-span-6">
                    <div className="card-header">
                        <div className="card-header-icon" style={{ background: 'var(--info-muted)' }}>
                            <BarChart3 size={16} color="var(--info)" />
                        </div>
                        <h3 style={{ fontSize: 14 }}>Inteligencia Financiera</h3>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                        {[
                            { value: `${decisionMetrics.impulseIndex}%`, label: 'Impulso', color: decisionMetrics.impulseIndex > 30 ? 'var(--danger)' : 'var(--success)' },
                            { value: `${decisionMetrics.investmentRatio}%`, label: 'Inversión', color: 'var(--info)' },
                            { value: decisionMetrics.optimizationLevel, label: 'Optimización', color: 'var(--warning)' },
                        ].map((m, i) => (
                            <div key={i} style={{
                                textAlign: 'center', padding: '12px 8px', borderRadius: 10,
                                background: 'var(--bg-elevated)', border: '1px solid var(--border-secondary)',
                            }}>
                                <div style={{ fontSize: 20, fontWeight: 800, fontFamily: 'Space Grotesk', color: m.color, lineHeight: 1.2 }}>
                                    {m.value}
                                </div>
                                <div style={{ fontSize: 9, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>{m.label}</div>
                            </div>
                        ))}
                    </div>

                    {allInsights.length > 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {allInsights.map((insight, i) => {
                                const IIcon = insight.icon === 'AlertTriangle' ? AlertTriangle : insight.icon === 'ShieldCheck' ? ShieldCheck : insight.icon === 'TrendingUp' ? TrendingUp : insight.icon === 'TrendingDown' ? TrendingDown : insight.icon === 'Calendar' ? Calendar : Info;
                                const insightColor = insight.type === 'warning' ? 'var(--danger)' : insight.type === 'success' ? 'var(--success)' : 'var(--info)';
                                const insightBg = insight.type === 'warning' ? 'var(--danger-muted)' : insight.type === 'success' ? 'var(--success-muted)' : 'var(--info-muted)';
                                return (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'flex-start', gap: 8,
                                        padding: '8px 10px', borderRadius: 8,
                                        background: insightBg,
                                        fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5,
                                    }}>
                                        <IIcon size={14} color={insightColor} style={{ flexShrink: 0, marginTop: 2 }} />
                                        {insight.message}
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 12 }}>
                            Registra más movimientos para activar la inteligencia financiera.
                        </div>
                    )}
                </motion.div>

                {/* ─── Top Goals ─── */}
                <motion.div variants={item} className="card-wealth bento-span-8">
                    <div className="flex-between" style={{ marginBottom: 20 }}>
                        <div className="card-header" style={{ marginBottom: 0 }}>
                            <div className="card-header-icon" style={{ background: 'var(--success-muted)' }}>
                                <Target size={16} color="var(--accent-primary)" />
                            </div>
                            <h3 style={{ fontSize: 14 }}>Metas Activas</h3>
                        </div>
                        <span className="stat-pill neutral">{goals.length} metas</span>
                    </div>
                    {topGoals.length === 0 ? (
                        <div className="empty-state" style={{ padding: '40px 20px' }}>
                            <Target size={32} className="empty-state-icon" />
                            <h2 style={{ fontSize: 16 }}>Sin metas aún</h2>
                            <p style={{ fontSize: 13 }}>Crea tu primera meta para empezar a construir tu futuro financiero.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                            {topGoals.map(goal => {
                                const progress = getProgressPercentage(goal.currentAmount || 0, goal.targetAmount);
                                return (
                                    <div key={goal.id} style={{
                                        padding: '14px 16px', borderRadius: 12,
                                        background: 'var(--bg-elevated)',
                                        border: '1px solid var(--border-secondary)',
                                        transition: 'all 0.15s',
                                    }}>
                                        <div className="flex-between" style={{ marginBottom: 8 }}>
                                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                                                {goal.name}
                                            </span>
                                            <span style={{
                                                fontSize: 12, fontFamily: 'Space Grotesk', fontWeight: 700,
                                                color: progress >= 100 ? 'var(--success)' : 'var(--text-secondary)',
                                            }}>
                                                {progress}%
                                            </span>
                                        </div>
                                        <div className="liquid-progress" style={{ height: 4, marginBottom: 8 }}>
                                            <div className="liquid-progress-fill" style={{ width: `${Math.min(100, progress)}%` }} />
                                        </div>
                                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                            <PrivacyAmount>{formatCurrency(goal.currentAmount || 0)}</PrivacyAmount>
                                            {' / '}
                                            <PrivacyAmount>{formatCurrency(goal.targetAmount)}</PrivacyAmount>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </motion.div>

                {/* ─── Badges ─── */}
                <motion.div variants={item} className="card-wealth bento-span-4">
                    <div className="card-header">
                        <div className="card-header-icon" style={{ background: 'var(--warning-muted)' }}>
                            <Award size={16} color="var(--warning)" />
                        </div>
                        <h3 style={{ fontSize: 14 }}>Medallas</h3>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                        {allBadges.slice(0, 6).map(badge => {
                            const IconComp = BADGE_ICONS[badge.icon] || Award;
                            return (
                                <div key={badge.id} className={`badge-card ${badge.earned ? 'earned' : 'locked'}`}>
                                    {badge.earned && <div className="badge-dot" />}
                                    <IconComp size={18} color={badge.earned ? 'var(--accent-primary)' : 'var(--text-muted)'} />
                                    <span className="badge-name">{badge.name}</span>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>

                {/* ─── Recent Transactions ─── */}
                <motion.div variants={item} className="card-wealth bento-span-12">
                    <div className="flex-between" style={{ marginBottom: 20 }}>
                        <div className="card-header" style={{ marginBottom: 0 }}>
                            <div className="card-header-icon" style={{ background: 'var(--info-muted)' }}>
                                <Wallet size={16} color="var(--info)" />
                            </div>
                            <h3 style={{ fontSize: 14 }}>Últimos Movimientos</h3>
                        </div>
                        <span className="stat-pill neutral">{transactions.length} totales</span>
                    </div>
                    {recentTransactions.length === 0 ? (
                        <div className="empty-state" style={{ padding: '32px 20px' }}>
                            <Wallet size={28} className="empty-state-icon" />
                            <p style={{ fontSize: 13 }}>Aún no has registrado movimientos financieros.</p>
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
                                        background: isIncome(t) ? 'var(--success-muted)' : isExpense(t) ? 'var(--danger-muted)' : 'var(--info-muted)',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    }}>
                                        {isIncome(t) ? <ArrowUpRight size={14} color="var(--success)" /> :
                                            isExpense(t) ? <ArrowDownRight size={14} color="var(--danger)" /> :
                                                <PiggyBank size={14} color="var(--info)" />}
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
                                            color: isIncome(t) ? 'var(--success)' : isExpense(t) ? 'var(--danger)' : 'var(--info)',
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
