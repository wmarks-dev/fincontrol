import React, { useState, useEffect } from 'react';
import { Bill, Category } from '../types';

interface AddBillModalProps {
  onClose: () => void;
  onAdd: (bill: Omit<Bill, 'id' | 'status'>) => void;
  onUpdate: (bill: Bill) => void;
  billToEdit: Bill | null;
  allCategories: Category[];
  onError: (title: string, message: string) => void;
  initialYear?: number;
  initialMonth?: number;
}

const QUICK_DUE_DAYS = [5, 10, 15, 20, 25];

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

const AddBillModal: React.FC<AddBillModalProps> = ({
  onClose,
  onAdd,
  onUpdate,
  billToEdit,
  allCategories,
  onError,
  initialYear,
  initialMonth,
}) => {
  const now = new Date();
  const defaultYear = initialYear ?? now.getUTCFullYear();
  const defaultMonth = initialMonth ?? now.getUTCMonth();

  const [name, setName] = useState('');
  const [dueDay, setDueDay] = useState('10');
  const [estimatedAmount, setEstimatedAmount] = useState('');
  const [category, setCategory] = useState('bills');
  const [startYear, setStartYear] = useState<number>(defaultYear);
  const [startMonth, setStartMonth] = useState<number>(defaultMonth);

  const isEditing = !!billToEdit;

  useEffect(() => {
    if (isEditing && billToEdit) {
      setName(billToEdit.name);
      setDueDay(String(billToEdit.dueDay));
      setEstimatedAmount(String(billToEdit.estimatedAmount));
      setCategory(billToEdit.category);
      if (billToEdit.startYear !== undefined) setStartYear(billToEdit.startYear);
      if (billToEdit.startMonth !== undefined) setStartMonth(billToEdit.startMonth);
    } else {
      setStartYear(initialYear ?? now.getUTCFullYear());
      setStartMonth(initialMonth ?? now.getUTCMonth());
    }
  }, [isEditing, billToEdit, initialYear, initialMonth]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const numDueDay = parseInt(dueDay, 10);
    const numAmount = parseFloat(estimatedAmount.replace(',', '.'));

    if (!name.trim() || isNaN(numDueDay) || numDueDay < 1 || numDueDay > 31 || isNaN(numAmount) || numAmount <= 0) {
      onError(
        'Erro de Validação',
        'Por favor, preencha todos os campos com valores válidos. O dia do vencimento deve ser entre 1 e 31 e o valor deve ser maior que zero.'
      );
      return;
    }

    const billData = {
      name: name.trim(),
      dueDay: numDueDay,
      estimatedAmount: numAmount,
      category,
      startYear,
      startMonth,
    };

    if (isEditing && billToEdit) {
      onUpdate({ ...billData, id: billToEdit.id, status: billToEdit.status });
    } else {
      onAdd(billData);
    }
    onClose();
  };

  const expenseCategories = allCategories.filter(
    (c) => !['salary', 'investment', 'transfer'].includes(c.id)
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
      <div
        className="bg-slate-900 border border-white/10 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-white/[0.08] flex items-center justify-between bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center text-base">
              <i className="fa-solid fa-file-invoice-dollar"></i>
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">
                {isEditing ? 'Editar Conta a Pagar' : 'Nova Conta a Pagar'}
              </h2>
              <p className="text-xs text-slate-400">
                {isEditing ? 'Atualize os dados do vencimento mensal' : 'Cadastre uma despesa fixa ou recorrente'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors flex items-center justify-center text-sm border border-white/5"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto custom-scrollbar flex-1">
          {/* Estimated Amount (Hero Input) */}
          <div className="bg-slate-800/60 border border-white/[0.08] rounded-2xl p-4 text-center">
            <label htmlFor="estimatedAmount" className="block text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1">
              Valor Estimado da Conta
            </label>
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl font-bold text-amber-400">R$</span>
              <input
                id="estimatedAmount"
                type="number"
                step="0.01"
                min="0.01"
                value={estimatedAmount}
                onChange={(e) => setEstimatedAmount(e.target.value)}
                placeholder="0,00"
                className="bg-transparent text-3xl sm:text-4xl font-extrabold text-white text-center focus:outline-none w-48 tabular-nums placeholder-slate-600"
                required
                autoFocus
              />
            </div>
          </div>

          {/* Bill Name */}
          <div>
            <label htmlFor="billName" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Nome da Conta
            </label>
            <div className="relative">
              <i className="fa-solid fa-tag absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                id="billName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Energia Elétrica, Internet Fibra, Aluguel"
                className="w-full bg-slate-800/80 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all"
                required
              />
            </div>
          </div>

          {/* Due Day Selection */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="dueDay" className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Dia do Vencimento (1 a 31)
              </label>
              <span className="text-xs font-bold text-amber-400 tabular-nums">
                Todo dia {dueDay || '...'}
              </span>
            </div>

            {/* Quick Day Chips */}
            <div className="flex items-center gap-2 mb-2">
              {QUICK_DUE_DAYS.map((day) => (
                <button
                  key={day}
                  type="button"
                  onClick={() => setDueDay(String(day))}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                    parseInt(dueDay, 10) === day
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300 shadow-sm'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 border-white/5'
                  }`}
                >
                  Dia {day}
                </button>
              ))}
            </div>

            <div className="relative">
              <i className="fa-solid fa-calendar-day absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs"></i>
              <input
                id="dueDay"
                type="number"
                min="1"
                max="31"
                value={dueDay}
                onChange={(e) => setDueDay(e.target.value)}
                placeholder="Ou digite o dia..."
                className="w-full bg-slate-800/80 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white placeholder-slate-500 text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all tabular-nums"
                required
              />
            </div>
          </div>

          {/* Category Selector */}
          <div>
            <label htmlFor="billCategory" className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
              Categoria
            </label>
            <div className="relative">
              <i className="fa-solid fa-shapes absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
              <select
                id="billCategory"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full bg-slate-800/80 border border-white/10 rounded-xl pl-9 pr-8 py-2.5 text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all appearance-none cursor-pointer"
              >
                {expenseCategories.map((c) => (
                  <option key={c.id} value={c.id} className="bg-slate-900 text-white">
                    {c.name}
                  </option>
                ))}
              </select>
              <i className="fa-solid fa-chevron-down absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
            </div>
          </div>

          {/* Start Month and Year Selector */}
          <div className="bg-slate-800/50 border border-white/[0.08] rounded-2xl p-4 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Válida a Partir De
              </label>
              <span className="text-xs font-bold text-amber-400">
                {MONTH_NAMES[startMonth]} de {startYear}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-0.5">
              {/* Month Select */}
              <div className="relative">
                <select
                  value={startMonth}
                  onChange={(e) => setStartMonth(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                >
                  {MONTH_NAMES.map((mName, idx) => (
                    <option key={idx} value={idx} className="bg-slate-900 text-white">
                      {mName}
                    </option>
                  ))}
                </select>
                <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
              </div>

              {/* Year Select */}
              <div className="relative">
                <select
                  value={startYear}
                  onChange={(e) => setStartYear(parseInt(e.target.value, 10))}
                  className="w-full bg-slate-800 border border-white/10 rounded-xl px-3 py-2 text-white text-sm focus:ring-2 focus:ring-amber-500 focus:border-transparent transition-all appearance-none cursor-pointer"
                >
                  {[-1, 0, 1, 2, 3].map((offset) => {
                    const y = now.getUTCFullYear() + offset;
                    return (
                      <option key={y} value={y} className="bg-slate-900 text-white">
                        {y}
                      </option>
                    );
                  })}
                </select>
                <i className="fa-solid fa-chevron-down absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs pointer-events-none"></i>
              </div>
            </div>

            <p className="text-[11px] text-slate-400 leading-tight pt-1 flex items-center gap-1.5">
              <i className="fa-solid fa-circle-info text-[10px] text-amber-400 flex-shrink-0"></i>
              <span>Esta conta só existirá e gerará vencimentos a partir deste mês, não gerando pendências em meses anteriores.</span>
            </p>
          </div>

          {/* Modal Actions */}
          <div className="pt-3 border-t border-white/[0.08] flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-sm font-semibold transition-colors border border-white/5"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-amber-500/25 active:scale-95 flex items-center gap-2"
            >
              <i className="fa-solid fa-check text-xs"></i>
              <span>{isEditing ? 'Salvar Alterações' : 'Cadastrar Conta'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddBillModal;