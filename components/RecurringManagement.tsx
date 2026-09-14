

import React from 'react';
import { RecurringTransaction, Category } from '../types';

interface RecurringManagementProps {
  recurringTransactions: RecurringTransaction[];
  onCancel: (id: string) => void;
  allCategories: Category[];
}

const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const getDayOfMonth = (dateString: string): number => {
    // Dates are stored as 'YYYY-MM-DD', which new Date() parses as midnight UTC.
    // getUTCDate() is the correct method to use to avoid timezone bugs.
    return new Date(dateString).getUTCDate();
}

const RecurringItem: React.FC<{ item: RecurringTransaction; onCancel: (id: string) => void; allCategories: Category[]; }> = ({ item, onCancel, allCategories }) => {
    const category = allCategories.find(c => c.id === item.category);
    const amountColor = item.type === 'INCOME' ? 'text-green-400' : 'text-red-400';
    const sign = item.type === 'INCOME' ? '+' : '-';
    const isCanceled = item.status === 'canceled';

    return (
        <div className={`bg-gray-800 p-4 rounded-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors duration-200 ${isCanceled ? 'opacity-60' : 'hover:bg-gray-700/50'}`}>
            <div className="flex items-center gap-4 flex-1">
                <div className="w-10 h-10 flex items-center justify-center bg-gray-600 rounded-full text-lg flex-shrink-0">
                    <i className={category?.icon || 'fa-solid fa-shapes'}></i>
                </div>
                <div className="flex-1">
                    <p className="font-semibold text-white">{item.description}</p>
                    <p className="text-sm text-gray-400">
                        Todo dia {getDayOfMonth(item.date)}
                        <span className="mx-2">•</span>
                        {category?.name || 'Sem categoria'}
                    </p>
                </div>
            </div>
            <div className="flex items-center gap-4 sm:gap-6 w-full sm:w-auto">
                 <div className="text-right flex-1 sm:flex-none">
                    <p className={`font-bold text-lg ${amountColor}`}>
                       {sign} {formatCurrency(item.amount)}
                    </p>
                    {item.paymentMethod && <p className="text-xs text-gray-500">{item.paymentMethod}</p>}
                </div>
                <button
                    onClick={() => onCancel(item.id)}
                    disabled={isCanceled}
                    className={`px-3 py-2 rounded-md transition-colors text-sm font-medium flex items-center gap-2 text-white ${isCanceled ? 'bg-gray-500 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
                    title={isCanceled ? "Esta recorrência já foi cancelada" : "Cancelar recorrência"}
                >
                    <i className={`fa-solid ${isCanceled ? 'fa-check-circle' : 'fa-ban'}`}></i>
                    <span>{isCanceled ? 'Cancelada' : 'Cancelar'}</span>
                </button>
            </div>
        </div>
    );
}

const RecurringManagement: React.FC<RecurringManagementProps> = ({ recurringTransactions, onCancel, allCategories }) => {
  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-3xl font-bold text-white">Gerenciar Recorrências</h1>
            <p className="text-gray-400 text-sm max-w-xs">Cancele uma recorrência para impedir que futuras transações sejam geradas automaticamente.</p>
       </div>

      {recurringTransactions.length > 0 ? (
        <div className="space-y-3">
          {recurringTransactions.sort((a,b) => getDayOfMonth(a.date) - getDayOfMonth(b.date)).map(rt => <RecurringItem key={rt.id} item={rt} onCancel={onCancel} allCategories={allCategories} />)}
        </div>
      ) : (
        <div className="text-center py-16 bg-gray-800 rounded-lg">
          <i className="fa-solid fa-sync-alt text-5xl text-gray-500 mb-4"></i>
          <p className="text-gray-400 text-xl">Nenhuma transação recorrente configurada.</p>
          <p className="text-gray-500 text-sm">Use o botão '+' para adicionar uma despesa ou receita recorrente.</p>
        </div>
      )}
    </div>
  );
};

export default RecurringManagement;