import React, { useState } from 'react';
import { Loan, LoanType } from '../types';

interface AddLoanModalProps {
    onClose: () => void;
    onAddLoan: (data: Omit<Loan, 'id' | 'paidAmount' | 'status'>) => void;
    onError: (title: string, message: string) => void;
}

const AddLoanModal: React.FC<AddLoanModalProps> = ({ onClose, onAddLoan, onError }) => {
    const [loanType, setLoanType] = useState<LoanType>(LoanType.GIVEN);
    const [person, setPerson] = useState('');
    const [amount, setAmount] = useState('');
    const [description, setDescription] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numericAmount = parseFloat(amount);
        if (!person.trim() || isNaN(numericAmount) || numericAmount <= 0) {
            onError("Erro de Validação", "Por favor, preencha o nome da pessoa e um valor válido.");
            return;
        }

        onAddLoan({
            type: loanType,
            person,
            initialAmount: numericAmount,
            description,
            date: new Date().toISOString().split('T')[0],
        });
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b border-gray-700">
                        <h2 className="text-xl font-bold text-white">Adicionar Empréstimo</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-300 mb-2">Tipo de Empréstimo</label>
                            <div className="flex gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="loanType" value={LoanType.GIVEN} checked={loanType === LoanType.GIVEN} onChange={() => setLoanType(LoanType.GIVEN)} className="form-radio text-red-500 bg-gray-700 border-gray-600 focus:ring-red-500" />
                                    <span>Eu emprestei</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input type="radio" name="loanType" value={LoanType.RECEIVED} checked={loanType === LoanType.RECEIVED} onChange={() => setLoanType(LoanType.RECEIVED)} className="form-radio text-green-500 bg-gray-700 border-gray-600 focus:ring-green-500" />
                                    <span>Eu peguei emprestado</span>
                                </label>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="person" className="block text-sm font-medium text-gray-300 mb-1">Pessoa Envolvida</label>
                            <input
                                type="text"
                                id="person"
                                value={person}
                                onChange={e => setPerson(e.target.value)}
                                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Nome da pessoa"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="loanAmount" className="block text-sm font-medium text-gray-300 mb-1">Valor do Empréstimo</label>
                            <input
                                type="number"
                                id="loanAmount"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                                placeholder="0.00"
                                required
                            />
                        </div>

                        <div>
                            <label htmlFor="loanDescription" className="block text-sm font-medium text-gray-300 mb-1">Descrição (Opcional)</label>
                            <input
                                type="text"
                                id="loanDescription"
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                                placeholder="Ex: Adiantamento para viagem"
                            />
                        </div>
                    </div>
                    <div className="px-6 py-4 bg-gray-800 border-t border-gray-700 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                            Salvar Empréstimo
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddLoanModal;