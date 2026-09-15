
import React, { useState } from 'react';
import { DataProvider, useData } from './contexts/DataContext';
import { UserProvider, useUser } from './contexts/UserContext';
import { Transaction, Category, TransactionType, Bill, Budget, FinancialGoal, Loan, SavingsTransactionType } from './types';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import AddTransactionModal from './components/AddTransactionModal';
import CardsManagement from './components/CardsManagement';
import RecurringManagement from './components/RecurringManagement';
import ConfirmationModal from './components/ConfirmationModal';
import ErrorModal from './components/ErrorModal';
import SavingsManagement from './components/SavingsManagement';
import SavingsTransferModal from './components/SavingsTransferModal';
import LoansManagement from './components/LoansManagement';
import AddLoanModal from './components/AddLoanModal';
import LoanPaymentModal from './components/LoanPaymentModal';
import LoginScreen from './components/LoginScreen';
import Reports from './components/Reports';
import BillsManagement from './components/BillsManagement';
import AddBillModal from './components/AddBillModal';
import BudgetManagement from './components/BudgetManagement';
import AddBudgetModal from './components/AddBudgetModal';
import GoalsManagement from './components/GoalsManagement';
import AddGoalModal from './components/AddGoalModal';
import CategoryManagement from './components/CategoryManagement';
import AddCategoryModal from './components/AddCategoryModal';


type View = 'dashboard' | 'transactions' | 'cards' | 'recurring' | 'savings' | 'loans' | 'reports' | 'bills' | 'budget' | 'goals' | 'settings';

type TransactionFilters = {
  category: string;
  startDate: string;
  endDate: string;
}

const AppContent: React.FC = () => {
  const { currentUser, logout } = useUser();
  const data = useData();

  const [activeView, setActiveView] = useState<View>('dashboard');
  
  // --- Modals State ---
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [prefillingTransaction, setPrefillingTransaction] = useState<Partial<Transaction> | null>(null);
  const [transactionListFilters, setTransactionListFilters] = useState<TransactionFilters | null>(null);
  const [savingsModalProps, setSavingsModalProps] = useState<{ isOpen: boolean; type: SavingsTransactionType }>({ isOpen: false, type: SavingsTransactionType.DEPOSIT });
  const [addLoanModalOpen, setAddLoanModalOpen] = useState(false);
  const [loanPaymentModalProps, setLoanPaymentModalProps] = useState<{ isOpen: boolean; loan: Loan | null }>({ isOpen: false, loan: null });
  const [addBillModalProps, setAddBillModalProps] = useState<{isOpen: boolean, billToEdit: Bill | null, initialYear?: number, initialMonth?: number}>({isOpen: false, billToEdit: null});
  const [addBudgetModalProps, setAddBudgetModalProps] = useState<{isOpen: boolean, budgetToEdit: Budget | null, year: number, month: number}>({
    isOpen: false,
    budgetToEdit: null,
    year: new Date().getFullYear(),
    month: new Date().getMonth(),
  });
  const [addGoalModalProps, setAddGoalModalProps] = useState<{ isOpen: boolean; goalToEdit: FinancialGoal | null }>({ isOpen: false, goalToEdit: null });
  const [addCategoryModalProps, setAddCategoryModalProps] = useState<{isOpen: boolean, categoryToEdit: Category | null}>({isOpen: false, categoryToEdit: null});
  const [confirmationProps, setConfirmationProps] = useState<{ isOpen: boolean; title: string; message: string; onConfirm: () => void; }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const [errorProps, setErrorProps] = useState<{ isOpen: boolean; title: string; message: string; }>({ isOpen: false, title: '', message: '' });
  
  // --- Navigation State ---
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const mobileMenuRef = React.useRef<HTMLDivElement>(null);

  // Close mobile menu on click outside
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node)) {
        setIsMobileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [mobileMenuRef]);


  const handleEditTransaction = (transaction: Transaction) => {
    setEditingTransaction(transaction);
    setIsModalOpen(true);
  };
  
  const handleCloseModal = () => {
      setIsModalOpen(false);
      setEditingTransaction(null);
      setPrefillingTransaction(null);
      data.setPendingBillPayment(null);
  }

  const handlePayBill = (bill: Bill, nextDueDate: Date, customAmount?: number) => {
      const amountToUse = typeof customAmount === 'number' && customAmount > 0 ? customAmount : bill.estimatedAmount;
      data.setPendingBillPayment({
        billId: bill.id,
        year: nextDueDate.getUTCFullYear(),
        month: nextDueDate.getUTCMonth(),
      });
      setPrefillingTransaction({
        description: `Pagamento - ${bill.name}`,
        amount: amountToUse,
        category: bill.category,
        date: nextDueDate.toISOString().split('T')[0],
        type: TransactionType.EXPENSE,
      });
      setIsModalOpen(true);
  };
    
  const handleDeleteTransaction = (transactionId: string) => {
    setConfirmationProps({
      isOpen: true,
      title: 'Excluir Transação',
      message: 'Tem certeza que deseja excluir esta transação? Esta ação não pode ser desfeita.',
      onConfirm: () => data.deleteTransaction(transactionId)
    });
  };

  const handleCancelRecurringTransaction = (recurringId: string) => {
    setConfirmationProps({
      isOpen: true,
      title: 'Cancelar Recorrência',
      message: 'Tem certeza que deseja cancelar esta recorrência? Transações futuras não serão mais geradas, mas as já existentes serão mantidas.',
      onConfirm: () => data.cancelRecurringTransaction(recurringId)
    });
  };
  
  const handleDeleteCreditCard = (cardId: string) => {
    if (data.transactions.some(t => t.creditCardId === cardId)) {
        showError('Cartão em Uso', 'Não é possível excluir este cartão, pois ele está vinculado a uma ou mais transações. Remova as transações antes de excluir o cartão.');
        return;
    }
    setConfirmationProps({
      isOpen: true,
      title: 'Excluir Cartão de Crédito',
      message: 'Tem certeza que deseja excluir este cartão de crédito?',
      onConfirm: () => data.deleteCreditCard(cardId)
    });
  };

  const handleDeleteBill = (billId: string) => {
    setConfirmationProps({
        isOpen: true,
        title: "Excluir Conta",
        message: "Tem certeza que deseja excluir esta conta? Isso não afetará transações já registradas.",
        onConfirm: () => data.deleteBill(billId)
    });
  };

  const handleDeleteBudget = (budgetId: string) => {
    setConfirmationProps({
        isOpen: true,
        title: "Excluir Orçamento",
        message: "Tem certeza que deseja excluir este orçamento? Esta ação não pode ser desfeita.",
        onConfirm: () => data.deleteBudget(budgetId)
    });
  };

  const handleDeleteFinancialGoal = (goalId: string) => {
    setConfirmationProps({
        isOpen: true,
        title: "Excluir Meta",
        message: "Tem certeza que deseja excluir esta meta? Todas as contribuições associadas também serão removidas.",
        onConfirm: () => data.deleteFinancialGoal(goalId)
    });
  };

  const handleDeleteCategory = (categoryId: string) => {
      const isCategoryInUse = data.transactions.some(t => t.category === categoryId) ||
                              data.budgets.some(b => b.categoryId === categoryId) ||
                              data.bills.some(b => b.category === categoryId);
      
      if (isCategoryInUse) {
          showError('Categoria em Uso', 'Não é possível excluir esta categoria, pois ela já está sendo utilizada em transações, orçamentos ou contas.');
          return;
      }

      setConfirmationProps({
          isOpen: true,
          title: "Excluir Categoria",
          message: "Tem certeza que deseja excluir esta categoria? Esta ação não pode ser desfeita.",
          onConfirm: () => data.deleteCategory(categoryId)
      });
  };
  
  const handleCloseConfirmation = () => setConfirmationProps({ isOpen: false, title: '', message: '', onConfirm: () => {} });
  const showError = (title: string, message: string) => setErrorProps({ isOpen: true, title, message });
  const handleCloseError = () => setErrorProps({ isOpen: false, title: '', message: '' });

  const getDateRangeFromPeriod = (period: '30d' | '90d' | '365d') => {
    const now = new Date();
    const endDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    let startDate = new Date(endDate);
    if (period === '30d') {
        startDate.setUTCDate(startDate.getUTCDate() - 30);
    } else if (period === '90d') {
        startDate.setUTCDate(startDate.getUTCDate() - 90);
    } else if (period === '365d') {
        startDate.setUTCFullYear(startDate.getUTCFullYear() - 1);
    }
    startDate.setUTCHours(0, 0, 0, 0);
    return {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
    }
  }

  const handleCategoryReportClick = (categoryId: string, period: '30d' | '90d' | '365d') => {
    const { startDate, endDate } = getDateRangeFromPeriod(period);
    setTransactionListFilters({
        category: categoryId,
        startDate,
        endDate,
    });
    setActiveView('transactions');
  };
  
  const handleDashboardCategoryClick = (categoryId: string) => {
    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth();
    const firstDay = new Date(Date.UTC(year, month, 1));
    const lastDay = new Date(Date.UTC(year, month + 1, 0));

    setTransactionListFilters({
        category: categoryId,
        startDate: firstDay.toISOString().split('T')[0],
        endDate: lastDay.toISOString().split('T')[0],
    });
    setActiveView('transactions');
  };

  const handleMonthSummaryClick = (year: number, month: number) => {
    const firstDay = new Date(Date.UTC(year, month, 1));
    const lastDay = new Date(Date.UTC(year, month + 1, 0));

    setTransactionListFilters({
        category: '',
        startDate: firstDay.toISOString().split('T')[0],
        endDate: lastDay.toISOString().split('T')[0],
    });
    setActiveView('transactions');
  };

  const handleNavClick = (view: View) => {
    setActiveView(view);
    if (view === 'transactions') {
      setTransactionListFilters(null);
    }
    setIsMobileMenuOpen(false); // Close menu on navigation
  };


  const renderView = () => {
    switch(activeView) {
      case 'dashboard': return <Dashboard transactions={data.transactions} creditCards={data.creditCards} savingsTransactions={data.savingsTransactions} bills={data.bills} billPayments={data.billPayments} billMonthlyAmounts={data.billMonthlyAmounts} budgets={data.budgets} financialGoals={data.financialGoals} onPayBill={handlePayBill} allCategories={data.allCategories} onBudgetCategoryClick={handleDashboardCategoryClick} onMonthSummaryClick={handleMonthSummaryClick} />;
      case 'reports': return <Reports transactions={data.transactions} creditCards={data.creditCards} allCategories={data.allCategories} onCategoryClick={handleCategoryReportClick} />;
      case 'transactions': return <TransactionList transactions={data.transactions} onEdit={handleEditTransaction} onDelete={handleDeleteTransaction} allCategories={data.allCategories} initialFilters={transactionListFilters} onFiltersApplied={() => setTransactionListFilters(null)} />;
      case 'cards': return <CardsManagement creditCards={data.creditCards} onAddCard={data.addCreditCard} onUpdateCard={data.updateCreditCard} transactions={data.transactions} onDeleteCard={handleDeleteCreditCard} allCategories={data.allCategories} />;
      case 'recurring': return <RecurringManagement recurringTransactions={data.recurringTransactions} onCancel={handleCancelRecurringTransaction} allCategories={data.allCategories} />;
      case 'savings': return <SavingsManagement savingsTransactions={data.savingsTransactions} onOpenModal={(type) => setSavingsModalProps({ isOpen: true, type })} />;
      case 'loans': return <LoansManagement loans={data.loans} loanPayments={data.loanPayments} onAddLoan={() => setAddLoanModalOpen(true)} onRegisterPayment={(loan) => setLoanPaymentModalProps({ isOpen: true, loan })}/>;
      case 'bills': return (
        <BillsManagement
          bills={data.bills}
          billPayments={data.billPayments}
          billMonthlyAmounts={data.billMonthlyAmounts}
          allCategories={data.allCategories}
          onAdd={(year, month) => setAddBillModalProps({ isOpen: true, billToEdit: null, initialYear: year, initialMonth: month })}
          onEdit={(bill) => setAddBillModalProps({ isOpen: true, billToEdit: bill })}
          onDelete={handleDeleteBill}
          onPayBill={handlePayBill}
          onSetMonthlyAmount={data.setBillMonthlyAmount}
          onRemoveMonthlyAmount={data.removeBillMonthlyAmount}
          onToggleStatus={(bill) =>
            data.updateBill({ ...bill, status: bill.status === 'active' ? 'inactive' : 'active' })
          }
        />
      );
      case 'budget': return <BudgetManagement
        budgets={data.budgets}
        transactions={data.transactions}
        creditCards={data.creditCards}
        onAdd={(year, month) => setAddBudgetModalProps({isOpen: true, budgetToEdit: null, year, month})}
        onEdit={(budget) => setAddBudgetModalProps({isOpen: true, budgetToEdit: budget, year: budget.year, month: budget.month})}
        onDelete={handleDeleteBudget}
        onCopyBudgets={data.addMultipleBudgets}
        onError={showError}
        allCategories={data.allCategories}
      />;
      case 'goals': return <GoalsManagement
        goals={data.financialGoals}
        onAdd={() => setAddGoalModalProps({isOpen: true, goalToEdit: null})}
        onEdit={(goal) => setAddGoalModalProps({isOpen: true, goalToEdit: goal})}
        onDelete={handleDeleteFinancialGoal}
      />;
      case 'settings': return <CategoryManagement
          customCategories={data.customCategories}
          onAddCategory={() => setAddCategoryModalProps({isOpen: true, categoryToEdit: null})}
          onUpdateCategory={(cat) => setAddCategoryModalProps({isOpen: true, categoryToEdit: cat})}
          onDeleteCategory={handleDeleteCategory}
        />;
      default: return <Dashboard transactions={data.transactions} creditCards={data.creditCards} savingsTransactions={data.savingsTransactions} bills={data.bills} billPayments={data.billPayments} billMonthlyAmounts={data.billMonthlyAmounts} budgets={data.budgets} financialGoals={data.financialGoals} onPayBill={handlePayBill} allCategories={data.allCategories} onBudgetCategoryClick={handleDashboardCategoryClick} onMonthSummaryClick={handleMonthSummaryClick} />;
    }
  }
  
  const mainNavItems = [
    { view: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
    { view: 'reports', label: 'Relatórios', icon: 'fa-chart-line' },
    { view: 'transactions', label: 'Transações', icon: 'fa-exchange-alt' },
    { view: 'budget', label: 'Orçamentos', icon: 'fa-bullseye' },
    { view: 'bills', label: 'Contas', icon: 'fa-file-invoice-dollar' },
  ] as const;

  const moreNavItems = [
    { view: 'goals', label: 'Metas', icon: 'fa-flag-checkered' },
    { view: 'cards', label: 'Cartões', icon: 'fa-credit-card' },
    { view: 'savings', label: 'Poupança', icon: 'fa-piggy-bank' },
    { view: 'loans', label: 'Empréstimos', icon: 'fa-hand-holding-dollar' },
    { view: 'recurring', label: 'Recorrências', icon: 'fa-sync-alt' },
    { view: 'settings', label: 'Ajustes', icon: 'fa-gear' },
  ] as const;

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('fincontrol_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('fincontrol_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const NavButton: React.FC<{
    view: View;
    label: string;
    icon: string;
    onClick: (view: View) => void;
    isCollapsed?: boolean;
  }> = ({ view, label, icon, onClick, isCollapsed }) => {
    const isActive = activeView === view;
    return (
      <button
        onClick={() => onClick(view)}
        title={isCollapsed ? label : undefined}
        className={`group relative flex items-center rounded-xl transition-all duration-200 ${
          isCollapsed
            ? 'justify-center w-11 h-11 mx-auto'
            : 'justify-start gap-3 px-3.5 py-2.5 w-full text-left font-medium text-sm'
        } ${
          isActive
            ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/25 font-semibold'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
        }`}
      >
        <div
          className={`flex items-center justify-center transition-colors ${
            isCollapsed ? 'w-full h-full text-base' : 'w-7 h-7 rounded-lg text-sm'
          } ${
            isActive && !isCollapsed
              ? 'bg-white/20 text-white'
              : isCollapsed
              ? isActive
                ? 'text-white'
                : 'text-slate-400 group-hover:text-blue-400'
              : 'text-slate-400 group-hover:text-blue-400 group-hover:bg-blue-500/10'
          }`}
        >
          <i className={`fa-solid ${icon}`}></i>
        </div>
        {!isCollapsed && <span className="text-xs sm:text-sm truncate">{label}</span>}

        {/* Tooltip on hover when collapsed */}
        {isCollapsed && (
          <span className="pointer-events-none absolute left-full ml-3 px-2.5 py-1 bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
            {label}
          </span>
        )}
      </button>
    );
  };

  const isMoreActive = !['dashboard', 'transactions', 'bills'].includes(activeView);

  return (
    <div className="flex flex-col md:flex-row min-h-screen text-slate-100">
      {/* Desktop Sidebar (visible on md and up) */}
      <nav
        className={`hidden md:flex transition-all duration-300 ease-in-out bg-slate-900/80 backdrop-blur-xl flex-col justify-between items-stretch gap-2 border-r border-white/[0.08] relative z-20 ${
          isSidebarCollapsed ? 'md:w-20 p-2.5' : 'md:w-64 p-4'
        }`}
      >
        <div className="flex flex-col w-full h-full">
          {/* Header Card / User Info */}
          {!isSidebarCollapsed ? (
            <div className="flex flex-col items-center gap-2.5 mb-6 flex-shrink-0 bg-slate-800/40 p-4 rounded-2xl border border-white/[0.06] shadow-sm relative">
              <button
                onClick={toggleSidebar}
                className="absolute top-3 right-3 w-7 h-7 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs transition-colors border border-white/5"
                title="Recolher menu lateral (somente ícones)"
                aria-label="Recolher menu lateral"
              >
                <i className="fa-solid fa-chevron-left"></i>
              </button>
              <div className="w-14 h-14 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-2xl flex items-center justify-center text-white text-xl font-bold shadow-lg shadow-blue-500/25 border border-white/20">
                {currentUser?.displayName?.charAt(0).toUpperCase()}
              </div>
              <div className="text-center">
                <h1 className="text-base font-bold text-white leading-tight truncate max-w-[170px]">
                  Olá, {currentUser?.displayName}
                </h1>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 mt-1.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  <span>SQLite Local</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 mb-6 flex-shrink-0 bg-slate-800/40 p-2 rounded-2xl border border-white/[0.06] shadow-sm">
              <button
                onClick={toggleSidebar}
                className="w-10 h-10 rounded-xl bg-slate-800 hover:bg-blue-600 hover:text-white text-slate-400 flex items-center justify-center text-sm transition-all border border-white/5 shadow-sm group"
                title="Expandir menu lateral"
                aria-label="Expandir menu lateral"
              >
                <i className="fa-solid fa-chevron-right transition-transform group-hover:translate-x-0.5"></i>
              </button>
              <div className="relative group">
                <div className="w-10 h-10 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-md shadow-blue-500/25 border border-white/20">
                  {currentUser?.displayName?.charAt(0).toUpperCase()}
                </div>
                <span
                  className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-900 animate-pulse"
                  title="SQLite Conectado"
                ></span>
              </div>
            </div>
          )}

          {/* Navigation Items */}
          <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto custom-scrollbar">
            {[...mainNavItems, ...moreNavItems].map((item) => (
              <NavButton
                key={item.view}
                {...item}
                onClick={handleNavClick}
                isCollapsed={isSidebarCollapsed}
              />
            ))}
          </div>

          {/* Logout Button */}
          <div className="mt-auto pt-4 border-t border-slate-700/50">
            {!isSidebarCollapsed ? (
              <button
                onClick={logout}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl transition-all duration-200 w-full text-left text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 text-sm font-medium"
              >
                <i className="fa-solid fa-sign-out-alt w-5 text-center"></i>
                <span>Sair</span>
              </button>
            ) : (
              <button
                onClick={logout}
                className="group relative flex items-center justify-center w-11 h-11 mx-auto rounded-xl transition-all duration-200 text-rose-400 hover:bg-rose-500/15 hover:text-rose-300"
                title="Sair"
                aria-label="Sair"
              >
                <i className="fa-solid fa-sign-out-alt text-base"></i>
                <span className="pointer-events-none absolute left-full ml-3 px-2.5 py-1 bg-slate-800 text-rose-300 text-xs font-semibold rounded-lg shadow-xl border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-50">
                  Sair
                </span>
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Mobile Sticky Top Header */}
      <header className="md:hidden sticky top-0 z-30 bg-slate-900/90 backdrop-blur-xl border-b border-white/[0.08] px-4 py-3 flex items-center justify-between shadow-md">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-gradient-to-tr from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center text-white text-sm font-bold shadow-md shadow-blue-500/20 border border-white/20">
            {currentUser?.displayName?.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-bold text-white leading-tight">
                Olá, {currentUser?.displayName?.split(' ')[0]}
              </h1>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
            </div>
            <p className="text-[10px] text-slate-400 font-medium">FinControl SQLite</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsMobileMenuOpen(true)}
            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold border border-white/10 flex items-center gap-1.5 transition-colors"
          >
            <i className="fa-solid fa-layer-group text-xs text-blue-400"></i>
            <span>Menus</span>
          </button>
          <button
            onClick={logout}
            className="w-8 h-8 rounded-xl bg-slate-800/80 hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 border border-white/5 flex items-center justify-center text-xs transition-colors"
            title="Sair"
            aria-label="Sair"
          >
            <i className="fa-solid fa-sign-out-alt"></i>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-28 md:pb-8 overflow-y-auto custom-scrollbar">
        {renderView()}
      </main>
      
      {/* Desktop Floating Action Button */}
      <button
        onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }}
        className="hidden md:flex fixed bottom-6 right-6 bg-gradient-to-tr from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl w-14 h-14 items-center justify-center shadow-xl shadow-blue-600/30 transition-all duration-300 hover:scale-105 active:scale-95 z-30"
        aria-label="Adicionar Transação"
      >
        <i className="fa-solid fa-plus text-2xl transition-transform duration-300 hover:rotate-90"></i>
      </button>

      {/* Mobile Bottom Navigation Dock */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-2xl border-t border-white/[0.08] px-2 py-1.5 flex items-center justify-around shadow-2xl shadow-black">
        {/* 1. Dashboard */}
        <button
          onClick={() => handleNavClick('dashboard')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeView === 'dashboard'
              ? 'text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
            activeView === 'dashboard' ? 'bg-blue-500/20 text-blue-400 shadow-sm shadow-blue-500/30' : ''
          }`}>
            <i className="fa-solid fa-chart-pie text-sm"></i>
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight font-medium">Início</span>
        </button>

        {/* 2. Transactions */}
        <button
          onClick={() => handleNavClick('transactions')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeView === 'transactions'
              ? 'text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
            activeView === 'transactions' ? 'bg-blue-500/20 text-blue-400 shadow-sm shadow-blue-500/30' : ''
          }`}>
            <i className="fa-solid fa-exchange-alt text-sm"></i>
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight font-medium">Extrato</span>
        </button>

        {/* 3. Center Elevated Plus Button */}
        <div className="flex-1 flex justify-center -mt-6">
          <button
            onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }}
            className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-blue-500 text-white flex items-center justify-center shadow-xl shadow-blue-600/40 border-2 border-slate-900 active:scale-95 transition-all hover:scale-105"
            aria-label="Nova Transação"
          >
            <i className="fa-solid fa-plus text-xl"></i>
          </button>
        </div>

        {/* 4. Bills */}
        <button
          onClick={() => handleNavClick('bills')}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            activeView === 'bills'
              ? 'text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
            activeView === 'bills' ? 'bg-blue-500/20 text-blue-400 shadow-sm shadow-blue-500/30' : ''
          }`}>
            <i className="fa-solid fa-file-invoice-dollar text-sm"></i>
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight font-medium">Contas</span>
        </button>

        {/* 5. More Menu */}
        <button
          onClick={() => setIsMobileMenuOpen(true)}
          className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${
            isMoreActive
              ? 'text-blue-400 font-bold'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center relative transition-all ${
            isMoreActive ? 'bg-blue-500/20 text-blue-400 shadow-sm shadow-blue-500/30' : ''
          }`}>
            <i className="fa-solid fa-bars text-sm"></i>
            {isMoreActive && (
              <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-blue-400 rounded-full"></span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight font-medium">Mais</span>
        </button>
      </nav>

      {/* Mobile "Mais" Bottom Sheet Drawer */}
      {isMobileMenuOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 flex flex-col justify-end bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsMobileMenuOpen(false)}
        >
          <div
            ref={mobileMenuRef}
            className="bg-slate-900 border-t border-white/10 rounded-t-3xl shadow-2xl p-5 max-h-[85vh] overflow-y-auto custom-scrollbar flex flex-col space-y-4 animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Grabber Handle */}
            <div className="w-12 h-1.5 bg-slate-700 rounded-full mx-auto -mt-1 mb-1"></div>

            {/* Drawer Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/[0.08]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 flex items-center justify-center text-sm">
                  <i className="fa-solid fa-layer-group"></i>
                </div>
                <div>
                  <h3 className="font-bold text-white text-base">Módulos & Ferramentas</h3>
                  <p className="text-xs text-slate-400">Acesse todas as áreas do FinControl</p>
                </div>
              </div>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors flex items-center justify-center text-sm border border-white/5"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Grid of All Additional Menus */}
            <div className="grid grid-cols-2 gap-2.5 py-1">
              {[
                { view: 'reports' as const, label: 'Relatórios', icon: 'fa-chart-line', iconColor: 'text-blue-400', desc: 'Evolução e gráficos' },
                { view: 'budget' as const, label: 'Orçamentos', icon: 'fa-bullseye', iconColor: 'text-purple-400', desc: 'Metas por categoria' },
                { view: 'goals' as const, label: 'Metas', icon: 'fa-flag-checkered', iconColor: 'text-amber-400', desc: 'Objetivos financeiros' },
                { view: 'cards' as const, label: 'Cartões', icon: 'fa-credit-card', iconColor: 'text-sky-400', desc: 'Faturas e limites' },
                { view: 'savings' as const, label: 'Poupança', icon: 'fa-piggy-bank', iconColor: 'text-emerald-400', desc: 'Reserva e aportes' },
                { view: 'loans' as const, label: 'Empréstimos', icon: 'fa-hand-holding-dollar', iconColor: 'text-rose-400', desc: 'Gestão de dívidas' },
                { view: 'recurring' as const, label: 'Recorrências', icon: 'fa-sync-alt', iconColor: 'text-indigo-400', desc: 'Gastos fixos mensais' },
                { view: 'settings' as const, label: 'Ajustes', icon: 'fa-gear', iconColor: 'text-slate-300', desc: 'Categorias e opções' },
              ].map((item) => {
                const isActive = activeView === item.view;
                return (
                  <button
                    key={item.view}
                    onClick={() => handleNavClick(item.view)}
                    className={`flex flex-col p-3 rounded-2xl border text-left transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-400/50 shadow-lg shadow-blue-500/20'
                        : 'bg-slate-800/60 hover:bg-slate-800 border-white/[0.06]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm ${
                        isActive ? 'bg-white/20 text-white' : 'bg-slate-800/80 ' + item.iconColor
                      }`}>
                        <i className={`fa-solid ${item.icon}`}></i>
                      </div>
                      {isActive && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/20 text-white">
                          Ativo
                        </span>
                      )}
                    </div>
                    <span className={`text-sm font-bold truncate ${isActive ? 'text-white' : 'text-slate-200'}`}>
                      {item.label}
                    </span>
                    <span className={`text-[11px] truncate ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                      {item.desc}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Logout button at bottom of drawer */}
            <div className="pt-2 border-t border-white/[0.08]">
              <button
                onClick={logout}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 text-sm font-bold border border-rose-500/20 transition-colors"
              >
                <i className="fa-solid fa-sign-out-alt"></i>
                <span>Sair da Conta</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <AddTransactionModal
          onClose={handleCloseModal}
          onAddTransaction={data.addTransaction}
          onAddRecurringTransaction={data.addRecurringTransaction}
          onUpdateTransaction={data.updateTransaction}
          creditCards={data.creditCards}
          transactionToEdit={editingTransaction}
          transactionToPrefill={prefillingTransaction}
          onError={showError}
          allCategories={data.allCategories}
        />
      )}

      {savingsModalProps.isOpen && (
        <SavingsTransferModal
          type={savingsModalProps.type}
          onClose={() => setSavingsModalProps({ isOpen: false, type: SavingsTransactionType.DEPOSIT })}
          onSave={data.handleAddSavingsTransaction}
          goals={data.financialGoals}
          onError={showError}
        />
      )}
      
      {addLoanModalOpen && (
        <AddLoanModal onClose={() => setAddLoanModalOpen(false)} onAddLoan={data.addLoan} onError={showError} />
      )}

      {loanPaymentModalProps.isOpen && loanPaymentModalProps.loan && (
        <LoanPaymentModal loan={loanPaymentModalProps.loan} onClose={() => setLoanPaymentModalProps({isOpen: false, loan: null})} onSave={data.registerLoanPayment} onError={showError} />
      )}

      {addBillModalProps.isOpen && (
        <AddBillModal
            onClose={() => setAddBillModalProps({isOpen: false, billToEdit: null})}
            onAdd={data.addBill}
            onUpdate={data.updateBill}
            billToEdit={addBillModalProps.billToEdit}
            initialYear={addBillModalProps.initialYear}
            initialMonth={addBillModalProps.initialMonth}
            onError={showError}
            allCategories={data.allCategories}
        />
      )}

      {addBudgetModalProps.isOpen && (
        <AddBudgetModal
            onClose={() => setAddBudgetModalProps({ ...addBudgetModalProps, isOpen: false })}
            onAdd={data.addBudget}
            onUpdate={data.updateBudget}
            budgetToEdit={addBudgetModalProps.budgetToEdit}
            year={addBudgetModalProps.year}
            month={addBudgetModalProps.month}
            existingBudgets={data.budgets}
            onError={showError}
            allCategories={data.allCategories}
        />
      )}
      
      {addGoalModalProps.isOpen && (
        <AddGoalModal
            onClose={() => setAddGoalModalProps({isOpen: false, goalToEdit: null})}
            onAdd={data.addFinancialGoal}
            onUpdate={data.updateFinancialGoal}
            goalToEdit={addGoalModalProps.goalToEdit}
            onError={showError}
        />
      )}
      
      {addCategoryModalProps.isOpen && (
          <AddCategoryModal
              onClose={() => setAddCategoryModalProps({isOpen: false, categoryToEdit: null})}
              onAdd={data.addCategory}
              onUpdate={data.updateCategory}
              categoryToEdit={addCategoryModalProps.categoryToEdit}
              existingCategories={data.allCategories}
              onError={showError}
          />
      )}

      <ConfirmationModal isOpen={confirmationProps.isOpen} onClose={handleCloseConfirmation} onConfirm={confirmationProps.onConfirm} title={confirmationProps.title} message={confirmationProps.message} />
      <ErrorModal isOpen={errorProps.isOpen} onClose={handleCloseError} title={errorProps.title} message={errorProps.message} />
    </div>
  );
};


const App: React.FC = () => {
  return (
    <UserProvider>
        <AppWithData />
    </UserProvider>
  )
}

const AppWithData: React.FC = () => {
  const { currentUser, loading } = useUser();

  if (loading) {
      return (
          <div className="flex items-center justify-center min-h-screen bg-gray-900">
              <i className="fa-solid fa-spinner fa-spin text-4xl text-blue-500"></i>
          </div>
      );
  }

  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}

export default App;
