import React, { useState, useEffect } from 'react';
import { Category } from '../types';
import { AVAILABLE_ICONS } from '../constants';

interface AddCategoryModalProps {
  onClose: () => void;
  onAdd: (category: Omit<Category, 'id'>) => void;
  onUpdate: (category: Category) => void;
  categoryToEdit: Category | null;
  existingCategories: Category[];
  onError: (title: string, message: string) => void;
}

const AddCategoryModal: React.FC<AddCategoryModalProps> = ({ onClose, onAdd, onUpdate, categoryToEdit, existingCategories, onError }) => {
  const isEditing = !!categoryToEdit;
  const [name, setName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(AVAILABLE_ICONS[0]);

  useEffect(() => {
    if (isEditing && categoryToEdit) {
      setName(categoryToEdit.name);
      setSelectedIcon(categoryToEdit.icon);
    }
  }, [isEditing, categoryToEdit]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      onError('Nome Inválido', 'O nome da categoria não pode estar em branco.');
      return;
    }
    const isNameTaken = existingCategories.some(
      c => c.name.toLowerCase() === name.trim().toLowerCase() && c.id !== categoryToEdit?.id
    );
    if (isNameTaken) {
      onError('Nome Duplicado', 'Já existe uma categoria com este nome.');
      return;
    }

    const categoryData = { name: name.trim(), icon: selectedIcon, isCustom: true };
    if (isEditing && categoryToEdit) {
      onUpdate({ ...categoryData, id: categoryToEdit.id });
    } else {
      onAdd(categoryData);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-full flex flex-col" onClick={e => e.stopPropagation()}>
        <form onSubmit={handleSubmit} className="flex flex-col h-full">
          <div className="p-6 border-b border-gray-700 flex-shrink-0">
            <h2 className="text-xl font-bold text-white">{isEditing ? 'Editar Categoria' : 'Adicionar Categoria'}</h2>
          </div>
          <div className="p-6 space-y-6 flex-grow overflow-y-auto custom-scrollbar">
            <div>
              <label htmlFor="categoryName" className="block text-sm font-medium text-gray-300 mb-1">Nome da Categoria</label>
              <input type="text" id="categoryName" value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500" placeholder="Ex: Pet" required autoFocus />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Ícone</label>
              <div className="grid grid-cols-6 sm:grid-cols-8 gap-2 text-center">
                {AVAILABLE_ICONS.map(iconClass => (
                  <button
                    type="button"
                    key={iconClass}
                    onClick={() => setSelectedIcon(iconClass)}
                    className={`w-12 h-12 flex items-center justify-center rounded-lg transition-all text-xl ${selectedIcon === iconClass ? 'bg-blue-600 text-white ring-2 ring-offset-2 ring-offset-gray-800 ring-blue-500' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}
                  >
                    <i className={iconClass}></i>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="px-6 py-4 bg-gray-800 border-t border-gray-700 flex justify-end gap-3 flex-shrink-0">
            <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500">Cancelar</button>
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{isEditing ? 'Salvar Alterações' : 'Adicionar'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddCategoryModal;