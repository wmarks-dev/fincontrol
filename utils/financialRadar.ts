import {
  Bill,
  BillPayment,
  BillMonthlyAmount,
  CreditCard,
  CardMonthlyClosing,
  Transaction,
  Budget,
  FinancialGoal,
  Category,
  TransactionType,
  PaymentMethod,
} from '../types';
import {
  getDaysInMonth,
  parseISODateAsUTC,
  getCurrentOpenBillInfo,
  getMostRecentlyClosedBillInfo,
  getEffectiveDueDate,
  isTransactionInBill,
} from './dateUtils';

export type AlertSeverity = 'danger' | 'warning' | 'info';
export type AlertType = 'bill' | 'card' | 'budget' | 'goal';

export interface FinancialAlert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  subtitle: string;
  description: string;
  amount?: number;
  formattedAmount?: string;
  dateLabel?: string;
  targetView: 'bills' | 'cards' | 'budget' | 'goals';
  actionLabel: string;
  metadata?: {
    billId?: string;
    cardId?: string;
    categoryId?: string;
    goalId?: string;
    dueDate?: Date;
    effectiveDueDay?: number;
    diffDays?: number;
    month?: number;
    year?: number;
  };
}

const formatCurrency = (val: number) => {
  return val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export interface RadarInput {
  bills: Bill[];
  billPayments: BillPayment[];
  billMonthlyAmounts: BillMonthlyAmount[];
  creditCards: CreditCard[];
  cardMonthlyClosings?: CardMonthlyClosing[];
  transactions: Transaction[];
  budgets: Budget[];
  financialGoals: FinancialGoal[];
  allCategories: Category[];
}

export function calculateFinancialAlerts({
  bills = [],
  billPayments = [],
  billMonthlyAmounts = [],
  creditCards = [],
  cardMonthlyClosings = [],
  transactions = [],
  budgets = [],
  financialGoals = [],
  allCategories = [],
}: RadarInput): FinancialAlert[] {
  const alerts: FinancialAlert[] = [];
  const now = new Date();
  const todayUTC = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const currentYear = todayUTC.getUTCFullYear();
  const currentMonth = todayUTC.getUTCMonth(); // 0-11

  // -------------------------------------------------------------
  // 1. ALERTAS DE CONTAS FIXAS (BILLS)
  // -------------------------------------------------------------
  // Analisa o mês atual e também se ficou alguma conta pendente do mês anterior
  const monthsToCheck = [
    { year: currentYear, month: currentMonth, isCurrent: true },
  ];

  // Adiciona o mês anterior para checar inadimplências recentes
  const prevMonthDate = new Date(Date.UTC(currentYear, currentMonth - 1, 1));
  monthsToCheck.push({
    year: prevMonthDate.getUTCFullYear(),
    month: prevMonthDate.getUTCMonth(),
    isCurrent: false,
  });

  const processedBillIdsByMonth = new Set<string>();

  monthsToCheck.forEach(({ year, month, isCurrent }) => {
    const maxDays = getDaysInMonth(year, month);
    const periodEpoch = year * 12 + month;

    bills
      .filter((b) => b.status === 'active')
      .forEach((bill) => {
        // Verificar se a conta já existia nesse mês
        let startEpoch = currentYear * 12 + currentMonth;
        if (bill.startYear !== undefined && bill.startMonth !== undefined) {
          startEpoch = bill.startYear * 12 + bill.startMonth;
        } else if (bill.createdAt) {
          const cd = new Date(bill.createdAt);
          if (!isNaN(cd.getTime())) {
            startEpoch = cd.getUTCFullYear() * 12 + cd.getUTCMonth();
          }
        }

        if (periodEpoch < startEpoch) return; // Conta ainda não começou

        const key = `${bill.id}-${year}-${month}`;
        if (processedBillIdsByMonth.has(key)) return;
        processedBillIdsByMonth.add(key);

        // Verificar se foi paga
        const isPaid = billPayments.some(
          (p) => p.billId === bill.id && p.year === year && p.month === month
        );

        if (isPaid) return; // Já está paga, sem alerta

        // Calcular valor efetivo
        const override = billMonthlyAmounts.find(
          (m) => m.billId === bill.id && m.year === year && m.month === month
        );
        const amount = override ? override.amount : bill.estimatedAmount;

        // Calcular data de vencimento
        const dueDay = Math.min(bill.dueDay, maxDays);
        const dueDate = new Date(Date.UTC(year, month, dueDay));
        const diffTime = dueDate.getTime() - todayUTC.getTime();
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        const dueDateFormatted = dueDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' });

        if (diffDays < 0) {
          // Atrasada
          const daysOverdue = Math.abs(diffDays);
          alerts.push({
            id: `bill-overdue-${bill.id}-${year}-${month}`,
            type: 'bill',
            severity: 'danger',
            title: `${bill.name} está atrasada!`,
            subtitle: `Venceu há ${daysOverdue} ${daysOverdue === 1 ? 'dia' : 'dias'} (${dueDateFormatted})`,
            description: `A conta de ${bill.name} no valor de ${formatCurrency(amount)} referente a ${month + 1}/${year} não foi quitada.`,
            amount,
            formattedAmount: formatCurrency(amount),
            dateLabel: dueDateFormatted,
            targetView: 'bills',
            actionLabel: 'Pagar Conta',
            metadata: {
              billId: bill.id,
              dueDate,
              diffDays,
              month,
              year,
            },
          });
        } else if (diffDays === 0) {
          // Vence hoje
          alerts.push({
            id: `bill-today-${bill.id}-${year}-${month}`,
            type: 'bill',
            severity: 'danger',
            title: `${bill.name} vence HOJE!`,
            subtitle: `Vencimento hoje (${dueDateFormatted})`,
            description: `Não se esqueça de pagar a conta de ${bill.name} no valor de ${formatCurrency(amount)}.`,
            amount,
            formattedAmount: formatCurrency(amount),
            dateLabel: 'Hoje',
            targetView: 'bills',
            actionLabel: 'Pagar Conta',
            metadata: {
              billId: bill.id,
              dueDate,
              diffDays: 0,
              month,
              year,
            },
          });
        } else if (diffDays <= 5 && isCurrent) {
          // Vence nos próximos 5 dias (apenas no mês corrente)
          alerts.push({
            id: `bill-soon-${bill.id}-${year}-${month}`,
            type: 'bill',
            severity: 'warning',
            title: `${bill.name} vence em ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`,
            subtitle: `Vencimento em ${dueDateFormatted}`,
            description: `Prepare-se para o pagamento da conta de ${bill.name} no valor de ${formatCurrency(amount)}.`,
            amount,
            formattedAmount: formatCurrency(amount),
            dateLabel: dueDateFormatted,
            targetView: 'bills',
            actionLabel: 'Ver Conta',
            metadata: {
              billId: bill.id,
              dueDate,
              diffDays,
              month,
              year,
            },
          });
        }
      });
  });

  // -------------------------------------------------------------
  // 2. ALERTAS DE CARTÕES DE CRÉDITO (CREDIT CARDS)
  // -------------------------------------------------------------
  creditCards.forEach((card) => {
    // A) Fatura Fechada (mais recente)
    try {
      const closedBill = getMostRecentlyClosedBillInfo(card, todayUTC, cardMonthlyClosings);
      // Calcular transações não pagas desta fatura fechada (respeitando customDueDate e ciclo da fatura)
      const closedTxs = transactions.filter((t) => {
        return (
          t.type === TransactionType.EXPENSE &&
          !t.isPaid &&
          isTransactionInBill(t, card, closedBill)
        );
      });

      const closedTotal = closedTxs.reduce((sum, t) => sum + t.amount, 0);

      if (closedTotal > 0) {
        const diffDue = Math.round((closedBill.dueDate.getTime() - todayUTC.getTime()) / (1000 * 60 * 60 * 24));
        const dueDateFormatted = closedBill.dueDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' });

        if (diffDue < 0) {
          alerts.push({
            id: `card-overdue-${card.id}`,
            type: 'card',
            severity: 'danger',
            title: `Fatura ${card.name} vencida!`,
            subtitle: `Venceu há ${Math.abs(diffDue)} ${Math.abs(diffDue) === 1 ? 'dia' : 'dias'} (${dueDateFormatted})`,
            description: `A fatura fechada no valor de ${formatCurrency(closedTotal)} ainda possui lançamentos em aberto.`,
            amount: closedTotal,
            formattedAmount: formatCurrency(closedTotal),
            dateLabel: dueDateFormatted,
            targetView: 'cards',
            actionLabel: 'Ver Fatura',
            metadata: {
              cardId: card.id,
              dueDate: closedBill.dueDate,
              diffDays: diffDue,
            },
          });
        } else if (diffDue === 0) {
          alerts.push({
            id: `card-today-${card.id}`,
            type: 'card',
            severity: 'danger',
            title: `Fatura ${card.name} vence HOJE!`,
            subtitle: `Vencimento hoje (${dueDateFormatted})`,
            description: `O vencimento da fatura é hoje no valor total de ${formatCurrency(closedTotal)}.`,
            amount: closedTotal,
            formattedAmount: formatCurrency(closedTotal),
            dateLabel: 'Hoje',
            targetView: 'cards',
            actionLabel: 'Ver Fatura',
            metadata: {
              cardId: card.id,
              dueDate: closedBill.dueDate,
              diffDays: 0,
            },
          });
        } else if (diffDue <= 5) {
          alerts.push({
            id: `card-due-soon-${card.id}`,
            type: 'card',
            severity: 'warning',
            title: `Fatura ${card.name} vence em ${diffDue} ${diffDue === 1 ? 'dia' : 'dias'}`,
            subtitle: `Vencimento em ${dueDateFormatted}`,
            description: `Total fechado a pagar: ${formatCurrency(closedTotal)}.`,
            amount: closedTotal,
            formattedAmount: formatCurrency(closedTotal),
            dateLabel: dueDateFormatted,
            targetView: 'cards',
            actionLabel: 'Ver Fatura',
            metadata: {
              cardId: card.id,
              dueDate: closedBill.dueDate,
              diffDays: diffDue,
            },
          });
        }
      }
    } catch (e) {
      // Ignora erro no cálculo específico do cartão
    }

    // B) Fatura Aberta (Fechamento Próximo)
    try {
      const openBill = getCurrentOpenBillInfo(card, todayUTC, cardMonthlyClosings);
      const diffClose = Math.round((openBill.closingDate.getTime() - todayUTC.getTime()) / (1000 * 60 * 60 * 24));

      if (diffClose >= 0 && diffClose <= 3) {
        const openTxs = transactions.filter((t) => {
          return (
            t.type === TransactionType.EXPENSE &&
            isTransactionInBill(t, card, openBill)
          );
        });
        const openTotal = openTxs.reduce((sum, t) => sum + t.amount, 0);

        const closeDateFormatted = openBill.closingDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
        const bestBuyDate = new Date(openBill.closingDate.getTime() + 86400000).toLocaleDateString('pt-BR', { timeZone: 'UTC' });

        alerts.push({
          id: `card-closing-soon-${card.id}`,
          type: 'card',
          severity: 'info',
          title: diffClose === 0 ? `Fatura ${card.name} fecha HOJE!` : `Fatura ${card.name} fecha em ${diffClose} ${diffClose === 1 ? 'dia' : 'dias'}`,
          subtitle: `Melhor dia de compra a partir de ${bestBuyDate}`,
          description: `Gastos acumulados até agora: ${formatCurrency(Math.max(0, openTotal))}. Novas compras após o fechamento entrarão na próxima fatura.`,
          amount: Math.max(0, openTotal),
          formattedAmount: formatCurrency(Math.max(0, openTotal)),
          dateLabel: closeDateFormatted,
          targetView: 'cards',
          actionLabel: 'Ver Cartão',
          metadata: {
            cardId: card.id,
            dueDate: openBill.closingDate,
            diffDays: diffClose,
          },
        });
      }
    } catch (e) {
      // Ignora
    }
  });

  // -------------------------------------------------------------
  // 3. ALERTAS DE ORÇAMENTOS (BUDGETS) DO MÊS ATUAL
  // -------------------------------------------------------------
  const currentBudgets = budgets.filter((b) => b.year === currentYear && b.month === currentMonth);
  if (currentBudgets.length > 0) {
    const cardsById = new Map<string, CreditCard>(creditCards.map((c) => [c.id, c]));
    const categorySpending: { [key: string]: number } = {};

    transactions.forEach((t) => {
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

      if (
        !isNaN(effectiveDate.getTime()) &&
        effectiveDate.getUTCFullYear() === currentYear &&
        effectiveDate.getUTCMonth() === currentMonth
      ) {
        categorySpending[t.category] = (categorySpending[t.category] || 0) + t.amount;
      }
    });

    currentBudgets.forEach((budget) => {
      const spent = categorySpending[budget.categoryId] || 0;
      const categoryObj = allCategories.find((c) => c.id === budget.categoryId);
      const catName = categoryObj?.name || budget.categoryId;
      const percentage = budget.amount > 0 ? (spent / budget.amount) * 100 : 0;

      if (spent > budget.amount) {
        // Estourado (> 100%)
        alerts.push({
          id: `budget-exceeded-${budget.id}`,
          type: 'budget',
          severity: 'danger',
          title: `Orçamento estourado: ${catName}`,
          subtitle: `${percentage.toFixed(0)}% utilizado (${formatCurrency(spent)} de ${formatCurrency(budget.amount)})`,
          description: `Você ultrapassou o teto estipulado para ${catName} em ${formatCurrency(spent - budget.amount)}.`,
          amount: spent,
          formattedAmount: formatCurrency(spent),
          targetView: 'budget',
          actionLabel: 'Ajustar Orçamento',
          metadata: {
            categoryId: budget.categoryId,
            month: currentMonth,
            year: currentYear,
          },
        });
      } else if (percentage >= 85) {
        // Em alerta (>= 85% e <= 100%)
        alerts.push({
          id: `budget-warning-${budget.id}`,
          type: 'budget',
          severity: 'warning',
          title: `Atenção ao orçamento: ${catName}`,
          subtitle: `${percentage.toFixed(0)}% utilizado (${formatCurrency(spent)} de ${formatCurrency(budget.amount)})`,
          description: `Resta apenas ${formatCurrency(budget.amount - spent)} do limite planejado para ${catName}.`,
          amount: spent,
          formattedAmount: formatCurrency(spent),
          targetView: 'budget',
          actionLabel: 'Ver Orçamentos',
          metadata: {
            categoryId: budget.categoryId,
            month: currentMonth,
            year: currentYear,
          },
        });
      }
    });
  }

  // -------------------------------------------------------------
  // 4. ALERTAS DE METAS FINANCEIRAS (GOALS)
  // -------------------------------------------------------------
  financialGoals
    .filter((g) => g.status === 'active' && g.targetDate)
    .forEach((goal) => {
      const targetDate = parseISODateAsUTC(goal.targetDate!);
      if (isNaN(targetDate.getTime())) return;

      const diffDays = Math.round((targetDate.getTime() - todayUTC.getTime()) / (1000 * 60 * 60 * 24));
      const targetDateFormatted = targetDate.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
      const progress = goal.targetAmount > 0 ? (goal.currentAmount / goal.targetAmount) * 100 : 0;

      if (diffDays < 0 && goal.currentAmount < goal.targetAmount) {
        alerts.push({
          id: `goal-expired-${goal.id}`,
          type: 'goal',
          severity: 'warning',
          title: `Prazo da meta expirou: ${goal.name}`,
          subtitle: `Prazo encerrou em ${targetDateFormatted} (${progress.toFixed(0)}% concluído)`,
          description: `Faltam ${formatCurrency(goal.targetAmount - goal.currentAmount)} para alcançar a meta estipulada.`,
          amount: goal.targetAmount - goal.currentAmount,
          formattedAmount: formatCurrency(goal.targetAmount - goal.currentAmount),
          dateLabel: targetDateFormatted,
          targetView: 'goals',
          actionLabel: 'Ver Metas',
          metadata: {
            goalId: goal.id,
            diffDays,
          },
        });
      } else if (diffDays >= 0 && diffDays <= 20 && goal.currentAmount < goal.targetAmount) {
        alerts.push({
          id: `goal-soon-${goal.id}`,
          type: 'goal',
          severity: 'info',
          title: `Meta ${goal.name} encerra em ${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`,
          subtitle: `Prazo: ${targetDateFormatted} (${progress.toFixed(0)}% concluído)`,
          description: `Faltam ${formatCurrency(goal.targetAmount - goal.currentAmount)} para completar o objetivo planejado.`,
          amount: goal.targetAmount - goal.currentAmount,
          formattedAmount: formatCurrency(goal.targetAmount - goal.currentAmount),
          dateLabel: targetDateFormatted,
          targetView: 'goals',
          actionLabel: 'Ver Metas',
          metadata: {
            goalId: goal.id,
            diffDays,
          },
        });
      }
    });

  // -------------------------------------------------------------
  // 5. ORDENAÇÃO POR PRIORIDADE
  // -------------------------------------------------------------
  const severityWeight: Record<AlertSeverity, number> = {
    danger: 3,
    warning: 2,
    info: 1,
  };

  alerts.sort((a, b) => {
    // 1º: Gravidade (danger > warning > info)
    if (severityWeight[b.severity] !== severityWeight[a.severity]) {
      return severityWeight[b.severity] - severityWeight[a.severity];
    }
    // 2º: Proximidade de dias (diffDays menor / mais urgente primeiro)
    const diffA = a.metadata?.diffDays ?? 999;
    const diffB = b.metadata?.diffDays ?? 999;
    if (diffA !== diffB) {
      return diffA - diffB;
    }
    // 3º: Maior valor financeiro envolvido
    return (b.amount || 0) - (a.amount || 0);
  });

  return alerts;
}
