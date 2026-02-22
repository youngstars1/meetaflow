import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { formatCurrency } from '../utils/helpers';
import {
    ArrowRight, ArrowLeft, CheckCircle, DollarSign, Wallet,
    Target, BarChart3, Plus, X, Trash2, Sparkles, TrendingUp,
    Shield, Repeat, ChevronRight
} from 'lucide-react';

const EXPENSE_CATEGORIES = [
    { value: 'vivienda', label: 'Arriendo / Hipoteca' },
    { value: 'servicios', label: 'Servicios (Agua, Luz, Gas)' },
    { value: 'internet', label: 'Internet / Telefonía' },
    { value: 'transporte', label: 'Transporte' },
    { value: 'seguros', label: 'Seguros' },
    { value: 'suscripciones', label: 'Suscripciones' },
    { value: 'deudas', label: 'Deudas / Cuotas' },
    { value: 'otros', label: 'Otros Fijos' },
];

const slideVariants = {
    enter: (d) => ({ x: d > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d) => ({ x: d > 0 ? -80 : 80, opacity: 0 }),
};

/* ─── Timeline Visual ─── */
function FlowTimeline({ income, fixedTotal, variableEstimate, available, goalAmount }) {
    const nodes = [
        { label: 'Ingresos', value: income, color: '#00e5c3', icon: DollarSign },
        { label: 'Fijos', value: fixedTotal, color: '#f04444', icon: Repeat },
        { label: 'Variables', value: variableEstimate, color: '#f5a623', icon: Wallet },
        { label: 'Disponible', value: available, color: '#60b8f0', icon: Shield },
        { label: 'Metas', value: goalAmount, color: '#a855f7', icon: Target },
    ];

    return (
        <div className="onboarding-flow-timeline">
            {nodes.map((node, i) => (
                <div key={node.label} className="onboarding-flow-node">
                    <motion.div
                        className="onboarding-flow-circle"
                        style={{ background: `${node.color}12`, borderColor: `${node.color}30` }}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: i * 0.12, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <node.icon size={20} color={node.color} />
                    </motion.div>
                    <div className="onboarding-flow-label" style={{ color: node.color }}>
                        {node.label}
                    </div>
                    <div className="onboarding-flow-value">
                        {formatCurrency(node.value)}
                    </div>
                    {i < nodes.length - 1 && (
                        <motion.div
                            className="onboarding-flow-connector"
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ delay: i * 0.12 + 0.2, duration: 0.4 }}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}

export default function OnboardingWizard({ onComplete }) {
    const { dispatch } = useApp();
    const [step, setStep] = useState(0);
    const [direction, setDirection] = useState(1);

    // Step 1: Income
    const [monthlyIncome, setMonthlyIncome] = useState('');
    const [incomeSources, setIncomeSources] = useState([{ name: 'Sueldo Principal', amount: '' }]);

    // Step 2: Fixed Expenses
    const [fixedExpenses, setFixedExpenses] = useState([]);
    const [newExpense, setNewExpense] = useState({ name: '', amount: '', category: 'vivienda' });

    // Step 3: First Goal
    const [goalName, setGoalName] = useState('');
    const [goalAmount, setGoalAmount] = useState('');
    const [goalDeadline, setGoalDeadline] = useState('');

    // Calculations
    const totalIncome = useMemo(() => {
        return incomeSources.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
    }, [incomeSources]);

    const totalFixed = useMemo(() => {
        return fixedExpenses.reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
    }, [fixedExpenses]);

    const variableEstimate = useMemo(() => {
        return Math.round(totalIncome * 0.2); // Estimate 20% variable
    }, [totalIncome]);

    const available = useMemo(() => {
        return Math.max(0, totalIncome - totalFixed - variableEstimate);
    }, [totalIncome, totalFixed, variableEstimate]);

    const fixedRatio = useMemo(() => {
        return totalIncome > 0 ? Math.round((totalFixed / totalIncome) * 100) : 0;
    }, [totalFixed, totalIncome]);

    const addExpense = useCallback(() => {
        if (!newExpense.name || !newExpense.amount) return;
        setFixedExpenses(prev => [...prev, { ...newExpense, id: Date.now().toString(36) }]);
        setNewExpense({ name: '', amount: '', category: 'vivienda' });
    }, [newExpense]);

    const removeExpense = useCallback((id) => {
        setFixedExpenses(prev => prev.filter(e => e.id !== id));
    }, []);

    const addIncomeSource = useCallback(() => {
        setIncomeSources(prev => [...prev, { name: '', amount: '' }]);
    }, []);

    const updateIncomeSource = useCallback((index, field, value) => {
        setIncomeSources(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
    }, []);

    const removeIncomeSource = useCallback((index) => {
        if (incomeSources.length <= 1) return;
        setIncomeSources(prev => prev.filter((_, i) => i !== index));
    }, [incomeSources.length]);

    const goNext = useCallback(() => {
        setDirection(1);
        setStep(prev => Math.min(3, prev + 1));
    }, []);

    const goPrev = useCallback(() => {
        setDirection(-1);
        setStep(prev => Math.max(0, prev - 1));
    }, []);

    const finishOnboarding = useCallback(() => {
        // Save income sources to profile
        dispatch({
            type: 'UPDATE_PROFILE',
            payload: {
                incomeSources: incomeSources.map(s => ({
                    name: s.name,
                    amount: parseFloat(s.amount) || 0,
                })),
            },
        });

        // Add fixed expenses to state
        fixedExpenses.forEach(expense => {
            dispatch({
                type: 'ADD_FIXED_EXPENSE',
                payload: {
                    name: expense.name,
                    amount: parseFloat(expense.amount) || 0,
                    category: expense.category,
                    frequency: 'monthly',
                    active: true,
                },
            });
        });

        // Add first goal if defined
        if (goalName && goalAmount) {
            dispatch({
                type: 'ADD_GOAL',
                payload: {
                    name: goalName,
                    targetAmount: parseFloat(goalAmount) || 0,
                    currentAmount: 0,
                    deadline: goalDeadline || null,
                    priority: 'high',
                    color: '#00e5c3',
                },
            });
        }

        localStorage.setItem('metaflow_onboarded', 'true');
        onComplete();
    }, [dispatch, incomeSources, fixedExpenses, goalName, goalAmount, goalDeadline, onComplete]);

    const isStepValid = useMemo(() => {
        switch (step) {
            case 0: return totalIncome > 0;
            case 1: return true; // Optional
            case 2: return true; // Optional
            case 3: return true; // Review
            default: return true;
        }
    }, [step, totalIncome]);

    const STEPS_CONFIG = [
        { title: 'Ingreso Mensual', subtitle: 'Define tus fuentes de ingreso', icon: DollarSign },
        { title: 'Gastos Fijos', subtitle: 'Agrega tus costos recurrentes', icon: Repeat },
        { title: 'Primera Meta', subtitle: 'Define tu primer objetivo financiero', icon: Target },
        { title: 'Proyección Financiera', subtitle: 'Tu simulación del mes actual', icon: BarChart3 },
    ];

    return (
        <div className="onboarding-wizard">
            <div className="onboarding-wizard-bg">
                <div className="onboarding-wizard-glow" />
            </div>

            <div className="onboarding-wizard-container">
                {/* Skip */}
                <button
                    onClick={() => { localStorage.setItem('metaflow_onboarded', 'true'); onComplete(); }}
                    className="onboarding-skip-btn"
                >
                    Saltar Configuración →
                </button>

                {/* Progress */}
                <div className="onboarding-progress">
                    {STEPS_CONFIG.map((s, i) => (
                        <div key={i} className={`onboarding-progress-step ${i === step ? 'active' : ''} ${i < step ? 'done' : ''}`}>
                            <div className="onboarding-progress-dot">
                                {i < step ? <CheckCircle size={14} /> : <span>{i + 1}</span>}
                            </div>
                            <span className="onboarding-progress-label">{s.title}</span>
                        </div>
                    ))}
                    <div className="onboarding-progress-bar">
                        <motion.div
                            className="onboarding-progress-bar-fill"
                            animate={{ width: `${(step / 3) * 100}%` }}
                            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                        />
                    </div>
                </div>

                {/* Step Content */}
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={step}
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                        className="onboarding-step-content"
                    >
                        {/* Step header */}
                        <div className="onboarding-step-header">
                            <div className="onboarding-step-icon-wrap">
                                {(() => { const Icon = STEPS_CONFIG[step].icon; return <Icon size={28} />; })()}
                            </div>
                            <h2>{STEPS_CONFIG[step].title}</h2>
                            <p>{STEPS_CONFIG[step].subtitle}</p>
                        </div>

                        {/* STEP 0: Income */}
                        {step === 0 && (
                            <div className="onboarding-form">
                                {incomeSources.map((source, i) => (
                                    <div key={i} className="onboarding-income-row">
                                        <input
                                            className="wealth-input"
                                            placeholder="Fuente de ingreso"
                                            value={source.name}
                                            onChange={e => updateIncomeSource(i, 'name', e.target.value)}
                                        />
                                        <div style={{ position: 'relative' }}>
                                            <span className="onboarding-currency-prefix">$</span>
                                            <input
                                                className="wealth-input"
                                                style={{ paddingLeft: 28 }}
                                                type="number"
                                                placeholder="Monto mensual"
                                                value={source.amount}
                                                onChange={e => updateIncomeSource(i, 'amount', e.target.value)}
                                            />
                                        </div>
                                        {incomeSources.length > 1 && (
                                            <button className="onboarding-remove-btn" onClick={() => removeIncomeSource(i)}>
                                                <X size={14} />
                                            </button>
                                        )}
                                    </div>
                                ))}
                                <button className="onboarding-add-btn" onClick={addIncomeSource}>
                                    <Plus size={14} /> Agregar otra fuente
                                </button>
                                {totalIncome > 0 && (
                                    <div className="onboarding-summary-pill">
                                        <DollarSign size={16} />
                                        <span>Ingreso Total Mensual:</span>
                                        <strong>{formatCurrency(totalIncome)}</strong>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* STEP 1: Fixed Expenses */}
                        {step === 1 && (
                            <div className="onboarding-form">
                                <div className="onboarding-expense-input-row">
                                    <input
                                        className="wealth-input"
                                        placeholder="Nombre del gasto"
                                        value={newExpense.name}
                                        onChange={e => setNewExpense(prev => ({ ...prev, name: e.target.value }))}
                                    />
                                    <div style={{ position: 'relative' }}>
                                        <span className="onboarding-currency-prefix">$</span>
                                        <input
                                            className="wealth-input"
                                            style={{ paddingLeft: 28 }}
                                            type="number"
                                            placeholder="Monto"
                                            value={newExpense.amount}
                                            onChange={e => setNewExpense(prev => ({ ...prev, amount: e.target.value }))}
                                            onKeyDown={e => e.key === 'Enter' && addExpense()}
                                        />
                                    </div>
                                    <select
                                        className="wealth-input"
                                        value={newExpense.category}
                                        onChange={e => setNewExpense(prev => ({ ...prev, category: e.target.value }))}
                                    >
                                        {EXPENSE_CATEGORIES.map(c => (
                                            <option key={c.value} value={c.value}>{c.label}</option>
                                        ))}
                                    </select>
                                    <button className="btn-wealth" style={{ flexShrink: 0 }} onClick={addExpense}>
                                        <Plus size={14} />
                                    </button>
                                </div>

                                {fixedExpenses.length > 0 && (
                                    <div className="onboarding-expense-list">
                                        {fixedExpenses.map(expense => (
                                            <div key={expense.id} className="onboarding-expense-item">
                                                <div>
                                                    <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)' }}>{expense.name}</div>
                                                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                        {EXPENSE_CATEGORIES.find(c => c.value === expense.category)?.label}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                                    <span style={{ fontFamily: 'Space Grotesk', fontWeight: 700, color: 'var(--danger)' }}>
                                                        -{formatCurrency(parseFloat(expense.amount) || 0)}
                                                    </span>
                                                    <button className="onboarding-remove-btn" onClick={() => removeExpense(expense.id)}>
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="onboarding-summary-row">
                                    <div className="onboarding-summary-pill" style={{ flex: 1 }}>
                                        <Repeat size={16} />
                                        <span>Total Gastos Fijos:</span>
                                        <strong style={{ color: 'var(--danger)' }}>{formatCurrency(totalFixed)}</strong>
                                    </div>
                                    {fixedRatio > 70 && (
                                        <div className="onboarding-warning-pill">
                                            ⚠️ Tus gastos fijos son el {fixedRatio}% de tu ingreso
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* STEP 2: First Goal */}
                        {step === 2 && (
                            <div className="onboarding-form">
                                <div className="form-group">
                                    <label className="form-label">Nombre de la Meta</label>
                                    <input
                                        className="wealth-input"
                                        placeholder="Ej: Fondo de Emergencia, Vacaciones..."
                                        value={goalName}
                                        onChange={e => setGoalName(e.target.value)}
                                    />
                                </div>
                                <div className="onboarding-goal-row">
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label">Monto Objetivo</label>
                                        <div style={{ position: 'relative' }}>
                                            <span className="onboarding-currency-prefix">$</span>
                                            <input
                                                className="wealth-input"
                                                style={{ paddingLeft: 28 }}
                                                type="number"
                                                placeholder="1.000.000"
                                                value={goalAmount}
                                                onChange={e => setGoalAmount(e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group" style={{ flex: 1 }}>
                                        <label className="form-label">Fecha Límite</label>
                                        <input
                                            className="wealth-input"
                                            type="date"
                                            value={goalDeadline}
                                            onChange={e => setGoalDeadline(e.target.value)}
                                        />
                                    </div>
                                </div>

                                {goalName && goalAmount && available > 0 && (
                                    <div className="onboarding-projection-card">
                                        <div className="onboarding-projection-header">
                                            <TrendingUp size={16} color="#00e5c3" />
                                            <span>Proyección Estimada</span>
                                        </div>
                                        <p>
                                            Si ahorras {formatCurrency(Math.round(available * 0.5))}/mes,
                                            podrías alcanzar <strong>{goalName}</strong> en aproximadamente{' '}
                                            <strong>
                                                {Math.ceil((parseFloat(goalAmount) || 0) / (available * 0.5))} meses
                                            </strong>.
                                        </p>
                                    </div>
                                )}

                                <p className="onboarding-optional-note">
                                    Este paso es opcional. Puedes crear más metas después.
                                </p>
                            </div>
                        )}

                        {/* STEP 3: Review */}
                        {step === 3 && (
                            <div className="onboarding-form">
                                <div className="onboarding-review-card">
                                    <h3>Simulación del Mes Actual</h3>

                                    <div className="onboarding-review-grid">
                                        <div className="onboarding-review-item">
                                            <span className="onboarding-review-label">Ingresos</span>
                                            <span className="onboarding-review-value" style={{ color: 'var(--success)' }}>
                                                +{formatCurrency(totalIncome)}
                                            </span>
                                        </div>
                                        <div className="onboarding-review-item">
                                            <span className="onboarding-review-label">Gastos Fijos</span>
                                            <span className="onboarding-review-value" style={{ color: 'var(--danger)' }}>
                                                -{formatCurrency(totalFixed)}
                                            </span>
                                        </div>
                                        <div className="onboarding-review-item">
                                            <span className="onboarding-review-label">Variables Estimados</span>
                                            <span className="onboarding-review-value" style={{ color: 'var(--warning)' }}>
                                                ~{formatCurrency(variableEstimate)}
                                            </span>
                                        </div>
                                        <div className="onboarding-review-item onboarding-review-highlight">
                                            <span className="onboarding-review-label">Disponible</span>
                                            <span className="onboarding-review-value" style={{ color: 'var(--info)', fontSize: 28 }}>
                                                {formatCurrency(available)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <FlowTimeline
                                    income={totalIncome}
                                    fixedTotal={totalFixed}
                                    variableEstimate={variableEstimate}
                                    available={available}
                                    goalAmount={parseFloat(goalAmount) || 0}
                                />

                                {fixedRatio > 70 && (
                                    <div className="onboarding-warning-pill" style={{ justifyContent: 'center' }}>
                                        ⚠️ Tus gastos fijos representan el {fixedRatio}% de tu ingreso — considera optimizar
                                    </div>
                                )}

                                <div className="onboarding-status-badge" style={{
                                    background: available > totalIncome * 0.2 ? 'var(--success-muted)' : available > 0 ? 'var(--warning-muted)' : 'var(--danger-muted)',
                                    borderColor: available > totalIncome * 0.2 ? 'var(--success-subtle)' : available > 0 ? 'var(--warning-subtle)' : 'var(--danger-subtle)',
                                    color: available > totalIncome * 0.2 ? 'var(--success)' : available > 0 ? 'var(--warning)' : 'var(--danger)',
                                }}>
                                    {available > totalIncome * 0.2 ? '🟢 Estable' : available > 0 ? '🟡 Ajustado' : '🔴 Riesgo'}
                                    {' — '}
                                    {available > totalIncome * 0.2
                                        ? 'Tienes buen margen para ahorrar e invertir.'
                                        : available > 0
                                            ? 'Margen limitado. Cada peso cuenta.'
                                            : 'Tus gastos superan tus ingresos. Necesitas optimizar.'
                                    }
                                </div>
                            </div>
                        )}
                    </motion.div>
                </AnimatePresence>

                {/* Navigation */}
                <div className="onboarding-nav-buttons">
                    {step > 0 && (
                        <button className="btn-wealth btn-wealth-outline" onClick={goPrev}>
                            <ArrowLeft size={16} /> Atrás
                        </button>
                    )}
                    <div style={{ flex: 1 }} />
                    {step < 3 ? (
                        <button className="btn-wealth" onClick={goNext} disabled={!isStepValid}>
                            Siguiente <ArrowRight size={16} />
                        </button>
                    ) : (
                        <button className="btn-wealth landing-cta-lg" onClick={finishOnboarding}>
                            <Sparkles size={16} /> Comenzar Mi Viaje Financiero
                        </button>
                    )}
                </div>

                <div className="onboarding-footer-text">
                    Diseñado para construir tu éxito financiero · MetaFlow
                </div>
            </div>
        </div>
    );
}
