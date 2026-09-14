import React, { useMemo } from 'react';
import { FinancialGoal } from '../types';

interface GoalsManagementProps {
    goals: FinancialGoal[];
    onAdd: () => void;
    onEdit: (goal: FinancialGoal) => void;
    onDelete: (goalId: string) => void;
}

const formatCurrency = (value: number) => {
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

const GoalItem: React.FC<{ goal: FinancialGoal, onEdit: (goal: FinancialGoal) => void, onDelete: (goalId: string) => void }> = ({ goal, onEdit, onDelete }) => {
    const progress = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 100;
    const isCompleted = goal.status === 'completed';
    const remaining = Math.max(0, goal.targetAmount - goal.currentAmount);

    return (
        <div className={`bg-gray-800 p-4 rounded-lg space-y-3 transition-opacity ${isCompleted ? 'opacity-70' : ''}`}>
            <div className="flex justify-between items-start">
                <div>
                    <p className="font-bold text-white text-lg">{goal.name}</p>
                    <p className="text-sm text-gray-400">
                        Objetivo: {formatCurrency(goal.targetAmount)}
                        {goal.targetDate && ` • Até ${new Date(goal.targetDate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}`}
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => onEdit(goal)} className="p-1 text-gray-400 hover:text-blue-400" title="Editar Meta"><i className="fa-solid fa-pencil"></i></button>
                    <button onClick={() => onDelete(goal.id)} className="p-1 text-gray-400 hover:text-red-400" title="Excluir Meta"><i className="fa-solid fa-trash"></i></button>
                </div>
            </div>

            <div>
                 <div className="flex justify-between text-xs text-gray-300 mb-1">
                    <span>Alcançado: {formatCurrency(goal.currentAmount)}</span>
                    {!isCompleted && <span>Faltam: {formatCurrency(remaining)}</span>}
                </div>
                <div className="w-full bg-gray-600 rounded-full h-4">
                    <div className={`h-4 rounded-full text-center text-white text-xs font-bold flex items-center justify-center ${isCompleted ? 'bg-green-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }}>
                        {progress > 15 && `${progress.toFixed(0)}%`}
                    </div>
                </div>
            </div>

            {isCompleted && (
                 <div className="flex items-center justify-center gap-2 text-green-400 pt-2">
                    <i className="fa-solid fa-check-circle"></i>
                    <span className="font-semibold text-sm">Meta Concluída!</span>
                </div>
            )}
        </div>
    );
};

const GoalsManagement: React.FC<GoalsManagementProps> = ({ goals, onAdd, onEdit, onDelete }) => {
    const { activeGoals, completedGoals } = useMemo(() => {
        const active = goals.filter(g => g.status === 'active').sort((a,b) => (b.currentAmount/b.targetAmount) - (a.currentAmount/a.targetAmount));
        const completed = goals.filter(g => g.status === 'completed').sort((a,b) => new Date(b.targetDate || 0).getTime() - new Date(a.targetDate || 0).getTime());
        return { activeGoals: active, completedGoals: completed };
    }, [goals]);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <h1 className="text-3xl font-bold text-white">Metas Financeiras</h1>
                <button
                    onClick={onAdd}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors shadow-lg"
                >
                    <i className="fa-solid fa-plus"></i>
                    <span>Adicionar Meta</span>
                </button>
            </div>
            
            {goals.length > 0 ? (
                <div className="space-y-8">
                    {/* Active Goals Section */}
                    {activeGoals.length > 0 && (
                        <section>
                             <h2 className="text-xl font-semibold text-white border-b-2 border-gray-700 pb-2 mb-4 flex items-center gap-3">
                                <i className="fa-solid fa-person-running text-blue-400"></i>
                                <span>Metas Ativas</span>
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {activeGoals.map(goal => <GoalItem key={goal.id} goal={goal} onEdit={onEdit} onDelete={onDelete} />)}
                            </div>
                        </section>
                    )}

                    {/* Completed Goals Section */}
                    {completedGoals.length > 0 && (
                        <section>
                             <h2 className="text-xl font-semibold text-white border-b-2 border-gray-700 pb-2 mb-4 flex items-center gap-3">
                                <i className="fa-solid fa-trophy text-yellow-400"></i>
                                <span>Metas Concluídas</span>
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {completedGoals.map(goal => <GoalItem key={goal.id} goal={goal} onEdit={onEdit} onDelete={onDelete} />)}
                            </div>
                        </section>
                    )}
                </div>
            ) : (
                <div className="text-center py-16 bg-gray-800 rounded-lg">
                    <i className="fa-solid fa-flag-checkered text-5xl text-gray-500 mb-4"></i>
                    <p className="text-gray-400 text-xl">Nenhuma meta financeira criada.</p>
                    <p className="text-gray-500 text-sm">Defina objetivos para motivar sua jornada financeira.</p>
                </div>
            )}
        </div>
    );
};

export default GoalsManagement;