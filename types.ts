export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum PaymentMethod {
  CASH = 'Dinheiro',
  DEBIT = 'Débito',
  CREDIT_CARD = 'Cartão de Crédito',
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  isCustom?: boolean;
}

export interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string; // ISO 8601 format
  type: TransactionType;
  category: string;
  paymentMethod: PaymentMethod;
  creditCardId?: string | null;
  installmentId?: string;
  recurringId?: string;
  isPaid?: boolean; // For credit card bills
  customDueDate?: string | null; // Overrides the calculated bill due date (YYYY-MM-DD)
}

export interface CreditCard {
  id: string;
  name: string;
  closingDay: number; // Day of the month
  dueDay: number; // Day of the month
  limit: number;
  theme?: 'black' | 'purple' | 'emerald' | 'blue' | 'gold' | 'rose' | string;
}

export interface CardMonthlyClosing {
  id: string;
  cardId: string;
  year: number;
  month: number; // 0-11
  closingDate: string; // ISO format 'YYYY-MM-DD'
}

export interface RecurringTransaction {
  id: string;
  description: string;
  amount: number;
  // The date property here is used to determine the day of the month for recurrence.
  date: string;
  type: TransactionType;
  category: string;
  paymentMethod: PaymentMethod;
  creditCardId?: string | null;
  status: 'active' | 'canceled';
}

export enum SavingsTransactionType {
  DEPOSIT = 'DEPOSIT',
  WITHDRAWAL = 'WITHDRAWAL',
}

export interface SavingsTransaction {
  id: string;
  type: SavingsTransactionType;
  amount: number;
  date: string; // ISO 8601 format
  description: string;
}

export enum LoanType {
    GIVEN = 'GIVEN', // I lent money to someone
    RECEIVED = 'RECEIVED', // I borrowed money from someone
}

export interface Loan {
    id: string;
    type: LoanType;
    person: string;
    initialAmount: number;
    paidAmount: number;
    date: string; // ISO 8601 format
    description: string;
    status: 'active' | 'paid';
}

export interface LoanPayment {
    id: string;
    loanId: string;
    amount: number;
    date: string; // ISO 8601 format
}

export interface Bill {
  id: string;
  name: string;
  dueDay: number; // Day of the month
  estimatedAmount: number;
  category: string;
  status: 'active' | 'inactive';
  startYear?: number;
  startMonth?: number; // 0-11
  createdAt?: string;
}

export interface BillPayment {
  id: string;
  billId: string;
  year: number;
  month: number; // 0-11
  amount?: number;
}

export interface BillMonthlyAmount {
  id: string;
  billId: string;
  year: number;
  month: number; // 0-11
  amount: number;
}

export interface Budget {
  id: string;
  categoryId: string;
  amount: number;
  month: number; // 0-11
  year: number;
}

export interface FinancialGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string; // ISO 8601 format, optional
  status: 'active' | 'completed';
}

export interface GoalContribution {
  id: string;
  goalId: string;
  savingsTransactionId: string;
  amount: number;
  date: string; // ISO 8601 format
}