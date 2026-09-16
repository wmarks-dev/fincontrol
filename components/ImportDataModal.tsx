import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Transaction, CreditCard, Category, TransactionType, PaymentMethod } from '../types';
import { parseOFX, parseCSV, parseXLSX, downloadFinControlTemplate, ParsedImportItem } from '../utils/importParsers';
import { suggestCategory } from '../utils/smartCategorizer';
import { checkDuplicate } from '../utils/duplicateDetector';
import { useData } from '../contexts/DataContext';
import {
  getCurrentOpenBillInfo,
  getMostRecentlyClosedBillInfo,
  getAdjacentBillDueDate,
  getBillInfoForDueDate,
} from '../utils/dateUtils';

interface ImportDataModalProps {
  isOpen: boolean;
  onClose: () => void;
  creditCards: CreditCard[];
  allCategories: Category[];
  existingTransactions: Transaction[];
  onConfirmImport: (transactions: Omit<Transaction, 'id'>[]) => Promise<void>;
  initialCreditCardId?: string | null;
}

interface ImportItemWithState extends ParsedImportItem {
  selected: boolean;
  assignedCategory: string;
  isDuplicate: boolean;
  duplicateReason?: string;
  matchedTransaction?: Transaction;
}

const formatCurrency = (val: number) => {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const ImportDataModal: React.FC<ImportDataModalProps> = ({
  isOpen,
  onClose,
  creditCards,
  allCategories,
  existingTransactions,
  onConfirmImport,
  initialCreditCardId,
}) => {
  const { cardMonthlyClosings } = useData();
  const [step, setStep] = useState<'upload' | 'preview'>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [fileFormat, setFileFormat] = useState<'OFX' | 'CSV' | 'XLSX'>('OFX');

  // Destination settings
  const [destinationType, setDestinationType] = useState<'account' | 'card'>('account');
  const [selectedCardId, setSelectedCardId] = useState<string>('');
  const [targetBillOption, setTargetBillOption] = useState<'auto' | 'current' | 'next' | 'prev'>('auto');
  const [accountPaymentMethod, setAccountPaymentMethod] = useState<PaymentMethod>(PaymentMethod.DEBIT);
  const [projectFutureInstallments, setProjectFutureInstallments] = useState(false);

  // Parsed items
  const [items, setItems] = useState<ImportItemWithState[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'EXPENSE' | 'INCOME' | 'INSTALLMENT'>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const selectedCard = useMemo(
    () => creditCards.find((c) => c.id === selectedCardId),
    [creditCards, selectedCardId]
  );

  const cardBillOptions = useMemo(() => {
    if (!selectedCard) return null;
    const today = new Date();
    const currentOpenBill = getCurrentOpenBillInfo(selectedCard, today, cardMonthlyClosings);
    const currentClosedBill = getMostRecentlyClosedBillInfo(selectedCard, today, cardMonthlyClosings);
    const nextDueDate = getAdjacentBillDueDate(selectedCard, currentOpenBill.dueDate, 'next', cardMonthlyClosings);

    return {
      current: {
        label: `Fatura Atual (Venc. ${currentOpenBill.dueDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })})`,
        dueDateISO: currentOpenBill.dueDate.toISOString().split('T')[0],
      },
      next: {
        label: `Próxima Fatura (Venc. ${new Date(nextDueDate + 'T12:00:00Z').toLocaleDateString('pt-BR', { timeZone: 'UTC' })})`,
        dueDateISO: nextDueDate,
      },
      prev: {
        label: `Fatura Fechada/Anterior (Venc. ${currentClosedBill.dueDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })})`,
        dueDateISO: currentClosedBill.dueDate.toISOString().split('T')[0],
      },
    };
  }, [selectedCard, cardMonthlyClosings]);

  // Initialize or reset when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('upload');
      setItems([]);
      setErrorMessage(null);
      setSearchQuery('');
      setTypeFilter('all');
      setProjectFutureInstallments(false);
      setTargetBillOption('auto');

      if (initialCreditCardId && creditCards.some((c) => c.id === initialCreditCardId)) {
        setDestinationType('card');
        setSelectedCardId(initialCreditCardId);
      } else if (creditCards.length > 0) {
        setSelectedCardId(creditCards[0].id);
      }
    }
  }, [isOpen, initialCreditCardId, creditCards]);

  if (!isOpen) return null;

  // Handle file selection
  const handleFileProcess = (file: File) => {
    setErrorMessage(null);
    const ext = file.name.split('.').pop()?.toLowerCase();
    const isExcel = ext === 'xlsx' || ext === 'xls';

    if (ext !== 'ofx' && ext !== 'csv' && ext !== 'txt' && !isExcel) {
      setErrorMessage('Por favor, selecione um arquivo válido no formato .ofx, .csv ou .xlsx.');
      return;
    }

    setFileName(file.name);
    setFileFormat(ext === 'ofx' ? 'OFX' : isExcel ? 'XLSX' : 'CSV');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        let parsed: ParsedImportItem[] = [];

        if (isExcel) {
          const buffer = e.target?.result as ArrayBuffer;
          parsed = parseXLSX(buffer);
        } else {
          const text = e.target?.result as string;
          if (ext === 'ofx') {
            parsed = parseOFX(text);
          } else {
            parsed = parseCSV(text);
          }
        }

        if (!parsed || parsed.length === 0) {
          throw new Error('Nenhuma transação financeira válida foi encontrada dentro do arquivo.');
        }

        // Augment with smart categorizer & duplicate detector
        const itemsWithState: ImportItemWithState[] = parsed.map((item) => {
          // If file provided a category name, try to match it
          let catId = '';
          if (item.category) {
            const foundCat = allCategories.find(
              (c) =>
                c.name.toLowerCase() === item.category?.toLowerCase() ||
                c.id.toLowerCase() === item.category?.toLowerCase()
            );
            if (foundCat) catId = foundCat.id;
          }

          if (!catId) {
            catId = suggestCategory(item.description, item.type, allCategories);
          }

          const dupCheck = checkDuplicate(item, existingTransactions);

          return {
            ...item,
            assignedCategory: catId,
            selected: !dupCheck.isPotentialDuplicate, // uncheck potential duplicates by default
            isDuplicate: dupCheck.isPotentialDuplicate,
            duplicateReason: dupCheck.duplicateReason,
            matchedTransaction: dupCheck.matchedTransaction,
          };
        });

        setItems(itemsWithState);
        setStep('preview');
      } catch (err: any) {
        console.error('Erro ao processar arquivo:', err);
        setErrorMessage(err.message || 'Falha ao ler o arquivo selecionado.');
      }
    };

    if (isExcel) {
      reader.readAsArrayBuffer(file);
    } else {
      reader.readAsText(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileProcess(e.dataTransfer.files[0]);
    }
  };

  // Toggle selection
  const toggleItemSelection = (id: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item))
    );
  };

  const handleSelectAll = (select: boolean) => {
    setItems((prev) => prev.map((item) => ({ ...item, selected: select })));
  };

  const handleDeselectDuplicates = () => {
    setItems((prev) =>
      prev.map((item) => (item.isDuplicate ? { ...item, selected: false } : item))
    );
  };

  const updateItemCategory = (id: string, categoryId: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, assignedCategory: categoryId } : item))
    );
  };

  const updateItemDescription = (id: string, desc: string) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, description: desc } : item))
    );
  };

  // Filtered preview items
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (typeFilter === 'INSTALLMENT') {
        if (!item.installmentStr) return false;
      } else if (typeFilter !== 'all' && item.type !== typeFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          item.description.toLowerCase().includes(q) ||
          item.amount.toString().includes(q) ||
          item.date.includes(q) ||
          (item.installmentStr && item.installmentStr.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [items, searchQuery, typeFilter]);

  // Totals of selected items
  const selectedCount = items.filter((i) => i.selected).length;
  const duplicateCount = items.filter((i) => i.isDuplicate).length;
  const installmentCount = items.filter((i) => !!i.installmentStr).length;
  const selectedTotal = items
    .filter((i) => i.selected)
    .reduce((acc, curr) => acc + (curr.type === TransactionType.INCOME ? curr.amount : -curr.amount), 0);

  // Submit and save
  const handleConfirm = async () => {
    const selectedItems = items.filter((i) => i.selected);
    if (selectedItems.length === 0) {
      setErrorMessage('Selecione pelo menos uma transação para importar.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      const toSave: Omit<Transaction, 'id'>[] = [];
      const isCard = destinationType === 'card';

      const targetCustomDueDate =
        isCard && targetBillOption !== 'auto' && cardBillOptions
          ? cardBillOptions[targetBillOption].dueDateISO
          : undefined;

      for (const item of selectedItems) {
        const sharedInstallmentId = item.installmentStr
          ? `inst_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`
          : undefined;

        toSave.push({
          description: item.description,
          amount: item.amount,
          date: item.date,
          type: item.type,
          category: item.assignedCategory,
          paymentMethod: isCard
            ? PaymentMethod.CREDIT_CARD
            : item.type === TransactionType.INCOME
            ? PaymentMethod.CASH
            : accountPaymentMethod,
          creditCardId: isCard ? selectedCardId : null,
          installmentId: sharedInstallmentId,
          isPaid: isCard ? false : true,
          customDueDate: targetCustomDueDate,
        });

        // If card destination, user opted to project future installments, and current < total
        if (
          isCard &&
          projectFutureInstallments &&
          item.installmentNumber &&
          item.totalInstallments &&
          item.installmentNumber < item.totalInstallments
        ) {
          const baseDate = new Date(item.date + 'T12:00:00Z');
          const cleanBaseDesc = item.description.replace(/\s+\d+\s*(?:\/|de)\s*\d+\s*$/i, '').trim();

          for (let p = item.installmentNumber + 1; p <= item.totalInstallments; p++) {
            const monthsAhead = p - item.installmentNumber;
            const nextDate = new Date(baseDate);
            nextDate.setUTCMonth(nextDate.getUTCMonth() + monthsAhead);

            let futureDueDate: string | undefined = undefined;
            if (targetCustomDueDate && selectedCard) {
              const baseDue = new Date(targetCustomDueDate + 'T12:00:00Z');
              const futureTarget = new Date(Date.UTC(baseDue.getUTCFullYear(), baseDue.getUTCMonth() + monthsAhead, 1));
              const info = getBillInfoForDueDate(selectedCard, futureTarget, cardMonthlyClosings);
              futureDueDate = info.dueDate.toISOString().split('T')[0];
            }

            toSave.push({
              description: `${cleanBaseDesc} ${p}/${item.totalInstallments}`,
              amount: item.amount,
              date: nextDate.toISOString().split('T')[0],
              type: item.type,
              category: item.assignedCategory,
              paymentMethod: PaymentMethod.CREDIT_CARD,
              creditCardId: selectedCardId,
              installmentId: sharedInstallmentId,
              isPaid: false,
              customDueDate: futureDueDate,
            });
          }
        }
      }

      await onConfirmImport(toSave);
      onClose();
    } catch (err: any) {
      console.error('Erro ao salvar transações importadas:', err);
      setErrorMessage(err.message || 'Erro ao importar transações.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="bg-slate-900 border border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl max-w-4xl w-full flex flex-col max-h-[92vh] overflow-hidden animate-scaleUp">
        {/* Header */}
        <div className="p-4 sm:p-6 border-b border-white/[0.08] flex items-center justify-between bg-slate-900/60 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-tr from-blue-600/20 to-indigo-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 text-lg sm:text-xl shadow-inner flex-shrink-0">
              <i className="fa-solid fa-file-import"></i>
            </div>
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
                Importar Extrato Bancário / Fatura
              </h2>
              <p className="text-xs text-slate-400">
                {step === 'upload'
                  ? 'Selecione um arquivo OFX, CSV ou planilha XLSX (Itaú) para importar'
                  : `Pré-visualização: ${fileName} (${fileFormat} • ${items.length} itens)`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-white p-2 rounded-xl transition-colors"
          >
            <i className="fa-solid fa-xmark text-lg"></i>
          </button>
        </div>

        {/* Error Banner */}
        {errorMessage && (
          <div className="mx-4 sm:mx-6 mt-4 p-3.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs sm:text-sm flex items-center justify-between gap-3 animate-slideDown">
            <div className="flex items-center gap-2.5">
              <i className="fa-solid fa-circle-exclamation text-rose-400 text-base flex-shrink-0"></i>
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage(null)}
              className="text-rose-300 hover:text-white text-xs px-2 py-0.5 rounded"
            >
              <i className="fa-solid fa-xmark"></i>
            </button>
          </div>
        )}

        {/* Body Content */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 custom-scrollbar">
          {step === 'upload' ? (
            <div className="space-y-6">
              {/* Destination selector */}
              <div className="bg-slate-800/50 p-4 rounded-2xl border border-white/[0.06] space-y-3">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  1. Onde deseja lançar essas transações?
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDestinationType('account')}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                      destinationType === 'account'
                        ? 'bg-blue-600/20 border-blue-500 text-white shadow-lg shadow-blue-500/15 font-semibold'
                        : 'bg-slate-900/60 border-white/[0.06] text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm ${
                        destinationType === 'account' ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <i className="fa-solid fa-building-columns"></i>
                    </div>
                    <div>
                      <span className="block text-sm">Conta Corrente / Débito</span>
                      <span className="text-[11px] text-slate-400">Extrato bancário tradicional</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDestinationType('card')}
                    disabled={creditCards.length === 0}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left disabled:opacity-40 ${
                      destinationType === 'card'
                        ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-lg shadow-indigo-500/15 font-semibold'
                        : 'bg-slate-900/60 border-white/[0.06] text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-lg flex items-center justify-center text-sm ${
                        destinationType === 'card' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      <i className="fa-solid fa-credit-card"></i>
                    </div>
                    <div>
                      <span className="block text-sm">Fatura de Cartão de Crédito</span>
                      <span className="text-[11px] text-slate-400">
                        {creditCards.length === 0 ? 'Nenhum cartão cadastrado' : 'Vincular à fatura de um cartão'}
                      </span>
                    </div>
                  </button>
                </div>

                {/* Sub-selectors */}
                {destinationType === 'card' && creditCards.length > 0 && (
                  <div className="pt-2 space-y-3 animate-fadeIn">
                    <div>
                      <label className="block text-xs text-slate-400 mb-1">Selecione o Cartão de Crédito:</label>
                      <select
                        value={selectedCardId}
                        onChange={(e) => setSelectedCardId(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                      >
                        {creditCards.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} (Vencimento dia {c.dueDay})
                          </option>
                        ))}
                      </select>
                    </div>

                    {cardBillOptions && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <label className="block text-xs text-slate-400">Vincular compras à fatura:</label>
                          {targetBillOption !== 'auto' && (
                            <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/20">
                              Fatura Fixada
                            </span>
                          )}
                        </div>
                        <select
                          value={targetBillOption}
                          onChange={(e) => setTargetBillOption(e.target.value as any)}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 transition-colors"
                        >
                          <option value="auto">Automático (pela data de cada compra)</option>
                          <option value="current">{cardBillOptions.current.label}</option>
                          <option value="next">{cardBillOptions.next.label}</option>
                          <option value="prev">{cardBillOptions.prev.label}</option>
                        </select>
                        <p className="text-[11px] text-slate-500 mt-1">
                          {targetBillOption === 'auto'
                            ? 'As compras serão alocadas na fatura pelo dia de fechamento do cartão.'
                            : 'Todas as compras deste arquivo entrarão na fatura selecionada, garantindo que o valor bata com o banco.'}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {destinationType === 'account' && (
                  <div className="pt-2 animate-fadeIn">
                    <label className="block text-xs text-slate-400 mb-1">Forma de pagamento padrão das saídas:</label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setAccountPaymentMethod(PaymentMethod.DEBIT)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          accountPaymentMethod === PaymentMethod.DEBIT
                            ? 'bg-blue-600 text-white border-blue-500'
                            : 'bg-slate-900 text-slate-400 border-white/[0.08]'
                        }`}
                      >
                        Débito
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccountPaymentMethod(PaymentMethod.CASH)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          accountPaymentMethod === PaymentMethod.CASH
                            ? 'bg-blue-600 text-white border-blue-500'
                            : 'bg-slate-900 text-slate-400 border-white/[0.08]'
                        }`}
                      >
                        Dinheiro / PIX
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Upload Dropzone */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider">
                  2. Escolha o arquivo para upload
                </label>

                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      handleFileProcess(e.target.files[0]);
                    }
                  }}
                  accept=".ofx,.csv,.xlsx,.xls,.txt"
                  className="hidden"
                />

                <div
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-white/20 hover:border-blue-500/80 bg-slate-800/40 hover:bg-slate-800/70 transition-all rounded-3xl p-8 sm:p-12 text-center cursor-pointer group"
                >
                  <div className="w-16 h-16 mx-auto rounded-2xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center text-3xl mb-4 group-hover:scale-110 group-hover:bg-blue-500/20 transition-all shadow-lg">
                    <i className="fa-solid fa-cloud-arrow-up"></i>
                  </div>
                  <h3 className="text-base sm:text-lg font-bold text-white mb-1">
                    Arraste seu arquivo aqui ou clique para selecionar
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
                    Compatível com extratos <strong className="text-slate-200">.OFX</strong> (Nubank, Itaú,
                    Bradesco, Santander, Inter, etc.), planilhas <strong className="text-slate-200">.XLSX / .XLS</strong> (faturas e extratos Itaú) e <strong className="text-slate-200">.CSV</strong>.
                  </p>
                  <div className="inline-flex items-center gap-2 px-3 py-1 mt-4 rounded-full bg-slate-800 border border-white/10 text-xs text-slate-300">
                    <i className="fa-solid fa-shield-check text-emerald-400"></i>
                    <span>Privacidade Total: processado localmente no seu dispositivo</span>
                  </div>
                </div>
              </div>

              {/* Template download link */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/30 border border-white/[0.06] text-xs text-slate-400">
                <div className="flex items-center gap-2.5">
                  <i className="fa-solid fa-file-excel text-emerald-400 text-base"></i>
                  <span>Deseja importar uma planilha própria preenchida?</span>
                </div>
                <button
                  type="button"
                  onClick={downloadFinControlTemplate}
                  className="text-blue-400 hover:text-blue-300 font-semibold underline flex items-center gap-1.5 transition-colors"
                >
                  <i className="fa-solid fa-download"></i>
                  <span>Baixar Planilha Modelo (.csv)</span>
                </button>
              </div>
            </div>
          ) : (
            /* Step 2: Preview & Adjustments */
            <div className="space-y-4">
              {/* Top Stats Banner */}
              <div className={`grid grid-cols-2 sm:grid-cols-4 ${installmentCount > 0 ? 'lg:grid-cols-5' : ''} gap-2.5 sm:gap-3`}>
                <div className="bg-slate-800/60 border border-white/[0.06] p-3 rounded-xl">
                  <span className="text-[11px] text-slate-400 block font-medium">Total no Arquivo</span>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-bold text-white">{items.length} itens</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase border ${
                        fileFormat === 'XLSX'
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                          : fileFormat === 'OFX'
                          ? 'bg-purple-500/20 text-purple-400 border-purple-500/30'
                          : 'bg-blue-500/20 text-blue-400 border-blue-500/30'
                      }`}
                    >
                      {fileFormat}
                    </span>
                  </div>
                </div>
                <div className="bg-slate-800/60 border border-white/[0.06] p-3 rounded-xl">
                  <span className="text-[11px] text-slate-400 block font-medium">Selecionados</span>
                  <span className="text-lg font-bold text-blue-400">{selectedCount} itens</span>
                </div>
                <div className="bg-slate-800/60 border border-white/[0.06] p-3 rounded-xl">
                  <span className="text-[11px] text-slate-400 block font-medium">Saldo Selecionado</span>
                  <span
                    className={`text-lg font-bold ${
                      selectedTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'
                    }`}
                  >
                    {formatCurrency(selectedTotal)}
                  </span>
                </div>
                <div className="bg-slate-800/60 border border-white/[0.06] p-3 rounded-xl">
                  <span className="text-[11px] text-slate-400 block font-medium">Duplicidades</span>
                  <span className="text-lg font-bold text-amber-400">{duplicateCount}</span>
                </div>
                {installmentCount > 0 && (
                  <div className="bg-slate-800/60 border border-indigo-500/30 p-3 rounded-xl">
                    <span className="text-[11px] text-indigo-300 block font-medium">Parceladas</span>
                    <div className="flex items-center gap-1.5">
                      <i className="fa-solid fa-layer-group text-xs text-indigo-400"></i>
                      <span className="text-lg font-bold text-indigo-300">{installmentCount} itens</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Projection of future installments if importing to credit card */}
              {destinationType === 'card' && installmentCount > 0 && (
                <div className="p-3.5 rounded-2xl bg-indigo-950/40 border border-indigo-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center text-sm flex-shrink-0">
                      <i className="fa-solid fa-wand-magic-sparkles"></i>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-xs sm:text-sm font-semibold text-white">
                          Projetar parcelas futuras restantes no cartão?
                        </p>
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                          {installmentCount} identificada{installmentCount > 1 ? 's' : ''}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        Gera automaticamente os lançamentos dos meses seguintes para as compras parceladas (ex: 3/6 a 6/6).
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer flex-shrink-0 self-end sm:self-auto">
                    <input
                      type="checkbox"
                      checked={projectFutureInstallments}
                      onChange={(e) => setProjectFutureInstallments(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-10 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                  </label>
                </div>
              )}

              {/* Target Bill Selection Bar in Preview */}
              {destinationType === 'card' && selectedCard && cardBillOptions && (
                <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-fadeIn">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-300 flex items-center justify-center text-sm flex-shrink-0">
                      <i className="fa-solid fa-credit-card"></i>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs sm:text-sm font-semibold text-white truncate">
                          {selectedCard.name}
                        </span>
                        {targetBillOption !== 'auto' && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 flex-shrink-0">
                            Fatura Fixada
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400">
                        {targetBillOption === 'auto'
                          ? 'Alocação automática pelo dia de fechamento'
                          : `Vinculando à: ${cardBillOptions[targetBillOption].label}`}
                      </p>
                    </div>
                  </div>

                  <div className="w-full sm:w-auto flex items-center gap-2 flex-shrink-0">
                    <span className="text-xs text-slate-400 hidden sm:inline">Vincular a:</span>
                    <select
                      value={targetBillOption}
                      onChange={(e) => setTargetBillOption(e.target.value as any)}
                      className="w-full sm:w-auto bg-slate-900 border border-white/10 rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition-colors"
                    >
                      <option value="auto">Automático (por data)</option>
                      <option value="current">{cardBillOptions.current.label}</option>
                      <option value="next">{cardBillOptions.next.label}</option>
                      <option value="prev">{cardBillOptions.prev.label}</option>
                    </select>
                  </div>
                </div>
              )}

              {/* Action Toolbar */}
              <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 pt-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleSelectAll(true)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
                  >
                    Selecionar Todos
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSelectAll(false)}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 transition-colors"
                  >
                    Desmarcar Todos
                  </button>
                  {duplicateCount > 0 && (
                    <button
                      type="button"
                      onClick={handleDeselectDuplicates}
                      className="px-2.5 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-xs text-amber-300 border border-amber-500/20 transition-colors"
                    >
                      Desmarcar Duplicadas
                    </button>
                  )}
                </div>

                {/* Filter and Search */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1 sm:w-48">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar descrição..."
                      className="w-full bg-slate-800/80 border border-white/10 rounded-lg pl-7 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                    />
                    <i className="fa-solid fa-search text-[10px] text-slate-500 absolute left-2.5 top-2.5"></i>
                  </div>
                  <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value as any)}
                    className="bg-slate-800/80 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white focus:outline-none"
                  >
                    <option value="all">Todas ({items.length})</option>
                    <option value="EXPENSE">Despesas</option>
                    <option value="INCOME">Receitas</option>
                    {installmentCount > 0 && (
                      <option value="INSTALLMENT">Parceladas ({installmentCount})</option>
                    )}
                  </select>
                </div>
              </div>

              {/* Transactions List / Table */}
              <div className="border border-white/[0.08] rounded-2xl overflow-hidden bg-slate-900/50">
                <div className="max-h-[44vh] overflow-y-auto custom-scrollbar divide-y divide-white/[0.04]">
                  {filteredItems.length > 0 ? (
                    filteredItems.map((item) => {
                      const isIncome = item.type === TransactionType.INCOME;
                      return (
                        <div
                          key={item.id}
                          className={`p-3 sm:p-3.5 flex items-center justify-between gap-3 transition-colors ${
                            item.selected
                              ? 'bg-slate-800/30 hover:bg-slate-800/50'
                              : 'opacity-50 hover:opacity-75 bg-slate-950/20'
                          }`}
                        >
                          {/* Checkbox and basic info */}
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <input
                              type="checkbox"
                              checked={item.selected}
                              onChange={() => toggleItemSelection(item.id)}
                              className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-white/20 focus:ring-0 focus:ring-offset-0 cursor-pointer flex-shrink-0"
                            />

                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-slate-400 font-mono">
                                  {new Date(item.date).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
                                </span>
                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                    isIncome
                                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                      : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                  }`}
                                >
                                  {isIncome ? 'Receita' : 'Despesa'}
                                </span>
                                {item.installmentStr && (
                                  <span
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 flex items-center gap-1"
                                    title={`Compra parcelada: ${item.installmentStr}`}
                                  >
                                    <i className="fa-solid fa-layer-group text-[9px]"></i>
                                    Parcela {item.installmentStr}
                                  </span>
                                )}
                                {item.isDuplicate && (
                                  <span
                                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center gap-1"
                                    title={item.duplicateReason}
                                  >
                                    <i className="fa-solid fa-triangle-exclamation"></i>
                                    Possível Duplicata
                                  </span>
                                )}
                              </div>

                              <input
                                type="text"
                                value={item.description}
                                onChange={(e) => updateItemDescription(item.id, e.target.value)}
                                className="mt-0.5 font-medium text-xs sm:text-sm text-white bg-transparent border-b border-transparent hover:border-white/20 focus:border-blue-500 focus:outline-none w-full truncate"
                                title="Clique para editar a descrição se desejar"
                              />
                            </div>
                          </div>

                          {/* Category and Amount */}
                          <div className="flex items-center gap-3 flex-shrink-0">
                            {/* Category Selector */}
                            <div className="relative">
                              <select
                                value={item.assignedCategory}
                                onChange={(e) => updateItemCategory(item.id, e.target.value)}
                                className="bg-slate-800 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500 max-w-[130px] sm:max-w-[160px] truncate"
                              >
                                {allCategories.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {c.name}
                                  </option>
                                ))}
                              </select>
                            </div>

                            {/* Amount */}
                            <div className="text-right min-w-[90px]">
                              <span
                                className={`text-xs sm:text-sm font-bold font-mono ${
                                  isIncome ? 'text-emerald-400' : 'text-rose-400'
                                }`}
                              >
                                {isIncome ? '+' : '-'} {formatCurrency(item.amount)}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="p-8 text-center text-slate-400 text-xs">
                      Nenhuma transação correspondente aos filtros.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 sm:p-5 border-t border-white/[0.08] bg-slate-900/80 flex items-center justify-between flex-shrink-0">
          {step === 'preview' ? (
            <button
              type="button"
              onClick={() => setStep('upload')}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 transition-colors flex items-center gap-2"
            >
              <i className="fa-solid fa-arrow-left text-xs"></i>
              <span>Trocar Arquivo</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs sm:text-sm text-slate-300 hover:text-white transition-colors"
            >
              Cancelar
            </button>
          )}

          {step === 'preview' && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm text-slate-400 hover:text-white transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                disabled={isSubmitting || selectedCount === 0}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-blue-500/25 transition-all duration-200 active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                    <span>Importando...</span>
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check text-xs"></i>
                    <span>Importar {selectedCount} Transações</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ImportDataModal;
