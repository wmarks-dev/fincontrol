import React, { useState } from 'react';
import { Loan } from '../types';

interface LoanPaymentModalProps {
    loan: Loan;
    onClose: () => void;
    onSave: (loanId: string, amount: number, date: string) => void;
    onError: (title: string, message: string) => void;
}

const LoanPaymentModal: React.FC<LoanPaymentModalProps> = ({ loan, onClose, onSave, onError }) => {
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    const remainingAmount = loan.initialAmount - loan.paidAmount;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const numericAmount = parseFloat(amount);

        if (isNaN(numericAmount) || numericAmount <= 0) {
            onError("Valor Inválido", "Por favor, insira um valor de pagamento válido.");
            return;
        }
        if (numericAmount > remainingAmount) {
            onError("Valor Excedido", `O valor do pagamento não pode ser maior que o saldo devedor de ${remainingAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}.`);
            return;
        }

        onSave(loan.id, numericAmount, date);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md" onClick={e => e.stopPropagation()}>
                <form onSubmit={handleSubmit}>
                    <div className="p-6 border-b border-gray-700">
                        <h2 className="text-xl font-bold text-white">Registrar Pagamento</h2>
                        <p className="text-sm text-gray-400">Empréstimo para/de <span className="font-semibold">{loan.person}</span></p>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="bg-gray-700/50 p-3 rounded-md text-center">
                            <p className="text-sm text-gray-400">Saldo Devedor</p>
                            <p className="text-2xl font-bold text-blue-400">{remainingAmount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                        </div>
                        <div>
                            <label htmlFor="paymentAmount" className="block text-sm font-medium text-gray-300 mb-1">Valor do Pagamento</label>
                            <input
                                type="number"
                                id="paymentAmount"
                                value={amount}
                                onChange={e => setAmount(e.target.value)}
                                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                                placeholder="0.00"
                                max={remainingAmount}
                                autoFocus
                                required
                            />
                        </div>
                        <div>
                            <label htmlFor="paymentDate" className="block text-sm font-medium text-gray-300 mb-1">Data do Pagamento</label>
                            <input
                                type="date"
                                id="paymentDate"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500"
                                required
                            />
                        </div>
                    </div>
                    <div className="px-6 py-4 bg-gray-800 border-t border-gray-700 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500 transition-colors">
                            Cancelar
                        </button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors">
                            Confirmar Pagamento
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default LoanPaymentModal;