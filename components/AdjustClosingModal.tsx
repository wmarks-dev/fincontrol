import React, { useState } from 'react';
import { CreditCard } from '../types';
import { BillInfo } from '../utils/dateUtils';

interface AdjustClosingModalProps {
  card: CreditCard;
  billInfo: BillInfo;
  onClose: () => void;
  onSave: (closingDate: string) => Promise<void>;
  onReset?: () => Promise<void>;
}

export const AdjustClosingModal: React.FC<AdjustClosingModalProps> = ({
  card,
  billInfo,
  onClose,
  onSave,
  onReset,
}) => {
  const defaultDateStr = billInfo.endDate.toISOString().split('T')[0];
  const [closingDate, setClosingDate] = useState(defaultDateStr);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!closingDate) {
      setError('Por favor selecione a nova data de fechamento.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);
      await onSave(closingDate);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar data de fechamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReset = async () => {
    if (!onReset) return;
    try {
      setIsSubmitting(true);
      setError(null);
      await onReset();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro ao restaurar fechamento padrão.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="glass-card rounded-3xl border border-white/10 shadow-2xl w-full max-w-md overflow-hidden animate-scaleUp"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/[0.08] flex justify-between items-center bg-slate-900/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center text-sm shadow-md">
              <i className="fa-solid fa-calendar-check"></i>
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">Ajustar Fechamento</h3>
              <p className="text-xs text-slate-400">{card.name}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors flex items-center justify-center text-xs"
            aria-label="Fechar"
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
          <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-white/[0.06] space-y-2 text-xs">
            <div className="flex justify-between items-center text-slate-400">
              <span>Fechamento padrão do cartão:</span>
              <span className="font-semibold text-slate-200">Todo dia {card.closingDay}</span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Vencimento desta fatura:</span>
              <span className="font-bold text-amber-400">
                {billInfo.dueDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
              </span>
            </div>
            <div className="flex justify-between items-center text-slate-400">
              <span>Status atual do ciclo:</span>
              {billInfo.isCustomClosing ? (
                <span className="inline-flex items-center gap-1 font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  <i className="fa-solid fa-clock-rotate-left text-[9px]"></i> Personalizado
                </span>
              ) : (
                <span className="text-slate-300 font-medium">Automático</span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
              Nova Data de Fechamento:
            </label>
            <input
              type="date"
              value={closingDate}
              onChange={(e) => setClosingDate(e.target.value)}
              className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-amber-500 transition-colors"
              required
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Compras feitas até as 23:59 desta data entrarão nesta fatura. Compras posteriores passarão para a seguinte.
            </p>
          </div>

          {error && (
            <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-400 text-xs">
              {error}
            </div>
          )}

          {/* Action buttons */}
          <div className="pt-2 flex items-center gap-2">
            {billInfo.isCustomClosing && onReset && (
              <button
                type="button"
                onClick={handleReset}
                disabled={isSubmitting}
                className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-white/10 transition-colors disabled:opacity-50"
                title="Voltar para a data padrão do cartão"
              >
                Restaurar Padrão
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-3 bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl text-xs font-semibold transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2.5 px-4 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-amber-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <i className="fa-solid fa-check text-xs"></i>
                  <span>Salvar Fechamento</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
