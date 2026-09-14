import React, { useState } from 'react';
import { SavingsTransactionType, SavingsTransaction, FinancialGoal } from '../types';

interface SavingsTransferModalProps {
  type: SavingsTransactionType;
  onClose: () => void;
  onSave: (data: Omit<SavingsTransaction, 'id'|'date'> & { goalId?: string }) => void;
  goals: FinancialGoal[];
  onError: (title: string, message: string) => void;
}

const SavingsTransferModal: React.FC<SavingsTransferModalProps> = ({ type, onClose, onSave, goals, onError }) => {
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [selectedGoalId, setSelectedGoalId] = useState('');

  const isDeposit = type === SavingsTransactionType.DEPOSIT;
  const title = isDeposit ? 'Enviar para Poupança' : 'Retirar da Poupança';
  const buttonText = isDeposit ? 'Depositar' : 'Retirar';
  const buttonClass = isDeposit ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-500 hover:bg-orange-600';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount);
    if (!description.trim() || isNaN(numericAmount) || numericAmount <= 0) {
      onError("Erro de Validação", "Por favor, preencha a descrição e um valor válido.");
      return;
    }

    onSave({
      type,
      amount: numericAmount,
      description,
      goalId: selectedGoalId || undefined,
    });
  };

  const activeGoals = goals.filter(g => g.status === 'active');

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-bold text-white">{title}</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="savingsAmount" className="block text-sm font-medium text-gray-300 mb-1">Valor</label>
              <input 
                type="number" 
                id="savingsAmount" 
                value={amount} 
                onChange={e => setAmount(e.target.value)} 
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500" 
                placeholder="0.00" 
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="savingsDescription" className="block text-sm font-medium text-gray-300 mb-1">Descrição</label>
              <input 
                type="text" 
                id="savingsDescription" 
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                placeholder="Ex: Reserva de emergência"
              />
            </div>
            {isDeposit && activeGoals.length > 0 && (
                <div>
                    <label htmlFor="goalId" className="block text-sm font-medium text-gray-300 mb-1">Alocar para Meta (Opcional)</label>
                    <select
                        id="goalId"
                        value={selectedGoalId}
                        onChange={e => setSelectedGoalId(e.target.value)}
                        className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                    >
                        <option value="">Nenhuma meta específica</option>
                        {activeGoals.map(goal => (
                            <option key={goal.id} value={goal.id}>{goal.name}</option>
                        ))}
                    </select>
                </div>
            )}
          </div>
          <div className="px-6 py-4 bg-gray-800 border-t border-gray-700 flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors"
            >
              Cancelar
            </button>
            <button 
              type="submit" 
              className={`px-4 py-2 text-white rounded-md transition-colors ${buttonClass}`}
            >
              {buttonText}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SavingsTransferModal;