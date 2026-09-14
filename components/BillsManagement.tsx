import React, { useState, useMemo } from 'react';
import { Bill, BillPayment, BillMonthlyAmount, Category } from '../types';

interface BillsManagementProps {
  bills: Bill[];
  billPayments?: BillPayment[];
  billMonthlyAmounts?: BillMonthlyAmount[];
  allCategories: Category[];
  onAdd: () => void;
  onEdit: (bill: Bill) => void;
  onDelete: (billId: string) => void;
  onPayBill?: (bill: Bill, nextDueDate: Date, customAmount?: number) => void;
  onSetMonthlyAmount?: (billId: string, year: number, month: number, amount: number) => Promise<void>;
  onRemoveMonthlyAmount?: (billId: string, year: number, month: number) => Promise<void>;
  onToggleStatus?: (bill: Bill) => void;
}

type FilterType = 'all' | 'pending' | 'overdue' | 'paid' | 'inactive';

const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const getCategoryColor = (categoryId: string) => {
  switch (categoryId) {
    case 'bills':
    case 'utilities':
      return 'bg-amber-500/15 border-amber-500/30 text-amber-400';
    case 'housing':
      return 'bg-blue-500/15 border-blue-500/30 text-blue-400';
    case 'transportation':
      return 'bg-indigo-500/15 border-indigo-500/30 text-indigo-400';
    case 'food':
      return 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400';
    case 'entertainment':
      return 'bg-pink-500/15 border-pink-500/30 text-pink-400';
    case 'health':
      return 'bg-rose-500/15 border-rose-500/30 text-rose-400';
    case 'education':
      return 'bg-teal-500/15 border-teal-500/30 text-teal-400';
    default:
      return 'bg-slate-700/40 border-white/10 text-slate-300';
  }
};

const BillsManagement: React.FC<BillsManagementProps> = ({
  bills,
  billPayments = [],
  billMonthlyAmounts = [],
  allCategories,
  onAdd,
  onEdit,
  onDelete,
  onPayBill,
  onSetMonthlyAmount,
  onRemoveMonthlyAmount,
  onToggleStatus,
}) => {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getUTCFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getUTCMonth());
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // State for the "Set Real Amount" modal
  const [modalData, setModalData] = useState<{
    bill: Bill;
    currentRealAmount: number | null;
  } | null>(null);
  const [inputRealAmount, setInputRealAmount] = useState('');
  const [isSavingRealAmount, setIsSavingRealAmount] = useState(false);

  // Today in UTC for accurate day calculations
  const todayUTC = useMemo(() => {
    const d = new Date();
    return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  }, []);

  const isCurrentMonth = selectedYear === now.getUTCFullYear() && selectedMonth === now.getUTCMonth();

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((prev) => prev - 1);
    } else {
      setSelectedMonth((prev) => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((prev) => prev + 1);
    } else {
      setSelectedMonth((prev) => prev + 1);
    }
  };

  const handleResetToCurrentMonth = () => {
    setSelectedYear(now.getUTCFullYear());
    setSelectedMonth(now.getUTCMonth());
  };

  const monthLabel = useMemo(() => {
    const d = new Date(Date.UTC(selectedYear, selectedMonth, 1));
    const monthName = d.toLocaleDateString('pt-BR', { month: 'long', timeZone: 'UTC' });
    return `${monthName.charAt(0).toUpperCase() + monthName.slice(1)} de ${selectedYear}`;
  }, [selectedYear, selectedMonth]);

  // Open modal to set real amount
  const handleOpenSetAmountModal = (bill: Bill, currentRealAmount: number | null) => {
    setModalData({ bill, currentRealAmount });
    setInputRealAmount(currentRealAmount !== null ? String(currentRealAmount) : String(bill.estimatedAmount));
  };

  const handleCloseSetAmountModal = () => {
    setModalData(null);
    setInputRealAmount('');
    setIsSavingRealAmount(false);
  };

  const handleSaveRealAmount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalData || !onSetMonthlyAmount) return;

    const numAmount = parseFloat(inputRealAmount.replace(',', '.'));
    if (isNaN(numAmount) || numAmount <= 0) return;

    setIsSavingRealAmount(true);
    try {
      await onSetMonthlyAmount(modalData.bill.id, selectedYear, selectedMonth, numAmount);
      handleCloseSetAmountModal();
    } catch (err) {
      console.error('Erro ao salvar valor real da fatura:', err);
    } finally {
      setIsSavingRealAmount(false);
    }
  };

  const handleResetRealAmount = async () => {
    if (!modalData || !onRemoveMonthlyAmount) return;
    setIsSavingRealAmount(true);
    try {
      await onRemoveMonthlyAmount(modalData.bill.id, selectedYear, selectedMonth);
      handleCloseSetAmountModal();
    } catch (err) {
      console.error('Erro ao remover valor real da fatura:', err);
    } finally {
      setIsSavingRealAmount(false);
    }
  };

  // Compute status for all bills for the selected month
  const processedBills = useMemo(() => {
    const maxDays = new Date(Date.UTC(selectedYear, selectedMonth + 1, 0)).getUTCDate();

    return bills.map((bill) => {
      const effectiveDueDay = Math.min(bill.dueDay, maxDays);
      const dueDate = new Date(Date.UTC(selectedYear, selectedMonth, effectiveDueDay));

      const payment = billPayments.find(
        (p) => p.billId === bill.id && p.year === selectedYear && p.month === selectedMonth
      );
      const isPaid = !!payment;

      const monthlyOverride = billMonthlyAmounts.find(
        (m) => m.billId === bill.id && m.year === selectedYear && m.month === selectedMonth
      );

      // Real amount preference: monthly override first, then payment amount, then null
      const realAmount = monthlyOverride?.amount ?? (payment?.amount ?? null);
      const hasRealAmount = realAmount !== null;
      const effectiveAmount = hasRealAmount ? realAmount : bill.estimatedAmount;
      const difference = hasRealAmount ? realAmount - bill.estimatedAmount : 0;

      const diffTime = dueDate.getTime() - todayUTC.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      let urgency: 'paid' | 'overdue' | 'due_today' | 'due_soon' | 'upcoming' | 'inactive';

      if (bill.status === 'inactive') {
        urgency = 'inactive';
      } else if (isPaid) {
        urgency = 'paid';
      } else if (diffDays < 0) {
        urgency = 'overdue';
      } else if (diffDays === 0) {
        urgency = 'due_today';
      } else if (diffDays <= 3) {
        urgency = 'due_soon';
      } else {
        urgency = 'upcoming';
      }

      return {
        ...bill,
        effectiveDueDay,
        dueDate,
        isPaid,
        diffDays,
        urgency,
        realAmount,
        hasRealAmount,
        effectiveAmount,
        difference,
      };
    }).sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
      return a.dueDay - b.dueDay;
    });
  }, [bills, billPayments, billMonthlyAmounts, selectedYear, selectedMonth, todayUTC]);

  // Summary Metrics
  const stats = useMemo(() => {
    const activeBills = processedBills.filter((b) => b.status === 'active');
    const totalEstimated = activeBills.reduce((acc, b) => acc + b.estimatedAmount, 0);
    const totalEffective = activeBills.reduce((acc, b) => acc + b.effectiveAmount, 0);
    const paidBills = activeBills.filter((b) => b.isPaid);
    const totalPaid = paidBills.reduce((acc, b) => acc + b.effectiveAmount, 0);
    const pendingBills = activeBills.filter((b) => !b.isPaid);
    const totalPending = pendingBills.reduce((acc, b) => acc + b.effectiveAmount, 0);
    const overdueBills = activeBills.filter((b) => b.urgency === 'overdue');
    const percentPaid = totalEffective > 0 ? Math.round((totalPaid / totalEffective) * 100) : 0;
    const diffTotal = totalEffective - totalEstimated;

    return {
      totalEstimated,
      totalEffective,
      totalPaid,
      totalPending,
      percentPaid,
      diffTotal,
      totalCount: bills.length,
      activeCount: activeBills.length,
      paidCount: paidBills.length,
      pendingCount: pendingBills.length,
      overdueCount: overdueBills.length,
    };
  }, [processedBills, bills.length]);

  // Filtered Bills
  const filteredBills = useMemo(() => {
    return processedBills.filter((b) => {
      if (filterType === 'pending' && (b.isPaid || b.status === 'inactive')) return false;
      if (filterType === 'overdue' && (b.urgency !== 'overdue' || b.status === 'inactive')) return false;
      if (filterType === 'paid' && !b.isPaid) return false;
      if (filterType === 'inactive' && b.status !== 'inactive') return false;

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const categoryName = allCategories.find((c) => c.id === b.category)?.name?.toLowerCase() || '';
        return b.name.toLowerCase().includes(query) || categoryName.includes(query);
      }

      return true;
    });
  }, [processedBills, filterType, searchQuery, allCategories]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Contas a Pagar</h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
              {stats.activeCount} ativas
            </span>
          </div>
          <p className="text-sm text-slate-400 mt-0.5">
            Gerencie vencimentos, compare valor projetado vs real e registre pagamentos mensais
          </p>
        </div>

        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl transition-all duration-200 font-semibold text-sm shadow-lg shadow-blue-500/25 active:scale-95"
        >
          <i className="fa-solid fa-plus text-xs"></i>
          <span>Nova Conta</span>
        </button>
      </div>

      {/* Month Navigator & Summary Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Month Selector Card */}
        <div className="bg-slate-900/80 border border-white/[0.08] rounded-2xl p-4 flex flex-col justify-between shadow-xl">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Período de Referência</span>
            {!isCurrentMonth && (
              <button
                onClick={handleResetToCurrentMonth}
                className="text-[11px] text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1 transition-colors"
              >
                <i className="fa-solid fa-rotate-left text-[10px]"></i>
                <span>Hoje</span>
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 py-1">
            <button
              onClick={handlePrevMonth}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors border border-white/5"
              title="Mês anterior"
            >
              <i className="fa-solid fa-chevron-left text-xs"></i>
            </button>

            <span className="font-extrabold text-white text-base sm:text-lg text-center truncate">
              {monthLabel}
            </span>

            <button
              onClick={handleNextMonth}
              className="w-8 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors border border-white/5"
              title="Próximo mês"
            >
              <i className="fa-solid fa-chevron-right text-xs"></i>
            </button>
          </div>

          <div className="mt-3 pt-3 border-t border-white/[0.06] flex justify-between items-center text-xs text-slate-400">
            <span>Progresso do mês:</span>
            <span className="font-bold text-white tabular-nums">{stats.percentPaid}% pago</span>
          </div>
        </div>

        {/* Total Month (Effective Amount) */}
        <div className="bg-slate-900/60 border border-white/[0.06] rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total do Mês</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-xs">
              <i className="fa-solid fa-calculator"></i>
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold text-white tabular-nums">
              {formatCurrency(stats.totalEffective)}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-0.5 flex-wrap">
              <span>Projetado: {formatCurrency(stats.totalEstimated)}</span>
              {stats.diffTotal !== 0 && (
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    stats.diffTotal > 0
                      ? 'bg-amber-500/15 text-amber-300'
                      : 'bg-emerald-500/15 text-emerald-300'
                  }`}
                >
                  {stats.diffTotal > 0 ? '+' : ''}
                  {formatCurrency(stats.diffTotal)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Total Paid */}
        <div className="bg-slate-900/60 border border-white/[0.06] rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Já Pago</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">
              <i className="fa-solid fa-check-double"></i>
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold text-emerald-400 tabular-nums">
              {formatCurrency(stats.totalPaid)}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="flex-1 bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${stats.percentPaid}%` }}
                ></div>
              </div>
              <span className="text-[11px] font-bold text-slate-400 tabular-nums">{stats.paidCount}/{stats.activeCount}</span>
            </div>
          </div>
        </div>

        {/* Total Pending / Overdue */}
        <div className={`bg-slate-900/60 border rounded-2xl p-4 shadow-lg flex flex-col justify-between ${
          stats.overdueCount > 0 ? 'border-rose-500/30 bg-rose-950/10' : 'border-white/[0.06]'
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Restante a Pagar</span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs border ${
              stats.overdueCount > 0
                ? 'bg-rose-500/15 border-rose-500/30 text-rose-400 animate-pulse'
                : 'bg-amber-500/10 border-amber-500/20 text-amber-400'
            }`}>
              <i className={stats.overdueCount > 0 ? 'fa-solid fa-triangle-exclamation' : 'fa-solid fa-clock'}></i>
            </div>
          </div>
          <div className="mt-2">
            <div className={`text-xl sm:text-2xl font-extrabold tabular-nums ${
              stats.overdueCount > 0 ? 'text-rose-400' : 'text-slate-100'
            }`}>
              {formatCurrency(stats.totalPending)}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              {stats.overdueCount > 0 ? (
                <span className="text-rose-400 font-bold flex items-center gap-1">
                  <i className="fa-solid fa-circle-exclamation text-[10px]"></i>
                  {stats.overdueCount} conta(s) em atraso!
                </span>
              ) : (
                `${stats.pendingCount} pendente(s) no mês`
              )}
            </p>
          </div>
        </div>
      </div>

      {/* Filter Bar & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 bg-slate-900/40 p-2 sm:p-2.5 rounded-2xl border border-white/[0.05]">
        {/* Quick Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 custom-scrollbar">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filterType === 'all'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            <span>Todas</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{processedBills.length}</span>
          </button>

          <button
            onClick={() => setFilterType('pending')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filterType === 'pending'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-600/25'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            <i className="fa-solid fa-clock text-[10px]"></i>
            <span>Pendentes</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{stats.pendingCount}</span>
          </button>

          {stats.overdueCount > 0 && (
            <button
              onClick={() => setFilterType('overdue')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                filterType === 'overdue'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-600/25'
                  : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30'
              }`}
            >
              <i className="fa-solid fa-triangle-exclamation text-[10px]"></i>
              <span>Vencidas</span>
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-rose-900/60 font-extrabold">
                {stats.overdueCount}
              </span>
            </button>
          )}

          <button
            onClick={() => setFilterType('paid')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filterType === 'paid'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/25'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            <i className="fa-solid fa-check text-[10px]"></i>
            <span>Pagas</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-white/20">{stats.paidCount}</span>
          </button>

          <button
            onClick={() => setFilterType('inactive')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5 ${
              filterType === 'inactive'
                ? 'bg-slate-700 text-white shadow-md'
                : 'bg-slate-800/80 hover:bg-slate-800 text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            <span>Pausadas</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative min-w-[200px] sm:min-w-[240px]">
          <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar conta..."
            className="w-full bg-slate-800/90 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-white placeholder-slate-500 text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>
      </div>

      {/* Bills Cards List */}
      {filteredBills.length > 0 ? (
        <div className="space-y-3">
          {filteredBills.map((bill) => {
            const category = allCategories.find((c) => c.id === bill.category);
            const categoryStyle = getCategoryColor(bill.category);

            return (
              <div
                key={bill.id}
                className={`group bg-slate-900/60 hover:bg-slate-800/80 p-4 rounded-2xl border transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg ${
                  bill.status === 'inactive'
                    ? 'opacity-50 border-white/[0.04]'
                    : bill.urgency === 'overdue'
                    ? 'border-rose-500/30 bg-rose-950/10 hover:border-rose-500/50'
                    : bill.urgency === 'due_today'
                    ? 'border-amber-500/40 bg-amber-950/10'
                    : bill.isPaid
                    ? 'border-white/[0.05] hover:border-emerald-500/30'
                    : 'border-white/[0.06] hover:border-white/[0.14]'
                }`}
              >
                {/* Left side: Due date badge, Icon & Details */}
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {/* Due Day Number Badge */}
                  <div className="w-12 h-12 rounded-xl bg-slate-800/90 border border-white/10 flex flex-col items-center justify-center flex-shrink-0 text-center shadow-inner">
                    <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Dia</span>
                    <span className="text-base font-extrabold text-white leading-none tabular-nums">
                      {bill.dueDay}
                    </span>
                  </div>

                  {/* Category Icon */}
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm flex-shrink-0 border shadow-sm ${categoryStyle}`}>
                    <i className={category?.icon || 'fa-solid fa-file-invoice-dollar'}></i>
                  </div>

                  {/* Name, Category & Status Tag */}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold text-sm text-slate-100 group-hover:text-white transition-colors truncate">
                        {bill.name}
                      </p>

                      {/* Status Badges */}
                      {bill.status === 'inactive' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-800 text-slate-400 border border-white/10">
                          <i className="fa-solid fa-pause text-[8px]"></i>
                          <span>Pausada</span>
                        </span>
                      ) : bill.isPaid ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                          <i className="fa-solid fa-check text-[9px]"></i>
                          <span>Pago neste mês</span>
                        </span>
                      ) : bill.urgency === 'overdue' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                          <i className="fa-solid fa-triangle-exclamation text-[9px]"></i>
                          <span>Venceu há {Math.abs(bill.diffDays)} dia(s)</span>
                        </span>
                      ) : bill.urgency === 'due_today' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                          <i className="fa-solid fa-bolt text-[9px]"></i>
                          <span>Vence Hoje!</span>
                        </span>
                      ) : bill.urgency === 'due_soon' ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                          <i className="fa-solid fa-clock text-[9px]"></i>
                          <span>Vence em {bill.diffDays} dia(s)</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <i className="fa-solid fa-calendar-day text-[9px]"></i>
                          <span>A vencer em {bill.dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' })}</span>
                        </span>
                      )}
                    </div>

                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                      <span className="text-slate-300 font-medium">{category?.name || 'Contas e Despesas'}</span>
                      <span className="text-slate-600">•</span>
                      <span>Vencimento no mês: {bill.dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', timeZone: 'UTC' })}</span>
                    </p>
                  </div>
                </div>

                {/* Right side: Amount and Actions */}
                <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 flex-shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/[0.05]">
                  {/* Amount Block: Projected vs Real */}
                  <div className="text-left sm:text-right">
                    <div className="flex items-center gap-1.5 sm:justify-end">
                      <p className="font-extrabold text-base sm:text-lg text-slate-100 tabular-nums">
                        {formatCurrency(bill.effectiveAmount)}
                      </p>

                      {/* Button to edit/set real amount */}
                      <button
                        onClick={() => handleOpenSetAmountModal(bill, bill.realAmount)}
                        className="w-6 h-6 rounded-md bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-blue-400 flex items-center justify-center text-[10px] transition-colors border border-white/5"
                        title={bill.hasRealAmount ? 'Alterar valor real da fatura deste mês' : 'Informar valor real da fatura deste mês'}
                      >
                        <i className="fa-solid fa-pencil"></i>
                      </button>
                    </div>

                    {/* Labels and comparison badges */}
                    {bill.hasRealAmount ? (
                      <div className="flex items-center gap-1 sm:justify-end flex-wrap text-[10px]">
                        <span className="text-blue-400 font-semibold">Valor Real</span>
                        <span className="text-slate-600">•</span>
                        <span className="text-slate-400">Projetado: {formatCurrency(bill.estimatedAmount)}</span>
                        {bill.difference !== 0 && (
                          <span
                            className={`font-bold px-1 rounded ${
                              bill.difference > 0
                                ? 'text-amber-400 bg-amber-500/10'
                                : 'text-emerald-400 bg-emerald-500/10'
                            }`}
                          >
                            {bill.difference > 0 ? '+' : ''}
                            {formatCurrency(bill.difference)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 sm:justify-end">
                        <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                          Valor Projetado
                        </span>
                        <button
                          onClick={() => handleOpenSetAmountModal(bill, null)}
                          className="text-[10px] text-blue-400 hover:text-blue-300 underline font-medium transition-colors ml-1"
                        >
                          Ajustar mês
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Pay Button / Paid Status */}
                    {onPayBill && (
                      bill.isPaid ? (
                        <button
                          onClick={() => onPayBill(bill, bill.dueDate, bill.effectiveAmount)}
                          className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-white/10 transition-colors flex items-center gap-1.5"
                          title="Registrar outro pagamento para esta conta"
                        >
                          <i className="fa-solid fa-check text-emerald-400"></i>
                          <span>Pago</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onPayBill(bill, bill.dueDate, bill.effectiveAmount)}
                          disabled={bill.status === 'inactive'}
                          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-30 disabled:cursor-not-allowed text-white text-xs font-bold transition-all shadow-md shadow-emerald-600/20 active:scale-95 flex items-center gap-1.5"
                        >
                          <i className="fa-solid fa-receipt text-[11px]"></i>
                          <span>Pagar</span>
                        </button>
                      )
                    )}

                    {/* Status Toggle Button (Active / Pause) */}
                    {onToggleStatus && (
                      <button
                        onClick={() => onToggleStatus(bill)}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs transition-all border ${
                          bill.status === 'active'
                            ? 'bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-amber-400 border-white/[0.06]'
                            : 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/30'
                        }`}
                        title={bill.status === 'active' ? 'Pausar conta' : 'Reativar conta'}
                      >
                        <i className={bill.status === 'active' ? 'fa-solid fa-pause' : 'fa-solid fa-play'}></i>
                      </button>
                    )}

                    {/* Edit Bill Baseline */}
                    <button
                      onClick={() => onEdit(bill)}
                      className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all flex items-center justify-center text-xs border border-white/[0.06]"
                      title="Editar cadastro da conta"
                    >
                      <i className="fa-solid fa-gear"></i>
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => onDelete(bill.id)}
                      className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition-all flex items-center justify-center text-xs border border-white/[0.06]"
                      title="Excluir conta"
                    >
                      <i className="fa-solid fa-trash"></i>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-16 px-4 bg-slate-900/40 border border-white/[0.05] rounded-3xl">
          <div className="w-16 h-16 rounded-3xl bg-slate-800/80 border border-white/10 flex items-center justify-center text-slate-500 mx-auto mb-4 text-2xl shadow-inner">
            <i className="fa-solid fa-file-invoice-dollar"></i>
          </div>
          <h3 className="text-lg font-bold text-white mb-1">
            {bills.length === 0
              ? 'Nenhuma conta cadastrada'
              : 'Nenhuma conta encontrada com os filtros selecionados'}
          </h3>
          <p className="text-slate-400 text-xs max-w-sm mx-auto mb-5">
            {bills.length === 0
              ? 'Cadastre contas recorrentes como luz, água, internet e aluguel para não esquecer de nenhum vencimento.'
              : 'Tente alterar os filtros de status ou a busca para visualizar suas contas.'}
          </p>
          {bills.length === 0 && (
            <button
              onClick={onAdd}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-blue-500/25"
            >
              <i className="fa-solid fa-plus text-xs"></i>
              <span>Adicionar Primeira Conta</span>
            </button>
          )}
        </div>
      )}

      {/* Modal: Set Real Monthly Amount */}
      {modalData && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-150">
          <div
            className="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-5 border-b border-white/[0.08] flex items-center justify-between bg-slate-800/40">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center text-base">
                  <i className="fa-solid fa-receipt"></i>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">Valor Real da Fatura</h2>
                  <p className="text-xs text-slate-400">{modalData.bill.name} • {monthLabel}</p>
                </div>
              </div>
              <button
                onClick={handleCloseSetAmountModal}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors flex items-center justify-center text-sm border border-white/5"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveRealAmount} className="p-6 space-y-4">
              {/* Baseline Comparison Card */}
              <div className="bg-slate-800/50 border border-white/[0.06] rounded-2xl p-3.5 flex items-center justify-between text-xs">
                <span className="text-slate-400">Valor Projetado Base:</span>
                <span className="font-extrabold text-white tabular-nums">
                  {formatCurrency(modalData.bill.estimatedAmount)}
                </span>
              </div>

              {/* Real Amount Input */}
              <div className="bg-slate-800/80 border border-white/10 rounded-2xl p-4 text-center">
                <label
                  htmlFor="realAmountInput"
                  className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1"
                >
                  Valor da Fatura de {monthLabel}
                </label>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl font-bold text-blue-400">R$</span>
                  <input
                    id="realAmountInput"
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={inputRealAmount}
                    onChange={(e) => setInputRealAmount(e.target.value)}
                    placeholder="0,00"
                    className="bg-transparent text-3xl font-extrabold text-white text-center focus:outline-none w-44 tabular-nums placeholder-slate-600"
                    required
                    autoFocus
                  />
                </div>

                {/* Live difference preview */}
                {inputRealAmount && !isNaN(parseFloat(inputRealAmount.replace(',', '.'))) && (
                  <div className="mt-2 text-xs font-semibold">
                    {(() => {
                      const val = parseFloat(inputRealAmount.replace(',', '.'));
                      const diff = val - modalData.bill.estimatedAmount;
                      if (diff === 0) return <span className="text-slate-400">Igual ao valor projetado</span>;
                      if (diff > 0)
                        return (
                          <span className="text-amber-400">
                            +{formatCurrency(diff)} (+{Math.round((diff / modalData.bill.estimatedAmount) * 100)}%) que o projetado
                          </span>
                        );
                      return (
                        <span className="text-emerald-400">
                          -{formatCurrency(Math.abs(diff))} (-{Math.round((Math.abs(diff) / modalData.bill.estimatedAmount) * 100)}%) economia!
                        </span>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-col sm:flex-row items-center justify-end gap-2 border-t border-white/[0.08]">
                {modalData.currentRealAmount !== null && (
                  <button
                    type="button"
                    onClick={handleResetRealAmount}
                    disabled={isSavingRealAmount}
                    className="w-full sm:w-auto px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-rose-400 rounded-xl text-xs font-semibold transition-colors border border-white/5 mr-auto"
                    title="Remover valor personalizado e voltar ao projetado"
                  >
                    Redefinir ao Projetado
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCloseSetAmountModal}
                  disabled={isSavingRealAmount}
                  className="w-full sm:w-auto px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-colors border border-white/5"
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  disabled={isSavingRealAmount}
                  className="w-full sm:w-auto px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-blue-600/25 active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <i className="fa-solid fa-check text-xs"></i>
                  <span>{isSavingRealAmount ? 'Salvando...' : 'Salvar Valor Real'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default BillsManagement;