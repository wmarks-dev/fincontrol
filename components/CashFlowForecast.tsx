import React, { useState, useMemo, useEffect } from 'react';
import {
  Transaction,
  CreditCard,
  CardMonthlyClosing,
  Bill,
  BillPayment,
  BillMonthlyAmount,
  RecurringTransaction,
  Category,
  SalaryConfig,
  SalaryMonthlyRecord,
  SalaryThirteenthConfig,
  SalaryVacationConfig,
  TaxTableConfig,
  SalaryItemizedEntry,
} from '../types';
import {
  calculateCashFlowForecast,
  SimulatedScenario,
  DayForecastPoint,
  ForecastEvent,
} from '../utils/cashFlowForecast';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';

interface CashFlowForecastProps {
  currentAccountBalance: number;
  currentSavingsBalance: number;
  transactions: Transaction[];
  creditCards: CreditCard[];
  cardMonthlyClosings?: CardMonthlyClosing[];
  bills: Bill[];
  billPayments: BillPayment[];
  billMonthlyAmounts?: BillMonthlyAmount[];
  recurringTransactions: RecurringTransaction[];
  allCategories: Category[];
  salaryConfig?: SalaryConfig | null;
  salaryMonthlyRecords?: SalaryMonthlyRecord[];
  salaryThirteenthConfigs?: SalaryThirteenthConfig[];
  salaryVacationConfigs?: SalaryVacationConfig[];
  salaryTaxTables?: TaxTableConfig[];
  salaryItemizedEntries?: SalaryItemizedEntry[];
  onOpenAddTransaction?: () => void;
  onOpenBills?: () => void;
  onOpenCards?: () => void;
}

const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const formatDateBR = (isoDate: string) => {
  if (!isoDate) return '';
  const [year, month, day] = isoDate.split('-');
  return `${day}/${month}/${year}`;
};

const SOURCE_CONFIG = {
  credit_card_bill: {
    label: 'Fatura de Cartão',
    icon: 'fa-credit-card',
    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  },
  bill: {
    label: 'Conta Fixa',
    icon: 'fa-file-invoice-dollar',
    badge: 'bg-sky-500/15 text-sky-300 border-sky-500/30',
  },
  recurring: {
    label: 'Recorrência',
    icon: 'fa-repeat',
    badge: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30',
  },
  scheduled_transaction: {
    label: 'Lançamento Agendado',
    icon: 'fa-calendar-check',
    badge: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  },
  simulation: {
    label: 'Simulação E se...?',
    icon: 'fa-wand-magic-sparkles',
    badge: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  },
  salary: {
    label: 'Salário / Vale',
    icon: 'fa-money-bill-wave',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  },
};

const CustomForecastTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const point: DayForecastPoint = payload[0].payload;
    return (
      <div className="p-3.5 bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl text-xs space-y-2 min-w-[220px] max-w-xs z-50">
        <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
          <span className="font-bold text-white">
            {formatDateBR(point.date)} ({point.dayOfWeek})
          </span>
          <span
            className={`font-bold px-2 py-0.5 rounded text-[11px] ${
              point.balance >= 0
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
            }`}
          >
            {formatCurrency(point.balance)}
          </span>
        </div>

        <div className="space-y-1 text-[11px]">
          {point.inflows > 0 && (
            <div className="flex justify-between text-emerald-400 font-semibold">
              <span>+ Entradas do dia:</span>
              <span className="tabular-nums">+{formatCurrency(point.inflows)}</span>
            </div>
          )}
          {point.outflows > 0 && (
            <div className="flex justify-between text-rose-400 font-semibold">
              <span>- Saídas do dia:</span>
              <span className="tabular-nums">-{formatCurrency(point.outflows)}</span>
            </div>
          )}
        </div>

        {point.events.length > 0 && (
          <div className="pt-1.5 border-t border-white/10 space-y-1">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {point.events.length} evento{point.events.length > 1 ? 's' : ''}:
            </p>
            <div className="max-h-32 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
              {point.events.map((ev) => (
                <div
                  key={ev.id}
                  className="flex items-center justify-between text-[11px] gap-2 py-0.5"
                >
                  <span className="truncate text-slate-300 flex-1">{ev.title}</span>
                  <span
                    className={`font-bold tabular-nums flex-shrink-0 ${
                      ev.amount >= 0 ? 'text-emerald-400' : 'text-slate-200'
                    }`}
                  >
                    {ev.amount >= 0 ? '+' : ''}
                    {formatCurrency(ev.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
  return null;
};

const CashFlowForecast: React.FC<CashFlowForecastProps> = ({
  currentAccountBalance,
  currentSavingsBalance,
  transactions,
  creditCards,
  cardMonthlyClosings = [],
  bills,
  billPayments,
  billMonthlyAmounts = [],
  recurringTransactions,
  allCategories,
  salaryConfig,
  salaryMonthlyRecords = [],
  salaryThirteenthConfigs = [],
  salaryVacationConfigs = [],
  salaryTaxTables = [],
  salaryItemizedEntries = [],
  onOpenAddTransaction,
  onOpenBills,
  onOpenCards,
}) => {
  const [horizonDays, setHorizonDays] = useState<number>(30);
  const [includeSavings, setIncludeSavings] = useState<boolean>(false);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState<boolean>(false);
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);

  // Simulated scenarios from localStorage
  const [simulatedScenarios, setSimulatedScenarios] = useState<SimulatedScenario[]>(() => {
    try {
      const saved = localStorage.getItem('fincontrol_simulated_scenarios');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return [];
  });

  // Save scenarios to localStorage on change
  useEffect(() => {
    try {
      localStorage.setItem(
        'fincontrol_simulated_scenarios',
        JSON.stringify(simulatedScenarios)
      );
    } catch {}
  }, [simulatedScenarios]);

  // New simulation form state
  const [newSimTitle, setNewSimTitle] = useState('');
  const [newSimAmount, setNewSimAmount] = useState('');
  const [newSimType, setNewSimType] = useState<'income' | 'expense'>('expense');
  const [newSimDate, setNewSimDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().split('T')[0];
  });
  const [newSimInstallments, setNewSimInstallments] = useState('1');

  const handleAddSimulation = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(newSimAmount.replace(',', '.'));
    if (!newSimTitle.trim() || isNaN(parsedAmount) || parsedAmount <= 0) {
      return;
    }

    const scenario: SimulatedScenario = {
      id: 'sim_' + Date.now(),
      title: newSimTitle.trim(),
      amount: parsedAmount,
      type: newSimType,
      date: newSimDate,
      installments: parseInt(newSimInstallments, 10) || 1,
      enabled: true,
    };

    setSimulatedScenarios((prev) => [scenario, ...prev]);
    setNewSimTitle('');
    setNewSimAmount('');
    setNewSimInstallments('1');
  };

  const handleToggleScenario = (id: string) => {
    setSimulatedScenarios((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
  };

  const handleDeleteScenario = (id: string) => {
    setSimulatedScenarios((prev) => prev.filter((s) => s.id !== id));
  };

  // Run the forecast calculation
  const forecast = useMemo(() => {
    return calculateCashFlowForecast({
      currentAccountBalance,
      currentSavingsBalance,
      includeSavings,
      horizonDays,
      transactions,
      creditCards,
      cardMonthlyClosings,
      bills,
      billPayments,
      billMonthlyAmounts,
      recurringTransactions,
      simulatedScenarios,
      salaryConfig,
      salaryMonthlyRecords,
      salaryThirteenthConfigs,
      salaryVacationConfigs,
      salaryTaxTables,
      salaryItemizedEntries,
    });
  }, [
    currentAccountBalance,
    currentSavingsBalance,
    includeSavings,
    horizonDays,
    transactions,
    creditCards,
    cardMonthlyClosings,
    bills,
    billPayments,
    billMonthlyAmounts,
    recurringTransactions,
    simulatedScenarios,
    salaryConfig,
    salaryMonthlyRecords,
    salaryThirteenthConfigs,
    salaryVacationConfigs,
    salaryTaxTables,
    salaryItemizedEntries,
  ]);

  // Days with events for timeline
  const daysWithEvents = useMemo(() => {
    return forecast.dailyPoints.filter((dp) => dp.events.length > 0);
  }, [forecast.dailyPoints]);

  const activeScenariosCount = simulatedScenarios.filter((s) => s.enabled).length;

  return (
    <div className="space-y-6 pb-12 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Projeção de Saldo & Fluxo de Caixa
            </h1>
            <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/30">
              <i className="fa-solid fa-wand-magic-sparkles text-[10px]"></i>
              Simulador Inteligente
            </span>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Previsão do saldo diário da sua conta com base em contas, faturas e recorrências futuras.
          </p>
        </div>

        {/* Controls & Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Include Savings Toggle */}
          <button
            type="button"
            onClick={() => setIncludeSavings(!includeSavings)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2 ${
              includeSavings
                ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                : 'bg-slate-800/80 border-white/[0.08] text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
            title="Incluir saldo da Poupança/Reserva no ponto de partida da projeção"
          >
            <i className={`fa-solid ${includeSavings ? 'fa-toggle-on text-emerald-400' : 'fa-toggle-off'} text-sm`}></i>
            <span>Incluir Poupança</span>
          </button>

          {/* Simulator Toggle Button */}
          <button
            type="button"
            onClick={() => setIsSimulatorOpen(!isSimulatorOpen)}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all flex items-center gap-2 ${
              isSimulatorOpen || activeScenariosCount > 0
                ? 'bg-violet-600/25 border-violet-500/40 text-violet-300 shadow-md shadow-violet-500/20'
                : 'bg-slate-800/80 border-white/[0.08] text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
            title="Abrir o simulador de cenários 'E se...?'"
          >
            <i className="fa-solid fa-wand-magic-sparkles text-xs text-violet-400"></i>
            <span>Simulador "E se...?"</span>
            {activeScenariosCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-violet-500 text-white text-[10px] font-bold flex items-center justify-center">
                {activeScenariosCount}
              </span>
            )}
          </button>

          {/* Horizon Pills */}
          <div className="flex items-center gap-1 bg-slate-900/80 p-1 rounded-xl border border-white/[0.08] overflow-x-auto custom-scrollbar">
            {[
              { days: 15, label: '15 dias' },
              { days: 30, label: '30 dias' },
              { days: 60, label: '60 dias' },
              { days: 90, label: '90 dias' },
              { days: 180, label: '6 meses' },
            ].map((h) => (
              <button
                key={h.days}
                type="button"
                onClick={() => {
                  setHorizonDays(h.days);
                  setSelectedDayDate(null);
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                  horizonDays === h.days
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                {h.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Critical Negative Balance Warning Banner */}
      {forecast.hasRiskOfNegative && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-start gap-3.5 animate-in fade-in duration-200">
          <div className="w-10 h-10 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-400 flex items-center justify-center text-lg flex-shrink-0 mt-0.5">
            <i className="fa-solid fa-triangle-exclamation"></i>
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-rose-300">
              Atenção: Risco de Saldo Negativo Detectado!
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              Com os compromissos agendados, seu saldo ficará negativo a partir de{' '}
              <strong className="text-white font-semibold">
                {formatDateBR(forecast.firstNegativeDate || '')}
              </strong>
              , atingindo um rombo máximo de{' '}
              <strong className="text-rose-400 font-bold tabular-nums">
                {formatCurrency(forecast.minBalance)}
              </strong>{' '}
              em {formatDateBR(forecast.minBalanceDate)}. Antecipe receitas ou ajuste despesas para evitar o cheque especial.
            </p>
          </div>
        </div>
      )}

      {/* 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Saldo Inicial */}
        <div className="glass-card p-5 rounded-2xl border border-white/[0.08] relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Saldo Inicial (Hoje)
              </p>
              <p className="text-[11px] text-slate-500">
                {includeSavings ? 'Conta Corrente + Poupança' : 'Disponível em Conta'}
              </p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-xs">
              <i className="fa-solid fa-wallet"></i>
            </div>
          </div>
          <p className="text-2xl font-extrabold text-white tabular-nums tracking-tight">
            {formatCurrency(forecast.startBalance)}
          </p>
        </div>

        {/* 2. Total a Receber */}
        <div className="glass-card p-5 rounded-2xl border border-white/[0.08] relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Entradas Previstas (+)
              </p>
              <p className="text-[11px] text-slate-500">Próximos {horizonDays} dias</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">
              <i className="fa-solid fa-arrow-trend-up"></i>
            </div>
          </div>
          <p className="text-2xl font-extrabold text-emerald-400 tabular-nums tracking-tight">
            +{formatCurrency(forecast.totalInflows)}
          </p>
        </div>

        {/* 3. Total a Pagar */}
        <div className="glass-card p-5 rounded-2xl border border-white/[0.08] relative overflow-hidden flex flex-col justify-between">
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Saídas Previstas (-)
              </p>
              <p className="text-[11px] text-slate-500">Contas, Faturas e Parcelas</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center text-xs">
              <i className="fa-solid fa-arrow-trend-down"></i>
            </div>
          </div>
          <p className="text-2xl font-extrabold text-rose-400 tabular-nums tracking-tight">
            -{formatCurrency(forecast.totalOutflows)}
          </p>
        </div>

        {/* 4. Saldo Final Projetado */}
        <div
          className={`glass-card p-5 rounded-2xl border relative overflow-hidden flex flex-col justify-between ${
            forecast.endBalance >= 0
              ? 'border-indigo-500/30 shadow-indigo-500/5'
              : 'border-rose-500/40 bg-rose-950/20 shadow-rose-500/10'
          }`}
        >
          <div className="flex justify-between items-start mb-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Saldo Projetado Final
              </p>
              <p className="text-[11px] text-slate-400">
                Menor saldo:{' '}
                <span
                  className={`font-semibold ${
                    forecast.minBalance >= 0 ? 'text-slate-300' : 'text-rose-400'
                  }`}
                >
                  {formatCurrency(forecast.minBalance)}
                </span>
              </p>
            </div>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs border ${
                forecast.endBalance >= 0
                  ? 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400'
                  : 'bg-rose-500/15 border-rose-500/30 text-rose-400'
              }`}
            >
              <i
                className={`fa-solid ${
                  forecast.endBalance >= 0 ? 'fa-scale-balanced' : 'fa-skull-crossbones'
                }`}
              ></i>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <p
              className={`text-2xl font-extrabold tabular-nums tracking-tight ${
                forecast.endBalance >= 0 ? 'text-white' : 'text-rose-400'
              }`}
            >
              {formatCurrency(forecast.endBalance)}
            </p>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-lg tabular-nums ${
                forecast.netChange >= 0
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-rose-500/15 text-rose-400'
              }`}
            >
              {forecast.netChange >= 0 ? '+' : ''}
              {formatCurrency(forecast.netChange)}
            </span>
          </div>
        </div>
      </div>

      {/* Simulator Drawer (Cenários E se...?) */}
      {isSimulatorOpen && (
        <div className="glass-card p-5 sm:p-6 rounded-2xl border border-violet-500/30 bg-violet-950/15 space-y-4 animate-in fade-in duration-200">
          <div className="flex justify-between items-center pb-2 border-b border-white/[0.08]">
            <div className="flex items-center gap-2.5">
              <span className="w-8 h-8 rounded-lg bg-violet-500/20 text-violet-300 flex items-center justify-center text-xs border border-violet-500/30">
                <i className="fa-solid fa-wand-magic-sparkles"></i>
              </span>
              <div>
                <h3 className="text-sm font-bold text-white">
                  Simulador de Cenários ("E se...?")
                </h3>
                <p className="text-xs text-slate-400">
                  Teste novas compras ou recebimentos sem alterar os dados oficiais da sua conta.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsSimulatorOpen(false)}
              className="text-slate-400 hover:text-white text-xs"
            >
              <i className="fa-solid fa-xmark text-sm"></i>
            </button>
          </div>

          {/* Add Scenario Form */}
          <form onSubmit={handleAddSimulation} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
            {/* Title */}
            <div className="lg:col-span-2">
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Descrição do Cenário
              </label>
              <input
                type="text"
                placeholder="Ex: Bônus extra, Manutenção carro, TV..."
                value={newSimTitle}
                onChange={(e) => setNewSimTitle(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 focus:ring-2 focus:ring-violet-500 focus:outline-none"
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Tipo
              </label>
              <select
                value={newSimType}
                onChange={(e) => setNewSimType(e.target.value as 'income' | 'expense')}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
              >
                <option value="expense">Saída (-)</option>
                <option value="income">Entrada (+)</option>
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Valor Total (R$)
              </label>
              <input
                type="text"
                placeholder="0,00"
                value={newSimAmount}
                onChange={(e) => setNewSimAmount(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-white text-xs placeholder-slate-500 focus:ring-2 focus:ring-violet-500 focus:outline-none"
              />
            </div>

            {/* Date */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Data Prevista
              </label>
              <input
                type="date"
                value={newSimDate}
                onChange={(e) => setNewSimDate(e.target.value)}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
              />
            </div>

            {/* Installments & Submit Button */}
            <div className="flex items-end gap-2">
              <div className="w-20">
                <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                  Parcelas
                </label>
                <select
                  value={newSimInstallments}
                  onChange={(e) => setNewSimInstallments(e.target.value)}
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-2 py-2 text-white text-xs focus:ring-2 focus:ring-violet-500 focus:outline-none"
                >
                  <option value="1">1x</option>
                  <option value="2">2x</option>
                  <option value="3">3x</option>
                  <option value="4">4x</option>
                  <option value="6">6x</option>
                  <option value="10">10x</option>
                  <option value="12">12x</option>
                </select>
              </div>

              <button
                type="submit"
                className="flex-1 py-2 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-md shadow-violet-600/30 transition-all active:scale-95 flex items-center justify-center gap-1.5"
              >
                <i className="fa-solid fa-plus text-xs"></i>
                <span>Adicionar</span>
              </button>
            </div>
          </form>

          {/* Active Scenarios List */}
          {simulatedScenarios.length > 0 && (
            <div className="pt-2 border-t border-white/[0.06] space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Cenários Cadastrados ({simulatedScenarios.length}):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {simulatedScenarios.map((scenario) => (
                  <div
                    key={scenario.id}
                    className={`p-3 rounded-xl border flex items-center justify-between gap-3 transition-all ${
                      scenario.enabled
                        ? 'bg-slate-900/80 border-violet-500/30'
                        : 'bg-slate-900/40 border-white/[0.04] opacity-50'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            scenario.type === 'income' ? 'bg-emerald-400' : 'bg-rose-400'
                          }`}
                        ></span>
                        <p className="text-xs font-bold text-white truncate">{scenario.title}</p>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        {scenario.installments && scenario.installments > 1
                          ? `${scenario.installments}x de ${formatCurrency(
                              scenario.amount / scenario.installments
                            )}`
                          : formatCurrency(scenario.amount)}{' '}
                        • a partir de {formatDateBR(scenario.date)}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleScenario(scenario.id)}
                        className={`text-xs px-2 py-1 rounded-lg font-semibold transition-colors ${
                          scenario.enabled
                            ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                            : 'bg-slate-800 text-slate-500'
                        }`}
                        title={scenario.enabled ? 'Desativar cenário' : 'Ativar cenário'}
                      >
                        {scenario.enabled ? 'Ativo' : 'Desativado'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteScenario(scenario.id)}
                        className="w-7 h-7 rounded-lg bg-slate-800/80 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 flex items-center justify-center text-xs transition-colors"
                        title="Excluir cenário"
                      >
                        <i className="fa-solid fa-trash text-[11px]"></i>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Interactive Forecast Chart */}
      <div className="glass-card p-6 rounded-2xl border border-white/[0.08] shadow-xl backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/20 text-blue-400 flex items-center justify-center text-xs">
              <i className="fa-solid fa-chart-line"></i>
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-200">
                Curva de Evolução do Saldo
              </h2>
              <p className="text-xs text-slate-400">
                Acompanhamento diário da conta nos próximos {horizonDays} dias
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5 font-medium">
              <span className="w-3 h-0.5 bg-blue-500"></span> Linha de Saldo
            </span>
            <span className="flex items-center gap-1.5 font-medium text-rose-400">
              <span className="w-3 h-0.5 bg-rose-500 border-dashed"></span> Limite R$ 0,00
            </span>
          </div>
        </div>

        {/* Recharts Area Chart */}
        <div className="h-72 sm:h-80 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={forecast.dailyPoints}
              margin={{ top: 10, right: 10, left: 10, bottom: 5 }}
              onClick={(e: any) => {
                if (e && e.activePayload && e.activePayload[0]) {
                  const clickedDate = e.activePayload[0].payload.date;
                  setSelectedDayDate((prev) => (prev === clickedDate ? null : clickedDate));
                }
              }}
            >
              <defs>
                <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop
                    offset="5%"
                    stopColor={forecast.hasRiskOfNegative ? '#8B5CF6' : '#3B82F6'}
                    stopOpacity={0.4}
                  />
                  <stop
                    offset="95%"
                    stopColor={forecast.hasRiskOfNegative ? '#8B5CF6' : '#3B82F6'}
                    stopOpacity={0}
                  />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
              <XAxis
                dataKey="formattedDate"
                stroke="#64748B"
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                interval={Math.ceil(forecast.dailyPoints.length / 10)}
              />
              <YAxis
                stroke="#64748B"
                tick={{ fontSize: 11, fill: '#94A3B8' }}
                tickFormatter={(val: number) =>
                  Math.abs(val) >= 1000 ? `${(val / 1000).toFixed(0)}k` : `${val}`
                }
                width={65}
              />
              <Tooltip content={<CustomForecastTooltip />} />
              <ReferenceLine y={0} stroke="#EF4444" strokeDasharray="4 4" strokeWidth={1.5} />
              <Area
                type="monotone"
                dataKey="balance"
                stroke={forecast.hasRiskOfNegative ? '#A855F7' : '#3B82F6'}
                strokeWidth={2.5}
                fill="url(#balanceGradient)"
                activeDot={{ r: 6, fill: '#60A5FA', stroke: '#1E293B', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <p className="text-[11px] text-slate-500 text-center mt-2">
          Dica: Clique em qualquer ponto do gráfico para filtrar as movimentações daquele dia na lista abaixo.
        </p>
      </div>

      {/* Projected Timeline / Daily Cash Flow Events */}
      <div className="glass-card p-6 rounded-2xl border border-white/[0.08] shadow-xl">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 mb-5">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-lg bg-indigo-500/15 border border-indigo-500/20 text-indigo-400 flex items-center justify-center text-xs">
              <i className="fa-solid fa-calendar-days"></i>
            </span>
            <div>
              <h2 className="text-base font-bold text-slate-200">
                Cronograma de Movimentações Previstas
              </h2>
              <p className="text-xs text-slate-400">
                {daysWithEvents.length} dia{daysWithEvents.length === 1 ? '' : 's'} com eventos financeiros nos próximos {horizonDays} dias
              </p>
            </div>
          </div>

          {selectedDayDate && (
            <button
              onClick={() => setSelectedDayDate(null)}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 font-semibold"
            >
              <i className="fa-solid fa-filter-circle-xmark"></i>
              <span>Limpar filtro do dia ({formatDateBR(selectedDayDate)})</span>
            </button>
          )}
        </div>

        {daysWithEvents.length > 0 ? (
          <div className="space-y-4">
            {daysWithEvents
              .filter((dp) => !selectedDayDate || dp.date === selectedDayDate)
              .map((dayPoint) => (
                <div
                  key={dayPoint.date}
                  className={`p-4 rounded-xl border transition-all ${
                    selectedDayDate === dayPoint.date
                      ? 'bg-blue-600/15 border-blue-500/40 ring-1 ring-blue-500/30'
                      : 'bg-slate-900/60 border-white/[0.05] hover:border-white/10'
                  }`}
                >
                  {/* Day Header */}
                  <div className="flex justify-between items-center pb-2.5 border-b border-white/[0.06] mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        {formatDateBR(dayPoint.date)}
                      </span>
                      <span className="text-[11px] font-medium text-slate-400">
                        ({dayPoint.dayOfWeek})
                      </span>
                    </div>

                    <div className="text-right flex items-center gap-2">
                      <span className="text-[11px] text-slate-400">Saldo após movimentação:</span>
                      <span
                        className={`text-xs font-extrabold tabular-nums ${
                          dayPoint.balance >= 0 ? 'text-slate-200' : 'text-rose-400'
                        }`}
                      >
                        {formatCurrency(dayPoint.balance)}
                      </span>
                    </div>
                  </div>

                  {/* Day Events */}
                  <div className="space-y-2">
                    {dayPoint.events.map((ev) => {
                      const cfg = SOURCE_CONFIG[ev.source] || SOURCE_CONFIG.scheduled_transaction;
                      const isIncome = ev.amount >= 0;

                      return (
                        <div
                          key={ev.id}
                          className="flex items-center justify-between gap-3 p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800/70 transition-colors"
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span
                              className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0 ${cfg.badge} border`}
                            >
                              <i className={`fa-solid ${cfg.icon}`}></i>
                            </span>

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-xs font-bold text-slate-200 truncate">
                                  {ev.title}
                                </p>
                                <span
                                  className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${cfg.badge}`}
                                >
                                  {cfg.label}
                                </span>
                              </div>
                              {ev.description && (
                                <p className="text-[10px] text-slate-400 truncate">
                                  {ev.description}
                                </p>
                              )}
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <p
                              className={`text-xs sm:text-sm font-extrabold tabular-nums ${
                                isIncome ? 'text-emerald-400' : 'text-slate-200'
                              }`}
                            >
                              {isIncome ? '+' : ''}
                              {formatCurrency(ev.amount)}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>
        ) : (
          <div className="flex items-center justify-center flex-col h-44 text-slate-500">
            <div className="w-12 h-12 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-600 mb-3">
              <i className="fa-solid fa-calendar-check text-xl"></i>
            </div>
            <p className="text-slate-300 text-sm font-semibold">
              Nenhuma movimentação prevista nos próximos {horizonDays} dias.
            </p>
            <p className="text-xs text-slate-500 mt-1 max-w-md text-center">
              Adicione contas fixas, faturas ou receitas recorrentes para que o motor projete os próximos lançamentos aqui.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CashFlowForecast;
