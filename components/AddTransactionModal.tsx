import React, { useState, useEffect } from 'react';
import { Transaction, CreditCard, TransactionType, PaymentMethod, Category, RecurringTransaction } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { parseISODateAsUTC } from '../utils/dateUtils';

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

const AddTransactionModal: React.FC<AddTransactionModalProps> = ({ onClose, onAddTransaction, onUpdateTransaction, onAddRecurringTransaction, creditCards, transactionToEdit, transactionToPrefill, allCategories, onError }) => {
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
        setDescription(t.description);
        setAmount(String(t.amount));
        setDate(t.date);
        setCategory(t.category);
        setPaymentMethod(t.paymentMethod || PaymentMethod.CASH);
        setCreditCardId(t.creditCardId || (creditCards.length > 0 ? creditCards[0].id : ''));
        setFormType(t.type === TransactionType.INCOME ? 'income' : 'expense');
    } else if (transactionToPrefill) {
        setDescription(transactionToPrefill.description || '');
        setAmount(String(transactionToPrefill.amount || ''));
        setDate(transactionToPrefill.date || new Date().toISOString().split('T')[0]);
        setCategory(transactionToPrefill.category || (allCategories.length > 0 ? allCategories[0].id : ''));
        setPaymentMethod(transactionToPrefill.paymentMethod || PaymentMethod.CASH);
        setFormType(transactionToPrefill.type === TransactionType.INCOME ? 'income' : 'expense');
    }
  }, [isEditing, transactionToEdit, transactionToPrefill, creditCards, allCategories]);
  
  useEffect(() => {
    if (isEditing || transactionToPrefill) return;

    const availableCategories = allCategories.filter(c => 
        formType === 'income' ? ['salary', 'investment', 'other'].includes(c.id) : !['salary', 'investment'].includes(c.id)
    );

    if (!availableCategories.some(c => c.id === category)) {
        if (availableCategories.length > 0) {
            setCategory(availableCategories[0].id);
        }
    }
  }, [formType, category, isEditing, transactionToPrefill, allCategories]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const numericAmount = parseFloat(amount);
    if (!description.trim() || isNaN(numericAmount) || numericAmount <= 0) {
      onError("Erro de Validação", "Por favor, preencha a descrição e um valor válido.");
      return;
    }

    if (isEditing && transactionToEdit) {
        const updatedTransaction: Transaction = {
            ...transactionToEdit,
            description,
            amount: numericAmount,
            date,
            category,
            paymentMethod: transactionToEdit.type === TransactionType.INCOME ? transactionToEdit.paymentMethod : paymentMethod,
            creditCardId: transactionToEdit.type === TransactionType.INCOME ? null : (paymentMethod === PaymentMethod.CREDIT_CARD ? creditCardId : null),
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
                    onError("Erro de Validação", "O número de parcelas deve ser no mínimo 2.");
                    return;
                }
                const installmentAmount = numericAmount / installmentCount;
                const installmentId = uuidv4();
                
                const purchaseDateUTC = parseISODateAsUTC(date);
                if (isNaN(purchaseDateUTC.getTime())) {
                    onError("Data Inválida", "A data da compra é inválida.");
                    return;
                }

                for (let i = 0; i < installmentCount; i++) {
                    const installmentDate = new Date(Date.UTC(
                        purchaseDateUTC.getUTCFullYear(),
                        purchaseDateUTC.getUTCMonth() + i,
                        purchaseDateUTC.getUTCDate()
                    ));

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
  
  const TabButton: React.FC<{type: FormType, label: string, disabled?: boolean}> = ({ type, label, disabled }) => (
      <button
        type="button"
        onClick={() => setFormType(type)}
        disabled={disabled}
        className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${formType === type ? 'bg-blue-600 text-white' : 'bg-gray-600 text-gray-300 hover:bg-gray-500'} disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed`}
      >{label}</button>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md max-h-full overflow-y-auto custom-scrollbar">
        <form onSubmit={handleSave}>
            <div className="p-6 border-b border-gray-700">
                <h2 className="text-xl font-bold text-white">{isEditing ? 'Editar Transação' : 'Adicionar Transação'}</h2>
            </div>
            <div className="p-6">
                {!isEditing && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
                        <TabButton type="expense" label="Despesa" />
                        <TabButton type="income" label="Receita" />
                        <TabButton type="installment" label="Parcelada" />
                        <TabButton type="recurring" label="Recorrente" />
                    </div>
                )}
                
                <div className="space-y-4">
                    <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-300 mb-1">Descrição</label>
                        <input type="text" id="description" value={description} onChange={e => setDescription(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                     <div>
                        <label htmlFor="amount" className="block text-sm font-medium text-gray-300 mb-1">
                          {(formType === 'installment' && !isEditing) ? 'Valor Total' : 'Valor'}
                        </label>
                        <input type="number" id="amount" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500" placeholder="0.00" />
                    </div>
                     <div>
                        <label htmlFor="date" className="block text-sm font-medium text-gray-300 mb-1">
                          {(formType === 'installment' || formType === 'recurring') && !isEditing ? 'Data da primeira' : 'Data'}
                        </label>
                        <input type="date" id="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500" />
                    </div>
                    <div>
                        <label htmlFor="category" className="block text-sm font-medium text-gray-300 mb-1">Categoria</label>
                        <select id="category" value={category} onChange={e => setCategory(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500">
                            {allCategories.filter(c => formType === 'income' ? ['salary', 'investment', 'other'].includes(c.id) : !['salary', 'investment'].includes(c.id)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                    </div>
                    {(formType === 'expense' || formType === 'recurring') && (
                        <div>
                            <label htmlFor="paymentMethod" className="block text-sm font-medium text-gray-300 mb-1">Método de Pagamento</label>
                            <select id="paymentMethod" value={paymentMethod} onChange={e => setPaymentMethod(e.target.value as PaymentMethod)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500">
                                <option value={PaymentMethod.CASH}>Dinheiro</option>
                                <option value={PaymentMethod.DEBIT}>Débito</option>
                                <option value={PaymentMethod.CREDIT_CARD}>Cartão de Crédito</option>
                            </select>
                        </div>
                    )}
                    {(paymentMethod === PaymentMethod.CREDIT_CARD || formType === 'installment') && (
                         <div>
                            <label htmlFor="creditCardId" className="block text-sm font-medium text-gray-300 mb-1">Cartão de Crédito</label>
                            <select id="creditCardId" value={creditCardId} onChange={e => setCreditCardId(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500">
                                {creditCards.map(cc => <option key={cc.id} value={cc.id}>{cc.name}</option>)}
                            </select>
                        </div>
                    )}
                    {formType === 'installment' && !isEditing && (
                        <div>
                             <label htmlFor="installments" className="block text-sm font-medium text-gray-300 mb-1">Número de Parcelas</label>
                             <input type="number" id="installments" value={installments} onChange={e => setInstallments(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500" min="2" />
                        </div>
                    )}
                </div>
            </div>
            <div className="px-6 py-4 bg-gray-800 border-t border-gray-700 flex justify-end gap-3">
                <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500">Cancelar</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">{isEditing ? 'Salvar' : 'Adicionar'}</button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default AddTransactionModal;