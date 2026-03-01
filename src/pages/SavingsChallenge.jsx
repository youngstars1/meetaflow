import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { generateId, formatCurrency } from '../utils/helpers';
import { storage } from '../utils/storage';
import confetti from 'canvas-confetti';
import {
    PiggyBank, Target, TrendingUp, Trophy, Sparkles,
    RotateCcw, Settings2, Zap, CheckCircle, ChevronDown,
    PartyPopper, Star, Flame, X, Plus, Trash2,
} from 'lucide-react';

// ─── Constants ───────────────────────────
const STORAGE_KEY = 'metaflow_savings_challenge';

const PRESET_AMOUNTS = [
    10000, 15000, 20000, 25000, 30000, 40000, 50000, 75000, 100000,
];

const DEFAULT_TARGET = 5000000;

const MILESTONE_MESSAGES = {
    25: { emoji: '🔥', title: '¡25% completado!', message: '¡Gran inicio! Ya llevas una cuarta parte de tu meta. La constancia es la clave.' },
    50: { emoji: '⚡', title: '¡Mitad del camino!', message: '¡Impresionante! Ya estás en la mitad. Sigue con esa disciplina financiera.' },
    75: { emoji: '🚀', title: '¡75% alcanzado!', message: '¡Casi lo logras! Falta solo un poco más para llegar a tu meta. ¡No te detengas!' },
    100: { emoji: '🏆', title: '¡META ALCANZADA!', message: '¡Felicitaciones! Has completado tu desafío de ahorro. Eres un campeón financiero.' },
};

// ─── Utility: Generate blocks for automatic mode ───
function generateAutomaticBlocks(targetAmount) {
    const blocks = [];
    let remaining = targetAmount;
    let id = 0;

    // Use a weighted distribution strategy
    const distribution = [
        { amount: 100000, weight: 0.20 },
        { amount: 75000, weight: 0.10 },
        { amount: 50000, weight: 0.20 },
        { amount: 40000, weight: 0.10 },
        { amount: 30000, weight: 0.12 },
        { amount: 25000, weight: 0.10 },
        { amount: 20000, weight: 0.10 },
        { amount: 15000, weight: 0.05 },
        { amount: 10000, weight: 0.03 },
    ];

    // Fill with distribution-based blocks
    for (const { amount, weight } of distribution) {
        const count = Math.floor((targetAmount * weight) / amount);
        for (let i = 0; i < count && remaining >= amount; i++) {
            blocks.push({ id: `b-${id++}`, amount, selected: false });
            remaining -= amount;
        }
    }

    // Fill the remainder with appropriately sized blocks
    const sortedAmounts = [...PRESET_AMOUNTS].sort((a, b) => b - a);
    while (remaining > 0) {
        let placed = false;
        for (const amt of sortedAmounts) {
            if (amt <= remaining) {
                blocks.push({ id: `b-${id++}`, amount: amt, selected: false });
                remaining -= amt;
                placed = true;
                break;
            }
        }
        if (!placed) {
            // Add smallest possible block for any remainder
            blocks.push({ id: `b-${id++}`, amount: remaining, selected: false });
            remaining = 0;
        }
    }

    // Shuffle for visual variety
    for (let i = blocks.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    }

    return blocks;
}

// ─── Confetti Blast ───
function fireConfetti() {
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
        confetti({
            particleCount: 3,
            angle: 60,
            spread: 55,
            origin: { x: 0, y: 0.7 },
            colors: ['#00e5c3', '#60b8f0', '#f5a623', '#00b89c'],
        });
        confetti({
            particleCount: 3,
            angle: 120,
            spread: 55,
            origin: { x: 1, y: 0.7 },
            colors: ['#00e5c3', '#60b8f0', '#f5a623', '#00b89c'],
        });
        if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
}

function fireMilestoneConfetti() {
    confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00e5c3', '#60b8f0', '#f5a623'],
    });
}

// ─── Main Component ──────────────────────
export default function SavingsChallenge() {
    const { addToast } = useToast();
    const { dispatch } = useApp();

    // ── State ──
    const [challenge, setChallenge] = useState(null);
    const [showSetup, setShowSetup] = useState(false);
    const [setupTarget, setSetupTarget] = useState(DEFAULT_TARGET);
    const [setupMode, setSetupMode] = useState('automatic');
    const [customAmounts, setCustomAmounts] = useState([]);
    const [newCustomAmount, setNewCustomAmount] = useState('');
    const [milestonePopup, setMilestonePopup] = useState(null);
    const [animatingBlock, setAnimatingBlock] = useState(null);
    const prevMilestoneRef = useRef(new Set());

    // ── Load from localStorage ──
    useEffect(() => {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                const data = JSON.parse(stored);
                setChallenge(data);
                prevMilestoneRef.current = new Set(data.milestonesShown || []);
            }
        } catch (e) {
            console.warn('Failed to load savings challenge:', e);
        }
    }, []);

    // ── Save to localStorage ──
    const saveChallengeCLP = useCallback((data) => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {
            console.warn('Failed to save savings challenge:', e);
        }
    }, []);

    // ── Computed values ──
    const stats = useMemo(() => {
        if (!challenge) return { totalSaved: 0, remaining: 0, percent: 0, blockCount: 0, selectedCount: 0 };
        const totalSaved = challenge.blocks
            .filter(b => b.selected)
            .reduce((sum, b) => sum + b.amount, 0);
        const remaining = Math.max(0, challenge.targetAmount - totalSaved);
        const percent = Math.min(100, Math.round((totalSaved / challenge.targetAmount) * 100));
        const blockCount = challenge.blocks.length;
        const selectedCount = challenge.blocks.filter(b => b.selected).length;
        return { totalSaved, remaining, percent, blockCount, selectedCount };
    }, [challenge]);

    // ── Check milestones ──
    useEffect(() => {
        if (!challenge) return;
        const { percent } = stats;
        const milestones = [25, 50, 75, 100];
        const shown = new Set(challenge.milestonesShown || []);

        for (const m of milestones) {
            if (percent >= m && !shown.has(m)) {
                shown.add(m);
                const updated = { ...challenge, milestonesShown: [...shown] };
                setChallenge(updated);
                saveChallengeCLP(updated);
                setMilestonePopup(MILESTONE_MESSAGES[m]);

                if (m === 100) {
                    setTimeout(fireConfetti, 300);
                } else {
                    setTimeout(fireMilestoneConfetti, 200);
                }
                break;
            }
        }
    }, [stats.percent]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Create challenge ──
    const handleCreate = () => {
        let blocks;
        if (setupMode === 'automatic') {
            blocks = generateAutomaticBlocks(setupTarget);
        } else {
            // Custom mode: use defined custom amounts
            if (customAmounts.length === 0) {
                addToast('Agrega al menos un monto personalizado', { type: 'warning' });
                return;
            }
            const totalCustom = customAmounts.reduce((s, a) => s + a, 0);
            if (totalCustom !== setupTarget) {
                addToast(`Los montos suman ${formatCurrency(totalCustom)} pero la meta es ${formatCurrency(setupTarget)}. Ajusta los montos.`, { type: 'warning', duration: 5000 });
                return;
            }
            blocks = customAmounts.map((amount, i) => ({
                id: `c-${i}`,
                amount,
                selected: false,
            }));
        }

        const newChallenge = {
            id: generateId(),
            name: 'Mi Ahorro Programado',
            targetAmount: setupTarget,
            mode: setupMode,
            blocks,
            totalSaved: 0,
            completed: false,
            milestonesShown: [],
            createdAt: new Date().toISOString(),
        };

        setChallenge(newChallenge);
        saveChallengeCLP(newChallenge);
        setShowSetup(false);
        addToast('¡Desafío de ahorro creado! Tu camino comienza ahora 🚀', { type: 'success' });
    };

    // ── Toggle block ──
    const toggleBlock = useCallback((blockId) => {
        if (!challenge) return;

        setChallenge(prev => {
            const block = prev.blocks.find(b => b.id === blockId);
            if (!block) return prev;

            const newSelected = !block.selected;

            // If selecting, check would exceed target
            if (newSelected) {
                const currentTotal = prev.blocks
                    .filter(b => b.selected)
                    .reduce((s, b) => s + b.amount, 0);
                if (currentTotal + block.amount > prev.targetAmount) {
                    addToast('Este monto excedería tu meta de ahorro', { type: 'warning' });
                    return prev;
                }
            }

            const updatedBlocks = prev.blocks.map(b =>
                b.id === blockId ? { ...b, selected: newSelected } : b
            );

            const totalSaved = updatedBlocks
                .filter(b => b.selected)
                .reduce((s, b) => s + b.amount, 0);

            const updated = {
                ...prev,
                blocks: updatedBlocks,
                totalSaved,
                completed: totalSaved >= prev.targetAmount,
            };

            saveChallengeCLP(updated);
            return updated;
        });

        setAnimatingBlock(blockId);
        setTimeout(() => setAnimatingBlock(null), 400);
    }, [challenge, saveChallengeCLP, addToast]);

    // ── Reset challenge ──
    const resetChallenge = () => {
        if (!challenge) return;
        const updated = {
            ...challenge,
            blocks: challenge.blocks.map(b => ({ ...b, selected: false })),
            totalSaved: 0,
            completed: false,
            milestonesShown: [],
        };
        setChallenge(updated);
        saveChallengeCLP(updated);
        prevMilestoneRef.current.clear();
        addToast('Progreso reiniciado', { type: 'info' });
    };

    // ── Delete challenge ──
    const deleteChallenge = () => {
        localStorage.removeItem(STORAGE_KEY);
        setChallenge(null);
        addToast('Desafío eliminado', { type: 'info' });
    };

    // ── Add custom amount ──
    const addCustomAmount = () => {
        const val = parseInt(newCustomAmount, 10);
        if (!val || val <= 0) return;
        setCustomAmounts(prev => [...prev, val]);
        setNewCustomAmount('');
    };

    // ── Motivational quote ──
    const motivationalQuote = useMemo(() => {
        const { percent } = stats;
        if (percent >= 100) return '🏆 ¡Lo lograste! Eres un campeón del ahorro.';
        if (percent >= 75) return '🚀 ¡Casi en la cima! Un último empujón.';
        if (percent >= 50) return '⚡ ¡Mitad lograda! Tu disciplina es admirable.';
        if (percent >= 25) return '🔥 ¡Gran inicio! Sigue así.';
        return '💪 Cada paso cuenta. ¡Comienza hoy!';
    }, [stats]);

    // ═══════════════════════════════════════
    //  RENDER: No challenge yet
    // ═══════════════════════════════════════
    if (!challenge && !showSetup) {
        return (
            <div className="page-content fade-and-slide">
                <div style={{ marginBottom: 32 }}>
                    <h1 className="page-title" style={{ fontSize: 28, marginBottom: 8 }}>
                        Mi Ahorro Programado
                    </h1>
                    <p className="page-subtitle">
                        Gamifica tu ahorro en pesos chilenos con un tablero interactivo
                    </p>
                </div>

                <div className="sc-empty-hero">
                    <div className="sc-empty-icon-wrapper">
                        <PiggyBank size={56} strokeWidth={1.2} />
                    </div>
                    <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 8 }}>
                        ¡Comienza tu Desafío de Ahorro!
                    </h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 440, margin: '0 auto 28px', lineHeight: 1.7 }}>
                        Define una meta en CLP, elige tus montos y ve marcando cada logro.
                        Observa tu progreso crecer con cada paso hacia tu libertad financiera.
                    </p>
                    <button
                        className="btn-wealth sc-btn-start"
                        onClick={() => setShowSetup(true)}
                    >
                        <Sparkles size={18} />
                        Crear Desafío de Ahorro
                    </button>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════
    //  RENDER: Setup screen
    // ═══════════════════════════════════════
    if (showSetup) {
        const customTotal = customAmounts.reduce((s, a) => s + a, 0);
        return (
            <div className="page-content fade-and-slide">
                <div style={{ marginBottom: 32 }}>
                    <h1 className="page-title" style={{ fontSize: 28, marginBottom: 8 }}>
                        Configurar Desafío
                    </h1>
                    <p className="page-subtitle">
                        Personaliza tu desafío de ahorro programado
                    </p>
                </div>

                <div className="card-wealth" style={{ maxWidth: 600, margin: '0 auto' }}>
                    {/* Target Amount */}
                    <div className="form-group">
                        <label className="form-label">Meta de Ahorro (CLP)</label>
                        <input
                            type="number"
                            className="wealth-input"
                            value={setupTarget}
                            onChange={e => setSetupTarget(Math.max(10000, parseInt(e.target.value, 10) || 0))}
                            min={10000}
                            step={10000}
                            placeholder="5.000.000"
                            id="sc-target-input"
                        />
                        <div style={{ marginTop: 8, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {[1000000, 2000000, 3000000, 5000000, 10000000].map(amount => (
                                <button
                                    key={amount}
                                    className={`sc-preset-chip ${setupTarget === amount ? 'active' : ''}`}
                                    onClick={() => setSetupTarget(amount)}
                                >
                                    {formatCurrency(amount)}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Mode Selection */}
                    <div className="form-group">
                        <label className="form-label">Modo de Generación</label>
                        <div className="sc-mode-selector">
                            <button
                                className={`sc-mode-btn ${setupMode === 'automatic' ? 'active' : ''}`}
                                onClick={() => setSetupMode('automatic')}
                            >
                                <Zap size={16} />
                                <div>
                                    <div style={{ fontWeight: 600 }}>Automático</div>
                                    <div style={{ fontSize: 11, opacity: 0.7 }}>Distribución estratégica</div>
                                </div>
                            </button>
                            <button
                                className={`sc-mode-btn ${setupMode === 'custom' ? 'active' : ''}`}
                                onClick={() => setSetupMode('custom')}
                            >
                                <Settings2 size={16} />
                                <div>
                                    <div style={{ fontWeight: 600 }}>Personalizado</div>
                                    <div style={{ fontSize: 11, opacity: 0.7 }}>Tú eliges los montos</div>
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Custom amounts builder */}
                    {setupMode === 'custom' && (
                        <div className="form-group" style={{ animation: 'fadeSlide 0.3s var(--ease-out)' }}>
                            <label className="form-label">Montos Personalizados</label>
                            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                                <input
                                    type="number"
                                    className="wealth-input"
                                    value={newCustomAmount}
                                    onChange={e => setNewCustomAmount(e.target.value)}
                                    placeholder="Ej: 50.000"
                                    min={1000}
                                    step={1000}
                                    onKeyDown={e => e.key === 'Enter' && addCustomAmount()}
                                    id="sc-custom-amount-input"
                                />
                                <button className="btn-wealth" onClick={addCustomAmount} style={{ flexShrink: 0 }}>
                                    <Plus size={16} />
                                </button>
                            </div>

                            {/* Preset buttons for quick add */}
                            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                                {PRESET_AMOUNTS.map(amt => (
                                    <button
                                        key={amt}
                                        className="sc-preset-chip"
                                        onClick={() => setCustomAmounts(prev => [...prev, amt])}
                                    >
                                        + {formatCurrency(amt)}
                                    </button>
                                ))}
                            </div>

                            {/* Custom amounts list */}
                            {customAmounts.length > 0 && (
                                <div className="sc-custom-list">
                                    {customAmounts.map((amt, i) => (
                                        <div key={i} className="sc-custom-item">
                                            <span style={{ fontFamily: 'Space Grotesk', fontWeight: 600, fontSize: 13 }}>
                                                {formatCurrency(amt)}
                                            </span>
                                            <button
                                                onClick={() => setCustomAmounts(prev => prev.filter((_, idx) => idx !== i))}
                                                style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex' }}
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    ))}
                                    <div style={{
                                        padding: '8px 12px', borderTop: '1px solid var(--border-secondary)',
                                        display: 'flex', justifyContent: 'space-between', fontSize: 12,
                                    }}>
                                        <span style={{ color: 'var(--text-muted)' }}>Total:</span>
                                        <span style={{
                                            fontFamily: 'Space Grotesk', fontWeight: 700,
                                            color: customTotal === setupTarget ? 'var(--success)' : 'var(--warning)',
                                        }}>
                                            {formatCurrency(customTotal)} / {formatCurrency(setupTarget)}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Actions */}
                    <div className="form-actions">
                        <button className="btn-wealth" onClick={handleCreate} id="sc-create-btn">
                            <Sparkles size={16} />
                            Crear Desafío
                        </button>
                        <button
                            className="btn-wealth btn-wealth-outline"
                            onClick={() => { setShowSetup(false); }}
                        >
                            Cancelar
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // ═══════════════════════════════════════
    //  RENDER: Active Challenge Board
    // ═══════════════════════════════════════
    return (
        <div className="page-content fade-and-slide">
            {/* ── Milestone Popup ── */}
            <AnimatePresence>
                {milestonePopup && (
                    <motion.div
                        className="sc-milestone-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setMilestonePopup(null)}
                    >
                        <motion.div
                            className="sc-milestone-card"
                            initial={{ scale: 0.8, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.8, opacity: 0, y: 20 }}
                            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <button
                                className="sc-milestone-close"
                                onClick={() => setMilestonePopup(null)}
                            >
                                <X size={18} />
                            </button>
                            <div className="sc-milestone-emoji">{milestonePopup.emoji}</div>
                            <h2 className="sc-milestone-title">{milestonePopup.title}</h2>
                            <p className="sc-milestone-message">{milestonePopup.message}</p>
                            <button
                                className="btn-wealth"
                                onClick={() => setMilestonePopup(null)}
                                style={{ marginTop: 16 }}
                            >
                                ¡Seguir ahorrando!
                            </button>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── Header ── */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
                <div>
                    <h1 className="page-title" style={{ fontSize: 28, marginBottom: 8 }}>
                        Mi Ahorro Programado
                    </h1>
                    <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Target size={14} />
                        Meta: {formatCurrency(challenge.targetAmount)} CLP
                    </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button
                        className="btn-wealth btn-wealth-outline"
                        onClick={resetChallenge}
                        title="Reiniciar progreso"
                        style={{ fontSize: 12, padding: '8px 14px' }}
                    >
                        <RotateCcw size={14} />
                        Reiniciar
                    </button>
                    <button
                        className="btn-wealth btn-wealth-outline"
                        onClick={deleteChallenge}
                        title="Eliminar desafío"
                        style={{ fontSize: 12, padding: '8px 14px', borderColor: 'var(--danger-subtle)', color: 'var(--danger)' }}
                    >
                        <Trash2 size={14} />
                    </button>
                </div>
            </div>

            {/* ── Stats Cards ── */}
            <div className="sc-stats-grid">
                <div className="card-wealth sc-stat-card">
                    <div className="sc-stat-icon" style={{ background: 'var(--success-muted)', color: 'var(--success)' }}>
                        <TrendingUp size={20} />
                    </div>
                    <div>
                        <div className="sc-stat-label">Total Ahorrado</div>
                        <div className="sc-stat-value" style={{ color: 'var(--success)' }}>
                            {formatCurrency(stats.totalSaved)}
                        </div>
                    </div>
                </div>
                <div className="card-wealth sc-stat-card">
                    <div className="sc-stat-icon" style={{ background: 'var(--warning-muted)', color: 'var(--warning)' }}>
                        <Target size={20} />
                    </div>
                    <div>
                        <div className="sc-stat-label">Restante</div>
                        <div className="sc-stat-value" style={{ color: 'var(--warning)' }}>
                            {formatCurrency(stats.remaining)}
                        </div>
                    </div>
                </div>
                <div className="card-wealth sc-stat-card">
                    <div className="sc-stat-icon" style={{ background: 'var(--info-muted)', color: 'var(--info)' }}>
                        <Flame size={20} />
                    </div>
                    <div>
                        <div className="sc-stat-label">Progreso</div>
                        <div className="sc-stat-value" style={{ color: 'var(--info)' }}>
                            {stats.percent}%
                        </div>
                    </div>
                </div>
                <div className="card-wealth sc-stat-card">
                    <div className="sc-stat-icon" style={{ background: 'var(--accent-primary)', color: 'var(--text-inverse)' }}>
                        <CheckCircle size={20} />
                    </div>
                    <div>
                        <div className="sc-stat-label">Bloques</div>
                        <div className="sc-stat-value">
                            {stats.selectedCount} / {stats.blockCount}
                        </div>
                    </div>
                </div>
            </div>

            {/* ── Progress Bar ── */}
            <div className="card-wealth" style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
                        Progreso del Desafío
                    </span>
                    <span style={{
                        fontFamily: 'Space Grotesk', fontWeight: 700, fontSize: 18,
                        background: 'var(--accent-gradient)', WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                    }}>
                        {stats.percent}%
                    </span>
                </div>
                <div className="sc-progress-bar">
                    <motion.div
                        className="sc-progress-fill"
                        initial={{ width: 0 }}
                        animate={{ width: `${stats.percent}%` }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    />
                    {/* Milestone markers */}
                    {[25, 50, 75].map(m => (
                        <div
                            key={m}
                            className={`sc-milestone-marker ${stats.percent >= m ? 'reached' : ''}`}
                            style={{ left: `${m}%` }}
                        >
                            <div className="sc-milestone-dot" />
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {formatCurrency(stats.totalSaved)}
                    </span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        {formatCurrency(challenge.targetAmount)}
                    </span>
                </div>

                {/* Motivational quote */}
                <div className="sc-motivation">
                    <span>{motivationalQuote}</span>
                </div>
            </div>

            {/* ── Blocks Board ── */}
            <div className="card-wealth" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{
                    padding: '20px 24px 16px',
                    borderBottom: '1px solid var(--border-secondary)',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <PiggyBank size={18} style={{ color: 'var(--accent-primary)' }} />
                        <span style={{ fontSize: 14, fontWeight: 600 }}>Tablero de Ahorro</span>
                    </div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        Haz clic para marcar/desmarcar
                    </span>
                </div>
                <div className="sc-blocks-grid">
                    {challenge.blocks.map((block, index) => (
                        <motion.button
                            key={block.id}
                            className={`sc-block ${block.selected ? 'selected' : ''} ${animatingBlock === block.id ? 'animating' : ''}`}
                            onClick={() => toggleBlock(block.id)}
                            whileTap={{ scale: 0.92 }}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: Math.min(index * 0.01, 0.5), duration: 0.3 }}
                            title={block.selected ? 'Desmarcar' : 'Marcar como ahorrado'}
                            id={`sc-block-${block.id}`}
                        >
                            <span className="sc-block-amount">
                                {formatCurrency(block.amount)}
                            </span>
                            {block.selected && (
                                <motion.div
                                    className="sc-block-check"
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: 'spring', damping: 12, stiffness: 400 }}
                                >
                                    <CheckCircle size={16} />
                                </motion.div>
                            )}
                        </motion.button>
                    ))}
                </div>
            </div>

            {/* ── Breakdown by amount ── */}
            <div className="card-wealth" style={{ marginTop: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <Star size={16} style={{ color: 'var(--accent-warm)' }} />
                    <span style={{ fontSize: 14, fontWeight: 600 }}>Resumen por Monto</span>
                </div>
                <div className="sc-breakdown-grid">
                    {(() => {
                        const grouped = {};
                        challenge.blocks.forEach(b => {
                            if (!grouped[b.amount]) grouped[b.amount] = { total: 0, selected: 0 };
                            grouped[b.amount].total++;
                            if (b.selected) grouped[b.amount].selected++;
                        });
                        return Object.entries(grouped)
                            .sort(([a], [b]) => Number(a) - Number(b))
                            .map(([amount, { total, selected }]) => (
                                <div key={amount} className="sc-breakdown-item">
                                    <div className="sc-breakdown-label">{formatCurrency(Number(amount))}</div>
                                    <div className="sc-breakdown-bar-track">
                                        <motion.div
                                            className="sc-breakdown-bar-fill"
                                            initial={{ width: 0 }}
                                            animate={{ width: `${total > 0 ? (selected / total) * 100 : 0}%` }}
                                            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                        />
                                    </div>
                                    <div className="sc-breakdown-count">
                                        {selected}/{total}
                                    </div>
                                </div>
                            ));
                    })()}
                </div>
            </div>
        </div>
    );
}
