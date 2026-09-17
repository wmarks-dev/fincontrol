import React, { useMemo, useState } from 'react';
import { Transaction, CreditCard, TransactionType, SavingsTransaction, SavingsTransactionType, PaymentMethod, Bill, BillPayment, BillMonthlyAmount, Budget, FinancialGoal, Category } from '../types';
import { getBillInfoForTransaction, getCurrentOpenBillInfo, parseISODateAsUTC, getMostRecentlyClosedBillInfo } from '../utils/dateUtils';
import { useUser } from '../contexts/UserContext';

interface DashboardProps {
  transactions: Transaction[];
  creditCards: CreditCard[];
  savingsTransactions: SavingsTransaction[];
  bills: Bill[];
  billPayments: BillPayment[];
  billMonthlyAmounts?: BillMonthlyAmount[];
  budgets: Budget[];
  financialGoals: FinancialGoal[];
  allCategories: Category[];
  onPayBill: (bill: Bill, nextDueDate: Date, customAmount?: number) => void;
  onBudgetCategoryClick: (categoryId: string) => void;
  onMonthSummaryClick: (year: number, month: number) => void;
  onOpenCards?: () => void;
  onOpenBills?: () => void;
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

const Dashboard: React.FC<DashboardProps> = ({
  transactions,
  creditCards,
  savingsTransactions,
  bills,
  billPayments,
  billMonthlyAmounts = [],
  onPayBill,
  budgets,
  financialGoals,
  allCategories,
  onBudgetCategoryClick,
  onMonthSummaryClick,
  onOpenCards,
  onOpenBills,
}) => {
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
        let isClosed = false;
        if (recentlyClosedBill.dueDate < todayUTC) {
            billToShow = getCurrentOpenBillInfo(card, todayUTC);
            isClosed = false;
        } else {
            billToShow = recentlyClosedBill;
            isClosed = true;
        }

        const billTransactions = transactions.filter(t => 
            t.creditCardId === card.id &&
            t.type === TransactionType.EXPENSE &&
            parseISODateAsUTC(t.date) >= billToShow.startDate &&
            parseISODateAsUTC(t.date) <= billToShow.endDate
        );
        const total = billTransactions.reduce((acc, t) => acc + t.amount, 0);

        const diffTime = billToShow.dueDate.getTime() - todayUTC.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        return {
            cardId: card.id,
            cardName: card.name,
            cardColor: card.color,
            dueDate: billToShow.dueDate,
            diffDays,
            isClosed,
            total,
        };
    }).sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
  }, [creditCards, transactions]);

  const { allBillsToDisplay, overdueCount } = useMemo(() => {
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setUTCDate(today.getUTCDate() + 30);

    const currentYear = today.getUTCFullYear();
    const currentMonth = today.getUTCMonth();
    const currentEpoch = currentYear * 12 + currentMonth;

    const getBillStart = (bill: Bill): { year: number; month: number } => {
      if (bill.startYear !== undefined && bill.startMonth !== undefined) {
        return { year: bill.startYear, month: bill.startMonth };
      }
      if (bill.createdAt) {
        const d = new Date(bill.createdAt);
        if (!isNaN(d.getTime())) {
          return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
        }
      }
      const n = new Date();
      return { year: n.getUTCFullYear(), month: n.getUTCMonth() };
    };

    const items: Array<{
      id: string;
      bill: Bill;
      name: string;
      dueDate: Date;
      isPaid: boolean;
      status: 'overdue' | 'due_today' | 'due_soon' | 'upcoming';
      diffDays: number;
      amount: number;
      hasRealAmount: boolean;
    }> = [];

    const activeBills = bills.filter((b) => b.status === 'active');

    for (const bill of activeBills) {
      const start = getBillStart(bill);
      const startEpoch = start.year * 12 + start.month;

      // 1. Current Month check (only if bill already exists in current month)
      const isPaidCurrent = billPayments.some(
        (p) => p.billId === bill.id && p.year === currentYear && p.month === currentMonth
      );

      if (currentEpoch >= startEpoch) {
        const maxDaysCurrent = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate();
        const currentDueDate = new Date(
          Date.UTC(currentYear, currentMonth, Math.min(bill.dueDay, maxDaysCurrent))
        );

        const diffTimeCurrent = currentDueDate.getTime() - today.getTime();
        const diffDaysCurrent = Math.round(diffTimeCurrent / (1000 * 60 * 60 * 24));

        const monthlyOverrideCurrent = (billMonthlyAmounts || []).find(
          (m) => m.billId === bill.id && m.year === currentYear && m.month === currentMonth
        );
        const amountCurrent = monthlyOverrideCurrent ? monthlyOverrideCurrent.amount : bill.estimatedAmount;

        if (!isPaidCurrent) {
          if (diffDaysCurrent < 0) {
            // VENCIDA no mês atual!
            items.push({
              id: `${bill.id}_${currentYear}_${currentMonth}`,
              bill,
              name: bill.name,
              dueDate: currentDueDate,
              isPaid: false,
              status: 'overdue',
              diffDays: Math.abs(diffDaysCurrent),
              amount: amountCurrent,
              hasRealAmount: !!monthlyOverrideCurrent,
            });
          } else if (diffDaysCurrent === 0) {
            // VENCE HOJE!
            items.push({
              id: `${bill.id}_${currentYear}_${currentMonth}`,
              bill,
              name: bill.name,
              dueDate: currentDueDate,
              isPaid: false,
              status: 'due_today',
              diffDays: 0,
              amount: amountCurrent,
              hasRealAmount: !!monthlyOverrideCurrent,
            });
          } else if (diffDaysCurrent <= 30) {
            // A VENCER NOS PRÓXIMOS 30 DIAS!
            items.push({
              id: `${bill.id}_${currentYear}_${currentMonth}`,
              bill,
              name: bill.name,
              dueDate: currentDueDate,
              isPaid: false,
              status: diffDaysCurrent <= 3 ? 'due_soon' : 'upcoming',
              diffDays: diffDaysCurrent,
              amount: amountCurrent,
              hasRealAmount: !!monthlyOverrideCurrent,
            });
          }
        }
      }

      // Next month check (if already paid this month OR if bill starts next month)
      let nextYear = currentYear;
      let nextMonth = currentMonth + 1;
      if (nextMonth > 11) {
        nextMonth = 0;
        nextYear += 1;
      }
      const nextEpoch = nextYear * 12 + nextMonth;

      if ((isPaidCurrent || currentEpoch < startEpoch) && nextEpoch >= startEpoch) {
        const maxDaysNext = new Date(Date.UTC(nextYear, nextMonth + 1, 0)).getUTCDate();
        const nextDueDate = new Date(Date.UTC(nextYear, nextMonth, Math.min(bill.dueDay, maxDaysNext)));

        if (nextDueDate <= thirtyDaysFromNow) {
          const isPaidNext = billPayments.some(
            (p) => p.billId === bill.id && p.year === nextYear && p.month === nextMonth
          );
          const monthlyOverrideNext = (billMonthlyAmounts || []).find(
            (m) => m.billId === bill.id && m.year === nextYear && m.month === nextMonth
          );
          const amountNext = monthlyOverrideNext ? monthlyOverrideNext.amount : bill.estimatedAmount;

          items.push({
            id: `${bill.id}_${nextYear}_${nextMonth}`,
            bill,
            name: bill.name,
            dueDate: nextDueDate,
            isPaid: isPaidNext,
            status: 'upcoming',
            diffDays: Math.round((nextDueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
            amount: amountNext,
            hasRealAmount: !!monthlyOverrideNext,
          });
        }
      }

      // Verifica mês anterior se não foi pago - MAS SOMENTE SE A CONTA JÁ EXISTIA NO MÊS ANTERIOR!
      let prevYear = currentYear;
      let prevMonth = currentMonth - 1;
      if (prevMonth < 0) {
        prevMonth = 11;
        prevYear -= 1;
      }
      const prevEpoch = prevYear * 12 + prevMonth;

      if (prevEpoch >= startEpoch) {
        const isPaidPrev = billPayments.some(
          (p) => p.billId === bill.id && p.year === prevYear && p.month === prevMonth
        );
        if (!isPaidPrev) {
          const maxDaysPrev = new Date(Date.UTC(prevYear, prevMonth + 1, 0)).getUTCDate();
          const prevDueDate = new Date(Date.UTC(prevYear, prevMonth, Math.min(bill.dueDay, maxDaysPrev)));
          const prevDiffTime = today.getTime() - prevDueDate.getTime();
          const prevDiffDays = Math.max(1, Math.round(prevDiffTime / (1000 * 60 * 60 * 24)));
          const monthlyOverridePrev = (billMonthlyAmounts || []).find(
            (m) => m.billId === bill.id && m.year === prevYear && m.month === prevMonth
          );
          const amountPrev = monthlyOverridePrev ? monthlyOverridePrev.amount : bill.estimatedAmount;

          items.push({
            id: `${bill.id}_${prevYear}_${prevMonth}`,
            bill,
            name: bill.name,
            dueDate: prevDueDate,
            isPaid: false,
            status: 'overdue',
            diffDays: prevDiffDays,
            amount: amountPrev,
            hasRealAmount: !!monthlyOverridePrev,
          });
        }
      }
    }

    const overdueCount = items.filter((i) => i.status === 'overdue').length;

    const sorted = items.sort((a, b) => {
      const priority = { overdue: 0, due_today: 1, due_soon: 2, upcoming: 3 };
      if (priority[a.status] !== priority[b.status]) {
        return priority[a.status] - priority[b.status];
      }
      if (a.status === 'overdue') {
        return b.diffDays - a.diffDays;
      }
      return a.dueDate.getTime() - b.dueDate.getTime();
    });

    return { allBillsToDisplay: sorted, overdueCount };
  }, [bills, billPayments, billMonthlyAmounts]);
  
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
          {/* Card 1: Resumo Mensal */}
          <Card
            title="Resumo Mensal"
            icon="fa-chart-simple"
            className="lg:col-span-1"
            headerAction={
              <span className="text-[11px] font-semibold text-slate-400 bg-slate-800/80 px-2.5 py-0.5 rounded-full border border-white/5">
                {monthlySummary.length} meses
              </span>
            }
          >
            <div className="flex flex-col h-96">
                <div className="flex-grow overflow-y-auto pr-1 custom-scrollbar">
                    <table className="w-full text-left">
                      <thead className="border-b border-slate-700/60 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        <tr>
                          <th className="pb-2.5 pl-1 pr-1.5">Mês</th>
                          <th className="pb-2.5 px-1.5 text-right">Receitas</th>
                          <th className="pb-2.5 px-1.5 text-right">Despesas</th>
                          <th className="pb-2.5 pl-1.5 pr-1 text-right">Saldo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/80 text-xs sm:text-sm">
                        {monthlySummary.map(item => {
                          const balance = item.income - item.expense;
                          const monthDate = new Date(Date.UTC(item.year, item.month));
                          const monthLong = monthDate.toLocaleString('pt-BR', { month: 'long', timeZone: 'UTC' });
                          const displayName = `${monthLong.charAt(0).toUpperCase() + monthLong.slice(1)} ${item.year}`;
                          return (
                            <tr 
                              key={`${item.year}-${item.month}`} 
                              className="hover:bg-slate-800/80 cursor-pointer transition-colors group"
                              onClick={() => onMonthSummaryClick(item.year, item.month)}
                              role="button"
                              aria-label={`Ver transações de ${displayName}`}
                              title={`Clique para ver as transações de ${displayName}`}
                             >
                              <td className="py-2.5 pl-1 pr-1.5">
                                <div className="flex flex-col">
                                  <span className="font-bold text-slate-200 capitalize text-xs sm:text-sm group-hover:text-blue-400 transition-colors">
                                    {monthLong}
                                  </span>
                                  <span className="text-[10px] text-slate-500 font-medium leading-tight">
                                    {item.year}
                                  </span>
                                </div>
                              </td>
                              <td className="py-2.5 px-1.5 text-right text-emerald-400 font-medium tabular-nums whitespace-nowrap text-xs sm:text-sm">
                                {formatCurrency(item.income)}
                              </td>
                              <td className="py-2.5 px-1.5 text-right text-rose-400 font-medium tabular-nums whitespace-nowrap text-xs sm:text-sm">
                                {formatCurrency(item.expense)}
                              </td>
                              <td className={`py-2.5 pl-1.5 pr-1 text-right font-extrabold tabular-nums whitespace-nowrap text-xs sm:text-sm ${
                                balance >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}>
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
                {hasPastMonths && (
                  <div className="flex-shrink-0 pt-3 border-t border-slate-800/80">
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

          {/* Card 2: Próximas Faturas */}
          <Card
            title="Próximas Faturas"
            icon="fa-credit-card"
            className="lg:col-span-1"
            headerAction={
              onOpenCards ? (
                <button
                  onClick={onOpenCards}
                  className="text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors flex items-center gap-1"
                  title="Gerenciar todos os cartões de crédito"
                >
                  <span>Ver cartões</span>
                  <i className="fa-solid fa-chevron-right text-[10px]"></i>
                </button>
              ) : undefined
            }
          >
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                  {upcomingCreditCardBills.filter(b => b.total > 0).map(bill => (
                      <div
                        key={bill.cardName}
                        className={`p-3.5 rounded-xl border border-white/[0.05] bg-slate-800/50 hover:bg-slate-800/80 hover:border-amber-500/30 transition-all duration-200 ${
                          onOpenCards ? 'cursor-pointer group' : ''
                        }`}
                        onClick={onOpenCards}
                        title={onOpenCards ? "Clique para gerenciar cartões" : undefined}
                      >
                          <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/25 text-amber-400 flex items-center justify-center text-xs flex-shrink-0">
                                    <i className="fa-solid fa-credit-card"></i>
                                  </div>
                                  <p className="font-bold text-sm text-slate-100 truncate group-hover:text-amber-300 transition-colors" title={bill.cardName}>
                                    {bill.cardName}
                                  </p>
                              </div>
                              <p className="font-extrabold text-amber-400 tabular-nums text-sm sm:text-base flex-shrink-0">
                                {formatCurrency(bill.total)}
                              </p>
                          </div>

                          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-white/[0.04] text-xs">
                            <span className="text-slate-400 flex items-center gap-1.5 truncate">
                              <i className="fa-regular fa-calendar text-[10px] text-slate-500 flex-shrink-0"></i>
                              <span>Vence: {bill.dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })}</span>
                            </span>

                            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-md flex-shrink-0 ${
                              bill.diffDays < 0
                                ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                                : bill.diffDays === 0
                                ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30 animate-pulse'
                                : bill.diffDays <= 5
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-slate-700/40 text-slate-400 border border-white/5'
                            }`}>
                              {bill.diffDays < 0
                                ? `Venceu há ${Math.abs(bill.diffDays)}d`
                                : bill.diffDays === 0
                                ? 'Vence Hoje!'
                                : `em ${bill.diffDays} dias`}
                            </span>
                          </div>
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

          {/* Card 3: Contas a Pagar */}
          <Card
            title="Contas a Pagar"
            icon="fa-file-invoice-dollar"
            className="lg:col-span-1"
            headerAction={
              <div className="flex items-center gap-2">
                {overdueCount > 0 && (
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/40 animate-pulse flex items-center gap-1.5 shadow-sm shadow-rose-900/30">
                    <i className="fa-solid fa-triangle-exclamation text-[10px]"></i>
                    <span>{overdueCount} vencida{overdueCount > 1 ? 's' : ''}</span>
                  </span>
                )}
                {onOpenBills && (
                  <button
                    onClick={onOpenBills}
                    className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1"
                    title="Gerenciar todas as contas a pagar"
                  >
                    <span>Gerenciar</span>
                    <i className="fa-solid fa-chevron-right text-[10px]"></i>
                  </button>
                )}
              </div>
            }
          >
              <div className="space-y-3 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                  {allBillsToDisplay.map((item) => (
                      <div
                        key={item.id}
                        className={`p-3.5 rounded-xl border transition-all duration-200 ${
                          item.status === 'overdue'
                            ? 'bg-rose-950/20 border-rose-500/30 hover:border-rose-500/50'
                            : item.status === 'due_today'
                            ? 'bg-amber-950/20 border-amber-500/30 hover:border-amber-500/50'
                            : 'bg-slate-800/50 border-white/[0.05] hover:border-blue-500/30'
                        }`}
                      >
                          {/* Row 1: Name + Icon (left) and Amount + Real Badge (right) */}
                          <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <div
                                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs flex-shrink-0 border ${
                                      item.status === 'overdue'
                                        ? 'bg-rose-500/20 border-rose-500/40 text-rose-400'
                                        : item.status === 'due_today'
                                        ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                        : 'bg-blue-500/15 border-blue-500/25 text-blue-400'
                                    }`}
                                  >
                                    <i className={`fa-solid ${
                                      item.status === 'overdue'
                                        ? 'fa-triangle-exclamation'
                                        : item.status === 'due_today'
                                        ? 'fa-bolt'
                                        : 'fa-receipt'
                                    }`}></i>
                                  </div>
                                  <p className="font-bold text-sm text-slate-100 truncate" title={item.name}>
                                    {item.name}
                                  </p>
                              </div>

                              <div className="text-right flex-shrink-0 flex items-center gap-1.5">
                                 <span className={`font-extrabold tabular-nums text-sm sm:text-base ${
                                   item.status === 'overdue' ? 'text-rose-400' : 'text-slate-100'
                                 }`}>
                                   {formatCurrency(item.amount)}
                                 </span>
                                 {item.hasRealAmount && (
                                   <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 font-bold border border-blue-500/30">
                                     Real
                                   </span>
                                 )}
                              </div>
                          </div>

                          {/* Row 2: Status / Due Date (left) and Pay Button (right) */}
                          <div className="flex items-center justify-between gap-2 mt-2 pt-2 border-t border-white/[0.04]">
                              <div className="min-w-0 flex-1">
                                  {item.status === 'overdue' ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20 truncate max-w-full">
                                      <i className="fa-solid fa-clock-rotate-left text-[10px] flex-shrink-0"></i>
                                      <span className="truncate">Venceu há {item.diffDays}d ({item.dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })})</span>
                                    </span>
                                  ) : item.status === 'due_today' ? (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded-md border border-amber-500/30">
                                      <i className="fa-solid fa-bolt text-[10px]"></i>
                                      <span>Vence Hoje!</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center gap-1 text-[11px] text-slate-400 truncate">
                                      <i className="fa-regular fa-calendar text-[10px] text-slate-500 flex-shrink-0"></i>
                                      <span>Venc: {item.dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })}</span>
                                      {item.status === 'due_soon' && (
                                        <span className="text-amber-400 font-medium ml-0.5">({item.diffDays}d)</span>
                                      )}
                                    </span>
                                  )}
                              </div>

                              <div className="flex-shrink-0">
                                 {item.isPaid ? (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-bold">
                                        <i className="fa-solid fa-check text-[10px]"></i>
                                        Pago
                                    </span>
                                 ) : (
                                    <button
                                      onClick={() => onPayBill(item.bill, item.dueDate, item.amount)}
                                      className={`px-3 py-1 rounded-lg transition-all duration-200 text-xs font-bold shadow-sm flex items-center gap-1.5 ${
                                        item.status === 'overdue'
                                          ? 'bg-rose-500 hover:bg-rose-400 text-white shadow-rose-600/30'
                                          : item.status === 'due_today'
                                          ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold shadow-amber-500/30'
                                          : 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20'
                                      }`}
                                    >
                                        <span>Pagar</span>
                                        <i className="fa-solid fa-arrow-right text-[10px]"></i>
                                    </button>
                                 )}
                              </div>
                          </div>
                      </div>
                  ))}
                  {allBillsToDisplay.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-64 text-center">
                         <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-600 mb-2">
                           <i className="fa-solid fa-circle-check text-xl"></i>
                         </div>
                         <p className="text-slate-400 text-sm font-medium">Tudo em dia!</p>
                         <p className="text-slate-500 text-xs mt-0.5">Nenhuma conta pendente ou vencida nos próximos 30 dias.</p>
                      </div>
                  )}
              </div>
          </Card>
      </div>
    </div>
  );
};

export default Dashboard;