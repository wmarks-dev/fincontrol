import React, { useState, useMemo, useEffect } from 'react';
import {
  SalaryConfig,
  SalaryMonthlyRecord,
  Transaction,
  TransactionType,
  PaymentMethod,
  TaxTableConfig,
  SalaryItemizedEntry,
  SalaryThirteenthConfig,
  SalaryVacationConfig,
} from '../types';
import {
  calculateSalary,
  calculateThirteenthSalary,
  calculateVacation,
  getTaxTableForYear,
  OFFICIAL_TAX_TABLES,
} from '../utils/salaryCalculator';
import { clampDay, parseISODateAsUTC } from '../utils/dateUtils';

interface SalaryManagementProps {
  salaryConfig: SalaryConfig | null;
  salaryMonthlyRecords: SalaryMonthlyRecord[];
  salaryTaxTables?: TaxTableConfig[];
  salaryItemizedEntries?: SalaryItemizedEntry[];
  salaryThirteenthConfigs?: SalaryThirteenthConfig[];
  salaryVacationConfigs?: SalaryVacationConfig[];
  onUpdateSalaryConfig: (config: Partial<SalaryConfig>) => Promise<void>;
  onSaveSalaryMonthlyRecord: (
    record: Partial<SalaryMonthlyRecord> & { year: number; month: number }
  ) => Promise<void>;
  onSaveTaxTable?: (tableConfig: Partial<TaxTableConfig> & { year: number }) => Promise<void>;
  onResetTaxTable?: (year: number) => Promise<void>;
  onSaveSalaryItem?: (
    item: Partial<SalaryItemizedEntry> & {
      year: number;
      month: number;
      type: 'earning' | 'deduction';
      name: string;
      amount: number;
    }
  ) => Promise<void>;
  onDeleteSalaryItem?: (itemId: string) => Promise<void>;
  onSaveThirteenthConfig?: (config: Partial<SalaryThirteenthConfig> & { year: number }) => Promise<void>;
  onSaveVacationConfig?: (config: Partial<SalaryVacationConfig> & { year: number }) => Promise<void>;
  onDeleteVacationConfig?: (configId: string) => Promise<void>;
  onAddTransaction: (transactions: Omit<Transaction, 'id'>[]) => Promise<void>;
  transactions: Transaction[];
  onError?: (title: string, message: string) => void;
}

const formatCurrency = (val: number) => {
  return Number(val || 0).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
};

const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

export const SalaryManagement: React.FC<SalaryManagementProps> = ({
  salaryConfig,
  salaryMonthlyRecords,
  salaryTaxTables = [],
  salaryItemizedEntries = [],
  salaryThirteenthConfigs = [],
  salaryVacationConfigs = [],
  onUpdateSalaryConfig,
  onSaveSalaryMonthlyRecord,
  onSaveTaxTable,
  onResetTaxTable,
  onSaveSalaryItem,
  onDeleteSalaryItem,
  onSaveThirteenthConfig,
  onSaveVacationConfig,
  onDeleteVacationConfig,
  onAddTransaction,
  transactions,
  onError,
}) => {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getUTCFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getUTCMonth());
  const [activeTab, setActiveTab] = useState<'overview' | 'monthly' | 'history' | 'thirteenth_vacation'>('overview');

  // Config Form State
  const [grossSalaryInput, setGrossSalaryInput] = useState<string>(() =>
    salaryConfig?.grossSalary !== undefined && salaryConfig?.grossSalary !== null
      ? String(salaryConfig.grossSalary)
      : '0'
  );
  const [dependentsInput, setDependentsInput] = useState<string>(() =>
    salaryConfig?.dependents !== undefined && salaryConfig?.dependents !== null
      ? String(salaryConfig.dependents)
      : '0'
  );
  const [otherDeductionsInput, setOtherDeductionsInput] = useState<string>(() =>
    salaryConfig?.otherDeductions !== undefined && salaryConfig?.otherDeductions !== null
      ? String(salaryConfig.otherDeductions)
      : '0'
  );
  const [advancePercentageInput, setAdvancePercentageInput] = useState<string>(() =>
    salaryConfig?.advancePercentage !== undefined && salaryConfig?.advancePercentage !== null
      ? String(salaryConfig.advancePercentage)
      : '40'
  );
  const [advanceDayInput, setAdvanceDayInput] = useState<string>(() =>
    salaryConfig?.advanceDay !== undefined && salaryConfig?.advanceDay !== null
      ? String(salaryConfig.advanceDay)
      : '20'
  );
  const [paydayDayInput, setPaydayDayInput] = useState<string>(() =>
    salaryConfig?.paydayDay !== undefined && salaryConfig?.paydayDay !== null
      ? String(salaryConfig.paydayDay)
      : '5'
  );
  const [useCustomAdvance, setUseCustomAdvance] = useState<boolean>(() =>
    Boolean(salaryConfig?.useCustomAdvance)
  );
  const [customAdvanceAmountInput, setCustomAdvanceAmountInput] = useState<string>(() =>
    salaryConfig?.customAdvanceAmount !== undefined && salaryConfig?.customAdvanceAmount !== null
      ? String(salaryConfig.customAdvanceAmount)
      : '0'
  );
  const [isActive, setIsActive] = useState<boolean>(() =>
    salaryConfig ? salaryConfig.isActive !== false : true
  );
  const [useCustomTaxes, setUseCustomTaxes] = useState<boolean>(() =>
    Boolean(salaryConfig?.useCustomTaxes)
  );
  const [customInssAmountInput, setCustomInssAmountInput] = useState<string>(() =>
    salaryConfig?.customInssAmount !== undefined && salaryConfig?.customInssAmount !== null
      ? String(salaryConfig.customInssAmount)
      : '988.07'
  );
  const [customIrrfAmountInput, setCustomIrrfAmountInput] = useState<string>(() =>
    salaryConfig?.customIrrfAmount !== undefined && salaryConfig?.customIrrfAmount !== null
      ? String(salaryConfig.customIrrfAmount)
      : '3359.60'
  );
  const [taxYearInput, setTaxYearInput] = useState<number>(() =>
    salaryConfig?.taxYear || 2026
  );

  const [isSavingConfig, setIsSavingConfig] = useState<boolean>(false);
  const [configSuccessMsg, setConfigSuccessMsg] = useState<string | null>(null);

  // Tax Table Modal State
  const [isTaxModalOpen, setIsTaxModalOpen] = useState<boolean>(false);
  const [modalTaxYear, setModalTaxYear] = useState<number>(salaryConfig?.taxYear || 2026);
  const [modalTableData, setModalTableData] = useState<TaxTableConfig>(() =>
    getTaxTableForYear(salaryConfig?.taxYear || 2026, salaryTaxTables)
  );
  const [isSavingTaxTable, setIsSavingTaxTable] = useState<boolean>(false);
  const [taxSuccessMsg, setTaxSuccessMsg] = useState<string | null>(null);

  // Recurring Items Form State (for Tab 1 - Parâmetros)
  const [newRecName, setNewRecName] = useState<string>('');
  const [newRecAmount, setNewRecAmount] = useState<string>('');
  const [newRecType, setNewRecType] = useState<'earning' | 'deduction'>('deduction');
  const [isSavingRecItem, setIsSavingRecItem] = useState<boolean>(false);

  // Monthly Items Form State (for Tab 2 - Mês Selecionado)
  const [newMonthName, setNewMonthName] = useState<string>('');
  const [newMonthAmount, setNewMonthAmount] = useState<string>('');
  const [newMonthType, setNewMonthType] = useState<'earning' | 'deduction'>('earning');
  const [isSavingMonthItem, setIsSavingMonthItem] = useState<boolean>(false);

  // 13º Salário State for selectedYear
  const currentThirteenthConfig = useMemo(() => {
    return salaryThirteenthConfigs.find((c) => c.year === selectedYear) || null;
  }, [salaryThirteenthConfigs, selectedYear]);

  const [thirteenthMonthsWorked, setThirteenthMonthsWorked] = useState<string>('12');
  const [thirteenthFirstMonth, setThirteenthFirstMonth] = useState<number>(10);
  const [thirteenthFirstPercent, setThirteenthFirstPercent] = useState<string>('50');
  const [thirteenthFirstPayDay, setThirteenthFirstPayDay] = useState<string>('30');
  const [thirteenthSecondPayDay, setThirteenthSecondPayDay] = useState<string>('20');
  const [thirteenthFirstReal, setThirteenthFirstReal] = useState<string>('');
  const [thirteenthSecondReal, setThirteenthSecondReal] = useState<string>('');
  const [thirteenthFirstDate, setThirteenthFirstDate] = useState<string>('');
  const [thirteenthSecondDate, setThirteenthSecondDate] = useState<string>('');
  const [thirteenthNotes, setThirteenthNotes] = useState<string>('');
  const [isSavingThirteenth, setIsSavingThirteenth] = useState<boolean>(false);
  const [thirteenthSuccessMsg, setThirteenthSuccessMsg] = useState<string | null>(null);

  // Sync 13º form state when currentThirteenthConfig or selectedYear changes
  useEffect(() => {
    if (currentThirteenthConfig) {
      setThirteenthMonthsWorked(String(currentThirteenthConfig.monthsWorked ?? 12));
      setThirteenthFirstMonth(currentThirteenthConfig.firstInstallmentMonth ?? 10);
      setThirteenthFirstPercent(String(currentThirteenthConfig.firstInstallmentPercentage ?? 50));
      setThirteenthFirstPayDay(String(currentThirteenthConfig.firstInstallmentPayDay ?? 30));
      setThirteenthSecondPayDay(String(currentThirteenthConfig.secondInstallmentPayDay ?? 20));
      setThirteenthFirstReal(
        currentThirteenthConfig.firstInstallmentReal !== null && currentThirteenthConfig.firstInstallmentReal !== undefined
          ? String(currentThirteenthConfig.firstInstallmentReal)
          : ''
      );
      setThirteenthSecondReal(
        currentThirteenthConfig.secondInstallmentReal !== null && currentThirteenthConfig.secondInstallmentReal !== undefined
          ? String(currentThirteenthConfig.secondInstallmentReal)
          : ''
      );
      setThirteenthFirstDate(currentThirteenthConfig.firstInstallmentDate || '');
      setThirteenthSecondDate(currentThirteenthConfig.secondInstallmentDate || '');
      setThirteenthNotes(currentThirteenthConfig.notes || '');
    } else {
      setThirteenthMonthsWorked('12');
      setThirteenthFirstMonth(10);
      setThirteenthFirstPercent('50');
      setThirteenthFirstPayDay('30');
      setThirteenthSecondPayDay('20');
      setThirteenthFirstReal('');
      setThirteenthSecondReal('');
      setThirteenthFirstDate('');
      setThirteenthSecondDate('');
      setThirteenthNotes('');
    }
  }, [currentThirteenthConfig, selectedYear]);

  // Vacation Form / Modal State for selectedYear
  const currentYearVacations = useMemo(() => {
    return salaryVacationConfigs.filter((v) => v.year === selectedYear);
  }, [salaryVacationConfigs, selectedYear]);

  const [isVacationModalOpen, setIsVacationModalOpen] = useState<boolean>(false);
  const [editingVacation, setEditingVacation] = useState<SalaryVacationConfig | null>(null);
  const [vacDaysInput, setVacDaysInput] = useState<string>('30');
  const [vacSellDaysInput, setVacSellDaysInput] = useState<string>('0');
  const [vacStartDateInput, setVacStartDateInput] = useState<string>('');
  const [vacAdvanceThirteenth, setVacAdvanceThirteenth] = useState<boolean>(false);
  const [vacRealAmountInput, setVacRealAmountInput] = useState<string>('');
  const [vacPaymentDateInput, setVacPaymentDateInput] = useState<string>('');
  const [vacNotesInput, setVacNotesInput] = useState<string>('');
  const [isSavingVacation, setIsSavingVacation] = useState<boolean>(false);
  const [vacationSuccessMsg, setVacationSuccessMsg] = useState<string | null>(null);

  // Expanded Rows for History Accordion
  const [expandedHistoryMonths, setExpandedHistoryMonths] = useState<Set<number>>(new Set());

  // Sync state with incoming salaryConfig
  useEffect(() => {
    if (salaryConfig) {
      setGrossSalaryInput(String(salaryConfig.grossSalary || 0));
      setDependentsInput(String(salaryConfig.dependents || 0));
      setOtherDeductionsInput(String(salaryConfig.otherDeductions || 0));
      setAdvancePercentageInput(String(salaryConfig.advancePercentage || 40));
      setAdvanceDayInput(String(salaryConfig.advanceDay || 20));
      setPaydayDayInput(String(salaryConfig.paydayDay || 5));
      setUseCustomAdvance(Boolean(salaryConfig.useCustomAdvance));
      setCustomAdvanceAmountInput(String(salaryConfig.customAdvanceAmount || 0));
      setIsActive(salaryConfig.isActive !== false);
      setUseCustomTaxes(Boolean(salaryConfig.useCustomTaxes));
      setCustomInssAmountInput(
        salaryConfig.customInssAmount !== undefined && salaryConfig.customInssAmount !== null
          ? String(salaryConfig.customInssAmount)
          : '988.07'
      );
      setCustomIrrfAmountInput(
        salaryConfig.customIrrfAmount !== undefined && salaryConfig.customIrrfAmount !== null
          ? String(salaryConfig.customIrrfAmount)
          : '3359.60'
      );
      if (salaryConfig.taxYear) {
        setTaxYearInput(salaryConfig.taxYear);
        setModalTaxYear(salaryConfig.taxYear);
      }
    }
  }, [salaryConfig]);

  // Active Tax Table for Contract
  const activeTaxTable = useMemo(() => {
    return getTaxTableForYear(taxYearInput || 2026, salaryTaxTables);
  }, [taxYearInput, salaryTaxTables]);

  // Sync Modal Table Data when modal year changes or tax tables update
  useEffect(() => {
    setModalTableData(getTaxTableForYear(modalTaxYear, salaryTaxTables));
  }, [modalTaxYear, salaryTaxTables]);

  // Recurring Items (month === -1 or isRecurring === true)
  const recurringItems = useMemo(() => {
    return salaryItemizedEntries.filter((item) => item.month === -1 || item.isRecurring);
  }, [salaryItemizedEntries]);

  // Items for the selected month (both recurring and month-specific)
  const monthItems = useMemo(() => {
    return salaryItemizedEntries.filter(
      (item) =>
        (item.year === selectedYear && item.month === selectedMonth) ||
        (item.month === -1 && item.isRecurring)
    );
  }, [salaryItemizedEntries, selectedYear, selectedMonth]);

  // Current Working Config for live calculation preview
  const liveConfig: SalaryConfig = useMemo(() => {
    const rawGross =
      parseFloat(grossSalaryInput.replace(',', '.')) ||
      (salaryConfig?.grossSalary ? Number(salaryConfig.grossSalary) : 0);
    return {
      grossSalary: rawGross,
      dependents: parseInt(dependentsInput, 10) || 0,
      otherDeductions: parseFloat(otherDeductionsInput.replace(',', '.')) || 0,
      advancePercentage: parseFloat(advancePercentageInput.replace(',', '.')) || 40,
      advanceDay: parseInt(advanceDayInput, 10) || 20,
      paydayDay: parseInt(paydayDayInput, 10) || 5,
      useCustomAdvance,
      customAdvanceAmount: parseFloat(customAdvanceAmountInput.replace(',', '.')) || 0,
      isActive,
      useCustomTaxes,
      customInssAmount: parseFloat(customInssAmountInput.replace(',', '.')) || 0,
      customIrrfAmount: parseFloat(customIrrfAmountInput.replace(',', '.')) || 0,
      taxYear: taxYearInput,
    };
  }, [
    grossSalaryInput,
    salaryConfig?.grossSalary,
    dependentsInput,
    otherDeductionsInput,
    advancePercentageInput,
    advanceDayInput,
    paydayDayInput,
    useCustomAdvance,
    customAdvanceAmountInput,
    isActive,
    useCustomTaxes,
    customInssAmountInput,
    customIrrfAmountInput,
    taxYearInput,
  ]);

  // Live calculation output (Base contract + recurring items)
  const calculation = useMemo(() => {
    return calculateSalary(liveConfig, activeTaxTable, recurringItems);
  }, [liveConfig, activeTaxTable, recurringItems]);

  // Calculation for the currently selected month (Base contract + month items)
  const monthCalculation = useMemo(() => {
    return calculateSalary(liveConfig, activeTaxTable, monthItems);
  }, [liveConfig, activeTaxTable, monthItems]);

  // Monthly Record for Selected Month
  const currentMonthRecord = useMemo(() => {
    return (
      salaryMonthlyRecords.find(
        (r) => r.year === selectedYear && r.month === selectedMonth
      ) || null
    );
  }, [salaryMonthlyRecords, selectedYear, selectedMonth]);

  // Realized Inputs for Selected Month
  const [realAdvanceInput, setRealAdvanceInput] = useState<string>('');
  const [realPaydayInput, setRealPaydayInput] = useState<string>('');
  const [advanceDateInput, setAdvanceDateInput] = useState<string>('');
  const [paydayDateInput, setPaydayDateInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');
  const [isSavingMonth, setIsSavingMonth] = useState<boolean>(false);
  const [monthSuccessMsg, setMonthSuccessMsg] = useState<string | null>(null);

  // Sync monthly inputs whenever selected month/year changes or currentMonthRecord updates
  useEffect(() => {
    const advDefaultDay = clampDay(selectedYear, selectedMonth, liveConfig.advanceDay || 20);
    const payDefaultDay = clampDay(selectedYear, selectedMonth, liveConfig.paydayDay || 5);

    const defaultAdvDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(
      advDefaultDay
    ).padStart(2, '0')}`;
    const defaultPayDate = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(
      payDefaultDay
    ).padStart(2, '0')}`;

    if (currentMonthRecord) {
      setRealAdvanceInput(
        currentMonthRecord.realAdvance !== null && currentMonthRecord.realAdvance !== undefined
          ? String(currentMonthRecord.realAdvance)
          : ''
      );
      setRealPaydayInput(
        currentMonthRecord.realPayday !== null && currentMonthRecord.realPayday !== undefined
          ? String(currentMonthRecord.realPayday)
          : ''
      );
      setAdvanceDateInput(currentMonthRecord.advanceDate || defaultAdvDate);
      setPaydayDateInput(currentMonthRecord.paydayDate || defaultPayDate);
      setNotesInput(currentMonthRecord.notes || '');
    } else {
      setRealAdvanceInput('');
      setRealPaydayInput('');
      setAdvanceDateInput(defaultAdvDate);
      setPaydayDateInput(defaultPayDate);
      setNotesInput('');
    }
    setMonthSuccessMsg(null);
  }, [currentMonthRecord, selectedYear, selectedMonth, liveConfig.advanceDay, liveConfig.paydayDay]);

  // Save Config handler
  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingConfig(true);
    setConfigSuccessMsg(null);
    try {
      await onUpdateSalaryConfig(liveConfig);
      setConfigSuccessMsg('Configuração do salário salva com sucesso!');
      setTimeout(() => setConfigSuccessMsg(null), 4000);
    } catch (err: any) {
      if (onError) {
        onError('Erro ao salvar salário', err.message || 'Não foi possível salvar as configurações.');
      }
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Save Monthly Record handler
  const handleSaveMonthRecord = async () => {
    setIsSavingMonth(true);
    setMonthSuccessMsg(null);
    try {
      const parsedAdv = realAdvanceInput.trim() !== '' ? parseFloat(realAdvanceInput.replace(',', '.')) : null;
      const parsedPay = realPaydayInput.trim() !== '' ? parseFloat(realPaydayInput.replace(',', '.')) : null;

      await onSaveSalaryMonthlyRecord({
        year: selectedYear,
        month: selectedMonth,
        projectedAdvance: monthCalculation.advanceAmount,
        projectedPayday: monthCalculation.paydayAmount,
        realAdvance: parsedAdv,
        realPayday: parsedPay,
        advanceDate: advanceDateInput || null,
        paydayDate: paydayDateInput || null,
        notes: notesInput.trim(),
        advanceTransactionId: currentMonthRecord?.advanceTransactionId || null,
        paydayTransactionId: currentMonthRecord?.paydayTransactionId || null,
      });

      setMonthSuccessMsg('Valores reais do mês salvos com sucesso!');
      setTimeout(() => setMonthSuccessMsg(null), 4000);
    } catch (err: any) {
      if (onError) {
        onError('Erro ao salvar registro mensal', err.message || 'Falha ao gravar os valores.');
      }
    } finally {
      setIsSavingMonth(false);
    }
  };

  // Check if transactions are already registered in general transactions list
  const linkedAdvanceTx = useMemo(() => {
    if (!currentMonthRecord?.advanceTransactionId) return null;
    return transactions.find((t) => t.id === currentMonthRecord.advanceTransactionId) || null;
  }, [currentMonthRecord, transactions]);

  const linkedPaydayTx = useMemo(() => {
    if (!currentMonthRecord?.paydayTransactionId) return null;
    return transactions.find((t) => t.id === currentMonthRecord.paydayTransactionId) || null;
  }, [currentMonthRecord, transactions]);

  // Push Advance to Transactions Extrato
  const handlePushAdvanceToExtrato = async () => {
    const amount =
      realAdvanceInput.trim() !== ''
        ? parseFloat(realAdvanceInput.replace(',', '.'))
        : monthCalculation.advanceAmount;

    if (!amount || amount <= 0) {
      if (onError) onError('Atenção', 'Informe um valor válido de adiantamento.');
      return;
    }

    const monthName = MONTH_NAMES[selectedMonth];
    const dateToUse = advanceDateInput || `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-20`;

    try {
      const tempId = `tx_sal_adv_${selectedYear}_${selectedMonth}_${Date.now()}`;
      await onAddTransaction([
        {
          description: `Salário - Adiantamento/Vale (${monthName}/${selectedYear})`,
          amount,
          date: dateToUse,
          type: TransactionType.INCOME,
          category: 'Salário',
          paymentMethod: PaymentMethod.CASH,
          isPaid: true,
          tags: ['salário', 'vale', 'holerite'],
        },
      ]);

      await onSaveSalaryMonthlyRecord({
        year: selectedYear,
        month: selectedMonth,
        projectedAdvance: monthCalculation.advanceAmount,
        projectedPayday: monthCalculation.paydayAmount,
        realAdvance: amount,
        advanceDate: dateToUse,
        advanceTransactionId: tempId,
      });

      setMonthSuccessMsg('Adiantamento (Vale) lançado com sucesso no extrato de transações!');
      setTimeout(() => setMonthSuccessMsg(null), 4000);
    } catch (err: any) {
      if (onError) onError('Erro ao lançar no extrato', err.message);
    }
  };

  // Push Payday to Transactions Extrato
  const handlePushPaydayToExtrato = async () => {
    const amount =
      realPaydayInput.trim() !== ''
        ? parseFloat(realPaydayInput.replace(',', '.'))
        : monthCalculation.paydayAmount;

    if (!amount || amount <= 0) {
      if (onError) onError('Atenção', 'Informe um valor válido de pagamento.');
      return;
    }

    const monthName = MONTH_NAMES[selectedMonth];
    const dateToUse = paydayDateInput || `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-05`;

    try {
      const tempId = `tx_sal_pay_${selectedYear}_${selectedMonth}_${Date.now()}`;
      await onAddTransaction([
        {
          description: `Salário - Pagamento Final Líquido (${monthName}/${selectedYear})`,
          amount,
          date: dateToUse,
          type: TransactionType.INCOME,
          category: 'Salário',
          paymentMethod: PaymentMethod.CASH,
          isPaid: true,
          tags: ['salário', 'pagamento', 'holerite'],
        },
      ]);

      await onSaveSalaryMonthlyRecord({
        year: selectedYear,
        month: selectedMonth,
        projectedAdvance: monthCalculation.advanceAmount,
        projectedPayday: monthCalculation.paydayAmount,
        realPayday: amount,
        paydayDate: dateToUse,
        paydayTransactionId: tempId,
      });

      setMonthSuccessMsg('Pagamento salarial lançado com sucesso no extrato de transações!');
      setTimeout(() => setMonthSuccessMsg(null), 4000);
    } catch (err: any) {
      if (onError) onError('Erro ao lançar no extrato', err.message);
    }
  };

  // 13º Live calculation
  const thirteenthCalculation = useMemo(() => {
    const dummyConf: SalaryThirteenthConfig = {
      id: currentThirteenthConfig?.id || '',
      year: selectedYear,
      monthsWorked: parseInt(thirteenthMonthsWorked, 10) || 12,
      firstInstallmentMonth: thirteenthFirstMonth,
      firstInstallmentPercentage: parseFloat(thirteenthFirstPercent) || 50,
      firstInstallmentPayDay: parseInt(thirteenthFirstPayDay, 10) || 30,
      secondInstallmentPayDay: parseInt(thirteenthSecondPayDay, 10) || 20,
      firstInstallmentReal: thirteenthFirstReal.trim() ? parseFloat(thirteenthFirstReal.replace(',', '.')) : null,
      secondInstallmentReal: thirteenthSecondReal.trim() ? parseFloat(thirteenthSecondReal.replace(',', '.')) : null,
      firstInstallmentDate: thirteenthFirstDate || null,
      secondInstallmentDate: thirteenthSecondDate || null,
      firstInstallmentTransactionId: currentThirteenthConfig?.firstInstallmentTransactionId || null,
      secondInstallmentTransactionId: currentThirteenthConfig?.secondInstallmentTransactionId || null,
      notes: thirteenthNotes,
    };
    return calculateThirteenthSalary(dummyConf, liveConfig, activeTaxTable, recurringItems);
  }, [
    currentThirteenthConfig,
    selectedYear,
    thirteenthMonthsWorked,
    thirteenthFirstMonth,
    thirteenthFirstPercent,
    thirteenthFirstPayDay,
    thirteenthSecondPayDay,
    thirteenthFirstReal,
    thirteenthSecondReal,
    thirteenthFirstDate,
    thirteenthSecondDate,
    thirteenthNotes,
    liveConfig,
    activeTaxTable,
    recurringItems,
  ]);

  // Vacation preview calculation in modal
  const vacationPreviewCalculation = useMemo(() => {
    const dummyVac: SalaryVacationConfig = {
      id: editingVacation?.id || 'preview',
      year: selectedYear,
      vacationDays: parseInt(vacDaysInput, 10) || 30,
      sellDays: parseInt(vacSellDaysInput, 10) || 0,
      startDate: vacStartDateInput,
      advanceThirteenth: vacAdvanceThirteenth,
      realAmount: vacRealAmountInput.trim() ? parseFloat(vacRealAmountInput.replace(',', '.')) : null,
      notes: vacNotesInput,
    };
    return calculateVacation(dummyVac, liveConfig, activeTaxTable, recurringItems);
  }, [
    editingVacation,
    selectedYear,
    vacDaysInput,
    vacSellDaysInput,
    vacStartDateInput,
    vacAdvanceThirteenth,
    vacRealAmountInput,
    vacNotesInput,
    liveConfig,
    activeTaxTable,
    recurringItems,
  ]);

  // Save 13º Config Handler
  const handleSaveThirteenthConfig = async () => {
    if (!onSaveThirteenthConfig) return;
    setIsSavingThirteenth(true);
    setThirteenthSuccessMsg(null);
    try {
      await onSaveThirteenthConfig({
        id: currentThirteenthConfig?.id,
        year: selectedYear,
        monthsWorked: parseInt(thirteenthMonthsWorked, 10) || 12,
        firstInstallmentMonth: thirteenthFirstMonth,
        firstInstallmentPercentage: parseFloat(thirteenthFirstPercent) || 50,
        firstInstallmentPayDay: parseInt(thirteenthFirstPayDay, 10) || 30,
        secondInstallmentPayDay: parseInt(thirteenthSecondPayDay, 10) || 20,
        firstInstallmentReal: thirteenthFirstReal.trim() !== '' ? parseFloat(thirteenthFirstReal.replace(',', '.')) : null,
        secondInstallmentReal: thirteenthSecondReal.trim() !== '' ? parseFloat(thirteenthSecondReal.replace(',', '.')) : null,
        firstInstallmentDate: thirteenthFirstDate || null,
        secondInstallmentDate: thirteenthSecondDate || null,
        notes: thirteenthNotes.trim(),
        firstInstallmentTransactionId: currentThirteenthConfig?.firstInstallmentTransactionId || null,
        secondInstallmentTransactionId: currentThirteenthConfig?.secondInstallmentTransactionId || null,
      });
      setThirteenthSuccessMsg('Parâmetros do 13º Salário salvos com sucesso!');
      setTimeout(() => setThirteenthSuccessMsg(null), 4000);
    } catch (err: any) {
      if (onError) onError('Erro ao salvar 13º', err.message);
    } finally {
      setIsSavingThirteenth(false);
    }
  };

  // Push 13º 1ª Parcela to Extrato
  const handlePushThirteenth1stToExtrato = async () => {
    if (!onSaveThirteenthConfig) return;
    const amount =
      thirteenthFirstReal.trim() !== ''
        ? parseFloat(thirteenthFirstReal.replace(',', '.'))
        : thirteenthCalculation.firstInstallmentNet;

    if (!amount || amount <= 0) {
      if (onError) onError('Atenção', 'Informe um valor válido para a 1ª parcela do 13º.');
      return;
    }

    const mName = MONTH_NAMES[thirteenthFirstMonth];
    const defaultDate = `${selectedYear}-${String(thirteenthFirstMonth + 1).padStart(2, '0')}-${String(thirteenthFirstPayDay || 30).padStart(2, '0')}`;
    const dateToUse = thirteenthFirstDate || defaultDate;

    try {
      const tempId = `tx_13th_1st_${selectedYear}_${Date.now()}`;
      await onAddTransaction([
        {
          description: `13º Salário - 1ª Parcela (${mName}/${selectedYear})`,
          amount,
          date: dateToUse,
          type: TransactionType.INCOME,
          category: 'Salário',
          paymentMethod: PaymentMethod.CASH,
          isPaid: true,
          tags: ['salário', '13º salário', '1ª parcela', 'holerite'],
        },
      ]);

      await onSaveThirteenthConfig({
        id: currentThirteenthConfig?.id,
        year: selectedYear,
        monthsWorked: parseInt(thirteenthMonthsWorked, 10) || 12,
        firstInstallmentMonth: thirteenthFirstMonth,
        firstInstallmentPercentage: parseFloat(thirteenthFirstPercent) || 50,
        firstInstallmentPayDay: parseInt(thirteenthFirstPayDay, 10) || 30,
        secondInstallmentPayDay: parseInt(thirteenthSecondPayDay, 10) || 20,
        firstInstallmentReal: amount,
        firstInstallmentDate: dateToUse,
        firstInstallmentTransactionId: tempId,
      });

      setThirteenthSuccessMsg('1ª Parcela do 13º lançada com sucesso no extrato!');
      setTimeout(() => setThirteenthSuccessMsg(null), 4000);
    } catch (err: any) {
      if (onError) onError('Erro ao lançar 13º no extrato', err.message);
    }
  };

  // Push 13º 2ª Parcela to Extrato
  const handlePushThirteenth2ndToExtrato = async () => {
    if (!onSaveThirteenthConfig) return;
    const amount =
      thirteenthSecondReal.trim() !== ''
        ? parseFloat(thirteenthSecondReal.replace(',', '.'))
        : thirteenthCalculation.secondInstallmentNet;

    if (!amount || amount <= 0) {
      if (onError) onError('Atenção', 'Informe um valor válido para a 2ª parcela do 13º.');
      return;
    }

    const defaultDate = `${selectedYear}-12-${String(thirteenthSecondPayDay || 20).padStart(2, '0')}`;
    const dateToUse = thirteenthSecondDate || defaultDate;

    try {
      const tempId = `tx_13th_2nd_${selectedYear}_${Date.now()}`;
      await onAddTransaction([
        {
          description: `13º Salário - 2ª Parcela Final (Dezembro/${selectedYear})`,
          amount,
          date: dateToUse,
          type: TransactionType.INCOME,
          category: 'Salário',
          paymentMethod: PaymentMethod.CASH,
          isPaid: true,
          tags: ['salário', '13º salário', '2ª parcela', 'holerite'],
        },
      ]);

      await onSaveThirteenthConfig({
        id: currentThirteenthConfig?.id,
        year: selectedYear,
        monthsWorked: parseInt(thirteenthMonthsWorked, 10) || 12,
        firstInstallmentMonth: thirteenthFirstMonth,
        firstInstallmentPercentage: parseFloat(thirteenthFirstPercent) || 50,
        firstInstallmentPayDay: parseInt(thirteenthFirstPayDay, 10) || 30,
        secondInstallmentPayDay: parseInt(thirteenthSecondPayDay, 10) || 20,
        secondInstallmentReal: amount,
        secondInstallmentDate: dateToUse,
        secondInstallmentTransactionId: tempId,
      });

      setThirteenthSuccessMsg('2ª Parcela do 13º lançada com sucesso no extrato!');
      setTimeout(() => setThirteenthSuccessMsg(null), 4000);
    } catch (err: any) {
      if (onError) onError('Erro ao lançar 13º no extrato', err.message);
    }
  };

  // Vacation Handlers
  const handleOpenNewVacation = () => {
    setEditingVacation(null);
    setVacDaysInput('30');
    setVacSellDaysInput('0');
    const defaultStart = `${selectedYear}-07-01`;
    setVacStartDateInput(defaultStart);
    setVacAdvanceThirteenth(false);
    setVacRealAmountInput('');
    setVacPaymentDateInput('');
    setVacNotesInput('');
    setIsVacationModalOpen(true);
  };

  const handleEditVacation = (vac: SalaryVacationConfig) => {
    setEditingVacation(vac);
    setVacDaysInput(String(vac.vacationDays || 30));
    setVacSellDaysInput(String(vac.sellDays || 0));
    setVacStartDateInput(vac.startDate || '');
    setVacAdvanceThirteenth(Boolean(vac.advanceThirteenth));
    setVacRealAmountInput(vac.realAmount !== null && vac.realAmount !== undefined ? String(vac.realAmount) : '');
    setVacPaymentDateInput(vac.paymentDate || '');
    setVacNotesInput(vac.notes || '');
    setIsVacationModalOpen(true);
  };

  const handleSaveVacation = async () => {
    if (!onSaveVacationConfig) return;
    setIsSavingVacation(true);
    try {
      const vDays = parseInt(vacDaysInput, 10) || 30;
      const sDays = parseInt(vacSellDaysInput, 10) || 0;
      const parsedReal = vacRealAmountInput.trim() !== '' ? parseFloat(vacRealAmountInput.replace(',', '.')) : null;

      await onSaveVacationConfig({
        id: editingVacation?.id,
        year: selectedYear,
        vacationDays: vDays,
        sellDays: sDays,
        startDate: vacStartDateInput || '',
        advanceThirteenth: vacAdvanceThirteenth,
        realAmount: parsedReal,
        paymentDate: vacPaymentDateInput || null,
        notes: vacNotesInput.trim(),
        transactionId: editingVacation?.transactionId || null,
      });

      setIsVacationModalOpen(false);
      setVacationSuccessMsg('Programação de férias salva com sucesso!');
      setTimeout(() => setVacationSuccessMsg(null), 4000);
    } catch (err: any) {
      if (onError) onError('Erro ao salvar férias', err.message);
    } finally {
      setIsSavingVacation(false);
    }
  };

  const handleDeleteVacation = async (id: string) => {
    if (!onDeleteVacationConfig) return;
    try {
      await onDeleteVacationConfig(id);
      setVacationSuccessMsg('Férias removidas com sucesso!');
      setTimeout(() => setVacationSuccessMsg(null), 3000);
    } catch (err: any) {
      if (onError) onError('Erro ao excluir férias', err.message);
    }
  };

  const handlePushVacationToExtrato = async (vac: SalaryVacationConfig) => {
    if (!onSaveVacationConfig) return;
    const vCalc = calculateVacation(vac, liveConfig, activeTaxTable, recurringItems);
    const amount =
      vac.realAmount !== null && vac.realAmount !== undefined
        ? vac.realAmount
        : vCalc.totalVacationNet;

    if (!amount || amount <= 0) {
      if (onError) onError('Atenção', 'Informe um valor válido de férias.');
      return;
    }

    let defaultDate = `${selectedYear}-01-01`;
    if (vac.paymentDate) {
      defaultDate = vac.paymentDate;
    } else if (vac.startDate) {
      const sDate = parseISODateAsUTC(vac.startDate);
      if (!isNaN(sDate.getTime())) {
        sDate.setUTCDate(sDate.getUTCDate() - 2);
        defaultDate = sDate.toISOString().split('T')[0];
      }
    }

    try {
      const tempId = `tx_vacation_${vac.id}_${Date.now()}`;
      await onAddTransaction([
        {
          description: `Férias (${vac.vacationDays}d + 1/3 Const.) - Início em ${vac.startDate || 'programada'}`,
          amount,
          date: defaultDate,
          type: TransactionType.INCOME,
          category: 'Salário',
          paymentMethod: PaymentMethod.CASH,
          isPaid: true,
          tags: ['salário', 'férias', 'holerite'],
        },
      ]);

      await onSaveVacationConfig({
        ...vac,
        realAmount: amount,
        paymentDate: defaultDate,
        transactionId: tempId,
      });

      setVacationSuccessMsg('Férias lançadas com sucesso no extrato de transações!');
      setTimeout(() => setVacationSuccessMsg(null), 4000);
    } catch (err: any) {
      if (onError) onError('Erro ao lançar férias no extrato', err.message);
    }
  };

  // Toggle History Month Accordion
  const handleToggleExpandMonth = (mIdx: number) => {
    setExpandedHistoryMonths((prev) => {
      const next = new Set(prev);
      if (next.has(mIdx)) next.delete(mIdx);
      else next.add(mIdx);
      return next;
    });
  };

  // Add Recurring Item (Contrato)
  const handleAddRecurringItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecName.trim()) return;
    const amt = parseFloat(newRecAmount.replace(',', '.'));
    if (isNaN(amt) || amt <= 0) return;

    if (onSaveSalaryItem) {
      setIsSavingRecItem(true);
      try {
        await onSaveSalaryItem({
          year: 0,
          month: -1,
          type: newRecType,
          name: newRecName.trim(),
          amount: amt,
          isRecurring: true,
        });
        setNewRecName('');
        setNewRecAmount('');
      } catch (err: any) {
        if (onError) onError('Erro ao adicionar item recorrente', err.message);
      } finally {
        setIsSavingRecItem(false);
      }
    }
  };

  // Add Month Item (Pontual)
  const handleAddMonthItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMonthName.trim()) return;
    const amt = parseFloat(newMonthAmount.replace(',', '.'));
    if (isNaN(amt) || amt <= 0) return;

    if (onSaveSalaryItem) {
      setIsSavingMonthItem(true);
      try {
        await onSaveSalaryItem({
          year: selectedYear,
          month: selectedMonth,
          type: newMonthType,
          name: newMonthName.trim(),
          amount: amt,
          isRecurring: false,
        });
        setNewMonthName('');
        setNewMonthAmount('');
      } catch (err: any) {
        if (onError) onError('Erro ao adicionar item no mês', err.message);
      } finally {
        setIsSavingMonthItem(false);
      }
    }
  };

  // Delete Salary Item
  const handleDeleteItem = async (itemId: string) => {
    if (onDeleteSalaryItem) {
      try {
        await onDeleteSalaryItem(itemId);
      } catch (err: any) {
        if (onError) onError('Erro ao remover item', err.message);
      }
    }
  };

  // Save Tax Table
  const handleSaveModalTaxTable = async () => {
    if (!onSaveTaxTable) return;
    setIsSavingTaxTable(true);
    setTaxSuccessMsg(null);
    try {
      await onSaveTaxTable({
        ...modalTableData,
        year: modalTaxYear,
      });
      setTaxSuccessMsg(`Tabela fiscal de ${modalTaxYear} salva com sucesso!`);
      setTimeout(() => setTaxSuccessMsg(null), 3500);
    } catch (err: any) {
      if (onError) onError('Erro ao salvar tabela fiscal', err.message);
    } finally {
      setIsSavingTaxTable(false);
    }
  };

  // Reset Tax Table to Official Preset
  const handleResetModalTaxTable = async () => {
    if (!onResetTaxTable) return;
    setIsSavingTaxTable(true);
    setTaxSuccessMsg(null);
    try {
      await onResetTaxTable(modalTaxYear);
      setModalTableData(getTaxTableForYear(modalTaxYear));
      setTaxSuccessMsg(`Tabela de ${modalTaxYear} restaurada para o padrão oficial!`);
      setTimeout(() => setTaxSuccessMsg(null), 3500);
    } catch (err: any) {
      if (onError) onError('Erro ao restaurar tabela fiscal', err.message);
    } finally {
      setIsSavingTaxTable(false);
    }
  };

  const updateInssBracket = (idx: number, field: 'min' | 'max' | 'rate', value: number | null) => {
    setModalTableData((prev) => {
      const nextBrackets = [...prev.inssBrackets];
      nextBrackets[idx] = { ...nextBrackets[idx], [field]: value };
      return { ...prev, inssBrackets: nextBrackets };
    });
  };

  const updateIrrfBracket = (
    idx: number,
    field: 'min' | 'max' | 'rate' | 'deduction',
    value: number | null
  ) => {
    setModalTableData((prev) => {
      const nextBrackets = [...prev.irrfBrackets];
      nextBrackets[idx] = { ...nextBrackets[idx], [field]: value };
      return { ...prev, irrfBrackets: nextBrackets };
    });
  };

  // Navigation between months
  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleResetToCurrentMonth = () => {
    setSelectedYear(now.getUTCFullYear());
    setSelectedMonth(now.getUTCMonth());
  };

  // Annual overview table data
  const annualRows = useMemo(() => {
    return MONTH_NAMES.map((mName, mIdx) => {
      const rec = salaryMonthlyRecords.find((r) => r.year === selectedYear && r.month === mIdx);

      const mItems = salaryItemizedEntries.filter(
        (i) => (i.year === selectedYear && i.month === mIdx) || (i.month === -1 && i.isRecurring)
      );
      const mEarnings = mItems.filter((i) => i.type === 'earning');
      const mDeductions = mItems.filter((i) => i.type === 'deduction');
      const mTaxTable = getTaxTableForYear(selectedYear, salaryTaxTables);
      const mCalc = calculateSalary(liveConfig, mTaxTable, mItems);

      const projAdv = rec ? rec.projectedAdvance : mCalc.advanceAmount;
      const projPay = rec ? rec.projectedPayday : mCalc.paydayAmount;
      const projTotal = projAdv + projPay;

      const realAdv = rec?.realAdvance ?? null;
      const realPay = rec?.realPayday ?? null;
      const realTotal = (realAdv !== null ? realAdv : 0) + (realPay !== null ? realPay : 0);
      const hasReal = realAdv !== null || realPay !== null;

      const diff = hasReal ? realTotal - projTotal : 0;

      return {
        monthIndex: mIdx,
        monthName: mName,
        projAdv,
        realAdv,
        projPay,
        realPay,
        projTotal,
        realTotal: hasReal ? realTotal : null,
        diff,
        hasRecord: Boolean(rec),
        advTxLinked: Boolean(rec?.advanceTransactionId),
        payTxLinked: Boolean(rec?.paydayTransactionId),
        mItems,
        mEarnings,
        mDeductions,
        mCalc,
        notes: rec?.notes || '',
      };
    });
  }, [salaryMonthlyRecords, salaryItemizedEntries, salaryTaxTables, selectedYear, liveConfig]);

  const annualTotals = useMemo(() => {
    return annualRows.reduce(
      (acc, row) => {
        acc.projTotal += row.projTotal;
        if (row.realTotal !== null) {
          acc.realTotal += row.realTotal;
          acc.monthsWithReal += 1;
        }
        acc.totalExtraEarnings += row.mEarnings.reduce((s, e) => s + (Number(e.amount) || 0), 0);
        acc.totalItemizedDeductions += row.mDeductions.reduce((s, d) => s + (Number(d.amount) || 0), 0);
        acc.totalInss += row.mCalc.inssDiscount;
        acc.totalIrrf += row.mCalc.irrfDiscount;
        return acc;
      },
      {
        projTotal: 0,
        realTotal: 0,
        monthsWithReal: 0,
        totalExtraEarnings: 0,
        totalItemizedDeductions: 0,
        totalInss: 0,
        totalIrrf: 0,
      }
    );
  }, [annualRows]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Header Card */}
      <div className="glass-card p-6 rounded-3xl border border-white/[0.08] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-white text-xl shadow-lg shadow-emerald-500/20">
                <i className="fa-solid fa-money-bill-transfer"></i>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Salário & Holerite</h1>
                <p className="text-xs md:text-sm text-slate-400">
                  Cálculo de deduções CLT (INSS e IRRF), projeção de renda, adiantamento (vale) e conferência mensal real.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Regime / Tax Table Button */}
            <button
              type="button"
              onClick={() => {
                setModalTaxYear(taxYearInput || 2026);
                setIsTaxModalOpen(true);
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-slate-800/90 hover:bg-slate-700/80 border border-white/10 text-xs text-slate-200 transition-all cursor-pointer group shadow-sm hover:border-emerald-500/40"
              title="Clique para configurar as tabelas e faixas de INSS e IRRF"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="font-semibold">Tabela CLT {taxYearInput || 2026}</span>
              <span className="text-[10px] text-slate-400 bg-white/5 px-1.5 py-0.5 rounded font-mono">
                Teto {formatCurrency(activeTaxTable.inssCeiling)}
              </span>
              <i className="fa-solid fa-sliders text-slate-400 group-hover:text-emerald-400 transition-colors text-[10px] ml-0.5"></i>
            </button>

            {/* Projection Toggle */}
            <button
              type="button"
              onClick={async () => {
                const nextActive = !isActive;
                setIsActive(nextActive);
                await onUpdateSalaryConfig({ ...liveConfig, isActive: nextActive });
              }}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all ${
                isActive
                  ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 shadow-sm shadow-emerald-500/10'
                  : 'bg-slate-800/60 border-white/10 text-slate-400'
              }`}
            >
              <i className={`fa-solid ${isActive ? 'fa-circle-check text-emerald-400' : 'fa-circle-xmark text-slate-500'}`}></i>
              {isActive ? 'Projetar no Fluxo de Caixa' : 'Projeção Desativada'}
            </button>
          </div>
        </div>

        {/* Global Summary KPI Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-6 pt-6 border-t border-white/[0.08]">
          <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-white/5">
            <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Salário Bruto Total
            </span>
            <span className="text-lg md:text-xl font-bold text-white tabular-nums">
              {formatCurrency(calculation.effectiveGross)}
            </span>
            <span className="text-[10px] text-slate-500 block mt-0.5">
              {calculation.additionalEarnings > 0
                ? `Base ${formatCurrency(calculation.baseSalary)} + ${formatCurrency(calculation.additionalEarnings)} adic.`
                : 'Base contratual'}
            </span>
          </div>

          <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-white/5">
            <span className="text-[11px] font-medium text-rose-400 uppercase tracking-wider block">
              Total Descontos
            </span>
            <span className="text-lg md:text-xl font-bold text-rose-300 tabular-nums">
              -{formatCurrency(calculation.totalDeductions)}
            </span>
            <span className="text-[10px] text-rose-400/80 block mt-0.5">
              INSS ({calculation.inssEffectiveRate}%) + IRRF ({calculation.irrfEffectiveRate}%)
              {calculation.itemizedDeductions > 0 ? ` + outros` : ''}
            </span>
          </div>

          <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
            <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider block">
              Salário Líquido Total
            </span>
            <span className="text-lg md:text-xl font-bold text-emerald-300 tabular-nums">
              {formatCurrency(calculation.netSalary)}
            </span>
            <span className="text-[10px] text-emerald-400/80 block mt-0.5">Disponível no mês</span>
          </div>

          <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-sky-500/20 bg-sky-500/5">
            <span className="text-[11px] font-medium text-sky-400 uppercase tracking-wider block">
              Vale (Dia {calculation.advanceDay})
            </span>
            <span className="text-lg md:text-xl font-bold text-sky-300 tabular-nums">
              {formatCurrency(calculation.advanceAmount)}
            </span>
            <span className="text-[10px] text-sky-400/80 block mt-0.5">Adiantamento de renda</span>
          </div>

          <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-indigo-500/20 bg-indigo-500/5 col-span-2 sm:col-span-1">
            <span className="text-[11px] font-medium text-indigo-400 uppercase tracking-wider block">
              Pagamento (Dia {calculation.paydayDay})
            </span>
            <span className="text-lg md:text-xl font-bold text-indigo-300 tabular-nums">
              {formatCurrency(calculation.paydayAmount)}
            </span>
            <span className="text-[10px] text-indigo-400/80 block mt-0.5">Saldo final da folha</span>
          </div>
        </div>
      </div>

      {/* Navigation Subtabs */}
      <div className="flex items-center justify-between border-b border-white/[0.08] pb-2">
        <div className="flex items-center gap-2 overflow-x-auto custom-scrollbar pb-1">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'overview'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <i className="fa-solid fa-calculator"></i>
            Espelho & Parâmetros
          </button>

          <button
            onClick={() => setActiveTab('monthly')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'monthly'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <i className="fa-solid fa-calendar-check"></i>
            Lançamento Mensal Real
            {currentMonthRecord && (currentMonthRecord.realAdvance !== null || currentMonthRecord.realPayday !== null) && (
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('history')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'history'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <i className="fa-solid fa-table-list"></i>
            Histórico Anual ({selectedYear})
          </button>

          <button
            onClick={() => setActiveTab('thirteenth_vacation')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all whitespace-nowrap ${
              activeTab === 'thirteenth_vacation'
                ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-sm'
                : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <i className="fa-solid fa-umbrella-beach"></i>
            13º & Férias
            {currentYearVacations.length > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-bold">
                {currentYearVacations.length}
              </span>
            )}
          </button>
        </div>

        {/* Month/Year Selector for Monthly, History and 13th/Vacation Views */}
        {activeTab !== 'overview' && (
          <div className="flex items-center gap-1.5 bg-slate-900/80 p-1 rounded-xl border border-white/10 text-xs">
            {activeTab === 'thirteenth_vacation' ? (
              <>
                <button
                  type="button"
                  onClick={() => setSelectedYear((y) => y - 1)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                  title="Ano anterior"
                >
                  <i className="fa-solid fa-chevron-left text-xs"></i>
                </button>
                <span className="font-semibold text-white px-3 min-w-[80px] text-center">
                  Ano {selectedYear}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedYear((y) => y + 1)}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                  title="Próximo ano"
                >
                  <i className="fa-solid fa-chevron-right text-xs"></i>
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedYear(now.getUTCFullYear())}
                  className="px-2 py-1 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors border border-emerald-500/20 ml-1"
                  title="Voltar ao ano atual"
                >
                  Atual
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                  title="Mês anterior"
                >
                  <i className="fa-solid fa-chevron-left text-xs"></i>
                </button>

                <span className="font-semibold text-white px-2 min-w-[120px] text-center">
                  {MONTH_NAMES[selectedMonth]} {selectedYear}
                </span>

                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors"
                  title="Próximo mês"
                >
                  <i className="fa-solid fa-chevron-right text-xs"></i>
                </button>

                <button
                  type="button"
                  onClick={handleResetToCurrentMonth}
                  className="px-2 py-1 text-[10px] font-bold text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors border border-emerald-500/20 ml-1"
                  title="Voltar ao mês atual"
                >
                  Atual
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {/* TAB 1: OVERVIEW & PARAMETERS */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Column 1: Config Form (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <form onSubmit={handleSaveConfig} className="glass-card p-6 rounded-3xl border border-white/[0.08] space-y-5">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm">
                    <i className="fa-solid fa-sliders"></i>
                  </div>
                  <div>
                    <h2 className="font-bold text-white text-base">Parâmetros do Salário</h2>
                    <p className="text-xs text-slate-400">Configure seu contrato para cálculo automático</p>
                  </div>
                </div>
              </div>

              {configSuccessMsg && (
                <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
                  <i className="fa-solid fa-circle-check"></i>
                  {configSuccessMsg}
                </div>
              )}

              {/* Ano Base da Legislação Fiscal */}
              <div className="p-3.5 bg-slate-900/60 rounded-2xl border border-white/5 flex items-center justify-between">
                <div>
                  <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                    <i className="fa-solid fa-scale-balanced text-emerald-400 text-xs"></i>
                    Tabela Fiscal de Referência
                  </label>
                  <p className="text-[10px] text-slate-400">
                    Alíquotas e tetos de INSS e IRRF
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    value={taxYearInput}
                    onChange={(e) => setTaxYearInput(parseInt(e.target.value, 10))}
                    className="bg-slate-950 border border-white/10 rounded-xl px-2.5 py-1.5 text-xs text-white font-bold focus:border-emerald-500 focus:outline-none cursor-pointer"
                  >
                    <option value={2026}>2026</option>
                    <option value={2025}>2025</option>
                    <option value={2024}>2024</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      setModalTaxYear(taxYearInput);
                      setIsTaxModalOpen(true);
                    }}
                    className="px-2.5 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                    title="Configurar faixas e alíquotas"
                  >
                    <i className="fa-solid fa-gear text-[10px]"></i>
                    Configurar
                  </button>
                </div>
              </div>

              {/* Salário Bruto */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                  <span>Salário Bruto Base (R$)</span>
                  <span className="text-[10px] text-slate-500">Base sem adicionais</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">R$</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={grossSalaryInput}
                    onChange={(e) => setGrossSalaryInput(e.target.value)}
                    placeholder="0.00"
                    className="w-full bg-slate-900/90 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-white font-bold text-base focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all tabular-nums"
                  />
                </div>
              </div>

              {/* Dependentes & Outros Descontos */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Dependentes</span>
                    <span className="text-[10px] text-emerald-400" title="R$ 189,59 de dedução/dependente">
                      -R$ 189,59 cd.
                    </span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={dependentsInput}
                    onChange={(e) => setDependentsInput(e.target.value)}
                    className="w-full bg-slate-900/90 border border-white/10 rounded-xl px-3.5 py-2.5 text-white font-semibold text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Outros Descontos</span>
                    <span className="text-[10px] text-slate-500">VT, Saúde, etc.</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={otherDeductionsInput}
                      onChange={(e) => setOtherDeductionsInput(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-900/90 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white font-semibold text-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all tabular-nums"
                    />
                  </div>
                </div>
              </div>

              {/* Custom Taxes Override (INSS e IRRF da Folha) */}
              <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                      <i className="fa-solid fa-scale-balanced text-xs"></i>
                      Descontos Fiscais (INSS e IRRF)
                    </span>
                    <p className="text-[10px] text-slate-400">
                      Tabela Fiscal {taxYearInput || 2026} (Teto INSS: {formatCurrency(activeTaxTable.inssCeiling)})
                    </p>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-300 select-none bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20 hover:bg-amber-500/15 transition-colors">
                    <input
                      type="checkbox"
                      checked={useCustomTaxes}
                      onChange={(e) => setUseCustomTaxes(e.target.checked)}
                      className="rounded bg-slate-800 border-white/20 text-amber-500 focus:ring-0 w-3.5 h-3.5"
                    />
                    <span className="font-semibold text-[11px]">Fixar valores da folha</span>
                  </label>
                </div>

                {useCustomTaxes && (
                  <div className="grid grid-cols-2 gap-3 pt-1 animate-fadeIn">
                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300 flex justify-between">
                        <span>INSS da Folha (R$)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={customInssAmountInput}
                          onChange={(e) => setCustomInssAmountInput(e.target.value)}
                          placeholder="988.07"
                          className="w-full bg-slate-900 border border-amber-500/40 rounded-xl pl-8 pr-3 py-2 text-white text-sm font-semibold focus:border-amber-400 focus:outline-none tabular-nums"
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 block">Ex: 988,07 (teto 2026)</span>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-300 flex justify-between">
                        <span>IRRF da Folha (R$)</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={customIrrfAmountInput}
                          onChange={(e) => setCustomIrrfAmountInput(e.target.value)}
                          placeholder="3359.60"
                          className="w-full bg-slate-900 border border-amber-500/40 rounded-xl pl-8 pr-3 py-2 text-white text-sm font-semibold focus:border-amber-400 focus:outline-none tabular-nums"
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 block">Ex: 3359,60</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Advance Setting (Vale) */}
              <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-sky-300 flex items-center gap-1.5">
                    <i className="fa-solid fa-hand-holding-dollar text-xs"></i>
                    Adiantamento / Vale Quinzenal
                  </span>
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-400 select-none">
                    <input
                      type="checkbox"
                      checked={useCustomAdvance}
                      onChange={(e) => setUseCustomAdvance(e.target.checked)}
                      className="rounded bg-slate-800 border-white/20 text-emerald-500 focus:ring-0 w-3.5 h-3.5"
                    />
                    <span>Valor fixo</span>
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {!useCustomAdvance ? (
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400">Percentual do Vale (%)</label>
                      <div className="relative">
                        <input
                          type="number"
                          step="1"
                          min="1"
                          max="90"
                          value={advancePercentageInput}
                          onChange={(e) => setAdvancePercentageInput(e.target.value)}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-semibold focus:border-sky-500 focus:outline-none"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">%</span>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-400">Valor Fixo do Vale (R$)</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">R$</span>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={customAdvanceAmountInput}
                          onChange={(e) => setCustomAdvanceAmountInput(e.target.value)}
                          className="w-full bg-slate-900 border border-white/10 rounded-xl pl-8 pr-3 py-2 text-white text-sm font-semibold focus:border-sky-500 focus:outline-none tabular-nums"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <label className="text-[11px] text-slate-400">Dia de Recebimento</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={advanceDayInput}
                        onChange={(e) => setAdvanceDayInput(e.target.value)}
                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-semibold focus:border-sky-500 focus:outline-none"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">do mês</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payday Setting */}
              <div className="p-4 bg-slate-900/50 rounded-2xl border border-white/5 space-y-3">
                <span className="text-xs font-bold text-indigo-300 flex items-center gap-1.5">
                  <i className="fa-solid fa-calendar-check text-xs"></i>
                  Pagamento Final (Saldo da Folha)
                </span>

                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Dia de Recebimento do Saldo</label>
                  <div className="relative">
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={paydayDayInput}
                      onChange={(e) => setPaydayDayInput(e.target.value)}
                      className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-semibold focus:border-indigo-500 focus:outline-none"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">do mês</span>
                  </div>
                  <p className="text-[10px] text-slate-500">Normalmente 5º dia útil ou dia 5/dia 30.</p>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSavingConfig}
                className="w-full py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSavingConfig ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    Salvando...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-floppy-disk"></i>
                    Salvar Parâmetros
                  </>
                )}
              </button>
            </form>

            {/* Recurring Items Card (Benefícios & Deduções da Folha) */}
            <div className="glass-card p-6 rounded-3xl border border-white/[0.08] space-y-4">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center text-sm">
                    <i className="fa-solid fa-list-check"></i>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">Itens Fixos da Folha</h3>
                    <p className="text-[11px] text-slate-400">Benefícios e descontos contratuais de todo mês</p>
                  </div>
                </div>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-semibold border border-white/5">
                  {recurringItems.length} {recurringItems.length === 1 ? 'item' : 'itens'}
                </span>
              </div>

              {/* Quick Add Form */}
              <form onSubmit={handleAddRecurringItem} className="space-y-3 bg-slate-900/60 p-3.5 rounded-2xl border border-white/5">
                <div className="flex rounded-xl bg-slate-950 p-1 border border-white/10 text-xs">
                  <button
                    type="button"
                    onClick={() => setNewRecType('earning')}
                    className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      newRecType === 'earning'
                        ? 'bg-emerald-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    + Provento Fixo
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewRecType('deduction')}
                    className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      newRecType === 'deduction'
                        ? 'bg-rose-500 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    - Desconto Fixo
                  </button>
                </div>

                {/* Quick suggestions chips */}
                <div className="flex flex-wrap gap-1.5">
                  {(newRecType === 'deduction'
                    ? ['Plano de Saúde', 'Previdência Privada', 'Seguro de Vida', 'Vale Refeição', 'Farmácia', 'Consignado']
                    : ['Adicional Noturno', 'Periculosidade', 'Insalubridade', 'Auxílio Creche', 'Gratificação Fixa']
                  ).map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setNewRecName(chip)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <input
                    type="text"
                    value={newRecName}
                    onChange={(e) => setNewRecName(e.target.value)}
                    placeholder={newRecType === 'deduction' ? 'Ex: Unimed Familiar' : 'Ex: Adicional Função'}
                    className="sm:col-span-7 bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:border-purple-500 focus:outline-none"
                  />
                  <div className="sm:col-span-5 relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newRecAmount}
                      onChange={(e) => setNewRecAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-950 border border-white/10 rounded-xl pl-8 pr-2 py-2 text-white text-xs font-semibold focus:border-purple-500 focus:outline-none tabular-nums"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSavingRecItem || !newRecName.trim() || !newRecAmount.trim()}
                  className="w-full py-2 rounded-xl bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/40 text-purple-300 text-xs font-bold transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSavingRecItem ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                      Adicionando...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-plus text-[10px]"></i>
                      Adicionar à Folha Fixa
                    </>
                  )}
                </button>
              </form>

              {/* List of Recurring Items */}
              <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
                {recurringItems.length === 0 ? (
                  <p className="text-xs text-slate-500 text-center py-3">
                    Nenhum benefício ou desconto fixo cadastrado.
                  </p>
                ) : (
                  recurringItems.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2.5 bg-slate-900/80 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className={`w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-bold ${
                            item.type === 'earning'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : 'bg-rose-500/20 text-rose-400'
                          }`}
                        >
                          {item.type === 'earning' ? '+' : '-'}
                        </span>
                        <div>
                          <span className="text-xs font-medium text-white block">{item.name}</span>
                          <span className="text-[10px] text-slate-500">Recorrente todo mês</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span
                          className={`text-xs font-bold tabular-nums ${
                            item.type === 'earning' ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                        >
                          {item.type === 'earning' ? '+' : '-'}
                          {formatCurrency(item.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => item.id && handleDeleteItem(item.id)}
                          className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                          title="Remover item fixo"
                        >
                          <i className="fa-solid fa-trash-can text-xs"></i>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Column 2: Digital Payslip Mirror (Espelho de Holerite) (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div className="glass-card p-6 rounded-3xl border border-white/[0.08] space-y-6 relative overflow-hidden">
              <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center text-sm">
                    <i className="fa-solid fa-file-invoice-dollar"></i>
                  </div>
                  <div>
                    <h2 className="font-bold text-white text-base">Espelho de Holerite (Demonstrativo)</h2>
                    <p className="text-xs text-slate-400">Detalhamento dos descontos fiscais oficiais e parcelas</p>
                  </div>
                </div>

                <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-400">
                  Estimativa Mensal
                </span>
              </div>

              {/* Earnings Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                  <i className="fa-solid fa-plus-circle text-xs"></i>
                  Vencimentos & Proventos
                </h3>
                <div className="bg-slate-900/80 rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
                  <div className="flex items-center justify-between px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                      <span className="text-white font-medium">001 - Salário Base Mensal</span>
                    </div>
                    <span className="text-emerald-400 font-bold tabular-nums">
                      {formatCurrency(calculation.baseSalary)}
                    </span>
                  </div>

                  {/* Recurring Earnings List */}
                  {recurringItems
                    .filter((i) => i.type === 'earning')
                    .map((item) => (
                      <div key={item.id} className="flex items-center justify-between px-4 py-2.5 text-sm bg-emerald-500/[0.02]">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-300"></span>
                          <span className="text-slate-200 font-medium">{item.name}</span>
                          <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded font-semibold border border-emerald-500/20">
                            Fixo
                          </span>
                        </div>
                        <span className="text-emerald-400 font-semibold tabular-nums">
                          +{formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}

                  <div className="flex items-center justify-between px-4 py-2.5 bg-emerald-500/5 text-xs font-semibold">
                    <span className="text-slate-300">Total de Vencimentos:</span>
                    <span className="text-emerald-300 font-bold tabular-nums">
                      {formatCurrency(calculation.effectiveGross)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Deductions Table */}
              <div className="space-y-2">
                <h3 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-1.5">
                  <i className="fa-solid fa-minus-circle text-xs"></i>
                  Descontos Oficiais (INSS e IRRF) & Folha
                </h3>
                <div className="bg-slate-900/80 rounded-2xl border border-white/5 overflow-hidden divide-y divide-white/5">
                  {/* INSS Row */}
                  <div className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                        <span className="text-white font-medium">501 - INSS (Previdência Social)</span>
                        <span className="text-[11px] text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                          {calculation.inssEffectiveRate}% efetiva
                        </span>
                      </div>
                      <span className="text-rose-400 font-bold tabular-nums">
                        -{formatCurrency(calculation.inssDiscount)}
                      </span>
                    </div>

                    {/* INSS Brackets Breakdown */}
                    {calculation.inssBrackets.length > 0 && (
                      <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5 space-y-1">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                          Cálculo Progressivo Faixa a Faixa:
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px]">
                          {calculation.inssBrackets.map((b, idx) => (
                            <div key={idx} className="flex justify-between items-center text-slate-300 py-0.5 border-b border-white/[0.04]">
                              <span className="text-slate-400">{b.bracket}:</span>
                              <span className="tabular-nums text-slate-200">
                                {formatCurrency(b.deduction)}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* IRRF Row */}
                  <div className="p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                        <span className="text-white font-medium">502 - IRRF (Imposto de Renda)</span>
                        <span className="text-[11px] text-rose-400 font-bold bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                          {calculation.irrfEffectiveRate}% efetiva
                        </span>
                      </div>
                      <span className="text-rose-400 font-bold tabular-nums">
                        -{formatCurrency(calculation.irrfDiscount)}
                      </span>
                    </div>

                    <div className="bg-slate-950/60 p-2.5 rounded-xl border border-white/5 text-[11px] space-y-1 text-slate-300">
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Base de Cálculo IRRF:</span>
                        <span className="font-semibold tabular-nums text-white">
                          {formatCurrency(calculation.irrfBase)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-slate-400">Método mais vantajoso:</span>
                        <span className="font-semibold text-emerald-400">
                          {calculation.irrfUsedSimplified
                            ? `Desconto Simplificado (${formatCurrency(activeTaxTable.irrfSimplifiedDiscount)})`
                            : `Deduções Legais (${liveConfig.dependents} dep. + INSS)`}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Recurring Deductions List */}
                  {recurringItems
                    .filter((i) => i.type === 'deduction')
                    .map((item) => (
                      <div key={item.id} className="flex items-center justify-between px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                          <span className="text-slate-200 font-medium">{item.name}</span>
                          <span className="text-[10px] text-rose-400 bg-rose-500/10 px-1.5 py-0.5 rounded font-semibold border border-rose-500/20">
                            Fixo
                          </span>
                        </div>
                        <span className="text-rose-400 font-bold tabular-nums">
                          -{formatCurrency(item.amount)}
                        </span>
                      </div>
                    ))}

                  {/* Other Deductions Row (Generic) */}
                  {liveConfig.otherDeductions > 0 && (
                    <div className="flex items-center justify-between px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
                        <span className="text-white font-medium">599 - Outros Descontos Oficiais</span>
                      </div>
                      <span className="text-rose-400 font-bold tabular-nums">
                        -{formatCurrency(liveConfig.otherDeductions)}
                      </span>
                    </div>
                  )}

                  {/* Deductions Total */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-rose-500/5 text-xs font-semibold">
                    <span className="text-slate-300">Total de Descontos:</span>
                    <span className="text-rose-300 font-bold tabular-nums">
                      -{formatCurrency(calculation.totalDeductions)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Net Salary & Split Box */}
              <div className="p-5 rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-emerald-950/30 border border-emerald-500/30 space-y-4">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div>
                    <span className="text-xs text-slate-400 block">Salário Líquido Mensal</span>
                    <span className="text-2xl font-black text-emerald-400 tabular-nums">
                      {formatCurrency(calculation.netSalary)}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">Percentual Líquido</span>
                    <span className="text-sm font-bold text-white tabular-nums">
                      {calculation.grossSalary > 0
                        ? `${Math.round((calculation.netSalary / calculation.grossSalary) * 100)}% do bruto`
                        : '0%'}
                    </span>
                  </div>
                </div>

                {/* Split Visual Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div className="p-3.5 bg-slate-950/80 rounded-xl border border-sky-500/30 space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-sky-300">
                      <span>1ª Parcela (Vale)</span>
                      <span>Dia {calculation.advanceDay}</span>
                    </div>
                    <span className="text-lg font-bold text-white tabular-nums block">
                      {formatCurrency(calculation.advanceAmount)}
                    </span>
                    <p className="text-[10px] text-slate-400">
                      Adiantamento antecipado (sem retenção de impostos)
                    </p>
                  </div>

                  <div className="p-3.5 bg-slate-950/80 rounded-xl border border-indigo-500/30 space-y-1">
                    <div className="flex items-center justify-between text-xs font-semibold text-indigo-300">
                      <span>2ª Parcela (Pagamento)</span>
                      <span>Dia {calculation.paydayDay}</span>
                    </div>
                    <span className="text-lg font-bold text-white tabular-nums block">
                      {formatCurrency(calculation.paydayAmount)}
                    </span>
                    <p className="text-[10px] text-slate-400">
                      Saldo restante com a dedução fiscal de INSS e IRRF
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: MONTHLY REALIZED (ACOMPANHAMENTO MENSAL REAL) */}
      {activeTab === 'monthly' && (
        <div className="space-y-6">
          <div className="glass-card p-6 rounded-3xl border border-white/[0.08] space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <i className="fa-solid fa-calendar-check text-emerald-400"></i>
                  Lançamento Real: {MONTH_NAMES[selectedMonth]} de {selectedYear}
                </h2>
                <p className="text-xs text-slate-400">
                  Preencha o valor exato que entrou na sua conta bancária e lance no extrato com 1 clique.
                </p>
              </div>

              {monthSuccessMsg && (
                <div className="p-2.5 px-4 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-fadeIn">
                  <i className="fa-solid fa-circle-check"></i>
                  {monthSuccessMsg}
                </div>
              )}
            </div>

            {/* Monthly Calculation Summary Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-900/90 to-emerald-950/30 border border-white/10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg shadow-sm">
                  <i className="fa-solid fa-calculator"></i>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">Holerite Calculado para {MONTH_NAMES[selectedMonth]}/{selectedYear}:</span>
                    <span className="text-sm font-bold text-emerald-400 tabular-nums">
                      Líquido {formatCurrency(monthCalculation.netSalary)}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                    <span>Bruto Total: <strong className="text-white">{formatCurrency(monthCalculation.effectiveGross)}</strong></span>
                    <span>INSS: <strong className="text-rose-400">-{formatCurrency(monthCalculation.inssDiscount)}</strong></span>
                    <span>IRRF: <strong className="text-rose-400">-{formatCurrency(monthCalculation.irrfDiscount)}</strong></span>
                    {monthCalculation.itemizedDeductions > 0 && (
                      <span>Deduções Folha: <strong className="text-rose-400">-{formatCurrency(monthCalculation.itemizedDeductions)}</strong></span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setRealPaydayInput(String(monthCalculation.paydayAmount))}
                  className="px-3.5 py-2 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                  title="Copiar o saldo líquido calculado para o campo de pagamento real"
                >
                  <i className="fa-solid fa-clone text-[10px]"></i>
                  Copiar Líquido ({formatCurrency(monthCalculation.paydayAmount)}) para Pgto
                </button>
              </div>
            </div>

            {/* Comparison Cards: Vale vs Pagamento */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Card 1: Adiantamento (Vale) */}
              <div className="p-5 bg-slate-900/80 rounded-2xl border border-sky-500/20 space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs">
                      VALE
                    </div>
                    <div>
                      <span className="text-sm font-bold text-white block">Adiantamento (Vale)</span>
                      <span className="text-[11px] text-slate-400">Previsão: todo dia {liveConfig.advanceDay}</span>
                    </div>
                  </div>

                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-sky-500/10 text-sky-300 border border-sky-500/20">
                    Projetado: {formatCurrency(monthCalculation.advanceAmount)}
                  </span>
                </div>

                {/* Input Real Amount */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Valor Real que Entrou (R$)</span>
                    {realAdvanceInput.trim() !== '' && (
                      <span
                        className={`text-xs font-bold ${
                          parseFloat(realAdvanceInput.replace(',', '.')) >= monthCalculation.advanceAmount
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}
                      >
                        Dif: {formatCurrency(parseFloat(realAdvanceInput.replace(',', '.')) - monthCalculation.advanceAmount)}
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={realAdvanceInput}
                      onChange={(e) => setRealAdvanceInput(e.target.value)}
                      placeholder={String(monthCalculation.advanceAmount)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white font-bold text-base focus:border-sky-500 focus:outline-none tabular-nums"
                    />
                  </div>
                </div>

                {/* Input Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Data do Crédito na Conta</label>
                  <input
                    type="date"
                    value={advanceDateInput}
                    onChange={(e) => setAdvanceDateInput(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:border-sky-500 focus:outline-none"
                  />
                </div>

                {/* Action button */}
                <div className="pt-2">
                  {linkedAdvanceTx ? (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
                      <span className="flex items-center gap-2">
                        <i className="fa-solid fa-circle-check text-emerald-400"></i>
                        Lançado no Extrato ({formatCurrency(linkedAdvanceTx.amount)})
                      </span>
                      <span className="text-[10px] text-slate-400">Em {linkedAdvanceTx.date}</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePushAdvanceToExtrato}
                      className="w-full py-2.5 px-4 rounded-xl bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square"></i>
                      Lançar Vale no Extrato de Transações
                    </button>
                  )}
                </div>
              </div>

              {/* Card 2: Pagamento Final Líquido */}
              <div className="p-5 bg-slate-900/80 rounded-2xl border border-indigo-500/20 space-y-4">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs">
                      PGTO
                    </div>
                    <div>
                      <span className="text-sm font-bold text-white block">Pagamento Final Líquido</span>
                      <span className="text-[11px] text-slate-400">Previsão: todo dia {liveConfig.paydayDay}</span>
                    </div>
                  </div>

                  <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                    Projetado: {formatCurrency(monthCalculation.paydayAmount)}
                  </span>
                </div>

                {/* Input Real Amount */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                    <span>Valor Real que Entrou (R$)</span>
                    {realPaydayInput.trim() !== '' && (
                      <span
                        className={`text-xs font-bold ${
                          parseFloat(realPaydayInput.replace(',', '.')) >= monthCalculation.paydayAmount
                            ? 'text-emerald-400'
                            : 'text-amber-400'
                        }`}
                      >
                        Dif: {formatCurrency(parseFloat(realPaydayInput.replace(',', '.')) - monthCalculation.paydayAmount)}
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={realPaydayInput}
                      onChange={(e) => setRealPaydayInput(e.target.value)}
                      placeholder={String(monthCalculation.paydayAmount)}
                      className="w-full bg-slate-950 border border-white/10 rounded-xl pl-9 pr-3 py-2.5 text-white font-bold text-base focus:border-indigo-500 focus:outline-none tabular-nums"
                    />
                  </div>
                </div>

                {/* Input Date */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">Data do Crédito na Conta</label>
                  <input
                    type="date"
                    value={paydayDateInput}
                    onChange={(e) => setPaydayDateInput(e.target.value)}
                    className="w-full bg-slate-950 border border-white/10 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                {/* Action button */}
                <div className="pt-2">
                  {linkedPaydayTx ? (
                    <div className="flex items-center justify-between p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-300">
                      <span className="flex items-center gap-2">
                        <i className="fa-solid fa-circle-check text-emerald-400"></i>
                        Lançado no Extrato ({formatCurrency(linkedPaydayTx.amount)})
                      </span>
                      <span className="text-[10px] text-slate-400">Em {linkedPaydayTx.date}</span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={handlePushPaydayToExtrato}
                      className="w-full py-2.5 px-4 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <i className="fa-solid fa-arrow-up-right-from-square"></i>
                      Lançar Pagamento no Extrato de Transações
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Detalhamento de Proventos e Descontos do Mês */}
            <div className="p-5 bg-slate-900/60 rounded-2xl border border-white/5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm">
                    <i className="fa-solid fa-receipt"></i>
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-sm">
                      Discriminação da Folha de {MONTH_NAMES[selectedMonth]}/{selectedYear}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Itens herdados do contrato fixo + proventos e descontos pontuais deste mês
                    </p>
                  </div>
                </div>

                <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-800 text-slate-400 font-semibold self-start sm:self-auto border border-white/5">
                  {monthItems.length} {monthItems.length === 1 ? 'item ativo' : 'itens ativos'}
                </span>
              </div>

              {/* Quick Add Month-specific Item Form */}
              <form onSubmit={handleAddMonthItem} className="space-y-3 bg-slate-950/60 p-3.5 rounded-xl border border-white/5">
                <div className="flex rounded-xl bg-slate-900 p-1 border border-white/10 text-xs">
                  <button
                    type="button"
                    onClick={() => setNewMonthType('earning')}
                    className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      newMonthType === 'earning'
                        ? 'bg-emerald-500 text-slate-950 shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    + Adicionar Provento Pontual (HE, Bônus, PLR)
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewMonthType('deduction')}
                    className={`flex-1 py-1.5 rounded-lg font-bold transition-all cursor-pointer ${
                      newMonthType === 'deduction'
                        ? 'bg-rose-500 text-white shadow'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    - Adicionar Desconto Pontual (Falta, Coparticipação)
                  </button>
                </div>

                {/* Suggestions chips */}
                <div className="flex flex-wrap gap-1.5">
                  {(newMonthType === 'earning'
                    ? ['Horas Extras 50%', 'Horas Extras 100%', 'Bônus / PLR', 'Comissão', 'Reembolso Despesas', 'Gratificação']
                    : ['Coparticipação Médica', 'Falta / Atraso', 'Adiantamento Avulso', 'Multa de Trânsito', 'Farmácia Extra']
                  ).map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setNewMonthName(chip)}
                      className="text-[10px] px-2 py-0.5 rounded-md bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    >
                      {chip}
                    </button>
                  ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                  <input
                    type="text"
                    value={newMonthName}
                    onChange={(e) => setNewMonthName(e.target.value)}
                    placeholder={newMonthType === 'earning' ? 'Ex: Horas Extras 50% (12h)' : 'Ex: Coparticipação Exames'}
                    className="sm:col-span-7 bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-white text-xs focus:border-amber-500 focus:outline-none"
                  />
                  <div className="sm:col-span-5 relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={newMonthAmount}
                      onChange={(e) => setNewMonthAmount(e.target.value)}
                      placeholder="0.00"
                      className="w-full bg-slate-900 border border-white/10 rounded-xl pl-8 pr-2 py-2 text-white text-xs font-semibold focus:border-amber-500 focus:outline-none tabular-nums"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSavingMonthItem || !newMonthName.trim() || !newMonthAmount.trim()}
                  className="w-full py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-bold transition-all disabled:opacity-40 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  {isSavingMonthItem ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin text-xs"></i>
                      Adicionando ao mês...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-plus text-[10px]"></i>
                      Lançar neste mês de {MONTH_NAMES[selectedMonth]}
                    </>
                  )}
                </button>
              </form>

              {/* Items Table for the Month */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
                  Itens computados neste holerite:
                </span>
                <div className="divide-y divide-white/5 bg-slate-950/40 rounded-xl border border-white/5 overflow-hidden">
                  <div className="flex items-center justify-between p-2.5 text-xs">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      <span className="text-white font-medium">Salário Base Mensal Contratual</span>
                    </div>
                    <span className="font-bold text-emerald-400 tabular-nums">
                      +{formatCurrency(liveConfig.grossSalary)}
                    </span>
                  </div>

                  {monthItems.map((item) => {
                    const isRec = item.month === -1 || item.isRecurring;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center justify-between p-2.5 text-xs hover:bg-white/[0.02] transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`w-4 h-4 rounded flex items-center justify-center text-[10px] font-bold ${
                              item.type === 'earning'
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : 'bg-rose-500/20 text-rose-400'
                            }`}
                          >
                            {item.type === 'earning' ? '+' : '-'}
                          </span>
                          <span className="text-slate-200">{item.name}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded font-semibold ${
                              isRec
                                ? 'bg-purple-500/15 text-purple-300 border border-purple-500/30'
                                : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                            }`}
                          >
                            {isRec ? 'Fixo da Folha' : 'Pontual deste mês'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2.5">
                          <span
                            className={`font-bold tabular-nums ${
                              item.type === 'earning' ? 'text-emerald-400' : 'text-rose-400'
                            }`}
                          >
                            {item.type === 'earning' ? '+' : '-'}
                            {formatCurrency(item.amount)}
                          </span>
                          {!isRec ? (
                            <button
                              type="button"
                              onClick={() => item.id && handleDeleteItem(item.id)}
                              className="p-1 text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                              title="Remover lançamento deste mês"
                            >
                              <i className="fa-solid fa-trash-can text-xs"></i>
                            </button>
                          ) : (
                            <span
                              className="text-[10px] text-slate-600 px-1"
                              title="Configurado na folha fixa (aba Parâmetros)"
                            >
                              <i className="fa-solid fa-lock text-[9px]"></i>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Notes Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Observações do Mês</span>
                <span className="text-[10px] text-slate-500">Horas extras, bônus, comissões ou descontos atípicos</span>
              </label>
              <textarea
                value={notesInput}
                onChange={(e) => setNotesInput(e.target.value)}
                placeholder="Ex: Recebi R$ 350,00 a mais de horas extras no pagamento e tive R$ 40,00 de desconto de farmácia."
                rows={2}
                className="w-full bg-slate-900 border border-white/10 rounded-xl p-3 text-white text-xs focus:border-emerald-500 focus:outline-none transition-all resize-none"
              />
            </div>

            {/* Bottom Save Month Button */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={handleSaveMonthRecord}
                disabled={isSavingMonth}
                className="py-3 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2 disabled:opacity-50 cursor-pointer"
              >
                {isSavingMonth ? (
                  <>
                    <i className="fa-solid fa-circle-notch fa-spin"></i>
                    Salvando Registro...
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-check-double"></i>
                    Salvar Registro de {MONTH_NAMES[selectedMonth]}/{selectedYear}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: ANNUAL HISTORY TABLE */}
      {activeTab === 'history' && (
        <div className="glass-card p-6 rounded-3xl border border-white/[0.08] space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.08] pb-4">
            <div>
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <i className="fa-solid fa-table-list text-emerald-400"></i>
                Demonstrativo Anual de Renda ({selectedYear})
              </h2>
              <p className="text-xs text-slate-400">
                Comparativo detalhado entre projeção, adicionais, deduções e renda real recebida mês a mês.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-3 py-1.5 rounded-xl bg-slate-900 border border-white/10 text-xs text-slate-300">
                <span className="text-slate-400">Meses com registro real: </span>
                <span className="font-bold text-emerald-400">{annualTotals.monthsWithReal}/12</span>
              </div>
            </div>
          </div>

          {/* Annual Summary KPI Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-white/5">
              <span className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
                Total Previsto Ano
              </span>
              <span className="text-base sm:text-lg font-bold text-white tabular-nums">
                {formatCurrency(annualTotals.projTotal)}
              </span>
              <span className="text-[10px] text-slate-500 block mt-0.5">12 meses contratuais</span>
            </div>

            <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5">
              <span className="text-[11px] font-medium text-emerald-400 uppercase tracking-wider block">
                Total Realizado no Ano
              </span>
              <span className="text-base sm:text-lg font-bold text-emerald-300 tabular-nums">
                {formatCurrency(annualTotals.realTotal)}
              </span>
              <span className="text-[10px] text-emerald-400/80 block mt-0.5">
                {annualTotals.monthsWithReal}/12 meses lançados
              </span>
            </div>

            <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-amber-500/20 bg-amber-500/5">
              <span className="text-[11px] font-medium text-amber-400 uppercase tracking-wider block">
                Adicionais & Bônus
              </span>
              <span className="text-base sm:text-lg font-bold text-amber-300 tabular-nums">
                +{formatCurrency(annualTotals.totalExtraEarnings)}
              </span>
              <span className="text-[10px] text-amber-400/80 block mt-0.5">HE, PLR e extras no ano</span>
            </div>

            <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-purple-500/20 bg-purple-500/5">
              <span className="text-[11px] font-medium text-purple-400 uppercase tracking-wider block">
                Deduções da Folha
              </span>
              <span className="text-base sm:text-lg font-bold text-purple-300 tabular-nums">
                -{formatCurrency(annualTotals.totalItemizedDeductions)}
              </span>
              <span className="text-[10px] text-purple-400/80 block mt-0.5">Benefícios e convênios</span>
            </div>

            <div className="bg-slate-900/60 p-3.5 rounded-2xl border border-rose-500/20 bg-rose-500/5 col-span-2 sm:col-span-1">
              <span className="text-[11px] font-medium text-rose-400 uppercase tracking-wider block">
                Retenção Total IR + INSS
              </span>
              <span className="text-base sm:text-lg font-bold text-rose-300 tabular-nums">
                -{formatCurrency(annualTotals.totalInss + annualTotals.totalIrrf)}
              </span>
              <span className="text-[10px] text-rose-400/80 block mt-0.5">
                INSS: {formatCurrency(annualTotals.totalInss)} | IR: {formatCurrency(annualTotals.totalIrrf)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 uppercase tracking-wider text-[10px]">
                  <th className="py-3 px-2 w-8 text-center"></th>
                  <th className="py-3 px-3">Mês</th>
                  <th className="py-3 px-3 text-right">Vale Proj.</th>
                  <th className="py-3 px-3 text-right">Vale Real</th>
                  <th className="py-3 px-3 text-right">Pgto Proj.</th>
                  <th className="py-3 px-3 text-right">Pgto Real</th>
                  <th className="py-3 px-3 text-right">Total Proj.</th>
                  <th className="py-3 px-3 text-right font-bold text-white">Total Real</th>
                  <th className="py-3 px-3 text-right">Diferença</th>
                  <th className="py-3 px-3 text-center">Extrato</th>
                  <th className="py-3 px-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04]">
                {annualRows.map((row) => {
                  const isExpanded = expandedHistoryMonths.has(row.monthIndex);
                  return (
                    <React.Fragment key={row.monthIndex}>
                      <tr
                        className={`hover:bg-white/[0.02] transition-colors ${
                          row.monthIndex === selectedMonth ? 'bg-emerald-500/[0.04]' : ''
                        }`}
                      >
                        <td className="py-3 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleToggleExpandMonth(row.monthIndex)}
                            className="p-1 text-slate-400 hover:text-white transition-transform cursor-pointer"
                            title={isExpanded ? 'Recolher detalhes' : 'Expandir demonstrativo completo'}
                          >
                            <i
                              className={`fa-solid fa-chevron-right text-[11px] transition-transform duration-200 ${
                                isExpanded ? 'rotate-90 text-emerald-400' : ''
                              }`}
                            ></i>
                          </button>
                        </td>
                        <td className="py-3 px-3 font-semibold text-white">
                          {row.monthName}
                          {row.monthIndex === selectedMonth && (
                            <span className="ml-1.5 text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-bold">
                              Selecionado
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-400 tabular-nums">
                          {formatCurrency(row.projAdv)}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums">
                          {row.realAdv !== null ? (
                            <span className="font-medium text-sky-300">{formatCurrency(row.realAdv)}</span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-400 tabular-nums">
                          {formatCurrency(row.projPay)}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums">
                          {row.realPay !== null ? (
                            <span className="font-medium text-indigo-300">{formatCurrency(row.realPay)}</span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right text-slate-300 tabular-nums">
                          {formatCurrency(row.projTotal)}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums font-bold">
                          {row.realTotal !== null ? (
                            <span className="text-emerald-400">{formatCurrency(row.realTotal)}</span>
                          ) : (
                            <span className="text-slate-600 font-normal">Pendente</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right tabular-nums">
                          {row.realTotal !== null ? (
                            <span
                              className={`font-semibold ${
                                row.diff >= 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}
                            >
                              {row.diff >= 0 ? '+' : ''}
                              {formatCurrency(row.diff)}
                            </span>
                          ) : (
                            <span className="text-slate-600">-</span>
                          )}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <span
                              className={`w-2 h-2 rounded-full ${
                                row.advTxLinked ? 'bg-sky-400' : 'bg-slate-700'
                              }`}
                              title={row.advTxLinked ? 'Vale lançado no extrato' : 'Vale não lançado'}
                            ></span>
                            <span
                              className={`w-2 h-2 rounded-full ${
                                row.payTxLinked ? 'bg-indigo-400' : 'bg-slate-700'
                              }`}
                              title={row.payTxLinked ? 'Pagamento lançado no extrato' : 'Pagamento não lançado'}
                            ></span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedMonth(row.monthIndex);
                              setActiveTab('monthly');
                            }}
                            className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-white/10 text-[11px] font-semibold transition-colors cursor-pointer"
                          >
                            Lançar
                          </button>
                        </td>
                      </tr>

                      {/* Expandable Payslip Mirror Details for this Month */}
                      {isExpanded && (
                        <tr className="bg-slate-950/80 border-b border-white/[0.04] animate-fadeIn">
                          <td colSpan={11} className="p-4">
                            <div className="rounded-2xl bg-slate-900/90 p-4 border border-white/10 space-y-3">
                              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                                <span className="font-bold text-xs text-white flex items-center gap-2">
                                  <i className="fa-solid fa-receipt text-emerald-400"></i>
                                  Demonstrativo da Folha: {row.monthName} de {selectedYear}
                                </span>
                                <div className="flex flex-wrap items-center gap-3 text-[11px]">
                                  <span className="text-slate-400">
                                    Bruto Total: <strong className="text-white">{formatCurrency(row.mCalc.effectiveGross)}</strong>
                                  </span>
                                  <span className="text-slate-400">
                                    INSS: <strong className="text-rose-400">-{formatCurrency(row.mCalc.inssDiscount)}</strong>
                                  </span>
                                  <span className="text-slate-400">
                                    IRRF: <strong className="text-rose-400">-{formatCurrency(row.mCalc.irrfDiscount)}</strong>
                                  </span>
                                  <span className="text-slate-400">
                                    Líquido Calculado: <strong className="text-emerald-400">{formatCurrency(row.mCalc.netSalary)}</strong>
                                  </span>
                                </div>
                              </div>

                              {/* Breakdown Grid */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                                {/* Proventos */}
                                <div className="space-y-1 bg-slate-950/60 p-3 rounded-xl border border-emerald-500/10">
                                  <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider mb-1">
                                    Vencimentos Computados
                                  </span>
                                  <div className="flex justify-between text-slate-300 py-0.5 border-b border-white/[0.03]">
                                    <span>Salário Base:</span>
                                    <span className="font-semibold text-white">{formatCurrency(row.mCalc.baseSalary)}</span>
                                  </div>
                                  {row.mEarnings.map((item) => (
                                    <div key={item.id} className="flex justify-between text-slate-300 py-0.5 border-b border-white/[0.03]">
                                      <span className="flex items-center gap-1.5">
                                        <span>{item.name}</span>
                                        <span className="text-[9px] text-slate-500">
                                          ({item.isRecurring || item.month === -1 ? 'folha fixa' : 'pontual do mês'})
                                        </span>
                                      </span>
                                      <span className="font-semibold text-emerald-400">+{formatCurrency(item.amount)}</span>
                                    </div>
                                  ))}
                                  <div className="flex justify-between text-xs font-bold pt-1 text-emerald-300">
                                    <span>Total Bruto:</span>
                                    <span>{formatCurrency(row.mCalc.effectiveGross)}</span>
                                  </div>
                                </div>

                                {/* Descontos */}
                                <div className="space-y-1 bg-slate-950/60 p-3 rounded-xl border border-rose-500/10">
                                  <span className="text-[10px] uppercase font-bold text-rose-400 block tracking-wider mb-1">
                                    Deduções & Retenções Fiscais
                                  </span>
                                  <div className="flex justify-between text-slate-300 py-0.5 border-b border-white/[0.03]">
                                    <span>INSS Previdência ({row.mCalc.inssEffectiveRate}%):</span>
                                    <span className="font-semibold text-rose-400">-{formatCurrency(row.mCalc.inssDiscount)}</span>
                                  </div>
                                  <div className="flex justify-between text-slate-300 py-0.5 border-b border-white/[0.03]">
                                    <span>IRRF Imposto ({row.mCalc.irrfEffectiveRate}%):</span>
                                    <span className="font-semibold text-rose-400">-{formatCurrency(row.mCalc.irrfDiscount)}</span>
                                  </div>
                                  {row.mDeductions.map((item) => (
                                    <div key={item.id} className="flex justify-between text-slate-300 py-0.5 border-b border-white/[0.03]">
                                      <span className="flex items-center gap-1.5">
                                        <span>{item.name}</span>
                                        <span className="text-[9px] text-slate-500">
                                          ({item.isRecurring || item.month === -1 ? 'folha fixa' : 'pontual do mês'})
                                        </span>
                                      </span>
                                      <span className="font-semibold text-rose-400">-{formatCurrency(item.amount)}</span>
                                    </div>
                                  ))}
                                  <div className="flex justify-between text-xs font-bold pt-1 text-rose-300">
                                    <span>Total Descontos:</span>
                                    <span>-{formatCurrency(row.mCalc.totalDeductions)}</span>
                                  </div>
                                </div>
                              </div>

                              {row.notes && (
                                <div className="p-2.5 bg-slate-950/60 rounded-xl border border-white/5 text-[11px] text-slate-400 flex items-start gap-2">
                                  <i className="fa-solid fa-note-sticky text-amber-400/80 mt-0.5"></i>
                                  <span><strong>Anotações deste mês:</strong> {row.notes}</span>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-white/10 bg-slate-900/60 font-bold text-slate-200">
                  <td className="py-3.5 px-3 uppercase tracking-wider text-[11px]" colSpan={2}>Total Anual</td>
                  <td className="py-3.5 px-3 text-right tabular-nums text-slate-400" colSpan={4}>
                    Projeção Total: {formatCurrency(annualTotals.projTotal)}
                  </td>
                  <td className="py-3.5 px-3 text-right tabular-nums text-slate-300">
                    {formatCurrency(annualTotals.projTotal)}
                  </td>
                  <td className="py-3.5 px-3 text-right tabular-nums text-emerald-400 text-sm">
                    {formatCurrency(annualTotals.realTotal)}
                  </td>
                  <td className="py-3.5 px-3 text-right tabular-nums" colSpan={3}>
                    <span className="text-[10px] text-slate-400">
                      {annualTotals.monthsWithReal > 0
                        ? `${annualTotals.monthsWithReal} meses realizados`
                        : 'Nenhum mês realizado'}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: 13º SALÁRIO & FÉRIAS */}
      {activeTab === 'thirteenth_vacation' && (
        <div className="space-y-6">
          {/* Top KPI Cards for 13th and Vacations */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Card 1: 13º Líquido Total */}
            <div className="glass-card p-5 rounded-3xl border border-white/[0.08] relative overflow-hidden bg-gradient-to-br from-slate-900/90 to-slate-900/50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  13º Salário Anual
                </span>
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-sm">
                  <i className="fa-solid fa-gift"></i>
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold text-white tabular-nums">
                  {formatCurrency(thirteenthCalculation.totalNet)}
                </span>
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-amber-300/90 font-medium">
                  <span>Bruto: {formatCurrency(thirteenthCalculation.effectiveGross)}</span>
                  <span>•</span>
                  <span>{thirteenthCalculation.monthsWorked}/12 avos</span>
                </div>
              </div>
            </div>

            {/* Card 2: 1ª Parcela 13º */}
            <div className="glass-card p-5 rounded-3xl border border-sky-500/20 bg-sky-500/5 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-sky-400 uppercase tracking-wider">
                  1ª Parcela ({MONTH_NAMES[thirteenthCalculation.firstInstallmentMonth]})
                </span>
                <div className="w-8 h-8 rounded-xl bg-sky-500/20 text-sky-400 flex items-center justify-center text-sm">
                  <i className="fa-solid fa-hand-holding-dollar"></i>
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold text-sky-300 tabular-nums">
                  {formatCurrency(
                    currentThirteenthConfig?.firstInstallmentReal !== null && currentThirteenthConfig?.firstInstallmentReal !== undefined
                      ? currentThirteenthConfig.firstInstallmentReal
                      : thirteenthCalculation.firstInstallmentNet
                  )}
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  {currentThirteenthConfig?.firstInstallmentTransactionId ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      <i className="fa-solid fa-circle-check"></i>
                      Lançado no Extrato
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium">
                      0% descontos fiscais (adiantamento)
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Card 3: 2ª Parcela 13º */}
            <div className="glass-card p-5 rounded-3xl border border-indigo-500/20 bg-indigo-500/5 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-indigo-400 uppercase tracking-wider">
                  2ª Parcela (Dezembro)
                </span>
                <div className="w-8 h-8 rounded-xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-sm">
                  <i className="fa-solid fa-receipt"></i>
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold text-indigo-300 tabular-nums">
                  {formatCurrency(
                    currentThirteenthConfig?.secondInstallmentReal !== null && currentThirteenthConfig?.secondInstallmentReal !== undefined
                      ? currentThirteenthConfig.secondInstallmentReal
                      : thirteenthCalculation.secondInstallmentNet
                  )}
                </span>
                <div className="flex items-center gap-1.5 mt-1">
                  {currentThirteenthConfig?.secondInstallmentTransactionId ? (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                      <i className="fa-solid fa-circle-check"></i>
                      Lançado no Extrato
                    </span>
                  ) : (
                    <span className="text-[10px] text-indigo-300/80 font-medium">
                      Retenção INSS e IRRF anual
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Card 4: Férias no Ano */}
            <div className="glass-card p-5 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-400 uppercase tracking-wider">
                  Férias Programadas
                </span>
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-sm">
                  <i className="fa-solid fa-umbrella-beach"></i>
                </div>
              </div>
              <div className="mt-3">
                <span className="text-2xl font-extrabold text-emerald-300 tabular-nums">
                  {formatCurrency(
                    currentYearVacations.reduce((acc, v) => {
                      const vCalc = calculateVacation(v, liveConfig, activeTaxTable, recurringItems);
                      return acc + (v.realAmount !== null && v.realAmount !== undefined ? v.realAmount : vCalc.totalVacationNet);
                    }, 0)
                  )}
                </span>
                <div className="flex items-center gap-1.5 mt-1 text-[10px] text-slate-400 font-medium">
                  <span>{currentYearVacations.length} período(s) cadastrado(s)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Feedback message for 13th */}
          {thirteenthSuccessMsg && (
            <div className="p-3.5 bg-emerald-500/15 border border-emerald-500/30 rounded-2xl text-xs text-emerald-300 flex items-center gap-2 animate-fadeIn">
              <i className="fa-solid fa-circle-check text-emerald-400 text-sm"></i>
              <span>{thirteenthSuccessMsg}</span>
            </div>
          )}

          {/* SECTION 1: 13º SALÁRIO (GRATIFICAÇÃO NATALINA) */}
          <div className="glass-card p-6 rounded-3xl border border-white/[0.08] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center text-lg shadow-sm">
                  <i className="fa-solid fa-gift"></i>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    13º Salário — Gratificação Natalina CLT
                    <span className="text-xs px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-semibold">
                      Ano {selectedYear}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Proporcionalidade de avos, adiantamento da 1ª parcela (sem descontos) e apuração com tributação exclusiva na 2ª parcela.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSaveThirteenthConfig}
                disabled={isSavingThirteenth}
                className="px-4 py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-amber-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSavingThirteenth ? (
                  <i className="fa-solid fa-spinner fa-spin"></i>
                ) : (
                  <i className="fa-solid fa-floppy-disk"></i>
                )}
                Salvar Parâmetros 13º
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: 13th Parameters Form (5 cols) */}
              <div className="lg:col-span-5 space-y-4">
                <div className="bg-slate-900/60 p-4 rounded-2xl border border-white/5 space-y-3">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <i className="fa-solid fa-sliders"></i>
                    Parâmetros de Cálculo do 13º
                  </h3>

                  {/* Meses Trabalhados (Avos) */}
                  <div>
                    <div className="flex justify-between items-center mb-1">
                      <label className="text-xs text-slate-300 font-semibold">
                        Meses Trabalhados no Ano (Avos)
                      </label>
                      <span className="text-xs font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/30">
                        {thirteenthMonthsWorked}/12 avos
                      </span>
                    </div>
                    <input
                      type="range"
                      min="1"
                      max="12"
                      step="1"
                      value={thirteenthMonthsWorked}
                      onChange={(e) => setThirteenthMonthsWorked(e.target.value)}
                      className="w-full accent-amber-400 cursor-pointer"
                    />
                    <div className="flex justify-between text-[10px] text-slate-500 mt-0.5">
                      <span>1 mês (admissão recente)</span>
                      <span>12 meses (ano integral)</span>
                    </div>
                  </div>

                  {/* Mês da 1ª Parcela */}
                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">
                      Mês de Pagamento da 1ª Parcela
                    </label>
                    <select
                      value={thirteenthFirstMonth}
                      onChange={(e) => setThirteenthFirstMonth(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                    >
                      {MONTH_NAMES.slice(1, 11).map((mName, idx) => (
                        <option key={idx + 1} value={idx + 1}>
                          {mName} (até dia {thirteenthFirstPayDay || 30})
                        </option>
                      ))}
                    </select>
                    <span className="text-[10px] text-slate-500 block mt-1">
                      CLT: pode ser pago entre fevereiro e 30 de novembro (ou junto às férias).
                    </span>
                  </div>

                  {/* Percentual da 1ª Parcela */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-slate-300 font-semibold block mb-1">
                        % da 1ª Parcela
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min="10"
                          max="90"
                          value={thirteenthFirstPercent}
                          onChange={(e) => setThirteenthFirstPercent(e.target.value)}
                          className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white pr-7"
                        />
                        <span className="absolute right-3 top-2 text-slate-400 text-xs font-bold">%</span>
                      </div>
                    </div>
                    <div>
                      <label className="text-xs text-slate-300 font-semibold block mb-1">
                        Dia Limite 1ª Parc.
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        value={thirteenthFirstPayDay}
                        onChange={(e) => setThirteenthFirstPayDay(e.target.value)}
                        className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>

                  {/* Dia Limite 2ª Parcela */}
                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">
                      Dia Limite 2ª Parcela (Dezembro)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="31"
                      value={thirteenthSecondPayDay}
                      onChange={(e) => setThirteenthSecondPayDay(e.target.value)}
                      className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                    />
                    <span className="text-[10px] text-slate-500 block mt-1">
                      CLT: pagamento legal obrigatório até 20 de dezembro.
                    </span>
                  </div>

                  {/* Observações */}
                  <div>
                    <label className="text-xs text-slate-300 font-semibold block mb-1">
                      Observações / Anotações
                    </label>
                    <textarea
                      rows={2}
                      value={thirteenthNotes}
                      onChange={(e) => setThirteenthNotes(e.target.value)}
                      placeholder="Ex: Admissão em março, primeira parcela antecipada nas férias de julho..."
                      className="w-full bg-slate-950/80 border border-white/10 rounded-xl px-3 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-amber-500 resize-none"
                    />
                  </div>
                </div>

                {/* Nota Legal Didática */}
                <div className="p-3.5 bg-slate-900/40 rounded-2xl border border-amber-500/20 text-xs text-slate-300 space-y-1.5">
                  <div className="font-bold text-amber-400 flex items-center gap-1.5">
                    <i className="fa-solid fa-circle-info"></i>
                    Como funciona a tributação do 13º?
                  </div>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    <strong>1ª Parcela:</strong> É um adiantamento puro de 50% do bruto proporcional, sem qualquer desconto de INSS ou Imposto de Renda.
                  </p>
                  <p className="text-[11px] text-slate-400 leading-relaxed">
                    <strong>2ª Parcela:</strong> Possui <strong>tributação exclusiva na fonte</strong>. O INSS e o IRRF são calculados sobre o valor anual total e deduzidos integralmente na 2ª parcela, sem se somar ao salário normal de dezembro.
                  </p>
                </div>
              </div>

              {/* Right Column: Mirror & Action Cards (7 cols) */}
              <div className="lg:col-span-7 space-y-4">
                {/* 1ª Parcela Demonstration Card */}
                <div className="bg-slate-900/70 p-4 rounded-2xl border border-sky-500/20 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
                      <h4 className="text-sm font-bold text-white">
                        1ª Parcela do 13º (Adiantamento)
                      </h4>
                      <span className="text-[10px] text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded font-mono font-semibold">
                        {MONTH_NAMES[thirteenthCalculation.firstInstallmentMonth]} / {selectedYear}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-sky-300">
                      Líquido Projetado: {formatCurrency(thirteenthCalculation.firstInstallmentNet)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5 space-y-1.5">
                      <div className="flex justify-between text-slate-300">
                        <span>Bruto Proporcional ({thirteenthCalculation.firstInstallmentPercentage}%):</span>
                        <span className="font-semibold text-white">{formatCurrency(thirteenthCalculation.firstInstallmentGross)}</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Dedução de INSS:</span>
                        <span className="text-emerald-400 font-semibold">R$ 0,00 (isento)</span>
                      </div>
                      <div className="flex justify-between text-slate-400">
                        <span>Retenção de IRRF:</span>
                        <span className="text-emerald-400 font-semibold">R$ 0,00 (isento)</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-white/5 text-sky-300 font-bold">
                        <span>Valor Líquido:</span>
                        <span>{formatCurrency(thirteenthCalculation.firstInstallmentNet)}</span>
                      </div>
                    </div>

                    <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5 space-y-2">
                      <span className="text-[11px] font-semibold text-slate-300 block">
                        Conferência Real & Lançamento
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Valor Real (R$)</label>
                          <input
                            type="text"
                            placeholder={formatCurrency(thirteenthCalculation.firstInstallmentNet).replace('R$', '').trim()}
                            value={thirteenthFirstReal}
                            onChange={(e) => setThirteenthFirstReal(e.target.value)}
                            className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Data Pagamento</label>
                          <input
                            type="date"
                            value={thirteenthFirstDate}
                            onChange={(e) => setThirteenthFirstDate(e.target.value)}
                            className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handlePushThirteenth1stToExtrato}
                        className="w-full py-1.5 bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/40 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                        {currentThirteenthConfig?.firstInstallmentTransactionId ? 'Re-lançar 1ª Parcela no Extrato' : 'Lançar 1ª Parcela no Extrato'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2ª Parcela Demonstration Card */}
                <div className="bg-slate-900/70 p-4 rounded-2xl border border-indigo-500/20 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 pb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-indigo-400"></span>
                      <h4 className="text-sm font-bold text-white">
                        2ª Parcela do 13º (Quitação Final CLT)
                      </h4>
                      <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded font-mono font-semibold">
                        Dezembro / {selectedYear}
                      </span>
                    </div>
                    <span className="text-xs font-bold text-indigo-300">
                      Líquido Projetado: {formatCurrency(thirteenthCalculation.secondInstallmentNet)}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5 space-y-1.5">
                      <div className="flex justify-between text-slate-300">
                        <span>Bruto Integral ({thirteenthCalculation.monthsWorked}/12):</span>
                        <span className="font-semibold text-white">{formatCurrency(thirteenthCalculation.secondInstallmentGross)}</span>
                      </div>
                      <div className="flex justify-between text-rose-400">
                        <span>(-) INSS 13º ({thirteenthCalculation.inssEffectiveRate}%):</span>
                        <span className="font-semibold">-{formatCurrency(thirteenthCalculation.inssDiscount)}</span>
                      </div>
                      <div className="flex justify-between text-rose-400">
                        <span>(-) IRRF 13º ({thirteenthCalculation.irrfEffectiveRate}%):</span>
                        <span className="font-semibold">-{formatCurrency(thirteenthCalculation.irrfDiscount)}</span>
                      </div>
                      <div className="flex justify-between text-sky-400">
                        <span>(-) Adiantamento 1ª Parcela:</span>
                        <span className="font-semibold">-{formatCurrency(thirteenthCalculation.firstInstallmentGross)}</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-white/5 text-indigo-300 font-bold">
                        <span>Saldo Líquido da 2ª Parcela:</span>
                        <span>{formatCurrency(thirteenthCalculation.secondInstallmentNet)}</span>
                      </div>
                    </div>

                    <div className="bg-slate-950/60 p-3 rounded-xl border border-white/5 space-y-2">
                      <span className="text-[11px] font-semibold text-slate-300 block">
                        Conferência Real & Lançamento
                      </span>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Valor Real (R$)</label>
                          <input
                            type="text"
                            placeholder={formatCurrency(thirteenthCalculation.secondInstallmentNet).replace('R$', '').trim()}
                            value={thirteenthSecondReal}
                            onChange={(e) => setThirteenthSecondReal(e.target.value)}
                            className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-600"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-slate-400 block mb-0.5">Data Pagamento</label>
                          <input
                            type="date"
                            value={thirteenthSecondDate}
                            onChange={(e) => setThirteenthSecondDate(e.target.value)}
                            className="w-full bg-slate-900 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={handlePushThirteenth2ndToExtrato}
                        className="w-full py-1.5 bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <i className="fa-solid fa-arrow-up-right-from-square text-[10px]"></i>
                        {currentThirteenthConfig?.secondInstallmentTransactionId ? 'Re-lançar 2ª Parcela no Extrato' : 'Lançar 2ª Parcela no Extrato'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: FÉRIAS CLT (+ 1/3 CONSTITUCIONAL) */}
          <div className="glass-card p-6 rounded-3xl border border-white/[0.08] space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/[0.08] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center text-lg shadow-sm">
                  <i className="fa-solid fa-umbrella-beach"></i>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    Programação de Férias (+ 1/3 Constitucional)
                    <span className="text-xs px-2 py-0.5 rounded-full bg-teal-500/15 text-teal-300 border border-teal-500/30 font-semibold">
                      Ano {selectedYear}
                    </span>
                  </h2>
                  <p className="text-xs text-slate-400">
                    Cálculo CLT, abono pecuniário (venda de dias 100% isenta de impostos), data limite de depósito e impacto no salário residual do mês de retorno.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleOpenNewVacation}
                className="px-4 py-2 bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-600/20 flex items-center gap-2 cursor-pointer"
              >
                <i className="fa-solid fa-plus"></i>
                Programar Novas Férias
              </button>
            </div>

            {vacationSuccessMsg && (
              <div className="p-3.5 bg-teal-500/15 border border-teal-500/30 rounded-2xl text-xs text-teal-300 flex items-center gap-2 animate-fadeIn">
                <i className="fa-solid fa-circle-check text-teal-400 text-sm"></i>
                <span>{vacationSuccessMsg}</span>
              </div>
            )}

            {/* Vacations List */}
            {currentYearVacations.length === 0 ? (
              <div className="text-center py-12 px-4 rounded-3xl bg-slate-900/40 border border-dashed border-white/10 space-y-3">
                <div className="w-14 h-14 rounded-3xl bg-teal-500/10 text-teal-400 flex items-center justify-center text-2xl mx-auto">
                  <i className="fa-solid fa-umbrella-beach"></i>
                </div>
                <h3 className="text-base font-bold text-white">Nenhuma programação de férias para {selectedYear}</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Planeje seu descanso remunerado com o terço constitucional, simule a venda de até 10 dias (abono pecuniário sem impostos) e acompanhe os depósitos no extrato.
                </p>
                <button
                  type="button"
                  onClick={handleOpenNewVacation}
                  className="mt-2 px-4 py-2 bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40 rounded-xl text-xs font-bold transition-all inline-flex items-center gap-2 cursor-pointer"
                >
                  <i className="fa-solid fa-plus"></i>
                  Criar Primeiro Período de Férias
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {currentYearVacations.map((vac) => {
                  const vacCalc = calculateVacation(vac, liveConfig, activeTaxTable, recurringItems);
                  const isLinked = Boolean(vac.transactionId);

                  return (
                    <div
                      key={vac.id}
                      className="bg-slate-900/80 p-5 rounded-3xl border border-white/[0.08] hover:border-teal-500/30 transition-all space-y-4 shadow-sm"
                    >
                      {/* Header of Card */}
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className="text-sm font-bold text-white">
                              {vac.vacationDays} dias de férias
                            </span>
                            {vac.sellDays > 0 && (
                              <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full" title="Súmula 386/STJ: Totalmente isento de IRRF e INSS">
                                +{vac.sellDays}d vendidos (Abono Isento)
                              </span>
                            )}
                            {vac.advanceThirteenth && (
                              <span className="text-[10px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30 px-2 py-0.5 rounded-full">
                                + 1ª Parc. 13º Adiantada
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-slate-400 flex items-center gap-1.5">
                            <i className="fa-solid fa-calendar-day text-teal-400 text-xs"></i>
                            Início em: <strong className="text-white">{vac.startDate || 'Não informado'}</strong>
                          </p>
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleEditVacation(vac)}
                            className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
                            title="Editar férias"
                          >
                            <i className="fa-solid fa-pencil"></i>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteVacation(vac.id)}
                            className="w-8 h-8 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 flex items-center justify-center text-xs transition-colors cursor-pointer"
                            title="Excluir férias"
                          >
                            <i className="fa-solid fa-trash"></i>
                          </button>
                        </div>
                      </div>

                      {/* Financial Figures Breakdown */}
                      <div className="bg-slate-950/60 p-3.5 rounded-2xl border border-white/5 space-y-1.5 text-xs">
                        <div className="flex justify-between text-slate-300">
                          <span>Remuneração {vac.vacationDays}d + 1/3 Const.:</span>
                          <span className="font-semibold text-white">
                            {formatCurrency(vacCalc.vacationPay + vacCalc.oneThirdPay)}
                          </span>
                        </div>

                        <div className="flex justify-between text-rose-400">
                          <span>(-) Deduções Fiscais (INSS/IRRF s/ férias):</span>
                          <span className="font-semibold">
                            -{formatCurrency(vacCalc.inssDiscount + vacCalc.irrfDiscount)}
                          </span>
                        </div>

                        {vac.sellDays > 0 && (
                          <div className="flex justify-between text-emerald-400">
                            <span>(+) Abono Pecuniário ({vac.sellDays}d + 1/3) [Isento]:</span>
                            <span className="font-semibold">
                              +{formatCurrency(vacCalc.abonoPay + vacCalc.abonoOneThirdPay)}
                            </span>
                          </div>
                        )}

                        {vac.advanceThirteenth && (
                          <div className="flex justify-between text-sky-400">
                            <span>(+) Adiantamento da 1ª Parcela do 13º:</span>
                            <span className="font-semibold">
                              +{formatCurrency(vacCalc.thirteenthAdvance)}
                            </span>
                          </div>
                        )}

                        <div className="flex justify-between pt-2 border-t border-white/10 text-emerald-300 font-extrabold text-sm">
                          <span>Total Líquido do Recibo:</span>
                          <span>
                            {formatCurrency(
                              vac.realAmount !== null && vac.realAmount !== undefined
                                ? vac.realAmount
                                : vacCalc.totalVacationNet
                            )}
                          </span>
                        </div>
                      </div>

                      {/* Residual Salary Notice & Payment Deadline */}
                      <div className="space-y-1.5 text-[11px]">
                        <div className="p-2.5 bg-amber-500/10 rounded-xl border border-amber-500/20 text-amber-300 flex items-start gap-2">
                          <i className="fa-solid fa-triangle-exclamation text-amber-400 mt-0.5"></i>
                          <div>
                            <strong>Saldo Residual de Salário:</strong> No mês de retorno, o pagamento normal será de aprox.{' '}
                            <span className="font-bold underline">{formatCurrency(vacCalc.residualSalaryInMonth)}</span>{' '}
                            (referente aos {30 - vac.vacationDays} dias trabalhados restantes).
                          </div>
                        </div>

                        <div className="flex justify-between items-center text-slate-400 px-1 pt-1">
                          <span>Data limite CLT: <strong>{vacCalc.paymentLimitDate || '2 dias antes'}</strong></span>
                          <span>Pagamento em: <strong>{vac.paymentDate || 'Previsto'}</strong></span>
                        </div>
                      </div>

                      {/* Actions */}
                      <button
                        type="button"
                        onClick={() => handlePushVacationToExtrato(vac)}
                        className={`w-full py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                          isLinked
                            ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/25'
                            : 'bg-teal-500/20 hover:bg-teal-500/30 text-teal-300 border border-teal-500/40'
                        }`}
                      >
                        <i className="fa-solid fa-arrow-up-right-from-square"></i>
                        {isLinked ? 'Re-lançar Férias no Extrato' : 'Lançar Férias no Extrato (1 Clique)'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* VACATION MODAL (PROGRAMAR / EDITAR FÉRIAS) */}
      {isVacationModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto custom-scrollbar">
          <div className="glass-card max-w-xl w-full max-h-[92vh] overflow-y-auto custom-scrollbar rounded-3xl border border-white/10 p-5 sm:p-6 space-y-5 shadow-2xl relative my-auto bg-slate-950/95">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center text-lg">
                  <i className="fa-solid fa-umbrella-beach"></i>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">
                    {editingVacation ? 'Editar Programação de Férias' : 'Programar Novas Férias CLT'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Ano de gozo: {selectedYear}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsVacationModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark"></i>
              </button>
            </div>

            {/* Modal Form Fields */}
            <div className="space-y-4">
              {/* Dias de Férias e Venda */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Dias de Gozo (Descanso)
                  </label>
                  <select
                    value={vacDaysInput}
                    onChange={(e) => setVacDaysInput(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="30">30 dias (férias integrais)</option>
                    <option value="20">20 dias</option>
                    <option value="15">15 dias</option>
                    <option value="10">10 dias</option>
                    <option value="5">5 dias</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Venda de Férias (Abono)
                  </label>
                  <select
                    value={vacSellDaysInput}
                    onChange={(e) => setVacSellDaysInput(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="0">Não vender dias (0d)</option>
                    <option value="5">Vender 5 dias</option>
                    <option value="10">Vender 10 dias (Máximo CLT)</option>
                  </select>
                </div>
              </div>

              {/* Destaque Abono Isento */}
              {parseInt(vacSellDaysInput, 10) > 0 && (
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/25 text-xs text-emerald-300 flex items-start gap-2">
                  <i className="fa-solid fa-shield-halved text-emerald-400 mt-0.5"></i>
                  <div>
                    <strong>Isenção Tributária Confirmada (Súmula 386/STJ):</strong> A venda de {vacSellDaysInput} dias e seu 1/3 respectivo são 100% livres de INSS e Imposto de Renda!
                  </div>
                </div>
              )}

              {/* Data de Início das Férias */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Data de Início das Férias
                </label>
                <input
                  type="date"
                  value={vacStartDateInput}
                  onChange={(e) => setVacStartDateInput(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                />
                <span className="text-[10px] text-slate-500 block mt-1">
                  Data limite CLT para depósito: <strong>{vacationPreviewCalculation.paymentLimitDate || '2 dias antes do início'}</strong>
                </span>
              </div>

              {/* Checkbox Adiantamento 13º */}
              <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-slate-200 block">
                    Adiantar 1ª Parcela do 13º Salário
                  </span>
                  <span className="text-[10px] text-slate-400">
                    Art. 2º da Lei 4.749/65: 50% bruto pago junto com o recibo de férias
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={vacAdvanceThirteenth}
                  onChange={(e) => setVacAdvanceThirteenth(e.target.checked)}
                  className="w-4 h-4 rounded text-teal-500 accent-teal-500 cursor-pointer"
                />
              </div>

              {/* Live Preview of Vacation Calculation */}
              <div className="bg-slate-900/90 p-4 rounded-2xl border border-teal-500/20 space-y-2 text-xs">
                <span className="text-[11px] font-bold uppercase tracking-wider text-teal-400 block">
                  Demonstrativo do Recibo de Férias
                </span>

                <div className="flex justify-between text-slate-300">
                  <span>Remuneração {vacDaysInput}d + 1/3 Constitucional:</span>
                  <span className="font-semibold text-white">
                    {formatCurrency(vacationPreviewCalculation.vacationPay + vacationPreviewCalculation.oneThirdPay)}
                  </span>
                </div>

                <div className="flex justify-between text-rose-400">
                  <span>(-) Deduções de INSS e IRRF sobre férias:</span>
                  <span className="font-semibold">
                    -{formatCurrency(vacationPreviewCalculation.inssDiscount + vacationPreviewCalculation.irrfDiscount)}
                  </span>
                </div>

                {parseInt(vacSellDaysInput, 10) > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>(+) Abono Pecuniário ({vacSellDaysInput}d + 1/3) [Isento]:</span>
                    <span className="font-semibold">
                      +{formatCurrency(vacationPreviewCalculation.abonoPay + vacationPreviewCalculation.abonoOneThirdPay)}
                    </span>
                  </div>
                )}

                {vacAdvanceThirteenth && (
                  <div className="flex justify-between text-sky-400">
                    <span>(+) 1ª Parcela do 13º Salário:</span>
                    <span className="font-semibold">
                      +{formatCurrency(vacationPreviewCalculation.thirteenthAdvance)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between pt-2 border-t border-white/10 text-teal-300 font-extrabold text-sm">
                  <span>Total Líquido Estimado a Receber:</span>
                  <span>{formatCurrency(vacationPreviewCalculation.totalVacationNet)}</span>
                </div>
              </div>

              {/* Informação do Saldo Residual do Mês */}
              <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5 text-[11px] text-slate-400">
                <span>Saldo residual no mês de retorno: </span>
                <strong className="text-white">
                  {formatCurrency(vacationPreviewCalculation.residualSalaryInMonth)}
                </strong>
                <span> (referente aos {30 - parseInt(vacDaysInput, 10)} dias restantes).</span>
              </div>

              {/* Campos Reais Opcionais */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-white/10">
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Valor Real Recebido (R$)
                  </label>
                  <input
                    type="text"
                    placeholder={formatCurrency(vacationPreviewCalculation.totalVacationNet).replace('R$', '').trim()}
                    value={vacRealAmountInput}
                    onChange={(e) => setVacRealAmountInput(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                    Data do Pagamento Real
                  </label>
                  <input
                    type="date"
                    value={vacPaymentDateInput}
                    onChange={(e) => setVacPaymentDateInput(e.target.value)}
                    className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
              </div>

              {/* Anotações */}
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Anotações
                </label>
                <input
                  type="text"
                  placeholder="Ex: Viagem em família, reserva de hotel..."
                  value={vacNotesInput}
                  onChange={(e) => setVacNotesInput(e.target.value)}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex justify-end gap-2.5 pt-4 border-t border-white/10">
              <button
                type="button"
                onClick={() => setIsVacationModalOpen(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveVacation}
                disabled={isSavingVacation}
                className="px-5 py-2 bg-gradient-to-r from-teal-600 to-emerald-500 hover:from-teal-500 hover:to-emerald-400 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-teal-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {isSavingVacation ? (
                  <i className="fa-solid fa-spinner fa-spin"></i>
                ) : (
                  <i className="fa-solid fa-check"></i>
                )}
                Salvar Programação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAX TABLES CONFIGURATION MODAL */}
      {isTaxModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto custom-scrollbar">
          <div className="glass-card max-w-4xl w-full max-h-[92vh] overflow-y-auto custom-scrollbar rounded-3xl border border-white/10 p-5 sm:p-7 space-y-6 shadow-2xl relative my-auto bg-slate-950/95">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-lg shadow-sm">
                  <i className="fa-solid fa-scale-balanced"></i>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Tabelas Fiscais & Alíquotas Oficiais</h2>
                  <p className="text-xs text-slate-400">
                    Configuração de faixas, tetos e deduções legais de INSS e IRRF por ano
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsTaxModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <i className="fa-solid fa-xmark text-sm"></i>
              </button>
            </div>

            {/* Year Selector Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900/80 p-2 rounded-2xl border border-white/5">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-400 mr-1 pl-1">Ano Fiscal:</span>
                {[2026, 2025, 2024].map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setModalTaxYear(yr)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      modalTaxYear === yr
                        ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20'
                        : 'text-slate-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {yr} {yr === 2026 ? '(Vigente)' : ''}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetModalTaxTable}
                  disabled={isSavingTaxTable}
                  className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-semibold transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  title="Restaurar tabela para os valores originais da Receita Federal"
                >
                  <i className="fa-solid fa-rotate-left text-[10px]"></i>
                  Restaurar Padrão Oficial
                </button>
              </div>
            </div>

            {taxSuccessMsg && (
              <div className="p-3 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 flex items-center gap-2 animate-fadeIn">
                <i className="fa-solid fa-circle-check"></i>
                {taxSuccessMsg}
              </div>
            )}

            {/* INSS Configuration Section */}
            <div className="space-y-3 bg-slate-900/60 p-4 sm:p-5 rounded-2xl border border-white/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                  <h3 className="font-bold text-white text-sm">INSS - Previdência Social ({modalTaxYear})</h3>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-xs text-slate-400">Teto Máximo de Contribuição (R$):</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      value={modalTableData.inssCeiling}
                      onChange={(e) =>
                        setModalTableData((prev) => ({
                          ...prev,
                          inssCeiling: parseFloat(e.target.value) || 0,
                        }))
                      }
                      className="w-32 bg-slate-950 border border-white/10 rounded-xl pl-8 pr-2.5 py-1 text-white text-xs font-bold focus:border-emerald-500 focus:outline-none tabular-nums"
                    />
                  </div>
                </div>
              </div>

              {/* INSS Brackets Table */}
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="text-slate-400 uppercase tracking-wider text-[10px] border-b border-white/5">
                      <th className="py-2 px-2">Faixa</th>
                      <th className="py-2 px-2">De (R$)</th>
                      <th className="py-2 px-2">Até (R$)</th>
                      <th className="py-2 px-2 text-right">Alíquota (%)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {modalTableData.inssBrackets.map((b, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="py-2 px-2 font-bold text-slate-300">Faixa {idx + 1}</td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="0.01"
                            value={b.min}
                            onChange={(e) =>
                              updateInssBracket(idx, 'min', parseFloat(e.target.value) || 0)
                            }
                            className="w-28 bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-white text-xs font-semibold focus:border-emerald-500 focus:outline-none tabular-nums"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="0.01"
                            value={b.max !== null ? b.max : ''}
                            placeholder="Sem teto"
                            onChange={(e) =>
                              updateInssBracket(
                                idx,
                                'max',
                                e.target.value.trim() !== '' ? parseFloat(e.target.value) : null
                              )
                            }
                            className="w-28 bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-white text-xs font-semibold focus:border-emerald-500 focus:outline-none tabular-nums"
                          />
                        </td>
                        <td className="py-2 px-2 text-right">
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              step="0.1"
                              value={b.rate}
                              onChange={(e) =>
                                updateInssBracket(idx, 'rate', parseFloat(e.target.value) || 0)
                              }
                              className="w-20 bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-white text-xs font-bold text-right focus:border-emerald-500 focus:outline-none tabular-nums"
                            />
                            <span className="text-slate-400 font-bold">%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* IRRF Configuration Section */}
            <div className="space-y-3 bg-slate-900/60 p-4 sm:p-5 rounded-2xl border border-white/5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-sky-400"></span>
                  <h3 className="font-bold text-white text-sm">IRRF - Imposto de Renda Retido na Fonte ({modalTaxYear})</h3>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-xs">
                  <div className="flex items-center gap-2">
                    <label className="text-slate-400">Dedução p/ Dependente:</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={modalTableData.irrfDependentDeduction}
                        onChange={(e) =>
                          setModalTableData((prev) => ({
                            ...prev,
                            irrfDependentDeduction: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="w-28 bg-slate-950 border border-white/10 rounded-xl pl-8 pr-2 py-1 text-white text-xs font-bold focus:border-emerald-500 focus:outline-none tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-slate-400">Desconto Simplificado:</label>
                    <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-bold">R$</span>
                      <input
                        type="number"
                        step="0.01"
                        value={modalTableData.irrfSimplifiedDiscount}
                        onChange={(e) =>
                          setModalTableData((prev) => ({
                            ...prev,
                            irrfSimplifiedDiscount: parseFloat(e.target.value) || 0,
                          }))
                        }
                        className="w-28 bg-slate-950 border border-white/10 rounded-xl pl-8 pr-2 py-1 text-white text-xs font-bold focus:border-emerald-500 focus:outline-none tabular-nums"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* IRRF Brackets Table */}
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="text-slate-400 uppercase tracking-wider text-[10px] border-b border-white/5">
                      <th className="py-2 px-2">Faixa</th>
                      <th className="py-2 px-2">De (R$)</th>
                      <th className="py-2 px-2">Até (R$)</th>
                      <th className="py-2 px-2 text-right">Alíquota (%)</th>
                      <th className="py-2 px-2 text-right">Parcela a Deduzir (R$)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {modalTableData.irrfBrackets.map((b, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02]">
                        <td className="py-2 px-2 font-bold text-slate-300">Faixa {idx + 1}</td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="0.01"
                            value={b.min}
                            onChange={(e) =>
                              updateIrrfBracket(idx, 'min', parseFloat(e.target.value) || 0)
                            }
                            className="w-28 bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-white text-xs font-semibold focus:border-emerald-500 focus:outline-none tabular-nums"
                          />
                        </td>
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="0.01"
                            value={b.max !== null ? b.max : ''}
                            placeholder="Sem teto"
                            onChange={(e) =>
                              updateIrrfBracket(
                                idx,
                                'max',
                                e.target.value.trim() !== '' ? parseFloat(e.target.value) : null
                              )
                            }
                            className="w-28 bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-white text-xs font-semibold focus:border-emerald-500 focus:outline-none tabular-nums"
                          />
                        </td>
                        <td className="py-2 px-2 text-right">
                          <div className="inline-flex items-center gap-1">
                            <input
                              type="number"
                              step="0.1"
                              value={b.rate}
                              onChange={(e) =>
                                updateIrrfBracket(idx, 'rate', parseFloat(e.target.value) || 0)
                              }
                              className="w-20 bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-white text-xs font-bold text-right focus:border-emerald-500 focus:outline-none tabular-nums"
                            />
                            <span className="text-slate-400 font-bold">%</span>
                          </div>
                        </td>
                        <td className="py-2 px-2 text-right">
                          <div className="inline-flex items-center gap-1">
                            <span className="text-slate-500 text-xs">R$</span>
                            <input
                              type="number"
                              step="0.01"
                              value={b.deduction}
                              onChange={(e) =>
                                updateIrrfBracket(idx, 'deduction', parseFloat(e.target.value) || 0)
                              }
                              className="w-28 bg-slate-950 border border-white/10 rounded-lg px-2 py-1 text-white text-xs font-bold text-right focus:border-emerald-500 focus:outline-none tabular-nums"
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Bottom Actions */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-white/10">
              <button
                type="button"
                onClick={() => {
                  setTaxYearInput(modalTaxYear);
                  setIsTaxModalOpen(false);
                }}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold text-slate-300 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <i className="fa-solid fa-check text-emerald-400"></i>
                Aplicar Ano {modalTaxYear} ao Contrato Ativo
              </button>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsTaxModalOpen(false)}
                  className="flex-1 sm:flex-none px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white text-xs font-bold transition-all cursor-pointer"
                >
                  Fechar
                </button>

                <button
                  type="button"
                  onClick={handleSaveModalTaxTable}
                  disabled={isSavingTaxTable}
                  className="flex-1 sm:flex-none px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingTaxTable ? (
                    <>
                      <i className="fa-solid fa-circle-notch fa-spin"></i>
                      Salvando...
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-floppy-disk"></i>
                      Salvar Tabela de {modalTaxYear}
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default SalaryManagement;
