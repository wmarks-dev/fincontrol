import React, { useMemo, useState } from 'react';
import { Transaction, CreditCard, TransactionType, PaymentMethod, Category, Period } from '../types';
import { getBillInfoForTransaction, parseISODateAsUTC } from '../utils/dateUtils';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from 'recharts';

interface ReportsProps {
  transactions: Transaction[];
  creditCards: CreditCard[];
  allCategories: Category[];
  onCategoryClick: (categoryId: string, period: Period) => void;
}

const CATEGORY_COLORS = [
  '#6366F1', '#10B981', '#38BDF8', '#F59E0B', '#EC4899',
  '#8B5CF6', '#14B8A6', '#F43F5E', '#A855F7', '#06B6D4',
  '#EAB308', '#64748B', '#F97316', '#84CC16', '#0EA5E9'
];

const PAYMENT_METHOD_CONFIG: { [key: string]: { label: string; icon: string; color: string; bg: string; border: string } } = {
  [PaymentMethod.CREDIT_CARD]: {
    label: 'Cartão de Crédito',
    icon: 'fa-credit-card',
    color: '#F59E0B',
    bg: 'bg-amber-500/15',
    border: 'border-amber-500/30',
  },
  [PaymentMethod.PIX]: {
    label: 'Pix',
    icon: 'fa-bolt',
    color: '#10B981',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/30',
  },
  [PaymentMethod.DEBIT]: {
    label: 'Cartão de Débito',
    icon: 'fa-money-check',
    color: '#38BDF8',
    bg: 'bg-sky-500/15',
    border: 'border-sky-500/30',
  },
  [PaymentMethod.CASH]: {
    label: 'Dinheiro',
    icon: 'fa-money-bill-wave',
    color: '#8B5CF6',
    bg: 'bg-purple-500/15',
    border: 'border-purple-500/30',
  },
};

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const Card: React.FC<{
  title: string;
  icon?: string;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}> = ({ title, icon, headerAction, children, className }) => (
  <div className={`glass-card p-6 rounded-2xl border border-white/[0.08] shadow-xl backdrop-blur-xl flex flex-col ${className || ''}`}>
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5 flex-shrink-0">
      <h2 className="text-base font-bold text-slate-200 flex items-center gap-2.5">
        {icon && (
          <span className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/20 text-blue-400 flex items-center justify-center text-xs">
            <i className={`fa-solid ${icon}`}></i>
          </span>
        )}
        <span>{title}</span>
      </h2>
      {headerAction}
    </div>
    {children}
  </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3 bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl text-xs space-y-1.5 z-50">
        {label && <p className="text-slate-300 font-bold border-b border-white/10 pb-1 mb-1">{label}</p>}
        {payload.map((pld: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 font-medium" style={{ color: pld.color || pld.fill }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pld.color || pld.fill }}></span>
              {pld.name}:
            </span>
            <span className="font-bold text-white tabular-nums">
              {formatCurrency(pld.value)}
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

const Reports: React.FC<ReportsProps> = ({ transactions, creditCards, allCategories, onCategoryClick }) => {
  const [period, setPeriod] = useState<Period>('current_month');
  const [categoryType, setCategoryType] = useState<TransactionType>(TransactionType.EXPENSE);

  const {
    startDate,
    endDate,
    formattedDateRange,
    totalIncome,
    incomeCount,
    totalExpenses,
    expenseCount,
    netBalance,
    savingsRate,
    dailyAverage,
    categoryChartData,
    paymentMethodData,
    monthlyTrendData,
    netWorthEvolutionData,
  } = useMemo(() => {
    // 1. Get effective dates for all transactions (respecting customDueDate)
    const cardsById = new Map(creditCards.map((c) => [c.id, c]));
    const allEffectiveTransactions = transactions
      .map((t) => {
        let effectiveDate: Date;
        const transactionDateAsUTC = parseISODateAsUTC(t.date);

        if (t.type === TransactionType.EXPENSE && t.paymentMethod === PaymentMethod.CREDIT_CARD && t.creditCardId) {
          if (t.customDueDate) {
            effectiveDate = parseISODateAsUTC(t.customDueDate);
          } else {
            const card = cardsById.get(t.creditCardId);
            if (card && transactionDateAsUTC && !isNaN(transactionDateAsUTC.getTime())) {
              const billInfo = getBillInfoForTransaction(card, transactionDateAsUTC);
              effectiveDate = billInfo.dueDate;
            } else {
              effectiveDate = transactionDateAsUTC;
            }
          }
        } else {
          effectiveDate = transactionDateAsUTC;
        }
        return { ...t, effectiveDate };
      })
      .filter((t) => t.effectiveDate && !isNaN(t.effectiveDate.getTime()));

    // 2. Determine date range based on period
    const now = new Date();
    const currentYear = now.getUTCFullYear();
    const currentMonth = now.getUTCMonth();
    const currentDay = now.getUTCDate();

    let sDate: Date;
    let eDate: Date;

    if (period === 'current_month') {
      sDate = new Date(Date.UTC(currentYear, currentMonth, 1, 0, 0, 0));
      const lastDay = new Date(Date.UTC(currentYear, currentMonth + 1, 0)).getUTCDate();
      eDate = new Date(Date.UTC(currentYear, currentMonth, lastDay, 23, 59, 59, 999));
    } else if (period === 'previous_month') {
      let prevYear = currentYear;
      let prevMonth = currentMonth - 1;
      if (prevMonth < 0) {
        prevMonth = 11;
        prevYear -= 1;
      }
      sDate = new Date(Date.UTC(prevYear, prevMonth, 1, 0, 0, 0));
      const lastDay = new Date(Date.UTC(prevYear, prevMonth + 1, 0)).getUTCDate();
      eDate = new Date(Date.UTC(prevYear, prevMonth, lastDay, 23, 59, 59, 999));
    } else if (period === '30d') {
      eDate = new Date(Date.UTC(currentYear, currentMonth, currentDay, 23, 59, 59, 999));
      sDate = new Date(eDate);
      sDate.setUTCDate(sDate.getUTCDate() - 30);
      sDate.setUTCHours(0, 0, 0, 0);
    } else if (period === '90d') {
      eDate = new Date(Date.UTC(currentYear, currentMonth, currentDay, 23, 59, 59, 999));
      sDate = new Date(eDate);
      sDate.setUTCDate(sDate.getUTCDate() - 90);
      sDate.setUTCHours(0, 0, 0, 0);
    } else if (period === 'year') {
      sDate = new Date(Date.UTC(currentYear, 0, 1, 0, 0, 0));
      eDate = new Date(Date.UTC(currentYear, currentMonth, currentDay, 23, 59, 59, 999));
    } else {
      // 365d
      eDate = new Date(Date.UTC(currentYear, currentMonth, currentDay, 23, 59, 59, 999));
      sDate = new Date(eDate);
      sDate.setUTCFullYear(sDate.getUTCFullYear() - 1);
      sDate.setUTCHours(0, 0, 0, 0);
    }

    const formattedRange = `${sDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })} até ${eDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'UTC' })}`;

    // 3. Transactions in period (excluding internal transfers)
    const transactionsInPeriod = allEffectiveTransactions.filter(
      (t) => t.category !== 'transfer' && t.effectiveDate >= sDate && t.effectiveDate <= eDate
    );

    const incomes = transactionsInPeriod.filter((t) => t.type === TransactionType.INCOME);
    const expenses = transactionsInPeriod.filter((t) => t.type === TransactionType.EXPENSE);

    const sumIncome = incomes.reduce((acc, t) => acc + t.amount, 0);
    const sumExpenses = expenses.reduce((acc, t) => acc + t.amount, 0);
    const net = sumIncome - sumExpenses;
    const rate = sumIncome > 0 ? Math.max(0, ((sumIncome - sumExpenses) / sumIncome) * 100) : 0;
    const days = Math.max(1, Math.round((eDate.getTime() - sDate.getTime()) / (1000 * 60 * 60 * 24)));
    const avgDaily = sumExpenses / days;

    // 4. Category breakdown (dynamic based on categoryType toggle)
    const targetTransactions = categoryType === TransactionType.EXPENSE ? expenses : incomes;
    const targetTotal = categoryType === TransactionType.EXPENSE ? sumExpenses : sumIncome;

    const categoryTotals: { [key: string]: number } = {};
    targetTransactions.forEach((t) => {
      categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });

    const categoryList = Object.entries(categoryTotals)
      .map(([catId, total]) => {
        const catObj = allCategories.find((c) => c.id === catId);
        return {
          id: catId,
          name: catObj?.name || 'Outros',
          icon: catObj?.icon || 'fa-tag',
          value: total,
          percentage: targetTotal > 0 ? (total / targetTotal) * 100 : 0,
        };
      })
      .sort((a, b) => b.value - a.value);

    // 5. Payment method breakdown (for expenses)
    const paymentTotals: { [key: string]: { total: number; count: number } } = {};
    expenses.forEach((t) => {
      const pm = t.paymentMethod || PaymentMethod.CASH;
      if (!paymentTotals[pm]) {
        paymentTotals[pm] = { total: 0, count: 0 };
      }
      paymentTotals[pm].total += t.amount;
      paymentTotals[pm].count += 1;
    });

    const paymentList = Object.entries(paymentTotals)
      .map(([method, data]) => {
        const cfg = PAYMENT_METHOD_CONFIG[method] || {
          label: method,
          icon: 'fa-wallet',
          color: '#94A3B8',
          bg: 'bg-slate-500/15',
          border: 'border-slate-500/30',
        };
        return {
          method,
          label: cfg.label,
          icon: cfg.icon,
          color: cfg.color,
          bg: cfg.bg,
          border: cfg.border,
          total: data.total,
          count: data.count,
          percentage: sumExpenses > 0 ? (data.total / sumExpenses) * 100 : 0,
        };
      })
      .sort((a, b) => b.total - a.total);

    // 6. Monthly Cashflow (BarChart)
    const monthlyTotals: { [key: string]: { income: number; expense: number; year: number; month: number } } = {};
    transactionsInPeriod.forEach((t) => {
      const year = t.effectiveDate.getUTCFullYear();
      const month = t.effectiveDate.getUTCMonth();
      const key = `${year}-${month}`;

      if (!monthlyTotals[key]) {
        monthlyTotals[key] = { income: 0, expense: 0, year, month };
      }

      if (t.type === TransactionType.INCOME) {
        monthlyTotals[key].income += t.amount;
      } else if (t.type === TransactionType.EXPENSE) {
        monthlyTotals[key].expense += t.amount;
      }
    });

    const trendData = Object.values(monthlyTotals)
      .sort((a, b) => a.year - b.year || a.month - b.month)
      .map((d) => ({
        name: new Date(Date.UTC(d.year, d.month)).toLocaleString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
        Receitas: d.income,
        Despesas: d.expense,
        Saldo: d.income - d.expense,
      }));

    // 7. Net Worth Evolution
    const transactionsForNetWorth = allEffectiveTransactions.filter((t) => t.category !== 'transfer');
    const transactionsBeforePeriod = transactionsForNetWorth.filter((t) => t.effectiveDate < sDate);
    let currentBalance = transactionsBeforePeriod.reduce((acc, t) => {
      return t.type === TransactionType.INCOME ? acc + t.amount : acc - t.amount;
    }, 0);

    const dailyChanges = new Map<string, number>();
    const transactionsInPeriodForNetWorth = transactionsForNetWorth.filter(
      (t) => t.effectiveDate >= sDate && t.effectiveDate <= eDate
    );

    transactionsInPeriodForNetWorth.forEach((t) => {
      const dateKey = t.effectiveDate.toISOString().split('T')[0];
      const change = t.type === TransactionType.INCOME ? t.amount : -t.amount;
      dailyChanges.set(dateKey, (dailyChanges.get(dateKey) || 0) + change);
    });

    const evolutionDataPoints = [];
    let cursorDate = new Date(sDate);
    while (cursorDate <= eDate) {
      const dateKey = cursorDate.toISOString().split('T')[0];
      if (dailyChanges.has(dateKey)) {
        currentBalance += dailyChanges.get(dateKey)!;
      }

      evolutionDataPoints.push({
        date: cursorDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }),
        'Patrimônio': currentBalance,
      });

      cursorDate.setUTCDate(cursorDate.getUTCDate() + 1);
    }

    return {
      startDate: sDate,
      endDate: eDate,
      formattedDateRange: formattedRange,
      totalIncome: sumIncome,
      incomeCount: incomes.length,
      totalExpenses: sumExpenses,
      expenseCount: expenses.length,
      netBalance: net,
      savingsRate: rate,
      dailyAverage: avgDaily,
      categoryChartData: categoryList,
      paymentMethodData: paymentList,
      monthlyTrendData: trendData,
      netWorthEvolutionData: evolutionDataPoints,
    };
  }, [transactions, creditCards, period, categoryType, allCategories]);

  const PeriodButton: React.FC<{ p: Period; label: string }> = ({ p, label }) => (
    <button
      onClick={() => setPeriod(p)}
      className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
        period === p
          ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25'
          : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
      }`}
    >
      {label}
    </button>
  );

  const handlePieClick = (data: any) => {
    if (data && data.id) {
      onCategoryClick(data.id, period);
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Page Header + Natural Period Filter */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Relatórios Financeiros
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
              <i className="fa-solid fa-chart-line text-[10px]"></i>
              Inteligência Financeira
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5 flex items-center gap-2 flex-wrap">
            <span>Período: <strong className="text-slate-200">{formattedDateRange}</strong></span>
          </p>
        </div>

        {/* Natural Period Buttons */}
        <div className="flex items-center gap-1 bg-slate-900/80 p-1.5 rounded-xl border border-white/[0.08] overflow-x-auto max-w-full custom-scrollbar">
          <PeriodButton p="current_month" label="Este Mês" />
          <PeriodButton p="previous_month" label="Mês Anterior" />
          <PeriodButton p="30d" label="30 dias" />
          <PeriodButton p="90d" label="90 dias" />
          <PeriodButton p="year" label="Este Ano" />
          <PeriodButton p="365d" label="12 Meses" />
        </div>
      </div>

      {/* Top Executive KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Receitas */}
        <div className="glass-card p-5 rounded-2xl border border-white/[0.08] shadow-lg hover:border-emerald-500/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Receitas</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xs">
              <i className="fa-solid fa-arrow-down"></i>
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-400 mt-2 tabular-nums">
            {formatCurrency(totalIncome)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {incomeCount} entrada{incomeCount === 1 ? '' : 's'} no período
          </p>
        </div>

        {/* Total Despesas */}
        <div className="glass-card p-5 rounded-2xl border border-white/[0.08] shadow-lg hover:border-rose-500/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Despesas</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center text-xs">
              <i className="fa-solid fa-arrow-up"></i>
            </div>
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-rose-400 mt-2 tabular-nums">
            {formatCurrency(totalExpenses)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            Média de {formatCurrency(dailyAverage)}/dia ({expenseCount} saídas)
          </p>
        </div>

        {/* Saldo Líquido */}
        <div className="glass-card p-5 rounded-2xl border border-white/[0.08] shadow-lg hover:border-blue-500/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Saldo Líquido</span>
            <div className={`w-8 h-8 rounded-lg border flex items-center justify-center text-xs ${
              netBalance >= 0
                ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400'
                : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
            }`}>
              <i className={`fa-solid ${netBalance >= 0 ? 'fa-scale-balanced' : 'fa-triangle-exclamation'}`}></i>
            </div>
          </div>
          <p className={`text-2xl sm:text-3xl font-extrabold mt-2 tabular-nums ${
            netBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {formatCurrency(netBalance)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {netBalance >= 0 ? 'Economia positiva acumulada' : 'Gastos superaram entradas'}
          </p>
        </div>

        {/* Taxa de Poupança */}
        <div className="glass-card p-5 rounded-2xl border border-white/[0.08] shadow-lg hover:border-purple-500/30 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Taxa de Poupança</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-400 flex items-center justify-center text-xs">
              <i className="fa-solid fa-piggy-bank"></i>
            </div>
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <p className="text-2xl sm:text-3xl font-extrabold text-purple-400 tabular-nums">
              {totalIncome > 0 ? `${savingsRate.toFixed(1)}%` : '0%'}
            </p>
            <span className="text-xs text-slate-400">da renda guardada</span>
          </div>
          <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden mt-2">
            <div
              className="bg-gradient-to-r from-purple-500 to-indigo-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(Math.max(savingsRate, 0), 100)}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Main Charts: Categories + Payment Methods */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Card 1: Categories with Toggle (Despesas vs Receitas) */}
        <Card
          title={categoryType === TransactionType.EXPENSE ? 'Despesas por Categoria' : 'Receitas por Categoria'}
          icon="fa-chart-pie"
          headerAction={
            <div className="flex items-center bg-slate-900/70 p-1 rounded-xl border border-white/5 text-xs">
              <button
                onClick={() => setCategoryType(TransactionType.EXPENSE)}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  categoryType === TransactionType.EXPENSE
                    ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Despesas
              </button>
              <button
                onClick={() => setCategoryType(TransactionType.INCOME)}
                className={`px-3 py-1 rounded-lg font-semibold transition-all ${
                  categoryType === TransactionType.INCOME
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Receitas
              </button>
            </div>
          }
        >
          {categoryChartData.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-grow items-center">
              {/* Donut Chart */}
              <div className="h-64 md:h-72 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius="60%"
                      outerRadius="88%"
                      paddingAngle={3}
                      labelLine={false}
                      dataKey="value"
                      stroke="none"
                      onClick={handlePieClick}
                      cursor="pointer"
                    >
                      {categoryChartData.map((entry, index) => (
                        <Cell
                          key={`cell-${entry.id}`}
                          fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Donut Hole Text */}
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    Total
                  </span>
                  <span className="text-sm sm:text-base font-extrabold text-white tabular-nums">
                    {formatCurrency(
                      categoryType === TransactionType.EXPENSE ? totalExpenses : totalIncome
                    )}
                  </span>
                </div>
              </div>

              {/* Category Breakdown List with Progress Bars */}
              <div className="space-y-2.5 overflow-y-auto max-h-72 custom-scrollbar pr-2">
                {categoryChartData.map((entry, index) => {
                  const color = CATEGORY_COLORS[index % CATEGORY_COLORS.length];
                  return (
                    <div
                      key={entry.id}
                      className="p-2 rounded-xl hover:bg-white/[0.04] transition-all cursor-pointer group border border-transparent hover:border-white/5"
                      onClick={() => handlePieClick(entry)}
                      title={`Filtrar transações de ${entry.name}`}
                    >
                      <div className="flex items-center justify-between text-xs sm:text-sm mb-1.5">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span
                            className="w-3 h-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: color }}
                          ></span>
                          <span className="text-slate-200 truncate font-semibold group-hover:text-blue-400 transition-colors">
                            {entry.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="font-extrabold text-white tabular-nums">
                            {formatCurrency(entry.value)}
                          </span>
                          <span className="text-[11px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 tabular-nums">
                            {entry.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                      {/* Mini Progress Bar */}
                      <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{
                            width: `${Math.min(entry.percentage, 100)}%`,
                            backgroundColor: color,
                          }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center flex-col h-64 text-slate-500 flex-grow">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-600 mb-3">
                <i className="fa-solid fa-chart-pie text-xl"></i>
              </div>
              <p className="text-slate-400 text-sm font-medium">Nenhum dado para exibir neste período.</p>
            </div>
          )}
        </Card>

        {/* Card 2: Payment Methods Breakdown */}
        <Card
          title="Gastos por Forma de Pagamento"
          icon="fa-wallet"
          headerAction={
            <span className="text-xs text-slate-400 font-medium">
              {paymentMethodData.length} meio{paymentMethodData.length === 1 ? '' : 's'} utilizado{paymentMethodData.length === 1 ? '' : 's'}
            </span>
          }
        >
          {paymentMethodData.length > 0 ? (
            <div className="space-y-3.5 flex-grow flex flex-col justify-center">
              {paymentMethodData.map((item) => (
                <div
                  key={item.method}
                  className="p-3.5 rounded-xl bg-slate-800/40 border border-white/[0.05] hover:border-white/10 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0 ${item.bg} ${item.border} border`}
                        style={{ color: item.color }}
                      >
                        <i className={`fa-solid ${item.icon}`}></i>
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-200 truncate">{item.label}</p>
                        <p className="text-[11px] text-slate-400">{item.count} compra{item.count === 1 ? '' : 's'}</p>
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <p className="font-extrabold text-sm sm:text-base text-white tabular-nums">
                        {formatCurrency(item.total)}
                      </p>
                      <span className="text-[11px] font-bold text-slate-400">
                        {item.percentage.toFixed(1)}% do total
                      </span>
                    </div>
                  </div>

                  {/* Horizontal Bar */}
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(item.percentage, 100)}%`,
                        backgroundColor: item.color,
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex items-center justify-center flex-col h-64 text-slate-500 flex-grow">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-600 mb-3">
                <i className="fa-solid fa-credit-card text-xl"></i>
              </div>
              <p className="text-slate-400 text-sm font-medium">Nenhum pagamento registrado no período.</p>
            </div>
          )}
        </Card>
      </div>

      {/* Row 2: Monthly Cashflow BarChart + Net Worth Evolution AreaChart */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Monthly Cashflow BarChart */}
        <Card
          title="Fluxo de Caixa Mensal (Entradas vs Saídas)"
          icon="fa-chart-column"
          headerAction={
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-emerald-400">
                <span className="w-2.5 h-2.5 rounded bg-emerald-500"></span> Receitas
              </span>
              <span className="flex items-center gap-1.5 font-medium text-rose-400">
                <span className="w-2.5 h-2.5 rounded bg-rose-500"></span> Despesas
              </span>
            </div>
          }
        >
          {monthlyTrendData.length > 0 ? (
            <div className="flex-grow pt-2">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={monthlyTrendData}
                  margin={{ top: 10, right: 20, left: -10, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748B" tick={{ fontSize: 12, fill: '#94A3B8' }} />
                  <YAxis
                    stroke="#64748B"
                    tick={{ fontSize: 12, fill: '#94A3B8' }}
                    tickFormatter={(v: number) =>
                      Math.abs(v) >= 1000 ? `${(v / 1000).toFixed(0)}k` : `${v}`
                    }
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="Receitas" fill="#10B981" radius={[6, 6, 0, 0]} maxBarSize={36} />
                  <Bar dataKey="Despesas" fill="#F43F5E" radius={[6, 6, 0, 0]} maxBarSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center flex-col h-64 text-slate-500 flex-grow">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-600 mb-3">
                <i className="fa-solid fa-chart-column text-xl"></i>
              </div>
              <p className="text-slate-400 text-sm font-medium">Nenhum dado mensal no período.</p>
            </div>
          )}
        </Card>

        {/* Net Worth Evolution AreaChart */}
        <Card title="Evolução do Patrimônio Líquido" icon="fa-arrow-trend-up">
          {netWorthEvolutionData.length > 1 ? (
            <div className="flex-grow pt-2">
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart
                  data={netWorthEvolutionData}
                  margin={{ top: 10, right: 20, left: 10, bottom: 5 }}
                >
                  <defs>
                    <linearGradient id="netWorthGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#6366F1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                  <XAxis dataKey="date" stroke="#64748B" tick={{ fontSize: 12, fill: '#94A3B8' }} />
                  <YAxis
                    stroke="#64748B"
                    tick={{ fontSize: 12, fill: '#94A3B8' }}
                    tickFormatter={(value: number) => {
                      if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(0)}k`;
                      return formatCurrency(value);
                    }}
                    domain={['dataMin', 'dataMax']}
                    width={75}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="Patrimônio"
                    stroke="#6366F1"
                    strokeWidth={2.5}
                    fill="url(#netWorthGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center flex-col text-slate-500 h-64 flex-grow">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-600 mb-3">
                <i className="fa-solid fa-chart-line text-xl"></i>
              </div>
              <p className="text-slate-400 text-sm font-medium">Dados insuficientes para exibir a evolução.</p>
              <p className="text-xs text-slate-500 mt-0.5">Tente selecionar um período maior ou adicione mais transações.</p>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default Reports;