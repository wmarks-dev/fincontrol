import React from 'react';
import { Loan, LoanPayment, LoanType } from '../types';

interface LoansManagementProps {
    loans: Loan[];
    loanPayments: LoanPayment[];
    onAddLoan: () => void;
    onRegisterPayment: (loan: Loan) => void;
}

const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const LoanItem: React.FC<{ loan: Loan, onRegisterPayment: (loan: Loan) => void }> = ({ loan, onRegisterPayment }) => {
    const progress = Math.min((loan.paidAmount / loan.initialAmount) * 100, 100);
    const isPaid = loan.status === 'paid';

    return (
        <div className={`bg-gray-700/50 p-4 rounded-lg space-y-3 transition-opacity ${isPaid ? 'opacity-60' : ''}`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-white text-lg">{loan.person}</p>
                    <p className="text-sm text-gray-400">{loan.description || 'Sem descrição'}</p>
                    <p className="text-xs text-gray-500">Iniciado em: {new Date(loan.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                    <p className="font-bold text-xl text-blue-400">{formatCurrency(loan.initialAmount)}</p>
                    <span className={`text-xs font-semibold px-2 py-1 rounded-full ${isPaid ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                        {isPaid ? 'Quitado' : 'Ativo'}
                    </span>
                </div>
            </div>
            
            <div>
                <div className="flex justify-between text-xs text-gray-300 mb-1">
                    <span>Pago: {formatCurrency(loan.paidAmount)}</span>
                    <span>Restante: {formatCurrency(Math.max(0, loan.initialAmount - loan.paidAmount))}</span>
                </div>
                <div className="w-full bg-gray-600 rounded-full h-2.5">
                    <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
                </div>
            </div>
            
            {!isPaid && (
                <div className="flex justify-end pt-2">
                    <button 
                        onClick={() => onRegisterPayment(loan)}
                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm font-semibold"
                    >
                        Registrar Pagamento
                    </button>
                </div>
            )}
        </div>
    );
};

const LoansManagement: React.FC<LoansManagementProps> = ({ loans, loanPayments, onAddLoan, onRegisterPayment }) => {
    const loansGiven = loans.filter(l => l.type === LoanType.GIVEN).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const loansReceived = loans.filter(l => l.type === LoanType.RECEIVED).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    
    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-3xl font-bold text-white">Gerenciar Empréstimos</h1>
                <button
                    onClick={onAddLoan}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-lg"
                >
                    <i className="fa-solid fa-plus"></i>
                    <span>Adicionar Empréstimo</span>
                </button>
            </div>
            
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Loans I've GIVEN */}
                <section className="space-y-4">
                    <h2 className="text-xl font-semibold text-white border-b-2 border-gray-700 pb-2 flex items-center gap-3">
                       <i className="fa-solid fa-arrow-up-from-bracket text-red-400"></i>
                       <span>Empréstimos que Fiz (Dinheiro a Receber)</span>
                    </h2>
                    {loansGiven.length > 0 ? (
                        loansGiven.map(loan => <LoanItem key={loan.id} loan={loan} onRegisterPayment={onRegisterPayment} />)
                    ) : (
                        <div className="text-center py-12 text-gray-500 bg-gray-800 rounded-lg">
                            <i className="fa-solid fa-box-open text-4xl mb-3"></i>
                            <p>Você não emprestou dinheiro a ninguém.</p>
                        </div>
                    )}
                </section>
                
                {/* Loans I've RECEIVED */}
                <section className="space-y-4">
                    <h2 className="text-xl font-semibold text-white border-b-2 border-gray-700 pb-2 flex items-center gap-3">
                        <i className="fa-solid fa-arrow-down-to-bracket text-green-400"></i>
                        <span>Empréstimos que Recebi (Dinheiro a Pagar)</span>
                    </h2>
                    {loansReceived.length > 0 ? (
                        loansReceived.map(loan => <LoanItem key={loan.id} loan={loan} onRegisterPayment={onRegisterPayment} />)
                    ) : (
                         <div className="text-center py-12 text-gray-500 bg-gray-800 rounded-lg">
                            <i className="fa-solid fa-box-open text-4xl mb-3"></i>
                            <p>Você não tem empréstimos em aberto.</p>
                        </div>
                    )}
                </section>
            </div>
        </div>
    );
};

export default LoansManagement;