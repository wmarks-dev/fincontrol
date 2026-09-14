import { CreditCard } from '../types';

export interface BillInfo {
  startDate: Date;
  endDate: Date;
  dueDate: Date;
}

/**
 * Helper function to calculate start, end, and due dates from a given closing date.
 * This is the core logic that is now reused by more specific functions.
 */
function calculateBillDatesFromClosingDate(card: CreditCard, billClosingDate: Date): BillInfo {
    const billEndDate = new Date(billClosingDate.getTime());
    billEndDate.setUTCHours(23, 59, 59, 999);

    // Start date is the day after the previous month's closing day
    const billStartDate = new Date(Date.UTC(
        billClosingDate.getUTCFullYear(),
        billClosingDate.getUTCMonth() - 1,
        card.closingDay + 1
    ));

    let billDueDate: Date;
    const closingYear = billClosingDate.getUTCFullYear();
    const closingMonth = billClosingDate.getUTCMonth();

    if (card.dueDay > card.closingDay) {
        // Due date is in the same month as the closing date.
        billDueDate = new Date(Date.UTC(closingYear, closingMonth, card.dueDay));
    } else {
        // Due date is in the month after the closing date.
        billDueDate = new Date(Date.UTC(closingYear, closingMonth + 1, card.dueDay));
    }

    return { startDate: billStartDate, endDate: billEndDate, dueDate: billDueDate };
}

/**
 * Calculates the bill information (start, end, due dates) for a bill that a specific transaction belongs to.
 * Used by the Dashboard to correctly assign an expense to a month based on the bill's due date.
 */
export function getBillInfoForTransaction(card: CreditCard, transactionDate: Date): BillInfo {
    const year = transactionDate.getUTCFullYear();
    const month = transactionDate.getUTCMonth();
    const day = transactionDate.getUTCDate();

    let billClosingDate: Date;
    if (day > card.closingDay) {
        // Transaction is after this month's closing day, belongs to the bill closing next month.
        billClosingDate = new Date(Date.UTC(year, month + 1, card.closingDay));
    } else {
        // Transaction is on or before this month's closing day, belongs to the bill closing this month.
        billClosingDate = new Date(Date.UTC(year, month, card.closingDay));
    }
    
    return calculateBillDatesFromClosingDate(card, billClosingDate);
}

/**
 * Calculates bill information for the bill that is currently open and accumulating new charges.
 * Used by the Dashboard to show "Upcoming Bills".
 */
export function getCurrentOpenBillInfo(card: CreditCard, today: Date): BillInfo {
    // The logic is the same as finding the bill for a transaction on 'today's date.
    return getBillInfoForTransaction(card, today);
}


/**
 * Calculates bill information for a bill that is "due", meaning the one most recently closed.
 * Used by the CardsManagement view to show the "Current Bill".
 */
export function getMostRecentlyClosedBillInfo(card: CreditCard, today: Date): BillInfo {
    const year = today.getUTCFullYear();
    const month = today.getUTCMonth();
    const day = today.getUTCDate();
    
    let billClosingDate: Date;
    if (day > card.closingDay) {
        // Today is after this month's closing day, so that's the one that just closed.
        billClosingDate = new Date(Date.UTC(year, month, card.closingDay));
    } else {
        // Today is before this month's closing day, so the bill that closed last month is the one we want.
        billClosingDate = new Date(Date.UTC(year, month - 1, card.closingDay));
    }
    return calculateBillDatesFromClosingDate(card, billClosingDate);
}


/**
 * Calculates bill information for a specific historical bill, identified by the month of its due date.
 * Used by the BillHistoryModal.
 */
export function getBillInfoForDueDate(card: CreditCard, targetDueDate: Date): BillInfo {
    const year = targetDueDate.getUTCFullYear();
    const month = targetDueDate.getUTCMonth();

    let billClosingDate: Date;
    if (card.dueDay > card.closingDay) {
        // Due date is in the same month as closing. The bill closed this month.
        billClosingDate = new Date(Date.UTC(year, month, card.closingDay));
    } else {
        // Due date is in the month after closing. The bill closed last month.
        billClosingDate = new Date(Date.UTC(year, month - 1, card.closingDay));
    }

    return calculateBillDatesFromClosingDate(card, billClosingDate);
}


/**
 * Parses a 'YYYY-MM-DD' string or a Firestore Timestamp into a Date object at UTC midnight.
 * This is crucial to avoid timezone bugs and handle data from Firestore.
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
        // Month in JavaScript's Date is 0-indexed (0-11)
        return new Date(Date.UTC(year, month - 1, day));
    }
    
    // Return invalid date for any other input type
    return new Date(NaN);
};
