import React, { useState } from 'react';
import { Globe, Search, Check, X, Loader2, Package, AlertCircle, Download } from 'lucide-react';
import toast from 'react-hot-toast';
import { productosAPI } from '../../lib/api';

interface BusquedaWebModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

interface ResultRow {
  input: string;
  type: 'barcode' | 'nombre';
  status: 'pending' | 'searching' | 'found' | 'not_found' | 'error' | 'imported';
  nombre: string;
  marca: string;
  barcode: string;
  imagen_url: string | null;
  unidad_hint: string;
  precio_costo: string;
  precio_venta: string;
  selected: boolean;
}

export const BusquedaWebModal: React.FC<BusquedaWebModalProps> = ({ onClose, onSuccess }) => {
  const [rawInput, setRawInput] = useState('');
  const [results, setResults] = useState<ResultRow[]>([]);
  const [searching, setSearching] = useState(false);
  const [importing, setImporting] = useState(false);

  const handleSearch = async () => {
    const lines = rawInput
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (!lines.length) { toast.error('Ingresá al menos un código o nombre'); return; }

    setSearching(true);
    const rows: ResultRow[] = lines.map((line) => ({
      input: line,
      type: /^\d{8,14}$/.test(line) ? 'barcode' : 'nombre',
      status: 'searching',
      nombre: '', marca: '', barcode: '', imagen_url: null, unidad_hint: '',
      precio_costo: '', precio_venta: '',
      selected: false,
    }));
    setResults(rows);

    // Buscar de a uno con pequeño delay para no saturar la API
    for (let i = 0; i < rows.length; i++) {
      try {
        const res = await productosAPI.buscarInternet(rows[i].input, rows[i].type);
        if (res.found && res.results?.length) {
          const r = res.results[0];
          rows[i] = {
            ...rows[i],
            status: 'found',
            nombre: r.nombre,
            marca: r.marca,
            barcode: r.barcode || rows[i].input,
            imagen_url: r.imagen_url,
            unidad_hint: r.unidad_hint,
            selected: !!r.nombre,
          };
        } else {
          rows[i] = { ...rows[i], status: 'not_found' };
        }
      } catch {
        rows[i] = { ...rows[i], status: 'error' };
      }
      setResults([...rows]);
      if (i < rows.length - 1) await new Promise((r) => setTimeout(r, 300));
    }
    setSearching(false);
  };

  const toggleSelect = (i: number) => {
    setResults((prev) => prev.map((r, idx) => idx === i ? { ...r, selected: !r.selected } : r));
  };

  const updateField = (i: number, field: 'nombre' | 'marca' | 'precio_costo' | 'precio_venta', val: string) => {
    setResults((prev) => prev.map((r, idx) => idx === i ? { ...r, [field]: val } : r));
  };

  const handleImport = async () => {
    const toImport = results.filter((r) => r.selected && r.status === 'found');
    if (!toImport.length) { toast.error('Seleccioná al menos un producto encontrado'); return; }
    setImporting(true);
    let ok = 0;
    for (const r of toImport) {
      try {
        await productosAPI.create({
          nombre: r.nombre,
          codigo: '',
          codigo_barras: r.barcode,
          marca: r.marca,
          proveedor: '',
          categoria_id: null,
          precio_costo: parseFloat(r.precio_costo) || 0,
          precio_venta: parseFloat(r.precio_venta) || 0,
          precio2: 0,
          precio3: 0,
          stock_actual: 0,
          stock_minimo: 0,
          unidad_medida: r.unidad_hint || 'unidad',
          fraccionable: false,
          en_catalogo: false,
          activo: true,
          imagen_path: null,
        });
        ok++;
        setResults((prev) => prev.map((row) => row === r ? { ...row, status: 'imported' } : row));
      } catch { /* skip */ }
    }
    setImporting(false);
    toast.success(`${ok} producto${ok !== 1 ? 's' : ''} importado${ok !== 1 ? 's' : ''}`);
    if (ok > 0) onSuccess();
  };

  const foundCount = results.filter((r) => r.status === 'found').length;
  const selectedCount = results.filter((r) => r.selected && r.status === 'found').length;

  return (
    <div className="flex flex-col gap-5">
      {/* Instrucciones + textarea */}
      <div>
        <p className="text-sm mb-2" style={{ color: 'var(--text2)' }}>
          Ingresá <strong>códigos de barras</strong> o <strong>nombres de productos</strong>, uno por línea.
          La IA buscará información en internet (Open Food Facts) y autocompletará los datos.
        </p>
        <textarea
          className="input w-full font-mono text-sm"
          rows={6}
          placeholder={'7790040517639\n7790040517646\nCoca Cola 500ml\nYogur Ser frutilla\n...'}
          value={rawInput}
          onChange={(e) => setRawInput(e.target.value)}
          disabled={searching}
          style={{ resize: 'vertical' }}
        />
        <button
          className="btn btn-primary mt-2 flex items-center gap-2"
          onClick={handleSearch}
          disabled={searching || !rawInput.trim()}
        >
          {searching ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
          {searching ? 'Buscando...' : 'Buscar en internet'}
        </button>
      </div>

      {/* Resultados */}
      {results.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
              Resultados — {foundCount} encontrados
            </span>
            <div className="flex gap-2">
              <button className="btn btn-ghost btn-sm text-xs"
                onClick={() => setResults((p) => p.map((r) => r.status === 'found' ? { ...r, selected: true } : r))}>
                Seleccionar todos
              </button>
              <button className="btn btn-ghost btn-sm text-xs"
                onClick={() => setResults((p) => p.map((r) => ({ ...r, selected: false })))}>
                Deseleccionar
              </button>
            </div>
          </div>

          <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)', maxHeight: 'calc(100vh - 380px)', display: 'flex', flexDirection: 'column' }}>
            <table className="w-full text-sm">
              <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                  <th className="py-2 px-3 w-8"></th>
                  <th className="py-2 px-3 text-left" style={{ color: 'var(--text2)' }}>Búsqueda</th>
                  <th className="py-2 px-3 text-left" style={{ color: 'var(--text2)' }}>Nombre encontrado</th>
                  <th className="py-2 px-3 text-left" style={{ color: 'var(--text2)' }}>Marca</th>
                  <th className="py-2 px-3 text-right" style={{ color: 'var(--text2)' }}>Costo</th>
                  <th className="py-2 px-3 text-right" style={{ color: 'var(--text2)' }}>Precio venta</th>
                  <th className="py-2 px-3 w-8"></th>
                </tr>
              </thead>
              <tbody style={{ overflowY: 'auto', display: 'block', maxHeight: 'calc(100vh - 440px)' }}>
                {results.map((r, i) => (
                  <tr key={i} style={{
                    borderBottom: '1px solid var(--border)',
                    background: r.status === 'imported' ? 'rgba(34,197,94,0.07)' : 'transparent',
                    opacity: r.status === 'not_found' || r.status === 'error' ? 0.5 : 1,
                  }}>
                    {/* checkbox */}
                    <td className="py-2 px-3 text-center">
                      {r.status === 'searching' ? (
                        <Loader2 size={13} className="animate-spin text-blue-400 mx-auto" />
                      ) : r.status === 'found' ? (
                        <input type="checkbox" checked={r.selected} onChange={() => toggleSelect(i)}
                          className="w-4 h-4 rounded cursor-pointer" />
                      ) : r.status === 'imported' ? (
                        <Check size={14} className="text-green-400 mx-auto" />
                      ) : (
                        <X size={13} className="text-slate-500 mx-auto" />
                      )}
                    </td>
                    {/* input */}
                    <td className="py-2 px-3 font-mono text-xs" style={{ color: 'var(--text3)' }}>
                      {r.input.length > 18 ? r.input.slice(0, 18) + '…' : r.input}
                      {r.status === 'not_found' && (
                        <span className="ml-1 text-red-400 text-[11px]">no encontrado</span>
                      )}
                    </td>
                    {/* nombre */}
                    <td className="py-2 px-3">
                      {r.status === 'found' ? (
                        <input className="input text-xs py-1 px-2 w-full" value={r.nombre}
                          onChange={(e) => updateField(i, 'nombre', e.target.value)} />
                      ) : (
                        <span style={{ color: 'var(--text2)' }}>{r.nombre || '—'}</span>
                      )}
                    </td>
                    {/* marca */}
                    <td className="py-2 px-3">
                      {r.status === 'found' ? (
                        <input className="input text-xs py-1 px-2 w-28" value={r.marca}
                          onChange={(e) => updateField(i, 'marca', e.target.value)} />
                      ) : (
                        <span style={{ color: 'var(--text3)' }}>{r.marca || '—'}</span>
                      )}
                    </td>
                    {/* costo */}
                    <td className="py-2 px-3">
                      {r.status === 'found' ? (
                        <input type="number" step="0.01" min="0"
                          className="input text-xs py-1 px-2 text-right w-24 font-mono"
                          placeholder="0.00" value={r.precio_costo}
                          onChange={(e) => updateField(i, 'precio_costo', e.target.value)} />
                      ) : <span />}
                    </td>
                    {/* precio venta */}
                    <td className="py-2 px-3">
                      {r.status === 'found' ? (
                        <input type="number" step="0.01" min="0"
                          className="input text-xs py-1 px-2 text-right w-24 font-mono"
                          placeholder="0.00" value={r.precio_venta}
                          onChange={(e) => updateField(i, 'precio_venta', e.target.value)} />
                      ) : <span />}
                    </td>
                    {/* imagen preview */}
                    <td className="py-2 px-3">
                      {r.imagen_url && r.status === 'found' && (
                        <img src={r.imagen_url} alt="" className="w-8 h-8 rounded object-cover" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer importar */}
          {foundCount > 0 && (
            <div className="mt-3 flex items-center justify-between">
              <span className="text-sm" style={{ color: 'var(--text3)' }}>
                {selectedCount} seleccionado{selectedCount !== 1 ? 's' : ''} para importar
              </span>
              <button
                className="btn btn-primary flex items-center gap-2"
                onClick={handleImport}
                disabled={importing || selectedCount === 0}
              >
                {importing ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                {importing ? 'Importando...' : `Importar ${selectedCount > 0 ? selectedCount : ''} producto${selectedCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
