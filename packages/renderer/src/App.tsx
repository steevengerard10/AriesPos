import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAppStore } from './store/useAppStore';
import Sidebar from './components/Layout/Sidebar';
import TitleBar from './components/Layout/TitleBar';
import Topbar from './components/Layout/Topbar';
import AriesIA from './components/Layout/AriesIA';
import { POSWindow } from './components/POS/POSWindow';
import { ProductosModule } from './modules/productos/ProductosModule';
import { ClientesModule } from './modules/clientes/ClientesModule';
import { StockModule } from './modules/stock/StockModule';
import { CajaModule } from './modules/caja/CajaModule';
import { EstadisticasModule } from './modules/estadisticas/EstadisticasModule';
import { ConfiguracionModule } from './modules/configuracion/ConfiguracionModule';
import { AyudaModule } from './modules/ayuda/AyudaModule';
import { HistoricoVentas } from './modules/ventas/HistoricoVentas';
import { CuentasPagarModule } from './modules/cuentaspagar/CuentasPagarModule';
import { CombosModule } from './modules/combos/CombosModule';
import { LibroCajaModule } from './modules/librocaja/LibroCajaModule';
import { TutorialesModule } from './modules/tutoriales/TutorialesModule';
import { LoginScreen } from './components/auth/LoginScreen';
import Dashboard from './modules/dashboard/Dashboard';
import { configAPI, appAPI } from './lib/api';
import { onEvent } from './lib/api';
import { useAlertMonitorStore } from './store/useAlertMonitorStore';
import { SetupScreen } from './setup/SetupScreen';
import NetworkSetupWindow from './screens/NetworkSetupWindow';
import { LicenseScreen } from './screens/LicenseScreen';
import { UpdateNotification } from './components/shared/UpdateNotification';
import './i18n';
import i18n from './i18n';

// Splash screen
const SplashScreen: React.FC = () => (
  <div className="flex items-center justify-center h-screen flex-col gap-4" style={{ background: 'var(--bg)' }}>
    <div className="flex items-center gap-3">
      <div
        className="flex items-center justify-center rounded-2xl text-white font-black text-2xl"
        style={{ width: 52, height: 52, background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)', boxShadow: '0 4px 20px rgba(79,142,247,0.4)', fontSize: 24 }}
      >
        A
      </div>
      <div>
        <div className="text-2xl font-black" style={{ color: 'var(--text)', letterSpacing: '-0.02em', fontFamily: "'Syne', sans-serif" }}>
          ARIES<span style={{ color: 'var(--accent)' }}>Pos</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Sistema de ventas</div>
      </div>
    </div>
    <div className="rounded-full overflow-hidden" style={{ width: 120, height: 3, background: 'var(--bg3)' }}>
      <div className="h-full rounded-full animate-loading-bar" style={{ width: '55%', background: 'var(--accent)' }} />
    </div>
  </div>
);


// Layout principal
const MainLayout: React.FC = () => {
  const { currentModule, setCurrentModule, iaOpen, currentUser, config } = useAppStore();
  const addAlert = useAlertMonitorStore((s) => s.addEvent);

  // Escuchar alertas del POS (ventana separada) via IPC
  useEffect(() => {
    const cleanupAlert = onEvent('pos:alert', (data: unknown) => {
      const d = data as { type: string; message: string; detail?: string };
      addAlert(d.type as import('./store/useAlertMonitorStore').AlertEventType, d.message, d.detail);
    });
    const cleanupAbandoned = onEvent('pos:cart-abandoned', (data: unknown) => {
      const d = data as { count: number; items: string[] };
      const preview = d.items.slice(0, 3).join(', ') + (d.items.length > 3 ? ` y ${d.items.length - 3} más` : '');
      addAlert('sale_cancelled', `Caja cerrada con ${d.count} ítem${d.count !== 1 ? 's' : ''} sin cobrar`, preview);
    });
    return () => { cleanupAlert(); cleanupAbandoned(); };
  }, [addAlert]);

  // Cuando se navega a 'pos', abrir la ventana POS y volver al dashboard
  useEffect(() => {
    if (currentModule === 'pos') {
      appAPI.openPosWindow();
      setCurrentModule('dashboard');
    }
  }, [currentModule, setCurrentModule]);

  // Seleccionar todo el contenido al hacer foco en inputs numéricos
  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLInputElement;
      if (target.tagName === 'INPUT' && target.type === 'number') {
        target.select();
      }
    };
    document.addEventListener('focusin', handleFocus);
    return () => document.removeEventListener('focusin', handleFocus);
  }, []);

  // Atajos globales de teclado
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT' || (e.target as HTMLElement)?.tagName === 'TEXTAREA') return;
      const map: Record<string, string> = {
        F3: 'pos',
        F4: 'ventas',
        F5: 'clientes',
        F6: 'stock',
        F7: 'caja',
        F8: 'estadisticas',
        F9: 'configuracion',
        F10: 'ayuda',
      };
      if (map[e.key]) {
        e.preventDefault();
        setCurrentModule(map[e.key]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [setCurrentModule]);

  // Lista de módulos que pueden ser restringidos
  const MODULOS_RESTRINGIBLES = ['ventas','clientes','stock','estadisticas','caja','librocaja','productos','configuracion'];
  const isAdmin = currentUser?.rol === 'admin';
  const moduloHabilitado = (id: string) => {
    if (isAdmin) return true;
    if (!MODULOS_RESTRINGIBLES.includes(id)) return true;
    return config && config[`modulo_${id}`] !== 'false';
  };

  const renderModule = () => {
    // Si el módulo actual está deshabilitado, mostrar Dashboard
    if (!moduloHabilitado(currentModule)) return <Dashboard />;
    switch (currentModule) {
      case 'dashboard':     return <Dashboard />;
      case 'productos':     return <ProductosModule />;
      case 'clientes':      return <ClientesModule />;
      case 'stock':         return <StockModule />;
      case 'caja':          return <CajaModule />;
      case 'estadisticas':  return <EstadisticasModule />;
      case 'configuracion': return <ConfiguracionModule />;
      case 'ayuda':         return <AyudaModule />;
      case 'ventas':        return <HistoricoVentas />;
      case 'cuentaspagar':  return <CuentasPagarModule />;
      case 'combos':        return <CombosModule />;
      case 'librocaja':     return <LibroCajaModule />;
      case 'tutoriales':    return <TutorialesModule />;
      default:              return <Dashboard />;
    }
  };

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--bg)' }}>
      <TitleBar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <Topbar />
          <main className="flex-1 overflow-hidden" style={{ background: 'var(--bg)' }}>
            {renderModule()}
          </main>
        </div>
        {iaOpen && <AriesIA />}
      </div>
    </div>
  );
};

// App raiz
const App: React.FC = () => {
  const { isAuthenticated, setConfig, setServerInfo, theme } = useAppStore();
  const [loading, setLoading] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [licensed, setLicensed] = useState<boolean | null>(null);

  // Aplicar tema guardado al montar y cuando cambia
  useEffect(() => {
    document.documentElement.dataset.theme = theme === 'oscuro' ? '' : theme;
  }, [theme]);

  useEffect(() => {
    const init = async () => {
      try {
        // Verificar licencia primero
        const lic = await (window as any).electron?.licenseCheck?.();
        if (lic && !lic.licensed) {
          setLicensed(false);
          setLoading(false);
          return;
        }
        setLicensed(true);

        // Verificar si la app ya fue configurada (modo servidor/cliente)
        const appCfg = await appAPI.getAppConfig().catch(() => null);
        if (appCfg && appCfg.mode === null) {
          setShowSetup(true);
          setLoading(false);
          return;
        }

        const [cfg, ipInfo] = await Promise.all([
          configAPI.getAll() as Promise<Record<string, string>>,
          appAPI.getServerInfo(),
          new Promise<void>((r) => setTimeout(r, 700)),
        ]);
        setConfig(cfg);
        setServerInfo(ipInfo.ip, ipInfo.port);
        // Aplicar el idioma guardado (solo es / en / pt)
        if (cfg.idioma) {
          const base = cfg.idioma.split('-')[0]?.toLowerCase() ?? '';
          void i18n.changeLanguage(['es', 'en', 'pt'].includes(base) ? base : 'es');
        }
      } catch {
        // Continuar aunque falle la carga inicial
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  if (loading) return <SplashScreen />;
  if (licensed === false) return <LicenseScreen onActivated={() => setLicensed(true)} />;
  if (showSetup) return <SetupScreen onComplete={() => setShowSetup(false)} />;

    return (
      <HashRouter
        future={{
          v7_startTransition: true,
          v7_relativeSplatPath: true,
        }}
      >
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: 'var(--bg3)', color: 'var(--text)', border: '1px solid var(--border)', fontSize: '13px', fontFamily: "'Syne', sans-serif" },
            success: { iconTheme: { primary: '#10b981', secondary: 'var(--bg3)' } },
            error:   { iconTheme: { primary: '#ef4444', secondary: 'var(--bg3)' } },
          }}
        />
        <Routes>
          <Route path="/pos" element={<POSWindow />} />
          <Route path="/network-setup" element={<NetworkSetupWindow />} />
          <Route
            path="/*"
            element={isAuthenticated ? <MainLayout /> : <LoginScreen />}
          />
        </Routes>
        <UpdateNotification />
      </HashRouter>
    );
};

export default App;