import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  HelpCircle, ShoppingCart, Package, Users, Warehouse, Vault,
  BarChart2, Settings, FileText, ChevronRight, Keyboard, Search
} from 'lucide-react';

interface Section {
  id: string;
  icon: React.ReactNode;
  title: string;
  content: React.ReactNode;
}

const ATAJOS = [
  { key: 'F2', desc: 'Abrir ventana POS / Nueva venta' },
  { key: 'F3', desc: 'Ir al módulo de Productos (en POS: buscar productos)' },
  { key: 'F4', desc: 'Ver Histórico de Ventas' },
  { key: 'F5', desc: 'Ir al módulo de Clientes' },
  { key: 'F6', desc: 'Ir al módulo de Stock' },
  { key: 'F7', desc: 'Ir al módulo de Caja' },
  { key: 'F8', desc: 'Ir a Estadísticas' },
  { key: 'F9', desc: 'Ir a Configuración' },
  { key: 'F10', desc: 'Ir a Ayuda' },
  { key: 'Esc', desc: 'Cancelar venta en el POS (con confirmación)' },
  { key: 'Enter (POS)', desc: 'Confirmar ticket cuando el carrito no está vacío' },
];

const sections: Section[] = [
  {
    id: 'pos',
    icon: <ShoppingCart size={18} />,
    title: 'Ventana POS (Punto de Venta)',
    content: (
      <div className="space-y-3 text-sm text-slate-300">
        <p>El POS es la ventana principal para registrar ventas. Se abre con <kbd className="kbd">F2</kbd> o haciendo clic en "Nueva Venta" en la barra lateral.</p>
        <ul className="space-y-1.5 ml-4 list-none">
          <li>• <strong className="text-white">Buscar producto:</strong> Escribí el nombre o escaneá el código de barras en el campo de búsqueda.</li>
          <li>• <strong className="text-white">Modificar cantidad:</strong> Hacé clic sobre la cantidad en el carrito para editarla directamente.</li>
          <li>• <strong className="text-white">Aplicar descuento:</strong> Usá el icono de % en el carrito para descuento por ítem o el botón "% Desc. Global".</li>
          <li>• <strong className="text-white">Asignar cliente:</strong> Presioná el botón del cliente y buscá por nombre o DNI.</li>
          <li>• <strong className="text-white">Escanear:</strong> Conectá tu lector USB. Al escribir rápido + Enter se detecta como código de barras.</li>
          <li>• <strong className="text-white">Niveles de precio:</strong> Cambiá entre P1, P2, P3 para aplicar precios diferenciados por cliente.</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'productos',
    icon: <Package size={18} />,
    title: 'Módulo Productos',
    content: (
      <div className="space-y-3 text-sm text-slate-300">
        <p>Administrá tu catálogo de productos con soporte para múltiples precios, imágenes y unidades de medida.</p>
        <ul className="space-y-1.5 ml-4">
          <li>• <strong className="text-white">Importar CSV:</strong> Desde Nextar u otras fuentes. Aceptamos separador coma o punto y coma.</li>
          <li>• <strong className="text-white">Vista grilla/lista:</strong> Alternás con los botones de cuadrícula en la barra superior.</li>
          <li>• <strong className="text-white">Stock bajo:</strong> Los productos marcados en rojo tienen stock por debajo del mínimo configurado.</li>
          <li>• <strong className="text-white">Catálogo online:</strong> Activá "Mostrar en catálogo" para que el producto aparezca en la web.</li>
          <li>• <strong className="text-white">Fraccionable:</strong> Permite vender fracciones (ej: 0.5 kg) en el POS.</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'clientes',
    icon: <Users size={18} />,
    title: 'Módulo Clientes',
    content: (
      <div className="space-y-3 text-sm text-slate-300">
        <p>Gestioná tu base de clientes y llevá el control de la cuenta corriente (fiado).</p>
        <ul className="space-y-1.5 ml-4">
          <li>• <strong className="text-white">Saldo fiado:</strong> Se actualiza automáticamente con cada venta en modo "fiado".</li>
          <li>• <strong className="text-white">Registrar pago:</strong> Usá el botón verde "Registrar pago" en el panel de cuenta corriente.</li>
          <li>• <strong className="text-white">Límite de crédito:</strong> Define el máximo que puede deber un cliente.</li>
          <li>• <strong className="text-white">Historial:</strong> Hacé clic en un cliente para ver todas sus compras.</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'stock',
    icon: <Warehouse size={18} />,
    title: 'Módulo Stock',
    content: (
      <div className="space-y-3 text-sm text-slate-300">
        <p>Monitoreá el inventario y registrá movimientos manuales de stock.</p>
        <ul className="space-y-1.5 ml-4">
          <li>• <strong className="text-white">Ajuste de stock:</strong> Registrá entradas, salidas o ajustes manuales con su motivo.</li>
          <li>• <strong className="text-white">Valor inventario:</strong> Se muestra el valor total en costo en la parte superior.</li>
          <li>• <strong className="text-white">Movimientos:</strong> En la pestaña "Movimientos" podés ver el historial completo.</li>
          <li>• <strong className="text-white">Alertas:</strong> Los productos con stock ≤ mínimo aparecen destacados en rojo.</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'caja',
    icon: <Vault size={18} />,
    title: 'Módulo Caja',
    content: (
      <div className="space-y-3 text-sm text-slate-300">
        <p>Controlá los flujos de dinero y cerrá cada jornada con su arqueo.</p>
        <ul className="space-y-1.5 ml-4">
          <li>• <strong className="text-white">Abrir caja:</strong> Ingresá el saldo inicial contado. Es recomendable hacerlo al inicio del día.</li>
          <li>• <strong className="text-white">Ingresos/Egresos:</strong> Registrá movimientos que no sean ventas (ej: pago a proveedor).</li>
          <li>• <strong className="text-white">Saldo estimado:</strong> Calculado automáticamente: saldo_inicial + ventas_efectivo + ingresos - egresos.</li>
          <li>• <strong className="text-white">Cerrar caja:</strong> Ingresá el saldo físico para calcular la diferencia.</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'backup',
    icon: <Settings size={18} />,
    title: 'Backups y Seguridad',
    content: (
      <div className="space-y-3 text-sm text-slate-300">
        <p>Los backups se guardan en la carpeta <code className="font-mono text-blue-400">userData/backups/</code> del sistema.</p>
        <ul className="space-y-1.5 ml-4">
          <li>• <strong className="text-white">Backup automático:</strong> Se crea automáticamente al cerrar la aplicación si está activado.</li>
          <li>• <strong className="text-white">Backup manual:</strong> En Configuración → Backup → "Crear backup ahora".</li>
          <li>• <strong className="text-white">Restaurar:</strong> Seleccioná un backup de la lista y hacé clic en "Restaurar".</li>
          <li>• <strong className="text-white">Retención:</strong> Se mantienen automáticamente los últimos 30 backups.</li>
        </ul>
      </div>
    ),
  },
];

export const AyudaModule: React.FC = () => {
  const { t } = useTranslation();
  const [activeSection, setActiveSection] = useState('pos');
  const [search, setSearch] = useState('');

  const filtered = sections.filter((s) =>
    !search.trim() || s.title.toLowerCase().includes(search.toLowerCase())
  );

  const current = sections.find((s) => s.id === activeSection);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-6 pt-6 pb-4 flex items-center justify-between border-b border-slate-700">
        <h1 className="module-title flex items-center gap-3"><HelpCircle size={28} className="text-blue-400" /> {t('ayuda.title')}</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar ayuda */}
        <div className="w-64 border-r border-slate-700 flex flex-col">
          <div className="p-4">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input type="text" placeholder={t('ayuda.search')} value={search} onChange={(e) => setSearch(e.target.value)} className="input pl-8 text-sm py-1.5" />
            </div>
          </div>
          <nav className="flex-1 overflow-auto px-3 pb-4 space-y-1">
            {filtered.map((s) => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-all ${activeSection === s.id ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30' : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'}`}
              >
                {s.icon}
                {s.title.split(' ').slice(0, 2).join(' ')}
                {activeSection === s.id && <ChevronRight size={14} className="ml-auto" />}
              </button>
            ))}
            <button
              onClick={() => setActiveSection('atajos')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-left transition-all ${activeSection === 'atajos' ? 'bg-blue-600/20 text-blue-400 border border-blue-600/30' : 'text-slate-400 hover:bg-slate-700/50 hover:text-white'}`}
            >
              <Keyboard size={18} />
              {t('ayuda.shortcuts')}
              {activeSection === 'atajos' && <ChevronRight size={14} className="ml-auto" />}
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-8">
          {activeSection === 'atajos' ? (
            <div>
              <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-3"><Keyboard size={22} className="text-blue-400" /> {t('ayuda.shortcuts')}</h2>
              <p className="text-sm text-slate-400 mb-6">{t('ayuda.shortcutsDesc')}</p>
              <div className="space-y-2 max-w-lg">
                {ATAJOS.map((a) => (
                  <div key={a.key} className="flex items-center justify-between bg-slate-800 border border-slate-700 rounded-lg px-4 py-3">
                    <span className="text-sm text-slate-300">{a.desc}</span>
                    <kbd className="kbd">{a.key}</kbd>
                  </div>
                ))}
              </div>
            </div>
          ) : current ? (
            <div>
              <h2 className="text-xl font-bold text-white mb-2 flex items-center gap-3">
                <span className="text-blue-400">{current.icon}</span>
                {current.title}
              </h2>
              <div className="mt-4">{current.content}</div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              <div className="text-center">
                <HelpCircle size={48} className="mx-auto mb-3 text-slate-600" />
                <p>Seleccioná un tema del menú</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
