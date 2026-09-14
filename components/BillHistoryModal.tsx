


import React, { useState, useMemo } from 'react';
import { CreditCard, Transaction, TransactionType, Category } from '../types';
import { getBillInfoForDueDate, parseISODateAsUTC } from '../utils/dateUtils';

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface BillHistoryModalProps {
    card: CreditCard;
    transactions: Transaction[];
    allCategories: Category[];
    onClose: () => void;
}

const BillHistoryModal: React.FC<BillHistoryModalProps> = ({ card, transactions, onClose, allCategories }) => {
    const [displayDate, setDisplayDate] = useState(new Date());

    // Use the specific function to find the bill that corresponds to the selected due date month.
    const billInfo = useMemo(() => getBillInfoForDueDate(card, displayDate), [card, displayDate]);
    
    const billTransactions = useMemo(() => {
        return transactions.filter(t => {
            const transactionDate = parseISODateAsUTC(t.date);
            return (
                t.creditCardId === card.id &&
                t.type === TransactionType.EXPENSE &&
                transactionDate >= billInfo.startDate &&
                transactionDate <= billInfo.endDate
            );
        }).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [transactions, card.id, billInfo]);

    const billTotal = useMemo(() => billTransactions.reduce((sum, t) => sum + t.amount, 0), [billTransactions]);

    const handlePrevMonth = () => {
        setDisplayDate(current => {
            const newDate = new Date(current);
            newDate.setUTCMonth(newDate.getUTCMonth() - 1);
            return newDate;
        });
    };

    const handleNextMonth = () => {
        setDisplayDate(current => {
            const newDate = new Date(current);
            newDate.setUTCMonth(newDate.getUTCMonth() + 1);
            return newDate;
        });
    };

    const billMonthName = billInfo.dueDate.toLocaleString('pt-BR', { month: 'long', timeZone: 'UTC' });
    const billYear = billInfo.dueDate.getUTCFullYear();
    const billHeader = `Fatura de ${billMonthName.charAt(0).toUpperCase() + billMonthName.slice(1)} de ${billYear}`;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-2xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-4 border-b border-gray-700 flex justify-between items-center flex-shrink-0">
                    <h2 className="text-xl font-bold text-white">{card.name} - Histórico de Faturas</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-700" aria-label="Fechar">
                        <i className="fa-solid fa-times"></i>
                    </button>
                </div>

                {/* Navigation and Summary */}
                <div className="p-4 border-b border-gray-700 flex-shrink-0">
                    <div className="flex justify-between items-center mb-4">
                        <button onClick={handlePrevMonth} className="px-3 py-1 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors" aria-label="Mês anterior">
                            <i className="fa-solid fa-chevron-left"></i>
                        </button>
                        <h3 className="text-lg font-semibold text-center text-white">{billHeader}</h3>
                        <button onClick={handleNextMonth} className="px-3 py-1 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors" aria-label="Próximo mês">
                            <i className="fa-solid fa-chevron-right"></i>
                        </button>
                    </div>
                    <div className="bg-gray-900/50 p-4 rounded-lg grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
                        <div>
                            <p className="text-sm text-gray-400">Total da Fatura</p>
                            <p className="text-2xl font-bold text-orange-400">{formatCurrency(billTotal)}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Vencimento</p>
                            <p className="text-lg font-medium">{billInfo.dueDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Fechamento</p>
                            <p className="text-lg font-medium">{billInfo.endDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                        </div>
                    </div>
                </div>

                {/* Transaction List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
                    {billTransactions.length > 0 ? (
                        billTransactions.map(t => {
                            const category = allCategories.find(c => c.id === t.category);
                            return (
                                <div key={t.id} className="flex justify-between items-center bg-gray-700/50 p-3 rounded-md">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                       <div className="text-gray-400 text-lg w-6 text-center flex-shrink-0"><i className={category?.icon}></i></div>
                                       <div className="truncate">
                                          <p className="font-semibold text-gray-200 truncate">{t.description}</p>
                                          <p className="text-xs text-gray-500">{new Date(t.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                                       </div>
                                    </div>
                                    <p className="font-medium text-gray-300 ml-2">{formatCurrency(t.amount)}</p>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-16 flex flex-col items-center justify-center h-full text-gray-500">
                            <i className="fa-solid fa-receipt text-4xl mb-3"></i>
                            <p className="font-semibold">Nenhuma transação nesta fatura.</p>
                            <p className="text-sm">As despesas feitas com este cartão aparecerão aqui.</p>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
};

export default BillHistoryModal;