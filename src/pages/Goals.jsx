import { useState, useCallback, useMemo } from 'react';
import { useApp } from '../context/AppContext';
import { useToast } from '../context/ToastContext';
import { repository } from '../lib/repository';
import WealthRing from '../components/WealthRing';
import Modal from '../components/Modal';
import GoalImageUpload, { getLocalGoalImage } from '../components/GoalImageUpload';
import { SkeletonGoalCards } from '../components/Skeleton';
import { motion, AnimatePresence } from 'framer-motion';
import {
    formatCurrency,
    formatDate,
    getProgressPercentage,
    calculateSavingsRecommendation,
    daysRemaining,
    getPriorityLabel
} from '../utils/helpers';
import {
    Plus, Edit3, Trash2, PiggyBank, Target, ArrowUpRight,
    Calendar, Shield, Zap, TrendingUp, Info, Clock, Type, DollarSign, Tag, FileText
} from 'lucide-react';

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const item = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
};

export default function Goals() {
    const { state, dispatch } = useApp();
    const { addToast } = useToast();
    const { goals, isLoaded } = state;
    const [showForm, setShowForm] = useState(false);
    const [showDetail, setShowDetail] = useState(null);
    const [showAddSavings, setShowAddSavings] = useState(null);
    const [editingGoal, setEditingGoal] = useState(null);
    const [savingsAmount, setSavingsAmount] = useState('');
    const [formData, setFormData] = useState({
        name: '', targetAmount: '', deadline: '', description: '', priority: 'media', icon: 'Target', imageUrl: '',
    });

    const openNew = useCallback(() => {
        setEditingGoal(null);
        setFormData({ name: '', targetAmount: '', deadline: '', description: '', priority: 'media', icon: 'Target', imageUrl: '' });
        setShowForm(true);
    }, []);

    const openEdit = useCallback((goal) => {
        setEditingGoal(goal);
        setFormData({
            name: goal.name,
            targetAmount: goal.targetAmount.toString(),
            deadline: goal.deadline ? goal.deadline.split('T')[0] : '',
            description: goal.description || '',
            priority: goal.priority || 'media',
            icon: goal.icon || 'Target',
            imageUrl: goal.imageUrl || getLocalGoalImage(goal.id) || '',
        });
        setShowForm(true);
    }, []);

    const handleSubmit = useCallback((e) => {
        e.preventDefault();
        const goalData = {
            name: formData.name,
            targetAmount: Number(formData.targetAmount),
            deadline: formData.deadline,
            description: formData.description,
            priority: formData.priority,
            icon: formData.icon,
            imageUrl: formData.imageUrl,
            currentAmount: editingGoal ? editingGoal.currentAmount : 0,
            createdAt: editingGoal ? editingGoal.createdAt : new Date().toISOString(),
        };

        if (editingGoal) {
            dispatch({ type: 'UPDATE_GOAL', payload: { ...goalData, id: editingGoal.id } });
            addToast(`Meta actualizada`, { type: 'success' });
        } else {
            dispatch({ type: 'ADD_GOAL', payload: goalData });
            addToast(`Meta creada`, { type: 'success' });
        }
        setShowForm(false);
    }, [formData, editingGoal, dispatch, addToast]);

    const handleDelete = useCallback((goalId) => {
        const goal = goals.find(g => g.id === goalId);
        if (!goal) return;
        dispatch({ type: 'DELETE_GOAL', payload: goalId });
        setShowDetail(null);
        addToast(`Meta eliminada`, { type: 'warning' });
    }, [goals, dispatch, addToast]);

    const handleAddSavings = useCallback(async (e) => {
        e.preventDefault();
        const amount = Number(savingsAmount);
        if (!savingsAmount || amount <= 0) return;

        const currentGoal = showAddSavings;
        const goalId = currentGoal.id;

        try {
            dispatch({ type: 'ADD_SAVINGS_TO_GOAL', payload: { goalId, amount } });

            dispatch({
                type: 'ADD_TRANSACTION', payload: {
                    type: 'ahorro',
                    amount: amount,
                    category: 'ahorro_meta',
                    date: new Date().toISOString(),
                    note: `Ahorro para: ${currentGoal.name}`,
                }
            });

            addToast(`${formatCurrency(amount)} añadidos`, { type: 'success' });
            setSavingsAmount('');
            setShowAddSavings(null);
        } catch (error) {
            addToast(`Error al sincronizar ahorro: ${error.message || 'Error de red'}`, { type: 'error' });
        }
    }, [savingsAmount, showAddSavings, dispatch, addToast]);

    const sortedGoals = useMemo(() => {
        return [...goals].sort((a, b) => {
            const priorityOrder = { alta: 0, media: 1, baja: 2 };
            return (priorityOrder[a.priority] || 1) - (priorityOrder[b.priority] || 1);
        });
    }, [goals]);

    if (!isLoaded) return <div className="page-content"><SkeletonGoalCards /></div>;

    return (
        <motion.div className="page-content" variants={container} initial="hidden" animate="show">
            <div className="page-header" style={{ marginBottom: 48 }}>
                <div className="flex-between">
                    <div>
                        <h1 className="page-title" style={{ fontSize: 36 }}>Metas de Ahorro</h1>
                        <p className="page-subtitle">Ingeniería de objetivos y materialización de activos</p>
                    </div>
                    <button className="btn-wealth" onClick={openNew} style={{ height: 44 }}>
                        <Plus size={18} /> Nueva Meta
                    </button>
                </div>
            </div>

            {sortedGoals.length === 0 ? (
                <motion.div variants={item} className="card-wealth" style={{ textAlign: 'center', padding: '80px 40px' }}>
                    <div style={{ color: 'var(--accent-primary)', marginBottom: 24, opacity: 0.5 }}><Target size={64} /></div>
                    <h2 className="font-title" style={{ fontSize: 24, marginBottom: 12 }}>Aún no tienes metas</h2>
                    <p style={{ color: 'var(--text-muted)', marginBottom: 32, maxWidth: 400, marginInline: 'auto' }}>
                        Define tu primer objetivo financiero para comenzar el seguimiento.
                    </p>
                    <button className="btn-wealth" onClick={openNew}>Crear meta inicial</button>
                </motion.div>
            ) : (
                <div className="bento-grid">
                    {sortedGoals.map(goal => {
                        const progress = getProgressPercentage(goal.currentAmount || 0, goal.targetAmount);
                        const goalImg = goal.imageUrl || getLocalGoalImage(goal.id);
                        const days = daysRemaining(goal.deadline);

                        return (
                            <motion.div key={goal.id} className="bento-span-4" variants={item}>
                                <div className="artifact-card" onClick={() => setShowDetail(goal)} style={{ cursor: 'pointer' }}>
                                    {goalImg ? (
                                        <img src={goalImg} className="artifact-image" alt="" />
                                    ) : (
                                        <div style={{
                                            width: '100%', height: '100%',
                                            display: 'flex', alignItems: 'center',
                                            justifyContent: 'center', background: 'linear-gradient(135deg, #141415, #0a0a0b)',
                                            color: 'var(--accent-primary)', opacity: 0.3
                                        }}>
                                            <Target size={64} strokeWidth={1} />
                                        </div>
                                    )}
                                    <div className="giant-metric" style={{ fontSize: 80, bottom: 0, right: 10 }}>{progress}%</div>
                                    <div className="artifact-overlay">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                                            <div>
                                                <div className="artifact-subtitle">{getPriorityLabel(goal.priority)}</div>
                                                <h3 className="artifact-title">{goal.name}</h3>
                                            </div>
                                            <div style={{ fontSize: 24, fontWeight: 700, color: 'var(--accent-primary)' }}>
                                                {progress}<span style={{ fontSize: 12, opacity: 0.6 }}>%</span>
                                            </div>
                                        </div>
                                        <div style={{
                                            width: '100%', height: 2,
                                            background: 'rgba(255,255,255,0.1)',
                                            marginTop: 12, borderRadius: 1, overflow: 'hidden'
                                        }}>
                                            <motion.div
                                                initial={{ width: 0 }}
                                                animate={{ width: `${progress}%` }}
                                                transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                                                style={{ height: '100%', background: 'var(--accent-primary)', boxShadow: '0 0 10px var(--accent-primary)' }}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div style={{ marginTop: 16, display: 'flex', justifyContent: 'space-between', paddingInline: 4 }}>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                        <TrendingUp size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                                        {formatCurrency(goal.currentAmount || 0)}
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                        <Calendar size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
                                        {days > 0 ? `${days} días` : 'Logrado'}
                                    </div>
                                </div>
                            </motion.div>
                        );
                    })}
                </div>
            )}

            {/* Goal Form Modal */}
            <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingGoal ? 'Editar Meta' : 'Nueva Meta Financiera'}>
                <form onSubmit={handleSubmit}>
                    <div style={{ marginBottom: 24 }}>
                        <GoalImageUpload
                            goalId={editingGoal?.id || 'new-goal-temp'}
                            currentImageUrl={formData.imageUrl}
                            onImageChange={(url) => setFormData({ ...formData, imageUrl: url || '' })}
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>NOMBRE DE LA META</label>
                        <div style={{ position: 'relative' }}>
                            <Type size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                            <input className="wealth-input" style={{ paddingLeft: 40 }} placeholder="Ej: Viaje a Japón, Fondo de Emergencia" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} required autoFocus />
                        </div>
                    </div>

                    <div className="bento-grid" style={{ gridAutoRows: 'auto', gap: 16 }}>
                        <div className="bento-span-6 form-group">
                            <label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>MONTO OBJETIVO</label>
                            <div style={{ position: 'relative' }}>
                                <DollarSign size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input className="wealth-input" style={{ paddingLeft: 40 }} type="number" placeholder="0.00" value={formData.targetAmount} onChange={e => setFormData({ ...formData, targetAmount: e.target.value })} required min="1" />
                            </div>
                        </div>
                        <div className="bento-span-6 form-group">
                            <label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>FECHA LÍMITE</label>
                            <div style={{ position: 'relative' }}>
                                <Calendar size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input className="wealth-input" style={{ paddingLeft: 40 }} type="date" value={formData.deadline} onChange={e => setFormData({ ...formData, deadline: e.target.value })} required />
                            </div>
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>PRIORIDAD</label>
                        <div style={{ position: 'relative' }}>
                            <Tag size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', zIndex: 1 }} />
                            <select className="wealth-input" style={{ paddingLeft: 40, background: '#1c1c1d' }} value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value })}>
                                <option value="alta">Alta (Urgente / Esencial)</option>
                                <option value="media">Media (Importante)</option>
                                <option value="baja">Baja (Opcional)</option>
                            </select>
                        </div>
                    </div>

                    <div className="form-group" style={{ marginBottom: 32 }}>
                        <label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>DESCRIPCIÓN (OPCIONAL)</label>
                        <div style={{ position: 'relative' }}>
                            <FileText size={14} style={{ position: 'absolute', left: 14, top: '24px', color: 'var(--text-muted)' }} />
                            <textarea className="wealth-input" style={{ paddingLeft: 40, minHeight: 80, resize: 'none', paddingTop: 12 }} placeholder="Detalles de tu objetivo..." value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
                        </div>
                    </div>

                    <div className="form-actions" style={{ border: 'none', padding: 0 }}>
                        <button type="button" className="btn-wealth btn-wealth-outline" style={{ height: 48, paddingInline: 24 }} onClick={() => setShowForm(false)}>Cancelar</button>
                        <button type="submit" className="btn-wealth" style={{ flex: 1, height: 48, justifyContent: 'center' }}>
                            {editingGoal ? 'Guardar Cambios' : 'Crear Meta'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Goal Detail Modal */}
            <Modal isOpen={!!showDetail} onClose={() => setShowDetail(null)} title={showDetail?.name || ''}>
                {showDetail && (
                    <div className="fade-and-slide">
                        {(showDetail.imageUrl || getLocalGoalImage(showDetail.id)) && (
                            <div style={{ borderRadius: 12, overflow: 'hidden', height: 160, marginBottom: 24, border: 'var(--glass-border)' }}>
                                <img src={showDetail.imageUrl || getLocalGoalImage(showDetail.id)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                            </div>
                        )}

                        <div style={{ display: 'flex', gap: 32, marginBottom: 32, alignItems: 'center' }}>
                            <WealthRing current={showDetail.currentAmount || 0} target={showDetail.targetAmount} size={100} strokeWidth={4} />
                            <div style={{ flex: 1 }}>
                                <div style={{
                                    fontSize: 12, color: 'var(--accent-primary)',
                                    fontWeight: 600, textTransform: 'uppercase',
                                    letterSpacing: '0.1em', marginBottom: 8
                                }}>
                                    {getPriorityLabel(showDetail.priority)}
                                </div>
                                <h2 className="font-title" style={{ fontSize: 24, marginBottom: 12 }}>{showDetail.name}</h2>
                                <p style={{ fontSize: 14, color: 'var(--text-muted)', lineHeight: 1.6 }}>{showDetail.description || 'Sin descripción adicional.'}</p>
                            </div>
                        </div>

                        <div className="bento-grid" style={{ gridAutoRows: 'auto', gap: 12 }}>
                            <div className="bento-span-4 card-wealth" style={{ padding: 16 }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Ahorrado</div>
                                <div style={{ fontSize: 18, fontWeight: 600 }}>{formatCurrency(showDetail.currentAmount || 0)}</div>
                            </div>
                            <div className="bento-span-4 card-wealth" style={{ padding: 16 }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Objetivo</div>
                                <div style={{ fontSize: 18, fontWeight: 600 }}>{formatCurrency(showDetail.targetAmount)}</div>
                            </div>
                            <div className="bento-span-4 card-wealth" style={{ padding: 16 }}>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 8 }}>Faltan</div>
                                <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--accent-warm)' }}>{formatCurrency(Math.max(0, showDetail.targetAmount - (showDetail.currentAmount || 0)))}</div>
                            </div>
                        </div>

                        <div className="card-wealth" style={{ marginTop: 20, background: 'rgba(0, 245, 212, 0.03)', borderColor: 'rgba(0, 245, 212, 0.1)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                <Clock size={24} color="var(--accent-primary)" />
                                <div>
                                    <div style={{ fontSize: 13, fontWeight: 700 }}>Ahorro Sugerido</div>
                                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                                        Para lograrlo, debes ahorrar <span style={{ color: '#fff', fontWeight: 600 }}>{formatCurrency(calculateSavingsRecommendation(showDetail.targetAmount - (showDetail.currentAmount || 0), showDetail.deadline).weekly)} por semana</span>.
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="form-actions" style={{ marginTop: 32, border: 'none', padding: 0 }}>
                            <button className="btn-wealth btn-wealth-outline" onClick={() => handleDelete(showDetail.id)} style={{ color: 'var(--danger)', borderColor: 'rgba(255, 93, 93, 0.2)' }}><Trash2 size={16} /> Eliminar</button>
                            <button className="btn-wealth btn-wealth-outline" onClick={() => { setShowDetail(null); openEdit(showDetail); }}><Edit3 size={16} /> Editar</button>
                            <button className="btn-wealth" style={{ flex: 1 }} onClick={() => { setShowDetail(null); setShowAddSavings(showDetail); }}><PiggyBank size={16} /> Añadir Ahorro</button>
                        </div>
                    </div>
                )}
            </Modal>

            {/* Savings Modal */}
            <Modal isOpen={!!showAddSavings} onClose={() => setShowAddSavings(null)} title="Añadir a mi Ahorro">
                {showAddSavings && (
                    <form onSubmit={handleAddSavings}>
                        <div style={{ textAlign: 'center', marginBottom: 32 }}>
                            <WealthRing current={showAddSavings.currentAmount || 0} target={showAddSavings.targetAmount} size={120} />
                        </div>
                        <div className="form-group">
                            <label className="form-label" style={{ fontSize: 11, opacity: 0.7 }}>¿CUÁNTO VAS A AHORRAR AHORA?</label>
                            <div style={{ position: 'relative' }}>
                                <DollarSign size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                <input className="wealth-input" style={{ paddingLeft: 40 }} type="number" placeholder="0.00" value={savingsAmount} onChange={e => setSavingsAmount(e.target.value)} required autoFocus />
                            </div>
                        </div>
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
