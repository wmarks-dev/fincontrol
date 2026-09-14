import React, { useState, useEffect } from 'react';
import { FinancialGoal } from '../types';

interface AddGoalModalProps {
  onClose: () => void;
  onAdd: (data: Omit<FinancialGoal, 'id' | 'currentAmount' | 'status'> & { initialAmount?: number }) => void;
  onUpdate: (data: FinancialGoal) => void;
  goalToEdit: FinancialGoal | null;
  onError: (title: string, message: string) => void;
}

const AddGoalModal: React.FC<AddGoalModalProps> = ({ onClose, onAdd, onUpdate, goalToEdit, onError }) => {
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('');
  const [initialAmount, setInitialAmount] = useState('');
  const [targetDate, setTargetDate] = useState('');

  const isEditing = !!goalToEdit;

  useEffect(() => {
    if (isEditing && goalToEdit) {
      setName(goalToEdit.name);
      setTargetAmount(String(goalToEdit.targetAmount));
      setInitialAmount(String(goalToEdit.currentAmount));
      setTargetDate(goalToEdit.targetDate || '');
    }
  }, [isEditing, goalToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numTargetAmount = parseFloat(targetAmount);
    const numInitialAmount = parseFloat(initialAmount || '0');

    if (!name.trim() || isNaN(numTargetAmount) || numTargetAmount <= 0) {
      onError('Erro de Validação', 'Por favor, preencha o nome da meta e um valor alvo válido.');
      return;
    }
    if (isEditing && goalToEdit && numInitialAmount > numTargetAmount) {
        onError('Erro de Validação', 'O valor atual não pode ser maior que o valor alvo.');
        return;
    }

    if (isEditing && goalToEdit) {
      onUpdate({
        ...goalToEdit,
        name,
        targetAmount: numTargetAmount,
        currentAmount: numInitialAmount, // In edit mode, initial amount is the current amount
        targetDate: targetDate || undefined,
        status: numInitialAmount >= numTargetAmount ? 'completed' : 'active',
      });
    } else {
      onAdd({
        name,
        targetAmount: numTargetAmount,
        initialAmount: numInitialAmount,
        targetDate: targetDate || undefined,
      });
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-bold text-white">{isEditing ? 'Editar Meta' : 'Adicionar Meta'}</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="goalName" className="block text-sm font-medium text-gray-300 mb-1">Nome da Meta</label>
              <input type="text" id="goalName" value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" placeholder="Ex: Viagem para o Japão" required autoFocus />
            </div>
            <div>
              <label htmlFor="targetAmount" className="block text-sm font-medium text-gray-300 mb-1">Valor Alvo (R$)</label>
              <input type="number" id="targetAmount" value={targetAmount} onChange={e => setTargetAmount(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" placeholder="20000.00" required />
            </div>
             <div>
              <label htmlFor="initialAmount" className="block text-sm font-medium text-gray-300 mb-1">
                {isEditing ? 'Valor Atual (R$)' : 'Valor Inicial (R$, opcional)'}
              </label>
              <input type="number" id="initialAmount" value={initialAmount} onChange={e => setInitialAmount(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" placeholder="0.00" />
            </div>
            <div>
              <label htmlFor="targetDate" className="block text-sm font-medium text-gray-300 mb-1">Data Alvo (Opcional)</label>
              <input type="date" id="targetDate" value={targetDate} onChange={e => setTargetDate(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" />
            </div>
          </div>
          <div className="px-6 py-4 bg-gray-800 border-t border-gray-700 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{isEditing ? 'Salvar Alterações' : 'Adicionar Meta'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddGoalModal;