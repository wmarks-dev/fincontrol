import { CreditCard, CardMonthlyClosing, Transaction } from '../types';

export interface BillInfo {
  startDate: Date;
  endDate: Date;
  dueDate: Date;
  closingDate: Date;
  isCustomClosing?: boolean;
}

/**
 * Returns the number of days in a given UTC month (0-indexed).
 */
export function getDaysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * Clamps a day of month to the valid range for that specific year and month.
 */
export function clampDay(year: number, month: number, day: number): number {
  return Math.max(1, Math.min(day, getDaysInMonth(year, month)));
}

/**
 * Parses a 'YYYY-MM-DD' string or a Firestore Timestamp into a Date object at UTC midnight.
 * This is crucial to avoid timezone bugs.
 */
export const parseISODateAsUTC = (dateInput: string | { toDate: () => Date }): Date => {
  if (!dateInput) {
    return new Date(NaN);
  }

  // Handle Firestore Timestamp object
  if (typeof dateInput === 'object' && dateInput !== null && typeof (dateInput as any).toDate === 'function') {
    return (dateInput as any).toDate();
  }

  // Handle 'YYYY-MM-DD' string
  if (typeof dateInput === 'string') {
    const parts = dateInput.split('-');
    if (parts.length !== 3) {
      return new Date(NaN);
    }
    const [year, month, day] = parts.map(Number);
    return new Date(Date.UTC(year, month - 1, day));
  }

  return new Date(NaN);
};

/**
 * Returns the effective closing date for a card in a specific month (0-11) and year,
 * respecting any custom monthly closing override.
 */
export function getEffectiveClosingDate(
  card: CreditCard,
  year: number,
  month: number, // 0-11
  monthlyClosings?: CardMonthlyClosing[]
): Date {
  if (monthlyClosings && monthlyClosings.length > 0) {
    const custom = monthlyClosings.find(
      (c) => c.cardId === card.id && c.year === year && c.month === month
    );
    if (custom && custom.closingDate) {
      return parseISODateAsUTC(custom.closingDate);
    }
  }
  const day = clampDay(year, month, card.closingDay);
  return new Date(Date.UTC(year, month, day));
}

/**
 * Helper function to calculate start, end, and due dates from a given closing date.
 */
export function calculateBillDatesFromClosingDate(
  card: CreditCard,
  billClosingDate: Date,
  monthlyClosings?: CardMonthlyClosing[]
): BillInfo {
  const closingYear = billClosingDate.getUTCFullYear();
  const closingMonth = billClosingDate.getUTCMonth();

  // Check if there is an exact custom closing for this card, year, month
  let effectiveClosingDate = billClosingDate;
  let isCustomClosing = false;
  if (monthlyClosings && monthlyClosings.length > 0) {
    const custom = monthlyClosings.find(
      (c) => c.cardId === card.id && c.year === closingYear && c.month === closingMonth
    );
    if (custom && custom.closingDate) {
      effectiveClosingDate = parseISODateAsUTC(custom.closingDate);
      isCustomClosing = true;
    }
  }

  const billEndDate = new Date(effectiveClosingDate.getTime());
  billEndDate.setUTCHours(23, 59, 59, 999);

  // Previous month cycle closing
  const prevCycleDate = new Date(Date.UTC(closingYear, closingMonth - 1, 1));
  const prevYear = prevCycleDate.getUTCFullYear();
  const prevMonth = prevCycleDate.getUTCMonth();
  const prevClosing = getEffectiveClosingDate(card, prevYear, prevMonth, monthlyClosings);

  // Start date is the day after the previous month's closing date
  const billStartDate = new Date(Date.UTC(
    prevClosing.getUTCFullYear(),
    prevClosing.getUTCMonth(),
    prevClosing.getUTCDate() + 1
  ));

  let dueYear = closingYear;
  let dueMonth = closingMonth;
  if (card.dueDay > card.closingDay) {
    // Due date is in the same month as the closing date
  } else {
    // Due date is in the month after the closing date
    if (closingMonth === 11) {
      dueYear = closingYear + 1;
      dueMonth = 0;
    } else {
      dueMonth = closingMonth + 1;
    }
  }
  const clampedDueDay = clampDay(dueYear, dueMonth, card.dueDay);
  const billDueDate = new Date(Date.UTC(dueYear, dueMonth, clampedDueDay));

  return {
    startDate: billStartDate,
    endDate: billEndDate,
    dueDate: billDueDate,
    closingDate: effectiveClosingDate,
    isCustomClosing,
  };
}

/**
 * Calculates the bill information (start, end, due dates) for a bill that a specific transaction belongs to.
 */
export function getBillInfoForTransaction(
  card: CreditCard,
  transactionDate: Date,
  monthlyClosings?: CardMonthlyClosing[]
): BillInfo {
  const year = transactionDate.getUTCFullYear();
  const month = transactionDate.getUTCMonth();

  // Check this month's effective closing date
  const thisMonthClosing = getEffectiveClosingDate(card, year, month, monthlyClosings);
  const thisMonthClosingEnd = new Date(thisMonthClosing.getTime());
  thisMonthClosingEnd.setUTCHours(23, 59, 59, 999);

  let billClosingDate: Date;
  if (transactionDate > thisMonthClosingEnd) {
    // Transaction is after this month's closing, belongs to the bill closing next month.
    const nextDate = new Date(Date.UTC(year, month + 1, 1));
    billClosingDate = getEffectiveClosingDate(card, nextDate.getUTCFullYear(), nextDate.getUTCMonth(), monthlyClosings);
  } else {
    // Transaction is on or before this month's closing, belongs to the bill closing this month.
    billClosingDate = thisMonthClosing;
  }

  return calculateBillDatesFromClosingDate(card, billClosingDate, monthlyClosings);
}

/**
 * Calculates bill information for the bill that is currently open and accumulating new charges.
 */
export function getCurrentOpenBillInfo(
  card: CreditCard,
  today: Date,
  monthlyClosings?: CardMonthlyClosing[]
): BillInfo {
  return getBillInfoForTransaction(card, today, monthlyClosings);
}

/**
 * Calculates bill information for a bill that is "due", meaning the one most recently closed.
 */
export function getMostRecentlyClosedBillInfo(
  card: CreditCard,
  today: Date,
  monthlyClosings?: CardMonthlyClosing[]
): BillInfo {
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();

  const thisMonthClosing = getEffectiveClosingDate(card, year, month, monthlyClosings);
  const thisMonthClosingEnd = new Date(thisMonthClosing.getTime());
  thisMonthClosingEnd.setUTCHours(23, 59, 59, 999);

  let billClosingDate: Date;
  if (today > thisMonthClosingEnd) {
    // Today is after this month's closing, so that's the one that just closed.
    billClosingDate = thisMonthClosing;
  } else {
    // Today is on or before this month's closing, so the bill that closed last month is the one we want.
    const prevDate = new Date(Date.UTC(year, month - 1, 1));
    billClosingDate = getEffectiveClosingDate(card, prevDate.getUTCFullYear(), prevDate.getUTCMonth(), monthlyClosings);
  }
  return calculateBillDatesFromClosingDate(card, billClosingDate, monthlyClosings);
}

/**
 * Calculates bill information for a specific historical bill, identified by the month of its due date.
 */
export function getBillInfoForDueDate(
  card: CreditCard,
  targetDueDate: Date,
  monthlyClosings?: CardMonthlyClosing[]
): BillInfo {
  const year = targetDueDate.getUTCFullYear();
  const month = targetDueDate.getUTCMonth();

  let closingYear = year;
  let closingMonth = month;
  if (card.dueDay <= card.closingDay) {
    // Due date is in the month after closing. So the bill closed in the previous month.
    if (month === 0) {
      closingYear = year - 1;
      closingMonth = 11;
    } else {
      closingMonth = month - 1;
    }
  }

  const billClosingDate = getEffectiveClosingDate(card, closingYear, closingMonth, monthlyClosings);
  return calculateBillDatesFromClosingDate(card, billClosingDate, monthlyClosings);
}

/**
 * Determines whether a transaction belongs to a given bill cycle.
 * Respects customDueDate if specified on the transaction.
 */
export function isTransactionInBill(
  t: Transaction,
  card: CreditCard,
  billInfo: BillInfo
): boolean {
  if (t.creditCardId !== card.id) return false;

  const targetDueDateISO = billInfo.dueDate.toISOString().split('T')[0];

  // 1. If transaction has a customDueDate, compare strictly against target bill's due date
  if (t.customDueDate) {
    return t.customDueDate === targetDueDateISO;
  }

  // 2. Otherwise, check if transaction date falls within the bill cycle [startDate, endDate]
  const tDate = parseISODateAsUTC(t.date);
  if (isNaN(tDate.getTime())) return false;

  return tDate >= billInfo.startDate && tDate <= billInfo.endDate;
}

/**
 * Returns the effective due date for a transaction, either from customDueDate or computed.
 */
export function getEffectiveDueDate(
  t: Transaction,
  card: CreditCard,
  monthlyClosings?: CardMonthlyClosing[]
): Date {
  if (t.customDueDate) {
    return parseISODateAsUTC(t.customDueDate);
  }
  const tDate = parseISODateAsUTC(t.date);
  return getBillInfoForTransaction(card, tDate, monthlyClosings).dueDate;
}

/**
 * Returns the due date ISO ('YYYY-MM-DD') for the previous or next bill cycle relative to a given due date.
 */
export function getAdjacentBillDueDate(
  card: CreditCard,
  currentDueDate: Date,
  direction: 'next' | 'prev',
  monthlyClosings?: CardMonthlyClosing[]
): string {
  const monthOffset = direction === 'next' ? 1 : -1;
  const targetDate = new Date(Date.UTC(
    currentDueDate.getUTCFullYear(),
    currentDueDate.getUTCMonth() + monthOffset,
    1
  ));
  const info = getBillInfoForDueDate(card, targetDate, monthlyClosings);
  return info.dueDate.toISOString().split('T')[0];
}
