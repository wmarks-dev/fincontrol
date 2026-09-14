
import React, { useMemo } from 'react';
import { SavingsTransaction, SavingsTransactionType } from '../types';

interface SavingsManagementProps {
  savingsTransactions: SavingsTransaction[];
  onOpenModal: (type: SavingsTransactionType) => void;
}

const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const SavingsManagement: React.FC<SavingsManagementProps> = ({ savingsTransactions, onOpenModal }) => {

    const savingsBalance = useMemo(() => {
        return savingsTransactions.reduce((acc, st) => {
            if (st.type === SavingsTransactionType.DEPOSIT) {
                return acc + st.amount;
            } else {
                return acc - st.amount;
            }
        }, 0);
    }, [savingsTransactions]);
    
    const sortedTransactions = useMemo(() => {
        return [...savingsTransactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [savingsTransactions]);

  return (
    <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-3xl font-bold text-white">Minha Poupança</h1>
            <div className="text-right">
                <p className="text-gray-400">Saldo Atual</p>
                <p className="text-3xl font-bold text-purple-400">{formatCurrency(savingsBalance)}</p>
            </div>
        </div>
        
        {/* Actions */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <button
                onClick={() => onOpenModal(SavingsTransactionType.DEPOSIT)}
                className="w-full flex items-center justify-center gap-3 p-4 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-lg"
            >
                <i className="fa-solid fa-arrow-down"></i>
                <span className="font-semibold">Enviar para Poupança</span>
            </button>
            <button
                onClick={() => onOpenModal(SavingsTransactionType.WITHDRAWAL)}
                className="w-full flex items-center justify-center gap-3 p-4 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors shadow-lg"
            >
                <i className="fa-solid fa-arrow-up"></i>
                <span className="font-semibold">Retirar da Poupança</span>
            </button>
        </div>

        {/* History */}
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg">
            <h2 className="text-lg font-semibold text-gray-300 mb-4">Histórico de Movimentações</h2>
            {sortedTransactions.length > 0 ? (
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
                    {sortedTransactions.map(st => {
                        const isDeposit = st.type === SavingsTransactionType.DEPOSIT;
                        return (
                            <div key={st.id} className="bg-gray-700/50 p-4 rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 flex-shrink-0 flex items-center justify-center rounded-full text-lg ${isDeposit ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                                        <i className={`fa-solid ${isDeposit ? 'fa-arrow-down' : 'fa-arrow-up'}`}></i>
                                    </div>
                                    <div>
                                        <p className="font-semibold text-white">{st.description}</p>
                                        <p className="text-sm text-gray-400">{new Date(st.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}</p>
                                    </div>
                                </div>
                                <p className={`font-bold text-lg ${isDeposit ? 'text-green-400' : 'text-orange-400'}`}>
                                    {isDeposit ? '+' : '-'} {formatCurrency(st.amount)}
                                </p>
                            </div>
                        );
                    })}
                </div>
            ) : (
                <div className="text-center py-12 text-gray-500">
                    <i className="fa-solid fa-clock-rotate-left text-4xl mb-3"></i>
                    <p className="font-semibold">Nenhuma movimentação registrada.</p>
                    <p className="text-sm">Suas transferências para a poupança aparecerão aqui.</p>
                </div>
            )}
        </div>
    </div>
  );
};

export default SavingsManagement;
