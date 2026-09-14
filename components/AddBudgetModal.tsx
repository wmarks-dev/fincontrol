import React, { useState, useEffect } from 'react';
import { Budget, Category } from '../types';

interface AddBudgetModalProps {
  onClose: () => void;
  onAdd: (budget: Omit<Budget, 'id'>) => void;
  onUpdate: (budget: Budget) => void;
  budgetToEdit: Budget | null;
  year: number;
  month: number; // 0-11
  existingBudgets: Budget[];
  allCategories: Category[];
  onError: (title: string, message: string) => void;
}

const AddBudgetModal: React.FC<AddBudgetModalProps> = ({ onClose, onAdd, onUpdate, budgetToEdit, year, month, existingBudgets, allCategories, onError }) => {
  
  const isEditing = !!budgetToEdit;

  // Filter categories that can have budgets (expenses) and don't already have a budget for the selected month/year
  const existingCategoryIdsForMonth = existingBudgets
    .filter(b => b.year === year && b.month === month)
    .map(b => b.categoryId);
    
  const availableCategories = allCategories.filter(c => 
    !['salary', 'investment', 'transfer', 'loans'].includes(c.id) &&
    (isEditing ? true : !existingCategoryIdsForMonth.includes(c.id))
  );

  const [categoryId, setCategoryId] = useState(availableCategories.length > 0 ? availableCategories[0].id : '');
  const [amount, setAmount] = useState('');
  
  useEffect(() => {
    if (isEditing && budgetToEdit) {
      setCategoryId(budgetToEdit.categoryId);
      setAmount(String(budgetToEdit.amount));
    } else {
        // Reset form when opening for a new budget
        setCategoryId(availableCategories.length > 0 ? availableCategories[0].id : '');
        setAmount('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing, budgetToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount);

    if (!categoryId) {
        onError('Nenhuma Categoria', 'Não há mais categorias disponíveis para criar um orçamento neste mês.');
        return;
    }
    
    if (isNaN(numericAmount) || numericAmount <= 0) {
      onError('Erro de Validação', 'Por favor, insira um valor de orçamento válido.');
      return;
    }

    const budgetData = { categoryId, amount: numericAmount, year, month };

    if (isEditing && budgetToEdit) {
      onUpdate({ ...budgetData, id: budgetToEdit.id });
    } else {
      onAdd(budgetData);
    }
    onClose();
  };
  
  const monthName = new Date(year, month).toLocaleString('pt-BR', { month: 'long' });
  const yearName = year;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
        <form onSubmit={handleSubmit}>
          <div className="p-6 border-b border-gray-700">
            <h2 className="text-xl font-bold text-white">{isEditing ? 'Editar Orçamento' : 'Adicionar Orçamento'}</h2>
            <p className="text-sm text-gray-400">Para {monthName} de {yearName}</p>
          </div>
          <div className="p-6 space-y-4">
            <div>
              <label htmlFor="budgetCategory" className="block text-sm font-medium text-gray-300 mb-1">Categoria</label>
              <select id="budgetCategory" value={categoryId} onChange={e => setCategoryId(e.target.value)} disabled={isEditing} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-600 disabled:opacity-70">
                {isEditing && budgetToEdit && <option key={budgetToEdit.categoryId} value={budgetToEdit.categoryId}>{allCategories.find(c => c.id === budgetToEdit.categoryId)?.name}</option>}
                {!isEditing && availableCategories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              {!isEditing && availableCategories.length === 0 && <p className="text-xs text-yellow-400 mt-1">Todas as categorias já possuem um orçamento para este mês.</p>}
            </div>
            <div>
              <label htmlFor="budgetAmount" className="block text-sm font-medium text-gray-300 mb-1">Valor do Orçamento (R$)</label>
              <input type="number" id="budgetAmount" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" placeholder="500.00" required autoFocus />
            </div>
          </div>
          <div className="px-6 py-4 bg-gray-800 border-t border-gray-700 flex justify-end gap-3">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{isEditing ? 'Salvar Alterações' : 'Adicionar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddBudgetModal;