import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BookOpen, ChevronDown, BarChart3, Target, Wallet, Activity,
    Shield, Award, Smartphone, Zap, Brain, Clock, Layers,
    Bell, Vibrate, Sun, Moon, Fingerprint, Receipt, TrendingUp,
    TrendingDown, Heart, ShieldCheck, Calendar, Info, CheckCircle,
    PiggyBank, Play, Pause, SkipForward, Database
} from 'lucide-react';

const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: { staggerChildren: 0.04, delayChildren: 0.08 },
    },
};

const item = {
    hidden: { y: 16, opacity: 0 },
    show: { y: 0, opacity: 1, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } }
};

const GUIDE_SECTIONS = [
    {
        id: 'dashboard',
        icon: BarChart3,
        title: 'Panel de Control',
        color: '#00f5d4',
        content: [
            {
                subtitle: 'Vista General Financiera',
                text: 'El panel muestra tu ecosistema financiero completo en un vistazo. La tarjeta hero presenta tu capital total en metas, ingresos, gastos y saldo actual con un diseño premium.',
            },
            {
                subtitle: 'Acción Rápida',
                text: 'Registra ingresos o gastos directamente desde el dashboard sin navegar. Solo ingresa el monto y presiona el botón correspondiente. Se otorgan +10 XP por cada registro.',
            },
            {
                subtitle: 'Misiones Diarias',
                text: 'Cada día se generan 4 misiones personalizadas: registrar un gasto, completar rutinas, ahorrar extra, y evitar gastos impulsivos. Las misiones varían en dificultad y XP.',
            },
            {
                subtitle: 'Inteligencia Financiera',
                text: 'El sistema analiza tus patrones y muestra 3 métricas clave: Índice de Impulso (% de gastos impulsivos), Ratio de Inversión (% destinado a educación/inversión), y Nivel de Optimización (tu score financiero general).',
            },
        ],
    },
    {
        id: 'goals',
        icon: Target,
        title: 'Metas Financieras',
        color: '#70d6ff',
        content: [
            {
                subtitle: 'Crear Metas Inteligentes',
                text: 'Define metas con nombre, monto objetivo, fecha límite y prioridad. El sistema calcula automáticamente cuánto deberías ahorrar diario, semanal y mensualmente para alcanzarla.',
            },
            {
                subtitle: 'Abonar a Meta',
                text: 'Registra abonos directamente desde la tarjeta de cada meta. Es un proceso atómico: se registra como transacción de ahorro Y se actualiza el progreso de la meta simultáneamente.',
            },
            {
                subtitle: 'Proyecciones Inteligentes',
                text: 'MetaFlow analiza tu ritmo de ahorro y proyecta si vas adelantado, a tiempo, o retrasado. Usa interés compuesto para mostrar el crecimiento potencial de tus ahorros.',
            },
            {
                subtitle: 'Imágenes de Meta',
                text: 'Sube una imagen aspiracional para cada meta. Visualizar lo que deseas te mantiene motivado.',
            },
        ],
    },
    {
        id: 'finances',
        icon: Wallet,
        title: 'Gestión Financiera',
        color: '#ffbe0b',
        content: [
            {
                subtitle: 'Tipos de Movimiento',
                text: 'Registra tres tipos: Ingresos (sueldo, freelance, negocio), Gastos (alimentación, transporte, servicios, etc.), y Ahorros (vinculados directamente a tus metas).',
            },
            {
                subtitle: 'Clasificación de Decisiones',
                text: 'Cada gasto se clasifica automáticamente en 4 categorías: Necesidad (servicios, comida), Inversión (educación, cursos), Deseo (entretenimiento, ropa), e Impulso (sin planificación). Esto genera métricas de comportamiento.',
            },
            {
                subtitle: 'Filtros y Búsqueda',
                text: 'Filtra movimientos por tipo (todos, ingresos, gastos, ahorros) con tabs intuitivos. Cada movimiento muestra categoría, fecha, nota y monto con códigos de color.',
            },
            {
                subtitle: 'Sobres Virtuales',
                text: 'Distribuye automáticamente tus ingresos en categorías predefinidas (necesidades, deseos, ahorro) usando la metodología 50/30/20 o una personalizada.',
            },
        ],
    },
    {
        id: 'routines',
        icon: Activity,
        title: 'Rutinas y Disciplina',
        color: '#a78bfa',
        content: [
            {
                subtitle: 'Hábitos Financieros',
                text: 'Define rutinas como "Revisar gastos", "No usar delivery", "Ahorrar monedas". Cada rutina tiene categoría (finanzas, salud, productividad, educación) y frecuencia.',
            },
            {
                subtitle: 'Sistema de Rachas',
                text: 'El sistema detecta automáticamente días consecutivos de cumplimiento. Las rachas otorgan bonos: 7 días (+100 XP), 30 días (+500 XP), 60 días (+1.000 XP), 100 días (+2.500 XP).',
            },
            {
                subtitle: 'Completar Todas = Bonus',
                text: 'Si completas TODAS tus rutinas en un día, recibes un bonus de +100 XP. Esto incentiva la consistencia total.',
            },
            {
                subtitle: 'Vibración al Completar',
                text: 'En dispositivos móviles, la app vibra sutilmente al marcar una rutina como completada, dando feedback táctil satisfactorio.',
            },
        ],
    },
    {
        id: 'stats',
        icon: BarChart3,
        title: 'Estadísticas Avanzadas',
        color: '#f472b6',
        content: [
            {
                subtitle: 'Gráficos Memoizados',
                text: 'Todos los gráficos están optimizados con React.memo para renderizar solo cuando los datos cambian. Incluye: barras (ingresos vs gastos), pie (categorías), área (tendencia de ahorro), línea (cumplimiento semanal).',
            },
            {
                subtitle: 'Progreso de Metas',
                text: 'Visualiza el avance de todas tus metas con barras de progreso líquido animadas, mostrando montos actuales vs objetivos.',
            },
            {
                subtitle: 'Cumplimiento Semanal',
                text: 'Un gráfico de línea muestra tu porcentaje de cumplimiento de rutinas en los últimos 7 días.',
            },
        ],
    },
    {
        id: 'patterns',
        icon: Brain,
        title: 'Detección de Patrones',
        color: '#00f5d4',
        content: [
            {
                subtitle: 'Patrones por Día',
                text: 'El motor analiza en qué días de la semana gastas más. Por ejemplo: "Tus gastos suben 45% los viernes." Esto te permite anticipar y controlar comportamientos.',
            },
            {
                subtitle: 'Tendencias por Categoría',
                text: 'Detecta cambios mes sobre mes en tus categorías de gasto. Si "Comida" subió 23% este mes, recibes una alerta inteligente.',
            },
            {
                subtitle: 'Índice de Consumo Impulsivo',
                text: 'Mide qué porcentaje de tus gastos no fueron planificados. Un índice bajo indica alta disciplina financiera.',
            },
            {
                subtitle: 'Ratio Inversión vs Gasto',
                text: 'Calcula cuánto de lo que gastas va a inversión (educación, cursos, herramientas) versus consumo. Un ratio alto indica mentalidad de crecimiento.',
            },
        ],
    },
    {
        id: 'missions',
        icon: Zap,
        title: 'Misiones Diarias',
        color: '#ffbe0b',
        content: [
            {
                subtitle: 'Sistema de Misiones',
                text: 'Cada día se generan 4 misiones basadas en tu actividad: registrar un gasto (+10 XP), completar todas las rutinas (+100 XP), ahorrar dinero extra (+25 XP), y no tener gastos impulsivos (+50 XP).',
            },
            {
                subtitle: 'XP Variable',
                text: 'Las misiones difíciles otorgan más XP. "No gastos impulsivos" vale 50 XP porque requiere más autocontrol que "registrar un gasto" que vale 10 XP.',
            },
            {
                subtitle: 'Progreso Visual',
                text: 'Cada misión muestra su estado (completada/pendiente) con iconos, colores y una etiqueta de dificultad. Las completadas se tachan visualmente.',
            },
        ],
    },
    {
        id: 'decisions',
        icon: Layers,
        title: 'Modelo de Decisiones',
        color: '#70d6ff',
        content: [
            {
                subtitle: 'Clasificación Automática',
                text: 'Cada gasto se clasifica en: Necesidad 🛡️ (comida, servicios, salud, transporte), Inversión 📈 (educación, cursos), Deseo 💛 (entretenimiento, ropa), Impulso ⚡ (sin planificación).',
            },
            {
                subtitle: 'Métricas de Comportamiento',
                text: 'Se generan 3 métricas clave: Índice de Impulso (menor = mejor), Ratio de Inversión (mayor = mejor), y Nivel de Optimización Financiera (score 0-100).',
            },
            {
                subtitle: 'Insights Automáticos',
                text: 'El sistema genera mensajes inteligentes como: "Excelente control de impulsos" o "Considera destinar 10% a inversión". Esto transforma la app de un tracker a un asesor.',
            },
        ],
    },
    {
        id: 'gamification',
        icon: Award,
        title: 'Gamificación',
        color: '#a78bfa',
        content: [
            {
                subtitle: '18 Niveles de Progresión',
                text: 'Desde Iniciado 🌱 hasta Sabio del Patrimonio 🏛️. Cada acción otorga XP: rutinas (+20), metas (+20-500), registros (+10-25), rachas (+100-2500).',
            },
            {
                subtitle: '12 Medallas',
                text: 'Tres categorías: Disciplina (rachas de 7, 30, 100 días), Patrimonio (ahorro de 100K, 500K, 1M), Inteligencia (registrar datos, múltiples metas). Cada medalla tiene condiciones verificables.',
            },
            {
                subtitle: 'Celebraciones',
                text: 'Al subir de nivel o ganar medallas, se activan confetis y animaciones de celebración. Diferentes efectos para logros pequeños vs grandes.',
            },
        ],
    },
    {
        id: 'time_engine',
        icon: Clock,
        title: 'Motor Temporal',
        color: '#f472b6',
        content: [
            {
                subtitle: 'Ingeniería Limpia',
                text: 'MetaFlow usa un Time Engine centralizado en vez de Date.now() disperso. Funciones como time.now(), time.startOfWeek(), time.isSameDay() y time.diffInBusinessDays() garantizan consistencia temporal.',
            },
            {
                subtitle: 'Formato Relativo',
                text: 'Las fechas se muestran como "Hace 3 días", "Ayer", "Hace 2 sem" usando time.relative(). Más humano que timestamps crudos.',
            },
            {
                subtitle: 'Simulación Temporal',
                text: 'Para testing y proyecciones, el motor soporta fast-forward: simular el paso del tiempo para verificar escenarios futuros sin alterar datos reales.',
            },
        ],
    },
    {
        id: 'security',
        icon: Shield,
        title: 'Seguridad y Privacidad',
        color: '#ff5d5d',
        content: [
            {
                subtitle: 'Modo Privacidad',
                text: 'Oculta todos los montos con un clic. Ideal para usar la app en público sin exponer tu información financiera. Todos los valores se muestran como "••••••".',
            },
            {
                subtitle: 'Sanitización de Datos',
                text: 'Todo input del usuario pasa por sanitización HTML para prevenir ataques XSS. Los montos usan Finance.parse() para evitar errores de punto flotante.',
            },
            {
                subtitle: 'Backup y Restauración',
                text: 'Exporta todos tus datos como JSON encriptado. Importa desde cualquier backup válido de MetaFlow. También puedes crear backups manuales en localStorage.',
            },
            {
                subtitle: 'Confirmaciones Inteligentes',
                text: 'Las acciones destructivas (eliminar meta, borrar rutina) requieren confirmación explícita. Las eliminaciones se almacenan en un stack de Undo para poder revertirlas.',
            },
        ],
    },
    {
        id: 'notifications',
        icon: Bell,
        title: 'Notificaciones y UX',
        color: '#00f5d4',
        content: [
            {
                subtitle: 'Notificaciones Locales',
                text: 'Recordatorios de racha para no perder tu progreso. Se activan al cumplir ciertos umbrales o cuando estás a punto de perder una racha importante.',
            },
            {
                subtitle: 'Vibración Táctil',
                text: 'En dispositivos compatibles, la app usa la API de Vibración del navegador para dar feedback háptico al completar rutinas y lograr medallas.',
            },
            {
                subtitle: 'Modo Claro / Oscuro',
                text: 'Soporte automático basado en preferencias del sistema (prefers-color-scheme). El tema oscuro es el predeterminado para una experiencia premium.',
            },
            {
                subtitle: 'Responsive Thumb-Zone',
                text: 'Los elementos interactivos principales están posicionados en la zona alcanzable del pulgar en móviles. Los botones de acción están en la parte inferior, los datos de lectura arriba.',
            },
        ],
    },
    {
        id: 'pwa',
        icon: Smartphone,
        title: 'Instalación PWA',
        color: '#ffbe0b',
        content: [
            {
                subtitle: 'Instalar como App',
                text: 'MetaFlow funciona como app nativa. En Chrome: menú ⋮ → "Instalar aplicación". En Safari: Compartir → "Agregar a pantalla de inicio".',
            },
            {
                subtitle: 'Funciona Offline',
                text: 'Una vez instalada, la app funciona sin conexión a internet. Los datos se guardan localmente y se sincronizan cuando hay conexión disponible.',
            },
            {
                subtitle: 'Actualizaciones Automáticas',
                text: 'La PWA se actualiza automáticamente en segundo plano. Siempre tendrás la última versión sin necesidad de ir a una tienda de apps.',
            },
        ],
    },
];

function GuideSection({ section, isOpen, onToggle }) {
    const Icon = section.icon;
    return (
        <motion.div variants={item} className="card-wealth" style={{ overflow: 'hidden' }}>
            <button
                onClick={onToggle}
                className="flex-between"
                style={{
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    padding: '4px 0',
                    textAlign: 'left',
                }}
                aria-expanded={isOpen}
            >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                        width: 36, height: 36, borderRadius: 10,
                        background: `${section.color}10`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Icon size={18} color={section.color} />
                    </div>
                    <span className="font-title" style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)' }}>{section.title}</span>
                </div>
                <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                >
                    <ChevronDown size={18} color="var(--text-muted)" />
                </motion.div>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div style={{ paddingTop: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {section.content.map((block, i) => (
                                <div key={i} style={{
                                    padding: '16px 20px',
                                    borderRadius: 12,
                                    background: 'rgba(128,128,128,0.04)',
                                    border: '1px solid var(--border-color)',
                                    borderLeft: `3px solid ${section.color}20`,
                                }}>
                                    <h4 style={{
                                        fontSize: 13,
                                        fontWeight: 600,
                                        color: section.color,
                                        marginBottom: 6,
                                        fontFamily: 'Space Grotesk',
                                    }}>
                                        {block.subtitle}
                                    </h4>
                                    <p style={{
                                        fontSize: 13,
                                        lineHeight: 1.65,
                                        color: 'var(--text-secondary)',
                                        margin: 0,
                                    }}>
                                        {block.text}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

export default function HelpGuide() {
    const [openSections, setOpenSections] = useState(new Set(['dashboard']));

    const toggleSection = (id) => {
        setOpenSections(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const expandAll = () => setOpenSections(new Set(GUIDE_SECTIONS.map(s => s.id)));
    const collapseAll = () => setOpenSections(new Set());

    return (
        <motion.div
            className="page-content"
            variants={container}
            initial="hidden"
            animate="show"
            style={{ maxWidth: 800, margin: '0 auto' }}
        >
            {/* Header */}
            <motion.div variants={item} style={{ marginBottom: 40 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <div style={{
                        width: 42, height: 42, borderRadius: 12,
                        background: 'linear-gradient(135deg, rgba(0,245,212,0.15), rgba(112,214,255,0.10))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <BookOpen size={20} color="var(--accent-primary)" />
                    </div>
                    <div>
                        <h1 className="page-title" style={{ fontSize: 32, color: 'var(--text-primary)' }}>Guía Profesional</h1>
                        <p className="page-subtitle" style={{ marginTop: 2, color: 'var(--text-secondary)' }}>Domina MetaFlow y transforma tu relación con el dinero</p>
                    </div>
                </div>
            </motion.div>

            {/* Feature overview pills */}
            <motion.div variants={item} style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 28 }}>
                {[
                    { label: '13 Módulos', icon: '📘' },
                    { label: '18 Niveles', icon: '🎮' },
                    { label: '12 Medallas', icon: '🏆' },
                    { label: 'Misiones Diarias', icon: '⚡' },
                    { label: 'IA Financiera', icon: '🧠' },
                    { label: 'PWA Offline', icon: '📱' },
                ].map((p, i) => (
                    <span key={i} className="stat-pill neutral" style={{ fontSize: 11, padding: '6px 12px' }}>
                        {p.icon} {p.label}
                    </span>
                ))}
            </motion.div>

            {/* Expand/Collapse controls */}
            <motion.div variants={item} className="flex-between" style={{ marginBottom: 20 }}>
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    {openSections.size} de {GUIDE_SECTIONS.length} secciones abiertas
                </span>
                <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={expandAll} className="btn-wealth btn-wealth-outline" style={{ fontSize: 11, padding: '6px 12px' }}>
                        Expandir todo
                    </button>
                    <button onClick={collapseAll} className="btn-wealth btn-wealth-outline" style={{ fontSize: 11, padding: '6px 12px' }}>
                        Colapsar todo
                    </button>
                </div>
            </motion.div>

            {/* Sections */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {GUIDE_SECTIONS.map(section => (
                    <GuideSection
                        key={section.id}
                        section={section}
                        isOpen={openSections.has(section.id)}
                        onToggle={() => toggleSection(section.id)}
                    />
                ))}
            </div>

            {/* Footer / Creator */}
            <motion.div variants={item} style={{
                marginTop: 48,
                padding: '32px 28px',
                borderRadius: 16,
                background: 'linear-gradient(135deg, rgba(0,245,212,0.04), rgba(112,214,255,0.02))',
                border: '1px solid rgba(0,245,212,0.08)',
                textAlign: 'center',
            }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🚀</div>
                <h3 className="font-title" style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                    Construido por YoungStars Design
                </h3>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>
                    MetaFlow es una herramienta profesional de gestión financiera diseñada para usuarios que toman en serio su crecimiento económico.
                </p>
                <a
                    href="https://youngstarsdesign.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-wealth"
                    style={{ display: 'inline-flex', fontSize: 12 }}
                >
                    Ver Portfolio ↗
                </a>
            </motion.div>
        </motion.div>
    );
}
