import React, { useMemo, useState } from 'react';
import { Transaction, CreditCard, TransactionType, PaymentMethod, Category } from '../types';
import { getBillInfoForTransaction, parseISODateAsUTC } from '../utils/dateUtils';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts';

type Period = '30d' | '90d' | '365d';

interface ReportsProps {
  transactions: Transaction[];
  creditCards: CreditCard[];
  allCategories: Category[];
  onCategoryClick: (categoryId: string, period: Period) => void;
}


const COLORS = ['#6366F1', '#10B981', '#38BDF8', '#F59E0B', '#EC4899', '#8B5CF6', '#14B8A6', '#F43F5E', '#A855F7', '#06B6D4'];

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const Card: React.FC<{title: string, icon?: string, children: React.ReactNode, className?: string}> = ({ title, icon, children, className }) => (
    <div className={`glass-card p-6 rounded-2xl border border-white/[0.07] flex flex-col ${className || ''}`}>
        <h2 className="text-base font-bold text-slate-200 mb-5 flex items-center gap-2.5 flex-shrink-0">
            {icon && (
              <span className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/20 text-blue-400 flex items-center justify-center text-xs">
                <i className={`fa-solid ${icon}`}></i>
              </span>
            )}
            {title}
        </h2>
        {children}
    </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-3 bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl text-xs space-y-1">
        {label && <p className="text-slate-300 font-bold border-b border-white/10 pb-1 mb-1">{`${label}`}</p>}
        {payload.map((pld: any, index: number) => (
          <div key={index} className="flex items-center justify-between gap-4">
            <span className="flex items-center gap-1.5 font-medium" style={{ color: pld.color }}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: pld.color }}></span>
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
  const [period, setPeriod] = useState<Period>('30d');

  const { expenseByCategory, monthlyTrendData, totalExpenses, netWorthEvolutionData } = useMemo(() => {
    // 1. Get effective dates for all transactions
    const cardsById = new Map(creditCards.map(c => [c.id, c]));
    const allEffectiveTransactions = transactions.map(t => {
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
    }).filter(t => t.effectiveDate && !isNaN(t.effectiveDate.getTime()));

    // 2. Determine date range
    const now = new Date();
    const endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    let startDate = new Date(endDate);

    if (period === '30d') {
        startDate.setUTCDate(startDate.getUTCDate() - 30);
    } else if (period === '90d') {
        startDate.setUTCDate(startDate.getUTCDate() - 90);
    } else if (period === '365d') {
        startDate.setUTCFullYear(startDate.getUTCFullYear() - 1);
    }
    startDate.setUTCHours(0, 0, 0, 0);

    // 3. --- NET WORTH EVOLUTION CALCULATION ---
    const transactionsForNetWorth = allEffectiveTransactions.filter(t => t.category !== 'transfer');
    
    const transactionsBeforePeriod = transactionsForNetWorth.filter(t => t.effectiveDate < startDate);
    let currentBalance = transactionsBeforePeriod.reduce((acc, t) => {
        return t.type === TransactionType.INCOME ? acc + t.amount : acc - t.amount;
    }, 0);

    const dailyChanges = new Map<string, number>();
    const transactionsInPeriodForNetWorth = transactionsForNetWorth.filter(t => t.effectiveDate >= startDate && t.effectiveDate <= endDate);
    
    transactionsInPeriodForNetWorth.forEach(t => {
        const dateKey = t.effectiveDate.toISOString().split('T')[0];
        const change = t.type === TransactionType.INCOME ? t.amount : -t.amount;
        dailyChanges.set(dateKey, (dailyChanges.get(dateKey) || 0) + change);
    });

    const evolutionDataPoints = [];
    let cursorDate = new Date(startDate);
    while (cursorDate <= endDate) {
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

    // 4. --- EXISTING CHART CALCULATIONS ---
    const transactionsInPeriodForCharts = allEffectiveTransactions.filter(t => 
        t.effectiveDate >= startDate && t.effectiveDate <= endDate
    );
    const expenses = transactionsInPeriodForCharts.filter(t => t.type === TransactionType.EXPENSE && t.category !== 'transfer');
    const totalExpensesValue = expenses.reduce((acc, t) => acc + t.amount, 0);
    
    const categoryTotals: { [key: string]: number } = {};
    expenses.forEach(t => {
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + t.amount;
    });
    const pieData = Object.entries(categoryTotals).map(([catId, total]) => ({
        id: catId,
        name: allCategories.find(c => c.id === catId)?.name || 'Outros',
        value: total,
    })).sort((a,b) => b.value - a.value);
    
    const monthlyTotals: { [key: string]: { income: number, expense: number, year: number, month: number } } = {};
    transactionsInPeriodForCharts.forEach(t => {
        if (t.category === 'transfer') return;
        
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
    const lineData = Object.values(monthlyTotals)
        .sort((a,b) => a.year - b.year || a.month - b.month)
        .map(d => ({
            name: new Date(Date.UTC(d.year, d.month)).toLocaleString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' }),
            Receitas: d.income,
            Despesas: d.expense
        }));

    return { 
        expenseByCategory: pieData, 
        monthlyTrendData: lineData, 
        totalExpenses: totalExpensesValue,
        netWorthEvolutionData: evolutionDataPoints
    };
  }, [transactions, creditCards, period, allCategories]);
  
  const PeriodButton: React.FC<{p: Period, label: string}> = ({p, label}) => (
    <button
      onClick={() => setPeriod(p)}
      className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all ${
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
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-white/[0.06]">
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Relatórios Financeiros</h1>
            <p className="text-sm text-slate-400 mt-0.5">Análises gráficas e tendências de gastos</p>
          </div>
          <div className="flex items-center gap-1.5 bg-slate-900/70 p-1 rounded-xl border border-white/[0.08]">
            <PeriodButton p="30d" label="30 dias" />
            <PeriodButton p="90d" label="90 dias" />
            <PeriodButton p="365d" label="Último Ano" />
          </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="Despesas por Categoria" icon="fa-chart-pie" className="h-full">
          {expenseByCategory.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow items-center">
              <div className="h-64 md:h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseByCategory}
                      cx="50%"
                      cy="50%"
                      innerRadius="58%"
                      outerRadius="86%"
                      paddingAngle={3}
                      labelLine={false}
                      dataKey="value"
                      stroke="none"
                      onClick={handlePieClick}
                      cursor="pointer"
                    >
                      {expenseByCategory.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip content={<CustomTooltip />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-1.5 overflow-y-auto max-h-64 md:max-h-72 custom-scrollbar pr-2">
                {expenseByCategory.map((entry, index) => (
                   <div 
                     key={index} 
                     className="flex items-center justify-between text-xs sm:text-sm p-1.5 rounded-lg hover:bg-white/[0.04] transition-colors cursor-pointer"
                     onClick={() => handlePieClick(entry)}
                   >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{backgroundColor: COLORS[index % COLORS.length]}}></div>
                        <span className="text-slate-300 truncate font-medium">{entry.name}</span>
                      </div>
                      <span className="font-bold text-slate-200 tabular-nums flex-shrink-0 ml-2">
                        {formatCurrency(entry.value)}
                        <span className="ml-1.5 text-[11px] text-slate-500 font-normal">
                           ({totalExpenses > 0 ? ((entry.value / totalExpenses) * 100).toFixed(1) : 0}%)
                        </span>
                      </span>
                   </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center flex-col h-64 text-slate-500 flex-grow">
                <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-600 mb-3">
                  <i className="fa-solid fa-chart-pie text-xl"></i>
                </div>
                <p className="text-slate-400 text-sm font-medium">Nenhuma despesa no período.</p>
            </div>
          )}
        </Card>

        <Card title="Evolução Financeira Mensal" icon="fa-chart-line" className="h-full">
            {monthlyTrendData.length > 0 ? (
                <div className="flex-grow">
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={monthlyTrendData} margin={{ top: 10, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                            <XAxis dataKey="name" stroke="#64748B" tick={{fontSize: 12, fill: '#94A3B8'}} />
                            <YAxis stroke="#64748B" tick={{fontSize: 12, fill: '#94A3B8'}} tickFormatter={(value: number) => formatCurrency(value)} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{fontSize: "13px", paddingTop: "8px"}} />
                            <Line type="monotone" dataKey="Receitas" stroke="#10B981" strokeWidth={2.5} dot={{ r: 4, fill: '#10B981' }} activeDot={{ r: 7 }} />
                            <Line type="monotone" dataKey="Despesas" stroke="#F43F5E" strokeWidth={2.5} dot={{ r: 4, fill: '#F43F5E' }} activeDot={{ r: 7 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="flex items-center justify-center flex-col h-64 text-slate-500 flex-grow">
                    <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-600 mb-3">
                      <i className="fa-solid fa-chart-line text-xl"></i>
                    </div>
                    <p className="text-slate-400 text-sm font-medium">Nenhum dado para exibir no período.</p>
                </div>
            )}
        </Card>
      </div>
      
      <Card title="Evolução do Patrimônio Líquido" icon="fa-arrow-trend-up">
        {netWorthEvolutionData.length > 1 ? (
          <div className="flex-grow">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={netWorthEvolutionData} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
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
                  width={80}
                />
                <Tooltip content={<CustomTooltip />} />
                <Line
                  type="monotone"
                  dataKey="Patrimônio"
                  stroke="#6366F1"
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 6, fill: '#818CF8' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex items-center justify-center flex-col text-slate-500 h-64">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-600 mb-3">
                      <i className="fa-solid fa-chart-line text-xl"></i>
            </div>
            <p className="text-slate-400 text-sm font-medium">Dados insuficientes para exibir a evolução.</p>
            <p className="text-xs text-slate-500 mt-0.5">Tente selecionar um período maior ou adicione mais transações.</p>
          </div>
        )}
      </Card>

    </div>
  );
};

export default Reports;