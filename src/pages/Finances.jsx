import { useState, useMemo, useCallback } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import Modal from '../components/Modal';
import { SkeletonTransactions } from '../components/Skeleton';
import {
    formatCurrency,
    formatDate,
    getTransactionCategories,
} from '../utils/helpers';
import {
    Plus, Trash2, ArrowUpRight, ArrowDownRight, Wallet,
    Activity, Database, ShieldCheck, ChevronRight, Search,
    Filter, PiggyBank, Calendar, FileText, Tag, DollarSign, Target
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';


export default function Finances() {
    const { state, dispatch } = useApp();
    const { addToast } = useToast();
    const { transactions, goals, isLoaded } = state;
    const [showForm, setShowForm] = useState(false);
    const [activeTab, setActiveTab] = useState('todos');
    const [formData, setFormData] = useState({
        type: 'ingreso', amount: '', category: '', date: new Date().toISOString().split('T')[0], note: '', goalId: '',
    });

    const filteredTransactions = useMemo(() => {
        if (activeTab === 'todos') return transactions;
        return transactions.filter(t => t.type === activeTab);
    }, [transactions, activeTab]);

    const totals = useMemo(() => {
        const income = transactions.filter(t => t.type === 'ingreso').reduce((sum, t) => sum + t.amount, 0);
        const expenses = transactions.filter(t => t.type === 'gasto').reduce((sum, t) => sum + t.amount, 0);
        const savings = transactions.filter(t => t.type === 'ahorro').reduce((sum, t) => sum + t.amount, 0);
        return { income, expenses, savings, balance: income - expenses - savings };
    }, [transactions]);

    const handleSubmit = useCallback(async (e) => {
        e.preventDefault();
        const amount = Number(formData.amount);
        const transaction = {
            type: formData.type,
            amount: amount,
            category: formData.category,
            date: formData.date ? new Date(formData.date).toISOString() : new Date().toISOString(),
            note: formData.note,
        };

        try {
            dispatch({ type: 'ADD_TRANSACTION', payload: transaction });

            if (formData.type === 'ahorro' && formData.goalId) {
                dispatch({ type: 'ADD_SAVINGS_TO_GOAL', payload: { goalId: formData.goalId, amount } });
            }

            addToast(`Registro guardado: ${formatCurrency(amount)}`, { type: 'success' });
            setFormData({ type: 'ingreso', amount: '', category: '', date: new Date().toISOString().split('T')[0], note: '', goalId: '' });
            setShowForm(false);
        } catch (error) {
            addToast(`Error al procesar movimiento: ${error.message}`, { type: 'error' });
        }
    }, [formData, dispatch, addToast]);

    const handleDelete = useCallback((transactionId) => {
        dispatch({ type: 'DELETE_TRANSACTION', payload: transactionId });
        addToast(`Movimiento eliminado`, { type: 'warning' });
    }, [dispatch, addToast]);

    if (!isLoaded) return <div className="page-content"><SkeletonTransactions /></div>;

    const tabs = [
        { key: 'todos', label: 'Todos' },
        { key: 'ingreso', label: 'Ingresos' },
        { key: 'gasto', label: 'Gastos' },
        { key: 'ahorro', label: 'Ahorros' },
    ];

    const typeLabels = {
        ingreso: 'INGRESO',
        gasto: 'GASTO',
        ahorro: 'AHORRO'
    };

    return (
        <div className="page-content fade-and-slide">
            <div className="page-header" style={{ marginBottom: 48 }}>
                <div className="flex-between">
                    <div>
                        <h1 className="page-title" style={{ fontSize: 36 }}>Movimientos de Dinero</h1>
                        <p className="page-subtitle">Gestión integral de flujos financieros</p>
                    </div>
                    <button className="btn-wealth" onClick={() => setShowForm(true)}>
                        <Plus size={18} /> Nuevo Movimiento
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="bento-grid" style={{ marginBottom: 48 }}>
                <div className="bento-span-3 card-wealth">
                    <div style={{ color: 'var(--accent-primary)', marginBottom: 8 }}><ArrowUpRight size={20} /></div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Ingresos</div>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>{formatCurrency(totals.income)}</div>
                </div>
                <div className="bento-span-3 card-wealth">
                    <div style={{ color: 'var(--danger)', marginBottom: 8 }}><ArrowDownRight size={20} /></div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Gastos</div>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>{formatCurrency(totals.expenses)}</div>
                </div>
                <div className="bento-span-3 card-wealth">
                    <div style={{ color: 'var(--accent-primary)', marginBottom: 8 }}><PiggyBank size={20} /></div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Ahorrado</div>
                    <div style={{ fontSize: 24, fontWeight: 700 }}>{formatCurrency(totals.savings)}</div>
                </div>
                <div className="bento-span-3 card-wealth shimmer-metal">
                    <div style={{ color: 'var(--accent-primary)', marginBottom: 8 }}><Wallet size={20} /></div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Saldo Disponible</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: totals.balance >= 0 ? 'var(--accent-primary)' : 'var(--danger)' }}>{formatCurrency(totals.balance)}</div>
                </div>
            </div>

            {/* Filters */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        className={`btn-wealth ${activeTab === tab.key ? '' : 'btn-wealth-outline'}`}
                        style={{ padding: '8px 20px', fontSize: 13 }}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="card-wealth" style={{ padding: 0, overflow: 'hidden' }}>
                {filteredTransactions.length === 0 ? (
                    <div style={{ padding: 80, textAlign: 'center', opacity: 0.5 }}>
                        <Database size={48} strokeWidth={1} style={{ marginBottom: 16 }} />
                        <p>No hay movimientos registrados.</p>
                        <button className="btn-wealth" style={{ marginTop: 24 }} onClick={() => setShowForm(true)}>Agregar movimiento</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {filteredTransactions.map(t => (
                            <div key={t.id} className="shimmer-metal" style={{
                                padding: '20px 32px', borderBottom: '1px solid rgba(255,255,255,0.03)',
                                display: 'flex', alignItems: 'center', gap: 24,
                                transition: 'all 0.3s ease'
                            }}>
                                <div style={{
                                    width: 40, height: 40, borderRadius: 10,
                                    background: 'rgba(255,255,255,0.02)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: t.type === 'ingreso' ? 'var(--accent-primary)' : t.type === 'gasto' ? 'var(--danger)' : 'var(--accent-warm)'
                                }}>
                                    {t.type === 'ingreso' ? <ArrowUpRight size={20} /> : t.type === 'gasto' ? <ArrowDownRight size={20} /> : <PiggyBank size={20} />}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.note || t.category}</div>
                                    <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 4 }}>
                                        {formatDate(t.date)} | {getTransactionCategories(t.type).find(c => c.value === t.category)?.label || t.category}
                                    </div>
                                </div>
                                <div style={{ textAlign: 'right', marginLeft: 16 }}>
                                    <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Space Grotesk', color: t.type === 'gasto' ? 'var(--danger)' : 'var(--accent-primary)' }}>
                                        {t.type === 'gasto' ? '-' : '+'}{formatCurrency(t.amount)}
                                    </div>
                                    <button onClick={() => handleDelete(t.id)} style={{ background: 'none', border: 'none', color: 'var(--danger)', opacity: 0.4, cursor: 'pointer', padding: 4, marginTop: 4 }}><Trash2 size={14} /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Nuevo Movimiento">
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>TIPO DE REGISTRO</label>
                        <div style={{ display: 'flex', gap: 8, background: 'rgba(255,255,255,0.03)', padding: 4, borderRadius: 12 }}>
                            {['ingreso', 'gasto', 'ahorro'].map(type => (
                                <button key={type} type="button" className={`btn-wealth`} style={{
                                    flex: 1, border: 'none',
                                    background: formData.type === type ? 'var(--accent-primary)' : 'transparent',
                                    color: formData.type === type ? '#000' : 'var(--text-muted)',
                                    boxShadow: formData.type === type ? '0 0 15px rgba(0, 245, 212, 0.2)' : 'none',
                                    transition: 'all 0.3s ease'
                                }} onClick={() => setFormData({ ...formData, type, category: '' })}>
                                    {typeLabels[type]}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="bento-grid" style={{ gridAutoRows: 'auto', gap: 16 }}>
                        <div className="bento-span-6 form-group">
                            <label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>MONTO</label>
                            <div style={{ position: 'relative' }}>
                                <DollarSign size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input className="wealth-input" style={{ paddingLeft: 40 }} type="number" placeholder="0.00" value={formData.amount} onChange={e => setFormData({ ...formData, amount: e.target.value })} required min="1" />
                            </div>
                        </div>
                        <div className="bento-span-6 form-group">
                            <label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>FECHA</label>
                            <div style={{ position: 'relative' }}>
                                <Calendar size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input className="wealth-input" style={{ paddingLeft: 40 }} type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required />
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>CATEGORÍA</label>
                        <div style={{ position: 'relative' }}>
                            <Tag size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                            <select className="wealth-input" style={{ paddingLeft: 40, background: '#1c1c1d' }} value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })} required>
                                <option value="">Selecciona una categoría...</option>
                                {getTransactionCategories(formData.type).map(cat => (
                                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {formData.type === 'ahorro' && (
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>VINCULAR A META</label>
                            <div style={{ position: 'relative' }}>
                                <Target size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                                <select className="wealth-input" style={{ paddingLeft: 40, background: '#1c1c1d' }} value={formData.goalId} onChange={e => setFormData({ ...formData, goalId: e.target.value })}>
                                    <option value="">Ninguna meta específica</option>
                                    {goals.map(g => (
                                        <option key={g.id} value={g.id}>{g.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}

                    <div className="form-group" style={{ marginBottom: 32 }}>
                        <label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>NOTA (OPCIONAL)</label>
                        <div style={{ position: 'relative' }}>
                            <FileText size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input className="wealth-input" style={{ paddingLeft: 40 }} placeholder="¿Qué compraste?" value={formData.note} onChange={e => setFormData({ ...formData, note: e.target.value })} />
                        </div>
                    </div>

                    <div className="form-actions" style={{ border: 'none', padding: 0 }}>
                        <button type="button" className="btn-wealth btn-wealth-outline" style={{ height: 48, paddingInline: 24 }} onClick={() => setShowForm(false)}>Cancelar</button>
                        <button type="submit" className="btn-wealth" style={{ flex: 1, height: 48, justifyContent: 'center' }}>Guardar Movimiento</button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
