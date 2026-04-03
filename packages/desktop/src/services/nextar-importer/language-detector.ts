/**
 * language-detector.ts
 *
 * Detecta si un string extraído de un backup Nextar (.nx1 / NexusDB) es:
 *   'es'     → producto real en español (CONSERVAR)
 *   'pt'     → campo del sistema Nextar en portugués brasileño (ELIMINAR)
 *   'en'     → término técnico interno de NexusDB (ELIMINAR)
 *   'basura' → fragmento binario sin sentido (ELIMINAR)
 *
 * REGLAS CONSERVADORAS:
 *  - Solo coincidencia EXACTA con diccionarios conocidos (nunca substring)
 *  - Para "símbolos": detectar chars fuera del rango válido español/productos
 *  - NO usar detectLanguage con .includes() porque mata productos válidos
 *    (ej: "Nativo" contiene "ativo" → falso positivo PT)
 */

export type Language = 'es' | 'pt' | 'en' | 'basura';

// ── TÉRMINOS TÉCNICOS DE NEXUSDB (inglés) — solo coincidencia EXACTA ──────────
// ⚠️ NO incluir palabras ambiguas como 'ok', 'ver', 'id', 'ref', 'stream', 'blob'
//    porque podrían aparecer en nombres de productos reales.
const NEXUSDB_TECHNICAL = new Set([
  'streambescriptor', 'streamdescriptor', 'tnxbasestreamdescriptor',
  'filesdescriptor', 'tnxfilesdescriptor', 'tnxfiledescriptor',
  'localedescriptor', 'tnxlocaledescriptor', 'recorddescriptor',
  'tnxheaprecorddescriptor', 'blobdescriptor', 'tnxheapblobdescriptor',
  'fieldsdescriptor', 'tnxfieldsdescriptor', 'tnxfielddescriptor',
  'tablesdescriptor', 'indicesdescriptor', 'customdescsdescriptor',
  'tnxbaseblockheapdescriptor', 'tnxbaseheapdescriptor',
  'tnxbaserecordcompressiondescriptor', 'tnxautoguiddefaultvaluedescriptor',
  'nexusdb', 'nxsh', 'bdvd', 'nxhd', 'nxhm',
  'sequential access index', 'data/datadict file',
  'blobok_v2', 'userqd', 'google inc', 'srgb',
]);

// Prefijos binarios que indican origen NexusDB — solo los muy específicos
const NEXUSDB_PREFIXES = [
  'Tnx', 'NX!', 'NXSH', 'BDVD', 'NXHD', 'NXHM',
];

// ── CAMPOS DEL SISTEMA NEXTAR (portugués brasileño) — solo coincidencia EXACTA ─
const NEXTAR_SYSTEM_FIELDS = new Set([
  'produto', 'produtos',
  'categoria', 'subcategoria', 'especie',
  'caixa', 'tran', 'cliente', 'clientes',
  'config', 'configuracao', 'configuracoes',
  'estoque', 'estoquesaldo', 'estoqueposicao',
  'fornecedor', 'fornecedores',
  'unidade', 'unidades',
  'preco', 'precos', 'precovenda', 'precocusto',
  'marca', 'marcas',
  'ativo', 'inativo',
  'descricao',
  'localizacao',
  'inclusao', 'alteracao',
  'codigo', 'codigonum', 'codigo2',
  'eangtin', 'ean',
  'produtodescr', 'produtopublicado',
  'precoauto', 'taxarevenda', 'margem',
  'imagem', 'imagemurl', 'imagemmd5',
  'storage', 'fotos',
  'balpreco', 'custounitario',
  'podealterarpreco', 'permitevendafracionada',
  'naocontrolaestoque',
  'estoquemin', 'estoquemax', 'abaixomin',
  'estoquerepo', 'promocional',
  'prodtini', 'prodtfim', 'precopromo',
  'prodpropria', 'comissaoperc', 'comissaolucro',
  'pesobruto', 'pesoliq',
  'fidelidade', 'fidpontos',
  'ncm_ex', 'cest', 'modst', 'pauta',
  'medicamento', 'prodanvisa',
  'motivo', 'numerolote', 'quantidadelote',
  'cadastrorapido', 'incluidoem', 'alteradoem', 'alteradopor',
  'codanp', 'descanp',
  'notax', 'integracao', 'integracaoid',
  'precototal', 'custototal',
  'exportar', 'departamentoid',
  'recver', 'catrecver', 'firecver', 'catok', 'firok', 'dinc',
  'inventario', 'inventarioitens',
  'alteracaopreco', 'alteracaoprecoitens',
  'prodfor', 'produtovalidade',
  'pageespecies', 'recebiveis',
  'debito', 'credito', 'cotacao',
]);

// Caracteres válidos en un nombre de producto (español / latinoamérica)
// Cualquier char FUERA de este rango es sospechoso
const VALID_PRODUCT_CHAR_RE = /[a-zA-Z0-9áéíóúñüÁÉÍÓÚÑÜàèìòùÀÈÌÒÙâêîôûÂÊÎÔÛãõÃÕäöïÄÖÏ\s\-_\.,()\/%#@'"&+!?¡¿:;°×ªº]/;

// ── FUNCIÓN PRINCIPAL ─────────────────────────────────────────────────────────

export interface ValidationResult {
  isValid: boolean;
  language: Language;
  reason?: string;
}

export function validateProductName(raw: string): ValidationResult {
  const s = raw.trim();
  const sLow = s.toLowerCase();

  // 1. Vacío
  if (s.length === 0) return { isValid: false, language: 'basura', reason: 'vacío' };

  // 2. Demasiado corto (< 2 chars)
  if (s.length < 2) return { isValid: false, language: 'basura', reason: 'muy corto' };

  // 3. Demasiado largo (> 150 chars)
  if (s.length > 150) return { isValid: false, language: 'basura', reason: 'demasiado largo' };

  // 4. Solo dígitos = EAN / código numérico
  if (/^\d+$/.test(s)) return { isValid: false, language: 'basura', reason: 'código numérico EAN' };

  // 5. Caracteres de control (binario)
  if ([...s].some(c => { const cp = c.codePointAt(0)!; return cp < 0x20 || (cp >= 0x7F && cp <= 0x9F); })) {
    return { isValid: false, language: 'basura', reason: 'caracteres de control' };
  }

  // 6. Cualquier char fuera del rango latino (> U+024F = 591) → basura binary NexusDB
  //    Los nombres de productos argentinos solo usan Latin Basic + Latin-1 + Latin Extended-A/B
  //    Chars como ‰ (U+2030), … (U+2026), œ (U+0153 ok), † (U+2020), etc. son basura binaria.
  //    U+024F = 591 = fin de Latin Extended-B (cubre á é í ó ú ñ ü y todos los acentos normales)
  const charArr = [...s];
  const hasHighUnicode = charArr.some(c => c.codePointAt(0)! > 591);
  if (hasHighUnicode) {
    return { isValid: false, language: 'basura', reason: 'contiene chars fuera del rango latino' };
  }

  // También verificar ratio de chars NO en el charset esperado para productos
  const symbolCount = charArr.filter(c => !VALID_PRODUCT_CHAR_RE.test(c)).length;
  if (symbolCount > 0 && symbolCount / charArr.length > 0.10) {
    return { isValid: false, language: 'basura', reason: `símbolos inválidos (${symbolCount}/${charArr.length})` };
  }

  // 7. Sin ninguna letra reconocible
  if (!/[a-zA-ZáéíóúñüÁÉÍÓÚÑÜàèìòùâêîôûãõäöï]/.test(s)) {
    return { isValid: false, language: 'basura', reason: 'sin letras' };
  }

  // 8. Prefijos binarios NexusDB
  for (const prefix of NEXUSDB_PREFIXES) {
    if (s.startsWith(prefix)) {
      return { isValid: false, language: 'en', reason: `prefijo NexusDB: ${prefix}` };
    }
  }

  // 9. Coincidencia EXACTA con términos técnicos NexusDB
  if (NEXUSDB_TECHNICAL.has(sLow)) {
    return { isValid: false, language: 'en', reason: 'término técnico NexusDB' };
  }

  // 10. Coincidencia EXACTA con campos del sistema Nextar (portugués)
  if (NEXTAR_SYSTEM_FIELDS.has(sLow)) {
    return { isValid: false, language: 'pt', reason: 'campo del sistema Nextar' };
  }

  // 11. Producto válido en español ✓
  return { isValid: true, language: 'es' };
}
