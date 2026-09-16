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

    items.push({
      id: fitid || `${dateStr}_${amount}_${Math.random().toString(36).substring(2, 7)}`,
      date: dateStr,
      description,
      amount,
      type,
      fitId: fitid,
      memo: memo || name,
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

  headers.forEach((h, idx) => {
    if (h.includes('data') || h.includes('date') || h.includes('dt')) {
      if (dateIdx === -1) dateIdx = idx;
    } else if (
      h.includes('descri') ||
      h.includes('hist') ||
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
    }
  });

  // Fallbacks if columns weren't recognized by name
  if (dateIdx === -1) dateIdx = 0;
  if (descIdx === -1) descIdx = 1;
  if (amountIdx === -1) amountIdx = Math.min(2, headers.length - 1);

  // Helper to parse date string (DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD)
  const parseDateStr = (str: string): string => {
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
  };

  // Helper to parse currency/number
  const parseAmountStr = (str: string): { amount: number; isNegative: boolean } => {
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
  };

  // Process rows
  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i]);
    if (cols.length <= Math.max(dateIdx, descIdx, amountIdx)) continue;

    const rawDate = cols[dateIdx] || '';
    const rawDesc = cols[descIdx] || '';
    const rawAmount = cols[amountIdx] || '';
    const rawType = typeIdx !== -1 ? (cols[typeIdx] || '').toLowerCase() : '';
    const rawCat = catIdx !== -1 ? cols[catIdx] : undefined;

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

    items.push({
      id: `${date}_${amount}_${Math.random().toString(36).substring(2, 7)}`,
      date,
      description: rawDesc.trim() || 'Transação sem descrição',
      amount,
      type,
      category: rawCat?.trim(),
      rawText: lines[i],
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
