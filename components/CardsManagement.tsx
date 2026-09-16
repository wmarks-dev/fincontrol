import React, { useState, useMemo, useEffect } from 'react';
import { CreditCard, Transaction, TransactionType, Category } from '../types';
import { getCurrentOpenBillInfo, getMostRecentlyClosedBillInfo, BillInfo, parseISODateAsUTC } from '../utils/dateUtils';
import BillHistoryModal from './BillHistoryModal';
import { RealisticCreditCard, CARD_THEMES, CardThemeKey } from './RealisticCreditCard';

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
  const [theme, setTheme] = useState<CardThemeKey>('black');
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (cardToEdit) {
      setName(cardToEdit.name);
      setLimit(String(cardToEdit.limit));
      setClosingDay(String(cardToEdit.closingDay));
      setDueDay(String(cardToEdit.dueDay));
      setTheme((cardToEdit.theme as CardThemeKey) || 'black');
    } else {
      setName('');
      setLimit('');
      setClosingDay('');
      setDueDay('');
      setTheme('black');
    }
  }, [cardToEdit]);

  const validate = () => {
    const newErrors: { [key: string]: string } = {};
    if (!name.trim()) newErrors.name = 'Nome é obrigatório.';
    if (!limit || isNaN(Number(limit)) || Number(limit) <= 0) newErrors.limit = 'Limite inválido.';
    const cDay = Number(closingDay);
    if (!closingDay || isNaN(cDay) || cDay < 1 || cDay > 31) newErrors.closingDay = 'Dia inválido (1-31).';
    const dDay = Number(dueDay);
    if (!dueDay || isNaN(dDay) || dDay < 1 || dDay > 31) newErrors.dueDay = 'Dia inválido (1-31).';

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
      theme,
    };

    const saveData = cardToEdit ? { ...commonData, id: cardToEdit.id } : commonData;

    onSave(saveData);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="glass-card rounded-3xl border border-white/10 shadow-2xl w-full max-w-lg overflow-hidden my-8 animate-in fade-in zoom-in-95 duration-200">
        <form onSubmit={handleSubmit} noValidate>
          {/* Modal Header */}
          <div className="p-5 sm:p-6 border-b border-white/[0.08] flex justify-between items-center bg-slate-900/60">
            <div>
              <h2 className="text-xl font-extrabold text-white tracking-tight">
                {cardToEdit ? 'Editar Cartão' : 'Novo Cartão de Crédito'}
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">Personalize o design e os parâmetros da fatura</p>
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
            {/* Live Interactive Card Preview */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Pré-visualização em Tempo Real
                </span>
                <span className="text-[10px] text-slate-500 font-medium">Design Físico</span>
              </div>
              <div className="max-w-[320px] sm:max-w-[340px] mx-auto py-1">
                <RealisticCreditCard
                  name={name || 'Seu Cartão'}
                  closingDay={Number(closingDay) || 1}
                  dueDay={Number(dueDay) || 10}
                  themeKey={theme}
                  interactive={false}
                />
              </div>
            </div>

            {/* Theme Selector */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Estilo & Cor do Cartão
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {(Object.keys(CARD_THEMES) as CardThemeKey[]).map((thKey) => {
                  const th = CARD_THEMES[thKey];
                  const isSelected = theme === thKey;
                  return (
                    <button
                      key={thKey}
                      type="button"
                      onClick={() => setTheme(thKey)}
                      className={`flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all ${
                        isSelected
                          ? 'border-blue-500 bg-blue-500/15 ring-2 ring-blue-500/30'
                          : 'border-white/10 bg-slate-800/60 hover:bg-slate-700/60 hover:border-white/20'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-full ${th.previewBg} border border-white/30 shadow-sm`}></div>
                      <span className="text-[10px] font-semibold text-slate-300 truncate w-full text-center">
                        {th.name.split(' ')[0]}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Name Input */}
            <div>
              <label htmlFor="cardName" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Nome do Cartão (ou Banco)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-sm">
                  <i className="fa-solid fa-credit-card"></i>
                </div>
                <input
                  type="text"
                  id="cardName"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-500 transition-all"
                  placeholder="Ex: Nubank Mastercard Black"
                  required
                />
              </div>
              {errors.name && <p className="text-rose-400 text-xs mt-1 font-medium">{errors.name}</p>}
            </div>

            {/* Limit Input */}
            <div>
              <label htmlFor="cardLimit" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                Limite Total de Crédito (R$)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-sm font-semibold">
                  R$
                </div>
                <input
                  type="number"
                  step="0.01"
                  id="cardLimit"
                  value={limit}
                  onChange={(e) => setLimit(e.target.value)}
                  className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-10 pr-3 py-2.5 text-white text-sm tabular-nums focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-500 transition-all"
                  placeholder="5000.00"
                  required
                />
              </div>
              {errors.limit && <p className="text-rose-400 text-xs mt-1 font-medium">{errors.limit}</p>}
            </div>

            {/* Dates Row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="closingDay" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Dia Fechamento
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                    <i className="fa-regular fa-calendar"></i>
                  </div>
                  <input
                    type="number"
                    id="closingDay"
                    value={closingDay}
                    onChange={(e) => setClosingDay(e.target.value)}
                    className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-white text-sm tabular-nums focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-500 transition-all"
                    placeholder="Ex: 15"
                    min="1"
                    max="31"
                    required
                  />
                </div>
                {errors.closingDay && <p className="text-rose-400 text-xs mt-1 font-medium">{errors.closingDay}</p>}
              </div>

              <div>
                <label htmlFor="dueDay" className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Dia Vencimento
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500 text-xs">
                    <i className="fa-solid fa-calendar-check"></i>
                  </div>
                  <input
                    type="number"
                    id="dueDay"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    className="w-full bg-slate-900/80 border border-white/10 rounded-xl pl-8 pr-3 py-2.5 text-white text-sm tabular-nums focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder-slate-500 transition-all"
                    placeholder="Ex: 22"
                    min="1"
                    max="31"
                    required
                  />
                </div>
                {errors.dueDay && <p className="text-rose-400 text-xs mt-1 font-medium">{errors.dueDay}</p>}
              </div>
            </div>
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
              className="px-5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl transition-all text-xs font-semibold shadow-lg shadow-blue-500/25 active:scale-95"
            >
              {cardToEdit ? 'Salvar Alterações' : 'Criar Cartão'}
            </button>
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
  onImportBill?: (cardId: string) => void;
}

const CardBillView: React.FC<CardBillViewProps> = ({
  card,
  transactions,
  onEdit,
  onDelete,
  onViewHistory,
  onImportBill,
  allCategories,
}) => {
  const [billType, setBillType] = useState<'current' | 'closed'>('current');

  const billInfo: BillInfo = useMemo(() => {
    const today = new Date();
    return billType === 'current' ? getCurrentOpenBillInfo(card, today) : getMostRecentlyClosedBillInfo(card, today);
  }, [card, billType]);

  const billTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        const transactionDate = parseISODateAsUTC(t.date);
        return (
          t.creditCardId === card.id &&
          t.type === TransactionType.EXPENSE &&
          transactionDate >= billInfo.startDate &&
          transactionDate <= billInfo.endDate
        );
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions, card.id, billInfo]);

  const billTotal = useMemo(() => {
    return billTransactions.reduce((sum, t) => sum + t.amount, 0);
  }, [billTransactions]);

  const availableLimit = Math.max(0, card.limit - billTotal);
  const usagePercentage = card.limit > 0 ? Math.min((billTotal / card.limit) * 100, 100) : 0;

  // Progress Bar Gradient
  let limitBarGradient = 'from-emerald-500 to-teal-400';
  let limitBadgeColor = 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
  if (usagePercentage > 85) {
    limitBarGradient = 'from-rose-500 to-red-600';
    limitBadgeColor = 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  } else if (usagePercentage > 60) {
    limitBarGradient = 'from-amber-500 to-yellow-400';
    limitBadgeColor = 'text-amber-400 bg-amber-500/10 border-amber-500/20';
  }

  return (
    <div className="glass-card p-5 sm:p-6 rounded-3xl border border-white/[0.08] shadow-2xl flex flex-col h-full hover:border-white/15 transition-all">
      {/* Top row: Status & Actions */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Cartão Ativo</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => onEdit(card)}
            className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-all flex items-center justify-center border border-white/[0.06] text-xs"
            title={`Editar cartão ${card.name}`}
          >
            <i className="fa-solid fa-pencil"></i>
          </button>
          <button
            onClick={() => onDelete(card.id)}
            className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition-all flex items-center justify-center border border-white/[0.06] text-xs"
            title={`Excluir cartão ${card.name}`}
          >
            <i className="fa-solid fa-trash"></i>
          </button>
        </div>
      </div>

      {/* Realistic Credit Card */}
      <div className="mb-5 max-w-[380px] w-full mx-auto">
        <RealisticCreditCard
          name={card.name}
          dueDay={card.dueDay}
          closingDay={card.closingDay}
          themeKey={card.theme}
          cardId={card.id}
        />
      </div>

      {/* Limit Consumption Widget */}
      <div className="bg-slate-900/60 p-4 rounded-2xl border border-white/[0.05] mb-4 space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-xs font-semibold text-slate-400">Consumo do Limite</span>
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border tabular-nums ${limitBadgeColor}`}>
            {usagePercentage.toFixed(0)}% utilizado
          </span>
        </div>

        <div className="w-full bg-slate-800/80 rounded-full h-2.5 overflow-hidden p-0.5 border border-white/[0.05]">
          <div
            className={`h-1.5 rounded-full bg-gradient-to-r ${limitBarGradient} transition-all duration-500`}
            style={{ width: `${usagePercentage}%` }}
          ></div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-xs pt-1">
          <div>
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Fatura Atual</p>
            <p className="font-extrabold text-amber-400 tabular-nums text-sm">{formatCurrency(billTotal)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider font-medium">Limite Disp.</p>
            <p className="font-extrabold text-emerald-400 tabular-nums text-sm">{formatCurrency(availableLimit)}</p>
          </div>
        </div>
      </div>

      {/* Bill Selector Tabs */}
      <div className="flex bg-slate-900/80 p-1 rounded-xl border border-white/[0.06] mb-3">
        <button
          type="button"
          onClick={() => setBillType('current')}
          className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            billType === 'current'
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <i className="fa-solid fa-folder-open text-xs"></i>
          <span>Fatura Atual (Aberta)</span>
        </button>
        <button
          type="button"
          onClick={() => setBillType('closed')}
          className={`flex-1 py-1.5 px-3 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            billType === 'closed'
              ? 'bg-slate-800 text-white shadow-md border border-white/10'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <i className="fa-solid fa-lock text-xs"></i>
          <span>Fatura Fechada</span>
        </button>
      </div>

      {/* Dates Summary */}
      <div className="text-xs text-slate-400 flex justify-between px-1 pb-3 border-b border-white/[0.06] mb-3">
        <span>
          {billType === 'current' ? 'Fecha em: ' : 'Fechou em: '}
          <span className="text-slate-200 font-semibold">
            {billInfo.endDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
          </span>
        </span>
        <span>
          {billType === 'current' ? 'Vence em: ' : 'Venceu em: '}
          <span className="text-slate-200 font-semibold">
            {billInfo.dueDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
          </span>
        </span>
      </div>

      {/* Transactions List */}
      <div className="space-y-2 flex-1 overflow-y-auto pr-1 custom-scrollbar max-h-56 mb-4">
        {billTransactions.length > 0 ? (
          billTransactions.map((t) => {
            const category = allCategories.find((c) => c.id === t.category);
            return (
              <div
                key={t.id}
                className="flex justify-between items-center bg-slate-800/40 hover:bg-slate-800/70 p-2.5 rounded-xl border border-white/[0.04] transition-colors"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-xs flex-shrink-0">
                    <i className={category?.icon || 'fa-solid fa-tag'}></i>
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-xs sm:text-sm text-slate-200 truncate">{t.description}</p>
                    <p className="text-[11px] text-slate-500">
                      {new Date(t.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                    </p>
                  </div>
                </div>
                <p className="font-bold text-slate-200 tabular-nums text-xs sm:text-sm ml-2 flex-shrink-0">
                  {formatCurrency(t.amount)}
                </p>
              </div>
            );
          })
        ) : (
          <div className="text-center py-8 flex flex-col items-center justify-center h-full text-slate-500">
            <div className="w-10 h-10 rounded-xl bg-slate-800/60 flex items-center justify-center text-slate-600 mb-2">
              <i className="fa-solid fa-receipt text-base"></i>
            </div>
            <p className="text-xs text-slate-400 font-medium">Nenhuma despesa nesta fatura.</p>
          </div>
        )}
      </div>

      {/* View History and Import Buttons */}
      <div className="mt-auto flex items-center gap-2">
        {onImportBill && (
          <button
            onClick={() => onImportBill(card.id)}
            className="flex-1 py-2.5 px-3 bg-indigo-600/15 hover:bg-indigo-600/25 text-indigo-300 hover:text-white rounded-xl transition-all text-xs font-semibold border border-indigo-500/30 flex items-center justify-center gap-2 shadow-sm"
            title="Importar fatura deste cartão via OFX ou CSV"
          >
            <i className="fa-solid fa-file-import text-xs"></i>
            <span>Importar Fatura</span>
          </button>
        )}
        <button
          onClick={() => onViewHistory(card)}
          className={`${
            onImportBill ? 'flex-1' : 'w-full'
          } text-center py-2.5 px-4 bg-slate-800/90 hover:bg-slate-700 text-slate-200 rounded-xl transition-all text-xs font-semibold border border-white/[0.08] hover:border-blue-500/30 flex items-center justify-center gap-2 shadow-sm`}
        >
          <i className="fa-solid fa-calendar-days text-slate-400 text-xs"></i>
          <span>{onImportBill ? 'Faturas' : 'Ver Histórico de Faturas'}</span>
        </button>
      </div>
    </div>
  );
};

// --- Main Component ---
interface CardsManagementProps {
  creditCards: CreditCard[];
  onAddCard: (card: Omit<CreditCard, 'id'>) => void;
  onUpdateCard: (card: CreditCard) => void;
  transactions: Transaction[];
  allCategories: Category[];
  onDeleteCard: (cardId: string) => void;
  onOpenImport?: (cardId?: string) => void;
}

const CardsManagement: React.FC<CardsManagementProps> = ({
  creditCards,
  onAddCard,
  onUpdateCard,
  transactions,
  onDeleteCard,
  allCategories,
  onOpenImport,
}) => {
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
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-2 border-b border-white/[0.06]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Meus Cartões de Crédito</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Gerencie limites, faturas abertas e datas de vencimento em formato de cartões realistas
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          {onOpenImport && (
            <button
              onClick={() => onOpenImport()}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3.5 py-2.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl transition-all text-xs sm:text-sm font-semibold border border-white/10 shadow-sm"
              title="Importar fatura de cartão via OFX ou CSV"
            >
              <i className="fa-solid fa-file-import text-blue-400"></i>
              <span>Importar Fatura</span>
            </button>
          )}
          <button
            onClick={() => handleOpenModal(null)}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl transition-all text-xs sm:text-sm font-semibold shadow-lg shadow-blue-500/25 active:scale-95"
          >
            <i className="fa-solid fa-plus"></i>
            <span>Adicionar Cartão</span>
          </button>
        </div>
      </div>

      {/* Cards Grid */}
      {creditCards.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {creditCards.map((card) => (
            <CardBillView
              key={card.id}
              card={card}
              transactions={transactions}
              allCategories={allCategories}
              onEdit={handleOpenModal}
              onDelete={onDeleteCard}
              onViewHistory={handleViewHistory}
              onImportBill={onOpenImport}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-20 glass-card rounded-3xl border border-white/[0.06] mt-6 flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-2xl bg-slate-800/80 flex items-center justify-center text-slate-600 mb-4 border border-white/5">
            <i className="fa-solid fa-credit-card text-2xl"></i>
          </div>
          <p className="text-white text-lg font-bold">Nenhum cartão de crédito cadastrado</p>
          <p className="text-slate-400 text-sm mt-1 mb-5 max-w-sm">
            Cadastre seus cartões para acompanhar o limite em tempo real e organizar as faturas mensais.
          </p>
          <button
            onClick={() => handleOpenModal(null)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-colors text-xs font-semibold shadow-lg shadow-blue-500/20"
          >
            <i className="fa-solid fa-plus"></i>
            <span>Cadastrar Primeiro Cartão</span>
          </button>
        </div>
      )}

      {/* Modal: Add/Edit Card */}
      {isModalOpen && (
        <CreditCardModal
          onClose={handleCloseModal}
          onSave={handleSaveCard}
          cardToEdit={editingCard}
        />
      )}

      {/* Modal: Bill History */}
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