import React, { useState, useMemo, useEffect } from 'react';
import { CreditCard, Transaction, TransactionType, Category } from '../types';
import { getCurrentOpenBillInfo, getMostRecentlyClosedBillInfo, BillInfo, parseISODateAsUTC } from '../utils/dateUtils';
import BillHistoryModal from './BillHistoryModal';

const formatCurrency = (value: number) => {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

// --- Credit Card Modal Component ---
interface CreditCardModalProps {
    onClose: () => void;
    onSave: (card: Omit<CreditCard, 'id'> | CreditCard) => void;
    cardToEdit: CreditCard | null;
}

const CreditCardModal: React.FC<CreditCardModalProps> = ({ onClose, onSave, cardToEdit }) => {
    const [name, setName] = useState('');
    const [limit, setLimit] = useState('');
    const [closingDay, setClosingDay] = useState('');
    const [dueDay, setDueDay] = useState('');
    const [errors, setErrors] = useState<{ [key: string]: string }>({});

    useEffect(() => {
        if (cardToEdit) {
            setName(cardToEdit.name);
            setLimit(String(cardToEdit.limit));
            setClosingDay(String(cardToEdit.closingDay));
            setDueDay(String(cardToEdit.dueDay));
        }
    }, [cardToEdit]);

    const validate = () => {
        const newErrors: { [key: string]: string } = {};
        if (!name.trim()) newErrors.name = "Nome é obrigatório.";
        if (!limit || isNaN(Number(limit)) || Number(limit) <= 0) newErrors.limit = "Limite inválido.";
        const cDay = Number(closingDay);
        if (!closingDay || isNaN(cDay) || cDay < 1 || cDay > 31) newErrors.closingDay = "Dia inválido (1-31).";
        const dDay = Number(dueDay);
        if (!dueDay || isNaN(dDay) || dDay < 1 || dDay > 31) newErrors.dueDay = "Dia inválido (1-31).";

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!validate()) return;
        
        const commonData = {
            name,
            limit: parseFloat(limit),
            closingDay: parseInt(closingDay, 10),
            dueDay: parseInt(dueDay, 10),
        };

        const saveData = cardToEdit
            ? { ...commonData, id: cardToEdit.id }
            : commonData;
        
        onSave(saveData);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-lg shadow-xl w-full max-w-md">
                <form onSubmit={handleSubmit} noValidate>
                    <div className="p-6 border-b border-gray-700">
                        <h2 className="text-xl font-bold text-white">{cardToEdit ? 'Editar Cartão' : 'Adicionar Cartão'}</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label htmlFor="cardName" className="block text-sm font-medium text-gray-300 mb-1">Nome do Cartão</label>
                            <input type="text" id="cardName" value={name} onChange={e => setName(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500" required />
                            {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
                        </div>
                        <div>
                            <label htmlFor="cardLimit" className="block text-sm font-medium text-gray-300 mb-1">Limite (R$)</label>
                            <input type="number" id="cardLimit" value={limit} onChange={e => setLimit(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white focus:ring-blue-500 focus:border-blue-500" placeholder="5000.00" required />
                            {errors.limit && <p className="text-red-400 text-xs mt-1">{errors.limit}</p>}
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                             <div>
                                <label htmlFor="closingDay" className="block text-sm font-medium text-gray-300 mb-1">Dia de Fechamento</label>
                                <input type="number" id="closingDay" value={closingDay} onChange={e => setClosingDay(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" min="1" max="31" required />
                                {errors.closingDay && <p className="text-red-400 text-xs mt-1">{errors.closingDay}</p>}
                            </div>
                            <div>
                                <label htmlFor="dueDay" className="block text-sm font-medium text-gray-300 mb-1">Dia de Vencimento</label>
                                <input type="number" id="dueDay" value={dueDay} onChange={e => setDueDay(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded-md px-3 py-2 text-white" min="1" max="31" required />
                                {errors.dueDay && <p className="text-red-400 text-xs mt-1">{errors.dueDay}</p>}
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-4 bg-gray-800 border-t border-gray-700 flex justify-end gap-3">
                        <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-500">Cancelar</button>
                        <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
    );
};


// --- Card Bill View Component ---
interface CardBillViewProps {
  card: CreditCard;
  transactions: Transaction[];
  allCategories: Category[];
  onEdit: (card: CreditCard) => void;
  onDelete: (cardId: string) => void;
  onViewHistory: (card: CreditCard) => void;
}

const CardBillView: React.FC<CardBillViewProps> = ({ card, transactions, onEdit, onDelete, onViewHistory, allCategories }) => {
    // Shows the current open bill by default, with option to view the recently closed bill
    const [billType, setBillType] = useState<'current' | 'closed'>('current');

    const billInfo: BillInfo = useMemo(() => {
        const today = new Date();
        return billType === 'current'
            ? getCurrentOpenBillInfo(card, today)
            : getMostRecentlyClosedBillInfo(card, today);
    }, [card, billType]);

    const billTransactions = useMemo(() => {
        return transactions.filter(t => {
            const transactionDate = parseISODateAsUTC(t.date);
            return (
                t.creditCardId === card.id &&
                t.type === TransactionType.EXPENSE &&
                transactionDate >= billInfo.startDate &&
                transactionDate <= billInfo.endDate
            );
        }).sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [transactions, card.id, billInfo]);

    const billTotal = useMemo(() => {
        return billTransactions.reduce((sum, t) => sum + t.amount, 0);
    }, [billTransactions]);

    return (
        <div className="bg-gray-800 p-6 rounded-xl shadow-lg flex flex-col h-full">
            <div className="flex justify-between items-start mb-3">
                <div>
                    <h3 className="text-xl font-bold text-white">{card.name}</h3>
                    <p className="text-sm text-gray-400">Limite: {formatCurrency(card.limit)}</p>
                </div>
                 <div className="text-right">
                    <div className="flex items-center justify-end gap-3">
                        <button onClick={() => onEdit(card)} className="text-gray-400 hover:text-white transition-colors p-1" aria-label={`Editar cartão ${card.name}`}>
                            <i className="fa-solid fa-pencil"></i>
                        </button>
                        <button onClick={() => onDelete(card.id)} className="text-gray-400 hover:text-red-500 transition-colors p-1" aria-label={`Excluir cartão ${card.name}`}>
                            <i className="fa-solid fa-trash"></i>
                        </button>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">{billType === 'current' ? 'Fatura Atual (Aberta)' : 'Fatura Fechada (Anterior)'}</p>
                    <p className="text-2xl font-bold text-orange-400">{formatCurrency(billTotal)}</p>
                </div>
            </div>

            {/* Bill Type Selector (Tabs) */}
            <div className="flex bg-gray-900/60 p-1 rounded-lg mb-3">
                <button
                    type="button"
                    onClick={() => setBillType('current')}
                    className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                        billType === 'current'
                            ? 'bg-blue-600 text-white shadow'
                            : 'text-gray-400 hover:text-white'
                    }`}
                >
                    <i className="fa-solid fa-folder-open text-xs"></i>
                    <span>Fatura Atual (Aberta)</span>
                </button>
                <button
                    type="button"
                    onClick={() => setBillType('closed')}
                    className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-1.5 ${
                        billType === 'closed'
                            ? 'bg-gray-700 text-white shadow'
                            : 'text-gray-400 hover:text-white'
                    }`}
                >
                    <i className="fa-solid fa-lock text-xs"></i>
                    <span>Fatura Fechada</span>
                </button>
            </div>

            <div className="text-sm text-gray-400 flex justify-between border-b border-gray-700 pb-2 mb-4">
                <span>
                    {billType === 'current' ? 'Fecha em: ' : 'Fechou em: '}
                    <span className="text-gray-200 font-medium">{billInfo.endDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                </span>
                <span>
                    {billType === 'current' ? 'Vence em: ' : 'Venceu em: '}
                    <span className="text-gray-200 font-medium">{billInfo.dueDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</span>
                </span>
            </div>

            <div className="space-y-3 flex-1 overflow-y-auto pr-2 custom-scrollbar" style={{maxHeight: '20rem'}}>
                {billTransactions.length > 0 ? billTransactions.map(t => {
                    const category = allCategories.find(c => c.id === t.category);
                    return (
                        <div key={t.id} className="flex justify-between items-center bg-gray-700/50 p-3 rounded-md">
                            <div className="flex items-center gap-3">
                               <div className="text-gray-400 text-lg w-6 text-center"><i className={category?.icon}></i></div>
                               <div>
                                  <p className="font-semibold text-gray-200">{t.description}</p>
                                  <p className="text-xs text-gray-500">{new Date(t.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>
                               </div>
                            </div>
                            <p className="font-medium text-gray-300">{formatCurrency(t.amount)}</p>
                        </div>
                    )
                }) : (
                    <div className="text-center py-8 flex flex-col items-center justify-center h-full">
                        <i className="fa-solid fa-leaf text-3xl text-gray-600 mb-2"></i>
                        <p className="text-gray-500">Nenhuma despesa nesta fatura.</p>
                    </div>
                )}
            </div>
             <div className="mt-auto pt-4">
                <button
                    onClick={() => onViewHistory(card)}
                    className="w-full text-center py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors text-sm font-semibold"
                >
                    Ver Histórico de Faturas
                </button>
            </div>
        </div>
    )
};


// --- Main Component ---
interface CardsManagementProps {
  creditCards: CreditCard[];
  onAddCard: (card: Omit<CreditCard, 'id'>) => void;
  onUpdateCard: (card: CreditCard) => void;
  transactions: Transaction[];
  allCategories: Category[];
  onDeleteCard: (cardId: string) => void;
}

const CardsManagement: React.FC<CardsManagementProps> = ({ creditCards, onAddCard, onUpdateCard, transactions, onDeleteCard, allCategories }) => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCard, setEditingCard] = useState<CreditCard | null>(null);
    const [viewingHistoryForCard, setViewingHistoryForCard] = useState<CreditCard | null>(null);

    const handleOpenModal = (card: CreditCard | null) => {
        setEditingCard(card);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCard(null);
    };

    const handleSaveCard = (cardData: Omit<CreditCard, 'id'> | CreditCard) => {
        if ('id' in cardData && cardData.id) {
            onUpdateCard(cardData as CreditCard);
        } else {
            onAddCard(cardData as Omit<CreditCard, 'id'>);
        }
        handleCloseModal();
    };
    
    const handleViewHistory = (card: CreditCard) => {
        setViewingHistoryForCard(card);
    };

    const handleCloseHistory = () => {
        setViewingHistoryForCard(null);
    };

  return (
    <div className="space-y-6">
       <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h1 className="text-3xl font-bold text-white">Meus Cartões de Crédito</h1>
            <button 
                onClick={() => handleOpenModal(null)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-lg"
            >
                <i className="fa-solid fa-plus"></i>
                <span>Adicionar Cartão</span>
            </button>
        </div>

      {creditCards.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {creditCards.map(card => (
            <CardBillView 
                key={card.id} 
                card={card} 
                transactions={transactions} 
                allCategories={allCategories}
                onEdit={handleOpenModal}
                onDelete={onDeleteCard}
                onViewHistory={handleViewHistory}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-gray-800 rounded-lg mt-6">
          <i className="fa-solid fa-credit-card text-5xl text-gray-500 mb-4"></i>
          <p className="text-gray-400 text-xl">Nenhum cartão de crédito cadastrado.</p>
          <p className="text-gray-500">Clique em "Adicionar Cartão" para começar.</p>
        </div>
      )}

      {isModalOpen && (
          <CreditCardModal
              onClose={handleCloseModal}
              onSave={handleSaveCard}
              cardToEdit={editingCard}
          />
      )}

      {viewingHistoryForCard && (
        <BillHistoryModal
            card={viewingHistoryForCard}
            transactions={transactions}
            onClose={handleCloseHistory}
            allCategories={allCategories}
        />
      )}
    </div>
  );
};

export default CardsManagement;