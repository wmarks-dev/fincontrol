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


const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#6366F1', '#14B8A6', '#F97316', '#D946EF'];

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const Card: React.FC<{title: string, children: React.ReactNode, className?: string}> = ({ title, children, className }) => (
    <div className={`bg-gray-800 p-6 rounded-xl shadow-lg flex flex-col ${className}`}>
        <h2 className="text-lg font-semibold text-gray-300 mb-4 flex-shrink-0">{title}</h2>
        {children}
    </div>
);

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="p-2 bg-gray-700 border border-gray-600 rounded-md shadow-lg text-sm">
        <p className="label text-white font-bold">{`${label}`}</p>
        {payload.map((pld: any, index: number) => (
          <p key={index} style={{ color: pld.color }}>
            {`${pld.name}: ${formatCurrency(pld.value)}`}
          </p>
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
      className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${period === p ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-3xl font-bold text-white">Relatórios Financeiros</h1>
          <div className="flex items-center gap-2 bg-gray-800 p-1 rounded-lg">
            <PeriodButton p="30d" label="30 dias" />
            <PeriodButton p="90d" label="90 dias" />
            <PeriodButton p="365d" label="Último Ano" />
          </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card title="Despesas por Categoria" className="h-full">
          {expenseByCategory.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow">
              <div className="h-64 md:h-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={expenseByCategory}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius="80%"
                      fill="#8884d8"
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
              <div className="space-y-2 overflow-y-auto max-h-64 md:max-h-full custom-scrollbar pr-2">
                {expenseByCategory.map((entry, index) => (
                   <div key={index} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}}></div>
                        <span>{entry.name}</span>
                      </div>
                      <span className="font-semibold text-gray-300">
                        {formatCurrency(entry.value)}
                        <span className="ml-2 text-xs text-gray-500">
                           ({totalExpenses > 0 ? ((entry.value / totalExpenses) * 100).toFixed(1) : 0}%)
                        </span>
                      </span>
                   </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center flex-col h-full text-gray-500 flex-grow">
                <i className="fa-solid fa-chart-pie text-5xl mb-4"></i>
                <p>Nenhuma despesa no período.</p>
            </div>
          )}
        </Card>

        <Card title="Evolução Financeira Mensal" className="h-full">
            {monthlyTrendData.length > 0 ? (
                <div className="flex-grow">
                    <ResponsiveContainer width="100%" height="100%" minHeight={300}>
                        <LineChart data={monthlyTrendData} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                            <XAxis dataKey="name" stroke="#A0AEC0" tick={{fontSize: 12}} />
                            <YAxis stroke="#A0AEC0" tick={{fontSize: 12}} tickFormatter={(value: number) => formatCurrency(value)} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{fontSize: "14px"}} />
                            <Line type="monotone" dataKey="Receitas" stroke="#10B981" strokeWidth={2} activeDot={{ r: 8 }} />
                            <Line type="monotone" dataKey="Despesas" stroke="#EF4444" strokeWidth={2} activeDot={{ r: 8 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            ) : (
                <div className="flex items-center justify-center flex-col h-full text-gray-500 flex-grow">
                    <i className="fa-solid fa-chart-line text-5xl mb-4"></i>
                    <p>Nenhum dado para exibir no período.</p>
                </div>
            )}
        </Card>
      </div>
      
      <Card title="Evolução do Patrimônio Líquido">
        {netWorthEvolutionData.length > 1 ? (
          <div className="flex-grow">
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={netWorthEvolutionData} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                <XAxis dataKey="date" stroke="#A0AEC0" tick={{ fontSize: 12 }} />
                <YAxis
                  stroke="#A0AEC0"
                  tick={{ fontSize: 12 }}
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
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="flex items-center justify-center flex-col text-gray-500" style={{height: '300px'}}>
            <i className="fa-solid fa-chart-line text-5xl mb-4"></i>
            <p>Dados insuficientes para exibir a evolução.</p>
            <p className="text-sm">Tente selecionar um período maior ou adicione mais transações.</p>
          </div>
        )}
      </Card>

    </div>
  );
};

export default Reports;