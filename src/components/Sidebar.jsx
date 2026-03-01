import { memo, useMemo, useState, useEffect, useCallback } from 'react';
import { NavLink, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { calculateLevel, getLevelTitle, getXPForNextLevel, getLevelIcon } from '../utils/gamification';
import {
    LayoutDashboard, Target, Wallet, CalendarCheck, BarChart3,
    Settings, Smartphone, LogOut, LogIn, User, BookOpen,
    ExternalLink, Sun, Moon, ChevronRight, PiggyBank
} from 'lucide-react';

function useInstallPWA() {
    const [deferredPrompt, setDeferredPrompt] = useState(null);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        if (window.matchMedia('(display-mode: standalone)').matches) {
            setIsInstalled(true);
            return;
        }
        const handler = (e) => { e.preventDefault(); setDeferredPrompt(e); };
        window.addEventListener('beforeinstallprompt', handler);
        return () => window.removeEventListener('beforeinstallprompt', handler);
    }, []);

    const install = useCallback(async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') setIsInstalled(true);
        setDeferredPrompt(null);
    }, [deferredPrompt]);

    return { canInstall: !!deferredPrompt && !isInstalled, isInstalled, install };
}

const NAV_ITEMS = [
    {
        group: 'Inteligencia', items: [
            { to: '/', end: true, icon: LayoutDashboard, label: 'Panel' },
            { to: '/goals', icon: Target, label: 'Metas' },
            { to: '/finances', icon: Wallet, label: 'Finanzas' },
            { to: '/fixed-expenses', icon: Wallet, label: 'Gastos Fijos' },
            { to: '/savings-challenge', icon: PiggyBank, label: 'Mi Ahorro' },
        ]
    },
    {
        group: 'Protocolo', items: [
            { to: '/routines', icon: CalendarCheck, label: 'Rutinas' },
            { to: '/statistics', icon: BarChart3, label: 'Estadísticas' },
        ]
    },
    {
        group: 'Sistema', items: [
            { to: '/profile', icon: Settings, label: 'Ajustes' },
            { to: '/guide', icon: BookOpen, label: 'Guía' },
        ]
    },
];

function Sidebar({ isOpen, onClose }) {
    const { state } = useApp();
    const { user, displayName, avatarUrl, logout, configured } = useAuth();
    const { isDark, toggleTheme } = useTheme();
    const { totalXP } = state.gamification;
    const { canInstall, install } = useInstallPWA();

    const level = useMemo(() => calculateLevel(totalXP), [totalXP]);
    const levelTitle = useMemo(() => getLevelTitle(level), [level]);
    const levelIcon = useMemo(() => getLevelIcon(level), [level]);
    const xpProgress = useMemo(() => getXPForNextLevel(totalXP), [totalXP]);

    return (
        <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
            {/* ─── Logo ─── */}
            <div style={{ padding: '0 16px', marginBottom: 36 }}>
                <Link to="/" className="sidebar-logo" onClick={onClose} style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 12, marginBottom: 0 }}>
                    <img src="/metaflow.svg" alt="MetaFlow" style={{ width: 36, height: 36, borderRadius: 10 }} />
                    <span style={{
                        fontFamily: 'Space Grotesk', fontSize: 20, fontWeight: 700,
                        color: 'var(--text-primary)', letterSpacing: '-0.02em'
                    }}>MetaFlow</span>
                </Link>
            </div>

            {/* ─── XP Card ─── */}
            <div style={{ padding: '0 12px', marginBottom: 28 }}>
                <div style={{
                    padding: '14px 14px 12px',
                    borderRadius: 12,
                    background: 'var(--success-muted)',
                    border: '1px solid var(--success-subtle)',
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <span style={{ fontSize: 20, lineHeight: 1 }}>{levelIcon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {levelTitle}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--accent-primary)', fontWeight: 500 }}>
                                Nivel {level} · {totalXP.toLocaleString()} XP
                            </div>
                        </div>
                    </div>
                    <div className="liquid-progress" style={{ height: 4 }}>
                        <motion.div className="liquid-progress-fill"
                            initial={{ width: 0 }}
                            animate={{ width: `${xpProgress.progress}%` }}
                            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        />
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 6, textAlign: 'right' }}>
                        {xpProgress.current} / {xpProgress.needed} XP
                    </div>
                </div>
            </div>

            {/* ─── Navigation ─── */}
            <nav style={{ flex: 1, padding: '0 8px' }}>
                {NAV_ITEMS.map(({ group, items }) => (
                    <div key={group}>
                        <div style={{
                            fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase',
                            letterSpacing: '0.08em', padding: '16px 16px 8px', fontWeight: 600,
                        }}>{group}</div>
                        {items.map(({ to, end, icon: Icon, label }) => (
                            <NavLink
                                key={to} to={to} end={end}
                                className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                                onClick={onClose}
                            >
                                <Icon size={17} />
                                <span>{label}</span>
                            </NavLink>
                        ))}
                    </div>
                ))}
            </nav>

            {/* ─── Footer ─── */}
            <div style={{ padding: '16px 12px 8px', borderTop: '1px solid var(--border-secondary)' }}>
                {/* Theme */}
                <button onClick={toggleTheme} className="theme-toggle-btn" style={{ marginBottom: 10 }}>
                    {isDark ? <Sun size={14} /> : <Moon size={14} />}
                    {isDark ? 'Modo Claro' : 'Modo Oscuro'}
                </button>

                {/* Install */}
                {canInstall && (
                    <button onClick={install} className="btn-wealth" style={{ width: '100%', marginBottom: 10, fontSize: 12, justifyContent: 'center' }}>
                        <Smartphone size={14} /> Instalar App
                    </button>
                )}

                {/* User Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, padding: '4px 0' }}>
                    <div style={{
                        width: 32, height: 32, borderRadius: 10,
                        background: 'var(--bg-elevated)', overflow: 'hidden',
                        border: '1px solid var(--border-secondary)', flexShrink: 0,
                    }}>
                        {avatarUrl ? (
                            <img src={avatarUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
                        ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                <User size={14} />
                            </div>
                        )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {user ? displayName : 'Modo Local'}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                            {user ? 'Nube Activa' : 'Offline'}
                        </div>
                    </div>
                </div>

                {/* Auth */}
                {user ? (
                    <button onClick={logout} className="btn-wealth btn-wealth-outline" style={{
                        width: '100%', fontSize: 11, justifyContent: 'center',
                        borderColor: 'var(--danger-subtle)', color: 'var(--danger)',
                    }}>
                        <LogOut size={14} /> Cerrar Sesión
                    </button>
                ) : configured ? (
                    <button onClick={() => { localStorage.removeItem('metaflow_skipped_login'); window.location.reload(); }} className="btn-wealth" style={{ width: '100%', fontSize: 11, justifyContent: 'center' }}>
                        <LogIn size={14} /> Iniciar Sesión
                    </button>
                ) : null}

                {/* Creator */}
                <a href="https://portfolio.youngstarsstore.com/" target="_blank" rel="noopener noreferrer" className="creator-badge" style={{ marginTop: 12, textDecoration: 'none' }}>
                    <div style={{
                        width: 26, height: 26, borderRadius: 6,
                        background: 'var(--accent-gradient)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: '#fff', fontWeight: 800, fontSize: 12, flexShrink: 0,
                    }}>Y</div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-primary)' }}>Youngstars</div>
                        <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Portfolio <ExternalLink size={8} style={{ display: 'inline', verticalAlign: 'middle' }} /></div>
                        <div style={{ fontSize: 8, color: 'var(--accent-secondary)', marginTop: 2, fontWeight: 700 }}>v2.1 Sync</div>
                    </div>
                </a>
            </div>
        </aside>
    );
}

export default memo(Sidebar);
