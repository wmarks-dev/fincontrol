import React, { useState, useEffect } from 'react';
import { Bill, Category } from '../types';

interface AddBillModalProps {
  onClose: () => void;
  onAdd: (bill: Omit<Bill, 'id' | 'status'>) => void;
  onUpdate: (bill: Bill) => void;
  billToEdit: Bill | null;
  allCategories: Category[];
  onError: (title: string, message: string) => void;
}

const AddBillModal: React.FC<AddBillModalProps> = ({ onClose, onAdd, onUpdate, billToEdit, allCategories, onError }) => {
  const [name, setName] = useState('');
  const [dueDay, setDueDay] = useState('');
  const [estimatedAmount, setEstimatedAmount] = useState('');
  const [category, setCategory] = useState('bills');
  
  const isEditing = !!billToEdit;

  useEffect(() => {
    if (isEditing && billToEdit) {
      setName(billToEdit.name);
      setDueDay(String(billToEdit.dueDay));
      setEstimatedAmount(String(billToEdit.estimatedAmount));
      setCategory(billToEdit.category);
    }
  }, [isEditing, billToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numDueDay = parseInt(dueDay, 10);
    const numAmount = parseFloat(estimatedAmount);

    if (!name.trim() || isNaN(numDueDay) || numDueDay < 1 || numDueDay > 31 || isNaN(numAmount) || numAmount <= 0) {
      onError('Erro de Validação', 'Por favor, preencha todos os campos com valores válidos. O dia do vencimento deve ser entre 1 e 31.');
      return;
    }

    const billData = { name, dueDay: numDueDay, estimatedAmount: numAmount, category };

    if (isEditing && billToEdit) {
      onUpdate({ ...billData, id: billToEdit.id, status: billToEdit.status });
    } else {
      onAdd(billData);
    }
    onClose();
  };

  const expenseCategories = allCategories.filter(c => !['salary', 'investment', 'transfer'].includes(c.id));

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-bold text-white">{isEditing ? 'Editar Conta' : 'Adicionar Conta'}</h2>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="billName" className="block text-sm font-medium text-gray-300 mb-1">Nome da Conta</label>
              <input type="text" id="billName" value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500" placeholder="Ex: Conta de Luz" required />
            </div>
            <div>
              <label htmlFor="dueDay" className="block text-sm font-medium text-gray-300 mb-1">Dia do Vencimento</label>
              <input type="number" id="dueDay" value={dueDay} onChange={e => setDueDay(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" min="1" max="31" placeholder="Todo dia..." required />
            </div>
            <div>
              <label htmlFor="estimatedAmount" className="block text-sm font-medium text-gray-300 mb-1">Valor Estimado (R$)</label>
              <input type="number" id="estimatedAmount" value={estimatedAmount} onChange={e => setEstimatedAmount(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" placeholder="150.00" required />
            </div>
            <div>
              <label htmlFor="billCategory" className="block text-sm font-medium text-gray-300 mb-1">Categoria</label>
              <select id="billCategory" value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500">
                {expenseCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>
          <div className="px-6 py-4 bg-gray-800 border-t border-gray-700 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{isEditing ? 'Salvar Alterações' : 'Adicionar Conta'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddBillModal;