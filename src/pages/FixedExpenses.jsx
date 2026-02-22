import { useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { usePrivacy, PrivacyAmount } from '../context/PrivacyContext';
import { formatCurrency } from '../utils/helpers';
import {
    Plus, Edit3, Trash2, ToggleLeft, ToggleRight,
    Repeat, Home, Wifi, Bus, Shield, Music, CreditCard,
    Package, X, CheckCircle, AlertTriangle, DollarSign,
    BarChart3, Calendar, ArrowUpRight
} from 'lucide-react';

const CATEGORIES = [
    { value: 'vivienda', label: 'Vivienda', icon: Home, color: '#f04444' },
    { value: 'servicios', label: 'Servicios', icon: Wifi, color: '#f5a623' },
    { value: 'internet', label: 'Internet / Tel.', icon: Wifi, color: '#3b82f6' },
    { value: 'transporte', label: 'Transporte', icon: Bus, color: '#60b8f0' },
    { value: 'seguros', label: 'Seguros', icon: Shield, color: '#a855f7' },
    { value: 'suscripciones', label: 'Suscripciones', icon: Music, color: '#ec4899' },
    { value: 'deudas', label: 'Deudas', icon: CreditCard, color: '#ef4444' },
    { value: 'otros', label: 'Otros', icon: Package, color: '#6b7280' },
];

const FREQUENCIES = [
    { value: 'weekly', label: 'Semanal', multiplier: 4.33 },
    { value: 'monthly', label: 'Mensual', multiplier: 1 },
    { value: 'yearly', label: 'Anual', multiplier: 1 / 12 },
];

const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};
const item = {
    hidden: { y: 12, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { duration: 0.4, ease: [0.16, 1, 0.3, 1] } },
};

export default function FixedExpenses() {
    const { state, dispatch } = useApp();
    const { addToast } = useToast();
    const fixedExpenses = state.fixedExpenses || [];
    const profile = state.profile || {};

    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({ name: '', amount: '', category: 'vivienda', frequency: 'monthly', nextDueDate: '' });

    // Monthly income
    const monthlyIncome = useMemo(() => {
        return (profile.incomeSources || []).reduce((s, src) => s + (parseFloat(src.amount) || 0), 0);
    }, [profile.incomeSources]);

    // Total monthly impact
    const totalMonthly = useMemo(() => {
        return fixedExpenses.filter(e => e.active !== false).reduce((sum, e) => {
            const amt = parseFloat(e.amount) || 0;
            const freq = FREQUENCIES.find(f => f.value === e.frequency);
            return sum + amt * (freq?.multiplier || 1);
        }, 0);
    }, [fixedExpenses]);

    const pressureIndex = useMemo(() => {
        return monthlyIncome > 0 ? Math.round((totalMonthly / monthlyIncome) * 100) : 0;
    }, [totalMonthly, monthlyIncome]);

    const remaining = useMemo(() => Math.max(0, monthlyIncome - totalMonthly), [monthlyIncome, totalMonthly]);

    const categoryBreakdown = useMemo(() => {
        const breakdown = {};
        fixedExpenses.filter(e => e.active !== false).forEach(e => {
            const cat = e.category || 'otros';
            const amt = parseFloat(e.amount) || 0;
            const freq = FREQUENCIES.find(f => f.value === e.frequency);
            breakdown[cat] = (breakdown[cat] || 0) + amt * (freq?.multiplier || 1);
        });
        return Object.entries(breakdown)
            .map(([cat, amount]) => ({
                ...CATEGORIES.find(c => c.value === cat) || CATEGORIES[CATEGORIES.length - 1],
                amount,
                percent: totalMonthly > 0 ? Math.round((amount / totalMonthly) * 100) : 0,
            }))
            .sort((a, b) => b.amount - a.amount);
    }, [fixedExpenses, totalMonthly]);

    const resetForm = useCallback(() => {
        setForm({ name: '', amount: '', category: 'vivienda', frequency: 'monthly', nextDueDate: '' });
        setEditingId(null);
        setShowForm(false);
    }, []);

    const handleSave = useCallback(() => {
        if (!form.name || !form.amount || parseFloat(form.amount) <= 0) {
            addToast('Completa nombre y monto', { type: 'warning' });
            return;
        }

        if (editingId) {
            dispatch({
                type: 'UPDATE_FIXED_EXPENSE',
                payload: { id: editingId, ...form, amount: parseFloat(form.amount) },
            });
            addToast(`"${form.name}" actualizado`, { type: 'success' });
        } else {
            dispatch({
                type: 'ADD_FIXED_EXPENSE',
                payload: { ...form, amount: parseFloat(form.amount) },
            });
            addToast(`"${form.name}" agregado`, { type: 'success', xpAmount: 10 });
        }
        resetForm();
    }, [form, editingId, dispatch, addToast, resetForm]);

    const handleEdit = useCallback((expense) => {
        setForm({
            name: expense.name,
            amount: String(expense.amount),
            category: expense.category || 'vivienda',
            frequency: expense.frequency || 'monthly',
            nextDueDate: expense.nextDueDate || '',
        });
        setEditingId(expense.id);
        setShowForm(true);
    }, []);

    const handleToggle = useCallback((id) => {
        dispatch({ type: 'TOGGLE_FIXED_EXPENSE', payload: id });
    }, [dispatch]);

    const handleDelete = useCallback((id, name) => {
        dispatch({ type: 'DELETE_FIXED_EXPENSE', payload: id });
        addToast(`"${name}" eliminado`, { type: 'info', action: { label: 'Deshacer', onClick: () => dispatch({ type: 'UNDO_LAST' }) } });
    }, [dispatch, addToast]);

    return (
        <motion.div className="page-content" variants={container} initial="hidden" animate="show">
            {/* Header */}
            <motion.div variants={item} className="page-header" style={{ marginBottom: 28 }}>
                <div>
                    <h1 className="page-title" style={{ fontSize: 24, marginBottom: 4 }}>
                        <Repeat size={20} style={{ verticalAlign: 'text-bottom', marginRight: 8, color: 'var(--accent-primary)' }} />
                        Gastos Fijos
                    </h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Controla tus costos recurrentes y su impacto en tu presupuesto.</p>
                </div>
                <button className="btn-wealth" onClick={() => { resetForm(); setShowForm(true); }}>
                    <Plus size={14} /> Agregar Gasto
                </button>
            </motion.div>

            {/* Summary Cards */}
            <div className="bento-grid" style={{ marginBottom: 24 }}>
                <motion.div variants={item} className="card-wealth bento-span-4">
                    <div className="card-header">
                        <div className="card-header-icon" style={{ background: 'var(--danger-muted)' }}>
                            <DollarSign size={16} color="var(--danger)" />
                        </div>
                        <h3 style={{ fontSize: 13, flex: 1 }}>Total Mensual</h3>
                    </div>
                    <PrivacyAmount>
                        <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk', color: 'var(--danger)', letterSpacing: '-0.03em' }}>
                            {formatCurrency(totalMonthly)}
                        </div>
                    </PrivacyAmount>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        {fixedExpenses.filter(e => e.active !== false).length} gastos fijos activos
                    </div>
                </motion.div>

                <motion.div variants={item} className="card-wealth bento-span-4">
                    <div className="card-header">
                        <div className="card-header-icon" style={{ background: pressureIndex > 70 ? 'var(--danger-muted)' : pressureIndex > 50 ? 'var(--warning-muted)' : 'var(--success-muted)' }}>
                            <BarChart3 size={16} color={pressureIndex > 70 ? 'var(--danger)' : pressureIndex > 50 ? 'var(--warning)' : 'var(--success)'} />
                        </div>
                        <h3 style={{ fontSize: 13, flex: 1 }}>Presión Financiera</h3>
                    </div>
                    <div style={{
                        fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk', letterSpacing: '-0.03em',
                        color: pressureIndex > 70 ? 'var(--danger)' : pressureIndex > 50 ? 'var(--warning)' : 'var(--success)',
                    }}>
                        {pressureIndex}%
                    </div>
                    <div className="liquid-progress" style={{ height: 5, marginTop: 8 }}>
                        <motion.div className="liquid-progress-fill"
                            style={{
                                background: pressureIndex > 70 ? 'var(--danger)' : pressureIndex > 50 ? 'var(--warning)' : 'var(--accent-gradient)',
                            }}
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(100, pressureIndex)}%` }}
                            transition={{ duration: 1 }}
                        />
                    </div>
                    {pressureIndex > 70 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 11, color: 'var(--danger)' }}>
                            <AlertTriangle size={12} /> Supera el 70% recomendado
                        </div>
                    )}
                </motion.div>

                <motion.div variants={item} className="card-wealth bento-span-4">
                    <div className="card-header">
                        <div className="card-header-icon" style={{ background: 'var(--success-muted)' }}>
                            <ArrowUpRight size={16} color="var(--accent-primary)" />
                        </div>
                        <h3 style={{ fontSize: 13, flex: 1 }}>Restante Mensual</h3>
                    </div>
                    <PrivacyAmount>
                        <div style={{ fontSize: 28, fontWeight: 800, fontFamily: 'Space Grotesk', color: 'var(--success)', letterSpacing: '-0.03em' }}>
                            {formatCurrency(remaining)}
                        </div>
                    </PrivacyAmount>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>
                        Después de fijos
                    </div>
                </motion.div>
            </div>

            {/* Category Breakdown */}
            {categoryBreakdown.length > 0 && (
                <motion.div variants={item} className="card-wealth" style={{ marginBottom: 24 }}>
                    <div className="card-header">
                        <h3 style={{ fontSize: 14 }}>Desglose por Categoría</h3>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {categoryBreakdown.map(cat => {
                            const Icon = cat.icon || Package;
                            return (
                                <div key={cat.value} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                    <div style={{
                                        width: 32, height: 32, borderRadius: 8,
                                        background: `${cat.color}12`, display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    }}>
                                        <Icon size={14} color={cat.color} />
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div className="flex-between" style={{ marginBottom: 4 }}>
                                            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{cat.label}</span>
                                            <PrivacyAmount>
                                                <span style={{ fontSize: 13, fontFamily: 'Space Grotesk', fontWeight: 700 }}>
                                                    {formatCurrency(cat.amount)}
                                                </span>
                                            </PrivacyAmount>
                                        </div>
                                        <div className="liquid-progress" style={{ height: 3 }}>
                                            <motion.div className="liquid-progress-fill"
                                                style={{ background: cat.color }}
                                                initial={{ width: 0 }}
                                                animate={{ width: `${cat.percent}%` }}
                                                transition={{ duration: 0.8 }}
                                            />
                                        </div>
                                    </div>
                                    <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 36, textAlign: 'right' }}>
                                        {cat.percent}%
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </motion.div>
            )}

            {/* Expense List */}
            <motion.div variants={item}>
                {fixedExpenses.length === 0 ? (
                    <div className="card-wealth">
                        <div className="empty-state" style={{ padding: '48px 24px' }}>
                            <Repeat size={40} className="empty-state-icon" />
                            <h2 style={{ fontSize: 16 }}>Sin gastos fijos registrados</h2>
                            <p>Agrega tus costos recurrentes para ver el impacto real en tu presupuesto.</p>
                            <button className="btn-wealth" onClick={() => setShowForm(true)}>
                                <Plus size={14} /> Agregar Primer Gasto
                            </button>
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {fixedExpenses.map(expense => {
                            const cat = CATEGORIES.find(c => c.value === expense.category) || CATEGORIES[CATEGORIES.length - 1];
                            const Icon = cat.icon;
                            const freq = FREQUENCIES.find(f => f.value === expense.frequency);
                            const isActive = expense.active !== false;
                            return (
                                <motion.div
                                    key={expense.id}
                                    className="card-wealth"
                                    style={{ opacity: isActive ? 1 : 0.5, transition: 'opacity 0.2s' }}
                                    layout
                                >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                        <div style={{
                                            width: 40, height: 40, borderRadius: 10,
                                            background: `${cat.color}12`, display: 'flex',
                                            alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                        }}>
                                            <Icon size={18} color={cat.color} />
                                        </div>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>{expense.name}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                                                {cat.label} · {freq?.label || 'Mensual'}
                                                {expense.nextDueDate && ` · Próx: ${expense.nextDueDate}`}
                                            </div>
                                        </div>
                                        <PrivacyAmount>
                                            <span style={{
                                                fontSize: 16, fontWeight: 700, fontFamily: 'Space Grotesk',
                                                color: isActive ? 'var(--danger)' : 'var(--text-muted)',
                                            }}>
                                                -{formatCurrency(parseFloat(expense.amount) || 0)}
                                            </span>
                                        </PrivacyAmount>
                                        <div style={{ display: 'flex', gap: 4 }}>
                                            <button
                                                onClick={() => handleToggle(expense.id)}
                                                className="onboarding-remove-btn"
                                                style={{ color: isActive ? 'var(--success)' : 'var(--text-muted)', width: 32, height: 32 }}
                                                title={isActive ? 'Desactivar' : 'Activar'}
                                            >
                                                {isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                                            </button>
                                            <button
                                                onClick={() => handleEdit(expense)}
                                                className="onboarding-remove-btn"
                                                style={{ color: 'var(--text-muted)', width: 32, height: 32 }}
                                                title="Editar"
                                            >
                                                <Edit3 size={14} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(expense.id, expense.name)}
                                                className="onboarding-remove-btn"
                                                style={{ color: 'var(--danger)', width: 32, height: 32 }}
                                                title="Eliminar"
                                            >
                                                <Trash2 size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </motion.div>

            {/* Modal Form */}
            <AnimatePresence>
                {showForm && (
                    <motion.div
                        className="modal-overlay"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={resetForm}
                    >
                        <motion.div
                            className="modal-content"
                            initial={{ y: 20, opacity: 0, scale: 0.97 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            exit={{ y: 20, opacity: 0, scale: 0.97 }}
                            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                            onClick={e => e.stopPropagation()}
                        >
                            <button className="modal-close" onClick={resetForm}><X size={18} /></button>
                            <div className="modal-title">
                                {editingId ? 'Editar Gasto Fijo' : 'Nuevo Gasto Fijo'}
                            </div>

                            <div className="form-group">
                                <label className="form-label">Nombre</label>
                                <input
                                    className="wealth-input"
                                    placeholder="Ej: Arriendo, Netflix, Luz..."
                                    value={form.name}
                                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                                    autoFocus
                                />
                            </div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">Monto</label>
                                    <div style={{ position: 'relative' }}>
                                        <span style={{
                                            position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                                            fontSize: 13, color: 'var(--text-muted)', fontWeight: 500,
                                        }}>$</span>
                                        <input
                                            className="wealth-input"
                                            type="number"
                                            placeholder="0"
                                            style={{ paddingLeft: 28 }}
                                            value={form.amount}
                                            onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                                        />
                                    </div>
                                </div>
                                <div className="form-group" style={{ flex: 1 }}>
                                    <label className="form-label">Frecuencia</label>
                                    <select
                                        className="wealth-input"
                                        value={form.frequency}
                                        onChange={e => setForm(p => ({ ...p, frequency: e.target.value }))}
                                    >
                                        {FREQUENCIES.map(f => (
                                            <option key={f.value} value={f.value}>{f.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Categoría</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                                    {CATEGORIES.map(cat => {
                                        const Icon = cat.icon;
                                        return (
                                            <button
                                                key={cat.value}
                                                onClick={() => setForm(p => ({ ...p, category: cat.value }))}
                                                style={{
                                                    padding: '10px 6px', borderRadius: 10,
                                                    border: form.category === cat.value ? `2px solid ${cat.color}` : '1px solid var(--border-secondary)',
                                                    background: form.category === cat.value ? `${cat.color}12` : 'var(--bg-elevated)',
                                                    color: 'var(--text-secondary)', fontSize: 10,
                                                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                                                    cursor: 'pointer', transition: 'all 0.15s',
                                                }}
                                            >
                                                <Icon size={16} color={form.category === cat.value ? cat.color : 'var(--text-muted)'} />
                                                {cat.label}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                            <div className="form-group">
                                <label className="form-label">Próximo Vencimiento (Opcional)</label>
                                <input
                                    className="wealth-input"
                                    type="date"
                                    value={form.nextDueDate}
                                    onChange={e => setForm(p => ({ ...p, nextDueDate: e.target.value }))}
                                />
                            </div>
                            <div className="form-actions">
                                <button className="btn-wealth btn-wealth-outline" onClick={resetForm}>
                                    Cancelar
                                </button>
                                <button className="btn-wealth" onClick={handleSave}>
                                    <CheckCircle size={14} />
                                    {editingId ? 'Guardar Cambios' : 'Agregar Gasto'}
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
