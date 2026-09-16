import * as XLSX from 'xlsx';
import { TransactionType } from '../types';

export interface ParsedImportItem {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  amount: number; // positive number
  type: TransactionType;
  category?: string;
  fitId?: string;
  memo?: string;
  rawText?: string;
  installmentNumber?: number;
  totalInstallments?: number;
  installmentStr?: string; // e.g. "2/6"
}

export interface InstallmentInfo {
  cleanDesc: string;
  standardizedDesc: string;
  current?: number;
  total?: number;
  installmentStr?: string; // e.g. "2/6"
}

/**
 * Extracts installment information from description or an explicit column.
 * Handles Brazilian bank/card formats:
 * - "MERCADOLIVRE 02/06" -> 2/6
 * - "MAGALU (01/10)" -> 1/10
 * - "LOJA - PARC 03/05" -> 3/5
 * - "PARC 02/06 LOJA" -> 2/6
 * - "PARC 02 DE 06" -> 2/6
 * - "02/06 LOJA SAO PAULO" -> 2/6
 * - Explicit column containing "02/06", "2/6", "2 de 6", or "2"
 */
export function extractInstallmentInfo(description: string, rawParcCol?: string): InstallmentInfo {
  let cleanDesc = (description || '').trim();
  let current: number | undefined;
  let total: number | undefined;
  let installmentStr: string | undefined;

  // 1. Check explicit installment column if present (e.g. from Excel/CSV 'parcela')
  if (rawParcCol && String(rawParcCol).trim()) {
    const colStr = String(rawParcCol).trim();
    // '02/06', '2/6', '2 de 6'
    const colMatch = colStr.match(/(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/i);
    if (colMatch) {
      const c = parseInt(colMatch[1], 10);
      const t = parseInt(colMatch[2], 10);
      if (t >= 2 && t <= 72 && c >= 1 && c <= t) {
        current = c;
        total = t;
        installmentStr = `${c}/${t}`;
      }
    } else {
      const singleNum = parseInt(colStr, 10);
      if (!isNaN(singleNum) && singleNum >= 1 && singleNum <= 72) {
        current = singleNum;
        installmentStr = String(singleNum);
      }
    }
  }

  // 2. Check description for installment patterns if not fully resolved
  if (!total) {
    // Regex matching: '02/06', '2/6', '(02/06)', '[02/06]', 'PARC 02/06', 'PARC. 02/06', 'PARC 02 DE 06', '- 02/06'
    const descRegex = /(?:(?:parc(?:ela)?\.?\s*)|(?:-\s*)|(?:\(\s*)|(?:\[\s*))?(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})(?:\s*\)|\s*\])?/gi;
    const matches = [...cleanDesc.matchAll(descRegex)];

    if (matches.length > 0) {
      // Find best match: prefer ones with explicit keyword prefix or nearest to the end
      let bestMatch = matches[matches.length - 1];
      for (const m of matches) {
        if (/parc|de|\(|\-|\//i.test(m[0])) {
          bestMatch = m;
        }
      }

      const c = parseInt(bestMatch[1], 10);
      const t = parseInt(bestMatch[2], 10);

      // Validate: total must be between 2 and 72, and current <= total
      const isValidInstallment = t >= 2 && t <= 72 && c >= 1 && c <= t;

      if (isValidInstallment) {
        current = c;
        total = t;
        installmentStr = `${c}/${t}`;
        // Clean description by removing the installment fragment
        cleanDesc = cleanDesc
          .replace(bestMatch[0], '')
          .replace(/\s{2,}/g, ' ')
          .replace(/^[\s\-–—/]+|[\s\-–—/]+$/g, '')
          .trim();
      }
    }
  }

  if (!cleanDesc) cleanDesc = description;

  const standardizedDesc = installmentStr
    ? `${cleanDesc} ${installmentStr.includes('/') ? installmentStr : `${installmentStr}x`}`
    : cleanDesc;

  return {
    cleanDesc,
    standardizedDesc,
    current,
    total,
    installmentStr,
  };
}

/**
 * Helper to parse date string (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD).
 */
export function parseDateStr(str: string): string {
  const clean = str.trim().replace(/[.]/g, '/').replace(/[-]/g, '/');
  const parts = clean.split('/');

  if (parts.length === 3) {
    // If first part is 4 digits -> YYYY/MM/DD
    if (parts[0].length === 4) {
      const y = parts[0];
      const m = parts[1].padStart(2, '0');
      const d = parts[2].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    // If third part is 4 digits -> DD/MM/YYYY
    if (parts[2].length === 4) {
      const d = parts[0].padStart(2, '0');
      const m = parts[1].padStart(2, '0');
      const y = parts[2];
      return `${y}-${m}-${d}`;
    }
  }
  return new Date().toISOString().split('T')[0];
}

/**
 * Helper to parse currency/number string (handles R$, commas, dots, negatives, and parentheses).
 */
export function parseAmountStr(str: string): { amount: number; isNegative: boolean } {
  let clean = str.replace(/R\$/gi, '').replace(/\s+/g, '').trim();
  let isNegative = false;

  if (clean.startsWith('-') || clean.endsWith('-') || (clean.startsWith('(') && clean.endsWith(')'))) {
    isNegative = true;
    clean = clean.replace(/[-()]/g, '');
  }

  // Brazilian format check: "1.250,50" -> remove dot, replace comma with dot
  if (clean.includes('.') && clean.includes(',')) {
    clean = clean.replace(/\./g, '').replace(',', '.');
  } else if (clean.includes(',')) {
    clean = clean.replace(',', '.');
  }

  const num = parseFloat(clean);
  return {
    amount: isNaN(num) ? 0 : Math.abs(num),
    isNegative,
  };
}

/**
 * Parses an OFX (Open Financial Exchange) string (compatible with SGML and XML from Brazilian banks).
 */
export function parseOFX(content: string): ParsedImportItem[] {
  const items: ParsedImportItem[] = [];

  // Match all STMTTRN transactions
  const stmtRegex = /<STMTTRN>([\s\S]*?)(?:<\/STMTTRN>|(?=<STMTTRN>)|$)/gi;
  let match: RegExpExecArray | null;

  const getTagValue = (block: string, tag: string): string => {
    const regex = new RegExp(`<${tag}>([^<\\r\\n]+)`, 'i');
    const tagMatch = block.match(regex);
    return tagMatch ? tagMatch[1].trim() : '';
  };

  while ((match = stmtRegex.exec(content)) !== null) {
    const block = match[1];
    if (!block || !block.trim()) continue;

    const trntype = getTagValue(block, 'TRNTYPE').toUpperCase();
    const dtposted = getTagValue(block, 'DTPOSTED');
    const trnamt = getTagValue(block, 'TRNAMT');
    const fitid = getTagValue(block, 'FITID');
    const name = getTagValue(block, 'NAME');
    const memo = getTagValue(block, 'MEMO');

    // Parse date (OFX standard: YYYYMMDDHHMMSS or YYYYMMDD)
    let dateStr = '';
    if (dtposted && dtposted.length >= 8) {
      const year = dtposted.slice(0, 4);
      const month = dtposted.slice(4, 6);
      const day = dtposted.slice(6, 8);
      dateStr = `${year}-${month}-${day}`;
    } else {
      dateStr = new Date().toISOString().split('T')[0];
    }

    // Parse amount
    const rawVal = parseFloat(trnamt.replace(',', '.'));
    if (isNaN(rawVal)) continue;

    const isExpense = rawVal < 0 || trntype === 'DEBIT';
    const amount = Math.abs(rawVal);
    const type = isExpense ? TransactionType.EXPENSE : TransactionType.INCOME;

    // Clean description: prefer MEMO, fallback to NAME, or generic
    let description = (memo || name || trntype || 'Transação').replace(/\s+/g, ' ').trim();
    const inst = extractInstallmentInfo(description);

    items.push({
      id: fitid || `${dateStr}_${amount}_${Math.random().toString(36).substring(2, 7)}`,
      date: dateStr,
      description: inst.standardizedDesc,
      amount,
      type,
      fitId: fitid,
      memo: memo || name,
      installmentNumber: inst.current,
      totalInstallments: inst.total,
      installmentStr: inst.installmentStr,
      rawText: block.trim(),
    });
  }

  return items;
}

/**
 * Parses a CSV string (supports comma, semicolon, tab, and Brazilian number/date formats).
 */
export function parseCSV(content: string): ParsedImportItem[] {
  const items: ParsedImportItem[] = [];
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return items;

  // Detect delimiter from first line
  const firstLine = lines[0];
  const countSemi = (firstLine.match(/;/g) || []).length;
  const countComma = (firstLine.match(/,/g) || []).length;
  const countTab = (firstLine.match(/\t/g) || []).length;

  let delimiter = ';';
  if (countComma > countSemi && countComma > countTab) delimiter = ',';
  else if (countTab > countSemi && countTab > countComma) delimiter = '\t';

  // Helper to split CSV line respecting quotes
  const splitLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim().replace(/^"|"$/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim().replace(/^"|"$/g, ''));
    return result;
  };

  const headers = splitLine(firstLine).map((h) =>
    h
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
  );

  let dateIdx = -1;
  let descIdx = -1;
  let amountIdx = -1;
  let typeIdx = -1;
  let catIdx = -1;
  let parcIdx = -1;

  headers.forEach((h, idx) => {
    if (h.includes('data') || h.includes('date') || h.includes('dt')) {
      if (dateIdx === -1) dateIdx = idx;
    } else if (
      h.includes('descri') ||
      h.includes('hist') ||
      h.includes('lançamento') ||
      h.includes('lancamento') ||
      h.includes('memo') ||
      h.includes('titulo') ||
      h.includes('estabeleci') ||
      h.includes('nome')
    ) {
      if (descIdx === -1) descIdx = idx;
    } else if (h.includes('valor') || h.includes('amount') || h.includes('total') || h.includes('quantia')) {
      if (amountIdx === -1) amountIdx = idx;
    } else if (h.includes('tipo') || h.includes('type')) {
      if (typeIdx === -1) typeIdx = idx;
    } else if (h.includes('categoria') || h.includes('category')) {
      if (catIdx === -1) catIdx = idx;
    } else if (
      h.includes('parcela') ||
      h.includes('parc') ||
      h.includes('prestacao') ||
      h.includes('prestac') ||
      h === 'pc'
    ) {
      if (parcIdx === -1) parcIdx = idx;
    }
  });

  // Fallbacks if columns weren't recognized by name
  if (dateIdx === -1) dateIdx = 0;
  if (descIdx === -1) descIdx = 1;
  if (amountIdx === -1) amountIdx = Math.min(2, headers.length - 1);

  // Process rows
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    if (cols.length <= Math.max(dateIdx, descIdx, amountIdx)) continue;

    const rawDate = cols[dateIdx] || '';
    const rawDesc = cols[descIdx] || '';
    const rawAmount = cols[amountIdx] || '';
    const rawType = typeIdx !== -1 ? (cols[typeIdx] || '').toLowerCase() : '';
    const rawCat = catIdx !== -1 ? cols[catIdx] : undefined;
    const rawParc = parcIdx !== -1 ? cols[parcIdx] || '' : '';

    if (!rawDate && !rawAmount) continue;

    const date = parseDateStr(rawDate);
    const { amount, isNegative } = parseAmountStr(rawAmount);
    if (amount === 0) continue;

    let type = TransactionType.EXPENSE;
    if (rawType) {
      if (rawType.includes('receita') || rawType.includes('income') || rawType.includes('entrada') || rawType.includes('cred')) {
        type = TransactionType.INCOME;
      } else {
        type = TransactionType.EXPENSE;
      }
    } else {
      type = isNegative ? TransactionType.EXPENSE : TransactionType.INCOME;
    }

    const inst = extractInstallmentInfo(rawDesc.trim() || 'Transação sem descrição', rawParc);

    items.push({
      id: `${date}_${amount}_${Math.random().toString(36).substring(2, 7)}`,
      date,
      description: inst.standardizedDesc,
      amount,
      type,
      category: rawCat?.trim(),
      installmentNumber: inst.current,
      totalInstallments: inst.total,
      installmentStr: inst.installmentStr,
      rawText: lines[i],
    });
  }

  return items;
}

/**
 * Parses an Excel spreadsheet (.xlsx or .xls) - specifically optimized for Banco Itaú and Brazilian card statements.
 */
export function parseXLSX(buffer: ArrayBuffer): ParsedImportItem[] {
  const items: ParsedImportItem[] = [];

  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) return items;

  // Read the first active sheet
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });
  if (!rawRows || rawRows.length < 2) return items;

  const norm = (val: any): string => {
    return String(val || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };

  // Find header row index
  let headerRowIdx = -1;
  let dateIdx = -1;
  let descIdx = -1;
  let amountIdx = -1;
  let typeIdx = -1;
  let catIdx = -1;
  let parcIdx = -1;

  for (let r = 0; r < Math.min(25, rawRows.length); r++) {
    const row = rawRows[r];
    if (!Array.isArray(row)) continue;

    let dIdx = -1;
    let sIdx = -1;
    let aIdx = -1;
    let tIdx = -1;
    let cIdx = -1;
    let pIdx = -1;

    for (let c = 0; c < row.length; c++) {
      const cell = norm(row[c]);
      if (cell.includes('data') || cell.includes('date') || cell === 'dt') {
        if (dIdx === -1) dIdx = c;
      } else if (
        cell.includes('descri') ||
        cell.includes('hist') ||
        cell.includes('lançamento') ||
        cell.includes('lancamento') ||
        cell.includes('memo') ||
        cell.includes('estabeleci') ||
        cell.includes('titulo') ||
        cell.includes('transacao') ||
        cell === 'nome'
      ) {
        if (sIdx === -1) sIdx = c;
      } else if (
        cell.includes('valor') ||
        cell.includes('amount') ||
        cell.includes('total') ||
        cell.includes('quantia') ||
        cell.includes('r$')
      ) {
        if (aIdx === -1) aIdx = c;
      } else if (cell.includes('tipo') || cell.includes('type')) {
        if (tIdx === -1) tIdx = c;
      } else if (cell.includes('categoria') || cell.includes('category')) {
        if (cIdx === -1) cIdx = c;
      } else if (
        cell.includes('parcela') ||
        cell.includes('parc') ||
        cell.includes('prestacao') ||
        cell.includes('prestac') ||
        cell === 'pc'
      ) {
        if (pIdx === -1) pIdx = c;
      }
    }

    if (dIdx !== -1 && (sIdx !== -1 || aIdx !== -1)) {
      headerRowIdx = r;
      dateIdx = dIdx;
      descIdx = sIdx !== -1 ? sIdx : (dIdx === 0 ? 1 : 0);
      amountIdx = aIdx !== -1 ? aIdx : (descIdx === 1 ? 2 : 1);
      typeIdx = tIdx;
      catIdx = cIdx;
      parcIdx = pIdx;
      break;
    }
  }

  // Fallback
  if (headerRowIdx === -1) {
    headerRowIdx = 0;
    dateIdx = 0;
    descIdx = 1;
    amountIdx = 2;
  }

  // Date formatter for Excel cells
  const formatCellDate = (val: any): string => {
    if (val instanceof Date && !isNaN(val.getTime())) {
      const y = val.getUTCFullYear();
      const m = String(val.getUTCMonth() + 1).padStart(2, '0');
      const d = String(val.getUTCDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    if (typeof val === 'number') {
      try {
        const parsedDate = XLSX.SSF.parse_date_code(val);
        if (parsedDate) {
          const y = parsedDate.y;
          const m = String(parsedDate.m).padStart(2, '0');
          const d = String(parsedDate.d).padStart(2, '0');
          return `${y}-${m}-${d}`;
        }
      } catch {}
    }

    return parseDateStr(String(val || ''));
  };

  // Amount parser for Excel cells
  const parseCellAmount = (val: any): { amount: number; isNegative: boolean } => {
    if (typeof val === 'number') {
      return {
        amount: Math.abs(val),
        isNegative: val < 0,
      };
    }
    return parseAmountStr(String(val || ''));
  };

  const isSummaryRow = (desc: string): boolean => {
    const d = norm(desc);
    return (
      d.includes('total da fatura') ||
      d.includes('saldo anterior') ||
      d.includes('total de compras') ||
      d.includes('subtotal') ||
      d.includes('pagamento de fatura') ||
      (d.includes('encargos') && d.includes('totais'))
    );
  };

  for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
    const row = rawRows[r];
    if (!Array.isArray(row) || row.length === 0) continue;

    const rawDate = row[dateIdx];
    const rawDesc = String(row[descIdx] || '').trim();
    const rawAmount = row[amountIdx];
    const rawType = typeIdx !== -1 ? norm(row[typeIdx]) : '';
    const rawCat = catIdx !== -1 ? String(row[catIdx] || '').trim() : undefined;
    const rawParc = parcIdx !== -1 ? String(row[parcIdx] || '').trim() : '';

    if (!rawDate && !rawAmount) continue;
    if (!rawDesc || isSummaryRow(rawDesc)) continue;

    const date = formatCellDate(rawDate);
    const { amount, isNegative } = parseCellAmount(rawAmount);
    if (amount === 0 || isNaN(amount)) continue;

    // Type detection:
    // In credit card exports, refunds/reversals/credits are marked with - or labeled as credito/estorno
    let type = TransactionType.EXPENSE;
    if (rawType) {
      if (rawType.includes('receita') || rawType.includes('cred') || rawType.includes('entrada') || rawType.includes('income')) {
        type = TransactionType.INCOME;
      } else {
        type = TransactionType.EXPENSE;
      }
    } else {
      const dNorm = norm(rawDesc);
      if (dNorm.includes('estorno') || dNorm.includes('credito') || dNorm.includes('reembolso')) {
        type = TransactionType.INCOME;
      } else {
        type = isNegative ? TransactionType.INCOME : TransactionType.EXPENSE;
      }
    }

    const inst = extractInstallmentInfo(rawDesc, rawParc);

    items.push({
      id: `${date}_${amount}_${Math.random().toString(36).substring(2, 7)}`,
      date,
      description: inst.standardizedDesc,
      amount,
      type,
      category: rawCat,
      installmentNumber: inst.current,
      totalInstallments: inst.total,
      installmentStr: inst.installmentStr,
      rawText: JSON.stringify(row),
    });
  }

  return items;
}

/**
 * Generates and triggers download of a standardized CSV template for FinControl.
 */
export function downloadFinControlTemplate() {
  const headers = ['Data', 'Descrição', 'Valor', 'Tipo', 'Categoria', 'Forma de Pagamento'];
  const sampleRows = [
    ['10/09/2026', 'Supermercado Mensal', '450,00', 'Despesa', 'Alimentação', 'Cartão de Crédito'],
    ['12/09/2026', 'Salário Mensal', '5000,00', 'Receita', 'Salário', 'Débito'],
    ['15/09/2026', 'Posto de Gasolina Shell', '180,00', 'Despesa', 'Transporte', 'Débito'],
    ['18/09/2026', 'Assinatura Netflix', '55,90', 'Despesa', 'Assinaturas', 'Cartão de Crédito'],
  ];

  const csvContent =
    '\uFEFF' +
    [headers.join(';'), ...sampleRows.map((row) => row.map((cell) => `"${cell}"`).join(';'))].join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'modelo-importacao-fincontrol.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
