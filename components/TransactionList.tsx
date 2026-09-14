import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, TransactionType, PaymentMethod, Category } from '../types';
import { parseISODateAsUTC } from '../utils/dateUtils';

interface TransactionListProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (transactionId: string) => void;
  allCategories: Category[];
  initialFilters?: { category: string; startDate: string; endDate: string } | null;
  onFiltersApplied?: () => void;
}

const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// Helper for initial start and end of the current month
const getInitialDateFilters = () => {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();

  const firstDay = new Date(Date.UTC(year, month, 1));
  const lastDay = new Date(Date.UTC(year, month + 1, 0));

  return {
    startDate: firstDay.toISOString().split('T')[0],
    endDate: lastDay.toISOString().split('T')[0],
  };
};

const getDayLabel = (dateStr: string) => {
  const dateUTC = parseISODateAsUTC(dateStr);
  if (isNaN(dateUTC.getTime())) return dateStr;

  const today = new Date();
  const todayUTC = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  const yesterdayUTC = new Date(todayUTC);
  yesterdayUTC.setUTCDate(yesterdayUTC.getUTCDate() - 1);

  const txDateOnly = new Date(Date.UTC(dateUTC.getUTCFullYear(), dateUTC.getUTCMonth(), dateUTC.getUTCDate()));

  if (txDateOnly.getTime() === todayUTC.getTime()) {
    return 'Hoje';
  }
  if (txDateOnly.getTime() === yesterdayUTC.getTime()) {
    return 'Ontem';
  }

  const weekday = txDateOnly.toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' });
  const dayMonth = txDateOnly.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric', timeZone: 'UTC' });
  return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${dayMonth}`;
};

interface TransactionItemProps {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transactionId: string) => void;
  allCategories: Category[];
}

const TransactionItem: React.FC<TransactionItemProps> = ({
  transaction,
  onEdit,
  onDelete,
  allCategories,
}) => {
  const category = allCategories.find((c) => c.id === transaction.category);
  const isIncome = transaction.type === TransactionType.INCOME;
  const canBeEdited = !transaction.installmentId && !transaction.recurringId;

  return (
    <div className="group bg-slate-900/60 hover:bg-slate-800/80 p-3.5 sm:p-4 rounded-2xl border border-white/[0.05] hover:border-white/[0.12] transition-all duration-200 flex items-center justify-between gap-3">
      {/* Left side: Category Icon & Details */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div
          className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm flex-shrink-0 border shadow-sm ${
            isIncome
              ? 'bg-emerald-500/15 border-emerald-500/25 text-emerald-400'
              : 'bg-blue-500/10 border-blue-500/20 text-blue-400'
          }`}
        >
          <i className={category?.icon || (isIncome ? 'fa-solid fa-sack-dollar' : 'fa-solid fa-tag')}></i>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-bold text-sm text-slate-100 truncate group-hover:text-white transition-colors">
              {transaction.description}
            </p>

            {/* Recurring Tag */}
            {transaction.recurringId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/15 text-blue-400 border border-blue-500/30">
                <i className="fa-solid fa-repeat text-[9px]"></i>
                <span>Recorrente</span>
              </span>
            )}

            {/* Installment Tag */}
            {transaction.installmentId && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                <i className="fa-solid fa-layer-group text-[9px]"></i>
                <span>Parcelada</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 flex-wrap">
            <span className="font-medium text-slate-300">{category?.name || 'Sem categoria'}</span>
            {!isIncome && transaction.paymentMethod && (
              <>
                <span className="text-slate-600">•</span>
                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                  <i
                    className={`fa-solid ${
                      transaction.paymentMethod === PaymentMethod.CREDIT_CARD
                        ? 'fa-credit-card text-amber-400/80'
                        : transaction.paymentMethod === PaymentMethod.DEBIT
                        ? 'fa-money-check text-blue-400/80'
                        : 'fa-money-bill-wave text-emerald-400/80'
                    }`}
                  ></i>
                  {transaction.paymentMethod}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right side: Amount and Action Buttons */}
      <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
        <div className="text-right">
          <p
            className={`font-extrabold text-sm sm:text-base tabular-nums ${
              isIncome ? 'text-emerald-400' : 'text-slate-200'
            }`}
          >
            {isIncome ? '+' : '-'} {formatCurrency(transaction.amount)}
          </p>
          <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
            {isIncome ? 'Entrada' : 'Saída'}
          </span>
        </div>

        <div className="flex items-center gap-1 sm:opacity-75 sm:group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onEdit(transaction)}
            disabled={!canBeEdited}
            className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center justify-center text-xs border border-white/[0.06]"
            title={!canBeEdited ? 'Não é possível editar transações parceladas ou recorrentes' : 'Editar transação'}
            aria-label="Editar"
          >
            <i className="fa-solid fa-pencil"></i>
          </button>
          <button
            onClick={() => onDelete(transaction.id)}
            className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition-all flex items-center justify-center text-xs border border-white/[0.06]"
            title="Excluir transação"
            aria-label="Excluir"
          >
            <i className="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>
    </div>
  );
};

const TransactionList: React.FC<TransactionListProps> = ({
  transactions,
  onEdit,
  onDelete,
  allCategories,
  initialFilters,
  onFiltersApplied,
}) => {
  const [isFilterVisible, setIsFilterVisible] = useState(false);
  const [quickFilter, setQuickFilter] = useState<'all' | 'income' | 'expense' | 'creditCard' | 'cash'>('all');

  const [filters, setFilters] = useState({
    description: '',
    type: '',
    category: '',
    paymentMethod: '',
    ...getInitialDateFilters(),
  });

  useEffect(() => {
    if (initialFilters && onFiltersApplied) {
      setFilters({
        description: '',
        type: '',
        paymentMethod: '',
        category: initialFilters.category,
        startDate: initialFilters.startDate,
        endDate: initialFilters.endDate,
      });
      setIsFilterVisible(true);
      onFiltersApplied();
    }
  }, [initialFilters, onFiltersApplied]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters((prev) => {
      const updated = { ...prev, [name]: value };
      if (name === 'type' && value === TransactionType.INCOME && updated.paymentMethod === PaymentMethod.CREDIT_CARD) {
        updated.paymentMethod = '';
      }
      return updated;
    });
  };

  const handleQuickFilter = (type: 'all' | 'income' | 'expense' | 'creditCard' | 'cash') => {
    setQuickFilter(type);
    if (type === 'all') {
      setFilters((prev) => ({ ...prev, type: '', paymentMethod: '' }));
    } else if (type === 'income') {
      setFilters((prev) => ({ ...prev, type: TransactionType.INCOME, paymentMethod: '' }));
    } else if (type === 'expense') {
      setFilters((prev) => ({ ...prev, type: TransactionType.EXPENSE, paymentMethod: '' }));
    } else if (type === 'creditCard') {
      setFilters((prev) => ({ ...prev, type: TransactionType.EXPENSE, paymentMethod: PaymentMethod.CREDIT_CARD }));
    } else if (type === 'cash') {
      setFilters((prev) => ({ ...prev, type: '', paymentMethod: PaymentMethod.CASH }));
    }
  };

  const resetFilters = () => {
    setQuickFilter('all');
    setFilters({
      description: '',
      type: '',
      category: '',
      paymentMethod: '',
      ...getInitialDateFilters(),
    });
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter((t) => {
      const transactionDate = parseISODateAsUTC(t.date);
      const startDate = filters.startDate ? parseISODateAsUTC(filters.startDate) : null;
      const endDate = filters.endDate ? parseISODateAsUTC(filters.endDate) : null;

      if (isNaN(transactionDate.getTime())) return false;

      if (filters.description && !t.description.toLowerCase().includes(filters.description.toLowerCase())) {
        return false;
      }
      if (filters.type && t.type !== filters.type) {
        return false;
      }
      if (filters.category && t.category !== filters.category) {
        return false;
      }
      if (filters.paymentMethod && t.paymentMethod !== filters.paymentMethod) {
        return false;
      }
      if (startDate && transactionDate < startDate) {
        return false;
      }
      if (endDate && transactionDate > endDate) {
        return false;
      }
      return true;
    });
  }, [transactions, filters]);

  // Mini-dashboard stats for the filtered period
  const { totalIncome, totalExpense, netBalance } = useMemo(() => {
    let inc = 0;
    let exp = 0;
    filteredTransactions.forEach((t) => {
      if (t.type === TransactionType.INCOME) inc += t.amount;
      else exp += t.amount;
    });
    return {
      totalIncome: inc,
      totalExpense: exp,
      netBalance: inc - exp,
    };
  }, [filteredTransactions]);

  // Grouped by day for a modern timeline
  const groupedTransactions = useMemo(() => {
    const groups: {
      dateKey: string;
      label: string;
      transactions: Transaction[];
      dayTotal: number;
    }[] = [];
    const map = new Map<string, (typeof groups)[0]>();

    const sorted = [...filteredTransactions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    sorted.forEach((t) => {
      const key = t.date.split('T')[0];
      if (!map.has(key)) {
        const groupItem = {
          dateKey: key,
          label: getDayLabel(key),
          transactions: [],
          dayTotal: 0,
        };
        map.set(key, groupItem);
        groups.push(groupItem);
      }
      const g = map.get(key)!;
      g.transactions.push(t);
      const sign = t.type === TransactionType.INCOME ? t.amount : -t.amount;
      g.dayTotal += sign;
    });

    return groups;
  }, [filteredTransactions]);

  const uniqueCategories = useMemo(() => {
    const categoryIds = new Set(transactions.map((t) => t.category));
    return allCategories.filter((c) => categoryIds.has(c.id));
  }, [transactions, allCategories]);

  const uniquePaymentMethods = useMemo(() => {
    let relevantTxs = transactions;
    if (filters.type === TransactionType.INCOME) {
      relevantTxs = transactions.filter((t) => t.type === TransactionType.INCOME);
    }
    const methods = new Set(relevantTxs.map((t) => t.paymentMethod).filter(Boolean));
    if (filters.type === TransactionType.INCOME) {
      methods.delete(PaymentMethod.CREDIT_CARD);
    }
    return Array.from(methods) as PaymentMethod[];
  }, [transactions, filters.type]);

  // CSV Export utility
  const handleExportCSV = () => {
    const headers = ['Data', 'Tipo', 'Descrição', 'Categoria', 'Forma de Pagamento', 'Valor'];
    const rows = filteredTransactions.map((t) => {
      const cat = allCategories.find((c) => c.id === t.category)?.name || t.category;
      const typeLabel = t.type === TransactionType.INCOME ? 'Receita' : 'Despesa';
      const dateFormatted = new Date(t.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
      const formattedAmount = t.amount.toFixed(2).replace('.', ',');
      return [
        `"${dateFormatted}"`,
        `"${typeLabel}"`,
        `"${(t.description || '').replace(/"/g, '""')}"`,
        `"${cat}"`,
        `"${t.type === TransactionType.INCOME ? 'Entrada' : t.paymentMethod || ''}"`,
        `"${formattedAmount}"`,
      ].join(';');
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `extrato-fincontrol-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Extrato Financeiro</h1>
          <p className="text-sm text-slate-400 mt-0.5">Histórico completo e consolidado de movimentações</p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <button
            onClick={handleExportCSV}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs font-semibold border border-white/[0.08]"
            title="Exportar transações filtradas para CSV/Excel"
          >
            <i className="fa-solid fa-file-arrow-down text-xs text-blue-400"></i>
            <span>Exportar CSV</span>
          </button>
          <button
            onClick={() => setIsFilterVisible(!isFilterVisible)}
            className={`flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl transition-all text-xs font-semibold border ${
              isFilterVisible
                ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                : 'bg-slate-800/80 border-white/[0.08] text-slate-300 hover:text-white hover:bg-slate-700'
            }`}
          >
            <i className={`fa-solid ${isFilterVisible ? 'fa-filter-circle-xmark' : 'fa-filter'} text-xs`}></i>
            <span>{isFilterVisible ? 'Ocultar Filtros' : 'Filtros'}</span>
          </button>
        </div>
      </div>

      {/* Mini-Dashboard Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Income Card */}
        <div className="glass-card p-4 rounded-2xl border border-white/[0.06] flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Entradas do Período</p>
            <p className="text-xl sm:text-2xl font-extrabold text-emerald-400 tabular-nums mt-1">
              {formatCurrency(totalIncome)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm">
            <i className="fa-solid fa-arrow-trend-up"></i>
          </div>
        </div>

        {/* Expense Card */}
        <div className="glass-card p-4 rounded-2xl border border-white/[0.06] flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Saídas do Período</p>
            <p className="text-xl sm:text-2xl font-extrabold text-rose-400 tabular-nums mt-1">
              {formatCurrency(totalExpense)}
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center text-sm">
            <i className="fa-solid fa-arrow-trend-down"></i>
          </div>
        </div>

        {/* Net Result Card */}
        <div className="glass-card p-4 rounded-2xl border border-white/[0.06] flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wider">Resultado Líquido</p>
            <p
              className={`text-xl sm:text-2xl font-extrabold tabular-nums mt-1 ${
                netBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}
            >
              {formatCurrency(netBalance)}
            </p>
          </div>
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm border ${
              netBalance >= 0
                ? 'bg-blue-500/10 border-blue-500/20 text-blue-400'
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}
          >
            <i className={`fa-solid ${netBalance >= 0 ? 'fa-scale-balanced' : 'fa-triangle-exclamation'}`}></i>
          </div>
        </div>
      </div>

      {/* Quick Filter Pills & Search Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Quick Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-900/80 rounded-2xl border border-white/[0.06] overflow-x-auto custom-scrollbar">
          {[
            { id: 'all', label: 'Todas', icon: 'fa-layer-group' },
            { id: 'income', label: 'Entradas', icon: 'fa-arrow-trend-up' },
            { id: 'expense', label: 'Saídas', icon: 'fa-arrow-trend-down' },
            { id: 'creditCard', label: 'Cartão', icon: 'fa-credit-card' },
            { id: 'cash', label: 'Dinheiro', icon: 'fa-money-bill-wave' },
          ].map((pill) => {
            const isSelected = quickFilter === pill.id;
            return (
              <button
                key={pill.id}
                onClick={() => handleQuickFilter(pill.id as any)}
                className={`py-1.5 px-3 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 flex-shrink-0 ${
                  isSelected
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25'
                    : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                }`}
              >
                <i className={`fa-solid ${pill.icon} text-[11px]`}></i>
                <span>{pill.label}</span>
              </button>
            );
          })}
        </div>

        {/* Live Search Input */}
        <div className="relative flex-1 md:max-w-xs">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
            <i className="fa-solid fa-magnifying-glass"></i>
          </div>
          <input
            type="text"
            name="description"
            placeholder="Buscar por descrição..."
            value={filters.description}
            onChange={handleFilterChange}
            className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-white text-xs placeholder-slate-500 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
          />
          {filters.description && (
            <button
              onClick={() => setFilters((p) => ({ ...p, description: '' }))}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-white text-xs"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          )}
        </div>
      </div>

      {/* Advanced Collapsible Filter Drawer */}
      {isFilterVisible && (
        <div className="glass-card p-5 rounded-2xl border border-white/[0.08] space-y-4 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex justify-between items-center pb-2 border-b border-white/[0.06]">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
              <i className="fa-solid fa-sliders text-blue-400"></i>
              Filtros Avançados
            </h3>
            <button onClick={resetFilters} className="text-xs text-blue-400 hover:text-blue-300 font-semibold">
              Limpar Todos
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Category Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Categoria
              </label>
              <select
                name="category"
                value={filters.category}
                onChange={handleFilterChange}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todas as Categorias</option>
                {uniqueCategories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Payment Method Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Forma de Pagamento
              </label>
              <select
                name="paymentMethod"
                value={filters.paymentMethod}
                onChange={handleFilterChange}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todos Pagamentos</option>
                {uniquePaymentMethods.map((pm) => (
                  <option key={pm} value={pm}>
                    {pm}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label htmlFor="startDate" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Data Inicial
              </label>
              <input
                id="startDate"
                type="date"
                name="startDate"
                value={filters.startDate}
                onChange={handleFilterChange}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* End Date */}
            <div>
              <label htmlFor="endDate" className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Data Final
              </label>
              <input
                id="endDate"
                type="date"
                name="endDate"
                value={filters.endDate}
                onChange={handleFilterChange}
                className="w-full bg-slate-900/80 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      )}

      {/* Transactions Timeline */}
      {groupedTransactions.length > 0 ? (
        <div className="space-y-6">
          {groupedTransactions.map((group) => (
            <div key={group.dateKey} className="space-y-2">
              {/* Day Header */}
              <div className="flex justify-between items-center px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  {group.label}
                </span>
                <span
                  className={`text-xs font-semibold tabular-nums ${
                    group.dayTotal >= 0 ? 'text-emerald-400/80' : 'text-slate-400'
                  }`}
                >
                  {group.dayTotal >= 0 ? '+' : ''}
                  {formatCurrency(group.dayTotal)}
                </span>
              </div>

              {/* Transactions in this Day */}
              <div className="space-y-2">
                {group.transactions.map((t) => (
                  <TransactionItem
                    key={t.id}
                    transaction={t}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    allCategories={allCategories}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-20 glass-card rounded-3xl border border-white/[0.06] flex flex-col items-center justify-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-600 mb-3 border border-white/5">
            <i className="fa-solid fa-magnifying-glass text-xl"></i>
          </div>
          <p className="text-slate-200 text-base font-bold">Nenhuma transação encontrada</p>
          <p className="text-slate-400 text-xs mt-1 mb-4 max-w-sm">
            Não encontramos movimentações para os filtros aplicados neste período.
          </p>
          <button
            onClick={resetFilters}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold transition-colors shadow-md shadow-blue-600/20"
          >
            Redefinir Filtros
          </button>
        </div>
      )}
    </div>
  );
};

export default TransactionList;