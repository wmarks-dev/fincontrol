import React from 'react';
import { Bill, Category } from '../types';

interface BillsManagementProps {
  bills: Bill[];
  allCategories: Category[];
  onAdd: () => void;
  onEdit: (bill: Bill) => void;
  onDelete: (billId: string) => void;
}

const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const BillItem: React.FC<{bill: Bill; onEdit: (bill: Bill) => void; onDelete: (billId: string) => void; allCategories: Category[]}> = ({ bill, onEdit, onDelete, allCategories }) => {
    const category = allCategories.find(c => c.id === bill.category);
    const isInactive = bill.status === 'inactive';

    return (
        <div className={`bg-gray-800 p-4 rounded-lg flex items-center justify-between transition-opacity ${isInactive ? 'opacity-50' : 'hover:bg-gray-700/50'}`}>
            <div className="flex items-center gap-4">
                <div className="w-10 h-10 flex items-center justify-center bg-gray-600 rounded-full text-lg">
                    <i className={category?.icon || 'fa-solid fa-file-invoice-dollar'}></i>
                </div>
                <div>
                    <p className="font-semibold text-white">{bill.name}</p>
                    <p className="text-sm text-gray-400">Vence todo dia {bill.dueDay} • {category?.name}</p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <p className="font-bold text-lg text-yellow-400">{formatCurrency(bill.estimatedAmount)}</p>
                <div className="flex items-center gap-2">
                    <button onClick={() => onEdit(bill)} className="p-1 text-gray-400 hover:text-blue-400" title="Editar conta">
                        <i className="fa-solid fa-pencil"></i>
                    </button>
                    <button onClick={() => onDelete(bill.id)} className="p-1 text-gray-400 hover:text-red-400" title="Excluir conta">
                        <i className="fa-solid fa-trash"></i>
                    </button>
                </div>
            </div>
        </div>
    );
}

const BillsManagement: React.FC<BillsManagementProps> = ({ bills, onAdd, onEdit, onDelete, allCategories }) => {
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-3xl font-bold text-white">Gerenciar Contas</h1>
                <button
                    onClick={onAdd}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-lg"
                >
                    <i className="fa-solid fa-plus"></i>
                    <span>Adicionar Conta</span>
                </button>
            </div>
            
            {bills.length > 0 ? (
                <div className="space-y-3">
                    {bills.sort((a,b) => a.dueDay - b.dueDay).map(bill => (
                        <BillItem key={bill.id} bill={bill} onEdit={onEdit} onDelete={onDelete} allCategories={allCategories} />
                    ))}
                </div>
            ) : (
                <div className="text-center py-16 bg-gray-800 rounded-lg">
                    <i className="fa-solid fa-file-invoice-dollar text-5xl text-gray-500 mb-4"></i>
                    <p className="text-gray-400 text-xl">Nenhuma conta recorrente cadastrada.</p>
                    <p className="text-gray-500 text-sm">Adicione contas como água, luz e internet para ser lembrado.</p>
                </div>
            )}
        </div>
    );
};

export default BillsManagement;