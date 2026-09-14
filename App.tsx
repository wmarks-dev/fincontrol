
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
  const [addBillModalProps, setAddBillModalProps] = useState<{isOpen: boolean, billToEdit: Bill | null}>({isOpen: false, billToEdit: null});
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

  const handlePayBill = (bill: Bill, nextDueDate: Date) => {
      data.setPendingBillPayment({
        billId: bill.id,
        year: nextDueDate.getUTCFullYear(),
        month: nextDueDate.getUTCMonth(),
      });
      setPrefillingTransaction({
        description: `Pagamento - ${bill.name}`,
        amount: bill.estimatedAmount,
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
      case 'dashboard': return <Dashboard transactions={data.transactions} creditCards={data.creditCards} savingsTransactions={data.savingsTransactions} bills={data.bills} billPayments={data.billPayments} budgets={data.budgets} financialGoals={data.financialGoals} onPayBill={handlePayBill} allCategories={data.allCategories} onBudgetCategoryClick={handleDashboardCategoryClick} onMonthSummaryClick={handleMonthSummaryClick} />;
      case 'reports': return <Reports transactions={data.transactions} creditCards={data.creditCards} allCategories={data.allCategories} onCategoryClick={handleCategoryReportClick} />;
      case 'transactions': return <TransactionList transactions={data.transactions} onEdit={handleEditTransaction} onDelete={handleDeleteTransaction} allCategories={data.allCategories} initialFilters={transactionListFilters} onFiltersApplied={() => setTransactionListFilters(null)} />;
      case 'cards': return <CardsManagement creditCards={data.creditCards} onAddCard={data.addCreditCard} onUpdateCard={data.updateCreditCard} transactions={data.transactions} onDeleteCard={handleDeleteCreditCard} allCategories={data.allCategories} />;
      case 'recurring': return <RecurringManagement recurringTransactions={data.recurringTransactions} onCancel={handleCancelRecurringTransaction} allCategories={data.allCategories} />;
      case 'savings': return <SavingsManagement savingsTransactions={data.savingsTransactions} onOpenModal={(type) => setSavingsModalProps({ isOpen: true, type })} />;
      case 'loans': return <LoansManagement loans={data.loans} loanPayments={data.loanPayments} onAddLoan={() => setAddLoanModalOpen(true)} onRegisterPayment={(loan) => setLoanPaymentModalProps({ isOpen: true, loan })}/>;
      case 'bills': return <BillsManagement bills={data.bills} onAdd={() => setAddBillModalProps({isOpen: true, billToEdit: null})} onEdit={(bill) => setAddBillModalProps({isOpen: true, billToEdit: bill})} onDelete={handleDeleteBill} allCategories={data.allCategories} />;
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
      default: return <Dashboard transactions={data.transactions} creditCards={data.creditCards} savingsTransactions={data.savingsTransactions} bills={data.bills} billPayments={data.billPayments} budgets={data.budgets} financialGoals={data.financialGoals} onPayBill={handlePayBill} allCategories={data.allCategories} onBudgetCategoryClick={handleDashboardCategoryClick} onMonthSummaryClick={handleMonthSummaryClick} />;
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

  const NavButton: React.FC<{view: View, label: string, icon: string, onClick: (view: View) => void}> = ({ view, label, icon, onClick }) => (
    <button
      onClick={() => onClick(view)}
      className={`flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 px-4 py-3 rounded-lg transition-colors duration-200 w-full text-left ${
        activeView === view ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'
      }`}
    >
      <i className={`fa-solid ${icon} w-6 text-center`}></i>
      <span className="text-xs sm:text-base font-medium">{label}</span>
    </button>
  );

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-gray-900 text-gray-100">
      <nav className="md:w-64 bg-gray-800 p-4 flex md:flex-col justify-between items-center md:items-stretch md:justify-start gap-4 md:gap-2 border-b-2 md:border-b-0 md:border-r-2 border-gray-700">
        
        <div className="hidden md:flex flex-col w-full h-full">
          <div className="flex flex-col items-center gap-3 mb-4 flex-shrink-0">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                {currentUser?.displayName?.charAt(0).toUpperCase()}
            </div>
            <div className="text-center">
              <h1 className="text-lg font-bold text-white leading-tight">Olá, {currentUser?.displayName}</h1>
              <p className="text-xs text-gray-400">Bem-vindo(a) de volta</p>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {[...mainNavItems, ...moreNavItems].map(item => <NavButton key={item.view} {...item} onClick={handleNavClick} />)}
          </div>
          <div className="mt-auto pt-4 border-t border-gray-700/50">
              <button onClick={logout} className="flex items-center gap-2 px-4 py-3 rounded-lg transition-colors duration-200 w-full text-left text-red-400 hover:bg-gray-700 hover:text-red-300">
                  <i className="fa-solid fa-sign-out-alt w-6 text-center"></i>
                  <span className="text-base font-medium">Sair</span>
              </button>
          </div>
        </div>
        
        <div className="md:hidden flex-grow overflow-x-auto custom-scrollbar">
          <div className="flex flex-nowrap items-center gap-2">
            {mainNavItems.map(item => <NavButton key={item.view} {...item} onClick={handleNavClick} />)}
            <div className="relative" ref={mobileMenuRef}>
              <button onClick={() => setIsMobileMenuOpen(prev => !prev)} className={`flex flex-col sm:flex-row items-center justify-center sm:justify-start gap-2 px-4 py-3 rounded-lg transition-colors duration-200 w-full text-left ${isMobileMenuOpen ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-700 hover:text-white'}`}>
                <i className="fa-solid fa-ellipsis-h w-6 text-center"></i>
                <span className="text-xs sm:text-base font-medium">Mais</span>
              </button>
              {isMobileMenuOpen && (
                <div className="absolute bottom-full mb-2 left-0 sm:left-auto sm:right-0 bg-gray-800 border border-gray-700 rounded-lg shadow-xl py-2 z-20 min-w-[180px]">
                  {moreNavItems.map(item => (
                    <button key={item.view} onClick={() => handleNavClick(item.view)} className={`flex items-center gap-3 px-4 py-2 w-full text-left text-sm ${activeView === item.view ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>
                      <i className={`fa-solid ${item.icon} w-5 text-center`}></i>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="md:hidden flex-shrink-0">
          <button
            onClick={logout}
            className="flex flex-col items-center justify-center h-full w-16 px-2 py-1.5 rounded-lg text-red-400 hover:bg-gray-700 hover:text-red-300 transition-colors"
            aria-label="Sair"
          >
            <i className="fa-solid fa-sign-out-alt text-xl"></i>
            <span className="text-xs mt-1 font-medium">Sair</span>
          </button>
        </div>
      </nav>

      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto custom-scrollbar">
        {renderView()}
      </main>
      
      <button
        onClick={() => { setEditingTransaction(null); setIsModalOpen(true); }}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white rounded-full w-14 h-14 flex items-center justify-center shadow-lg transition-transform transform hover:scale-110"
        aria-label="Adicionar Transação"
      >
        <i className="fa-solid fa-plus text-2xl"></i>
      </button>

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
