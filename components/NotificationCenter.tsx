import React, { useState, useRef, useEffect, useMemo } from 'react';
import { FinancialAlert, AlertSeverity, AlertType } from '../utils/financialRadar';

interface NotificationCenterProps {
  alerts: FinancialAlert[];
  onNavigate: (view: 'bills' | 'cards' | 'budget' | 'goals', metadata?: any) => void;
  className?: string;
}

type FilterChip = 'all' | 'danger' | 'bill' | 'card' | 'budget' | 'goal';

const NotificationCenter: React.FC<NotificationCenterProps> = ({
  alerts,
  onNavigate,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterChip>('all');
  const [dismissedAlertIds, setDismissedAlertIds] = useState<Set<string>>(() => new Set());
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  // Filter out dismissed alerts for the session
  const activeAlerts = useMemo(() => {
    return alerts.filter((a) => !dismissedAlertIds.has(a.id));
  }, [alerts, dismissedAlertIds]);

  // Counts
  const dangerCount = useMemo(
    () => activeAlerts.filter((a) => a.severity === 'danger').length,
    [activeAlerts]
  );
  const billsCount = useMemo(
    () => activeAlerts.filter((a) => a.type === 'bill').length,
    [activeAlerts]
  );
  const cardsCount = useMemo(
    () => activeAlerts.filter((a) => a.type === 'card').length,
    [activeAlerts]
  );
  const budgetsCount = useMemo(
    () => activeAlerts.filter((a) => a.type === 'budget').length,
    [activeAlerts]
  );
  const goalsCount = useMemo(
    () => activeAlerts.filter((a) => a.type === 'goal').length,
    [activeAlerts]
  );

  // Filtered list
  const visibleAlerts = useMemo(() => {
    if (activeFilter === 'all') return activeAlerts;
    if (activeFilter === 'danger') return activeAlerts.filter((a) => a.severity === 'danger');
    return activeAlerts.filter((a) => a.type === activeFilter);
  }, [activeAlerts, activeFilter]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleDismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissedAlertIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleDismissAll = () => {
    setDismissedAlertIds(new Set(alerts.map((a) => a.id)));
  };

  const handleAlertClick = (alert: FinancialAlert) => {
    setIsOpen(false);
    onNavigate(alert.targetView, alert.metadata);
  };

  const getTypeIcon = (type: AlertType) => {
    switch (type) {
      case 'bill':
        return 'fa-solid fa-file-invoice-dollar';
      case 'card':
        return 'fa-solid fa-credit-card';
      case 'budget':
        return 'fa-solid fa-bullseye';
      case 'goal':
        return 'fa-solid fa-flag-checkered';
      default:
        return 'fa-solid fa-bell';
    }
  };

  const getTypeLabel = (type: AlertType) => {
    switch (type) {
      case 'bill':
        return 'Conta Fixa';
      case 'card':
        return 'Cartão';
      case 'budget':
        return 'Orçamento';
      case 'goal':
        return 'Meta';
      default:
        return 'Alerta';
    }
  };

  const getSeverityStyles = (severity: AlertSeverity) => {
    switch (severity) {
      case 'danger':
        return {
          cardBg: 'bg-rose-950/25 hover:bg-rose-950/40 border-rose-500/35',
          iconWrap: 'bg-rose-500/20 border-rose-500/40 text-rose-400',
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          btn: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-600/20',
        };
      case 'warning':
        return {
          cardBg: 'bg-amber-950/20 hover:bg-amber-950/35 border-amber-500/30',
          iconWrap: 'bg-amber-500/20 border-amber-500/30 text-amber-400',
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          btn: 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/20',
        };
      case 'info':
      default:
        return {
          cardBg: 'bg-blue-950/20 hover:bg-blue-950/35 border-blue-500/30',
          iconWrap: 'bg-blue-500/20 border-blue-500/30 text-blue-400',
          badge: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
          btn: 'bg-blue-600 hover:bg-blue-500 text-white shadow-blue-600/20',
        };
    }
  };

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Trigger Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2 rounded-xl transition-all duration-200 flex items-center justify-center ${
          isOpen
            ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/25 ring-2 ring-blue-500/40'
            : activeAlerts.length > 0
            ? 'bg-slate-800/90 hover:bg-slate-700/90 text-slate-200 border border-white/10 hover:border-white/20 shadow-md'
            : 'bg-slate-800/60 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-white/5'
        }`}
        title="Radar Financeiro (Alertas & Vencimentos)"
        aria-label="Radar Financeiro"
      >
        <i className={`text-base fa-solid ${activeAlerts.length > 0 ? 'fa-bell' : 'fa-bell text-slate-400'}`}></i>

        {/* Active Alerts Badge */}
        {activeAlerts.length > 0 && (
          <>
            {dangerCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500 text-[10px] font-black text-white items-center justify-center shadow-md">
                  {activeAlerts.length > 9 ? '9+' : activeAlerts.length}
                </span>
              </span>
            )}
            {dangerCount === 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[10px] font-black text-slate-950 shadow-md">
                {activeAlerts.length > 9 ? '9+' : activeAlerts.length}
              </span>
            )}
          </>
        )}
      </button>

      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 sm:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Popover Dropdown */}
      {isOpen && (
        <div className="fixed top-16 left-3 right-3 sm:left-auto sm:right-0 sm:top-full sm:absolute mt-0 sm:mt-3 w-auto sm:w-[420px] max-w-[calc(100vw-24px)] bg-slate-900/95 backdrop-blur-2xl border border-white/15 rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="p-4 border-b border-white/10 bg-slate-800/50 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white text-sm shadow-md">
                <i className="fa-solid fa-radar"></i>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-white text-sm">Radar Financeiro</h3>
                  {activeAlerts.length > 0 && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-full border ${
                        dangerCount > 0
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                          : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      }`}
                    >
                      {activeAlerts.length} {activeAlerts.length === 1 ? 'pendência' : 'pendências'}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400">Vencimentos, faturas e limites em alerta</p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              {activeAlerts.length > 0 && (
                <button
                  type="button"
                  onClick={handleDismissAll}
                  className="text-[11px] font-medium text-slate-400 hover:text-slate-200 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
                  title="Dispensar todos os alertas desta sessão"
                >
                  Limpar
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors"
                aria-label="Fechar"
              >
                <i className="fa-solid fa-xmark text-xs"></i>
              </button>
            </div>
          </div>

          {/* Filter Chips */}
          {activeAlerts.length > 0 && (
            <div className="px-3.5 py-2.5 bg-slate-950/50 border-b border-white/5 flex items-center gap-1.5 overflow-x-auto custom-scrollbar no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                  activeFilter === 'all'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700'
                }`}
              >
                Todos ({activeAlerts.length})
              </button>

              {dangerCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveFilter('danger')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all flex items-center gap-1 ${
                    activeFilter === 'danger'
                      ? 'bg-rose-600 text-white shadow-sm'
                      : 'bg-rose-950/40 text-rose-300 hover:bg-rose-900/50 border border-rose-500/20'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                  Urgentes ({dangerCount})
                </button>
              )}

              {billsCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveFilter('bill')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                    activeFilter === 'bill'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  Contas ({billsCount})
                </button>
              )}

              {cardsCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveFilter('card')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                    activeFilter === 'card'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  Cartões ({cardsCount})
                </button>
              )}

              {budgetsCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveFilter('budget')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                    activeFilter === 'budget'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  Orçamentos ({budgetsCount})
                </button>
              )}

              {goalsCount > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveFilter('goal')}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all ${
                    activeFilter === 'goal'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-slate-800/80 text-slate-400 hover:text-white hover:bg-slate-700'
                  }`}
                >
                  Metas ({goalsCount})
                </button>
              )}
            </div>
          )}

          {/* Alerts List */}
          <div className="p-3 space-y-2.5 max-h-[65vh] sm:max-h-[380px] overflow-y-auto custom-scrollbar">
            {visibleAlerts.length > 0 ? (
              visibleAlerts.map((alert) => {
                const styles = getSeverityStyles(alert.severity);
                return (
                  <div
                    key={alert.id}
                    onClick={() => handleAlertClick(alert)}
                    className={`p-3 rounded-xl border transition-all duration-200 cursor-pointer relative group ${styles.cardBg}`}
                  >
                    {/* Top Row: Type & Dismiss */}
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border inline-flex items-center gap-1 ${styles.badge}`}
                        >
                          <i className={`${getTypeIcon(alert.type)} text-[9px]`}></i>
                          {getTypeLabel(alert.type)}
                        </span>
                        {alert.dateLabel && (
                          <span className="text-[10px] text-slate-400 font-medium">
                            {alert.dateLabel}
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleDismiss(alert.id, e)}
                        className="opacity-0 group-hover:opacity-100 w-5 h-5 rounded hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center text-[10px] transition-all"
                        title="Dispensar alerta"
                      >
                        <i className="fa-solid fa-xmark"></i>
                      </button>
                    </div>

                    {/* Content */}
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs flex-shrink-0 border mt-0.5 ${styles.iconWrap}`}
                      >
                        <i className={getTypeIcon(alert.type)}></i>
                      </div>

                      <div className="flex-1 min-w-0">
                        <h4 className="font-bold text-white text-xs sm:text-sm tracking-tight leading-tight">
                          {alert.title}
                        </h4>
                        <p className="text-[11px] font-medium text-slate-300 mt-0.5">
                          {alert.subtitle}
                        </p>
                        <p className="text-[11px] text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {alert.description}
                        </p>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-xs">
                      {alert.formattedAmount ? (
                        <span className="font-extrabold text-white text-xs tabular-nums">
                          {alert.formattedAmount}
                        </span>
                      ) : (
                        <span></span>
                      )}

                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-400 group-hover:text-blue-300 transition-colors">
                        <span>{alert.actionLabel}</span>
                        <i className="fa-solid fa-arrow-right text-[9px] transition-transform group-hover:translate-x-0.5"></i>
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-8 px-4 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center text-xl mx-auto mb-2.5 shadow-lg shadow-emerald-500/10">
                  <i className="fa-solid fa-circle-check"></i>
                </div>
                <h4 className="font-bold text-white text-sm">Tudo em dia!</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-[260px] mx-auto">
                  Nenhuma conta atrasada, fatura pendente ou limite de orçamento estourado no momento.
                </p>
              </div>
            )}
          </div>

          {/* Footer Info */}
          <div className="p-2.5 bg-slate-950/80 border-t border-white/5 text-center text-[10px] text-slate-500">
            <span>Radar atualizado automaticamente em tempo real com seu SQLite</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
