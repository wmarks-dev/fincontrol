import React, { useState, useMemo } from 'react';
import { CreditCard, Transaction, TransactionType, Category } from '../types';
import { getBillInfoForDueDate, parseISODateAsUTC } from '../utils/dateUtils';
import { getCardTheme } from './RealisticCreditCard';

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface BillHistoryModalProps {
  card: CreditCard;
  transactions: Transaction[];
  allCategories: Category[];
  onClose: () => void;
}

const BillHistoryModal: React.FC<BillHistoryModalProps> = ({ card, transactions, onClose, allCategories }) => {
  const [displayDate, setDisplayDate] = useState(new Date());

  const cardTheme = useMemo(() => getCardTheme(card.theme, card.name), [card]);

  // Use the specific function to find the bill that corresponds to the selected due date month.
  const billInfo = useMemo(() => getBillInfoForDueDate(card, displayDate), [card, displayDate]);

  const billTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        const transactionDate = parseISODateAsUTC(t.date);
        return (
          t.creditCardId === card.id &&
          t.type === TransactionType.EXPENSE &&
          transactionDate >= billInfo.startDate &&
          transactionDate <= billInfo.endDate
        );
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, card.id, billInfo]);

  const billTotal = useMemo(() => billTransactions.reduce((sum, t) => sum + t.amount, 0), [billTransactions]);

  const handlePrevMonth = () => {
    setDisplayDate((current) => {
      const newDate = new Date(current);
      newDate.setUTCMonth(newDate.getUTCMonth() - 1);
      return newDate;
    });
  };

  const handleNextMonth = () => {
    setDisplayDate((current) => {
      const newDate = new Date(current);
      newDate.setUTCMonth(newDate.getUTCMonth() + 1);
      return newDate;
    });
  };

  const billMonthName = billInfo.dueDate.toLocaleString('pt-BR', { month: 'long', timeZone: 'UTC' });
  const billYear = billInfo.dueDate.getUTCFullYear();
  const billHeader = `Fatura de ${billMonthName.charAt(0).toUpperCase() + billMonthName.slice(1)} de ${billYear}`;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="glass-card rounded-3xl border border-white/10 shadow-2xl w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/[0.08] flex justify-between items-center bg-slate-900/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl ${cardTheme.previewBg} border border-white/20 flex items-center justify-center text-white text-sm shadow-md`}>
              <i className="fa-solid fa-credit-card"></i>
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-white tracking-tight">{card.name}</h2>
              <p className="text-xs text-slate-400">Histórico detalhado de faturas</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors flex items-center justify-center text-sm"
            aria-label="Fechar"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Navigation and Summary Bar */}
        <div className="p-5 sm:p-6 border-b border-white/[0.08] flex-shrink-0 bg-slate-900/40">
          <div className="flex justify-between items-center mb-4">
            <button
              onClick={handlePrevMonth}
              className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/[0.06] flex items-center justify-center transition-all text-xs"
              aria-label="Mês anterior"
            >
              <i className="fa-solid fa-chevron-left"></i>
            </button>
            <div className="text-center">
              <h3 className="text-base sm:text-lg font-bold text-white tracking-tight">{billHeader}</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Ciclo de {billInfo.startDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })} até{' '}
                {billInfo.endDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
              </p>
            </div>
            <button
              onClick={handleNextMonth}
              className="w-9 h-9 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/[0.06] flex items-center justify-center transition-all text-xs"
              aria-label="Próximo mês"
            >
              <i className="fa-solid fa-chevron-right"></i>
            </button>
          </div>

          <div className="bg-slate-900/80 p-4 rounded-2xl border border-white/[0.06] grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Total da Fatura</p>
              <p className="text-xl sm:text-2xl font-extrabold text-amber-400 tabular-nums mt-0.5">{formatCurrency(billTotal)}</p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Vencimento</p>
              <p className="text-sm sm:text-base font-bold text-slate-200 mt-1">
                {billInfo.dueDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold">Fechamento</p>
              <p className="text-sm sm:text-base font-bold text-slate-200 mt-1">
                {billInfo.endDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
              </p>
            </div>
          </div>
        </div>

        {/* Transaction List */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-2.5 custom-scrollbar">
          {billTransactions.length > 0 ? (
            billTransactions.map((t) => {
              const category = allCategories.find((c) => c.id === t.category);
              return (
                <div
                  key={t.id}
                  className="flex justify-between items-center bg-slate-800/40 hover:bg-slate-800/70 p-3 rounded-2xl border border-white/[0.04] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-xs flex-shrink-0">
                      <i className={category?.icon || 'fa-solid fa-tag'}></i>
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-sm text-slate-200 truncate">{t.description}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(t.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                      </p>
                    </div>
                  </div>
                  <p className="font-extrabold text-slate-200 tabular-nums text-sm sm:text-base ml-3 flex-shrink-0">
                    {formatCurrency(t.amount)}
                  </p>
                </div>
              );
            })
          ) : (
            <div className="text-center py-16 flex flex-col items-center justify-center h-full text-slate-500">
              <div className="w-12 h-12 rounded-2xl bg-slate-800/60 flex items-center justify-center text-slate-600 mb-3 border border-white/5">
                <i className="fa-solid fa-receipt text-xl"></i>
              </div>
              <p className="font-bold text-slate-300 text-sm">Nenhuma transação nesta fatura</p>
              <p className="text-xs text-slate-500 mt-0.5">As compras efetuadas neste período aparecerão aqui.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BillHistoryModal;