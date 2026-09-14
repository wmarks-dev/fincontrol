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

const Card: React.FC<{title: string, children: React.ReactNode, className?: string}> = ({ title, children, className }) => (
    <div className={`bg-gray-800 p-6 rounded-xl shadow-lg ${className}`}>
        <h2 className="text-lg font-semibold text-gray-300 mb-4">{title}</h2>
        {children}
    </div>
);

const Dashboard: React.FC<DashboardProps> = ({ transactions, creditCards, savingsTransactions, bills, billPayments, onPayBill, budgets, financialGoals, allCategories, onBudgetCategoryClick, onMonthSummaryClick }) => {
  const [showFullHistory, setShowFullHistory] = useState(false);
  const { currentUser } = useUser();

  const formatCurrency = (value: number) => {
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
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-white">Olá, {currentUser?.displayName}!</h1>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card title="Patrimônio Total" className="md:col-span-1">
            <p className={`text-4xl font-bold ${netWorth >= 0 ? 'text-blue-400' : 'text-red-400'}`}>
                {formatCurrency(netWorth)}
            </p>
        </Card>
        <Card title="Saldo em Conta" className="md:col-span-1">
             <p className={`text-3xl font-bold ${accountBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>{formatCurrency(accountBalance)}</p>
        </Card>
        <Card title="Saldo Poupança" className="md:col-span-1">
             <p className="text-3xl font-bold text-purple-400">{formatCurrency(savingsBalance)}</p>
        </Card>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {budgetSummary && (
            <Card title="Resumo do Orçamento do Mês">
                 <div className="space-y-4">
                    <div>
                        <div className="flex justify-between items-center text-gray-300 font-semibold">
                            <span>Total Gasto</span>
                            <span>{formatCurrency(budgetSummary.totalSpent)} / {formatCurrency(budgetSummary.totalBudgeted)}</span>
                        </div>
                        <div className="w-full bg-gray-600 rounded-full h-4 mt-1">
                            <div className="bg-blue-500 h-4 rounded-full text-center text-white text-xs font-bold flex items-center justify-center" style={{ width: `${budgetSummary.overallProgress}%` }}>
                               {budgetSummary.overallProgress > 20 && `${budgetSummary.overallProgress.toFixed(0)}%`}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {budgetSummary.details.slice(0, 4).map((item, index) => {
                            const remaining = item.budgetAmount - item.spent;
                            let progressBarColor = 'bg-blue-500';
                            if (item.progress > 90) progressBarColor = 'bg-red-500';
                            else if (item.progress > 75) progressBarColor = 'bg-yellow-500';

                            return (
                                <div 
                                    key={index} 
                                    className="bg-gray-700/50 p-3 rounded-lg hover:bg-gray-700 cursor-pointer transition-colors"
                                    onClick={() => item.category && onBudgetCategoryClick(item.category.id)}
                                    role="button"
                                    aria-label={`Ver transações da categoria ${item.category?.name}`}
                                >
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="font-semibold flex items-center gap-2">
                                            {item.category && <i className={item.category.icon}></i>} {item.category?.name}
                                        </span>
                                        <span className={`text-sm font-bold ${remaining < 0 ? 'text-red-400' : 'text-gray-300'}`}>
                                            {formatCurrency(item.spent)} / {formatCurrency(item.budgetAmount)}
                                        </span>
                                    </div>
                                    <div className="w-full bg-gray-600 rounded-full h-2">
                                        <div className={`${progressBarColor} h-2 rounded-full`} style={{ width: `${item.progress}%`}}></div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                 </div>
            </Card>
        )}

        {goalsSummary && (
            <Card title="Progresso das Metas">
                <div className="space-y-4">
                    {goalsSummary.map(goal => (
                        <div key={goal.id} className="bg-gray-700/50 p-3 rounded-lg">
                            <div className="flex justify-between items-center mb-1">
                                <span className="font-semibold flex items-center gap-2">
                                    <i className="fa-solid fa-flag-checkered text-blue-400"></i> {goal.name}
                                </span>
                                <span className="text-sm font-bold text-gray-300">
                                    {goal.progress.toFixed(1)}%
                                </span>
                            </div>
                            <div className="w-full bg-gray-600 rounded-full h-2.5">
                                <div className="bg-green-500 h-2.5 rounded-full" style={{ width: `${goal.progress}%` }}></div>
                            </div>
                            <div className="flex justify-between text-xs mt-1 text-gray-400">
                                <span>{formatCurrency(goal.currentAmount)}</span>
                                <span>{formatCurrency(goal.targetAmount)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </Card>
        )}
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card title="Resumo Mensal" className="lg:col-span-1">
            <div className="flex flex-col h-96">
                <div className="flex-grow overflow-y-auto pr-2 custom-scrollbar">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left">
                        <thead className="border-b border-gray-700 text-sm text-gray-400">
                          <tr>
                            <th className="p-3">Mês/Ano</th>
                            <th className="p-3 text-right">Receitas</th>
                            <th className="p-3 text-right">Despesas</th>
                            <th className="p-3 text-right">Saldo do Mês</th>
                          </tr>
                        </thead>
                        <tbody>
                          {monthlySummary.map(item => {
                            const balance = item.income - item.expense;
                            const monthName = new Date(Date.UTC(item.year, item.month)).toLocaleString('pt-BR', { month: 'long', timeZone: 'UTC' });
                            const displayName = `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${item.year}`;
                            return (
                              <tr 
                                key={`${item.year}-${item.month}`} 
                                className="border-b border-gray-700/50 hover:bg-gray-700/30 cursor-pointer"
                                onClick={() => onMonthSummaryClick(item.year, item.month)}
                                role="button"
                                aria-label={`Ver transações de ${displayName}`}
                               >
                                <td className="p-3 font-medium">{displayName}</td>
                                <td className="p-3 text-right text-green-400">{formatCurrency(item.income)}</td>
                                <td className="p-3 text-right text-red-400">{formatCurrency(item.expense)}</td>
                                <td className={`p-3 text-right font-bold ${balance >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                  {formatCurrency(balance)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                      {monthlySummary.length === 0 && (
                         <p className="text-center text-gray-500 py-8">
                           {showFullHistory ? "Nenhum dado para exibir no resumo mensal." : "Nenhum dado para este mês ou futuros."}
                         </p>
                      )}
                    </div>
                </div>
                {hasPastMonths && (
                  <div className="flex-shrink-0 pt-4">
                    <button
                      onClick={() => setShowFullHistory(!showFullHistory)}
                      className="w-full text-center py-2 px-4 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors text-sm font-semibold"
                    >
                      <i className={`fa-solid ${showFullHistory ? 'fa-eye-slash' : 'fa-history'} mr-2`}></i>
                      {showFullHistory ? 'Ocultar Histórico' : 'Ver Histórico Completo'}
                    </button>
                  </div>
                )}
            </div>
          </Card>
          <Card title="Próximas Faturas" className="lg:col-span-1">
              <div className="space-y-4 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  {upcomingCreditCardBills.filter(b => b.total > 0).map(bill => (
                      <div key={bill.cardName} className="flex justify-between items-center bg-gray-700 p-3 rounded-lg">
                          <div>
                              <p className="font-semibold">{bill.cardName}</p>
                              <p className="text-sm text-gray-400">Vencimento: {bill.dueDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                          </div>
                          <p className="font-bold text-orange-400">{formatCurrency(bill.total)}</p>
                      </div>
                  ))}
                  {upcomingCreditCardBills.filter(b => b.total > 0).length === 0 && (
                      <div className="flex items-center justify-center h-full">
                         <p className="text-gray-400 text-center pt-8">Nenhuma fatura em aberto.</p>
                      </div>
                  )}
              </div>
          </Card>
          <Card title="Contas a Vencer" className="lg:col-span-1">
              <div className="space-y-3 max-h-96 overflow-y-auto pr-2 custom-scrollbar">
                  {upcomingBillsToPay.map(bill => (
                      <div key={bill.id} className="flex justify-between items-center bg-gray-700 p-3 rounded-lg">
                          <div className="flex-1 overflow-hidden">
                              <p className="font-semibold truncate">{bill.name}</p>
                              <p className="text-sm text-gray-400">Vence em: {bill.nextDueDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                          </div>
                          <div className="flex items-center gap-3 ml-2">
                             <p className="font-bold text-yellow-400">{formatCurrency(bill.estimatedAmount)}</p>
                             {bill.isPaid ? (
                                <span className="px-3 py-1 bg-green-600 text-white rounded-md text-xs font-semibold">
                                    Pago
                                </span>
                             ) : (
                                <button onClick={() => onPayBill(bill, bill.nextDueDate)} className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-xs font-semibold">
                                    Pagar
                                </button>
                             )}
                          </div>
                      </div>
                  ))}
                  {upcomingBillsToPay.length === 0 && (
                      <div className="flex items-center justify-center h-full">
                         <p className="text-gray-400 text-center pt-8">Nenhuma conta a vencer nos próximos 30 dias.</p>
                      </div>
                  )}
              </div>
          </Card>
      </div>
    </div>
  );
};

export default Dashboard;