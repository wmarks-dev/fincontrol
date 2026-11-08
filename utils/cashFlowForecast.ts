import {
  Transaction,
  CreditCard,
  CardMonthlyClosing,
  Bill,
  BillPayment,
  BillMonthlyAmount,
  RecurringTransaction,
  TransactionType,
  PaymentMethod,
  SalaryConfig,
  SalaryMonthlyRecord,
  SalaryThirteenthConfig,
  SalaryVacationConfig,
  TaxTableConfig,
  SalaryItemizedEntry,
} from '../types';
import { calculateSalary, calculateThirteenthSalary, calculateVacation } from './salaryCalculator';
import {
  parseISODateAsUTC,
  getEffectiveDueDate,
  clampDay,
  getDaysInMonth,
} from './dateUtils';

export interface SimulatedScenario {
  id: string;
  title: string;
  amount: number;
  type: 'income' | 'expense';
  date: string; // 'YYYY-MM-DD'
  installments?: number; // 1 to 24
  enabled: boolean;
  category?: string;
}

export type ForecastSource =
  | 'scheduled_transaction'
  | 'credit_card_bill'
  | 'bill'
  | 'recurring'
  | 'simulation'
  | 'salary';

export interface ForecastEvent {
  id: string;
  date: string; // 'YYYY-MM-DD'
  formattedDate: string; // 'DD/MM'
  title: string;
  description?: string;
  amount: number; // positive for income, negative for expense
  type: 'income' | 'expense';
  source: ForecastSource;
  category?: string;
  cardName?: string;
  isSimulated?: boolean;
}

export interface DayForecastPoint {
  date: string; // 'YYYY-MM-DD'
  formattedDate: string; // 'DD/MM'
  dayOfWeek: string; // 'Seg', 'Ter', etc.
  dayOfMonth: number;
  balance: number;
  inflows: number;
  outflows: number;
  netChange: number;
  events: ForecastEvent[];
  isNegative: boolean;
}

export interface CashFlowForecastResult {
  startBalance: number;
  endBalance: number;
  netChange: number;
  minBalance: number;
  minBalanceDate: string;
  maxBalance: number;
  maxBalanceDate: string;
  totalInflows: number;
  totalOutflows: number;
  daysNegativeCount: number;
  hasRiskOfNegative: boolean;
  firstNegativeDate: string | null;
  dailyPoints: DayForecastPoint[];
  allEvents: ForecastEvent[];
  groupedByDate: Map<string, ForecastEvent[]>;
}

export interface CashFlowForecastOptions {
  currentAccountBalance: number;
  currentSavingsBalance?: number;
  includeSavings?: boolean;
  horizonDays?: number; // 15, 30, 60, 90, 180
  targetEndDate?: Date; // Custom end date
  transactions: Transaction[];
  creditCards: CreditCard[];
  cardMonthlyClosings?: CardMonthlyClosing[];
  bills: Bill[];
  billPayments: BillPayment[];
  billMonthlyAmounts?: BillMonthlyAmount[];
  recurringTransactions: RecurringTransaction[];
  simulatedScenarios?: SimulatedScenario[];
  salaryConfig?: SalaryConfig | null;
  salaryMonthlyRecords?: SalaryMonthlyRecord[];
  salaryThirteenthConfigs?: SalaryThirteenthConfig[];
  salaryVacationConfigs?: SalaryVacationConfig[];
  salaryTaxTables?: TaxTableConfig[];
  salaryItemizedEntries?: SalaryItemizedEntry[];
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

/**
 * Calculates the daily cash flow and balance forecast.
 */
export function calculateCashFlowForecast({
  currentAccountBalance,
  currentSavingsBalance = 0,
  includeSavings = false,
  horizonDays = 30,
  targetEndDate,
  transactions,
  creditCards,
  cardMonthlyClosings = [],
  bills,
  billPayments,
  billMonthlyAmounts = [],
  recurringTransactions,
  simulatedScenarios = [],
  salaryConfig,
  salaryMonthlyRecords = [],
  salaryThirteenthConfigs = [],
  salaryVacationConfigs = [],
  salaryTaxTables = [],
  salaryItemizedEntries = [],
}: CashFlowForecastOptions): CashFlowForecastResult {
  const localToday = new Date();
  const todayUTC = new Date(
    Date.UTC(localToday.getFullYear(), localToday.getMonth(), localToday.getDate(), 0, 0, 0)
  );
  const endOfTodayUTC = new Date(
    Date.UTC(localToday.getFullYear(), localToday.getMonth(), localToday.getDate(), 23, 59, 59, 999)
  );

  // Determine forecast end date
  let endDateUTC: Date;
  if (targetEndDate) {
    endDateUTC = new Date(
      Date.UTC(targetEndDate.getUTCFullYear(), targetEndDate.getUTCMonth(), targetEndDate.getUTCDate(), 23, 59, 59, 999)
    );
  } else {
    endDateUTC = new Date(todayUTC);
    endDateUTC.setUTCDate(endDateUTC.getUTCDate() + horizonDays);
    endDateUTC.setUTCHours(23, 59, 59, 999);
  }

  const initialBalance = includeSavings
    ? currentAccountBalance + currentSavingsBalance
    : currentAccountBalance;

  const events: ForecastEvent[] = [];
  const cardsById = new Map(creditCards.map((c) => [c.id, c]));

  // 1. Process Credit Card Future Invoices
  // Group all credit card expenses by (cardId + effectiveDueDate)
  const cardInvoicesMap = new Map<
    string,
    {
      card: CreditCard;
      dueDate: Date;
      total: number;
      txCount: number;
      sampleDescriptions: string[];
    }
  >();

  transactions.forEach((t) => {
    if (t.category === 'transfer') return;
    if (t.type !== TransactionType.EXPENSE) return;
    if (t.paymentMethod !== PaymentMethod.CREDIT_CARD && !t.creditCardId) return;
    if (!t.creditCardId) return;

    const card = cardsById.get(t.creditCardId);
    if (!card) return;

    const tDate = parseISODateAsUTC(t.date);
    if (isNaN(tDate.getTime())) return;

    const dueDate = getEffectiveDueDate(t, card, cardMonthlyClosings);
    if (isNaN(dueDate.getTime())) return;

    // Only consider invoices due strictly in the future
    if (dueDate > endOfTodayUTC && dueDate <= endDateUTC) {
      const key = `${card.id}_${dueDate.toISOString().split('T')[0]}`;
      if (!cardInvoicesMap.has(key)) {
        cardInvoicesMap.set(key, {
          card,
          dueDate,
          total: 0,
          txCount: 0,
          sampleDescriptions: [],
        });
      }
      const inv = cardInvoicesMap.get(key)!;
      inv.total += t.amount;
      inv.txCount += 1;
      if (inv.sampleDescriptions.length < 3) {
        inv.sampleDescriptions.push(t.description);
      }
    }
  });

  // Convert credit card invoices into forecast events
  cardInvoicesMap.forEach((inv, key) => {
    const dateStr = inv.dueDate.toISOString().split('T')[0];
    const [year, month, day] = dateStr.split('-');
    const formattedDate = `${day}/${month}`;
    const descSample =
      inv.sampleDescriptions.length > 0
        ? ` (${inv.sampleDescriptions.join(', ')}${inv.txCount > inv.sampleDescriptions.length ? '...' : ''})`
        : '';

    events.push({
      id: `cc_bill_${key}`,
      date: dateStr,
      formattedDate,
      title: `Fatura ${inv.card.name}`,
      description: `${inv.txCount} compra${inv.txCount > 1 ? '' : 's'}${descSample}`,
      amount: -inv.total,
      type: 'expense',
      source: 'credit_card_bill',
      cardName: inv.card.name,
      category: 'credit_card',
    });
  });

  // 2. Process Scheduled Non-Credit-Card Transactions (Incomes & Cash/Debit/Pix Expenses)
  transactions.forEach((t) => {
    if (t.category === 'transfer') return;
    const tDate = parseISODateAsUTC(t.date);
    if (isNaN(tDate.getTime())) return;

    // Must be strictly after today and within horizon
    if (tDate <= endOfTodayUTC || tDate > endDateUTC) return;

    // If it's a credit card expense, it was already factored into invoice grouping
    if (t.type === TransactionType.EXPENSE && (t.paymentMethod === PaymentMethod.CREDIT_CARD || t.creditCardId)) {
      return;
    }

    const dateStr = tDate.toISOString().split('T')[0];
    const [year, month, day] = dateStr.split('-');
    const formattedDate = `${day}/${month}`;

    events.push({
      id: `tx_${t.id}`,
      date: dateStr,
      formattedDate,
      title: t.description || (t.type === TransactionType.INCOME ? 'Receita Agendada' : 'Despesa Agendada'),
      description: t.paymentMethod,
      amount: t.type === TransactionType.INCOME ? t.amount : -t.amount,
      type: t.type === TransactionType.INCOME ? 'income' : 'expense',
      source: 'scheduled_transaction',
      category: t.category,
    });
  });

  // 3. Process Active Unpaid Bills (Contas Fixas)
  const activeBills = bills.filter((b) => b.status === 'active');
  const startYear = todayUTC.getUTCFullYear();
  const startMonth = todayUTC.getUTCMonth();
  const endYear = endDateUTC.getUTCFullYear();
  const endMonth = endDateUTC.getUTCMonth();

  for (let y = startYear; y <= endYear; y++) {
    const mStart = y === startYear ? startMonth : 0;
    const mEnd = y === endYear ? endMonth : 11;

    for (let m = mStart; m <= mEnd; m++) {
      activeBills.forEach((bill) => {
        // Check if bill has start date restrictions
        if (bill.startYear !== undefined && bill.startMonth !== undefined) {
          if (y < bill.startYear || (y === bill.startYear && m < bill.startMonth)) {
            return;
          }
        }

        // Check if bill was already paid in this specific year/month
        const isPaid = billPayments.some(
          (bp) => bp.billId === bill.id && bp.year === y && bp.month === m
        );
        if (isPaid) return;

        // Build bill due date
        const day = clampDay(y, m, bill.dueDay);
        const billDueDate = new Date(Date.UTC(y, m, day, 12, 0, 0));

        // Must be strictly after today and <= endDate
        if (billDueDate > endOfTodayUTC && billDueDate <= endDateUTC) {
          // Check monthly custom amount
          const customMonthly = billMonthlyAmounts.find(
            (bma) => bma.billId === bill.id && bma.year === y && bma.month === m
          );
          const amount = customMonthly ? customMonthly.amount : bill.estimatedAmount;

          const dateStr = billDueDate.toISOString().split('T')[0];
          const [yearStr, monthStr, dayStr] = dateStr.split('-');

          events.push({
            id: `bill_${bill.id}_${y}_${m}`,
            date: dateStr,
            formattedDate: `${dayStr}/${monthStr}`,
            title: `Conta: ${bill.name}`,
            description: `Vencimento dia ${day}`,
            amount: -amount,
            type: 'expense',
            source: 'bill',
            category: bill.category,
          });
        }
      });
    }
  }

  // 3.5. Process Salary Projections (Adiantamento / Vale e Pagamento Líquido)
  if (salaryConfig && salaryConfig.isActive !== false && (salaryConfig.grossSalary || 0) > 0) {
    const salaryCalc = calculateSalary(salaryConfig);
    const advDayConf = salaryConfig.advanceDay || 20;
    const payDayConf = salaryConfig.paydayDay || 5;

    for (let y = startYear; y <= endYear; y++) {
      const mStart = y === startYear ? startMonth : 0;
      const mEnd = y === endYear ? endMonth : 11;

      for (let m = mStart; m <= mEnd; m++) {
        const monthRec = salaryMonthlyRecords.find((r) => r.year === y && r.month === m);

        // 1. Advance (Vale)
        const advAmount =
          monthRec?.realAdvance !== null && monthRec?.realAdvance !== undefined
            ? monthRec.realAdvance
            : salaryCalc.advanceAmount;

        if (advAmount > 0) {
          const advDay = clampDay(y, m, advDayConf);
          const advDueDate = new Date(Date.UTC(y, m, advDay, 12, 0, 0));

          if (advDueDate > endOfTodayUTC && advDueDate <= endDateUTC) {
            const alreadyInTx =
              Boolean(monthRec?.advanceTransactionId) ||
              transactions.some((t) => {
                const tDate = parseISODateAsUTC(t.date);
                return (
                  !isNaN(tDate.getTime()) &&
                  tDate.getUTCFullYear() === y &&
                  tDate.getUTCMonth() === m &&
                  t.type === TransactionType.INCOME &&
                  (t.description.toLowerCase().includes('vale') ||
                    t.description.toLowerCase().includes('adiantamento'))
                );
              });

            if (!alreadyInTx) {
              const dateStr = advDueDate.toISOString().split('T')[0];
              const [yearStr, monthStr, dayStr] = dateStr.split('-');
              events.push({
                id: `salary_adv_${y}_${m}`,
                date: dateStr,
                formattedDate: `${dayStr}/${monthStr}`,
                title: 'Adiantamento Salarial (Vale)',
                description:
                  monthRec?.realAdvance !== null && monthRec?.realAdvance !== undefined
                    ? 'Valor Real Informado'
                    : 'Projeção de Salário',
                amount: advAmount,
                type: 'income',
                source: 'salary',
                category: 'Salário',
              });
            }
          }
        }

        // 2. Payday (Pagamento Final Líquido)
        const payAmount =
          monthRec?.realPayday !== null && monthRec?.realPayday !== undefined
            ? monthRec.realPayday
            : salaryCalc.paydayAmount;

        if (payAmount > 0) {
          const payDay = clampDay(y, m, payDayConf);
          const payDueDate = new Date(Date.UTC(y, m, payDay, 12, 0, 0));

          if (payDueDate > endOfTodayUTC && payDueDate <= endDateUTC) {
            const alreadyInTx =
              Boolean(monthRec?.paydayTransactionId) ||
              transactions.some((t) => {
                const tDate = parseISODateAsUTC(t.date);
                return (
                  !isNaN(tDate.getTime()) &&
                  tDate.getUTCFullYear() === y &&
                  tDate.getUTCMonth() === m &&
                  t.type === TransactionType.INCOME &&
                  (t.description.toLowerCase().includes('salário') ||
                    t.description.toLowerCase().includes('pagamento')) &&
                  !t.description.toLowerCase().includes('vale')
                );
              });

            if (!alreadyInTx) {
              const dateStr = payDueDate.toISOString().split('T')[0];
              const [yearStr, monthStr, dayStr] = dateStr.split('-');
              events.push({
                id: `salary_pay_${y}_${m}`,
                date: dateStr,
                formattedDate: `${dayStr}/${monthStr}`,
                title: 'Pagamento Salarial (Líquido)',
                description:
                  monthRec?.realPayday !== null && monthRec?.realPayday !== undefined
                    ? 'Valor Real Informado'
                    : 'Projeção de Salário',
                amount: payAmount,
                type: 'income',
                source: 'salary',
                category: 'Salário',
              });
            }
          }
        }
      }
    }

    // 3.6. Process 13º Salário Projections
    for (let y = startYear; y <= endYear; y++) {
      const thirteenthConf = salaryThirteenthConfigs.find((c) => c.year === y);
      const taxTable = salaryTaxTables.find((t) => t.year === y);
      const yearItems = salaryItemizedEntries.filter((i) => i.year === y);

      const thirteenthCalc = calculateThirteenthSalary(
        thirteenthConf,
        salaryConfig,
        taxTable,
        yearItems
      );

      // 1ª Parcela (Adiantamento do 13º)
      const firstInstMonth = thirteenthConf?.firstInstallmentMonth !== undefined ? thirteenthConf.firstInstallmentMonth : 10;
      const firstInstDayConf = thirteenthConf?.firstInstallmentPayDay || 30;
      const firstInstDay = clampDay(y, firstInstMonth, firstInstDayConf);
      const firstInstDate = thirteenthConf?.firstInstallmentDate
        ? parseISODateAsUTC(thirteenthConf.firstInstallmentDate)
        : new Date(Date.UTC(y, firstInstMonth, firstInstDay, 12, 0, 0));

      const firstInstAmount =
        thirteenthConf?.firstInstallmentReal !== null && thirteenthConf?.firstInstallmentReal !== undefined
          ? thirteenthConf.firstInstallmentReal
          : thirteenthCalc.firstInstallmentNet;

      if (firstInstAmount > 0 && firstInstDate > endOfTodayUTC && firstInstDate <= endDateUTC) {
        const alreadyInTx =
          Boolean(thirteenthConf?.firstInstallmentTransactionId) ||
          transactions.some((t) => {
            const tDate = parseISODateAsUTC(t.date);
            return (
              !isNaN(tDate.getTime()) &&
              tDate.getUTCFullYear() === y &&
              tDate.getUTCMonth() === firstInstMonth &&
              t.type === TransactionType.INCOME &&
              (t.description.toLowerCase().includes('13') || t.description.toLowerCase().includes('décimo terceiro')) &&
              (t.description.toLowerCase().includes('1ª') || t.description.toLowerCase().includes('primeira') || t.description.toLowerCase().includes('adiantamento'))
            );
          });

        if (!alreadyInTx) {
          const dateStr = firstInstDate.toISOString().split('T')[0];
          const [yearStr, monthStr, dayStr] = dateStr.split('-');
          events.push({
            id: `salary_13th_1st_${y}`,
            date: dateStr,
            formattedDate: `${dayStr}/${monthStr}`,
            title: '1ª Parcela - 13º Salário',
            description:
              thirteenthConf?.firstInstallmentReal !== null && thirteenthConf?.firstInstallmentReal !== undefined
                ? 'Valor Real Informado'
                : 'Projeção 13º Salário',
            amount: firstInstAmount,
            type: 'income',
            source: 'salary',
            category: 'Salário',
          });
        }
      }

      // 2ª Parcela (Quitação do 13º com deduções)
      const secondInstDayConf = thirteenthConf?.secondInstallmentPayDay || 20;
      const secondInstDay = clampDay(y, 11, secondInstDayConf);
      const secondInstDate = thirteenthConf?.secondInstallmentDate
        ? parseISODateAsUTC(thirteenthConf.secondInstallmentDate)
        : new Date(Date.UTC(y, 11, secondInstDay, 12, 0, 0));

      const secondInstAmount =
        thirteenthConf?.secondInstallmentReal !== null && thirteenthConf?.secondInstallmentReal !== undefined
          ? thirteenthConf.secondInstallmentReal
          : thirteenthCalc.secondInstallmentNet;

      if (secondInstAmount > 0 && secondInstDate > endOfTodayUTC && secondInstDate <= endDateUTC) {
        const alreadyInTx =
          Boolean(thirteenthConf?.secondInstallmentTransactionId) ||
          transactions.some((t) => {
            const tDate = parseISODateAsUTC(t.date);
            return (
              !isNaN(tDate.getTime()) &&
              tDate.getUTCFullYear() === y &&
              tDate.getUTCMonth() === 11 &&
              t.type === TransactionType.INCOME &&
              (t.description.toLowerCase().includes('13') || t.description.toLowerCase().includes('décimo terceiro')) &&
              (t.description.toLowerCase().includes('2ª') || t.description.toLowerCase().includes('segunda') || t.description.toLowerCase().includes('quitação') || t.description.toLowerCase().includes('final'))
            );
          });

        if (!alreadyInTx) {
          const dateStr = secondInstDate.toISOString().split('T')[0];
          const [yearStr, monthStr, dayStr] = dateStr.split('-');
          events.push({
            id: `salary_13th_2nd_${y}`,
            date: dateStr,
            formattedDate: `${dayStr}/${monthStr}`,
            title: '2ª Parcela - 13º Salário (Final)',
            description:
              thirteenthConf?.secondInstallmentReal !== null && thirteenthConf?.secondInstallmentReal !== undefined
                ? 'Valor Real Informado'
                : 'Projeção 13º Salário',
            amount: secondInstAmount,
            type: 'income',
            source: 'salary',
            category: 'Salário',
          });
        }
      }
    }

    // 3.7. Process Vacation Projections (Férias)
    for (const vac of salaryVacationConfigs) {
      const taxTable = salaryTaxTables.find((t) => t.year === vac.year);
      const yearItems = salaryItemizedEntries.filter((i) => i.year === vac.year);
      const vacCalc = calculateVacation(vac, salaryConfig, taxTable, yearItems);

      let vacPayDate: Date | null = null;
      if (vac.paymentDate) {
        vacPayDate = parseISODateAsUTC(vac.paymentDate);
      } else if (vac.startDate) {
        // Pela CLT: 2 dias antes do início do gozo
        const sDate = parseISODateAsUTC(vac.startDate);
        if (!isNaN(sDate.getTime())) {
          vacPayDate = new Date(sDate);
          vacPayDate.setUTCDate(vacPayDate.getUTCDate() - 2);
        }
      }

      const vacAmount =
        vac.realAmount !== null && vac.realAmount !== undefined
          ? vac.realAmount
          : vacCalc.totalVacationNet;

      if (vacPayDate && !isNaN(vacPayDate.getTime()) && vacAmount > 0) {
        if (vacPayDate > endOfTodayUTC && vacPayDate <= endDateUTC) {
          const alreadyInTx =
            Boolean(vac.transactionId) ||
            transactions.some((t) => {
              return t.type === TransactionType.INCOME && t.description.toLowerCase().includes('férias');
            });

          if (!alreadyInTx) {
            const dateStr = vacPayDate.toISOString().split('T')[0];
            const [yearStr, monthStr, dayStr] = dateStr.split('-');
            events.push({
              id: `salary_vacation_${vac.id}`,
              date: dateStr,
              formattedDate: `${dayStr}/${monthStr}`,
              title: `Férias (+1/3 Const.) - ${vac.vacationDays}d`,
              description:
                vac.realAmount !== null && vac.realAmount !== undefined
                  ? 'Valor Real Informado'
                  : 'Projeção de Férias',
              amount: vacAmount,
              type: 'income',
              source: 'salary',
              category: 'Salário',
            });
          }
        }
      }
    }
  }

  // 4. Process Active Recurring Transactions (Recorrências)
  const activeRecurring = recurringTransactions.filter((r) => r.status === 'active');
  for (let y = startYear; y <= endYear; y++) {
    const mStart = y === startYear ? startMonth : 0;
    const mEnd = y === endYear ? endMonth : 11;

    for (let m = mStart; m <= mEnd; m++) {
      activeRecurring.forEach((rec) => {
        const recInitialDate = parseISODateAsUTC(rec.date);
        const recDay = !isNaN(recInitialDate.getTime()) ? recInitialDate.getUTCDate() : 1;
        const day = clampDay(y, m, recDay);
        const recDueDate = new Date(Date.UTC(y, m, day, 12, 0, 0));

        if (recDueDate > endOfTodayUTC && recDueDate <= endDateUTC) {
          // Check if this recurring transaction has already been materialized into a transaction in that month
          const alreadyCreated = transactions.some((t) => {
            if (t.recurringId !== rec.id) return false;
            const tDate = parseISODateAsUTC(t.date);
            return (
              !isNaN(tDate.getTime()) &&
              tDate.getUTCFullYear() === y &&
              tDate.getUTCMonth() === m
            );
          });

          if (!alreadyCreated) {
            const dateStr = recDueDate.toISOString().split('T')[0];
            const [yearStr, monthStr, dayStr] = dateStr.split('-');
            const isIncome = rec.type === TransactionType.INCOME;

            events.push({
              id: `rec_${rec.id}_${y}_${m}`,
              date: dateStr,
              formattedDate: `${dayStr}/${monthStr}`,
              title: rec.description,
              description: isIncome ? 'Receita Recorrente' : 'Despesa Recorrente',
              amount: isIncome ? rec.amount : -rec.amount,
              type: isIncome ? 'income' : 'expense',
              source: 'recurring',
              category: rec.category,
            });
          }
        }
      });
    }
  }

  // 5. Process Active Simulated Scenarios ("E se...?")
  simulatedScenarios
    .filter((s) => s.enabled && s.amount > 0)
    .forEach((sim) => {
      const simDate = parseISODateAsUTC(sim.date);
      if (isNaN(simDate.getTime())) return;

      const numInstallments = Math.max(1, sim.installments || 1);
      const installmentAmount = sim.amount / numInstallments;

      for (let i = 0; i < numInstallments; i++) {
        const targetYear = simDate.getUTCFullYear();
        const targetMonth = simDate.getUTCMonth() + i;
        const targetDay = clampDay(targetYear, targetMonth, simDate.getUTCDate());
        const instDate = new Date(Date.UTC(targetYear, targetMonth, targetDay, 12, 0, 0));

        if (instDate > endOfTodayUTC && instDate <= endDateUTC) {
          const dateStr = instDate.toISOString().split('T')[0];
          const [yearStr, monthStr, dayStr] = dateStr.split('-');
          const isIncome = sim.type === 'income';
          const instSuffix = numInstallments > 1 ? ` (${i + 1}/${numInstallments})` : '';

          events.push({
            id: `sim_${sim.id}_${i}`,
            date: dateStr,
            formattedDate: `${dayStr}/${monthStr}`,
            title: `[Simulação] ${sim.title}${instSuffix}`,
            description: isIncome ? 'Receita Simulada' : 'Despesa Simulada',
            amount: isIncome ? installmentAmount : -installmentAmount,
            type: isIncome ? 'income' : 'expense',
            source: 'simulation',
            isSimulated: true,
            category: sim.category,
          });
        }
      }
    });

  // Sort events chronologically
  events.sort((a, b) => a.date.localeCompare(b.date));

  // Group events by date string
  const groupedByDate = new Map<string, ForecastEvent[]>();
  events.forEach((ev) => {
    if (!groupedByDate.has(ev.date)) {
      groupedByDate.set(ev.date, []);
    }
    groupedByDate.get(ev.date)!.push(ev);
  });

  // 6. Build Daily Forecast Points
  const dailyPoints: DayForecastPoint[] = [];
  let runningBalance = initialBalance;
  let totalInflows = 0;
  let totalOutflows = 0;
  let minBalance = initialBalance;
  let minBalanceDate = todayUTC.toISOString().split('T')[0];
  let maxBalance = initialBalance;
  let maxBalanceDate = minBalanceDate;
  let daysNegativeCount = 0;
  let firstNegativeDate: string | null = null;

  // Add Day 0 (Today)
  const todayStr = todayUTC.toISOString().split('T')[0];
  const [tY, tM, tD] = todayStr.split('-');
  dailyPoints.push({
    date: todayStr,
    formattedDate: `${tD}/${tM}`,
    dayOfWeek: WEEKDAYS[todayUTC.getUTCDay()],
    dayOfMonth: Number(tD),
    balance: runningBalance,
    inflows: 0,
    outflows: 0,
    netChange: 0,
    events: [],
    isNegative: runningBalance < 0,
  });

  if (runningBalance < 0) {
    daysNegativeCount += 1;
    firstNegativeDate = todayStr;
  }

  // Iterate day by day from tomorrow to endDateUTC
  const cursorDate = new Date(todayUTC);
  cursorDate.setUTCDate(cursorDate.getUTCDate() + 1);

  while (cursorDate <= endDateUTC) {
    const dateStr = cursorDate.toISOString().split('T')[0];
    const [yStr, mStr, dStr] = dateStr.split('-');
    const dayEvents = groupedByDate.get(dateStr) || [];

    let dayInflows = 0;
    let dayOutflows = 0;

    dayEvents.forEach((ev) => {
      if (ev.amount > 0) {
        dayInflows += ev.amount;
      } else {
        dayOutflows += Math.abs(ev.amount);
      }
    });

    const netChange = dayInflows - dayOutflows;
    runningBalance += netChange;
    totalInflows += dayInflows;
    totalOutflows += dayOutflows;

    if (runningBalance < minBalance) {
      minBalance = runningBalance;
      minBalanceDate = dateStr;
    }
    if (runningBalance > maxBalance) {
      maxBalance = runningBalance;
      maxBalanceDate = dateStr;
    }

    const isNegative = runningBalance < 0;
    if (isNegative) {
      daysNegativeCount += 1;
      if (!firstNegativeDate) {
        firstNegativeDate = dateStr;
      }
    }

    dailyPoints.push({
      date: dateStr,
      formattedDate: `${dStr}/${mStr}`,
      dayOfWeek: WEEKDAYS[cursorDate.getUTCDay()],
      dayOfMonth: Number(dStr),
      balance: Math.round(runningBalance * 100) / 100,
      inflows: Math.round(dayInflows * 100) / 100,
      outflows: Math.round(dayOutflows * 100) / 100,
      netChange: Math.round(netChange * 100) / 100,
      events: dayEvents,
      isNegative,
    });

    cursorDate.setUTCDate(cursorDate.getUTCDate() + 1);
  }

  const endBalance = dailyPoints[dailyPoints.length - 1].balance;
  const netChange = endBalance - initialBalance;

  return {
    startBalance: initialBalance,
    endBalance,
    netChange,
    minBalance,
    minBalanceDate,
    maxBalance,
    maxBalanceDate,
    totalInflows,
    totalOutflows,
    daysNegativeCount,
    hasRiskOfNegative: daysNegativeCount > 0,
    firstNegativeDate,
    dailyPoints,
    allEvents: events,
    groupedByDate,
  };
}
