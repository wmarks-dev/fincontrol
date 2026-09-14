import {
  Transaction,
  RecurringTransaction,
  SavingsTransaction,
  Loan,
  LoanPayment,
  CreditCard,
  Bill,
  BillPayment,
  Budget,
  FinancialGoal,
  GoalContribution,
  Category,
} from '../types';

export interface AllUserData {
  transactions: Transaction[];
  recurringTransactions: RecurringTransaction[];
  savingsTransactions: SavingsTransaction[];
  loans: Loan[];
  loanPayments: LoanPayment[];
  creditCards: CreditCard[];
  bills: Bill[];
  billPayments: BillPayment[];
  budgets: Budget[];
  financialGoals: FinancialGoal[];
  goalContributions: GoalContribution[];
  customCategories: Category[];
}

async function request<T>(endpoint: string, userId: string, options: RequestInit = {}): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    'x-user-id': userId,
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
  addLoan: (userId: string, data: Omit<Loan, 'id' | 'paidAmount' | 'status'>) =>
    request<{ success: boolean; id: string }>('/api/loans', userId, {
      method: 'POST',
      body: JSON.stringify(data),
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
};
