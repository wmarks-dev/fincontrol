import React, { useMemo } from 'react';
import { Loan, LoanPayment, LoanType, Transaction, CreditCard } from '../types';

interface LoansManagementProps {
  loans: Loan[];
  loanPayments: LoanPayment[];
  transactions?: Transaction[];
  creditCards?: CreditCard[];
  onAddLoan: () => void;
  onRegisterPayment: (loan: Loan) => void;
  onDeleteLoan?: (loanId: string) => void;
}

const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

interface LoanItemProps {
  loan: Loan;
  transactions?: Transaction[];
  creditCards?: CreditCard[];
  onRegisterPayment: (loan: Loan) => void;
  onDeleteLoan?: (loanId: string) => void;
}

const LoanItem: React.FC<LoanItemProps> = ({
  loan,
  transactions = [],
  creditCards = [],
  onRegisterPayment,
  onDeleteLoan,
}) => {
  const progress = Math.min((loan.paidAmount / loan.initialAmount) * 100, 100);
  const isPaid = loan.status === 'paid';
  const remaining = Math.max(0, loan.initialAmount - loan.paidAmount);

  const linkedTx = loan.transactionId
    ? transactions.find((t) => t.id === loan.transactionId)
    : null;
  const linkedCard = linkedTx?.creditCardId
    ? creditCards.find((c) => c.id === linkedTx.creditCardId)
    : null;

  const handleDelete = () => {
    if (!onDeleteLoan) return;
    const confirmMsg =
      loan.paymentMethod === 'cash' && loan.transactionId
        ? `Tem certeza que deseja excluir o empréstimo com "${loan.person}"? A movimentação gerada no extrato também será removida.`
        : `Tem certeza que deseja excluir o empréstimo com "${loan.person}"?`;

    if (window.confirm(confirmMsg)) {
      onDeleteLoan(loan.id);
    }
  };

  return (
    <div
      className={`glass-card p-5 rounded-2xl border border-white/[0.08] shadow-lg transition-all space-y-4 ${
        isPaid ? 'opacity-65 bg-slate-900/40' : 'bg-slate-800/60 hover:border-white/15'
      }`}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-bold text-white text-base truncate">{loan.person}</h3>
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${
                isPaid
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
              }`}
            >
              {isPaid ? 'Quitado' : 'Em Aberto'}
            </span>
          </div>

          <p className="text-xs text-slate-400 line-clamp-2">
            {loan.description || 'Sem descrição'}
          </p>

          <div className="flex items-center gap-2 pt-1 flex-wrap text-xs text-slate-400">
            <span className="flex items-center gap-1">
              <i className="fa-regular fa-calendar text-[10px] text-slate-500"></i>
              <span>{new Date(loan.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
            </span>

            {/* Forma de Origem / Pagamento */}
            {loan.paymentMethod === 'credit_card' ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/15 text-amber-300 border border-amber-500/25">
                <i className="fa-solid fa-credit-card text-[10px]"></i>
                <span>{linkedCard?.name || 'Cartão de Crédito'}</span>
                {linkedTx && (
                  <span className="text-slate-400 font-normal truncate max-w-[130px]" title={linkedTx.description}>
                    • {linkedTx.description}
                  </span>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                <i className="fa-solid fa-money-bill-wave text-[10px]"></i>
                <span>Dinheiro / Pix</span>
                {linkedTx && (
                  <span className="text-emerald-400/90 font-normal text-[10px] ml-0.5">
                    • Lançado no extrato
                  </span>
                )}
              </span>
            )}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <p className="font-black text-lg text-white tabular-nums">
            {formatCurrency(loan.initialAmount)}
          </p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Restam <span className="font-bold text-slate-200">{formatCurrency(remaining)}</span>
          </p>
        </div>
      </div>

      {/* Barra de Progresso */}
      <div className="space-y-1.5">
        <div className="flex justify-between text-[11px] text-slate-400">
          <span>Amortizado: {formatCurrency(loan.paidAmount)}</span>
          <span className="font-semibold text-slate-300">{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-slate-700/50 rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              isPaid
                ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                : 'bg-gradient-to-r from-blue-500 to-indigo-500'
            }`}
            style={{ width: `${progress}%` }}
          ></div>
        </div>
      </div>

      {/* Ações */}
      <div className="flex items-center justify-between pt-2 border-t border-white/[0.05]">
        {onDeleteLoan && (
          <button
            type="button"
            onClick={handleDelete}
            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors text-xs flex items-center gap-1"
            title="Excluir empréstimo"
          >
            <i className="fa-regular fa-trash-can"></i>
            <span>Excluir</span>
          </button>
        )}

        <div className="ml-auto">
          {!isPaid && (
            <button
              onClick={() => onRegisterPayment(loan)}
              className="px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all text-xs font-bold shadow-md shadow-blue-600/20 flex items-center gap-1.5"
            >
              <i className="fa-solid fa-hand-holding-dollar"></i>
              <span>Registrar Pagamento</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const LoansManagement: React.FC<LoansManagementProps> = ({
  loans,
  loanPayments,
  transactions = [],
  creditCards = [],
  onAddLoan,
  onRegisterPayment,
  onDeleteLoan,
}) => {
  const loansGiven = useMemo(
    () =>
      loans
        .filter((l) => l.type === LoanType.GIVEN)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [loans]
  );

  const loansReceived = useMemo(
    () =>
      loans
        .filter((l) => l.type === LoanType.RECEIVED)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [loans]
  );

  // Totais rápidos
  const totalGiven = useMemo(
    () => loansGiven.reduce((acc, l) => acc + (l.initialAmount - l.paidAmount), 0),
    [loansGiven]
  );
  const totalReceived = useMemo(
    () => loansReceived.reduce((acc, l) => acc + (l.initialAmount - l.paidAmount), 0),
    [loansReceived]
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Gerenciar Empréstimos
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
            Controle dinheiro emprestado e a pagar sem duplicar lançamentos
          </p>
        </div>

        <button
          onClick={onAddLoan}
          className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-blue-500/25 flex-shrink-0"
        >
          <i className="fa-solid fa-plus"></i>
          <span>Novo Empréstimo</span>
        </button>
      </div>

      {/* KPI Cards Resumo */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="glass-card p-5 rounded-2xl border border-white/[0.08] bg-slate-800/50 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">A Receber (Emprestado)</p>
            <p className="text-2xl font-black text-emerald-400 tabular-nums mt-1">
              {formatCurrency(totalGiven)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {loansGiven.filter((l) => l.status === 'active').length} em aberto
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xl">
            <i className="fa-solid fa-arrow-up-from-bracket"></i>
          </div>
        </div>

        <div className="glass-card p-5 rounded-2xl border border-white/[0.08] bg-slate-800/50 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">A Pagar (Recebido)</p>
            <p className="text-2xl font-black text-rose-400 tabular-nums mt-1">
              {formatCurrency(totalReceived)}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {loansReceived.filter((l) => l.status === 'active').length} em aberto
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center text-xl">
            <i className="fa-solid fa-arrow-down-to-bracket"></i>
          </div>
        </div>
      </div>

      {/* Grid de Seções */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Empréstimos que Fiz (A Receber) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400"></span>
              <span>Empréstimos que Fiz (A Receber)</span>
            </h2>
            <span className="text-xs text-slate-400 font-semibold">
              {loansGiven.length} {loansGiven.length === 1 ? 'registro' : 'registros'}
            </span>
          </div>

          {loansGiven.length > 0 ? (
            <div className="space-y-3">
              {loansGiven.map((loan) => (
                <LoanItem
                  key={loan.id}
                  loan={loan}
                  transactions={transactions}
                  creditCards={creditCards}
                  onRegisterPayment={onRegisterPayment}
                  onDeleteLoan={onDeleteLoan}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 bg-slate-800/30 rounded-2xl border border-white/[0.04]">
              <i className="fa-solid fa-hand-holding-dollar text-4xl mb-3 text-slate-600"></i>
              <p className="text-sm font-medium text-slate-400">Você não emprestou dinheiro a ninguém.</p>
              <p className="text-xs text-slate-500 mt-0.5">Clique em "Novo Empréstimo" para registrar.</p>
            </div>
          )}
        </section>

        {/* Empréstimos que Recebi (A Pagar) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-white/[0.08]">
            <h2 className="text-lg font-bold text-white flex items-center gap-2.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400"></span>
              <span>Empréstimos que Recebi (A Pagar)</span>
            </h2>
            <span className="text-xs text-slate-400 font-semibold">
              {loansReceived.length} {loansReceived.length === 1 ? 'registro' : 'registros'}
            </span>
          </div>

          {loansReceived.length > 0 ? (
            <div className="space-y-3">
              {loansReceived.map((loan) => (
                <LoanItem
                  key={loan.id}
                  loan={loan}
                  transactions={transactions}
                  creditCards={creditCards}
                  onRegisterPayment={onRegisterPayment}
                  onDeleteLoan={onDeleteLoan}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-slate-500 bg-slate-800/30 rounded-2xl border border-white/[0.04]">
              <i className="fa-solid fa-hand-holding-heart text-4xl mb-3 text-slate-600"></i>
              <p className="text-sm font-medium text-slate-400">Você não tem empréstimos a pagar.</p>
              <p className="text-xs text-slate-500 mt-0.5">Suas pendências estão em dia!</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default LoansManagement;