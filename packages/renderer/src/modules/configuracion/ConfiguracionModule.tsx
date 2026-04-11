import React, { useState, useEffect, useRef } from 'react';
import {
  Settings, Save, Server, Printer, Database, Upload, Download, RefreshCw,
  Check, AlertTriangle, ExternalLink, Copy, Wifi, Globe, CreditCard, Plus, Trash2, Archive, Palette, ShieldCheck, Lock, Eye, EyeOff, RotateCcw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { configAPI, backupAPI, appAPI, productosAPI, firmaAPI } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import { ImportNixtarModal } from '../../components/modals/ImportNixtarModal';
import { useTranslation } from 'react-i18next';
import i18n from '../../i18n';
import { useAppStore, AppTheme } from '../../store/useAppStore';

const IDIOMAS = [
  { code: 'es', nativeName: 'Español',   name: 'Spanish' },
  { code: 'en', nativeName: 'English',   name: 'English' },
  { code: 'pt', nativeName: 'Português', name: 'Portuguese' },
];

interface BackupInfo {
  path: string;
  filename: string;
  fecha: string;
  size: number;
}

interface MetodoPagoConfig { id: string; nombre: string; activo: boolean; }

const METODOS_PAGO_DEFAULT: MetodoPagoConfig[] = [
  { id: 'efectivo',      nombre: 'Efectivo',      activo: true },
  { id: 'tarjeta',       nombre: 'Tarjeta',       activo: true },
  { id: 'transferencia', nombre: 'Transferencia', activo: true },
  { id: 'cripto',        nombre: 'Cripto',        activo: true },
  { id: 'fiado',         nombre: 'Fiado',         activo: true },
];

const TABS = [
  { id: 'negocio', label: 'Negocio' },
  { id: 'ticket', label: 'Ticket' },
  { id: 'pagos', label: 'Pagos' },
  { id: 'servidor', label: 'Servidor web' },
  { id: 'backup', label: 'Backup' },
  { id: 'importar', label: 'Importar/Exportar' },
  { id: 'idioma', label: 'Idioma' },
  { id: 'apariencia', label: 'Apariencia' },
  { id: 'firma', label: 'Firma 🛡️' },
  { id: 'acceso', label: 'Control de Acceso 🔐' },
];

const TEMAS: { id: AppTheme; nombre: string; bg: string; bg2: string; accent: string; text: string; border: string }[] = [
  { id: 'oscuro',  nombre: 'Oscuro',  bg: '#0d0f14', bg2: '#131720', accent: '#4f8ef7', text: '#e2e8f0', border: '#2a3148' },
  { id: 'claro',   nombre: 'Claro',   bg: '#f0f2f5', bg2: '#ffffff', accent: '#2563eb', text: '#0f172a', border: '#cbd5e1' },
  { id: 'negro',   nombre: 'Negro',   bg: '#000000', bg2: '#111111', accent: '#4f8ef7', text: '#f5f5f5', border: '#222222' },
  { id: 'gris',    nombre: 'Gris',    bg: '#1c1c1c', bg2: '#242424', accent: '#828282', text: '#f0f0f0', border: '#404040' },
  { id: 'magenta', nombre: 'Magenta', bg: '#0f0812', bg2: '#160d1a', accent: '#9C1563', text: '#f0e6f5', border: '#3a1a47' },
];

export const ConfiguracionModule: React.FC = () => {
  const [tab, setTab] = useState('negocio');
  const { t } = useTranslation();
  const { theme, setTheme, currentUser } = useAppStore();
  const isAdmin = currentUser?.rol === 'admin';
  const [config, setConfig] = useState<Record<string, string>>({});
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverInfo, setServerInfo] = useState({ port: 3001, localIP: '' });
  const [metodosPago, setMetodosPago] = useState<MetodoPagoConfig[]>(METODOS_PAGO_DEFAULT);
  const [nuevoMetodoNombre, setNuevoMetodoNombre] = useState('');
  const csvRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);
  const [showImportNixtar, setShowImportNixtar] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const [resetting, setResetting] = useState(false);

  // ── Firma del propietario ──
  const [firmaEstado, setFirmaEstado] = useState<{ registrada: boolean; nombre: string; fecha: string } | null>(null);
  const [firmaMode, setFirmaMode] = useState<'ver' | 'registrar' | 'cambiar'>('ver');
  const [firmaNombre, setFirmaNombre] = useState('');
  const [firmaClave, setFirmaClave] = useState('');
  const [firmaClaveActual, setFirmaClaveActual] = useState('');
  const [firmaClaveNueva, setFirmaClaveNueva] = useState('');
  const [firmaNombreNuevo, setFirmaNombreNuevo] = useState('');
  const [firmaShowPwd, setFirmaShowPwd] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cfg, bkps, ip, firma] = await Promise.all([
        configAPI.getAll() as Promise<Record<string, string>>,
        backupAPI.list() as Promise<BackupInfo[]>,
        appAPI.getServerInfo(),
        firmaAPI.estado(),
      ]);
      setConfig(cfg);
      setBackups(bkps);
      setServerInfo({ port: ip.port, localIP: ip.ip });
      setFirmaEstado(firma);
      try {
        if (cfg.metodos_pago) setMetodosPago(JSON.parse(cfg.metodos_pago) as MetodoPagoConfig[]);
      } catch { /* usa defaults */ }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const setField = (key: string, value: string) => setConfig((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await configAPI.setMultiple(config);
      toast.success('Configuración guardada');
    } finally {
      setSaving(false);
    }
  };

  const handleBackup = async () => {
    toast.loading('Creando backup...', { id: 'backup' });
    try {
      await backupAPI.create();
      toast.success('Backup creado exitosamente', { id: 'backup' });
      const bkps = await backupAPI.list() as BackupInfo[];
      setBackups(bkps);
    } catch {
      toast.error('Error al crear backup', { id: 'backup' });
    }
  };

  const handleRestore = async (path: string) => {
    if (!confirm('¿Estás seguro? Se guardará un backup del estado actual antes de restaurar.')) return;
    toast.loading('Restaurando...', { id: 'restore' });
    try {
      await backupAPI.restore(path);
      toast.success('Restaurado. Reiniciando...', { id: 'restore' });
      setTimeout(() => appAPI.restart(), 2000);
    } catch {
      toast.error('Error al restaurar', { id: 'restore' });
    }
  };

  const handleExportJSON = async () => {
    toast.loading('Exportando...', { id: 'exp' });
    try {
      const data = await (window as unknown as { electron: { invoke: (c: string, ...a: unknown[]) => Promise<unknown> } }).electron.invoke('export:allJSON') as string;
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ariespos_export_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Datos exportados', { id: 'exp' });
    } catch {
      toast.error('Error al exportar', { id: 'exp' });
    }
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!confirm('⚠️ Esta operación sobrescribirá los datos existentes. ¿Continuar?')) return;
    const text = await file.text();
    toast.loading('Importando...', { id: 'imp' });
    try {
      await (window as unknown as { electron: { invoke: (c: string, ...a: unknown[]) => Promise<unknown> } }).electron.invoke('import:fromJSON', text);
      toast.success('Datos importados. Recargando...', { id: 'imp' });
      setTimeout(() => appAPI.restart(), 2000);
    } catch {
      toast.error('Error al importar', { id: 'imp' });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copiado al portapapeles');
  };

  const handleRegistrarFirma = async () => {
    if (!firmaNombre.trim() || !firmaClave.trim()) { toast.error('Completá nombre y clave'); return; }
    const res = await firmaAPI.registrar(firmaNombre, firmaClave);
    if (!res.success) { toast.error(res.error || 'Error'); return; }
    toast.success('¡Firma registrada correctamente!');
    setFirmaNombre(''); setFirmaClave('');
    setFirmaMode('ver');
    const e = await firmaAPI.estado(); setFirmaEstado(e);
  };

  const handleResetOperacional = async () => {
    setResetting(true);
    try {
      await (window as unknown as { electron: { invoke: (c: string, ...a: unknown[]) => Promise<unknown> } }).electron.invoke('db:resetOperacional');
      toast.success('Datos operacionales eliminados. Se creó un backup previo.');
      setShowResetModal(false);
      setResetConfirmText('');
    } catch {
      toast.error('Error al reiniciar los datos');
    } finally {
      setResetting(false);
    }
  };

  const handleCambiarFirma = async () => {
    if (!firmaClaveActual.trim() || !firmaClaveNueva.trim()) { toast.error('Completá todos los campos'); return; }
    const res = await firmaAPI.cambiar(firmaClaveActual, firmaClaveNueva, firmaNombreNuevo || firmaEstado?.nombre || '');
    if (!res.success) { toast.error(res.error || 'Error'); return; }
    toast.success('¡Firma actualizada!');
    setFirmaClaveActual(''); setFirmaClaveNueva(''); setFirmaNombreNuevo('');
    setFirmaMode('ver');
    const e = await firmaAPI.estado(); setFirmaEstado(e);
  };

  if (loading) return <div className="flex items-center justify-center h-full text-slate-400">{t('common.loading')}</div>;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 module-header px-6 pt-6">
        <h1 className="module-title flex items-center gap-3"><Settings size={28} className="text-blue-400" /> {t('page.configuracion.title')}</h1>
        <button className="btn-primary btn" onClick={handleSave} disabled={saving}>
          <Save size={16} /> {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>

      {/* Tabs */}
      <div className="shrink-0 px-6 flex gap-1 border-b border-slate-700">
        {TABS.map((tabItem) => (
          <button key={tabItem.id} onClick={() => setTab(tabItem.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${tab === tabItem.id ? 'border-blue-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}>
            {t(`config.tab.${tabItem.id}`)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto px-6 py-6">
        {tab === 'negocio' && (
          <div className="max-w-xl space-y-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Datos del negocio</h2>
            {[
              { key: 'nombre_negocio', label: 'Nombre del negocio', placeholder: 'Mi Negocio S.A.' },
              { key: 'direccion', label: 'Dirección', placeholder: 'Calle 123, Ciudad' },
              { key: 'telefono', label: 'Teléfono', placeholder: '+54 9 11 1234-5678' },
              { key: 'cuit', label: 'CUIT', placeholder: '20-12345678-9' },
              { key: 'email', label: 'Email', placeholder: 'ventas@negocio.com' },
              { key: 'moneda', label: 'Moneda', placeholder: 'ARS' },
            ].map(({ key, label, placeholder }) => (
              <div key={key}>
                <label className="label">{label}</label>
                <input className="input" value={config[key] || ''} onChange={(e) => setField(key, e.target.value)} placeholder={placeholder} />
              </div>
            ))}
          </div>
        )}

        {tab === 'ticket' && (
          <div className="max-w-xl space-y-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Configuración de ticket</h2>
            <div>
              <label className="label">Ancho del papel</label>
              <select className="input" value={config.ticket_ancho || '80'} onChange={(e) => setField('ticket_ancho', e.target.value)}>
                <option value="58">58mm (pequeño)</option>
                <option value="80">80mm (estándar)</option>
              </select>
            </div>
            <div>
              <label className="label">Mensaje en el ticket</label>
              <input className="input" value={config.ticket_mensaje || ''} onChange={(e) => setField('ticket_mensaje', e.target.value)} placeholder="¡Gracias por su compra!" />
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="auto_print" checked={config.auto_imprimir_ticket === 'true'} onChange={(e) => setField('auto_imprimir_ticket', e.target.checked ? 'true' : 'false')} className="w-4 h-4 rounded" />
              <label htmlFor="auto_print" className="text-sm text-slate-300 cursor-pointer">Imprimir ticket automáticamente al confirmar venta</label>
            </div>
            <div className="flex items-center gap-3">
              <input type="checkbox" id="show_cuit" checked={config.ticket_mostrar_cuit === 'true'} onChange={(e) => setField('ticket_mostrar_cuit', e.target.checked ? 'true' : 'false')} className="w-4 h-4 rounded" />
              <label htmlFor="show_cuit" className="text-sm text-slate-300 cursor-pointer">Mostrar CUIT en el ticket</label>
            </div>
          </div>
        )}

        {tab === 'servidor' && (
          <div className="max-w-xl space-y-6">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Servidor Web</h2>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center gap-3">
                <Wifi size={20} className="text-green-400" />
                <div>
                  <div className="text-sm font-semibold text-white">Servidor activo</div>
                  <div className="text-xs text-slate-400">El servidor web está corriendo en tu red local</div>
                </div>
                <span className="ml-auto badge badge-green">● Online</span>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3">
                  <div>
                    <div className="text-xs text-slate-400">Catálogo web</div>
                    <div className="font-mono text-sm text-blue-400">http://{serverInfo.localIP}:{serverInfo.port}/catalogo</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => copyToClipboard(`http://${serverInfo.localIP}:${serverInfo.port}/catalogo`)} className="btn-ghost btn p-1.5"><Copy size={13} /></button>
                    <button onClick={() => (window as unknown as { electron: { invoke: (c: string, ...a: unknown[]) => Promise<unknown> } }).electron.invoke('shell:open-path', `http://${serverInfo.localIP}:${serverInfo.port}/catalogo`)} className="btn-ghost btn p-1.5"><ExternalLink size={13} /></button>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-slate-700/50 rounded-lg p-3">
                  <div>
                    <div className="text-xs text-slate-400">Panel administrador</div>
                    <div className="font-mono text-sm text-blue-400">http://{serverInfo.localIP}:{serverInfo.port}/admin</div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => copyToClipboard(`http://${serverInfo.localIP}:${serverInfo.port}/admin`)} className="btn-ghost btn p-1.5"><Copy size={13} /></button>
                  </div>
                </div>
              </div>

              <div>
                <label className="label">Puerto del servidor</label>
                <input className="input font-mono" type="number" value={config.server_port || '3001'} onChange={(e) => setField('server_port', e.target.value)} />
                <p className="text-xs text-slate-500 mt-1">Requiere reiniciar la app para aplicar</p>
              </div>

              <div>
                <label className="label">Contraseña del panel admin</label>
                <input className="input" type="password" value={config.admin_password || ''} onChange={(e) => setField('admin_password', e.target.value)} placeholder="admin" />
              </div>
            </div>
          </div>
        )}

        {tab === 'backup' && (
          <div className="max-w-2xl space-y-6">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Copias de seguridad</h2>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="text-sm font-semibold text-white">Crear backup ahora</div>
                  <div className="text-xs text-slate-400 mt-0.5">Se guarda una copia de toda la base de datos</div>
                </div>
                <button className="btn-primary btn" onClick={handleBackup}><Database size={16} /> Crear backup</button>
              </div>

              <div className="flex items-center gap-3">
                <input type="checkbox" id="auto_backup" checked={config.backup_automatico === 'true'} onChange={(e) => setField('backup_automatico', e.target.checked ? 'true' : 'false')} className="w-4 h-4 rounded" />
                <label htmlFor="auto_backup" className="text-sm text-slate-300 cursor-pointer">Backup automático al cerrar la app</label>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-3">Backups disponibles ({backups.length})</h3>
              <div className="space-y-2">
                {backups.length === 0 ? (
                  <p className="text-slate-500 text-sm">No hay backups creados aún</p>
                ) : backups.map((b) => (
                  <div key={b.path} className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-lg p-3">
                    <div>
                      <div className="text-sm text-white">{b.filename}</div>
                      <div className="text-xs text-slate-400">{formatDate(b.fecha)} · {(b.size / 1024).toFixed(1)} KB</div>
                    </div>
                    <button onClick={() => handleRestore(b.path)} className="btn-secondary btn btn-sm">
                      <RefreshCw size={12} /> Restaurar
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* ZONA DE PELIGRO */}
            <div className="border border-red-800 rounded-xl p-5 bg-red-950/30">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle size={18} className="text-red-400" />
                <h3 className="text-sm font-bold text-red-400 uppercase tracking-wider">Zona de peligro</h3>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                Estas acciones son irreversibles. Antes de ejecutarlas se crea un backup automático.
              </p>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold text-white">Reiniciar datos operacionales</div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Borra <strong className="text-slate-300">ventas, cajas, libro de caja y cuentas a pagar</strong>.<br />
                    Conserva productos, clientes, categorías, combos y configuración.
                  </div>
                </div>
                <button
                  className="shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 text-white text-sm font-semibold transition-colors"
                  onClick={() => { setShowResetModal(true); setResetConfirmText(''); }}
                >
                  <RotateCcw size={15} /> Reiniciar
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'pagos' && (
          <div className="max-w-md space-y-6">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Métodos de pago</h2>
            <p className="text-xs text-slate-500">Activá o desactivá los métodos disponibles en el POS. Podés agregar métodos personalizados.</p>

            <div className="space-y-2">
              {metodosPago.map((m) => (
                <div key={m.id} className="flex items-center gap-3 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3">
                  <CreditCard size={16} className="text-slate-400 shrink-0" />
                  <span className="flex-1 text-sm font-medium text-white">{m.nombre}</span>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={m.activo}
                      onChange={(e) => setMetodosPago((prev) => prev.map((x) => x.id === m.id ? { ...x, activo: e.target.checked } : x))}
                    />
                    <div className="w-9 h-5 bg-slate-600 rounded-full peer peer-checked:bg-blue-600 transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                  </label>
                  {/* Solo se pueden eliminar los personalizados (no los built-in) */}
                  {!['efectivo','tarjeta','transferencia','cripto','fiado'].includes(m.id) && (
                    <button
                      onClick={() => setMetodosPago((prev) => prev.filter((x) => x.id !== m.id))}
                      className="btn-ghost btn p-1 hover:text-red-400"
                      title="Eliminar"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Agregar método personalizado */}
            <div className="flex gap-2">
              <input
                className="input flex-1 text-sm"
                placeholder="Nombre del método (ej: MercadoPago)"
                value={nuevoMetodoNombre}
                onChange={(e) => setNuevoMetodoNombre(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && nuevoMetodoNombre.trim()) {
                    const id = nuevoMetodoNombre.trim().toLowerCase().replace(/\s+/g, '_');
                    if (!metodosPago.find((x) => x.id === id)) {
                      setMetodosPago((prev) => [...prev, { id, nombre: nuevoMetodoNombre.trim(), activo: true }]);
                    }
                    setNuevoMetodoNombre('');
                  }
                }}
              />
              <button
                className="btn-secondary btn"
                onClick={() => {
                  if (!nuevoMetodoNombre.trim()) return;
                  const id = nuevoMetodoNombre.trim().toLowerCase().replace(/\s+/g, '_');
                  if (!metodosPago.find((x) => x.id === id)) {
                    setMetodosPago((prev) => [...prev, { id, nombre: nuevoMetodoNombre.trim(), activo: true }]);
                  }
                  setNuevoMetodoNombre('');
                }}
              >
                <Plus size={16} /> Agregar
              </button>
            </div>

            <button
              className="btn-primary btn w-full"
              onClick={async () => {
                await configAPI.set('metodos_pago', JSON.stringify(metodosPago));
                toast.success('Métodos de pago guardados');
              }}
            >
              <Save size={16} /> Guardar métodos de pago
            </button>
          </div>
        )}

        {tab === 'importar' && (
          <div className="max-w-xl space-y-6">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">Importar / Exportar datos</h2>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 space-y-4">
              <div>
                <h3 className="text-sm font-semibold text-white mb-1">Exportar todo (JSON)</h3>
                <p className="text-xs text-slate-400 mb-3">Descarga todos los datos del sistema (productos, clientes, ventas, etc.)</p>
                <button className="btn-secondary btn" onClick={handleExportJSON}><Download size={16} /> Exportar JSON</button>
              </div>

              <div className="border-t border-slate-700 pt-4">
                <h3 className="text-sm font-semibold text-white mb-1">Importar desde JSON</h3>
                <p className="text-xs text-slate-400 mb-3">⚠️ Esto reemplazará los datos actuales con el archivo importado</p>
                <button className="btn-secondary btn" onClick={() => jsonRef.current?.click()}>
                  <Upload size={16} /> Importar JSON
                </button>
              </div>

              <div className="border-t border-slate-700 pt-4">
                <h3 className="text-sm font-semibold text-white mb-1">Importar productos desde Nextar CSV</h3>
                <p className="text-xs text-slate-400 mb-3">Compatible con el formato de exportación de Nextar</p>
                <button className="btn-secondary btn" onClick={() => csvRef.current?.click()}>
                  <Upload size={16} /> Importar CSV Nextar
                </button>
              </div>

              <div className="border-t border-slate-700 pt-4">
                <h3 className="text-sm font-semibold text-white mb-1">Importar backup completo de Nextar</h3>
                <p className="text-xs text-slate-400 mb-3">Importa productos, clientes y categorías desde el archivo .zip de backup de Nextar</p>
                <button className="btn btn-secondary flex items-center gap-2" onClick={() => setShowImportNixtar(true)}>
                  <Archive size={16} /> Backup completo Nextar
                </button>
              </div>

              <div className="border-t border-red-900 pt-4">
                <h3 className="text-sm font-semibold text-red-400 mb-1">Zona peligrosa</h3>
                <p className="text-xs text-slate-400 mb-3">Elimina <strong>todos</strong> los productos y categorías del sistema. Las ventas e historial no se borran.</p>
                <button
                  className="btn bg-red-700 hover:bg-red-600 text-white border-0"
                  onClick={async () => {
                    if (!window.confirm('¿Estás seguro? Esto borrará TODOS los productos y categorías. Esta acción no se puede deshacer.')) return;
                    try {
                      await productosAPI.truncate();
                      toast.success('Todos los productos fueron eliminados');
                    } catch (err) {
                      toast.error('Error al eliminar productos: ' + String(err));
                    }
                  }}
                >
                  🗑️ Borrar todos los productos
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'apariencia' && (
          <div className="max-w-xl space-y-6">
            <div className="flex items-center gap-2">
              <Palette size={16} style={{ color: 'var(--accent)' }} />
              <h2 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text2)' }}>Apariencia</h2>
            </div>
            <p className="text-xs" style={{ color: 'var(--text3)' }}>Elegí el tema visual del sistema. El cambio se aplica de inmediato.</p>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {TEMAS.map((tema) => (
                <button
                  key={tema.id}
                  onClick={() => setTheme(tema.id)}
                  className="relative flex flex-col gap-3 rounded-xl border-2 p-4 transition-all hover:brightness-110"
                  style={{
                    background: tema.bg,
                    borderColor: theme === tema.id ? tema.accent : tema.border,
                    boxShadow: theme === tema.id ? `0 0 0 1px ${tema.accent}44` : 'none',
                  }}
                >
                  {/* Vista previa de colores */}
                  <div className="flex gap-1.5 items-center">
                    <div className="rounded-full w-5 h-5 ring-1 ring-white/10" style={{ background: tema.bg2 }} />
                    <div className="rounded-full w-5 h-5 ring-1 ring-white/10" style={{ background: tema.accent }} />
                  </div>
                  <span className="text-xs font-semibold text-left" style={{ color: tema.text }}>{tema.nombre}</span>
                  {theme === tema.id && (
                    <div
                      className="absolute top-2 right-2 rounded-full w-5 h-5 flex items-center justify-center"
                      style={{ background: tema.accent }}
                    >
                      <Check size={11} className="text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {tab === 'idioma' && (
          <div className="max-w-sm space-y-4">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
              {t('config.idioma.title')}
            </h2>
            <p className="text-xs text-slate-500">{t('config.idioma.select')}</p>

            <div className="relative">
              <select
                value={i18n.language}
                onChange={async (e) => {
                  const code = e.target.value;
                  const lang = IDIOMAS.find(l => l.code === code);
                  await i18n.changeLanguage(code);
                  await configAPI.set('idioma', code);
                  toast.success(t('config.idioma.saved') + ': ' + (lang?.nativeName ?? code));
                }}
                className="w-full appearance-none bg-slate-800 border border-slate-700 text-white rounded-xl px-4 py-3 pr-10 text-sm focus:outline-none focus:border-blue-500 cursor-pointer"
              >
                {IDIOMAS.map((lang) => (
                  <option key={lang.code} value={lang.code}>
                    {lang.nativeName} — {lang.name}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>

            <p className="text-[11px] text-slate-500">
              <span className="text-slate-300 font-medium">
                {IDIOMAS.find(l => l.code === i18n.language)?.nativeName}
              </span>
              {' — '}{IDIOMAS.find(l => l.code === i18n.language)?.name}
            </p>
          </div>
        )}

        {/* ── CONTROL DE ACCESO ── */}
        {tab === 'acceso' && (
          <div className="max-w-xl space-y-5">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(79,142,247,0.12)', border: '1px solid rgba(79,142,247,0.25)' }}>
                <Lock size={20} className="text-blue-400" />
              </div>
              <div>
                <h2 className="font-bold text-base" style={{ color: 'var(--text)' }}>Control de Acceso</h2>
                <p className="text-xs" style={{ color: 'var(--text3)' }}>
                  Configurá qué módulos pueden usar los cajeros en esta PC.
                </p>
              </div>
            </div>

            {!isAdmin ? (
              <div className="rounded-xl p-5 flex items-center gap-4" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                <Lock size={22} className="text-slate-500 shrink-0" />
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--text)' }}>Solo administradores</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                    Necesitás iniciar sesión como administrador para modificar el acceso a módulos.
                  </p>
                </div>
              </div>
            ) : (
              <>
                {/* Módulos habilitados para cajeros */}
                <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Módulos habilitados para cajeros</h3>
                  <p className="text-xs" style={{ color: 'var(--text3)' }}>
                    Los módulos desactivados mostrarán un candado 🔒 para los cajeros y no podrán accederse.
                  </p>
                  <div className="space-y-3">
                    {[
                      { id: 'ventas',        nombre: 'Ventas',         desc: 'Historial y gestión de ventas' },
                      { id: 'clientes',      nombre: 'Clientes',       desc: 'Gestión de clientes y fiados' },
                      { id: 'productos',     nombre: 'Productos',      desc: 'ABM de productos y precios' },
                      { id: 'stock',         nombre: 'Stock',          desc: 'Control de inventario' },
                      { id: 'estadisticas',  nombre: 'Estadísticas',   desc: 'Reportes y análisis de ventas' },
                      { id: 'caja',          nombre: 'Caja',           desc: 'Apertura y cierre de caja' },
                      { id: 'librocaja',     nombre: 'Libro de Caja',  desc: 'Registro diario de movimientos' },
                      { id: 'configuracion', nombre: 'Configuración',  desc: 'Ajustes del sistema' },
                    ].map((mod) => (
                      <div key={mod.id} className="flex items-center justify-between py-2 border-b border-slate-700/50 last:border-0">
                        <div>
                          <div className="text-sm font-medium" style={{ color: 'var(--text)' }}>{mod.nombre}</div>
                          <div className="text-xs" style={{ color: 'var(--text3)' }}>{mod.desc}</div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            checked={config[`modulo_${mod.id}`] !== 'false'}
                            onChange={e => setField(`modulo_${mod.id}`, e.target.checked ? 'true' : 'false')}
                          />
                          <div className="w-10 h-5 bg-slate-600 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-5 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-500"></div>
                        </label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-amber-400 mt-1">⚠️ Guardá los cambios para que tomen efecto.</p>
                </div>

                {/* PIN de administrador */}
                <div className="rounded-xl p-5 space-y-3" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                  <h3 className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Código de administrador</h3>
                  <p className="text-xs" style={{ color: 'var(--text3)' }}>
                    PIN numérico que identifica al administrador de esta caja. Dejalo en blanco para no usar código.
                  </p>
                  <div>
                    <label className="label">Código / PIN</label>
                    <input
                      className="input max-w-xs font-mono tracking-widest"
                      type="password"
                      maxLength={12}
                      placeholder="••••"
                      value={config['pin_admin'] || ''}
                      onChange={e => setField('pin_admin', e.target.value)}
                    />
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── FIRMA DEL PROPIETARIO ── */}
        {tab === 'firma' && (
          <div className="p-6 max-w-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 rounded-lg" style={{ background: 'rgba(79,142,247,0.12)', border: '1px solid rgba(79,142,247,0.25)' }}>
                <ShieldCheck size={22} className="text-blue-400" />
              </div>
              <div>
                <h2 className="font-bold text-base" style={{ color: 'var(--text)' }}>Firma del Propietario</h2>
                <p className="text-xs" style={{ color: 'var(--text3)' }}>
                  Protege el programa con tu firma personal. Solo vos podés cambiarla.
                </p>
              </div>
            </div>

            {/* Estado actual */}
            <div className="rounded-xl p-4 mb-5" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
              {firmaEstado?.registrada ? (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}>
                    <Check size={18} className="text-green-400" />
                  </div>
                  <div>
                    <p className="font-semibold" style={{ color: 'var(--text)' }}>{firmaEstado.nombre}</p>
                    <p className="text-xs" style={{ color: 'var(--text3)' }}>
                      Firma registrada el {firmaEstado.fecha} · Protegida con SHA-256
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ background: 'rgba(251,191,36,0.12)', border: '1px solid rgba(251,191,36,0.3)' }}>
                    <AlertTriangle size={18} className="text-yellow-400" />
                  </div>
                  <div>
                    <p className="font-semibold text-yellow-400">Sin firma registrada</p>
                    <p className="text-xs" style={{ color: 'var(--text3)' }}>Registrá tu firma para proteger el programa.</p>
                  </div>
                </div>
              )}
            </div>

            {/* Formulario registrar */}
            {!firmaEstado?.registrada && firmaMode !== 'cambiar' && (
              <div className="rounded-xl p-4" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                <h3 className="font-semibold mb-3 text-sm" style={{ color: 'var(--text)' }}>Registrar mi firma</h3>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="label text-xs">Tu nombre</label>
                    <input className="input w-full" placeholder="Ej: Juan García"
                      value={firmaNombre} onChange={(e) => setFirmaNombre(e.target.value)} />
                  </div>
                  <div>
                    <label className="label text-xs">Clave secreta</label>
                    <div className="relative">
                      <input
                        className="input w-full pr-10"
                        type={firmaShowPwd ? 'text' : 'password'}
                        placeholder="Inventá una clave que solo vos conozcas"
                        value={firmaClave}
                        onChange={(e) => setFirmaClave(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleRegistrarFirma()}
                      />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        onClick={() => setFirmaShowPwd(v => !v)}>
                        {firmaShowPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--text3)' }}>
                      ⚠️ No se puede recuperar si la olvidás. Guardala en un lugar seguro.
                    </p>
                  </div>
                  <button className="btn btn-primary mt-1 flex items-center gap-2 self-start" onClick={handleRegistrarFirma}>
                    <ShieldCheck size={15} /> Registrar firma
                  </button>
                </div>
              </div>
            )}

            {/* Botón cambiar firma */}
            {firmaEstado?.registrada && firmaMode === 'ver' && (
              <button className="btn btn-secondary flex items-center gap-2"
                onClick={() => setFirmaMode('cambiar')}>
                <Lock size={15} /> Cambiar firma
              </button>
            )}

            {/* Formulario cambiar firma */}
            {firmaEstado?.registrada && firmaMode === 'cambiar' && (
              <div className="rounded-xl p-4" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
                <h3 className="font-semibold mb-3 text-sm" style={{ color: 'var(--text)' }}>Cambiar firma</h3>
                <div className="flex flex-col gap-3">
                  <div>
                    <label className="label text-xs">Clave actual</label>
                    <div className="relative">
                      <input className="input w-full pr-10" type={firmaShowPwd ? 'text' : 'password'}
                        placeholder="Tu clave actual" value={firmaClaveActual}
                        onChange={(e) => setFirmaClaveActual(e.target.value)} />
                      <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                        onClick={() => setFirmaShowPwd(v => !v)}>
                        {firmaShowPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="label text-xs">Nuevo nombre (opcional)</label>
                    <input className="input w-full" placeholder={firmaEstado.nombre}
                      value={firmaNombreNuevo} onChange={(e) => setFirmaNombreNuevo(e.target.value)} />
                  </div>
                  <div>
                    <label className="label text-xs">Nueva clave</label>
                    <input className="input w-full" type={firmaShowPwd ? 'text' : 'password'}
                      placeholder="Nueva clave secreta" value={firmaClaveNueva}
                      onChange={(e) => setFirmaClaveNueva(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleCambiarFirma()} />
                  </div>
                  <div className="flex gap-2 mt-1">
                    <button className="btn btn-primary flex items-center gap-2" onClick={handleCambiarFirma}>
                      <Check size={15} /> Confirmar cambio
                    </button>
                    <button className="btn btn-ghost" onClick={() => { setFirmaMode('ver'); setFirmaClaveActual(''); setFirmaClaveNueva(''); setFirmaNombreNuevo(''); }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showImportNixtar && <ImportNixtarModal onClose={() => setShowImportNixtar(false)} />}

      {/* Modal de confirmación para reiniciar datos operacionales */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowResetModal(false)}>
          <div className="bg-slate-900 border border-red-700 rounded-2xl p-8 w-full max-w-md shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <AlertTriangle size={24} className="text-red-400 shrink-0" />
              <h2 className="text-lg font-bold text-white">¿Reiniciar datos operacionales?</h2>
            </div>
            <p className="text-sm text-slate-300 mb-2">
              Esta acción <strong className="text-red-400">eliminará permanentemente</strong>:
            </p>
            <ul className="text-sm text-slate-400 list-disc list-inside mb-4 space-y-1">
              <li>Todas las ventas e ítems de ventas</li>
              <li>Todos los movimientos de stock</li>
              <li>Todas las sesiones y movimientos de caja</li>
              <li>Todo el libro de caja (días, turnos, egresos)</li>
              <li>Todas las cuentas a pagar</li>
            </ul>
            <p className="text-sm text-green-400 mb-5">
              ✓ Se conservarán productos, clientes, categorías, combos y configuración.<br />
              ✓ Se creará un backup automático antes de borrar.
            </p>
            <p className="text-sm text-slate-300 mb-2">
              Escribí <strong className="text-red-400">REINICIAR</strong> para confirmar:
            </p>
            <input
              className="w-full px-3 py-2 rounded-lg bg-slate-800 border border-slate-600 text-white text-sm mb-4 focus:outline-none focus:border-red-500"
              placeholder="Escribí REINICIAR"
              value={resetConfirmText}
              onChange={(e) => setResetConfirmText(e.target.value)}
              autoFocus
            />
            <div className="flex gap-3">
              <button
                className="flex-1 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-semibold transition-colors"
                onClick={() => setShowResetModal(false)}
              >
                Cancelar
              </button>
              <button
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors"
                disabled={resetConfirmText.trim().toUpperCase() !== 'REINICIAR' || resetting}
                onClick={handleResetOperacional}
              >
                <RotateCcw size={15} />
                {resetting ? 'Reiniciando...' : 'Confirmar reinicio'}
              </button>
            </div>
          </div>
        </div>
      )}

      <input ref={jsonRef} type="file" accept=".json" className="hidden" onChange={handleImportJSON} />
      <input ref={csvRef} type="file" accept=".csv,.txt" className="hidden" onChange={async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        // Nextar exporta en Windows-1252 (Latin), no UTF-8
        const text = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.readAsText(file, 'windows-1252');
        });
        const { invoke } = (window as unknown as { electron: { invoke: (c: string, ...a: unknown[]) => Promise<unknown> } }).electron;
        toast.loading('Importando productos...', { id: 'csv-import' });
        try {
          const result = await invoke('productos:importCSV', text) as { imported: number; errors: number };
          toast.success(`Importados: ${result.imported} | Errores: ${result.errors}`, { id: 'csv-import' });
        } catch (err) {
          toast.error('Error al importar: ' + String(err), { id: 'csv-import' });
        }
        e.target.value = '';
      }} />
    </div>
  );
};
