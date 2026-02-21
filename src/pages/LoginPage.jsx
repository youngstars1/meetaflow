import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../context/AuthContext';
import { EmailVerificationModal } from '../components/EmailVerification';
import { Mail, Lock, User, ArrowRight, Eye, EyeOff, Sparkles, Shield, Cloud, ShieldCheck, Zap, Activity } from 'lucide-react';

const GoogleLogo = () => (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <path d="M17.64 9.204c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" fill="#4285F4" />
        <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853" />
        <path d="M3.964 10.71a5.41 5.41 0 01-.282-1.71c0-.593.102-1.17.282-1.71V4.958H.957a8.996 8.996 0 000 8.084l3.007-2.332z" fill="#FBBC05" />
        <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 3.163 6.656 3.58 9 3.58z" fill="#EA4335" />
    </svg>
);

export default function LoginPage({ onSkip }) {
    const { loginWithGoogle, loginWithEmail, signUpWithEmail, authError, clearError, configured } = useAuth();
    const [mode, setMode] = useState('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [successMsg, setSuccessMsg] = useState('');
    const [showVerifyModal, setShowVerifyModal] = useState(false);
    const [registeredEmail, setRegisteredEmail] = useState('');

    const handleEmailSubmit = useCallback(async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        clearError();
        setSuccessMsg('');
        if (mode === 'register') {
            const { error, needsConfirmation } = await signUpWithEmail(email, password, displayName);
            if (!error) {
                if (needsConfirmation) {
                    // Email confirmation is ENABLED — show modal
                    setRegisteredEmail(email);
                    setShowVerifyModal(true);
                }
                // If !needsConfirmation, user is auto-logged in (session returned)
                // onAuthStateChange will handle navigation
            }
        } else {
            await loginWithEmail(email, password);
        }
        setIsSubmitting(false);
    }, [mode, email, password, displayName, loginWithEmail, signUpWithEmail, clearError]);

    const handleGoogleLogin = useCallback(async () => {
        setIsSubmitting(true);
        clearError();
        await loginWithGoogle();
        setIsSubmitting(false);
    }, [loginWithGoogle, clearError]);

    const features = [
        { icon: <ShieldCheck size={18} />, title: 'Seguridad Total', desc: 'Tus datos están protegidos y encriptados' },
        { icon: <Activity size={18} />, title: 'Sinc. Cloud', desc: 'Accede a tus finanzas desde cualquier dispositivo' },
        { icon: <Zap size={18} />, title: 'Enfoque en Metas', desc: 'Motivación diaria para alcanzar tus objetivos' },
    ];

    return (
        <>
            {/* Email Verification Modal */}
            {showVerifyModal && (
                <EmailVerificationModal
                    email={registeredEmail}
                    onClose={() => setShowVerifyModal(false)}
                />
            )}

            <div style={{
                minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 20, background: 'var(--bg-primary)', position: 'relative', overflow: 'hidden'
            }}>
                <div className="giant-metric" style={{ top: '5%', left: '5%', opacity: 0.02, fontSize: 180 }}>META</div>
                <div className="giant-metric" style={{ bottom: '10%', right: '5%', opacity: 0.02, fontSize: 220 }}>FLOW</div>

                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                    style={{ width: '100%', maxWidth: 460, position: 'relative', zIndex: 1 }}
                >
                    <div style={{ textAlign: 'center', marginBottom: 40 }}>
                        <img
                            src="/metaflow.svg"
                            alt="MetaFlow"
                            style={{
                                width: 64, height: 64, borderRadius: 16,
                                marginBottom: 24,
                                boxShadow: '0 0 40px rgba(0, 229, 195, 0.15)',
                            }}
                        />
                        <h1 className="font-title" style={{ fontSize: 32, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8, letterSpacing: '-0.02em' }}>MetaFlow</h1>
                        <p style={{ fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Disciplina Financiera y Control de Metas</p>
                    </div>

                    <div className="card-wealth shimmer-metal" style={{ padding: '32px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 32 }}>
                            {features.map((f, i) => (
                                <div key={i} style={{ textAlign: 'center' }}>
                                    <div style={{ color: 'var(--accent-primary)', marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{f.icon}</div>
                                    <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', textTransform: 'uppercase', marginBottom: 4 }}>{f.title.split(' ')[0]}</div>
                                </div>
                            ))}
                        </div>

                        {configured && (
                            <>
                                <button className="btn-wealth" onClick={handleGoogleLogin} disabled={isSubmitting} style={{ width: '100%', justifyContent: 'center', marginBottom: 20, background: '#fff', color: '#000' }}>
                                    <GoogleLogo /> <span style={{ marginLeft: 10 }}>Continuar con Google</span>
                                </button>
                                <div className="flex-between" style={{ marginBottom: 20, opacity: 0.3 }}>
                                    <div style={{ flex: 1, height: 1, background: 'var(--text-muted)' }} />
                                    <span style={{ paddingInline: 12, fontSize: 10, fontWeight: 600 }}>O USA TU CORREO</span>
                                    <div style={{ flex: 1, height: 1, background: 'var(--text-muted)' }} />
                                </div>
                                <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'rgba(128,128,128,0.06)', borderRadius: 10, padding: 3 }}>
                                    {['login', 'register'].map(m => (
                                        <button key={m} onClick={() => setMode(m)} style={{
                                            flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: mode === m ? 'var(--accent-primary)' : 'transparent',
                                            color: mode === m ? 'var(--text-inverse)' : 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s ease'
                                        }}>{m === 'login' ? 'Iniciar Sesión' : 'Registrarse'}</button>
                                    ))}
                                </div>
                                <form onSubmit={handleEmailSubmit}>
                                    <AnimatePresence mode="wait">
                                        <motion.div
                                            key={mode}
                                            initial={{ opacity: 0, x: 10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            transition={{ duration: 0.3 }}
                                        >
                                            {mode === 'register' && (
                                                <div className="form-group">
                                                    <label className="form-label" style={{ fontSize: 10, opacity: 0.7 }}>Nombre completo</label>
                                                    <div style={{ position: 'relative' }}>
                                                        <User size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                                        <input className="wealth-input" style={{ paddingLeft: 40 }} value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="¿Cómo te llamas?" />
                                                    </div>
                                                </div>
                                            )}
                                            <div className="form-group">
                                                <label className="form-label" style={{ fontSize: 10, opacity: 0.7 }}>Correo electrónico</label>
                                                <div style={{ position: 'relative' }}>
                                                    <Mail size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                                    <input className="wealth-input" style={{ paddingLeft: 40 }} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="correo@ejemplo.com" required />
                                                </div>
                                            </div>
                                            <div className="form-group" style={{ marginBottom: 24 }}>
                                                <label className="form-label" style={{ fontSize: 10, opacity: 0.7 }}>Contraseña</label>
                                                <div style={{ position: 'relative' }}>
                                                    <Lock size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                                                    <input className="wealth-input" style={{ paddingLeft: 40, paddingRight: 40 }} type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required minLength={6} />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowPassword(!showPassword)}
                                                        style={{
                                                            position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                                                            background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 4,
                                                        }}
                                                    >
                                                        {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    </AnimatePresence>
                                    {authError && <div style={{ padding: 12, borderRadius: 10, background: 'var(--danger-muted)', border: '1px solid var(--danger-subtle)', fontSize: 12, color: 'var(--danger)', marginBottom: 20 }}>Error: {authError}</div>}
                                    {successMsg && <div style={{ padding: 12, borderRadius: 10, background: 'var(--success-muted)', border: '1px solid var(--success-subtle)', fontSize: 12, color: 'var(--success)', marginBottom: 20 }}>{successMsg}</div>}
                                    <button type="submit" className="btn-wealth" disabled={isSubmitting} style={{ width: '100%', justifyContent: 'center', height: 48 }}>
                                        {isSubmitting ? 'Cargando...' : mode === 'login' ? 'Acceder' : 'Crear Cuenta'}
                                    </button>
                                </form>
                            </>
                        )}

                        <button className="btn-wealth btn-wealth-outline" onClick={onSkip} style={{ width: '100%', marginTop: 16, justifyContent: 'center', fontSize: 12, height: 44, opacity: 0.7 }}>
                            {configured ? 'Probar modo offline (Solo Local)' : 'Comenzar (Modo Local)'}
                        </button>
                        {!configured && (
                            <div style={{ marginTop: 20, padding: 12, borderRadius: 10, background: 'var(--warning-muted)', border: '1px solid var(--warning-subtle)', fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                                Aviso: El servidor de guardado remoto no está activo. Tus datos se guardarán únicamente en la memoria de este navegador.
                            </div>
                        )}
                    </div>
                    <div style={{ textAlign: 'center', marginTop: 32, fontSize: 11, color: 'var(--text-muted)', letterSpacing: '0.2em' }}>© 2025 METAFLOW - DISCIPLINA FINANCIERA</div>
                </motion.div>
            </div>
        </>
    );
}
