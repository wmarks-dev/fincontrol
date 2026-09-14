import React, { useMemo, useState } from 'react';
import { Transaction, CreditCard, TransactionType, SavingsTransaction, SavingsTransactionType, PaymentMethod, Bill, BillPayment, Budget, FinancialGoal, Category } from '../types';
import { getBillInfoForTransaction, getCurrentOpenBillInfo, parseISODateAsUTC, getMostRecentlyClosedBillInfo } from '../utils/dateUtils';
import { useUser } from '../contexts/UserContext';

interface DashboardProps {
  transactions: Transaction[];
  creditCards: CreditCard[];
  savingsTransactions: SavingsTransaction[];
  bills: Bill[];
  billPayments: BillPayment[];
  budgets: Budget[];
  financialGoals: FinancialGoal[];
  allCategories: Category[];
  onPayBill: (bill: Bill, nextDueDate: Date) => void;
  onBudgetCategoryClick: (categoryId: string) => void;
  onMonthSummaryClick: (year: number, month: number) => void;
}

const Card: React.FC<{title: string, children: React.ReactNode, className?: string, icon?: string, headerAction?: React.ReactNode}> = ({ title, children, className, icon, headerAction }) => (
    <div className={`glass-card p-6 rounded-2xl border border-white/[0.08] shadow-xl backdrop-blur-xl ${className || ''}`}>
        <div className="flex justify-between items-center mb-5">
            <div className="flex items-center gap-2.5">
                {icon && <i className={`fa-solid ${icon} text-slate-400 text-sm`}></i>}
                <h2 className="text-base font-bold text-slate-100 tracking-tight">{title}</h2>
            </div>
            {headerAction}
        </div>
        {children}
    </div>
);

interface MetricCardProps {
  title: string;
  subtitle?: string;
  amount: number;
  icon: string;
  colorScheme: 'blue' | 'emerald' | 'purple';
  showValues: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ title, subtitle, amount, icon, colorScheme, showValues }) => {
  const schemeStyles = {
    blue: {
      glow: 'from-blue-600/20 via-blue-500/5 to-transparent',
      border: 'hover:border-blue-500/40',
      badge: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
      text: amount >= 0 ? 'text-blue-400' : 'text-rose-400',
    },
    emerald: {
      glow: 'from-emerald-600/20 via-emerald-500/5 to-transparent',
      border: 'hover:border-emerald-500/40',
      badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
      text: amount >= 0 ? 'text-emerald-400' : 'text-rose-400',
    },
    purple: {
      glow: 'from-purple-600/20 via-purple-500/5 to-transparent',
      border: 'hover:border-purple-500/40',
      badge: 'bg-purple-500/15 text-purple-400 border-purple-500/25',
      text: 'text-purple-400',
    },
  }[colorScheme];

  return (
    <div className={`relative overflow-hidden glass-card p-6 rounded-2xl border border-white/[0.08] transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/40 ${schemeStyles.border}`}>
      <div className={`absolute -top-12 -right-12 w-36 h-36 bg-gradient-to-br ${schemeStyles.glow} rounded-full blur-2xl pointer-events-none`}></div>

      <div className="flex justify-between items-start mb-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</span>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        <div className={`w-11 h-11 rounded-2xl flex items-center justify-center border shadow-sm ${schemeStyles.badge}`}>
          <i className={`fa-solid ${icon} text-lg`}></i>
        </div>
      </div>

      <div className="mt-2">
        <p className={`text-3xl sm:text-4xl font-extrabold tracking-tight tabular-nums ${schemeStyles.text}`}>
          {showValues ? amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'R$ ••••••'}
        </p>
      </div>
    </div>
  );
};

const Dashboard: React.FC<DashboardProps> = ({ transactions, creditCards, savingsTransactions, bills, billPayments, onPayBill, budgets, financialGoals, allCategories, onBudgetCategoryClick, onMonthSummaryClick }) => {
  const [showFullHistory, setShowFullHistory] = useState(false);
  const [showValues, setShowValues] = useState(true);
  const { currentUser } = useUser();

  const formatCurrency = (value: number) => {
    if (!showValues) return 'R$ ••••••';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };
  
  const { 
    netWorth, 
    accountBalance, 
    savingsBalance,
    monthlySummary, 
    hasPastMonths, 
    currentMonthSummary 
  } = useMemo(() => {
    const cardsById = new Map(creditCards.map(c => [c.id, c]));
    const localToday = new Date();
    const endOfTodayUTC = new Date(Date.UTC(localToday.getFullYear(), localToday.getMonth(), localToday.getDate(), 23, 59, 59, 999));
    
    const effectiveTransactions = transactions.map(t => {
        let effectiveDate: Date;
        const transactionDateAsUTC = parseISODateAsUTC(t.date);

        if (t.type === TransactionType.EXPENSE && t.paymentMethod === PaymentMethod.CREDIT_CARD && t.creditCardId) {
            const card = cardsById.get(t.creditCardId);
            if (card && transactionDateAsUTC && !isNaN(transactionDateAsUTC.getTime())) {
                const billInfo = getBillInfoForTransaction(card, transactionDateAsUTC);
                effectiveDate = billInfo.dueDate;
            } else {
                effectiveDate = transactionDateAsUTC;
            }
        } else {
            effectiveDate = transactionDateAsUTC;
        }
        return { ...t, effectiveDate };
    }).filter(t => t.category !== 'transfer');

    const transactionsForBalance = effectiveTransactions.filter(t => t.effectiveDate && !isNaN(t.effectiveDate.getTime()) && t.effectiveDate <= endOfTodayUTC);

    const totalIncomeUpToToday = transactionsForBalance
        .filter(t => t.type === TransactionType.INCOME)
        .reduce((acc, t) => acc + t.amount, 0);

    const totalExpenseUpToToday = transactionsForBalance
        .filter(t => t.type === TransactionType.EXPENSE)
        .reduce((acc, t) => acc + t.amount, 0);

    const calculatedNetWorth = totalIncomeUpToToday - totalExpenseUpToToday;

    const savingsTransactionsUpToToday = savingsTransactions.filter(st => {
        const transactionDate = parseISODateAsUTC(st.date);
        return transactionDate && !isNaN(transactionDate.getTime()) && transactionDate <= endOfTodayUTC;
    });

    const calculatedSavingsBalance = savingsTransactionsUpToToday.reduce((acc, st) => {
        return st.type === SavingsTransactionType.DEPOSIT ? acc + st.amount : acc - st.amount;
    }, 0);
    
    const calculatedAccountBalance = calculatedNetWorth - calculatedSavingsBalance;

    const dataByMonth: { [key: string]: { income: number; expense: number; year: number; month: number } } = {};

    effectiveTransactions.forEach(t => {
        if (!t.effectiveDate || isNaN(t.effectiveDate.getTime())) return;

        const year = t.effectiveDate.getUTCFullYear();
        const month = t.effectiveDate.getUTCMonth();
        const key = `${year}-${month}`;

        if (!dataByMonth[key]) {
            dataByMonth[key] = { income: 0, expense: 0, year, month };
        }

        if (t.type === TransactionType.INCOME) {
            dataByMonth[key].income += t.amount;
        } else {
            dataByMonth[key].expense += t.amount;
        }
    });
    
    const allMonths = Object.values(dataByMonth).sort((a, b) => b.year - a.year || b.month - a.month);
    
    const now = new Date();
    const currentUTCMonth = now.getUTCMonth();
    const currentUTCYear = now.getUTCFullYear();

    const currentMonthData = allMonths.find(
      (m) => m.year === currentUTCYear && m.month === currentUTCMonth
    ) || { income: 0, expense: 0 };
    
    const pastMonthsExist = allMonths.some(item => 
      item.year < currentUTCYear || (item.year === currentUTCYear && item.month < currentUTCMonth)
    );

    let visibleMonths;
    if (showFullHistory) {
      visibleMonths = allMonths;
    } else {
      const currentAndFutureMonths = allMonths.filter(item => {
        return item.year > currentUTCYear || (item.year === currentUTCYear && item.month >= currentUTCMonth);
      });
      visibleMonths = currentAndFutureMonths.reverse();
    }

    return {
        netWorth: calculatedNetWorth,
        accountBalance: calculatedAccountBalance,
        savingsBalance: calculatedSavingsBalance,
        monthlySummary: visibleMonths,
        hasPastMonths: pastMonthsExist,
        currentMonthSummary: currentMonthData
    };

  }, [transactions, creditCards, savingsTransactions, showFullHistory]);

  const upcomingCreditCardBills = useMemo(() => {
    const now = new Date();
    const todayUTC = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));

    return creditCards.map(card => {
        const recentlyClosedBill = getMostRecentlyClosedBillInfo(card, todayUTC);
        
        let billToShow;
        if (recentlyClosedBill.dueDate < todayUTC) {
            billToShow = getCurrentOpenBillInfo(card, todayUTC);
        } else {
            billToShow = recentlyClosedBill;
        }

        const billTransactions = transactions.filter(t => 
            t.creditCardId === card.id &&
            t.type === TransactionType.EXPENSE &&
            parseISODateAsUTC(t.date) >= billToShow.startDate &&
            parseISODateAsUTC(t.date) <= billToShow.endDate
        );
        const total = billTransactions.reduce((acc, t) => acc + t.amount, 0);

        return {
            cardName: card.name,
            dueDate: billToShow.dueDate,
            total,
        }
    }).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [creditCards, transactions]);

  const upcomingBillsToPay = useMemo(() => {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setUTCDate(today.getUTCDate() + 30);

    return bills
      .filter(b => b.status === 'active')
      .map(bill => {
        const currentYear = today.getUTCFullYear();
        const currentMonth = today.getUTCMonth();

        let nextDueDate = new Date(Date.UTC(currentYear, currentMonth, bill.dueDay));
        if (nextDueDate < today) {
          nextDueDate.setUTCMonth(nextDueDate.getUTCMonth() + 1);
        }
        
        const isPaid = billPayments.some(p => 
            p.billId === bill.id &&
            p.year === nextDueDate.getUTCFullYear() &&
            p.month === nextDueDate.getUTCMonth()
        );

        return { ...bill, nextDueDate, isPaid };
      })
      .filter(bill => bill.nextDueDate <= thirtyDaysFromNow)
      .sort((a,b) => a.nextDueDate.getTime() - b.nextDueDate.getTime());
  }, [bills, billPayments]);
  
  const budgetSummary = useMemo(() => {
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth();
    
    const cardsById = new Map(creditCards.map(c => [c.id, c]));

    const activeBudgets = budgets.filter(b => b.year === currentYear && b.month === currentMonth);

    if (activeBudgets.length === 0) {
        return null;
    }
    
    const categorySpending: { [key: string]: number } = {};
    
    transactions.forEach(t => {
        if (t.type !== TransactionType.EXPENSE || t.category === 'transfer') return;

        let effectiveDate: Date;
        const transactionDateAsUTC = parseISODateAsUTC(t.date);

        if (t.paymentMethod === PaymentMethod.CREDIT_CARD && t.creditCardId) {
            const card = cardsById.get(t.creditCardId);
            if (card) {
                effectiveDate = getBillInfoForTransaction(card, transactionDateAsUTC).dueDate;
            } else {
                effectiveDate = transactionDateAsUTC;
            }
        } else {
            effectiveDate = transactionDateAsUTC;
        }

        if (effectiveDate.getUTCFullYear() === currentYear && effectiveDate.getUTCMonth() === currentMonth) {
            categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
        }
    });

    const budgetDetails = activeBudgets.map(budget => {
        const spent = categorySpending[budget.categoryId] || 0;
        return {
            category: allCategories.find(c => c.id === budget.categoryId),
            budgetAmount: budget.amount,
            spent,
            progress: budget.amount > 0 ? Math.min((spent / budget.amount) * 100, 100) : 0,
        }
    }).sort((a, b) => b.progress - a.progress);

    const totalBudgeted = budgetDetails.reduce((acc, item) => acc + item.budgetAmount, 0);
    const totalSpent = budgetDetails.reduce((acc, item) => acc + item.spent, 0);

    return {
        details: budgetDetails,
        totalBudgeted,
        totalSpent,
        overallProgress: totalBudgeted > 0 ? Math.min((totalSpent / totalBudgeted) * 100, 100) : 0,
    }

  }, [budgets, transactions, creditCards, allCategories]);

  const goalsSummary = useMemo(() => {
      const activeGoals = financialGoals.filter(g => g.status === 'active');
      if (activeGoals.length === 0) return null;
      
      return activeGoals
        .map(goal => ({
          ...goal,
          progress: goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0
        }))
        .sort((a, b) => b.progress - a.progress)
        .slice(0, 3);
  }, [financialGoals]);


  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Olá, {currentUser?.displayName}! 👋
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Visão consolidada da sua saúde financeira hoje</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowValues(!showValues)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 border border-white/[0.08] hover:bg-slate-700/80 text-slate-300 hover:text-white transition-all text-xs font-semibold shadow-sm"
            title={showValues ? "Ocultar valores monetários" : "Mostrar valores monetários"}
          >
            <i className={`fa-solid ${showValues ? 'fa-eye' : 'fa-eye-slash'} text-sm text-slate-400`}></i>
            <span>{showValues ? 'Ocultar Valores' : 'Exibir Valores'}</span>
          </button>
        </div>
      </div>
      
      {/* Main KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <MetricCard
          title="Patrimônio Total"
          subtitle="Ativos totais acumulados"
          amount={netWorth}
          icon="fa-wallet"
          colorScheme="blue"
          showValues={showValues}
        />
        <MetricCard
          title="Saldo em Conta"
          subtitle="Disponível para movimentação"
          amount={accountBalance}
          icon="fa-building-columns"
          colorScheme="emerald"
          showValues={showValues}
        />
        <MetricCard
          title="Poupança & Reservas"
          subtitle="Metas e investimentos"
          amount={savingsBalance}
          icon="fa-piggy-bank"
          colorScheme="purple"
          showValues={showValues}
        />
      </div>
      
      {/* Middle Section: Budget & Goals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {budgetSummary && (
            <Card title="Orçamento do Mês" icon="fa-bullseye">
                 <div className="space-y-5">
                    <div className="bg-slate-900/40 p-4 rounded-xl border border-white/[0.05]">
                        <div className="flex justify-between items-center text-sm font-semibold mb-2">
                            <span className="text-slate-300">Total Comprometido</span>
                            <span className="tabular-nums text-white font-bold">{formatCurrency(budgetSummary.totalSpent)} <span className="text-slate-500 font-normal">/ {formatCurrency(budgetSummary.totalBudgeted)}</span></span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-3 overflow-hidden p-0.5 border border-white/[0.05]">
                            <div
                              className="bg-gradient-to-r from-blue-500 to-indigo-500 h-2 rounded-full transition-all duration-500"
                              style={{ width: `${budgetSummary.overallProgress}%` }}
                            ></div>
                        </div>
                        <div className="flex justify-between items-center text-xs text-slate-400 mt-2 font-medium">
                          <span>{budgetSummary.overallProgress.toFixed(0)}% utilizado</span>
                          <span>Restante: {formatCurrency(Math.max(0, budgetSummary.totalBudgeted - budgetSummary.totalSpent))}</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {budgetSummary.details.slice(0, 4).map((item, index) => {
                            const remaining = item.budgetAmount - item.spent;
                            let progressBarGrad = 'from-blue-500 to-indigo-500';
                            if (item.progress > 90) progressBarGrad = 'from-rose-500 to-red-600';
                            else if (item.progress > 75) progressBarGrad = 'from-amber-500 to-yellow-500';

                            return (
                                <div 
                                    key={index} 
                                    className="bg-slate-800/50 hover:bg-slate-800 p-3.5 rounded-xl border border-white/[0.05] hover:border-blue-500/30 cursor-pointer transition-all duration-200 hover:-translate-y-0.5"
                                    onClick={() => item.category && onBudgetCategoryClick(item.category.id)}
                                    role="button"
                                    aria-label={`Ver transações da categoria ${item.category?.name}`}
                                >
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                                            {item.category && <i className={`${item.category.icon} text-slate-400 text-xs`}></i>} {item.category?.name}
                                        </span>
                                        <span className={`text-xs font-bold tabular-nums ${remaining < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                                            {item.progress.toFixed(0)}%
                                        </span>
                                    </div>
                                    <div className="w-full bg-slate-700/60 rounded-full h-1.5 overflow-hidden mb-1.5">
                                        <div className={`bg-gradient-to-r ${progressBarGrad} h-1.5 rounded-full transition-all duration-500`} style={{ width: `${item.progress}%`}}></div>
                                    </div>
                                    <div className="flex justify-between text-[11px] text-slate-400 tabular-nums">
                                        <span>{formatCurrency(item.spent)}</span>
                                        <span className="text-slate-500">de {formatCurrency(item.budgetAmount)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                 </div>
            </Card>
        )}

        {goalsSummary && (
            <Card title="Progresso das Metas" icon="fa-flag-checkered">
                <div className="space-y-3.5">
                    {goalsSummary.map(goal => (
                        <div key={goal.id} className="bg-slate-800/50 p-3.5 rounded-xl border border-white/[0.05] hover:border-emerald-500/30 transition-colors">
                            <div className="flex justify-between items-center mb-2">
                                <span className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                                    <span className="w-7 h-7 rounded-lg bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">
                                      <i className="fa-solid fa-trophy"></i>
                                    </span>
                                    {goal.name}
                                </span>
                                <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 tabular-nums">
                                    {goal.progress.toFixed(0)}%
                                </span>
                            </div>
                            <div className="w-full bg-slate-700/60 rounded-full h-2 overflow-hidden mb-1.5">
                                <div className="bg-gradient-to-r from-emerald-500 to-teal-400 h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(goal.progress, 100)}%` }}></div>
                            </div>
                            <div className="flex justify-between text-xs text-slate-400 tabular-nums">
                                <span className="text-slate-300 font-medium">{formatCurrency(goal.currentAmount)}</span>
                                <span className="text-slate-500">Meta: {formatCurrency(goal.targetAmount)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        )}
      </div>
      
      {/* Bottom Row: Monthly Table, Cards and Bills */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card title="Resumo Mensal" icon="fa-chart-simple" className="lg:col-span-1">
            <div className="flex flex-col h-96">
                <div className="flex-grow overflow-y-auto pr-1 custom-scrollbar">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="border-b border-slate-700/60 text-xs font-semibold uppercase tracking-wider text-slate-400">
                          <tr>
                            <th className="pb-3 px-2">Mês/Ano</th>
                            <th className="pb-3 px-2 text-right">Receitas</th>
                            <th className="pb-3 px-2 text-right">Despesas</th>
                            <th className="pb-3 px-2 text-right">Saldo</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800 text-xs sm:text-sm">
                          {monthlySummary.map(item => {
                            const balance = item.income - item.expense;
                            const monthName = new Date(Date.UTC(item.year, item.month)).toLocaleString('pt-BR', { month: 'long', timeZone: 'UTC' });
                            const displayName = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} ${item.year}`;
                            return (
                              <tr 
                                key={`${item.year}-${item.month}`} 
                                className="hover:bg-slate-800/60 cursor-pointer transition-colors"
                                onClick={() => onMonthSummaryClick(item.year, item.month)}
                                role="button"
                                aria-label={`Ver transações de ${displayName}`}
                               >
                                <td className="py-3 px-2 font-medium text-slate-200">{displayName}</td>
                                <td className="py-3 px-2 text-right text-emerald-400 font-medium tabular-nums">{formatCurrency(item.income)}</td>
                                <td className="py-3 px-2 text-right text-rose-400 font-medium tabular-nums">{formatCurrency(item.expense)}</td>
                                <td className={`py-3 px-2 text-right font-bold tabular-nums ${balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                  {formatCurrency(balance)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {monthlySummary.length === 0 && (
                         <p className="text-center text-slate-500 py-12 text-sm">
                           {showFullHistory ? "Nenhum dado para exibir no resumo mensal." : "Nenhum dado para este mês ou futuros."}
                         </p>
                      )}
                    </div>
                </div>
                {hasPastMonths && (
                  <div className="flex-shrink-0 pt-4 border-t border-slate-800/80">
                    <button
                      onClick={() => setShowFullHistory(!showFullHistory)}
                      className="w-full text-center py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl transition-colors text-xs font-semibold border border-white/[0.05]"
                    >
                      <i className={`fa-solid ${showFullHistory ? 'fa-eye-slash' : 'fa-history'} mr-2`}></i>
                      {showFullHistory ? 'Ocultar Histórico' : 'Ver Histórico Completo'}
                    </button>
                  </div>
                )}
            </div>
          </Card>

          <Card title="Próximas Faturas" icon="fa-credit-card" className="lg:col-span-1">
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                  {upcomingCreditCardBills.filter(b => b.total > 0).map(bill => (
                      <div key={bill.cardName} className="flex justify-between items-center bg-slate-800/50 p-3.5 rounded-xl border border-white/[0.05] hover:border-amber-500/30 transition-colors">
                          <div className="flex items-center gap-3">
                              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 text-amber-400 flex items-center justify-center text-sm">
                                <i className="fa-solid fa-credit-card"></i>
                              </div>
                              <div>
                                  <p className="font-semibold text-sm text-slate-200">{bill.cardName}</p>
                                  <p className="text-xs text-slate-400">Vence: {bill.dueDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                              </div>
                          </div>
                          <p className="font-extrabold text-amber-400 tabular-nums text-sm sm:text-base">{formatCurrency(bill.total)}</p>
                      </div>
                  ))}
                  {upcomingCreditCardBills.filter(b => b.total > 0).length === 0 && (
                      <div className="flex flex-col items-center justify-center h-64 text-center">
                         <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-600 mb-2">
                           <i className="fa-solid fa-credit-card text-xl"></i>
                         </div>
                         <p className="text-slate-400 text-sm font-medium">Nenhuma fatura em aberto.</p>
                         <p className="text-slate-500 text-xs mt-0.5">Seus cartões estão em dia!</p>
                      </div>
                  )}
              </div>
          </Card>

          <Card title="Contas a Vencer" icon="fa-file-invoice-dollar" className="lg:col-span-1">
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                  {upcomingBillsToPay.map(bill => (
                      <div key={bill.id} className="flex justify-between items-center bg-slate-800/50 p-3.5 rounded-xl border border-white/[0.05] hover:border-blue-500/30 transition-colors">
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/25 text-blue-400 flex items-center justify-center text-sm flex-shrink-0">
                                <i className="fa-solid fa-receipt"></i>
                              </div>
                              <div className="min-w-0">
                                  <p className="font-semibold text-sm text-slate-200 truncate">{bill.name}</p>
                                  <p className="text-xs text-slate-400">Vence: {bill.nextDueDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                              </div>
                          </div>
                          <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                             <p className="font-extrabold text-slate-200 tabular-nums text-sm">{formatCurrency(bill.estimatedAmount)}</p>
                             {bill.isPaid ? (
                                <span className="px-2.5 py-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold">
                                    Pago
                                </span>
                             ) : (
                                <button onClick={() => onPayBill(bill, bill.nextDueDate)} className="px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-lg transition-all text-xs font-semibold shadow-md shadow-blue-600/20">
                                    Pagar
                                </button>
                             )}
                          </div>
                      </div>
                  ))}
                  {upcomingBillsToPay.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-64 text-center">
                         <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-600 mb-2">
                           <i className="fa-solid fa-circle-check text-xl"></i>
                         </div>
                         <p className="text-slate-400 text-sm font-medium">Tudo em dia!</p>
                         <p className="text-slate-500 text-xs mt-0.5">Nenhuma conta a vencer nos próximos 30 dias.</p>
                      </div>
                  )}
              </div>
          </Card>
      </div>
    </div>
  );
};

export default Dashboard;