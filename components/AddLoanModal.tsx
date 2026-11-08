import React, { useState, useMemo } from 'react';
import { Loan, LoanType, Transaction, CreditCard, TransactionType, PaymentMethod } from '../types';
import { getTodayLocalDate } from '../utils/dateUtils';

interface AddLoanModalProps {
  transactions: Transaction[];
  creditCards: CreditCard[];
  onClose: () => void;
  onAddLoan: (data: Omit<Loan, 'id' | 'paidAmount' | 'status'> & { createTransaction?: boolean }) => Promise<void> | void;
  onError: (title: string, message: string) => void;
}

const formatCurrency = (val: number) =>
  val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const AddLoanModal: React.FC<AddLoanModalProps> = ({
  transactions,
  creditCards,
  onClose,
  onAddLoan,
  onError,
}) => {
  const [loanType, setLoanType] = useState<LoanType>(LoanType.GIVEN);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'credit_card'>('cash');
  const [selectedTransactionId, setSelectedTransactionId] = useState<string | null>(null);
  const [createCashTransaction, setCreateCashTransaction] = useState<boolean>(true);

  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getTodayLocalDate());
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Search & filter for credit card transactions
  const [txSearch, setTxSearch] = useState('');
  const [filterCardId, setFilterCardId] = useState<string>('all');

  const cardsById = useMemo(() => new Map(creditCards.map((c) => [c.id, c])), [creditCards]);

  // List of credit card expenses eligible for linking
  const candidateTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        if (t.type !== TransactionType.EXPENSE) return false;
        const isCard = t.paymentMethod === PaymentMethod.CREDIT_CARD || !!t.creditCardId;
        if (!isCard) return false;
        if (filterCardId !== 'all' && t.creditCardId !== filterCardId) return false;
        if (txSearch.trim()) {
          const q = txSearch.toLowerCase();
          const descMatch = t.description.toLowerCase().includes(q);
          const amountMatch = t.amount.toString().includes(q);
          const cardObj = t.creditCardId ? cardsById.get(t.creditCardId) : null;
          const cardMatch = cardObj?.name.toLowerCase().includes(q);
          return descMatch || amountMatch || cardMatch;
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 30);
  }, [transactions, cardsById, filterCardId, txSearch]);

  const selectedTx = useMemo(() => {
    if (!selectedTransactionId) return null;
    return transactions.find((t) => t.id === selectedTransactionId) || null;
  }, [selectedTransactionId, transactions]);

  const handleSelectTransaction = (tx: Transaction) => {
    setSelectedTransactionId(tx.id);
    setAmount(String(tx.amount));
    setDate(tx.date);
    if (!description.trim()) {
      setDescription(tx.description);
    }
  };

  const handleClearSelectedTransaction = () => {
    setSelectedTransactionId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const numericAmount = parseFloat(amount.replace(',', '.'));

    if (!person.trim()) {
      onError('Campo Obrigatório', 'Por favor, informe a pessoa envolvida no empréstimo.');
      return;
    }

    if (isNaN(numericAmount) || numericAmount <= 0) {
      onError('Valor Inválido', 'Por favor, insira um valor positivo válido para o empréstimo.');
      return;
    }

    if (paymentMethod === 'credit_card' && !selectedTransactionId) {
      onError(
        'Transação Não Selecionada',
        'Você escolheu vincular a um Cartão de Crédito. Por favor, selecione qual compra do cartão corresponde a este empréstimo na lista abaixo, ou alterne para "Dinheiro / Pix".'
      );
      return;
    }

    try {
      setIsSubmitting(true);
      await onAddLoan({
        type: loanType,
        person: person.trim(),
        initialAmount: numericAmount,
        description: description.trim(),
        date,
        paymentMethod,
        transactionId: paymentMethod === 'credit_card' ? selectedTransactionId : null,
        createTransaction: paymentMethod === 'cash' ? createCashTransaction : false,
      });
      onClose();
    } catch (err: any) {
      onError('Erro ao Salvar', err?.message || 'Ocorreu um erro ao salvar o empréstimo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-950/80 backdrop-blur-md flex items-center justify-center z-50 p-4 animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-card border border-white/10 rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden text-slate-100 animate-scale-up"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/[0.08] flex items-center justify-between bg-slate-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center">
              <i className="fa-solid fa-hand-holding-dollar text-lg"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white leading-tight">Novo Empréstimo</h2>
              <p className="text-xs text-slate-400">Controle débitos e créditos com facilidade</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <i className="fa-solid fa-xmark text-sm"></i>
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-5">
          {/* Tipo do Empréstimo */}
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Tipo do Empréstimo
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setLoanType(LoanType.GIVEN)}
                className={`py-3 px-4 rounded-xl border text-sm font-bold flex items-center justify-center gap-2.5 transition-all ${
                  loanType === LoanType.GIVEN
                    ? 'bg-rose-500/20 border-rose-500/50 text-rose-300 shadow-lg shadow-rose-500/10'
                    : 'bg-slate-800/40 border-white/5 text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <i className="fa-solid fa-arrow-up-from-bracket text-xs"></i>
                <span>Eu Emprestei</span>
              </button>
              <button
                type="button"
                onClick={() => setLoanType(LoanType.RECEIVED)}
                className={`py-3 px-4 rounded-xl border text-sm font-bold flex items-center justify-center gap-2.5 transition-all ${
                  loanType === LoanType.RECEIVED
                    ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-800/40 border-white/5 text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <i className="fa-solid fa-arrow-down-to-bracket text-xs"></i>
                <span>Peguei Emprestado</span>
              </button>
            </div>
          </div>

          {/* Origem / Forma do Recurso */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Origem do Dinheiro
              </label>
              {paymentMethod === 'credit_card' && (
                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-amber-500/15 text-amber-300 border border-amber-500/25">
                  Anti-Duplicação
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod('cash');
                  setSelectedTransactionId(null);
                }}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 ${
                  paymentMethod === 'cash'
                    ? 'bg-emerald-500/15 border-emerald-500/40 text-white ring-1 ring-emerald-500/30'
                    : 'bg-slate-800/40 border-white/5 text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  <i className="fa-solid fa-money-bill-wave text-emerald-400"></i>
                  <span>Dinheiro / Pix</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight mt-1">
                  Saída da conta corrente ou espécie
                </p>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('credit_card')}
                className={`p-3.5 rounded-xl border text-left transition-all flex flex-col justify-between gap-1 ${
                  paymentMethod === 'credit_card'
                    ? 'bg-amber-500/15 border-amber-500/40 text-white ring-1 ring-amber-500/30'
                    : 'bg-slate-800/40 border-white/5 text-slate-400 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  <i className="fa-solid fa-credit-card text-amber-400"></i>
                  <span>Cartão de Crédito</span>
                </div>
                <p className="text-[11px] text-slate-400 leading-tight mt-1">
                  Vincular compra já na fatura
                </p>
              </button>
            </div>
          </div>

          {/* Opção de Dinheiro / Pix: Gerar transação no extrato? */}
          {paymentMethod === 'cash' && (
            <div className="p-3.5 rounded-xl border border-white/[0.06] bg-slate-800/40 flex items-start gap-3">
              <input
                type="checkbox"
                id="createCashTx"
                checked={createCashTransaction}
                onChange={(e) => setCreateCashTransaction(e.target.checked)}
                className="mt-0.5 rounded bg-slate-700 border-slate-600 text-emerald-500 focus:ring-emerald-500 cursor-pointer"
              />
              <label htmlFor="createCashTx" className="text-xs text-slate-300 cursor-pointer select-none">
                <span className="font-semibold block text-slate-200">
                  Lançar movimentação no extrato automaticamente
                </span>
                <span className="text-slate-400 text-[11px] block mt-0.5">
                  {createCashTransaction
                    ? `Registrará uma movimentação no seu extrato na categoria Empréstimos.`
                    : 'Apenas salvará o registro do empréstimo sem alterar seu saldo ou criar transação no extrato.'}
                </span>
              </label>
            </div>
          )}

          {/* Opção de Cartão de Crédito: Selecionar Compra para Vincular */}
          {paymentMethod === 'credit_card' && (
            <div className="space-y-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/[0.04]">
              <div className="flex items-start gap-2.5">
                <i className="fa-solid fa-shield-halved text-amber-400 text-sm mt-0.5 flex-shrink-0"></i>
                <div className="text-xs text-slate-300 leading-relaxed">
                  <p className="font-bold text-amber-300">Evite dados duplicados!</p>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Selecione abaixo a compra feita no cartão para vincular a este empréstimo. Nenhuma despesa extra será criada no seu extrato.
                  </p>
                </div>
              </div>

              {/* Selected Transaction Pill or Selector List */}
              {selectedTx ? (
                <div className="p-3 rounded-xl bg-slate-800/90 border border-emerald-500/30 flex items-center justify-between gap-3 shadow-md">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <p className="text-xs font-bold text-white truncate">{selectedTx.description}</p>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                      <span>{new Date(selectedTx.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                      <span>•</span>
                      <span className="text-amber-400 font-medium">
                        {cardsById.get(selectedTx.creditCardId || '')?.name || 'Cartão'}
                      </span>
                      <span>•</span>
                      <span className="text-slate-200 font-bold">{formatCurrency(selectedTx.amount)}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleClearSelectedTransaction}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-slate-700/80 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                  >
                    Trocar
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Filters */}
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <i className="fa-solid fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-500"></i>
                      <input
                        type="text"
                        placeholder="Buscar compra por nome ou valor..."
                        value={txSearch}
                        onChange={(e) => setTxSearch(e.target.value)}
                        className="w-full pl-8 pr-3 py-1.5 bg-slate-900/60 border border-white/10 rounded-lg text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
                      />
                    </div>
                    {creditCards.length > 1 && (
                      <select
                        value={filterCardId}
                        onChange={(e) => setFilterCardId(e.target.value)}
                        className="bg-slate-900/60 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-amber-500/50"
                      >
                        <option value="all">Todos os Cartões</option>
                        {creditCards.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>

                  {/* Candidate List */}
                  <div className="max-h-44 overflow-y-auto space-y-1.5 custom-scrollbar pr-1">
                    {candidateTransactions.length > 0 ? (
                      candidateTransactions.map((tx) => {
                        const card = cardsById.get(tx.creditCardId || '');
                        return (
                          <div
                            key={tx.id}
                            onClick={() => handleSelectTransaction(tx)}
                            className="p-2.5 rounded-lg border border-white/5 bg-slate-800/50 hover:bg-slate-800 hover:border-amber-500/40 cursor-pointer transition-all flex items-center justify-between gap-2 group"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-200 truncate group-hover:text-amber-300 transition-colors">
                                {tx.description}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mt-0.5">
                                <span>{new Date(tx.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                                <span>•</span>
                                <span className="text-amber-400/90">{card?.name || 'Cartão'}</span>
                              </div>
                            </div>
                            <span className="text-xs font-bold text-amber-400 flex-shrink-0 tabular-nums">
                              {formatCurrency(tx.amount)}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="py-6 text-center text-xs text-slate-500">
                        Nenhuma despesa de cartão encontrada.
                      </div>
                    )}
                  </div>
                </div>
              )}

              {selectedTx && (
                <p className="text-[11px] text-slate-400 italic">
                  💡 Caso tenha dividido a conta, você pode ajustar o valor do empréstimo abaixo apenas para a parte que foi emprestada.
                </p>
              )}
            </div>
          )}

          {/* Pessoa Envolvida */}
          <div>
            <label htmlFor="person" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              {loanType === LoanType.GIVEN ? 'Quem Pegou Emprestado? (Devedor)' : 'De Quem Você Pegou? (Credor)'}
            </label>
            <input
              type="text"
              id="person"
              value={person}
              onChange={(e) => setPerson(e.target.value)}
              className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all"
              placeholder="Ex: Carlos Silva"
              required
            />
          </div>

          {/* Grid: Valor e Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="loanAmount" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Valor do Empréstimo
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">
                  R$
                </span>
                <input
                  type="number"
                  step="0.01"
                  id="loanAmount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-slate-800/60 border border-white/10 rounded-xl pl-10 pr-3.5 py-2.5 text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all tabular-nums"
                  placeholder="0,00"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="loanDate" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
                Data do Empréstimo
              </label>
              <input
                type="date"
                id="loanDate"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all"
                required
              />
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label htmlFor="loanDescription" className="block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Descrição ou Observação (Opcional)
            </label>
            <input
              type="text"
              id="loanDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-800/60 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/25 transition-all"
              placeholder="Ex: Jantar restaurante, Ingresso do show..."
            />
          </div>
        </form>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-white/[0.08] bg-slate-900/60 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-400 hover:text-white hover:bg-white/[0.06] transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-5 py-2 rounded-xl text-sm font-bold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 disabled:opacity-50 text-white shadow-lg shadow-blue-500/25 transition-all flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <i className="fa-solid fa-spinner fa-spin"></i>
                <span>Salvando...</span>
              </>
            ) : (
              <>
                <i className="fa-solid fa-check"></i>
                <span>Salvar Empréstimo</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddLoanModal;