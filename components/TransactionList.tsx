

import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, TransactionType, PaymentMethod, Category } from '../types';
import { parseISODateAsUTC } from '../utils/dateUtils';

interface TransactionListProps {
  transactions: Transaction[];
  onEdit: (transaction: Transaction) => void;
  onDelete: (transactionId: string) => void;
  allCategories: Category[];
  initialFilters?: { category: string; startDate: string; endDate: string; } | null;
  onFiltersApplied?: () => void;
}

const TransactionItem: React.FC<{ transaction: Transaction; onEdit: (transaction: Transaction) => void; onDelete: (transactionId: string) => void; allCategories: Category[]; }> = ({ transaction, onEdit, onDelete, allCategories }) => {
  const category = allCategories.find(c => c.id === transaction.category);
  const isIncome = transaction.type === TransactionType.INCOME;
  const amountColor = isIncome ? 'text-green-400' : 'text-red-400';
  const sign = isIncome ? '+' : '-';
  const canBeEdited = !transaction.installmentId && !transaction.recurringId;

  return (
    <div className="bg-gray-800 p-4 rounded-lg flex items-center justify-between hover:bg-gray-700 transition-colors duration-200">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 flex items-center justify-center bg-gray-600 rounded-full text-lg">
          <i className={category?.icon || 'fa-solid fa-question'}></i>
        </div>
        <div>
          <p className="font-semibold text-white flex items-center">
            {transaction.description}
            {transaction.recurringId && <i className="fa-solid fa-sync-alt text-blue-400 text-xs ml-2" title="Transação Recorrente"></i>}
          </p>
          <p className="text-sm text-gray-400">
            {new Date(transaction.date).toLocaleDateString('pt-BR', { timeZone: 'UTC', day: '2-digit', month: 'short', year: 'numeric' })}
            <span className="mx-2">•</span>
            {category?.name || 'Sem categoria'}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
            <p className={`font-bold text-lg ${amountColor}`}>
            {sign} {transaction.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>
            {transaction.paymentMethod && <p className="text-xs text-gray-500">{transaction.paymentMethod}</p>}
        </div>
        <div className="flex items-center gap-3">
             <button
                onClick={() => onEdit(transaction)}
                disabled={!canBeEdited}
                className="p-1 text-gray-400 hover:text-blue-400 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
                title={!canBeEdited ? "Não é possível editar transações parceladas ou recorrentes" : "Editar transação"}
                aria-label="Editar"
            >
                <i className="fa-solid fa-pencil"></i>
            </button>
            <button
                onClick={() => onDelete(transaction.id)}
                className="p-1 text-gray-400 hover:text-red-400 transition-colors"
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

// Helper to get start and end of the current month in YYYY-MM-DD format, using UTC to avoid timezone bugs.
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

const TransactionList: React.FC<TransactionListProps> = ({ transactions, onEdit, onDelete, allCategories, initialFilters, onFiltersApplied }) => {
  const [isFilterVisible, setIsFilterVisible] = useState(false);
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
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialFilters]);

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const resetFilters = () => {
    setFilters({
      description: '',
      type: '',
      category: '',
      paymentMethod: '',
      ...getInitialDateFilters(),
    });
  };

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => {
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
  
  const uniqueCategories = useMemo(() => {
    const categoryIds = new Set(transactions.map(t => t.category));
    return allCategories.filter(c => categoryIds.has(c.id));
  }, [transactions, allCategories]);
  
  const uniquePaymentMethods = useMemo(() => {
    const methods = new Set(transactions.map(t => t.paymentMethod).filter(Boolean));
    return Array.from(methods) as PaymentMethod[];
  }, [transactions]);


  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-3xl font-bold text-white">Transações</h1>
            <button
              onClick={() => setIsFilterVisible(!isFilterVisible)}
              className="flex items-center gap-2 px-4 py-2 bg-gray-700 text-white rounded-md hover:bg-gray-600 transition-colors shadow-md"
            >
              <i className={`fa-solid ${isFilterVisible ? 'fa-chevron-up' : 'fa-filter'}`}></i>
              <span>{isFilterVisible ? 'Ocultar Filtros' : 'Mostrar Filtros'}</span>
            </button>
       </div>
      
      {isFilterVisible && (
          <div className="bg-gray-800 p-4 rounded-lg">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                  <input 
                    type="text" 
                    name="description" 
                    placeholder="Filtrar por descrição..." 
                    value={filters.description} 
                    onChange={handleFilterChange} 
                    className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-400 focus:ring-blue-500 focus:border-blue-500 sm:col-span-2 lg:col-span-1" 
                  />
                  
                  <select name="type" value={filters.type} onChange={handleFilterChange} className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500">
                      <option value="">Todos os Tipos</option>
                      <option value={TransactionType.INCOME}>Receita</option>
                      <option value={TransactionType.EXPENSE}>Despesa</option>
                  </select>

                  <select name="category" value={filters.category} onChange={handleFilterChange} className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500">
                      <option value="">Todas as Categorias</option>
                      {uniqueCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  
                  <select name="paymentMethod" value={filters.paymentMethod} onChange={handleFilterChange} className="bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500">
                      <option value="">Todos Pagamentos</option>
                      {uniquePaymentMethods.map(pm => <option key={pm} value={pm}>{pm}</option>)}
                  </select>

                  <div>
                    <label htmlFor="startDate" className="text-xs text-gray-400 block mb-1">De</label>
                    <input id="startDate" type="date" name="startDate" value={filters.startDate} onChange={handleFilterChange} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500" />
                  </div>

                  <div>
                    <label htmlFor="endDate" className="text-xs text-gray-400 block mb-1">Até</label>
                    <input id="endDate" type="date" name="endDate" value={filters.endDate} onChange={handleFilterChange} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500" />
                  </div>

                  <div className="col-span-1 sm:col-span-2 lg:col-span-full xl:col-span-1 flex items-end">
                    <button onClick={resetFilters} className="w-full bg-gray-600 hover:bg-gray-500 text-white rounded-md px-3 py-2 transition-colors">Redefinir Filtros</button>
                  </div>
              </div>
          </div>
      )}

      {filteredTransactions.length > 0 ? (
        <div className="space-y-3">
          {filteredTransactions.map(t => <TransactionItem key={t.id} transaction={t} onEdit={onEdit} onDelete={onDelete} allCategories={allCategories} />)}
        </div>
      ) : (
        <div className="text-center py-16 bg-gray-800 rounded-lg">
          <i className="fa-solid fa-search text-5xl text-gray-500 mb-4"></i>
          <p className="text-gray-400">Nenhuma transação encontrada.</p>
          <p className="text-gray-500 text-sm">Tente ajustar os filtros ou adicione uma nova transação.</p>
        </div>
      )}
    </div>
  );
};

export default TransactionList;