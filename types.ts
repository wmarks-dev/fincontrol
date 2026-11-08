export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
}

export enum PaymentMethod {
  CASH = 'Dinheiro',
  DEBIT = 'Débito',
  CREDIT_CARD = 'Cartão de Crédito',
  PIX = 'Pix',
}

export type Period = 'current_month' | 'previous_month' | '30d' | '90d' | 'year' | '365d' | 'custom';

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
  tags?: string[];
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
  tags?: string[];
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
    paymentMethod?: 'cash' | 'credit_card' | string;
    transactionId?: string | null;
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

export interface TaxBracketINSS {
  limit: number;
  rate: number;
}

export interface TaxBracketIRRF {
  limit: number;
  rate: number;
  deduction: number;
}

export interface TaxTableConfig {
  id?: string;
  userId?: string;
  year: number;
  inssCeiling: number;
  inssBrackets: TaxBracketINSS[];
  irrfBrackets: TaxBracketIRRF[];
  dependentDeduction: number;
  simplifiedDeduction: number;
}

export interface SalaryItemizedEntry {
  id: string;
  userId?: string;
  year: number;
  month: number; // 0-11 for specific month, -1 for contract default/recurring
  type: 'earning' | 'deduction';
  name: string;
  amount: number;
  isRecurring?: boolean;
  notes?: string;
  createdAt?: string;
}

export interface SalaryConfig {
  id?: string;
  grossSalary: number;
  dependents: number;
  otherDeductions: number;
  advancePercentage: number; // e.g. 40
  advanceDay: number; // e.g. 20
  paydayDay: number; // e.g. 5
  useCustomAdvance?: boolean;
  customAdvanceAmount?: number;
  isActive?: boolean;
  useCustomTaxes?: boolean;
  customInssAmount?: number;
  customIrrfAmount?: number;
  taxYear?: number; // e.g. 2026
}

export interface SalaryMonthlyRecord {
  id: string;
  year: number;
  month: number; // 0-11
  projectedAdvance: number;
  projectedPayday: number;
  realAdvance?: number | null;
  realPayday?: number | null;
  advanceDate?: string | null;
  paydayDate?: string | null;
  notes?: string;
  advanceTransactionId?: string | null;
  paydayTransactionId?: string | null;
}

export interface SalaryTaxBracket {
  bracket: string;
  rate: number;
  baseAmount: number;
  deduction: number;
}

export interface SalaryCalculationResult {
  grossSalary: number;
  baseSalary?: number;
  additionalEarnings?: number;
  itemizedDeductions?: number;
  effectiveGross?: number;
  inssDiscount: number;
  inssEffectiveRate: number;
  inssBrackets: SalaryTaxBracket[];
  irrfDiscount: number;
  irrfEffectiveRate: number;
  irrfBase: number;
  irrfUsedSimplified: boolean;
  totalDeductions: number;
  netSalary: number;
  advanceAmount: number;
  paydayAmount: number;
  advanceDay: number;
  paydayDay: number;
}

export interface SalaryThirteenthConfig {
  id?: string;
  userId?: string;
  year: number;
  monthsWorked: number; // 1-12, default 12
  firstInstallmentMonth: number; // 0-11, default 10 (November)
  firstInstallmentPercentage: number; // default 50
  firstInstallmentPayDay: number; // default 30
  secondInstallmentPayDay: number; // default 20
  customFirstInstallmentAmount?: number | null;
  customSecondInstallmentAmount?: number | null;
  firstInstallmentReal?: number | null;
  secondInstallmentReal?: number | null;
  firstInstallmentDate?: string | null;
  secondInstallmentDate?: string | null;
  firstInstallmentTransactionId?: string | null;
  secondInstallmentTransactionId?: string | null;
  notes?: string;
}

export interface SalaryThirteenthResult {
  year: number;
  baseSalary: number;
  effectiveGross?: number;
  monthsWorked: number;
  firstInstallmentMonth?: number;
  firstInstallmentPercentage?: number;
  totalGross: number;
  firstInstallmentGross: number;
  firstInstallmentNet: number;
  secondInstallmentGross: number;
  inssDiscount: number;
  inssEffectiveRate: number;
  irrfDiscount: number;
  irrfEffectiveRate: number;
  irrfBase: number;
  irrfUsedSimplified: boolean;
  totalDeductions: number;
  secondInstallmentNet: number;
  totalNet: number;
}

export interface SalaryVacationConfig {
  id?: string;
  userId?: string;
  year: number;
  vacationDays: number; // e.g. 30, 20, 15, 10
  sellDays: number; // 0 to 10 (abono pecuniário)
  startDate: string; // YYYY-MM-DD
  advanceThirteenth?: boolean;
  customAmount?: number | null;
  realAmount?: number | null;
  paymentDate?: string | null;
  transactionId?: string | null;
  notes?: string;
}

export interface SalaryVacationResult {
  year: number;
  baseSalary: number;
  vacationDays: number;
  sellDays: number;
  dailyRate: number;
  vacationGross: number;
  vacationPay: number;
  constitutionalBonus: number;
  oneThirdPay: number;
  taxableBase: number;
  inssDiscount: number;
  inssEffectiveRate: number;
  irrfDiscount: number;
  irrfEffectiveRate: number;
  irrfBase: number;
  irrfUsedSimplified: boolean;
  vacationNet: number;
  sellGross: number;
  abonoPay: number;
  sellBonus: number;
  abonoOneThirdPay: number;
  sellTotalTaxFree: number;
  thirteenthAdvance: number;
  totalNetToReceive: number;
  totalVacationNet: number;
  payDateEstimated: string;
  paymentLimitDate: string;
  remainingWorkedDaysInMonth: number;
  remainingWorkedDaysSalary: number;
  residualSalaryInMonth: number;
}