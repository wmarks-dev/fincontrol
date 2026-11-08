import React, { useState, useMemo } from 'react';
import { Budget, Transaction, CreditCard, TransactionType, PaymentMethod, Category, CardMonthlyClosing } from '../types';
import { getBillInfoForTransaction, parseISODateAsUTC, getEffectiveDueDate } from '../utils/dateUtils';

interface BudgetManagementProps {
    budgets: Budget[];
    transactions: Transaction[];
    creditCards: CreditCard[];
    allCategories: Category[];
    cardMonthlyClosings?: CardMonthlyClosing[];
    onAdd: (year: number, month: number) => void;
    onEdit: (budget: Budget) => void;
    onDelete: (budgetId: string) => void;
    onCopyBudgets: (budgets: Omit<Budget, 'id'>[]) => void;
    onError: (title: string, message: string) => void;
}

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

interface BudgetItemProps {
    budget: Budget;
    spent: number;
    category?: Category;
    onEdit: (budget: Budget) => void;
    onDelete: (budgetId: string) => void;
}

const BudgetItem: React.FC<BudgetItemProps> = ({ budget, spent, category, onEdit, onDelete }) => {
    const remaining = budget.amount - spent;
    const progress = budget.amount > 0 ? Math.min((spent / budget.amount) * 100, 100) : 0;

    let progressBarColor = 'bg-blue-500';
    if (progress > 90) progressBarColor = 'bg-red-500';
    else if (progress > 75) progressBarColor = 'bg-yellow-500';

    return (
        <div className="bg-gray-800 p-4 rounded-lg space-y-3">
            <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                    <div className="text-xl w-8 h-8 flex items-center justify-center bg-gray-700 rounded-full">
                        {category && <i className={category.icon}></i>}
                    </div>
                    <div>
                        <p className="font-bold text-white">{category?.name}</p>
                        <p className="text-sm text-gray-400">Orçado: {formatCurrency(budget.amount)}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => onEdit(budget)} className="p-1 text-gray-400 hover:text-blue-400" title="Editar Orçamento"><i className="fa-solid fa-pencil"></i></button>
                    <button onClick={() => onDelete(budget.id)} className="p-1 text-gray-400 hover:text-red-400" title="Excluir Orçamento"><i className="fa-solid fa-trash"></i></button>
                </div>
            </div>
            
            <div>
                <div className="w-full bg-gray-600 rounded-full h-2.5">
                    <div className={`${progressBarColor} h-2.5 rounded-full`} style={{ width: `${progress}%` }}></div>
                </div>
                <div className="flex justify-between text-xs mt-1">
                    <span className="text-gray-400">Gasto: {formatCurrency(spent)}</span>
                    <span className={`font-semibold ${remaining >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {remaining >= 0 ? `Restam: ${formatCurrency(remaining)}` : `Excedido: ${formatCurrency(Math.abs(remaining))}`}
                    </span>
                </div>
            </div>
        </div>
    );
};

const BudgetManagement: React.FC<BudgetManagementProps> = ({ budgets, transactions, creditCards, allCategories, cardMonthlyClosings = [], onAdd, onEdit, onDelete, onCopyBudgets, onError }) => {
    const [currentDate, setCurrentDate] = useState(new Date());

    const handlePrevMonth = () => {
        setCurrentDate(d => {
            const newDate = new Date(d);
            newDate.setMonth(d.getMonth() - 1);
            return newDate;
        });
    };
    
    const handleNextMonth = () => {
        setCurrentDate(d => {
            const newDate = new Date(d);
            newDate.setMonth(d.getMonth() + 1);
            return newDate;
        });
    };

    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth();

    const { monthlyBudgetData, totalBudgeted, totalSpent, budgetsFromPreviousMonth } = useMemo(() => {
        const cardsById = new Map<string, CreditCard>(creditCards.map(c => [c.id, c]));

        const activeBudgets = budgets.filter(b => b.year === currentYear && b.month === currentMonth);
        const categorySpending: { [key: string]: number } = {};
        
        transactions.forEach(t => {
            if (t.type !== TransactionType.EXPENSE || t.category === 'transfer') return;

            let effectiveDate: Date;
            const transactionDateAsUTC = parseISODateAsUTC(t.date);

            if ((t.paymentMethod === PaymentMethod.CREDIT_CARD || t.creditCardId) && t.creditCardId) {
                const card = cardsById.get(t.creditCardId);
                if (card && transactionDateAsUTC && !isNaN(transactionDateAsUTC.getTime())) {
                    effectiveDate = getEffectiveDueDate(t, card, cardMonthlyClosings);
                } else {
                    effectiveDate = transactionDateAsUTC;
                }
            } else {
                effectiveDate = transactionDateAsUTC;
            }

            if (effectiveDate.getUTCFullYear() === currentYear && effectiveDate.getUTCMonth() === currentMonth) {
                categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
            }
        });

        const monthlyData = activeBudgets.map(budget => ({
            budget,
            spent: categorySpending[budget.categoryId] || 0,
            category: allCategories.find(c => c.id === budget.categoryId)
        })).sort((a,b) => (b.spent / b.budget.amount) - (a.spent / a.budget.amount));
        
        const totalBudgeted = monthlyData.reduce((acc, item) => acc + item.budget.amount, 0);
        const totalSpent = monthlyData.reduce((acc, item) => acc + item.spent, 0);

        const prevDate = new Date(currentYear, currentMonth, 1);
        prevDate.setMonth(prevDate.getMonth() - 1);
        const previousYear = prevDate.getFullYear();
        const previousMonth = prevDate.getMonth();
        const budgetsFromPreviousMonth = budgets.filter(b => b.year === previousYear && b.month === previousMonth);

        return {
            monthlyBudgetData: monthlyData,
            totalBudgeted,
            totalSpent,
            budgetsFromPreviousMonth
        };
        
    }, [budgets, transactions, creditCards, currentYear, currentMonth, allCategories, cardMonthlyClosings]);
    
    const handleCopyBudgets = () => {
        if (budgetsFromPreviousMonth.length === 0) {
            onError("Nenhum Orçamento", "Não há orçamentos no mês anterior para copiar.");
            return;
        }

        const newBudgets = budgetsFromPreviousMonth.map(b => ({
            categoryId: b.categoryId,
            amount: b.amount,
            year: currentYear,
            month: currentMonth,
        }));

        onCopyBudgets(newBudgets);
    };

    const monthName = currentDate.toLocaleString('pt-BR', { month: 'long', year: 'numeric' });

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-3xl font-bold text-white">Orçamentos</h1>
                <div className="flex items-center gap-2">
                    <button onClick={handlePrevMonth} className="px-3 py-2 bg-gray-700 rounded-md hover:bg-gray-600"><i className="fa-solid fa-chevron-left"></i></button>
                    <span className="font-semibold text-lg w-48 text-center">{monthName.charAt(0).toUpperCase() + monthName.slice(1)}</span>
                    <button onClick={handleNextMonth} className="px-3 py-2 bg-gray-700 rounded-md hover:bg-gray-600"><i className="fa-solid fa-chevron-right"></i></button>
                </div>
                <button
                    onClick={() => onAdd(currentYear, currentMonth)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-lg"
                >
                    <i className="fa-solid fa-plus"></i>
                    <span>Adicionar Orçamento</span>
                </button>
            </div>

            {monthlyBudgetData.length > 0 && (
                <div className="bg-gray-800 p-4 rounded-lg">
                    <h2 className="text-lg font-semibold text-gray-300 mb-2">Resumo do Mês</h2>
                    <div className="flex justify-between items-center text-gray-300">
                        <span>Total Gasto</span>
                        <span>{formatCurrency(totalSpent)} / {formatCurrency(totalBudgeted)}</span>
                    </div>
                    <div className="w-full bg-gray-600 rounded-full h-4 mt-1">
                        <div 
                           className="bg-blue-500 h-4 rounded-full" 
                           style={{ width: `${totalBudgeted > 0 ? Math.min((totalSpent/totalBudgeted)*100, 100) : 0}%` }}
                        ></div>
                    </div>
                </div>
            )}

            {monthlyBudgetData.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {monthlyBudgetData.map(data => (
                        <BudgetItem key={data.budget.id} {...data} onEdit={onEdit} onDelete={onDelete} />
                    ))}
                </div>
            ) : (
                 <div className="text-center py-16 bg-gray-800 rounded-lg">
                    <i className="fa-solid fa-bullseye text-5xl text-gray-500 mb-4"></i>
                    <p className="text-gray-400 text-xl">Nenhum orçamento definido para {monthName.split(' de ')[0]}.</p>
                    <p className="text-gray-500 text-sm">Clique em "Adicionar Orçamento" para criar um.</p>
                    {budgetsFromPreviousMonth.length > 0 && (
                         <button 
                            onClick={handleCopyBudgets}
                            className="mt-4 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors shadow-md"
                        >
                            <i className="fa-solid fa-copy mr-2"></i>
                            Copiar Orçamento do Mês Anterior
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default BudgetManagement;