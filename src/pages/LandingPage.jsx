import { useState, useEffect, useRef } from 'react';
import { motion, useInView, AnimatePresence } from 'framer-motion';
import {
    ArrowRight, TrendingUp, Target, Zap, Shield, BarChart3,
    Wallet, Flame, Brain, ChevronRight, LineChart, Repeat,
    Award, Activity, DollarSign, CheckCircle, Sparkles, Clock
} from 'lucide-react';

/* ─── Animated counter ─── */
function AnimatedNumber({ value, suffix = '', prefix = '' }) {
    const [display, setDisplay] = useState(0);
    const ref = useRef(null);
    const inView = useInView(ref, { once: true });

    useEffect(() => {
        if (!inView) return;
        let start = 0;
        const duration = 1200;
        const step = (ts) => {
            if (!start) start = ts;
            const p = Math.min((ts - start) / duration, 1);
            const eased = 1 - Math.pow(1 - p, 3);
            setDisplay(Math.round(eased * value));
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    }, [inView, value]);

    return <span ref={ref}>{prefix}{display.toLocaleString()}{suffix}</span>;
}

/* ─── Section reveal ─── */
function Reveal({ children, delay = 0 }) {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, margin: '-60px' });
    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 32 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
        >
            {children}
        </motion.div>
    );
}

/* ─── Step card ─── */
function StepCard({ number, icon: Icon, title, description }) {
    return (
        <div className="landing-step-card">
            <div className="landing-step-number">{number}</div>
            <div className="landing-step-icon">
                <Icon size={24} />
            </div>
            <h3>{title}</h3>
            <p>{description}</p>
        </div>
    );
}

/* ─── Feature card ─── */
function FeatureCard({ icon: Icon, title, description, color }) {
    return (
        <div className="landing-feature-card">
            <div className="landing-feature-icon" style={{ background: `${color}12`, color }}>
                <Icon size={20} />
            </div>
            <h4>{title}</h4>
            <p>{description}</p>
        </div>
    );
}

/* ─── Cash Flow Visual ─── */
function CashFlowTimeline() {
    const nodes = [
        { label: 'Ingresos', color: '#00e5c3', icon: DollarSign },
        { label: 'Fijos', color: '#f04444', icon: Repeat },
        { label: 'Variables', color: '#f5a623', icon: Wallet },
        { label: 'Disponible', color: '#60b8f0', icon: Shield },
        { label: 'Metas', color: '#a855f7', icon: Target },
    ];

    return (
        <div className="landing-cashflow">
            {nodes.map((node, i) => (
                <div key={node.label} className="landing-cashflow-node">
                    <motion.div
                        className="landing-cashflow-circle"
                        style={{ background: `${node.color}15`, borderColor: `${node.color}30` }}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.15 * i, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <node.icon size={18} color={node.color} />
                    </motion.div>
                    <span style={{ color: node.color }}>{node.label}</span>
                    {i < nodes.length - 1 && (
                        <motion.div
                            className="landing-cashflow-connector"
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ delay: 0.15 * i + 0.3, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        />
                    )}
                </div>
            ))}
        </div>
    );
}

export default function LandingPage({ onGetStarted, onLearnMore }) {
    const [scrollY, setScrollY] = useState(0);

    useEffect(() => {
        const handler = () => setScrollY(window.scrollY);
        window.addEventListener('scroll', handler, { passive: true });
        return () => window.removeEventListener('scroll', handler);
    }, []);

    const features = [
        { icon: Target, title: 'Metas Inteligentes', description: 'Define objetivos financieros con proyecciones dinámicas y estimaciones de cumplimiento.', color: '#00e5c3' },
        { icon: Repeat, title: 'Gastos Fijos y Variables', description: 'Controla costos recurrentes y gasto variable con categorización automática.', color: '#f04444' },
        { icon: LineChart, title: 'Motor de Proyecciones', description: 'Simula tu futuro financiero a 90 días con datos reales y velocidad de ahorro.', color: '#60b8f0' },
        { icon: Flame, title: 'Sistema de Rachas', description: 'Construye disciplina con streaks, hábitos diarios y refuerzo positivo continuo.', color: '#f5a623' },
        { icon: Award, title: 'XP y Niveles', description: 'Gana experiencia por cada acción financiera inteligente y sube de nivel.', color: '#a855f7' },
        { icon: Activity, title: 'Sincronización Real', description: 'Tus datos se sincronizan en la nube automáticamente entre todos tus dispositivos.', color: '#3b82f6' },
    ];

    return (
        <div className="landing-page">
            {/* ─── FLOATING NAV ─── */}
            <motion.nav
                className="landing-nav"
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6 }}
                style={{
                    backdropFilter: scrollY > 40 ? 'blur(20px) saturate(180%)' : 'none',
                    background: scrollY > 40 ? 'rgba(9,9,11,0.8)' : 'transparent',
                    borderBottom: scrollY > 40 ? '1px solid rgba(255,255,255,0.05)' : '1px solid transparent',
                }}
            >
                <div className="landing-nav-inner">
                    <div className="landing-nav-brand">
                        <img src="/metaflow.svg" alt="MetaFlow" style={{ width: 32, height: 32, borderRadius: 8 }} />
                        <span>MetaFlow</span>
                    </div>
                    <button className="landing-nav-cta" onClick={onGetStarted}>
                        Empezar <ArrowRight size={14} />
                    </button>
                </div>
            </motion.nav>

            {/* ─── HERO SECTION ─── */}
            <section className="landing-hero">
                <div className="landing-hero-bg">
                    <div className="landing-hero-glow" />
                    <div className="landing-hero-grid" />
                </div>

                <motion.div
                    className="landing-hero-content"
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
                >
                    <div className="landing-hero-badge">
                        <Sparkles size={12} />
                        <span>Financial Operating System</span>
                    </div>

                    <h1 className="landing-hero-title">
                        Controla tu dinero.<br />
                        <span className="landing-gradient-text">Construye disciplina real.</span><br />
                        Haz crecer tu capital.
                    </h1>

                    <p className="landing-hero-subtitle">
                        Ahorro inteligente, proyecciones financieras, hábitos, rachas,
                        insights de comportamiento y crecimiento financiero gamificado.
                    </p>

                    <div className="landing-hero-actions">
                        <button className="landing-cta-primary" onClick={onGetStarted}>
                            Empezar a Ahorrar
                            <ArrowRight size={16} />
                        </button>
                        <button className="landing-cta-secondary" onClick={onLearnMore}>
                            Saber Más
                            <ChevronRight size={16} />
                        </button>
                    </div>

                    <div className="landing-hero-stats">
                        <div className="landing-hero-stat">
                            <span className="landing-hero-stat-value"><AnimatedNumber value={90} suffix="d" /></span>
                            <span className="landing-hero-stat-label">Proyección</span>
                        </div>
                        <div className="landing-hero-stat-divider" />
                        <div className="landing-hero-stat">
                            <span className="landing-hero-stat-value"><AnimatedNumber value={100} suffix="%" /></span>
                            <span className="landing-hero-stat-label">Privado</span>
                        </div>
                        <div className="landing-hero-stat-divider" />
                        <div className="landing-hero-stat">
                            <span className="landing-hero-stat-value"><AnimatedNumber value={0} prefix="$" /></span>
                            <span className="landing-hero-stat-label">Gratis</span>
                        </div>
                    </div>
                </motion.div>
            </section>

            {/* ─── HOW IT WORKS ─── */}
            <section className="landing-section" id="how-it-works">
                <Reveal>
                    <div className="landing-section-header">
                        <span className="landing-section-tag">Cómo Funciona</span>
                        <h2>Tres pasos para transformar tus finanzas</h2>
                        <p>Un sistema diseñado para construir disciplina financiera real, paso a paso.</p>
                    </div>
                </Reveal>

                <div className="landing-steps-grid">
                    <Reveal delay={0.1}>
                        <StepCard number="01" icon={Wallet} title="Registra ingresos y gastos" description="Controla tu flujo de efectivo con registros rápidos. Cada movimiento alimenta tu inteligencia financiera." />
                    </Reveal>
                    <Reveal delay={0.2}>
                        <StepCard number="02" icon={Target} title="Define metas inteligentes" description="Establece objetivos con plazos y el sistema calcula tu velocidad de ahorro ideal automáticamente." />
                    </Reveal>
                    <Reveal delay={0.3}>
                        <StepCard number="03" icon={TrendingUp} title="Construye rachas y crece" description="Mantén tu disciplina diaria, gana XP, sube de nivel y observa cómo tu capital crece consistentemente." />
                    </Reveal>
                </div>

                <Reveal delay={0.4}>
                    <CashFlowTimeline />
                </Reveal>
            </section>

            {/* ─── FEATURES GRID ─── */}
            <section className="landing-section landing-section-alt">
                <Reveal>
                    <div className="landing-section-header">
                        <span className="landing-section-tag">Funcionalidades</span>
                        <h2>Todo lo que necesitas para crecer financieramente</h2>
                        <p>Herramientas profesionales diseñadas con la claridad y precisión de productos fintech de primer nivel.</p>
                    </div>
                </Reveal>

                <div className="landing-features-grid">
                    {features.map((f, i) => (
                        <Reveal key={f.title} delay={0.05 * i}>
                            <FeatureCard {...f} />
                        </Reveal>
                    ))}
                </div>
            </section>

            {/* ─── BEHAVIORAL ADVANTAGE ─── */}
            <section className="landing-section">
                <div className="landing-advantage">
                    <Reveal>
                        <div className="landing-advantage-content">
                            <span className="landing-section-tag">Ventaja Conductual</span>
                            <h2>MetaFlow no solo rastrea.<br /><span className="landing-gradient-text">Predice. Entrena. Se adapta.</span></h2>
                            <div className="landing-advantage-points">
                                <div className="landing-advantage-point">
                                    <Brain size={20} color="#00e5c3" />
                                    <div>
                                        <strong>Predice</strong>
                                        <p>Proyecta tu capital a 90 días basándose en tu velocidad real de ahorro y patrones de gasto.</p>
                                    </div>
                                </div>
                                <div className="landing-advantage-point">
                                    <Zap size={20} color="#f5a623" />
                                    <div>
                                        <strong>Entrena</strong>
                                        <p>Construye disciplina financiera con misiones diarias, rachas y un sistema de XP que refuerza hábitos positivos.</p>
                                    </div>
                                </div>
                                <div className="landing-advantage-point">
                                    <Activity size={20} color="#60b8f0" />
                                    <div>
                                        <strong>Se adapta</strong>
                                        <p>Detecta patrones en tu comportamiento y ajusta recomendaciones para maximizar tu tasa de ahorro.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </Reveal>
                </div>
            </section>

            {/* ─── FINAL CTA ─── */}
            <section className="landing-section landing-final-cta">
                <Reveal>
                    <div className="landing-final-cta-content">
                        <h2>¿Listo para construir tu<br /><span className="landing-gradient-text">momentum financiero</span>?</h2>
                        <p>Únete y toma el control de tu dinero con herramientas diseñadas para construir riqueza real.</p>
                        <button className="landing-cta-primary landing-cta-lg" onClick={onGetStarted}>
                            Empezar a Ahorrar
                            <ArrowRight size={18} />
                        </button>
                    </div>
                </Reveal>
            </section>

            {/* ─── FOOTER ─── */}
            <footer className="landing-footer">
                <div className="landing-footer-inner">
                    <div className="landing-footer-brand">
                        <img src="/metaflow.svg" alt="MetaFlow" style={{ width: 28, height: 28, borderRadius: 7 }} />
                        <span>MetaFlow</span>
                    </div>
                    <div className="landing-footer-copy">
                        © 2025 MetaFlow · Disciplina Financiera Inteligente
                    </div>
                    <a href="https://portfolio.youngstarsstore.com/" target="_blank" rel="noopener noreferrer" className="landing-footer-creator">
                        by Youngstars
                    </a>
                </div>
            </footer>
        </div>
    );
}
