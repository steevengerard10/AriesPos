/**
 * language-detector.ts
 *
 * Detecta si un string extraído de un backup Nextar (.nx1 / NexusDB) es:
 *   'es'     → producto real en español (CONSERVAR)
 *   'pt'     → campo del sistema Nextar en portugués brasileño (ELIMINAR)
 *   'en'     → término técnico interno de NexusDB (ELIMINAR)
 *   'basura' → fragmento binario sin sentido (ELIMINAR)
 */

export type Language = 'es' | 'pt' | 'en' | 'basura';

// ── TÉRMINOS TÉCNICOS DE NEXUSDB (inglés) ─────────────────────────────────────
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
  'stream', 'blob', 'record', 'autoinc',
  'smap', 'iuid', 'irecver', 'blobok_v2', 'userqd',
  'google inc', 'srgb',
  // Strings cortos técnicos
  'ok', 'ver', 'id', 'ref', 'idx', 'seq', 'tmp', 'buf',
  'ptr', 'hdr', 'fld', 'tbl', 'col',
]);

// Prefijos que indican origen NexusDB
const NEXUSDB_PREFIXES = [
  'Tnx', 'nxt', 'NX!', 'NXSH', 'BDVD', 'NXHD', 'NXHM',
  'BlobOk', 'RecVer', 'catRec', 'firRec', 'cloudID',
  'USERQD', 'SMAP', 'IUID',
];

// ── CAMPOS DEL SISTEMA NEXTAR (portugués brasileño) ───────────────────────────
const NEXTAR_SYSTEM_FIELDS = new Set([
  // Tabla Produto
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
  'combo', 'notax', 'integracao', 'integracaoid',
  'precototal', 'custototal',
  'exportar', 'departamentoid',
  'recver', 'catrecver', 'firecver', 'catok', 'firok', 'dinc',
  // Otras tablas
  'inventario', 'inventarioitens',
  'alteracaopreco', 'alteracaoprecoitens',
  'prodfor', 'produtovalidade',
  'pageespecies', 'recebiveis',
  'debito', 'credito', 'cotacao',
]);

// Palabras portuguesas que indican campo de sistema (aunque no estén en la lista exacta)
const PT_KEYWORDS = [
  'descricao', 'preco', 'estoque', 'produto', 'fornecedor',
  'ativo', 'unidade', 'categoria', 'especie', 'caixa',
  'fracionado', 'inclusao', 'alteracao', 'codigonum',
  'precovenda', 'precocusto', 'estoquemin', 'estoquemax',
];

// Palabras técnicas inglesas que indican NexusDB
const EN_KEYWORDS = [
  'descriptor', 'sequential', 'nexusdb', 'blobok',
  'recver', 'smap', 'iuid',
];

// ── PALABRAS CORTAS VÁLIDAS EN ESPAÑOL ────────────────────────────────────────
const VALID_SHORT_ES = new Set([
  // Marcas / productos reales de 3 chars
  'pan', 'sal', 'ajo', 'ron', 'gin', 'gel', 'gas',
  'luz', 'red', 'sol', 'don', 'los', 'las',
  'max', 'top', 'box', 'mix', 'set', 'kit', 'duo', 'eco',
  'bio', 'pro', 'fit', 'new', 'hot', 'dry', 'off',
  'low', 'big', 'zero', 'plus', 'lite',
  'cafe', 'mate', 'flan', 'tuco', 'seven', 'seven up',
  // Marcas argentinas conocidas
  'ala', 'ace', 'dus', 'rin',
]);

// ── FUNCIÓN PRINCIPAL ─────────────────────────────────────────────────────────

export interface ValidationResult {
  isValid: boolean;
  language: Language;
  reason?: string;
}

export function validateProductName(raw: string): ValidationResult {
  const s = raw.trim();
  const sLow = s.toLowerCase();

  // Vacío
  if (s.length === 0) return { isValid: false, language: 'basura', reason: 'vacío' };

  // Demasiado corto (< 3 chars)
  if (s.length < 3) return { isValid: false, language: 'basura', reason: 'muy corto' };

  // Demasiado largo (> 120 chars)
  if (s.length > 120) return { isValid: false, language: 'basura', reason: 'demasiado largo' };

  // Solo dígitos = EAN / código numérico
  if (/^\d+$/.test(s)) return { isValid: false, language: 'basura', reason: 'código numérico EAN' };

  // Sin ninguna letra
  if (!/[a-zA-ZáéíóúñüÁÉÍÓÚÑÜ]/.test(s)) {
    return { isValid: false, language: 'basura', reason: 'sin letras' };
  }

  // Caracteres de control (binario)
  if ([...s].some(c => { const cp = c.codePointAt(0)!; return cp < 0x20 || (cp >= 0x80 && cp <= 0x9F); })) {
    return { isValid: false, language: 'basura', reason: 'caracteres de control' };
  }

  // Prefijos técnicos NexusDB
  for (const prefix of NEXUSDB_PREFIXES) {
    if (s.startsWith(prefix)) {
      return { isValid: false, language: 'en', reason: `prefijo NexusDB: ${prefix}` };
    }
  }

  // Campo del sistema Nextar (portugués) — match exacto
  if (NEXTAR_SYSTEM_FIELDS.has(sLow)) {
    return { isValid: false, language: 'pt', reason: 'campo del sistema Nextar' };
  }

  // Término técnico NexusDB completo
  if (NEXUSDB_TECHNICAL.has(sLow)) {
    return { isValid: false, language: 'en', reason: 'término técnico NexusDB' };
  }

  // Keywords portuguesas (sub-string)
  for (const kw of PT_KEYWORDS) {
    if (sLow === kw || sLow.startsWith(kw + ' ') || sLow.startsWith(kw + '_')) {
      return { isValid: false, language: 'pt', reason: `keyword portuguesa: ${kw}` };
    }
  }

  // Keywords inglesas técnicas (sub-string al inicio)
  for (const kw of EN_KEYWORDS) {
    if (sLow.startsWith(kw)) {
      return { isValid: false, language: 'en', reason: `keyword técnica inglesa: ${kw}` };
    }
  }

  // Strings de 3–4 chars: solo válidos si son palabras conocidas o tienen sentido
  if (s.length <= 4) {
    if (VALID_SHORT_ES.has(sLow)) {
      return { isValid: true, language: 'es' };
    }
    // Patrón "letra+número" o "número+letra" = basura binaria
    if (/^[A-Z][0-9]$/.test(s) || /^[0-9][A-Z]$/.test(s)) {
      return { isValid: false, language: 'basura', reason: 'par letra+número binario' };
    }
    // Si tiene menos del 75% letras en 3-4 chars, es sospechoso
    const letters = [...s].filter(c => /[a-zA-ZáéíóúñüÁÉÍÓÚÑÜ]/i.test(c)).length;
    if (letters < s.length * 0.75) {
      return { isValid: false, language: 'basura', reason: 'demasiados no-letras en string corto' };
    }
  }

  // Ratio de letras: mínimo 30% para strings largos
  const letters = [...s].filter(c => /[a-zA-ZáéíóúñüÁÉÍÓÚÑÜ]/i.test(c)).length;
  if (letters < 2) return { isValid: false, language: 'basura', reason: 'menos de 2 letras' };
  if (s.length > 5 && (letters / s.length) < 0.30) {
    return { isValid: false, language: 'basura', reason: 'ratio letras muy bajo' };
  }

  // Primer carácter debe ser letra o dígito
  if (!/^[a-zA-ZáéíóúñüÁÉÍÓÚÑÜ0-9]/.test(s)) {
    return { isValid: false, language: 'basura', reason: 'empieza con símbolo' };
  }

  // Detectar idioma del string válido
  const lang = detectLanguage(sLow);
  if (lang === 'pt') return { isValid: false, language: 'pt', reason: 'texto en portugués técnico' };
  if (lang === 'en') return { isValid: false, language: 'en', reason: 'texto técnico en inglés' };

  return { isValid: true, language: 'es' };
}

function detectLanguage(sLow: string): Language {
  for (const kw of PT_KEYWORDS) {
    if (sLow.includes(kw)) return 'pt';
  }
  for (const kw of EN_KEYWORDS) {
    if (sLow.includes(kw)) return 'en';
  }
  return 'es';
}
