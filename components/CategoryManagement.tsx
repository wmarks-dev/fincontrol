import React from 'react';
import { Category } from '../types';

interface CategoryManagementProps {
    customCategories: Category[];
    onAddCategory: () => void;
    onUpdateCategory: (category: Category) => void;
    onDeleteCategory: (categoryId: string) => void;
}

const CategoryManagement: React.FC<CategoryManagementProps> = ({ customCategories, onAddCategory, onUpdateCategory, onDeleteCategory }) => {
    
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-3xl font-bold text-white">Gerenciar Categorias</h1>
                <button
                    onClick={onAddCategory}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-lg"
                >
                    <i className="fa-solid fa-plus"></i>
                    <span>Adicionar Categoria</span>
                </button>
            </div>
            
            {customCategories.length > 0 ? (
                <div className="bg-gray-800 p-4 rounded-lg">
                    <h2 className="text-lg font-semibold text-gray-300 mb-4">Suas Categorias Personalizadas</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {customCategories.map(cat => (
                            <div key={cat.id} className="bg-gray-700 p-3 rounded-lg flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="w-8 h-8 flex items-center justify-center bg-gray-600 rounded-full text-lg">
                                        <i className={cat.icon}></i>
                                    </div>
                                    <span className="font-semibold text-white">{cat.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => onUpdateCategory(cat)} className="p-1 text-gray-400 hover:text-blue-400" title="Editar categoria">
                                        <i className="fa-solid fa-pencil"></i>
                                    </button>
                                    <button onClick={() => onDeleteCategory(cat.id)} className="p-1 text-gray-400 hover:text-red-400" title="Excluir categoria">
                                        <i className="fa-solid fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ) : (
                <div className="text-center py-16 bg-gray-800 rounded-lg">
                    <i className="fa-solid fa-tags text-5xl text-gray-500 mb-4"></i>
                    <p className="text-gray-400 text-xl">Nenhuma categoria personalizada criada.</p>
                    <p className="text-gray-500 text-sm">Clique em "Adicionar Categoria" para começar a personalizar.</p>
                </div>
            )}
        </div>
    );
};

export default CategoryManagement;
