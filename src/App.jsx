import { useState, useEffect, Suspense, lazy, useRef } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { ToastProvider } from './context/ToastContext';
import { PrivacyProvider } from './context/PrivacyContext';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import OnboardingWizard from './components/OnboardingWizard';
import PomodoroTimer from './components/PomodoroTimer';
import InstallPrompt, { registerServiceWorker } from './components/InstallPrompt';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ErrorBoundary from './components/ErrorBoundary';
import { Menu, X } from 'lucide-react';

// Lazy load pages for performance (Tree Shaking optimized)
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Goals = lazy(() => import('./pages/Goals'));
const Finances = lazy(() => import('./pages/Finances'));
const Routines = lazy(() => import('./pages/Routines'));
const Statistics = lazy(() => import('./pages/Statistics'));
const Profile = lazy(() => import('./pages/Profile'));
const HelpGuide = lazy(() => import('./pages/HelpGuide'));
const FixedExpenses = lazy(() => import('./pages/FixedExpenses'));

// Register service worker for PWA
registerServiceWorker();

const PageLoader = () => (
  <div style={{
    minHeight: '60vh', display: 'flex', alignItems: 'center',
    justifyContent: 'center'
  }}>
    <div className="loader-ring" />
  </div>
);

function AppContent() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => {
    return !localStorage.getItem('metaflow_onboarded');
  });
  const [showLanding, setShowLanding] = useState(true);

  const { user, loading } = useAuth();
  const [skippedLogin, setSkippedLogin] = useState(() => {
    return !!localStorage.getItem('metaflow_skipped_login');
  });

  const howItWorksRef = useRef(null);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 768) setSidebarOpen(false);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--bg-primary)',
      }}>
        <div className="loader-ring" />
      </div>
    );
  }

  // ─── Pre-auth: Landing → Login → Onboarding → App ───
  if (!user && !skippedLogin) {
    if (showLanding) {
      return (
        <LandingPage
          onGetStarted={() => setShowLanding(false)}
          onLearnMore={() => {
            setShowLanding(false);
            // Navigate to login, they can explore from there
          }}
        />
      );
    }
    return (
      <LoginPage onSkip={() => {
        localStorage.setItem('metaflow_skipped_login', 'true');
        setSkippedLogin(true);
      }} />
    );
  }

  if (showOnboarding) {
    return <OnboardingWizard onComplete={() => setShowOnboarding(false)} />;
  }

  return (
    <div className="app-layout">
      <div className="mobile-header">
        <button
          className="mobile-menu-toggle"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label={sidebarOpen ? 'Cerrar menú' : 'Abrir menú'}
        >
          {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
        <span className="mobile-logo" style={{ fontFamily: 'Space Grotesk', fontWeight: 700 }}>MetaFlow</span>
      </div>

      {sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <main className="main-content" onClick={() => sidebarOpen && setSidebarOpen(false)}>
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/finances" element={<Finances />} />
              <Route path="/fixed-expenses" element={<FixedExpenses />} />
              <Route path="/routines" element={<Routines />} />
              <Route path="/statistics" element={<Statistics />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/guide" element={<HelpGuide />} />
            </Routes>
          </Suspense>
        </ErrorBoundary>
      </main>

      <PomodoroTimer />
      <InstallPrompt />
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <ErrorBoundary>
        <ThemeProvider>
          <AuthProvider>
            <AppProvider>
              <ToastProvider>
                <PrivacyProvider>
                  <AppContent />
                </PrivacyProvider>
              </ToastProvider>
            </AppProvider>
          </AuthProvider>
        </ThemeProvider>
      </ErrorBoundary>
    </Router>
  );
}
