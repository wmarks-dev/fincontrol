import React, { useState, useMemo } from 'react';
import { Bill, BillPayment, Category } from '../types';

interface BillsManagementProps {
  bills: Bill[];
  billPayments?: BillPayment[];
  allCategories: Category[];
  onAdd: () => void;
  onEdit: (bill: Bill) => void;
  onDelete: (billId: string) => void;
  onPayBill?: (bill: Bill, nextDueDate: Date) => void;
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
  allCategories,
  onAdd,
  onEdit,
  onDelete,
  onPayBill,
  onToggleStatus,
}) => {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getUTCFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getUTCMonth());
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');

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

  // Compute status for all bills for the selected month
  const processedBills = useMemo(() => {
    const maxDays = new Date(Date.UTC(selectedYear, selectedMonth + 1, 0)).getUTCDate();

    return bills.map((bill) => {
      const effectiveDueDay = Math.min(bill.dueDay, maxDays);
      const dueDate = new Date(Date.UTC(selectedYear, selectedMonth, effectiveDueDay));
      const isPaid = billPayments.some(
        (p) => p.billId === bill.id && p.year === selectedYear && p.month === selectedMonth
      );

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
      };
    }).sort((a, b) => {
      // Sort: active first, then unpaid first, then by dueDay
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      if (a.isPaid !== b.isPaid) return a.isPaid ? 1 : -1;
      return a.dueDay - b.dueDay;
    });
  }, [bills, billPayments, selectedYear, selectedMonth, todayUTC]);

  // Summary Metrics
  const stats = useMemo(() => {
    const activeBills = processedBills.filter((b) => b.status === 'active');
    const totalEstimated = activeBills.reduce((acc, b) => acc + b.estimatedAmount, 0);
    const paidBills = activeBills.filter((b) => b.isPaid);
    const totalPaid = paidBills.reduce((acc, b) => acc + b.estimatedAmount, 0);
    const pendingBills = activeBills.filter((b) => !b.isPaid);
    const totalPending = pendingBills.reduce((acc, b) => acc + b.estimatedAmount, 0);
    const overdueBills = activeBills.filter((b) => b.urgency === 'overdue');
    const percentPaid = totalEstimated > 0 ? Math.round((totalPaid / totalEstimated) * 100) : 0;

    return {
      totalEstimated,
      totalPaid,
      totalPending,
      percentPaid,
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
            Acompanhe o vencimento de contas fixas, assinaturas e despesas mensais
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

        {/* Total Estimated */}
        <div className="bg-slate-900/60 border border-white/[0.06] rounded-2xl p-4 shadow-lg flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Total do Mês</span>
            <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-xs">
              <i className="fa-solid fa-calculator"></i>
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl sm:text-2xl font-extrabold text-white tabular-nums">
              {formatCurrency(stats.totalEstimated)}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">{stats.activeCount} contas ativas previstas</p>
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
                  <div className="text-left sm:text-right">
                    <p className="font-extrabold text-base sm:text-lg text-slate-100 tabular-nums">
                      {formatCurrency(bill.estimatedAmount)}
                    </p>
                    <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                      Valor Estimado
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Pay Button / Paid Status */}
                    {onPayBill && (
                      bill.isPaid ? (
                        <button
                          onClick={() => onPayBill(bill, bill.dueDate)}
                          className="px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-white/10 transition-colors flex items-center gap-1.5"
                          title="Registrar outro pagamento para esta conta"
                        >
                          <i className="fa-solid fa-check text-emerald-400"></i>
                          <span>Pago</span>
                        </button>
                      ) : (
                        <button
                          onClick={() => onPayBill(bill, bill.dueDate)}
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

                    {/* Edit */}
                    <button
                      onClick={() => onEdit(bill)}
                      className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all flex items-center justify-center text-xs border border-white/[0.06]"
                      title="Editar conta"
                    >
                      <i className="fa-solid fa-pencil"></i>
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
    </div>
  );
};

export default BillsManagement;