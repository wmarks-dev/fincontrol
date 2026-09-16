import React, { createContext, useContext, ReactNode, useState, useEffect, useMemo, useCallback } from 'react';
import { useUser } from './UserContext';
import {
    Transaction,
    CreditCard,
    RecurringTransaction,
    SavingsTransaction,
    Loan,
    LoanPayment,
    Bill,
    BillPayment,
    BillMonthlyAmount,
    Budget,
    FinancialGoal,
    GoalContribution,
    Category,
    CardMonthlyClosing,
} from '../types';
import { CATEGORIES } from '../constants';
import { parseISODateAsUTC } from '../utils/dateUtils';
import { api, RestoreResponse } from '../services/api';

export interface DataContextType {
    // Read-only State
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
    allCategories: Category[];

    // Async CRUD Methods
    addTransaction: (transactions: Omit<Transaction, 'id'>[]) => Promise<void>;
    updateTransaction: (updatedTransaction: Transaction) => Promise<void>;
    deleteTransaction: (transactionId: string) => Promise<void>;
    moveTransactionToBill: (transactionId: string, targetDueDate: string | null) => Promise<void>;
    addRecurringTransaction: (recurringTxData: Omit<RecurringTransaction, 'id' | 'status'>) => Promise<void>;
    cancelRecurringTransaction: (recurringId: string) => Promise<void>;
    addCreditCard: (cardData: Omit<CreditCard, 'id'>) => Promise<void>;
    updateCreditCard: (cardData: CreditCard) => Promise<void>;
    deleteCreditCard: (cardId: string) => Promise<void>;
    setCardMonthlyClosing: (cardId: string, year: number, month: number, closingDate: string) => Promise<void>;
    removeCardMonthlyClosing: (id: string) => Promise<void>;
    handleAddSavingsTransaction: (data: Omit<SavingsTransaction, 'id' | 'date'> & { goalId?: string }) => Promise<void>;
    addLoan: (loanData: Omit<Loan, 'id' | 'paidAmount' | 'status'>) => Promise<void>;
    registerLoanPayment: (loanId: string, paymentAmount: number, paymentDate: string) => Promise<void>;
    addBill: (billData: Omit<Bill, 'id' | 'status'>) => Promise<void>;
    updateBill: (updatedBill: Bill) => Promise<void>;
    deleteBill: (billId: string) => Promise<void>;
    setBillMonthlyAmount: (billId: string, year: number, month: number, amount: number) => Promise<void>;
    removeBillMonthlyAmount: (billId: string, year: number, month: number) => Promise<void>;
    addBudget: (budgetData: Omit<Budget, 'id'>) => Promise<void>;
    addMultipleBudgets: (newBudgetsData: Omit<Budget, 'id'>[]) => Promise<void>;
    updateBudget: (updatedBudget: Budget) => Promise<void>;
    deleteBudget: (budgetId: string) => Promise<void>;
    addFinancialGoal: (goalData: Omit<FinancialGoal, 'id' | 'currentAmount' | 'status'> & { initialAmount?: number }) => Promise<void>;
    updateFinancialGoal: (updatedGoal: FinancialGoal) => Promise<void>;
    deleteFinancialGoal: (goalId: string) => Promise<void>;
    addCategory: (categoryData: Omit<Category, 'id'>) => Promise<void>;
    updateCategory: (updatedCategory: Category) => Promise<void>;
    deleteCategory: (categoryId: string) => Promise<void>;

    // Backup & Restore
    exportBackup: () => Promise<void>;
    downloadSqlite: () => Promise<void>;
    restoreBackup: (backup: any) => Promise<RestoreResponse>;
    refreshData: () => Promise<void>;

    pendingBillPayment: { billId: string; year: number; month: number } | null;
    setPendingBillPayment: React.Dispatch<React.SetStateAction<{ billId: string; year: number; month: number } | null>>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { currentUser } = useUser();
    const userId = currentUser?.uid;

    // Local states
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [recurringTransactions, setRecurringTransactions] = useState<RecurringTransaction[]>([]);
    const [savingsTransactions, setSavingsTransactions] = useState<SavingsTransaction[]>([]);
    const [loans, setLoans] = useState<Loan[]>([]);
    const [loanPayments, setLoanPayments] = useState<LoanPayment[]>([]);
    const [creditCards, setCreditCards] = useState<CreditCard[]>([]);
    const [cardMonthlyClosings, setCardMonthlyClosings] = useState<CardMonthlyClosing[]>([]);
    const [bills, setBills] = useState<Bill[]>([]);
    const [billPayments, setBillPayments] = useState<BillPayment[]>([]);
    const [billMonthlyAmounts, setBillMonthlyAmounts] = useState<BillMonthlyAmount[]>([]);
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [financialGoals, setFinancialGoals] = useState<FinancialGoal[]>([]);
    const [goalContributions, setGoalContributions] = useState<GoalContribution[]>([]);
    const [customCategories, setCustomCategories] = useState<Category[]>([]);

    const [pendingBillPayment, setPendingBillPayment] = useState<{ billId: string; year: number; month: number } | null>(null);

    const allCategories = useMemo(
        () => [...CATEGORIES, ...customCategories].sort((a, b) => a.name.localeCompare(b.name)),
        [customCategories]
    );

    const refreshData = useCallback(async () => {
        if (!userId) {
            setTransactions([]);
            setRecurringTransactions([]);
            setSavingsTransactions([]);
            setLoans([]);
            setLoanPayments([]);
            setCreditCards([]);
            setCardMonthlyClosings([]);
            setBills([]);
            setBillPayments([]);
            setBudgets([]);
            setFinancialGoals([]);
            setGoalContributions([]);
            setCustomCategories([]);
            return;
        }

        try {
            const data = await api.fetchData(userId);
            setTransactions(data.transactions);
            setRecurringTransactions(data.recurringTransactions);
            setSavingsTransactions(data.savingsTransactions);
            setLoans(data.loans);
            setLoanPayments(data.loanPayments);
            setCreditCards(data.creditCards);
            setCardMonthlyClosings(data.cardMonthlyClosings || []);
            setBills(data.bills);
            setBillPayments(data.billPayments);
            setBillMonthlyAmounts(data.billMonthlyAmounts || []);
            setBudgets(data.budgets);
            setFinancialGoals(data.financialGoals);
            setGoalContributions(data.goalContributions);
            setCustomCategories(data.customCategories);
        } catch (error) {
            console.error('Erro ao buscar dados do SQLite local:', error);
        }
    }, [userId]);

    // Initial load
    useEffect(() => {
        refreshData();
    }, [refreshData]);

    // Auto-generate recurring transactions
    useEffect(() => {
        if (!userId) return;

        const activeRecurrences = recurringTransactions.filter(rt => rt.status === 'active');
        if (activeRecurrences.length === 0) return;

        const processRecurrences = async () => {
            const today = new Date();
            const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
            const newTransactionsToCreate: Omit<Transaction, 'id'>[] = [];

            for (const recurrence of activeRecurrences) {
                const existingChildTransactions = transactions.filter(t => t.recurringId === recurrence.id);
                const existingMonths = new Set(existingChildTransactions.map(t => parseISODateAsUTC(t.date).toISOString().substring(0, 7)));

                const startDate = parseISODateAsUTC(recurrence.date);
                const dayOfMonth = startDate.getUTCDate();

                let cursorDate = new Date(Date.UTC(startDate.getUTCFullYear(), startDate.getUTCMonth(), 1));

                while (cursorDate <= todayUTC) {
                    const year = cursorDate.getUTCFullYear();
                    const month = cursorDate.getUTCMonth();
                    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;

                    const potentialDueDate = new Date(Date.UTC(year, month, dayOfMonth));

                    if (potentialDueDate <= todayUTC && !existingMonths.has(monthKey)) {
                        newTransactionsToCreate.push({
                            recurringId: recurrence.id,
                            description: recurrence.description,
                            amount: recurrence.amount,
                            date: potentialDueDate.toISOString().split('T')[0],
                            type: recurrence.type,
                            category: recurrence.category,
                            paymentMethod: recurrence.paymentMethod,
                            creditCardId: recurrence.creditCardId || null,
                        });
                    }
                    cursorDate.setUTCMonth(cursorDate.getUTCMonth() + 1);
                }
            }

            if (newTransactionsToCreate.length > 0) {
                await api.saveTransactions(userId, newTransactionsToCreate);
                await refreshData();
            }
        };

        processRecurrences().catch(console.error);
    }, [userId, recurringTransactions, transactions, refreshData]);

    // --- CRUD Handlers ---
    const addTransaction = async (newTransactionsData: Omit<Transaction, 'id'>[]) => {
        if (!userId) return;
        await api.saveTransactions(userId, newTransactionsData, pendingBillPayment);
        if (pendingBillPayment) {
            setPendingBillPayment(null);
        }
        await refreshData();
    };

    const updateTransaction = async (updatedTransaction: Transaction) => {
        if (!userId) return;
        await api.updateTransaction(userId, updatedTransaction);
        await refreshData();
    };

    const deleteTransaction = async (transactionId: string) => {
        if (!userId) return;
        await api.deleteTransaction(userId, transactionId);
        await refreshData();
    };

    const moveTransactionToBill = async (transactionId: string, targetDueDate: string | null) => {
        if (!userId) return;
        await api.setTransactionCustomDueDate(userId, transactionId, targetDueDate);
        setTransactions(prev => prev.map(t => t.id === transactionId ? { ...t, customDueDate: targetDueDate } : t));
    };

    const addRecurringTransaction = async (data: Omit<RecurringTransaction, 'id' | 'status'>) => {
        if (!userId) return;
        await api.addRecurringTransaction(userId, data);
        await refreshData();
    };

    const cancelRecurringTransaction = async (id: string) => {
        if (!userId) return;
        await api.cancelRecurringTransaction(userId, id);
        await refreshData();
    };

    const addCreditCard = async (data: Omit<CreditCard, 'id'>) => {
        if (!userId) return;
        await api.addCreditCard(userId, data);
        await refreshData();
    };

    const updateCreditCard = async (data: CreditCard) => {
        if (!userId) return;
        await api.updateCreditCard(userId, data);
        await refreshData();
    };

    const deleteCreditCard = async (id: string) => {
        if (!userId) return;
        await api.deleteCreditCard(userId, id);
        await refreshData();
    };

    const setCardMonthlyClosing = async (cardId: string, year: number, month: number, closingDate: string) => {
        if (!userId) return;
        await api.setCardMonthlyClosing(userId, { cardId, year, month, closingDate });
        await refreshData();
    };

    const removeCardMonthlyClosing = async (id: string) => {
        if (!userId) return;
        await api.removeCardMonthlyClosing(userId, id);
        await refreshData();
    };

    const handleAddSavingsTransaction = async (data: Omit<SavingsTransaction, 'id' | 'date'> & { goalId?: string }) => {
        if (!userId) return;
        await api.addSavingsTransaction(userId, data);
        await refreshData();
    };

    const addLoan = async (data: Omit<Loan, 'id' | 'paidAmount' | 'status'>) => {
        if (!userId) return;
        await api.addLoan(userId, data);
        await refreshData();
    };

    const registerLoanPayment = async (loanId: string, paymentAmount: number, paymentDate: string) => {
        if (!userId) return;
        await api.registerLoanPayment(userId, loanId, paymentAmount, paymentDate);
        await refreshData();
    };

    const addBill = async (data: Omit<Bill, 'id' | 'status'>) => {
        if (!userId) return;
        await api.addBill(userId, data);
        await refreshData();
    };

    const updateBill = async (data: Bill) => {
        if (!userId) return;
        await api.updateBill(userId, data);
        await refreshData();
    };

    const deleteBill = async (id: string) => {
        if (!userId) return;
        await api.deleteBill(userId, id);
        await refreshData();
    };

    const setBillMonthlyAmount = async (billId: string, year: number, month: number, amount: number) => {
        if (!userId) return;
        await api.saveBillMonthlyAmount(userId, { billId, year, month, amount });
        await refreshData();
    };

    const removeBillMonthlyAmount = async (billId: string, year: number, month: number) => {
        if (!userId) return;
        await api.deleteBillMonthlyAmount(userId, { billId, year, month });
        await refreshData();
    };

    const addBudget = async (data: Omit<Budget, 'id'>) => {
        if (!userId) return;
        await api.addBudgets(userId, [data]);
        await refreshData();
    };

    const addMultipleBudgets = async (data: Omit<Budget, 'id'>[]) => {
        if (!userId) return;
        await api.addBudgets(userId, data);
        await refreshData();
    };

    const updateBudget = async (data: Budget) => {
        if (!userId) return;
        await api.updateBudget(userId, data);
        await refreshData();
    };

    const deleteBudget = async (id: string) => {
        if (!userId) return;
        await api.deleteBudget(userId, id);
        await refreshData();
    };

    const addFinancialGoal = async (data: Omit<FinancialGoal, 'id' | 'currentAmount' | 'status'> & { initialAmount?: number }) => {
        if (!userId) return;
        await api.addFinancialGoal(userId, data);
        await refreshData();
    };

    const updateFinancialGoal = async (data: FinancialGoal) => {
        if (!userId) return;
        await api.updateFinancialGoal(userId, data);
        await refreshData();
    };

    const deleteFinancialGoal = async (goalId: string) => {
        if (!userId) return;
        await api.deleteFinancialGoal(userId, goalId);
        await refreshData();
    };

    const addCategory = async (data: Omit<Category, 'id'>) => {
        if (!userId) return;
        await api.addCategory(userId, data);
        await refreshData();
    };

    const updateCategory = async (data: Category) => {
        if (!userId) return;
        await api.updateCategory(userId, data);
        await refreshData();
    };

    const deleteCategory = async (id: string) => {
        if (!userId) return;
        await api.deleteCategory(userId, id);
        await refreshData();
    };

    const exportBackup = async () => {
        if (!userId) throw new Error('Usuário não autenticado');
        await api.downloadBackupJson(userId);
    };

    const downloadSqlite = async () => {
        if (!userId) throw new Error('Usuário não autenticado');
        await api.downloadSqliteDb(userId);
    };

    const restoreBackup = async (backup: any) => {
        if (!userId) throw new Error('Usuário não autenticado');
        const res = await api.restoreBackup(userId, backup);
        await refreshData();
        return res;
    };

    const value: DataContextType = {
        transactions,
        recurringTransactions,
        savingsTransactions,
        loans,
        loanPayments,
        creditCards,
        cardMonthlyClosings,
        bills,
        billPayments,
        billMonthlyAmounts,
        budgets,
        financialGoals,
        goalContributions,
        customCategories,
        allCategories,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        moveTransactionToBill,
        addRecurringTransaction,
        cancelRecurringTransaction,
        addCreditCard,
        updateCreditCard,
        deleteCreditCard,
        setCardMonthlyClosing,
        removeCardMonthlyClosing,
        handleAddSavingsTransaction,
        addLoan,
        registerLoanPayment,
        addBill,
        updateBill,
        deleteBill,
        setBillMonthlyAmount,
        removeBillMonthlyAmount,
        addBudget,
        addMultipleBudgets,
        updateBudget,
        deleteBudget,
        addFinancialGoal,
        updateFinancialGoal,
        deleteFinancialGoal,
        addCategory,
        updateCategory,
        deleteCategory,
        exportBackup,
        downloadSqlite,
        restoreBackup,
        refreshData,
        pendingBillPayment,
        setPendingBillPayment,
    };

    return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};

export const useData = (): DataContextType => {
    const context = useContext(DataContext);
    if (context === undefined) {
        throw new Error('useData must be used within a DataProvider');
    }
    return context;
};
