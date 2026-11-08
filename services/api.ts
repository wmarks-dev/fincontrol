import { auth } from '../firebase/config';
import {
  Transaction,
  RecurringTransaction,
  SavingsTransaction,
  Loan,
  LoanPayment,
  CreditCard,
  Bill,
  BillPayment,
  BillMonthlyAmount,
  Budget,
  FinancialGoal,
  GoalContribution,
  Category,
  CardMonthlyClosing,
  SalaryConfig,
  SalaryMonthlyRecord,
  TaxTableConfig,
  SalaryItemizedEntry,
  SalaryThirteenthConfig,
  SalaryVacationConfig,
} from '../types';

export interface AllUserData {
  transactions: Transaction[];
  recurringTransactions: RecurringTransaction[];
  savingsTransactions: SavingsTransaction[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  creditCards: CreditCard[];
  cardMonthlyClosings: CardMonthlyClosing[];
  bills: Bill[];
  billPayments: BillPayment[];
  billMonthlyAmounts: BillMonthlyAmount[];
  budgets: Budget[];
  financialGoals: FinancialGoal[];
  goalContributions: GoalContribution[];
  customCategories: Category[];
  salaryConfig: SalaryConfig | null;
  salaryMonthlyRecords: SalaryMonthlyRecord[];
  salaryTaxTables: TaxTableConfig[];
  salaryItemizedEntries: SalaryItemizedEntry[];
  salaryThirteenthConfigs: SalaryThirteenthConfig[];
  salaryVacationConfigs: SalaryVacationConfig[];
}

async function request<T>(endpoint: string, userId: string, options: RequestInit = {}): Promise<T> {
  const user=auth.currentUser;
  if (!user || user.uid !== userId) throw new Error('Sessão inválida. Entre novamente.');
  const token=await user.getIdToken();
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(options.headers || {}),
  };

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorMsg = `Erro na requisição: ${response.status} ${response.statusText}`;
    try {
      const errData = await response.json();
      if (errData.error) errorMsg = errData.error;
    } catch {
      // ignore
    }
    throw new Error(errorMsg);
  }

  return response.json();
}

export const api = {
  fetchData: (userId: string) => request<AllUserData>('/api/data', userId),

  // Transactions
  saveTransactions: (
    userId: string,
    transactions: Omit<Transaction, 'id'>[],
    pendingBillPayment?: { billId: string; year: number; month: number } | null
  ) =>
    request<{ success: boolean }>('/api/transactions', userId, {
      method: 'POST',
      body: JSON.stringify({ transactions, pendingBillPayment }),
    }),

  updateTransaction: (userId: string, transaction: Transaction) =>
    request<{ success: boolean }>(`/api/transactions/${transaction.id}`, userId, {
      method: 'PUT',
      body: JSON.stringify(transaction),
    }),

  deleteTransaction: (userId: string, id: string) =>
    request<{ success: boolean }>(`/api/transactions/${id}`, userId, {
      method: 'DELETE',
    }),

  setTransactionCustomDueDate: (userId: string, transactionId: string, customDueDate: string | null) =>
    request<{ success: boolean }>(`/api/transactions/${transactionId}/custom-due-date`, userId, {
      method: 'PATCH',
      body: JSON.stringify({ customDueDate }),
    }),

  // Recurring
  addRecurringTransaction: (userId: string, data: Omit<RecurringTransaction, 'id' | 'status'>) =>
    request<{ success: boolean; id: string }>('/api/recurring', userId, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  cancelRecurringTransaction: (userId: string, id: string) =>
    request<{ success: boolean }>(`/api/recurring/${id}/cancel`, userId, {
      method: 'PUT',
    }),

  // Credit Cards
  addCreditCard: (userId: string, data: Omit<CreditCard, 'id'>) =>
    request<{ success: boolean; id: string }>('/api/cards', userId, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCreditCard: (userId: string, card: CreditCard) =>
    request<{ success: boolean }>(`/api/cards/${card.id}`, userId, {
      method: 'PUT',
      body: JSON.stringify(card),
    }),

  deleteCreditCard: (userId: string, id: string) =>
    request<{ success: boolean }>(`/api/cards/${id}`, userId, {
      method: 'DELETE',
    }),

  setCardMonthlyClosing: (
    userId: string,
    data: { cardId: string; year: number; month: number; closingDate: string; id?: string }
  ) =>
    request<{ success: boolean; id: string }>('/api/cards/monthly-closing', userId, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  removeCardMonthlyClosing: (userId: string, id: string) =>
    request<{ success: boolean }>(`/api/cards/monthly-closing/${id}`, userId, {
      method: 'DELETE',
    }),

  // Savings
  addSavingsTransaction: (
    userId: string,
    data: Omit<SavingsTransaction, 'id' | 'date'> & { goalId?: string }
  ) =>
    request<{ success: boolean; id: string }>('/api/savings', userId, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Loans
  addLoan: (
    userId: string,
    data: Omit<Loan, 'id' | 'paidAmount' | 'status'> & { createTransaction?: boolean }
  ) =>
    request<{ success: boolean; id: string }>('/api/loans', userId, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteLoan: (userId: string, loanId: string) =>
    request<{ success: boolean }>(`/api/loans/${loanId}`, userId, {
      method: 'DELETE',
    }),

  registerLoanPayment: (
    userId: string,
    loanId: string,
    paymentAmount: number,
    paymentDate: string
  ) =>
    request<{ success: boolean; id: string }>(`/api/loans/${loanId}/payments`, userId, {
      method: 'POST',
      body: JSON.stringify({ paymentAmount, paymentDate }),
    }),

  // Bills
  addBill: (userId: string, data: Omit<Bill, 'id' | 'status'>) =>
    request<{ success: boolean; id: string }>('/api/bills', userId, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateBill: (userId: string, bill: Bill) =>
    request<{ success: boolean }>(`/api/bills/${bill.id}`, userId, {
      method: 'PUT',
      body: JSON.stringify(bill),
    }),

  deleteBill: (userId: string, id: string) =>
    request<{ success: boolean }>(`/api/bills/${id}`, userId, {
      method: 'DELETE',
    }),

  saveBillMonthlyAmount: (
    userId: string,
    data: { billId: string; year: number; month: number; amount: number }
  ) =>
    request<{ success: boolean; id: string }>('/api/bill-monthly-amounts', userId, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteBillMonthlyAmount: (
    userId: string,
    data: { billId: string; year: number; month: number }
  ) =>
    request<{ success: boolean }>('/api/bill-monthly-amounts', userId, {
      method: 'DELETE',
      body: JSON.stringify(data),
    }),

  // Budgets
  addBudgets: (userId: string, budgets: Omit<Budget, 'id'>[]) =>
    request<{ success: boolean }>('/api/budgets', userId, {
      method: 'POST',
      body: JSON.stringify(budgets),
    }),

  updateBudget: (userId: string, budget: Budget) =>
    request<{ success: boolean }>(`/api/budgets/${budget.id}`, userId, {
      method: 'PUT',
      body: JSON.stringify(budget),
    }),

  deleteBudget: (userId: string, id: string) =>
    request<{ success: boolean }>(`/api/budgets/${id}`, userId, {
      method: 'DELETE',
    }),

  // Goals
  addFinancialGoal: (
    userId: string,
    data: Omit<FinancialGoal, 'id' | 'currentAmount' | 'status'> & { initialAmount?: number }
  ) =>
    request<{ success: boolean; id: string }>('/api/goals', userId, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateFinancialGoal: (userId: string, goal: FinancialGoal) =>
    request<{ success: boolean }>(`/api/goals/${goal.id}`, userId, {
      method: 'PUT',
      body: JSON.stringify(goal),
    }),

  deleteFinancialGoal: (userId: string, id: string) =>
    request<{ success: boolean }>(`/api/goals/${id}`, userId, {
      method: 'DELETE',
    }),

  // Custom Categories
  addCategory: (userId: string, category: Omit<Category, 'id'>) =>
    request<{ success: boolean; id: string }>('/api/categories', userId, {
      method: 'POST',
      body: JSON.stringify(category),
    }),

  updateCategory: (userId: string, category: Category) =>
    request<{ success: boolean }>(`/api/categories/${category.id}`, userId, {
      method: 'PUT',
      body: JSON.stringify(category),
    }),

  deleteCategory: (userId: string, id: string) =>
    request<{ success: boolean }>(`/api/categories/${id}`, userId, {
      method: 'DELETE',
    }),

  // Backup & Restore
  exportBackupData: (userId: string) => request<BackupPayload>('/api/backup', userId),

  downloadBackupJson: async (userId: string) => {
    const data = await request<BackupPayload>('/api/backup', userId);
    const dateStr = new Date().toISOString().slice(0, 10);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fincontrol-backup-${dateStr}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return data;
  },

  downloadSqliteDb: async (userId: string) => {
    const user=auth.currentUser;
    if (!user || user.uid !== userId) throw new Error('Sessão inválida. Entre novamente.');
    const token=await user.getIdToken();
    const response = await fetch('/api/backup/sqlite', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      throw new Error(`Falha ao baixar banco SQLite: ${response.statusText}`);
    }
    const blob = await response.blob();
    const dateStr = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fincontrol-database-${dateStr}.sqlite`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  // Salary Management
  updateSalaryConfig: (userId: string, config: Partial<SalaryConfig>) =>
    request<{ success: boolean; config: SalaryConfig }>('/api/salary/config', userId, {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  saveSalaryMonthlyRecord: (userId: string, record: Partial<SalaryMonthlyRecord> & { year: number; month: number }) =>
    request<{ success: boolean; record: SalaryMonthlyRecord }>('/api/salary/record', userId, {
      method: 'POST',
      body: JSON.stringify(record),
    }),

  saveTaxTable: (userId: string, tableConfig: Partial<TaxTableConfig> & { year: number }) =>
    request<{ success: boolean; taxTable: TaxTableConfig }>('/api/salary/tax-table', userId, {
      method: 'POST',
      body: JSON.stringify(tableConfig),
    }),

  resetTaxTable: (userId: string, year: number) =>
    request<{ success: boolean; year: number }>(`/api/salary/tax-table/${year}`, userId, {
      method: 'DELETE',
    }),

  saveSalaryItem: (
    userId: string,
    item: Partial<SalaryItemizedEntry> & {
      year: number;
      month: number;
      type: 'earning' | 'deduction';
      name: string;
      amount: number;
    }
  ) =>
    request<{ success: boolean; item: SalaryItemizedEntry }>('/api/salary/item', userId, {
      method: 'POST',
      body: JSON.stringify(item),
    }),

  deleteSalaryItem: (userId: string, id: string) =>
    request<{ success: boolean; id: string }>(`/api/salary/item/${id}`, userId, {
      method: 'DELETE',
    }),

  saveThirteenthConfig: (userId: string, config: Partial<SalaryThirteenthConfig> & { year: number }) =>
    request<{ success: boolean; config: SalaryThirteenthConfig }>('/api/salary/thirteenth', userId, {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  saveVacationConfig: (userId: string, config: Partial<SalaryVacationConfig> & { year: number }) =>
    request<{ success: boolean; config: SalaryVacationConfig }>('/api/salary/vacation', userId, {
      method: 'POST',
      body: JSON.stringify(config),
    }),

  deleteVacationConfig: (userId: string, id: string) =>
    request<{ success: boolean; id: string }>(`/api/salary/vacation/${id}`, userId, {
      method: 'DELETE',
    }),

  restoreBackup: (userId: string, backup: any) =>
    request<RestoreResponse>('/api/restore', userId, {
      method: 'POST',
      body: JSON.stringify({ backup }),
    }),

  resetAllData: (userId: string) =>
    request<{ success: boolean; message: string }>('/api/reset-data', userId, {
      method: 'POST',
    }),
};

export interface BackupPayload {
  app: string;
  version: string;
  exportedAt: string;
  userId: string;
  data: {
    transactions: any[];
    recurringTransactions: any[];
    creditCards: any[];
    cardMonthlyClosings?: any[];
    savingsTransactions: any[];
    loans: any[];
    loanPayments: any[];
    bills: any[];
    billPayments: any[];
    billMonthlyAmounts: any[];
    budgets: any[];
    financialGoals: any[];
    goalContributions: any[];
    customCategories: any[];
    salaryConfig?: any;
    salaryMonthlyRecords?: any[];
    salaryTaxTables?: any[];
    salaryItemizedEntries?: any[];
    salaryThirteenthConfigs?: any[];
    salaryVacationConfigs?: any[];
  };
  summary: {
    totalTransactions: number;
    totalCreditCards: number;
    totalCardClosings?: number;
    totalBills: number;
    totalBudgets: number;
    totalGoals: number;
    totalSavings: number;
    totalLoans: number;
  };
}

export interface RestoreResponse {
  success: boolean;
  stats: {
    transactions: number;
    creditCards: number;
    cardMonthlyClosings?: number;
    bills: number;
    budgets: number;
    financialGoals: number;
    savingsTransactions: number;
    loans: number;
    customCategories: number;
  };
}
