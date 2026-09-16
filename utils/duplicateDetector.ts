import { Transaction } from '../types';
import { ParsedImportItem } from './importParsers';

function normalizeDesc(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Checks if two descriptions share significant words.
 */
function isSimilarDescription(desc1: string, desc2: string): boolean {
  const norm1 = normalizeDesc(desc1);
  const norm2 = normalizeDesc(desc2);

  if (norm1 === norm2) return true;
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;

  const words1 = norm1.split(' ').filter((w) => w.length > 2);
  const words2 = new Set(norm2.split(' ').filter((w) => w.length > 2));

  let common = 0;
  for (const w of words1) {
    if (words2.has(w)) common++;
  }

  // If at least 2 significant words match or 1 long word matches (> 5 chars)
  if (common >= 2) return true;
  if (common === 1 && words1.some((w) => words2.has(w) && w.length >= 6)) return true;

  return false;
}

export interface DuplicateCheckResult {
  isPotentialDuplicate: boolean;
  duplicateReason?: string;
  matchedTransaction?: Transaction;
}

/**
 * Compares an imported item against existing user transactions in the SQLite database.
 */
export function checkDuplicate(
  item: ParsedImportItem,
  existingTransactions: Transaction[]
): DuplicateCheckResult {
  const itemDate = new Date(item.date).getTime();

  for (const tx of existingTransactions) {
    // 1. Amount must match
    if (Math.abs(Number(tx.amount) - Number(item.amount)) > 0.01) {
      continue;
    }

    // 2. Date check (exact match or +/- 2 days due to banking clearance delays)
    const txDate = new Date(tx.date).getTime();
    const dayDiff = Math.abs(itemDate - txDate) / (1000 * 60 * 60 * 24);

    if (dayDiff <= 2) {
      // 3. Description similarity or same type
      if (isSimilarDescription(item.description, tx.description)) {
        return {
          isPotentialDuplicate: true,
          duplicateReason: `Possível duplicata de "${tx.description}" em ${new Date(tx.date).toLocaleDateString(
            'pt-BR',
            { timeZone: 'UTC' }
          )}`,
          matchedTransaction: tx,
        };
      }
    }
  }

  return {
    isPotentialDuplicate: false,
  };
}
