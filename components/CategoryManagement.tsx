import React, { useState, useRef } from 'react';
import { Category } from '../types';
import { useData } from '../contexts/DataContext';

interface CategoryManagementProps {
    customCategories: Category[];
    onAddCategory: () => void;
    onUpdateCategory: (category: Category) => void;
    onDeleteCategory: (categoryId: string) => void;
}

interface BackupPreview {
    fileName: string;
    fileSize: string;
    exportedAt?: string;
    app?: string;
    version?: string;
    counts: {
        transactions: number;
        recurring: number;
        cards: number;
        bills: number;
        budgets: number;
        goals: number;
        savings: number;
        loans: number;
        categories: number;
    };
    rawBackup: any;
}

const CategoryManagement: React.FC<CategoryManagementProps> = ({
    customCategories,
    onAddCategory,
    onUpdateCategory,
    onDeleteCategory,
}) => {
    const {
        transactions,
        recurringTransactions,
        creditCards,
        bills,
        budgets,
        financialGoals,
        savingsTransactions,
        loans,
        exportBackup,
        downloadSqlite,
        restoreBackup,
    } = useData();

    // Feedback state
    const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [isExportingJson, setIsExportingJson] = useState(false);
    const [isExportingSqlite, setIsExportingSqlite] = useState(false);
    const [isRestoring, setIsRestoring] = useState(false);

    // Modal state for restore confirmation
    const [previewModal, setPreviewModal] = useState<BackupPreview | null>(null);

    const fileInputRef = useRef<HTMLInputElement | null>(null);

    // Auto-clear notification
    const showFeedback = (type: 'success' | 'error', text: string) => {
        setStatusMessage({ type, text });
        setTimeout(() => {
            setStatusMessage((current) => (current?.text === text ? null : current));
        }, 6000);
    };

    // 1. Export JSON
    const handleExportJson = async () => {
        try {
            setIsExportingJson(true);
            await exportBackup();
            showFeedback('success', 'Backup JSON gerado e baixado com sucesso!');
        } catch (error: any) {
            console.error('Erro ao exportar backup JSON:', error);
            showFeedback('error', error.message || 'Falha ao gerar backup JSON.');
        } finally {
            setIsExportingJson(false);
        }
    };

    // 2. Export raw SQLite file
    const handleExportSqlite = async () => {
        try {
            setIsExportingSqlite(true);
            await downloadSqlite();
            showFeedback('success', 'Banco de dados SQLite (.sqlite) baixado com sucesso!');
        } catch (error: any) {
            console.error('Erro ao baixar banco SQLite:', error);
            showFeedback('error', error.message || 'Falha ao baixar banco SQLite.');
        } finally {
            setIsExportingSqlite(false);
        }
    };

    // 3. Trigger restore file dialog
    const handleTriggerFileInput = () => {
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
            fileInputRef.current.click();
        }
    };

    // 4. File chosen -> validate & open preview modal
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string;
                const json = JSON.parse(text);

                // Validation
                const data = json.data || json;
                if (!data || (!data.transactions && !data.bills && !data.creditCards)) {
                    throw new Error('O arquivo selecionado não contém um formato de backup válido do FinControl.');
                }

                const counts = {
                    transactions: Array.isArray(data.transactions) ? data.transactions.length : 0,
                    recurring: Array.isArray(data.recurringTransactions) ? data.recurringTransactions.length : 0,
                    cards: Array.isArray(data.creditCards) ? data.creditCards.length : 0,
                    bills: Array.isArray(data.bills) ? data.bills.length : 0,
                    budgets: Array.isArray(data.budgets) ? data.budgets.length : 0,
                    goals: Array.isArray(data.financialGoals) ? data.financialGoals.length : 0,
                    savings: Array.isArray(data.savingsTransactions) ? data.savingsTransactions.length : 0,
                    loans: Array.isArray(data.loans) ? data.loans.length : 0,
                    categories: Array.isArray(data.customCategories) ? data.customCategories.length : 0,
                };

                const fileSizeKb = (file.size / 1024).toFixed(1) + ' KB';

                setPreviewModal({
                    fileName: file.name,
                    fileSize: fileSizeKb,
                    exportedAt: json.exportedAt,
                    app: json.app,
                    version: json.version,
                    counts,
                    rawBackup: json,
                });
            } catch (err: any) {
                console.error('Erro ao analisar arquivo de backup:', err);
                showFeedback('error', err.message || 'Arquivo JSON inválido ou corrompido.');
            }
        };

        reader.readAsText(file);
    };

    // 5. Confirm and execute restore
    const handleConfirmRestore = async () => {
        if (!previewModal) return;

        try {
            setIsRestoring(true);
            const response = await restoreBackup(previewModal.rawBackup);
            const totalRestored =
                (response.stats?.transactions || 0) +
                (response.stats?.bills || 0) +
                (response.stats?.creditCards || 0);

            showFeedback(
                'success',
                `Dados restaurados com sucesso! ${totalRestored} itens principais foram atualizados no banco.`
            );
            setPreviewModal(null);
        } catch (error: any) {
            console.error('Erro ao restaurar backup:', error);
            showFeedback('error', error.message || 'Falha ao restaurar banco de dados.');
        } finally {
            setIsRestoring(false);
        }
    };

    return (
        <div className="space-y-8 pb-12 animate-fadeIn">
            {/* Page Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
                        <i className="fa-solid fa-gear text-blue-400"></i>
                        Ajustes & Banco de Dados
                    </h1>
                    <p className="text-sm text-slate-400 mt-1">
                        Gerencie backups seguros do SQLite local, exportações e categorias personalizadas.
                    </p>
                </div>
            </div>

            {/* Notification Toast */}
            {statusMessage && (
                <div
                    className={`p-4 rounded-xl flex items-center justify-between gap-3 shadow-lg border animate-slideDown ${
                        statusMessage.type === 'success'
                            ? 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300'
                            : 'bg-rose-500/15 border-rose-500/30 text-rose-300'
                    }`}
                >
                    <div className="flex items-center gap-3">
                        <i
                            className={`fa-solid ${
                                statusMessage.type === 'success'
                                    ? 'fa-circle-check text-emerald-400 text-lg'
                                    : 'fa-circle-exclamation text-rose-400 text-lg'
                            }`}
                        ></i>
                        <span className="text-sm font-medium">{statusMessage.text}</span>
                    </div>
                    <button
                        onClick={() => setStatusMessage(null)}
                        className="text-slate-400 hover:text-white transition-colors text-sm px-1.5 py-0.5 rounded"
                    >
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>
            )}

            {/* Section 1: SQLite Database & Backup */}
            <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/60 rounded-2xl p-6 sm:p-7 shadow-xl">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-slate-700/60">
                    <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600/30 to-indigo-600/30 border border-blue-500/30 flex items-center justify-center text-blue-400 text-xl shadow-inner flex-shrink-0">
                            <i className="fa-solid fa-database"></i>
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h2 className="text-lg font-bold text-white">Banco de Dados SQLite Local</h2>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                                    Conectado (WAL Mode)
                                </span>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-400 mt-1 max-w-2xl">
                                Seus registros são armazenados localmente no seu computador com rapidez instantânea e total privacidade.
                                Crie backups frequentes para guardar sua vida financeira com segurança.
                            </p>
                        </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap items-center gap-3">
                        {/* Hidden file input for restore */}
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept=".json,application/json"
                            className="hidden"
                        />

                        {/* Export JSON button */}
                        <button
                            onClick={handleExportJson}
                            disabled={isExportingJson}
                            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-blue-500/25 transition-all duration-200 active:scale-95 disabled:opacity-50"
                            title="Exportar todos os dados em arquivo JSON"
                        >
                            {isExportingJson ? (
                                <>
                                    <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                                    <span>Gerando...</span>
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-download text-xs"></i>
                                    <span>Baixar Backup (.json)</span>
                                </>
                            )}
                        </button>

                        {/* Export raw SQLite button */}
                        <button
                            onClick={handleExportSqlite}
                            disabled={isExportingSqlite}
                            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-xs sm:text-sm border border-slate-600/60 transition-all duration-200 active:scale-95 disabled:opacity-50"
                            title="Baixar cópia direta do arquivo de banco de dados SQLite (.sqlite)"
                        >
                            {isExportingSqlite ? (
                                <>
                                    <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                                    <span>Descarregando...</span>
                                </>
                            ) : (
                                <>
                                    <i className="fa-solid fa-hard-drive text-xs text-blue-400"></i>
                                    <span>Baixar Banco (.sqlite)</span>
                                </>
                            )}
                        </button>

                        {/* Restore button */}
                        <button
                            onClick={handleTriggerFileInput}
                            className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 hover:text-amber-300 font-semibold text-xs sm:text-sm border border-amber-500/30 transition-all duration-200 active:scale-95"
                            title="Restaurar dados a partir de um backup JSON anterior"
                        >
                            <i className="fa-solid fa-clock-rotate-left text-xs"></i>
                            <span>Restaurar Backup</span>
                        </button>
                    </div>
                </div>

                {/* Diagnostics Summary Grid */}
                <div className="mt-6 pt-2">
                    <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                        Diagnóstico de Registros Atuais no SQLite
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-3 text-center">
                            <span className="block text-xl font-bold text-white">{transactions.length}</span>
                            <span className="text-[11px] text-slate-400">Transações</span>
                        </div>
                        <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-3 text-center">
                            <span className="block text-xl font-bold text-blue-400">{creditCards.length}</span>
                            <span className="text-[11px] text-slate-400">Cartões</span>
                        </div>
                        <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-3 text-center">
                            <span className="block text-xl font-bold text-amber-400">{bills.length}</span>
                            <span className="text-[11px] text-slate-400">Contas</span>
                        </div>
                        <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-3 text-center">
                            <span className="block text-xl font-bold text-emerald-400">{budgets.length}</span>
                            <span className="text-[11px] text-slate-400">Orçamentos</span>
                        </div>
                        <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-3 text-center">
                            <span className="block text-xl font-bold text-purple-400">{financialGoals.length}</span>
                            <span className="text-[11px] text-slate-400">Metas</span>
                        </div>
                        <div className="bg-slate-900/60 border border-slate-700/40 rounded-xl p-3 text-center">
                            <span className="block text-xl font-bold text-cyan-400">
                                {savingsTransactions.length + loans.length + recurringTransactions.length}
                            </span>
                            <span className="text-[11px] text-slate-400">Outros</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Section 2: Custom Categories */}
            <div className="bg-slate-800/80 backdrop-blur-xl border border-slate-700/60 rounded-2xl p-6 sm:p-7 shadow-xl">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-slate-700/60">
                    <div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2">
                            <i className="fa-solid fa-tags text-indigo-400"></i>
                            Categorias Personalizadas
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
                            Crie categorias sob medida para organizar suas receitas, despesas e orçamentos.
                        </p>
                    </div>
                    <button
                        onClick={onAddCategory}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl transition-all duration-200 font-semibold text-xs sm:text-sm shadow-lg shadow-blue-500/25 active:scale-95"
                    >
                        <i className="fa-solid fa-plus text-xs"></i>
                        <span>Adicionar Categoria</span>
                    </button>
                </div>

                <div className="mt-6">
                    {customCategories.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
                            {customCategories.map((cat) => (
                                <div
                                    key={cat.id}
                                    className="bg-slate-900/60 border border-slate-700/50 hover:border-slate-600/80 p-3.5 rounded-xl flex items-center justify-between transition-all duration-200 group"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className="w-10 h-10 flex items-center justify-center bg-blue-500/10 border border-blue-500/20 text-blue-400 rounded-xl text-base flex-shrink-0 group-hover:scale-105 transition-transform">
                                            <i className={cat.icon}></i>
                                        </div>
                                        <span className="font-medium text-white text-sm truncate">{cat.name}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 flex-shrink-0">
                                        <button
                                            onClick={() => onUpdateCategory(cat)}
                                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                                            title="Editar categoria"
                                        >
                                            <i className="fa-solid fa-pencil text-xs"></i>
                                        </button>
                                        <button
                                            onClick={() => onDeleteCategory(cat.id)}
                                            className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                            title="Excluir categoria"
                                        >
                                            <i className="fa-solid fa-trash text-xs"></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-12 px-4 rounded-xl border border-dashed border-slate-700/80 bg-slate-900/30">
                            <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500 text-2xl mb-3">
                                <i className="fa-solid fa-tags"></i>
                            </div>
                            <p className="text-slate-300 font-medium text-sm">Nenhuma categoria personalizada criada.</p>
                            <p className="text-slate-500 text-xs mt-1">
                                Clique em "Adicionar Categoria" para personalizar suas classificações financeiras.
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* Confirmation & Preview Modal for Restore */}
            {previewModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-slate-800 border border-slate-700/80 rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-scaleUp">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-slate-700 flex items-center justify-between bg-slate-900/40">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 text-lg">
                                    <i className="fa-solid fa-triangle-exclamation"></i>
                                </div>
                                <div>
                                    <h3 className="font-bold text-white text-base">Confirmar Restauração</h3>
                                    <p className="text-xs text-slate-400">Verifique o conteúdo do arquivo selecionado</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setPreviewModal(null)}
                                disabled={isRestoring}
                                className="text-slate-400 hover:text-white p-1 rounded-lg transition-colors"
                            >
                                <i className="fa-solid fa-xmark text-lg"></i>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            {/* File info card */}
                            <div className="bg-slate-900/70 border border-slate-700/60 rounded-xl p-3.5 space-y-1.5 text-xs text-slate-300">
                                <div className="flex justify-between">
                                    <span className="text-slate-400 font-medium">Arquivo:</span>
                                    <span className="font-mono text-white font-semibold truncate max-w-[240px]">
                                        {previewModal.fileName}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400 font-medium">Tamanho:</span>
                                    <span className="font-semibold">{previewModal.fileSize}</span>
                                </div>
                                {previewModal.exportedAt && (
                                    <div className="flex justify-between">
                                        <span className="text-slate-400 font-medium">Data do Backup:</span>
                                        <span className="font-semibold text-blue-300">
                                            {new Date(previewModal.exportedAt).toLocaleString('pt-BR')}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Warning Banner */}
                            <div className="p-3.5 bg-rose-500/10 border border-rose-500/25 rounded-xl text-xs text-rose-200 leading-relaxed flex items-start gap-2.5">
                                <i className="fa-solid fa-triangle-exclamation text-rose-400 text-sm mt-0.5 flex-shrink-0"></i>
                                <div>
                                    <strong className="font-semibold text-rose-300">Substituição de Registros:</strong>{' '}
                                    Os dados atuais deste usuário serão substituídos pelos registros deste backup. A
                                    operação é executada dentro de uma transação SQLite segura.
                                </div>
                            </div>

                            {/* Records Preview Grid */}
                            <div>
                                <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                                    Conteúdo Identificado no Arquivo:
                                </h4>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-700/40 flex justify-between items-center">
                                        <span className="text-slate-400">Transações</span>
                                        <span className="font-bold text-white">{previewModal.counts.transactions}</span>
                                    </div>
                                    <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-700/40 flex justify-between items-center">
                                        <span className="text-slate-400">Cartões de Crédito</span>
                                        <span className="font-bold text-blue-400">{previewModal.counts.cards}</span>
                                    </div>
                                    <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-700/40 flex justify-between items-center">
                                        <span className="text-slate-400">Contas a Pagar</span>
                                        <span className="font-bold text-amber-400">{previewModal.counts.bills}</span>
                                    </div>
                                    <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-700/40 flex justify-between items-center">
                                        <span className="text-slate-400">Orçamentos</span>
                                        <span className="font-bold text-emerald-400">{previewModal.counts.budgets}</span>
                                    </div>
                                    <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-700/40 flex justify-between items-center">
                                        <span className="text-slate-400">Metas Financeiras</span>
                                        <span className="font-bold text-purple-400">{previewModal.counts.goals}</span>
                                    </div>
                                    <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-700/40 flex justify-between items-center">
                                        <span className="text-slate-400">Poupança & Invest.</span>
                                        <span className="font-bold text-cyan-400">{previewModal.counts.savings}</span>
                                    </div>
                                    <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-700/40 flex justify-between items-center">
                                        <span className="text-slate-400">Empréstimos</span>
                                        <span className="font-bold text-white">{previewModal.counts.loans}</span>
                                    </div>
                                    <div className="bg-slate-900/50 p-2.5 rounded-lg border border-slate-700/40 flex justify-between items-center">
                                        <span className="text-slate-400">Categorias Extras</span>
                                        <span className="font-bold text-indigo-400">{previewModal.counts.categories}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 border-t border-slate-700 bg-slate-900/40 flex justify-end gap-3">
                            <button
                                onClick={() => setPreviewModal(null)}
                                disabled={isRestoring}
                                className="px-4 py-2 rounded-xl text-slate-300 hover:text-white bg-slate-700/50 hover:bg-slate-700 font-medium text-xs sm:text-sm transition-colors disabled:opacity-50"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleConfirmRestore}
                                disabled={isRestoring}
                                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-semibold text-xs sm:text-sm shadow-lg shadow-rose-600/25 transition-all duration-200 active:scale-95 disabled:opacity-50"
                            >
                                {isRestoring ? (
                                    <>
                                        <i className="fa-solid fa-spinner fa-spin text-xs"></i>
                                        <span>Restaurando no SQLite...</span>
                                    </>
                                ) : (
                                    <>
                                        <i className="fa-solid fa-triangle-exclamation text-xs"></i>
                                        <span>Confirmar e Restaurar Dados</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default CategoryManagement;

