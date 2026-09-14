import React, { useState, useEffect, useMemo } from 'react';
import { Transaction, CreditCard, TransactionType, PaymentMethod, Category, RecurringTransaction } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { parseISODateAsUTC } from '../utils/dateUtils';
import { getCardTheme } from './RealisticCreditCard';

const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

interface AddTransactionModalProps {
  onClose: () => void;
  onAddTransaction: (transactions: Omit<Transaction, 'id'>[]) => void;
  onUpdateTransaction: (transaction: Transaction) => void;
  onAddRecurringTransaction: (recurringTransaction: Omit<RecurringTransaction, 'id' | 'status'>) => void;
  creditCards: CreditCard[];
  transactionToEdit: Transaction | null;
  transactionToPrefill: Partial<Transaction> | null;
  allCategories: Category[];
  onError: (title: string, message: string) => void;
}

type FormType = 'expense' | 'income' | 'installment' | 'recurring';

const AddTransactionModal: React.FC<AddTransactionModalProps> = ({
  onClose,
  onAddTransaction,
  onUpdateTransaction,
  onAddRecurringTransaction,
  creditCards,
  transactionToEdit,
  transactionToPrefill,
  allCategories,
  onError,
}) => {
  const [formType, setFormType] = useState<FormType>('expense');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<string>(allCategories.length > 0 ? allCategories[0].id : '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [creditCardId, setCreditCardId] = useState<string>(creditCards.length > 0 ? creditCards[0].id : '');
  const [installments, setInstallments] = useState('2');

  const isEditing = !!transactionToEdit;

  useEffect(() => {
    if (isEditing && transactionToEdit) {
      const t = transactionToEdit;
      const isIncome = t.type === TransactionType.INCOME;
      setDescription(t.description);
      setAmount(String(t.amount));
      setDate(t.date);
      setCategory(t.category);
      setPaymentMethod(isIncome ? PaymentMethod.CASH : (t.paymentMethod || PaymentMethod.CASH));
      setCreditCardId(isIncome ? '' : (t.creditCardId || (creditCards.length > 0 ? creditCards[0].id : '')));
      setFormType(isIncome ? 'income' : 'expense');
    } else if (transactionToPrefill) {
      const isIncome = transactionToPrefill.type === TransactionType.INCOME;
      setDescription(transactionToPrefill.description || '');
      setAmount(String(transactionToPrefill.amount || ''));
      setDate(transactionToPrefill.date || new Date().toISOString().split('T')[0]);
      setCategory(transactionToPrefill.category || (allCategories.length > 0 ? allCategories[0].id : ''));
      setPaymentMethod(isIncome ? PaymentMethod.CASH : (transactionToPrefill.paymentMethod || PaymentMethod.CASH));
      setCreditCardId(isIncome ? '' : (transactionToPrefill.creditCardId || (creditCards.length > 0 ? creditCards[0].id : '')));
      setFormType(isIncome ? 'income' : 'expense');
    }
  }, [isEditing, transactionToEdit, transactionToPrefill, creditCards, allCategories]);

  const handleTabChange = (newType: FormType) => {
    setFormType(newType);
    if (newType === 'income') {
      // Income can never be paid by credit card
      setPaymentMethod(PaymentMethod.CASH);
      setCreditCardId('');
    } else if (newType === 'installment') {
      // Installments require credit card
      setPaymentMethod(PaymentMethod.CREDIT_CARD);
      if (!creditCardId && creditCards.length > 0) {
        setCreditCardId(creditCards[0].id);
      }
    } else if (newType === 'expense' || newType === 'recurring') {
      if (paymentMethod === PaymentMethod.CREDIT_CARD && !creditCardId && creditCards.length > 0) {
        setCreditCardId(creditCards[0].id);
      }
    }
  };

  useEffect(() => {
    if (isEditing || transactionToPrefill) return;

    const availableCategories = allCategories.filter((c) =>
      formType === 'income'
        ? ['salary', 'investment', 'other'].includes(c.id)
        : !['salary', 'investment'].includes(c.id)
    );

    if (!availableCategories.some((c) => c.id === category)) {
      if (availableCategories.length > 0) {
        setCategory(availableCategories[0].id);
      }
    }
  }, [formType, category, isEditing, transactionToPrefill, allCategories]);

  const availableCategories = useMemo(() => {
    return allCategories.filter((c) =>
      formType === 'income'
        ? ['salary', 'investment', 'other'].includes(c.id)
        : !['salary', 'investment'].includes(c.id)
    );
  }, [allCategories, formType]);

  // Installment calculation preview
  const installmentPreview = useMemo(() => {
    if (formType !== 'installment') return null;
    const num = parseInt(installments, 10) || 2;
    const val = parseFloat(amount) || 0;
    if (val <= 0 || num < 2) return null;

    const eachAmount = val / num;
    const purchaseDate = parseISODateAsUTC(date) || new Date();
    const lastDate = new Date(
      Date.UTC(
        purchaseDate.getUTCFullYear(),
        purchaseDate.getUTCMonth() + num - 1,
        purchaseDate.getUTCDate()
      )
    );

    return {
      count: num,
      eachAmount,
      firstDate: purchaseDate,
      lastDate,
    };
  }, [formType, installments, amount, date]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount);
    if (!description.trim() || isNaN(numericAmount) || numericAmount <= 0) {
      onError('Erro de Validação', 'Por favor, preencha a descrição e um valor numérico válido.');
      return;
    }

    if (isEditing && transactionToEdit) {
      const isIncome = formType === 'income';
      const updatedTransaction: Transaction = {
        ...transactionToEdit,
        description,
        amount: numericAmount,
        date,
        category,
        type: isIncome ? TransactionType.INCOME : TransactionType.EXPENSE,
        paymentMethod: isIncome ? PaymentMethod.CASH : paymentMethod,
        creditCardId: isIncome ? null : (paymentMethod === PaymentMethod.CREDIT_CARD ? creditCardId : null),
      };
      onUpdateTransaction(updatedTransaction);
    } else {
      if (formType === 'recurring') {
        onAddRecurringTransaction({
          description,
          amount: numericAmount,
          date,
          type: TransactionType.EXPENSE,
          category,
          paymentMethod,
          creditCardId: paymentMethod === PaymentMethod.CREDIT_CARD ? creditCardId : null,
        });
      } else {
        let newTransactions: Omit<Transaction, 'id'>[] = [];

        if (formType === 'income') {
          newTransactions.push({
            description,
            amount: numericAmount,
            date,
            type: TransactionType.INCOME,
            category,
            paymentMethod: PaymentMethod.CASH,
            creditCardId: null,
          });
        } else if (formType === 'expense') {
          newTransactions.push({
            description,
            amount: numericAmount,
            date,
            type: TransactionType.EXPENSE,
            category,
            paymentMethod,
            creditCardId: paymentMethod === PaymentMethod.CREDIT_CARD ? creditCardId : null,
          });
        } else if (formType === 'installment') {
          const installmentCount = parseInt(installments, 10);
          if (installmentCount < 2) {
            onError('Erro de Validação', 'O número de parcelas deve ser no mínimo 2.');
            return;
          }
          const installmentAmount = numericAmount / installmentCount;
          const installmentId = uuidv4();

          const purchaseDateUTC = parseISODateAsUTC(date);
          if (isNaN(purchaseDateUTC.getTime())) {
            onError('Data Inválida', 'A data da compra é inválida.');
            return;
          }

          for (let i = 0; i < installmentCount; i++) {
            const installmentDate = new Date(
              Date.UTC(
                purchaseDateUTC.getUTCFullYear(),
                purchaseDateUTC.getUTCMonth() + i,
                purchaseDateUTC.getUTCDate()
              )
            );

            newTransactions.push({
              description: `${description} ${i + 1}/${installmentCount}`,
              amount: installmentAmount,
              date: installmentDate.toISOString().split('T')[0],
              type: TransactionType.EXPENSE,
              category,
              paymentMethod: PaymentMethod.CREDIT_CARD,
              creditCardId: creditCardId,
              installmentId,
            });
          }
        }
        onAddTransaction(newTransactions);
      }
    }
    onClose();
  };

  // Dynamic Theme Styling according to formType
  const typeConfig = {
    expense: {
      color: 'rose',
      ctaGradient: 'from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 shadow-rose-600/25',
      heroBg: 'bg-rose-500/10 border-rose-500/20 focus-within:border-rose-500/50',
      textAccent: 'text-rose-400',
      tagText: 'Saída',
      badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
    },
    income: {
      color: 'emerald',
      ctaGradient: 'from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 shadow-emerald-600/25',
      heroBg: 'bg-emerald-500/10 border-emerald-500/20 focus-within:border-emerald-500/50',
      textAccent: 'text-emerald-400',
      tagText: 'Entrada',
      badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    },
    installment: {
      color: 'indigo',
      ctaGradient: 'from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-600/25',
      heroBg: 'bg-indigo-500/10 border-indigo-500/20 focus-within:border-indigo-500/50',
      textAccent: 'text-indigo-400',
      tagText: 'Parcelamento',
      badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    },
    recurring: {
      color: 'blue',
      ctaGradient: 'from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 shadow-blue-600/25',
      heroBg: 'bg-blue-500/10 border-blue-500/20 focus-within:border-blue-500/50',
      textAccent: 'text-blue-400',
      tagText: 'Recorrente',
      badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    },
  }[formType];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="glass-card rounded-3xl border border-white/10 shadow-2xl w-full max-w-lg overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        <form onSubmit={handleSave}>
          {/* Header */}
          <div className="p-5 sm:p-6 border-b border-white/[0.08] flex justify-between items-center bg-slate-900/60">
            <div>
              <h2 className="text-xl font-extrabold text-white tracking-tight">
                {isEditing ? 'Editar Transação' : 'Nova Transação'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                {isEditing ? 'Altere os dados da movimentação' : 'Registre uma nova entrada, saída ou compra parcelada'}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors flex items-center justify-center text-sm"
              aria-label="Fechar"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto custom-scrollbar">
            {/* Form Type Segmented Tabs (hidden on edit) */}
            {!isEditing && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 p-1 bg-slate-900/80 rounded-2xl border border-white/[0.08]">
                <button
                  type="button"
                  onClick={() => handleTabChange('expense')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    formType === 'expense'
                      ? 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-md shadow-rose-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <i className="fa-solid fa-arrow-trend-down text-xs"></i>
                  <span>Despesa</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange('income')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    formType === 'income'
                      ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <i className="fa-solid fa-arrow-trend-up text-xs"></i>
                  <span>Receita</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange('installment')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    formType === 'installment'
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <i className="fa-solid fa-layer-group text-xs"></i>
                  <span>Parcelada</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleTabChange('recurring')}
                  className={`py-2 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                    formType === 'recurring'
                      ? 'bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-600/30'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <i className="fa-solid fa-repeat text-xs"></i>
                  <span>Recorrente</span>
                </button>
              </div>
            )}

            {/* Hero Amount Input */}
            <div className={`p-4 rounded-2xl border transition-all ${typeConfig.heroBg}`}>
              <div className="flex items-center justify-between text-xs font-semibold text-slate-400 mb-1">
                <span>
                  {formType === 'installment' && !isEditing
                    ? 'Valor Total da Compra'
                    : formType === 'income'
                    ? 'Valor da Entrada'
                    : 'Valor da Movimentação'}
                </span>
                <span className={`font-bold uppercase text-[10px] px-2 py-0.5 rounded-full border ${typeConfig.badgeClass}`}>
                  {typeConfig.tagText}
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className={`text-2xl sm:text-3xl font-extrabold ${typeConfig.textAccent}`}>R$</span>
                <input
                  type="number"
                  step="0.01"
                  id="amount"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={`w-full bg-transparent text-3xl sm:text-4xl font-extrabold focus:outline-none tabular-nums placeholder-slate-600 ${typeConfig.textAccent}`}
                  placeholder="0,00"
                  autoFocus
                  required
                />
              </div>

              {/* Quick Increment Chips */}
              <div className="flex items-center gap-1.5 mt-3 pt-2.5 border-t border-white/[0.06] overflow-x-auto custom-scrollbar">
                {[10, 20, 50, 100, 200, 500].map((val) => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => {
                      const curr = parseFloat(amount) || 0;
                      setAmount(String(curr + val));
                    }}
                    className="px-2 py-1 rounded-lg bg-white/[0.06] hover:bg-white/15 text-slate-300 hover:text-white text-[11px] font-semibold transition-colors flex-shrink-0"
                  >
                    +{val}
                  </button>
                ))}
                {amount && (
                  <button
                    type="button"
                    onClick={() => setAmount('')}
                    className="px-2 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 text-[11px] font-semibold transition-colors flex-shrink-0 ml-auto"
                  >
                    Limpar
                  </button>
                )}
              </div>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Descrição
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-sm">
                  <i className="fa-solid fa-pen-nib"></i>
                </div>
                <input
                  type="text"
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-500 transition-all"
                  placeholder="Ex: Supermercado, Salário, Internet..."
                  required
                />
              </div>
            </div>

            {/* Date Input */}
            <div>
              <label htmlFor="date" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                {(formType === 'installment' || formType === 'recurring') && !isEditing
                  ? 'Data da 1ª Parcela / Início'
                  : 'Data da Movimentação'}
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-sm">
                  <i className="fa-regular fa-calendar"></i>
                </div>
                <input
                  type="date"
                  id="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  required
                />
              </div>
            </div>

            {/* Category Selector Grid */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Categoria
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                {availableCategories.map((c) => {
                  const isSelected = category === c.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all ${
                        isSelected
                          ? 'bg-blue-600/25 border-blue-500 text-white ring-1 ring-blue-500/50 shadow-sm'
                          : 'bg-slate-900/60 border-white/[0.06] text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                      }`}
                    >
                      <div
                        className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0 ${
                          isSelected ? 'bg-blue-500 text-white shadow' : 'bg-slate-800 text-slate-400'
                        }`}
                      >
                        <i className={c.icon || 'fa-solid fa-tag'}></i>
                      </div>
                      <span className="text-xs font-medium truncate">{c.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Payment Method (for Expense or Recurring) */}
            {(formType === 'expense' || formType === 'recurring') && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Forma de Pagamento
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: PaymentMethod.CASH, label: 'Dinheiro', icon: 'fa-money-bill-wave' },
                    { id: PaymentMethod.DEBIT, label: 'Débito', icon: 'fa-money-check' },
                    { id: PaymentMethod.CREDIT_CARD, label: 'Cartão', icon: 'fa-credit-card' },
                  ].map((pm) => {
                    const isSelected = paymentMethod === pm.id;
                    return (
                      <button
                        key={pm.id}
                        type="button"
                        onClick={() => setPaymentMethod(pm.id)}
                        className={`py-2 px-2 rounded-xl border text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? 'bg-blue-600/20 border-blue-500 text-white ring-1 ring-blue-500/50'
                            : 'bg-slate-900/60 border-white/[0.06] text-slate-400 hover:text-white hover:bg-slate-800/60'
                        }`}
                      >
                        <i className={`fa-solid ${pm.icon} text-xs`}></i>
                        <span className="truncate">{pm.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Credit Card Selector (Never for Income) */}
            {formType !== 'income' && (paymentMethod === PaymentMethod.CREDIT_CARD || formType === 'installment') && (
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                  Cartão de Crédito
                </label>
                {creditCards.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {creditCards.map((cc) => {
                      const isSelected = creditCardId === cc.id;
                      const cardTheme = getCardTheme(cc.theme, cc.name);
                      return (
                        <button
                          key={cc.id}
                          type="button"
                          onClick={() => setCreditCardId(cc.id)}
                          className={`flex items-center gap-2.5 p-2.5 rounded-xl border text-left transition-all ${
                            isSelected
                              ? 'bg-blue-600/20 border-blue-500 text-white ring-1 ring-blue-500/50'
                              : 'bg-slate-900/60 border-white/[0.06] text-slate-400 hover:text-white hover:bg-slate-800/60'
                          }`}
                        >
                          <div className={`w-7 h-5 rounded-md ${cardTheme.previewBg} border border-white/20 flex-shrink-0`}></div>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-xs text-slate-200 truncate">{cc.name}</p>
                            <p className="text-[10px] text-slate-500">Venc. dia {cc.dueDay}</p>
                          </div>
                          {isSelected && <i className="fa-solid fa-circle-check text-blue-400 text-xs ml-auto"></i>}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-slate-900/60 p-3 rounded-xl border border-amber-500/20 text-xs text-amber-300 flex items-center gap-2">
                    <i className="fa-solid fa-triangle-exclamation"></i>
                    <span>Nenhum cartão cadastrado. Vá até a aba Cartões para cadastrar.</span>
                  </div>
                )}
              </div>
            )}

            {/* Installments Configuration & Live Breakdown Preview */}
            {formType === 'installment' && !isEditing && (
              <div className="space-y-3 bg-slate-900/50 p-4 rounded-2xl border border-white/[0.05]">
                <div className="flex justify-between items-center">
                  <label htmlFor="installments" className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Número de Parcelas
                  </label>
                  <span className="text-xs font-bold text-indigo-400 tabular-nums">{installments}x</span>
                </div>

                {/* Quick installment shortcuts */}
                <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
                  {[2, 3, 4, 5, 6, 8, 10, 12, 18, 24].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setInstallments(String(n))}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all flex-shrink-0 ${
                        parseInt(installments, 10) === n
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {n}x
                    </button>
                  ))}
                </div>

                {/* Live Installment Breakdown */}
                {installmentPreview && (
                  <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between font-bold text-white">
                      <span>Plano de Parcelas:</span>
                      <span className="text-indigo-300 tabular-nums">
                        {installmentPreview.count}x de {formatCurrency(installmentPreview.eachAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between text-slate-400 text-[11px] pt-1 border-t border-indigo-500/15">
                      <span>Início: {installmentPreview.firstDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                      <span>Término: {installmentPreview.lastDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="p-5 sm:p-6 bg-slate-900/80 border-t border-white/[0.08] flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-colors text-xs font-semibold border border-white/[0.05]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className={`px-5 py-2.5 bg-gradient-to-r ${typeConfig.ctaGradient} text-white rounded-xl transition-all text-xs font-bold shadow-lg active:scale-95`}
            >
              <i className={`fa-solid ${isEditing ? 'fa-check' : 'fa-plus'} mr-1.5`}></i>
              {isEditing ? 'Salvar Alterações' : 'Confirmar e Lançar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddTransactionModal;