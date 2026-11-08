import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { initDb, dbPath } from './db.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Local token verification needs only the project ID and Google's public keys.
// Revocation checks query the Admin API and require server credentials.
const checkRevoked = process.env.NODE_ENV === 'production' || Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS);
initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID || 'finance-64bfd',
  ...(checkRevoked ? { credential: applicationDefault() } : {}),
});
app.get('/health', (_req,res) => res.json({status:'ok'}));
const requireUser = async (req,res,next) => {
  const match = /^Bearer (\S+)$/.exec(req.headers.authorization || '');
  if (!match) return res.status(401).json({error:'Usuário não autenticado'});
  try {
    const token = await getAuth().verifyIdToken(match[1], checkRevoked);
    req.userId=token.uid;
    next();
  } catch(error) {
    console.error('Falha na autenticação:',error.code || 'unknown');
    res.status(401).json({error:'Sessão inválida. Entre novamente.'});
  }
};

app.use('/api', requireUser);

const parseTags = (tags) => {
  if (!tags) return undefined;
  if (Array.isArray(tags)) return tags;
  if (typeof tags === 'string') {
    tags = tags.trim();
    if (!tags) return undefined;
    if (tags.startsWith('[') && tags.endsWith(']')) {
      try {
        const parsed = JSON.parse(tags);
        if (Array.isArray(parsed)) return parsed;
      } catch (e) {}
    }
    return tags.split(',').map((s) => s.trim()).filter(Boolean);
  }
  return undefined;
};

const serializeTags = (tags) => {
  if (!tags) return null;
  if (Array.isArray(tags)) return JSON.stringify(tags.filter(Boolean));
  if (typeof tags === 'string') {
    const arr = tags.split(',').map((s) => s.trim()).filter(Boolean);
    return arr.length > 0 ? JSON.stringify(arr) : null;
  }
  return null;
};

// ----------------------------------------------------
// GET /api/data - Load all collections for the user
// ----------------------------------------------------
app.get('/api/data', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;

    const [
      transactionsRows,
      recurringRows,
      cardsRows,
      savingsRows,
      loansRows,
      loanPaymentsRows,
      billsRows,
      billPaymentsRows,
      billMonthlyAmountsRows,
      budgetsRows,
      goalsRows,
      contributionsRows,
      categoriesRows,
      cardMonthlyClosingsRows,
      salaryConfigRow,
      salaryRecordsRows,
      salaryTaxTablesRows,
      salaryItemizedRows,
      salaryThirteenthRows,
      salaryVacationRows,
    ] = await Promise.all([
      db.all('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, created_at DESC', userId),
      db.all('SELECT * FROM recurring_transactions WHERE user_id = ? ORDER BY date ASC', userId),
      db.all('SELECT * FROM credit_cards WHERE user_id = ? ORDER BY name ASC', userId),
      db.all('SELECT * FROM savings_transactions WHERE user_id = ? ORDER BY date DESC, created_at DESC', userId),
      db.all('SELECT * FROM loans WHERE user_id = ? ORDER BY date DESC', userId),
      db.all('SELECT * FROM loan_payments WHERE user_id = ? ORDER BY date DESC', userId),
      db.all('SELECT * FROM bills WHERE user_id = ? ORDER BY due_day ASC', userId),
      db.all('SELECT * FROM bill_payments WHERE user_id = ?', userId),
      db.all('SELECT * FROM bill_monthly_amounts WHERE user_id = ?', userId),
      db.all('SELECT * FROM budgets WHERE user_id = ?', userId),
      db.all('SELECT * FROM financial_goals WHERE user_id = ?', userId),
      db.all('SELECT * FROM goal_contributions WHERE user_id = ? ORDER BY date DESC', userId),
      db.all('SELECT * FROM custom_categories WHERE user_id = ? ORDER BY name ASC', userId),
      db.all('SELECT * FROM card_monthly_closings WHERE user_id = ? ORDER BY year ASC, month ASC', userId),
      db.get('SELECT * FROM salary_configs WHERE user_id = ?', userId),
      db.all('SELECT * FROM salary_monthly_records WHERE user_id = ? ORDER BY year DESC, month DESC', userId),
      db.all('SELECT * FROM salary_tax_tables WHERE user_id = ? ORDER BY year ASC', userId),
      db.all('SELECT * FROM salary_itemized_entries WHERE user_id = ? ORDER BY year ASC, month ASC, created_at ASC', userId),
      db.all('SELECT * FROM salary_thirteenth_configs WHERE user_id = ? ORDER BY year DESC', userId),
      db.all('SELECT * FROM salary_vacation_configs WHERE user_id = ? ORDER BY year DESC, start_date ASC', userId),
    ]);

    const data = {
      transactions: transactionsRows.map(r => ({
        id: r.id,
        description: r.description,
        amount: Number(r.amount),
        date: r.date,
        type: r.type,
        category: r.category,
        paymentMethod: r.payment_method,
        creditCardId: r.credit_card_id || undefined,
        installmentId: r.installment_id || undefined,
        recurringId: r.recurring_id || undefined,
        isPaid: Boolean(r.is_paid),
        customDueDate: r.custom_due_date || undefined,
        tags: parseTags(r.tags),
      })),
      recurringTransactions: recurringRows.map(r => ({
        id: r.id,
        description: r.description,
        amount: Number(r.amount),
        date: r.date,
        type: r.type,
        category: r.category,
        paymentMethod: r.payment_method,
        creditCardId: r.credit_card_id || undefined,
        status: r.status,
        tags: parseTags(r.tags),
      })),
      creditCards: cardsRows.map(r => ({
        id: r.id,
        name: r.name,
        closingDay: Number(r.closing_day),
        dueDay: Number(r.due_day),
        limit: Number(r.limit_amount),
        theme: r.theme || 'black',
      })),
      cardMonthlyClosings: cardMonthlyClosingsRows.map(r => ({
        id: r.id,
        cardId: r.card_id,
        year: Number(r.year),
        month: Number(r.month),
        closingDate: r.closing_date,
      })),
      savingsTransactions: savingsRows.map(r => ({
        id: r.id,
        type: r.type,
        amount: Number(r.amount),
        date: r.date,
        description: r.description,
      })),
      loans: loansRows.map(r => ({
        id: r.id,
        type: r.type,
        person: r.person,
        initialAmount: Number(r.initial_amount),
        paidAmount: Number(r.paid_amount),
        date: r.date,
        description: r.description,
        status: r.status,
        paymentMethod: r.payment_method || 'cash',
        transactionId: r.transaction_id || null,
      })),
      loanPayments: loanPaymentsRows.map(r => ({
        id: r.id,
        loanId: r.loan_id,
        amount: Number(r.amount),
        date: r.date,
      })),
      bills: billsRows.map(r => ({
        id: r.id,
        name: r.name,
        dueDay: Number(r.due_day),
        estimatedAmount: Number(r.estimated_amount),
        category: r.category,
        status: r.status,
        startYear: r.start_year !== null && r.start_year !== undefined ? Number(r.start_year) : undefined,
        startMonth: r.start_month !== null && r.start_month !== undefined ? Number(r.start_month) : undefined,
        createdAt: r.created_at || undefined,
      })),
      billPayments: billPaymentsRows.map(r => ({
        id: r.id,
        billId: r.bill_id,
        year: Number(r.year),
        month: Number(r.month),
        amount: r.amount !== null && r.amount !== undefined ? Number(r.amount) : undefined,
      })),
      billMonthlyAmounts: billMonthlyAmountsRows.map(r => ({
        id: r.id,
        billId: r.bill_id,
        year: Number(r.year),
        month: Number(r.month),
        amount: Number(r.amount),
      })),
      budgets: budgetsRows.map(r => ({
        id: r.id,
        categoryId: r.category_id,
        amount: Number(r.amount),
        month: Number(r.month),
        year: Number(r.year),
      })),
      financialGoals: goalsRows.map(r => ({
        id: r.id,
        name: r.name,
        targetAmount: Number(r.target_amount),
        currentAmount: Number(r.current_amount),
        targetDate: r.target_date || undefined,
        status: r.status,
      })),
      goalContributions: contributionsRows.map(r => ({
        id: r.id,
        goalId: r.goal_id,
        savingsTransactionId: r.savings_transaction_id,
        amount: Number(r.amount),
        date: r.date,
      })),
      customCategories: categoriesRows.map(r => ({
        id: r.id,
        name: r.name,
        icon: r.icon,
        isCustom: Boolean(r.is_custom),
      })),
      salaryConfig: salaryConfigRow ? {
        id: salaryConfigRow.id,
        grossSalary: Number(salaryConfigRow.gross_salary),
        dependents: Number(salaryConfigRow.dependents),
        otherDeductions: Number(salaryConfigRow.other_deductions),
        advancePercentage: Number(salaryConfigRow.advance_percentage),
        advanceDay: Number(salaryConfigRow.advance_day),
        paydayDay: Number(salaryConfigRow.payday_day),
        useCustomAdvance: Boolean(salaryConfigRow.use_custom_advance),
        customAdvanceAmount: Number(salaryConfigRow.custom_advance_amount),
        isActive: Boolean(salaryConfigRow.is_active),
        useCustomTaxes: Boolean(salaryConfigRow.use_custom_taxes),
        customInssAmount: Number(salaryConfigRow.custom_inss_amount || 0),
        customIrrfAmount: Number(salaryConfigRow.custom_irrf_amount || 0),
        taxYear: Number(salaryConfigRow.tax_year || 2026),
      } : null,
      salaryMonthlyRecords: salaryRecordsRows.map(r => ({
        id: r.id,
        year: Number(r.year),
        month: Number(r.month),
        projectedAdvance: Number(r.projected_advance),
        projectedPayday: Number(r.projected_payday),
        realAdvance: r.real_advance !== null && r.real_advance !== undefined ? Number(r.real_advance) : null,
        realPayday: r.real_payday !== null && r.real_payday !== undefined ? Number(r.real_payday) : null,
        advanceDate: r.advance_date || null,
        paydayDate: r.payday_date || null,
        notes: r.notes || '',
        advanceTransactionId: r.advance_transaction_id || null,
        paydayTransactionId: r.payday_transaction_id || null,
      })),
      salaryTaxTables: salaryTaxTablesRows.map(r => ({
        id: r.id,
        year: Number(r.year),
        inssCeiling: Number(r.inss_ceiling),
        inssBrackets: typeof r.inss_brackets === 'string' ? JSON.parse(r.inss_brackets) : r.inss_brackets,
        irrfBrackets: typeof r.irrf_brackets === 'string' ? JSON.parse(r.irrf_brackets) : r.irrf_brackets,
        dependentDeduction: Number(r.dependent_deduction),
        simplifiedDeduction: Number(r.simplified_deduction),
      })),
      salaryItemizedEntries: salaryItemizedRows.map(r => ({
        id: r.id,
        year: Number(r.year),
        month: Number(r.month),
        type: r.type,
        name: r.name,
        amount: Number(r.amount),
        isRecurring: Boolean(r.is_recurring),
        notes: r.notes || '',
        createdAt: r.created_at,
      })),
      salaryThirteenthConfigs: (salaryThirteenthRows || []).map(r => ({
        id: r.id,
        year: Number(r.year),
        monthsWorked: Number(r.months_worked || 12),
        firstInstallmentMonth: Number(r.first_installment_month !== null && r.first_installment_month !== undefined ? r.first_installment_month : 10),
        firstInstallmentPercentage: Number(r.first_installment_percentage || 50),
        firstInstallmentPayDay: Number(r.first_installment_pay_day || 30),
        secondInstallmentPayDay: Number(r.second_installment_pay_day || 20),
        customFirstInstallmentAmount: r.custom_first_installment_amount !== null && r.custom_first_installment_amount !== undefined ? Number(r.custom_first_installment_amount) : null,
        customSecondInstallmentAmount: r.custom_second_installment_amount !== null && r.custom_second_installment_amount !== undefined ? Number(r.custom_second_installment_amount) : null,
        firstInstallmentReal: r.first_installment_real !== null && r.first_installment_real !== undefined ? Number(r.first_installment_real) : null,
        secondInstallmentReal: r.second_installment_real !== null && r.second_installment_real !== undefined ? Number(r.second_installment_real) : null,
        firstInstallmentDate: r.first_installment_date || null,
        secondInstallmentDate: r.second_installment_date || null,
        firstInstallmentTransactionId: r.first_installment_transaction_id || null,
        secondInstallmentTransactionId: r.second_installment_transaction_id || null,
        notes: r.notes || '',
      })),
      salaryVacationConfigs: (salaryVacationRows || []).map(r => ({
        id: r.id,
        year: Number(r.year),
        vacationDays: Number(r.vacation_days || 30),
        sellDays: Number(r.sell_days || 0),
        startDate: r.start_date || '',
        advanceThirteenth: Boolean(r.advance_thirteenth),
        customAmount: r.custom_amount !== null && r.custom_amount !== undefined ? Number(r.custom_amount) : null,
        realAmount: r.real_amount !== null && r.real_amount !== undefined ? Number(r.real_amount) : null,
        paymentDate: r.payment_date || null,
        transactionId: r.transaction_id || null,
        notes: r.notes || '',
      })),
    };

    res.json(data);
  } catch (error) {
    console.error('Erro em GET /api/data:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// Transactions
// ----------------------------------------------------
app.post('/api/transactions', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const { transactions, pendingBillPayment } = req.body;

    if (!Array.isArray(transactions) || transactions.length === 0) {
      return res.status(400).json({ error: 'Nenhuma transação enviada' });
    }

    await db.run('BEGIN TRANSACTION');
    try {
      const insertStmt = await db.prepare(`
        INSERT INTO transactions (
          id, user_id, description, amount, date, type, category,
          payment_method, credit_card_id, installment_id, recurring_id, is_paid, custom_due_date, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      for (const t of transactions) {
        const id = t.id || randomUUID();
        await insertStmt.run(
          id,
          userId,
          t.description,
          t.amount,
          t.date,
          t.type,
          t.category,
          t.paymentMethod,
          t.creditCardId || null,
          t.installmentId || null,
          t.recurringId || null,
          t.isPaid ? 1 : 0,
          t.customDueDate || null,
          serializeTags(t.tags)
        );
      }
      await insertStmt.finalize();

      if (pendingBillPayment) {
        const paymentId = pendingBillPayment.id || randomUUID();
        const txAmount = transactions[0]?.amount;
        await db.run(
          'INSERT INTO bill_payments (id, user_id, bill_id, year, month, amount) VALUES (?, ?, ?, ?, ?, ?)',
          paymentId,
          userId,
          pendingBillPayment.billId,
          pendingBillPayment.year,
          pendingBillPayment.month,
          txAmount !== undefined ? txAmount : null
        );

        if (txAmount !== undefined && txAmount !== null) {
          const bmaId = `${pendingBillPayment.billId}_${pendingBillPayment.year}_${pendingBillPayment.month}`;
          await db.run(
            `INSERT INTO bill_monthly_amounts (id, user_id, bill_id, year, month, amount)
             VALUES (?, ?, ?, ?, ?, ?)
             ON CONFLICT(user_id, bill_id, year, month) DO UPDATE SET amount = excluded.amount`,
            bmaId,
            userId,
            pendingBillPayment.billId,
            pendingBillPayment.year,
            pendingBillPayment.month,
            Number(txAmount)
          );
        }
      }

      await db.run('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await db.run('ROLLBACK');
      throw err;
    }
  } catch (error) {
    console.error('Erro em POST /api/transactions:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const { id } = req.params;
    const t = req.body;

    await db.run(
      `UPDATE transactions SET
        description = ?,
        amount = ?,
        date = ?,
        type = ?,
        category = ?,
        payment_method = ?,
        credit_card_id = ?,
        installment_id = ?,
        recurring_id = ?,
        is_paid = ?,
        custom_due_date = ?,
        tags = ?
      WHERE id = ? AND user_id = ?`,
      t.description,
      t.amount,
      t.date,
      t.type,
      t.category,
      t.paymentMethod,
      t.creditCardId || null,
      t.installmentId || null,
      t.recurringId || null,
      t.isPaid ? 1 : 0,
      t.customDueDate !== undefined ? (t.customDueDate || null) : null,
      serializeTags(t.tags),
      id,
      userId
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Erro em PUT /api/transactions/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/transactions/:id/custom-due-date', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const { id } = req.params;
    const { customDueDate } = req.body;

    await db.run(
      'UPDATE transactions SET custom_due_date = ? WHERE id = ? AND user_id = ?',
      customDueDate || null,
      id,
      userId
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Erro em PATCH /api/transactions/:id/custom-due-date:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const { id } = req.params;

    await db.run('DELETE FROM transactions WHERE id = ? AND user_id = ?', id, userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro em DELETE /api/transactions/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// Recurring Transactions
// ----------------------------------------------------
app.post('/api/recurring', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const data = req.body;
    const id = data.id || randomUUID();

    await db.run(
      `INSERT INTO recurring_transactions (
        id, user_id, description, amount, date, type, category,
        payment_method, credit_card_id, status, tags
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      userId,
      data.description,
      data.amount,
      data.date,
      data.type,
      data.category,
      data.paymentMethod,
      data.creditCardId || null,
      'active',
      serializeTags(data.tags)
    );

    res.json({ success: true, id });
  } catch (error) {
    console.error('Erro em POST /api/recurring:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/recurring/:id/cancel', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const { id } = req.params;

    await db.run("UPDATE recurring_transactions SET status = 'canceled' WHERE id = ? AND user_id = ?", id, userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro em PUT /api/recurring/:id/cancel:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// Credit Cards
// ----------------------------------------------------
app.post('/api/cards', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const data = req.body;
    const id = data.id || randomUUID();

    await db.run(
      'INSERT INTO credit_cards (id, user_id, name, closing_day, due_day, limit_amount, theme) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id,
      userId,
      data.name,
      data.closingDay,
      data.dueDay,
      data.limit,
      data.theme || 'black'
    );

    res.json({ success: true, id });
  } catch (error) {
    console.error('Erro em POST /api/cards:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/cards/:id', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const { id } = req.params;
    const data = req.body;

    await db.run(
      'UPDATE credit_cards SET name = ?, closing_day = ?, due_day = ?, limit_amount = ?, theme = ? WHERE id = ? AND user_id = ?',
      data.name,
      data.closingDay,
      data.dueDay,
      data.limit,
      data.theme || 'black',
      id,
      userId
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Erro em PUT /api/cards/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/cards/:id', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const { id } = req.params;

    await db.run('DELETE FROM credit_cards WHERE id = ? AND user_id = ?', id, userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro em DELETE /api/cards/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// Card Monthly Closings (Ajuste dinâmico de fechamento)
// ----------------------------------------------------
app.post('/api/cards/monthly-closing', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const { cardId, year, month, closingDate } = req.body;
    const id = req.body.id || randomUUID();

    if (!cardId || year === undefined || month === undefined || !closingDate) {
      return res.status(400).json({ error: 'Dados incompletos para fechamento mensal' });
    }

    await db.run(
      `INSERT INTO card_monthly_closings (id, user_id, card_id, year, month, closing_date)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, card_id, year, month) DO UPDATE SET closing_date = excluded.closing_date`,
      id,
      userId,
      cardId,
      Number(year),
      Number(month),
      closingDate
    );

    res.json({ success: true, id });
  } catch (error) {
    console.error('Erro em POST /api/cards/monthly-closing:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/cards/monthly-closing/:id', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const { id } = req.params;

    await db.run('DELETE FROM card_monthly_closings WHERE id = ? AND user_id = ?', id, userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro em DELETE /api/cards/monthly-closing/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// Savings Transactions (with atomic mirror transaction and goal contribution)
// ----------------------------------------------------
app.post('/api/savings', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const { type, amount, description, goalId } = req.body;
    const todayISO = new Date().toISOString().split('T')[0];
    const savingsId = randomUUID();
    const mirrorTxId = randomUUID();

    await db.run('BEGIN TRANSACTION');
    try {
      // 1. Savings transaction record
      await db.run(
        'INSERT INTO savings_transactions (id, user_id, type, amount, date, description) VALUES (?, ?, ?, ?, ?, ?)',
        savingsId,
        userId,
        type,
        amount,
        todayISO,
        description
      );

      // 2. Mirror transaction
      const mirrorDescription = type === 'DEPOSIT' ? 'Transferência para Poupança' : 'Retirada da Poupança';
      const mirrorType = type === 'DEPOSIT' ? 'EXPENSE' : 'INCOME';

      await db.run(
        `INSERT INTO transactions (
          id, user_id, description, amount, date, type, category, payment_method
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        mirrorTxId,
        userId,
        mirrorDescription,
        amount,
        todayISO,
        mirrorType,
        'transfer',
        'Dinheiro'
      );

      // 3. Goal contribution if applicable
      if (goalId && type === 'DEPOSIT') {
        const goal = await db.get('SELECT * FROM financial_goals WHERE id = ? AND user_id = ?', goalId, userId);
        if (goal) {
          const contributionId = randomUUID();
          await db.run(
            'INSERT INTO goal_contributions (id, user_id, goal_id, savings_transaction_id, amount, date) VALUES (?, ?, ?, ?, ?, ?)',
            contributionId,
            userId,
            goalId,
            savingsId,
            amount,
            todayISO
          );

          const newCurrentAmount = Number(goal.current_amount) + Number(amount);
          const newStatus = newCurrentAmount >= Number(goal.target_amount) ? 'completed' : 'active';
          await db.run(
            'UPDATE financial_goals SET current_amount = ?, status = ? WHERE id = ? AND user_id = ?',
            newCurrentAmount,
            newStatus,
            goalId,
            userId
          );
        }
      }

      await db.run('COMMIT');
      res.json({ success: true, id: savingsId });
    } catch (err) {
      await db.run('ROLLBACK');
      throw err;
    }
  } catch (error) {
    console.error('Erro em POST /api/savings:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// Loans
// ----------------------------------------------------
app.post('/api/loans', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const data = req.body;
    const loanId = randomUUID();

    await db.run('BEGIN TRANSACTION');
    try {
      const paymentMethod = data.paymentMethod || 'cash';
      const transactionId = data.transactionId || null;
      let finalTxId = transactionId;

      // Only create mirror transaction if NOT linked to an existing transaction
      // and createTransaction is not explicitly false
      if (!transactionId && data.createTransaction !== false) {
        const mirrorTxId = randomUUID();
        const mirrorDesc = `Empréstimo ${data.type === 'GIVEN' ? 'para' : 'de'} ${data.person}`;
        const mirrorType = data.type === 'GIVEN' ? 'EXPENSE' : 'INCOME';

        await db.run(
          `INSERT INTO transactions (
            id, user_id, description, amount, date, type, category, payment_method
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          mirrorTxId,
          userId,
          mirrorDesc,
          data.initialAmount,
          data.date,
          mirrorType,
          'loans',
          'Dinheiro'
        );
        finalTxId = mirrorTxId;
      }

      await db.run(
        `INSERT INTO loans (
          id, user_id, type, person, initial_amount, paid_amount, date, description, status, payment_method, transaction_id
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        loanId,
        userId,
        data.type,
        data.person,
        data.initialAmount,
        0,
        data.date,
        data.description || '',
        'active',
        paymentMethod,
        finalTxId
      );

      await db.run('COMMIT');
      res.json({ success: true, id: loanId });
    } catch (err) {
      await db.run('ROLLBACK');
      throw err;
    }
  } catch (error) {
    console.error('Erro em POST /api/loans:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/loans/:id', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const { id: loanId } = req.params;

    await db.run('BEGIN TRANSACTION');
    try {
      const loan = await db.get('SELECT * FROM loans WHERE id = ? AND user_id = ?', loanId, userId);
      if (!loan) {
        await db.run('ROLLBACK');
        return res.status(404).json({ error: 'Empréstimo não encontrado' });
      }

      // If the loan automatically created a mirror transaction in cash, delete it
      if (loan.payment_method === 'cash' && loan.transaction_id) {
        await db.run('DELETE FROM transactions WHERE id = ? AND user_id = ?', loan.transaction_id, userId);
      }

      // Delete payments
      await db.run('DELETE FROM loan_payments WHERE loan_id = ? AND user_id = ?', loanId, userId);

      // Delete loan
      await db.run('DELETE FROM loans WHERE id = ? AND user_id = ?', loanId, userId);

      await db.run('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await db.run('ROLLBACK');
      throw err;
    }
  } catch (error) {
    console.error('Erro em DELETE /api/loans/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/loans/:id/payments', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const { id: loanId } = req.params;
    const { paymentAmount, paymentDate } = req.body;

    await db.run('BEGIN TRANSACTION');
    try {
      const loan = await db.get('SELECT * FROM loans WHERE id = ? AND user_id = ?', loanId, userId);
      if (!loan) {
        await db.run('ROLLBACK');
        return res.status(404).json({ error: 'Empréstimo não encontrado' });
      }

      const newPaidAmount = Number(loan.paid_amount) + Number(paymentAmount);
      const isPaidOff = newPaidAmount >= Number(loan.initial_amount);
      const newStatus = isPaidOff ? 'paid' : 'active';

      await db.run(
        'UPDATE loans SET paid_amount = ?, status = ? WHERE id = ? AND user_id = ?',
        newPaidAmount,
        newStatus,
        loanId,
        userId
      );

      const paymentId = randomUUID();
      await db.run(
        'INSERT INTO loan_payments (id, user_id, loan_id, amount, date) VALUES (?, ?, ?, ?, ?)',
        paymentId,
        userId,
        loanId,
        paymentAmount,
        paymentDate
      );

      const mirrorDesc = `Pagamento empréstimo ${loan.type === 'GIVEN' ? 'de' : 'para'} ${loan.person}`;
      const mirrorType = loan.type === 'GIVEN' ? 'INCOME' : 'EXPENSE';
      const mirrorTxId = randomUUID();

      await db.run(
        `INSERT INTO transactions (
          id, user_id, description, amount, date, type, category, payment_method
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        mirrorTxId,
        userId,
        mirrorDesc,
        paymentAmount,
        paymentDate,
        mirrorType,
        'loans',
        'Dinheiro'
      );

      await db.run('COMMIT');
      res.json({ success: true, id: paymentId });
    } catch (err) {
      await db.run('ROLLBACK');
      throw err;
    }
  } catch (error) {
    console.error('Erro em POST /api/loans/:id/payments:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// Bills
// ----------------------------------------------------
app.post('/api/bills', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const data = req.body;
    const id = data.id || randomUUID();

    const now = new Date();
    const startYear = data.startYear !== undefined ? Number(data.startYear) : now.getUTCFullYear();
    const startMonth = data.startMonth !== undefined ? Number(data.startMonth) : now.getUTCMonth();

    await db.run(
      'INSERT INTO bills (id, user_id, name, due_day, estimated_amount, category, status, start_year, start_month) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id,
      userId,
      data.name,
      data.dueDay,
      data.estimatedAmount,
      data.category,
      'active',
      startYear,
      startMonth
    );

    res.json({ success: true, id });
  } catch (error) {
    console.error('Erro em POST /api/bills:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/bills/:id', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const { id } = req.params;
    const data = req.body;

    await db.run(
      'UPDATE bills SET name = ?, due_day = ?, estimated_amount = ?, category = ?, status = ?, start_year = COALESCE(?, start_year), start_month = COALESCE(?, start_month) WHERE id = ? AND user_id = ?',
      data.name,
      data.dueDay,
      data.estimatedAmount,
      data.category,
      data.status || 'active',
      data.startYear !== undefined ? Number(data.startYear) : null,
      data.startMonth !== undefined ? Number(data.startMonth) : null,
      id,
      userId
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Erro em PUT /api/bills/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/bills/:id', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const { id } = req.params;

    await db.run('DELETE FROM bills WHERE id = ? AND user_id = ?', id, userId);
    await db.run('DELETE FROM bill_payments WHERE bill_id = ? AND user_id = ?', id, userId);
    await db.run('DELETE FROM bill_monthly_amounts WHERE bill_id = ? AND user_id = ?', id, userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro em DELETE /api/bills/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// Bill Monthly Amounts (Real monthly invoice values)
// ----------------------------------------------------
app.post('/api/bill-monthly-amounts', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const { billId, year, month, amount } = req.body;
    const id = `${billId}_${year}_${month}`;

    await db.run(
      `INSERT INTO bill_monthly_amounts (id, user_id, bill_id, year, month, amount)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id, bill_id, year, month) DO UPDATE SET amount = excluded.amount`,
      id,
      userId,
      billId,
      Number(year),
      Number(month),
      Number(amount)
    );

    res.json({ success: true, id });
  } catch (error) {
    console.error('Erro em POST /api/bill-monthly-amounts:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/bill-monthly-amounts', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const { billId, year, month } = req.body;

    await db.run(
      'DELETE FROM bill_monthly_amounts WHERE user_id = ? AND bill_id = ? AND year = ? AND month = ?',
      userId,
      billId,
      Number(year),
      Number(month)
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Erro em DELETE /api/bill-monthly-amounts:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// Budgets
// ----------------------------------------------------
app.post('/api/budgets', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const payload = req.body;

    const budgets = Array.isArray(payload) ? payload : (payload.budgets ? payload.budgets : [payload]);

    await db.run('BEGIN TRANSACTION');
    try {
      const stmt = await db.prepare(
        'INSERT INTO budgets (id, user_id, category_id, amount, month, year) VALUES (?, ?, ?, ?, ?, ?)'
      );

      for (const b of budgets) {
        const id = b.id || randomUUID();
        await stmt.run(id, userId, b.categoryId, b.amount, b.month, b.year);
      }
      await stmt.finalize();

      await db.run('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await db.run('ROLLBACK');
      throw err;
    }
  } catch (error) {
    console.error('Erro em POST /api/budgets:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/budgets/:id', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const { id } = req.params;
    const data = req.body;

    await db.run(
      'UPDATE budgets SET category_id = ?, amount = ?, month = ?, year = ? WHERE id = ? AND user_id = ?',
      data.categoryId,
      data.amount,
      data.month,
      data.year,
      id,
      userId
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Erro em PUT /api/budgets/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/budgets/:id', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const { id } = req.params;

    await db.run('DELETE FROM budgets WHERE id = ? AND user_id = ?', id, userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro em DELETE /api/budgets/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// Financial Goals
// ----------------------------------------------------
app.post('/api/goals', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const data = req.body;
    const id = data.id || randomUUID();
    const initialAmount = Number(data.initialAmount) || 0;
    const status = initialAmount >= Number(data.targetAmount) ? 'completed' : 'active';

    await db.run(
      'INSERT INTO financial_goals (id, user_id, name, target_amount, current_amount, target_date, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id,
      userId,
      data.name,
      data.targetAmount,
      initialAmount,
      data.targetDate || null,
      status
    );

    res.json({ success: true, id });
  } catch (error) {
    console.error('Erro em POST /api/goals:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/goals/:id', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const { id } = req.params;
    const data = req.body;

    await db.run(
      'UPDATE financial_goals SET name = ?, target_amount = ?, current_amount = ?, target_date = ?, status = ? WHERE id = ? AND user_id = ?',
      data.name,
      data.targetAmount,
      data.currentAmount,
      data.targetDate || null,
      data.status || 'active',
      id,
      userId
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Erro em PUT /api/goals/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/goals/:id', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const { id } = req.params;

    await db.run('BEGIN TRANSACTION');
    try {
      await db.run('DELETE FROM financial_goals WHERE id = ? AND user_id = ?', id, userId);
      await db.run('DELETE FROM goal_contributions WHERE goal_id = ? AND user_id = ?', id, userId);
      await db.run('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await db.run('ROLLBACK');
      throw err;
    }
  } catch (error) {
    console.error('Erro em DELETE /api/goals/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// Custom Categories
// ----------------------------------------------------
app.post('/api/categories', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const data = req.body;
    const id = data.id || randomUUID();

    await db.run(
      'INSERT INTO custom_categories (id, user_id, name, icon, is_custom) VALUES (?, ?, ?, ?, ?)',
      id,
      userId,
      data.name,
      data.icon,
      data.isCustom !== false ? 1 : 0
    );

    res.json({ success: true, id });
  } catch (error) {
    console.error('Erro em POST /api/categories:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/categories/:id', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const { id } = req.params;
    const data = req.body;

    await db.run(
      'UPDATE custom_categories SET name = ?, icon = ?, is_custom = ? WHERE id = ? AND user_id = ?',
      data.name,
      data.icon,
      data.isCustom !== false ? 1 : 0,
      id,
      userId
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Erro em PUT /api/categories/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/categories/:id', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const { id } = req.params;

    await db.run('DELETE FROM custom_categories WHERE id = ? AND user_id = ?', id, userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Erro em DELETE /api/categories/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// Salary Management
// ----------------------------------------------------
app.post('/api/salary/config', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const {
      grossSalary = 0,
      dependents = 0,
      otherDeductions = 0,
      advancePercentage = 40,
      advanceDay = 20,
      paydayDay = 5,
      useCustomAdvance = false,
      customAdvanceAmount = 0,
      isActive = true,
      useCustomTaxes = false,
      customInssAmount = 0,
      customIrrfAmount = 0,
      taxYear = 2026,
    } = req.body;

    const id = req.body.id || randomUUID();

    await db.run(
      `INSERT INTO salary_configs (
        id, user_id, gross_salary, dependents, other_deductions,
        advance_percentage, advance_day, payday_day,
        use_custom_advance, custom_advance_amount, is_active,
        use_custom_taxes, custom_inss_amount, custom_irrf_amount, tax_year
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET
        gross_salary = excluded.gross_salary,
        dependents = excluded.dependents,
        other_deductions = excluded.other_deductions,
        advance_percentage = excluded.advance_percentage,
        advance_day = excluded.advance_day,
        payday_day = excluded.payday_day,
        use_custom_advance = excluded.use_custom_advance,
        custom_advance_amount = excluded.custom_advance_amount,
        is_active = excluded.is_active,
        use_custom_taxes = excluded.use_custom_taxes,
        custom_inss_amount = excluded.custom_inss_amount,
        custom_irrf_amount = excluded.custom_irrf_amount,
        tax_year = excluded.tax_year`,
      id,
      userId,
      Number(grossSalary) || 0,
      Number(dependents) || 0,
      Number(otherDeductions) || 0,
      Number(advancePercentage) || 0,
      Number(advanceDay) || 20,
      Number(paydayDay) || 5,
      useCustomAdvance ? 1 : 0,
      Number(customAdvanceAmount) || 0,
      isActive ? 1 : 0,
      useCustomTaxes ? 1 : 0,
      Number(customInssAmount) || 0,
      Number(customIrrfAmount) || 0,
      Number(taxYear) || 2026
    );

    const saved = await db.get('SELECT * FROM salary_configs WHERE user_id = ?', userId);
    res.json({
      success: true,
      config: {
        id: saved.id,
        grossSalary: Number(saved.gross_salary),
        dependents: Number(saved.dependents),
        otherDeductions: Number(saved.other_deductions),
        advancePercentage: Number(saved.advance_percentage),
        advanceDay: Number(saved.advance_day),
        paydayDay: Number(saved.payday_day),
        useCustomAdvance: Boolean(saved.use_custom_advance),
        customAdvanceAmount: Number(saved.custom_advance_amount),
        isActive: Boolean(saved.is_active),
        useCustomTaxes: Boolean(saved.use_custom_taxes),
        customInssAmount: Number(saved.custom_inss_amount || 0),
        customIrrfAmount: Number(saved.custom_irrf_amount || 0),
        taxYear: Number(saved.tax_year || 2026),
      },
    });
  } catch (error) {
    console.error('Erro em POST /api/salary/config:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/salary/record', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const {
      year,
      month,
      projectedAdvance = 0,
      projectedPayday = 0,
      realAdvance = null,
      realPayday = null,
      advanceDate = null,
      paydayDate = null,
      notes = '',
      advanceTransactionId = null,
      paydayTransactionId = null,
    } = req.body;

    if (year === undefined || month === undefined) {
      return res.status(400).json({ error: 'Ano e mês são obrigatórios' });
    }

    const id = req.body.id || randomUUID();

    await db.run(
      `INSERT INTO salary_monthly_records (
        id, user_id, year, month, projected_advance, projected_payday,
        real_advance, real_payday, advance_date, payday_date, notes,
        advance_transaction_id, payday_transaction_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, year, month) DO UPDATE SET
        projected_advance = excluded.projected_advance,
        projected_payday = excluded.projected_payday,
        real_advance = excluded.real_advance,
        real_payday = excluded.real_payday,
        advance_date = excluded.advance_date,
        payday_date = excluded.payday_date,
        notes = excluded.notes,
        advance_transaction_id = excluded.advance_transaction_id,
        payday_transaction_id = excluded.payday_transaction_id`,
      id,
      userId,
      Number(year),
      Number(month),
      Number(projectedAdvance) || 0,
      Number(projectedPayday) || 0,
      realAdvance !== null && realAdvance !== undefined ? Number(realAdvance) : null,
      realPayday !== null && realPayday !== undefined ? Number(realPayday) : null,
      advanceDate || null,
      paydayDate || null,
      notes || '',
      advanceTransactionId || null,
      paydayTransactionId || null
    );

    const saved = await db.get(
      'SELECT * FROM salary_monthly_records WHERE user_id = ? AND year = ? AND month = ?',
      userId,
      Number(year),
      Number(month)
    );

    res.json({
      success: true,
      record: {
        id: saved.id,
        year: Number(saved.year),
        month: Number(saved.month),
        projectedAdvance: Number(saved.projected_advance),
        projectedPayday: Number(saved.projected_payday),
        realAdvance: saved.real_advance !== null && saved.real_advance !== undefined ? Number(saved.real_advance) : null,
        realPayday: saved.real_payday !== null && saved.real_payday !== undefined ? Number(saved.real_payday) : null,
        advanceDate: saved.advance_date || null,
        paydayDate: saved.payday_date || null,
        notes: saved.notes || '',
        advanceTransactionId: saved.advance_transaction_id || null,
        paydayTransactionId: saved.payday_transaction_id || null,
      },
    });
  } catch (error) {
    console.error('Erro em POST /api/salary/record:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/salary/tax-table', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const {
      year,
      inssBrackets,
      inssCeiling,
      irrfBrackets,
      dependentDeduction,
      simplifiedDeduction,
    } = req.body;

    if (!year) {
      return res.status(400).json({ error: 'Ano da tabela fiscal é obrigatório' });
    }

    const id = req.body.id || randomUUID();

    await db.run(
      `INSERT INTO salary_tax_tables (
        id, user_id, year, inss_brackets, inss_ceiling,
        irrf_brackets, dependent_deduction, simplified_deduction, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
      ON CONFLICT(user_id, year) DO UPDATE SET
        inss_brackets = excluded.inss_brackets,
        inss_ceiling = excluded.inss_ceiling,
        irrf_brackets = excluded.irrf_brackets,
        dependent_deduction = excluded.dependent_deduction,
        simplified_deduction = excluded.simplified_deduction,
        updated_at = datetime('now')`,
      id,
      userId,
      Number(year),
      typeof inssBrackets === 'string' ? inssBrackets : JSON.stringify(inssBrackets),
      Number(inssCeiling) || 0,
      typeof irrfBrackets === 'string' ? irrfBrackets : JSON.stringify(irrfBrackets),
      Number(dependentDeduction) || 0,
      Number(simplifiedDeduction) || 0
    );

    const saved = await db.get(
      'SELECT * FROM salary_tax_tables WHERE user_id = ? AND year = ?',
      userId,
      Number(year)
    );

    res.json({
      success: true,
      taxTable: {
        id: saved.id,
        year: Number(saved.year),
        inssCeiling: Number(saved.inss_ceiling),
        inssBrackets: typeof saved.inss_brackets === 'string' ? JSON.parse(saved.inss_brackets) : saved.inss_brackets,
        irrfBrackets: typeof saved.irrf_brackets === 'string' ? JSON.parse(saved.irrf_brackets) : saved.irrf_brackets,
        dependentDeduction: Number(saved.dependent_deduction),
        simplifiedDeduction: Number(saved.simplified_deduction),
      },
    });
  } catch (error) {
    console.error('Erro em POST /api/salary/tax-table:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/salary/tax-table/:year', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const year = Number(req.params.year);

    await db.run('DELETE FROM salary_tax_tables WHERE user_id = ? AND year = ?', userId, year);
    res.json({ success: true, year });
  } catch (error) {
    console.error('Erro em DELETE /api/salary/tax-table/:year:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/salary/item', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const {
      id = randomUUID(),
      year,
      month,
      type,
      name,
      amount,
      isRecurring = false,
      notes = '',
    } = req.body;

    if (year === undefined || month === undefined || !type || !name) {
      return res.status(400).json({ error: 'Ano, mês, tipo e nome são obrigatórios' });
    }

    await db.run(
      `INSERT INTO salary_itemized_entries (
        id, user_id, year, month, type, name, amount, is_recurring, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        year = excluded.year,
        month = excluded.month,
        type = excluded.type,
        name = excluded.name,
        amount = excluded.amount,
        is_recurring = excluded.is_recurring,
        notes = excluded.notes`,
      id,
      userId,
      Number(year),
      Number(month),
      type,
      name.trim(),
      Number(amount) || 0,
      isRecurring ? 1 : 0,
      notes || ''
    );

    const saved = await db.get('SELECT * FROM salary_itemized_entries WHERE id = ?', id);

    res.json({
      success: true,
      item: {
        id: saved.id,
        year: Number(saved.year),
        month: Number(saved.month),
        type: saved.type,
        name: saved.name,
        amount: Number(saved.amount),
        isRecurring: Boolean(saved.is_recurring),
        notes: saved.notes || '',
        createdAt: saved.created_at,
      },
    });
  } catch (error) {
    console.error('Erro em POST /api/salary/item:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/salary/item/:id', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const itemId = req.params.id;

    await db.run('DELETE FROM salary_itemized_entries WHERE user_id = ? AND id = ?', userId, itemId);
    res.json({ success: true, id: itemId });
  } catch (error) {
    console.error('Erro em DELETE /api/salary/item/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/salary/thirteenth', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const {
      id = randomUUID(),
      year,
      monthsWorked = 12,
      firstInstallmentMonth = 10,
      firstInstallmentPercentage = 50,
      firstInstallmentPayDay = 30,
      secondInstallmentPayDay = 20,
      customFirstInstallmentAmount = null,
      customSecondInstallmentAmount = null,
      firstInstallmentReal = null,
      secondInstallmentReal = null,
      firstInstallmentDate = null,
      secondInstallmentDate = null,
      firstInstallmentTransactionId = null,
      secondInstallmentTransactionId = null,
      notes = '',
    } = req.body;

    if (year === undefined) {
      return res.status(400).json({ error: 'Ano é obrigatório' });
    }

    await db.run(
      `INSERT INTO salary_thirteenth_configs (
        id, user_id, year, months_worked, first_installment_month,
        first_installment_percentage, first_installment_pay_day, second_installment_pay_day,
        custom_first_installment_amount, custom_second_installment_amount,
        first_installment_real, second_installment_real,
        first_installment_date, second_installment_date,
        first_installment_transaction_id, second_installment_transaction_id,
        notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(user_id, year) DO UPDATE SET
        months_worked = excluded.months_worked,
        first_installment_month = excluded.first_installment_month,
        first_installment_percentage = excluded.first_installment_percentage,
        first_installment_pay_day = excluded.first_installment_pay_day,
        second_installment_pay_day = excluded.second_installment_pay_day,
        custom_first_installment_amount = excluded.custom_first_installment_amount,
        custom_second_installment_amount = excluded.custom_second_installment_amount,
        first_installment_real = excluded.first_installment_real,
        second_installment_real = excluded.second_installment_real,
        first_installment_date = excluded.first_installment_date,
        second_installment_date = excluded.second_installment_date,
        first_installment_transaction_id = excluded.first_installment_transaction_id,
        second_installment_transaction_id = excluded.second_installment_transaction_id,
        notes = excluded.notes`,
      id,
      userId,
      Number(year),
      Number(monthsWorked),
      Number(firstInstallmentMonth),
      Number(firstInstallmentPercentage),
      Number(firstInstallmentPayDay),
      Number(secondInstallmentPayDay),
      customFirstInstallmentAmount !== null && customFirstInstallmentAmount !== undefined ? Number(customFirstInstallmentAmount) : null,
      customSecondInstallmentAmount !== null && customSecondInstallmentAmount !== undefined ? Number(customSecondInstallmentAmount) : null,
      firstInstallmentReal !== null && firstInstallmentReal !== undefined ? Number(firstInstallmentReal) : null,
      secondInstallmentReal !== null && secondInstallmentReal !== undefined ? Number(secondInstallmentReal) : null,
      firstInstallmentDate || null,
      secondInstallmentDate || null,
      firstInstallmentTransactionId || null,
      secondInstallmentTransactionId || null,
      notes || ''
    );

    const saved = await db.get(
      'SELECT * FROM salary_thirteenth_configs WHERE user_id = ? AND year = ?',
      userId,
      Number(year)
    );

    res.json({
      success: true,
      config: {
        id: saved.id,
        year: Number(saved.year),
        monthsWorked: Number(saved.months_worked),
        firstInstallmentMonth: Number(saved.first_installment_month),
        firstInstallmentPercentage: Number(saved.first_installment_percentage),
        firstInstallmentPayDay: Number(saved.first_installment_pay_day),
        secondInstallmentPayDay: Number(saved.second_installment_pay_day),
        customFirstInstallmentAmount: saved.custom_first_installment_amount !== null ? Number(saved.custom_first_installment_amount) : null,
        customSecondInstallmentAmount: saved.custom_second_installment_amount !== null ? Number(saved.custom_second_installment_amount) : null,
        firstInstallmentReal: saved.first_installment_real !== null ? Number(saved.first_installment_real) : null,
        secondInstallmentReal: saved.second_installment_real !== null ? Number(saved.second_installment_real) : null,
        firstInstallmentDate: saved.first_installment_date || null,
        secondInstallmentDate: saved.second_installment_date || null,
        firstInstallmentTransactionId: saved.first_installment_transaction_id || null,
        secondInstallmentTransactionId: saved.second_installment_transaction_id || null,
        notes: saved.notes || '',
      },
    });
  } catch (error) {
    console.error('Erro em POST /api/salary/thirteenth:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/salary/vacation', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const {
      id = randomUUID(),
      year,
      vacationDays = 30,
      sellDays = 0,
      startDate = '',
      advanceThirteenth = false,
      customAmount = null,
      realAmount = null,
      paymentDate = null,
      transactionId = null,
      notes = '',
    } = req.body;

    if (year === undefined) {
      return res.status(400).json({ error: 'Ano é obrigatório' });
    }

    await db.run(
      `INSERT INTO salary_vacation_configs (
        id, user_id, year, vacation_days, sell_days,
        start_date, advance_thirteenth, custom_amount,
        real_amount, payment_date, transaction_id, notes
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        year = excluded.year,
        vacation_days = excluded.vacation_days,
        sell_days = excluded.sell_days,
        start_date = excluded.start_date,
        advance_thirteenth = excluded.advance_thirteenth,
        custom_amount = excluded.custom_amount,
        real_amount = excluded.real_amount,
        payment_date = excluded.payment_date,
        transaction_id = excluded.transaction_id,
        notes = excluded.notes`,
      id,
      userId,
      Number(year),
      Number(vacationDays),
      Number(sellDays),
      startDate || '',
      advanceThirteenth ? 1 : 0,
      customAmount !== null && customAmount !== undefined ? Number(customAmount) : null,
      realAmount !== null && realAmount !== undefined ? Number(realAmount) : null,
      paymentDate || null,
      transactionId || null,
      notes || ''
    );

    const saved = await db.get(
      'SELECT * FROM salary_vacation_configs WHERE id = ?',
      id
    );

    res.json({
      success: true,
      config: {
        id: saved.id,
        year: Number(saved.year),
        vacationDays: Number(saved.vacation_days),
        sellDays: Number(saved.sell_days),
        startDate: saved.start_date || '',
        advanceThirteenth: Boolean(saved.advance_thirteenth),
        customAmount: saved.custom_amount !== null ? Number(saved.custom_amount) : null,
        realAmount: saved.real_amount !== null ? Number(saved.real_amount) : null,
        paymentDate: saved.payment_date || null,
        transactionId: saved.transaction_id || null,
        notes: saved.notes || '',
      },
    });
  } catch (error) {
    console.error('Erro em POST /api/salary/vacation:', error);
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/salary/vacation/:id', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const { id } = req.params;

    await db.run('DELETE FROM salary_vacation_configs WHERE user_id = ? AND id = ?', userId, id);
    res.json({ success: true, id });
  } catch (error) {
    console.error('Erro em DELETE /api/salary/vacation/:id:', error);
    res.status(500).json({ error: error.message });
  }
});

// ----------------------------------------------------
// Backup & Restore
// ----------------------------------------------------

// 1. Export structured JSON backup
app.get('/api/backup', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;

    const [
      transactions,
      recurringTransactions,
      creditCards,
      savingsTransactions,
      loans,
      loanPayments,
      bills,
      billPayments,
      billMonthlyAmounts,
      budgets,
      financialGoals,
      goalContributions,
      customCategories,
      cardMonthlyClosings,
      salaryConfig,
      salaryMonthlyRecords,
      salaryTaxTables,
      salaryItemizedEntries,
      salaryThirteenthConfigs,
      salaryVacationConfigs,
    ] = await Promise.all([
      db.all('SELECT * FROM transactions WHERE user_id = ?', userId),
      db.all('SELECT * FROM recurring_transactions WHERE user_id = ?', userId),
      db.all('SELECT * FROM credit_cards WHERE user_id = ?', userId),
      db.all('SELECT * FROM savings_transactions WHERE user_id = ?', userId),
      db.all('SELECT * FROM loans WHERE user_id = ?', userId),
      db.all('SELECT * FROM loan_payments WHERE user_id = ?', userId),
      db.all('SELECT * FROM bills WHERE user_id = ?', userId),
      db.all('SELECT * FROM bill_payments WHERE user_id = ?', userId),
      db.all('SELECT * FROM bill_monthly_amounts WHERE user_id = ?', userId),
      db.all('SELECT * FROM budgets WHERE user_id = ?', userId),
      db.all('SELECT * FROM financial_goals WHERE user_id = ?', userId),
      db.all('SELECT * FROM goal_contributions WHERE user_id = ?', userId),
      db.all('SELECT * FROM custom_categories WHERE user_id = ?', userId),
      db.all('SELECT * FROM card_monthly_closings WHERE user_id = ?', userId),
      db.get('SELECT * FROM salary_configs WHERE user_id = ?', userId),
      db.all('SELECT * FROM salary_monthly_records WHERE user_id = ?', userId),
      db.all('SELECT * FROM salary_tax_tables WHERE user_id = ?', userId),
      db.all('SELECT * FROM salary_itemized_entries WHERE user_id = ?', userId),
      db.all('SELECT * FROM salary_thirteenth_configs WHERE user_id = ? ORDER BY year DESC', userId),
      db.all('SELECT * FROM salary_vacation_configs WHERE user_id = ? ORDER BY year DESC', userId),
    ]);

    const backupPayload = {
      app: 'FinControl',
      version: '1.0',
      exportedAt: new Date().toISOString(),
      userId,
      data: {
        transactions,
        recurringTransactions,
        creditCards,
        cardMonthlyClosings,
        savingsTransactions,
        loans,
        loanPayments,
        bills,
        billPayments,
        billMonthlyAmounts,
        budgets,
        financialGoals,
        goalContributions,
        customCategories,
        salaryConfig,
        salaryMonthlyRecords,
        salaryTaxTables,
        salaryItemizedEntries,
        salaryThirteenthConfigs,
        salaryVacationConfigs,
      },
      summary: {
        totalTransactions: transactions.length,
        totalCreditCards: creditCards.length,
        totalCardClosings: cardMonthlyClosings.length,
        totalBills: bills.length,
        totalBudgets: budgets.length,
        totalGoals: financialGoals.length,
        totalSavings: savingsTransactions.length,
        totalLoans: loans.length,
      },
    };

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="fincontrol-backup-${dateStr}.json"`);
    res.json(backupPayload);
  } catch (error) {
    console.error('Erro em GET /api/backup:', error);
    res.status(500).json({ error: error.message });
  }
});

// 2. Download raw SQLite file (with WAL checkpoint)
app.get('/api/backup/sqlite', async (req, res) => {
  if (!process.env.ADMIN_USER_ID || req.userId !== process.env.ADMIN_USER_ID) return res.status(403).json({error:'Backup completo restrito ao administrador. Use o backup JSON da sua conta.'});
  try {
    const db = await initDb();
    await db.run('PRAGMA wal_checkpoint(TRUNCATE);');
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);
    res.download(dbPath, `fincontrol-database-${dateStr}.sqlite`);
  } catch (error) {
    console.error('Erro em GET /api/backup/sqlite:', error);
    res.status(500).json({ error: error.message });
  }
});

// 3. Restore backup from JSON payload
app.post('/api/restore', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;
    const { backup } = req.body;

    if (!backup || (!backup.data && !backup.transactions)) {
      return res.status(400).json({ error: 'Arquivo de backup inválido ou vazio.' });
    }

    const data = backup.data || backup;

    await db.run('BEGIN TRANSACTION');
    try {
      // Clear current user records
      await db.run('DELETE FROM goal_contributions WHERE user_id = ?', userId);
      await db.run('DELETE FROM financial_goals WHERE user_id = ?', userId);
      await db.run('DELETE FROM budgets WHERE user_id = ?', userId);
      await db.run('DELETE FROM bill_monthly_amounts WHERE user_id = ?', userId);
      await db.run('DELETE FROM bill_payments WHERE user_id = ?', userId);
      await db.run('DELETE FROM bills WHERE user_id = ?', userId);
      await db.run('DELETE FROM loan_payments WHERE user_id = ?', userId);
      await db.run('DELETE FROM loans WHERE user_id = ?', userId);
      await db.run('DELETE FROM savings_transactions WHERE user_id = ?', userId);
      await db.run('DELETE FROM recurring_transactions WHERE user_id = ?', userId);
      await db.run('DELETE FROM transactions WHERE user_id = ?', userId);
      await db.run('DELETE FROM card_monthly_closings WHERE user_id = ?', userId);
      await db.run('DELETE FROM credit_cards WHERE user_id = ?', userId);
      await db.run('DELETE FROM custom_categories WHERE user_id = ?', userId);
      await db.run('DELETE FROM salary_monthly_records WHERE user_id = ?', userId);
      await db.run('DELETE FROM salary_configs WHERE user_id = ?', userId);
      await db.run('DELETE FROM salary_tax_tables WHERE user_id = ?', userId);
      await db.run('DELETE FROM salary_itemized_entries WHERE user_id = ?', userId);
      await db.run('DELETE FROM salary_thirteenth_configs WHERE user_id = ?', userId);
      await db.run('DELETE FROM salary_vacation_configs WHERE user_id = ?', userId);

      // Re-insert transactions
      if (Array.isArray(data.transactions)) {
        for (const t of data.transactions) {
          await db.run(
            `INSERT INTO transactions (
              id, user_id, description, amount, date, type, category,
              payment_method, credit_card_id, installment_id, recurring_id, is_paid, custom_due_date, tags
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            t.id,
            userId,
            t.description,
            t.amount,
            t.date,
            t.type,
            t.category,
            t.payment_method || t.paymentMethod,
            t.credit_card_id || t.creditCardId || null,
            t.installment_id || t.installmentId || null,
            t.recurring_id || t.recurringId || null,
            t.is_paid !== undefined ? (t.is_paid ? 1 : 0) : (t.isPaid ? 1 : 0),
            t.custom_due_date || t.customDueDate || null,
            serializeTags(t.tags)
          );
        }
      }

      // Re-insert recurring transactions
      if (Array.isArray(data.recurringTransactions)) {
        for (const r of data.recurringTransactions) {
          await db.run(
            `INSERT INTO recurring_transactions (
              id, user_id, description, amount, date, type, category,
              payment_method, credit_card_id, status, tags
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            r.id,
            userId,
            r.description,
            r.amount,
            r.date,
            r.type,
            r.category,
            r.payment_method || r.paymentMethod,
            r.credit_card_id || r.creditCardId || null,
            r.status || 'active',
            serializeTags(r.tags)
          );
        }
      }

      // Re-insert credit cards
      if (Array.isArray(data.creditCards)) {
        for (const c of data.creditCards) {
          await db.run(
            `INSERT INTO credit_cards (
              id, user_id, name, closing_day, due_day, limit_amount, theme
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            c.id,
            userId,
            c.name,
            c.closing_day || c.closingDay,
            c.due_day || c.dueDay,
            c.limit_amount || c.limit,
            c.theme || 'black'
          );
        }
      }

      // Re-insert card monthly closings
      if (Array.isArray(data.cardMonthlyClosings)) {
        for (const mc of data.cardMonthlyClosings) {
          await db.run(
            `INSERT INTO card_monthly_closings (
              id, user_id, card_id, year, month, closing_date
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            mc.id,
            userId,
            mc.card_id || mc.cardId,
            Number(mc.year),
            Number(mc.month),
            mc.closing_date || mc.closingDate
          );
        }
      }

      // Re-insert savings
      if (Array.isArray(data.savingsTransactions)) {
        for (const s of data.savingsTransactions) {
          await db.run(
            `INSERT INTO savings_transactions (
              id, user_id, type, amount, date, description
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            s.id,
            userId,
            s.type,
            s.amount,
            s.date,
            s.description || ''
          );
        }
      }

      // Re-insert loans
      if (Array.isArray(data.loans)) {
        for (const l of data.loans) {
          await db.run(
            `INSERT INTO loans (
              id, user_id, type, person, initial_amount, paid_amount, date, description, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            l.id,
            userId,
            l.type,
            l.person,
            l.initial_amount || l.initialAmount,
            l.paid_amount !== undefined ? l.paid_amount : (l.paidAmount || 0),
            l.date,
            l.description || '',
            l.status || 'active'
          );
        }
      }

      // Re-insert loan payments
      if (Array.isArray(data.loanPayments)) {
        for (const lp of data.loanPayments) {
          await db.run(
            `INSERT INTO loan_payments (
              id, user_id, loan_id, amount, date
            ) VALUES (?, ?, ?, ?, ?)`,
            lp.id,
            userId,
            lp.loan_id || lp.loanId,
            lp.amount,
            lp.date
          );
        }
      }

      // Re-insert bills
      if (Array.isArray(data.bills)) {
        for (const b of data.bills) {
          await db.run(
            `INSERT INTO bills (
              id, user_id, name, due_day, estimated_amount, category, status, start_year, start_month
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            b.id,
            userId,
            b.name,
            b.due_day || b.dueDay,
            b.estimated_amount || b.estimatedAmount,
            b.category,
            b.status || 'active',
            b.start_year !== undefined ? b.start_year : (b.startYear !== undefined ? b.startYear : null),
            b.start_month !== undefined ? b.start_month : (b.startMonth !== undefined ? b.startMonth : null)
          );
        }
      }

      // Re-insert bill payments
      if (Array.isArray(data.billPayments)) {
        for (const bp of data.billPayments) {
          await db.run(
            `INSERT INTO bill_payments (
              id, user_id, bill_id, year, month, amount
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            bp.id,
            userId,
            bp.bill_id || bp.billId,
            bp.year,
            bp.month,
            bp.amount || null
          );
        }
      }

      // Re-insert bill monthly amounts
      if (Array.isArray(data.billMonthlyAmounts)) {
        for (const ma of data.billMonthlyAmounts) {
          await db.run(
            `INSERT INTO bill_monthly_amounts (
              id, user_id, bill_id, year, month, amount
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            ma.id,
            userId,
            ma.bill_id || ma.billId,
            ma.year,
            ma.month,
            ma.amount
          );
        }
      }

      // Re-insert budgets
      if (Array.isArray(data.budgets)) {
        for (const bg of data.budgets) {
          await db.run(
            `INSERT INTO budgets (
              id, user_id, category_id, amount, month, year
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            bg.id,
            userId,
            bg.category_id || bg.categoryId,
            bg.amount,
            bg.month,
            bg.year
          );
        }
      }

      // Re-insert financial goals
      if (Array.isArray(data.financialGoals)) {
        for (const fg of data.financialGoals) {
          await db.run(
            `INSERT INTO financial_goals (
              id, user_id, name, target_amount, current_amount, target_date, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            fg.id,
            userId,
            fg.name,
            fg.target_amount || fg.targetAmount,
            fg.current_amount !== undefined ? fg.current_amount : (fg.currentAmount || 0),
            fg.target_date || fg.targetDate || null,
            fg.status || 'active'
          );
        }
      }

      // Re-insert goal contributions
      if (Array.isArray(data.goalContributions)) {
        for (const gc of data.goalContributions) {
          await db.run(
            `INSERT INTO goal_contributions (
              id, user_id, goal_id, savings_transaction_id, amount, date
            ) VALUES (?, ?, ?, ?, ?, ?)`,
            gc.id,
            userId,
            gc.goal_id || gc.goalId,
            gc.savings_transaction_id || gc.savingsTransactionId,
            gc.amount,
            gc.date
          );
        }
      }

      // Re-insert custom categories
      if (Array.isArray(data.customCategories)) {
        for (const cat of data.customCategories) {
          await db.run(
            `INSERT INTO custom_categories (
              id, user_id, name, icon, is_custom
            ) VALUES (?, ?, ?, ?, ?)`,
            cat.id,
            userId,
            cat.name,
            cat.icon,
            cat.is_custom !== undefined ? (cat.is_custom ? 1 : 0) : (cat.isCustom ? 1 : 0)
          );
        }
      }

      // Re-insert salary config
      if (data.salaryConfig) {
        const sc = data.salaryConfig;
        await db.run(
          `INSERT INTO salary_configs (
            id, user_id, gross_salary, dependents, other_deductions,
            advance_percentage, advance_day, payday_day,
            use_custom_advance, custom_advance_amount, is_active,
            use_custom_taxes, custom_inss_amount, custom_irrf_amount, tax_year
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          sc.id || randomUUID(),
          userId,
          sc.gross_salary !== undefined ? sc.gross_salary : (sc.grossSalary || 0),
          sc.dependents !== undefined ? sc.dependents : (sc.dependents || 0),
          sc.other_deductions !== undefined ? sc.other_deductions : (sc.otherDeductions || 0),
          sc.advance_percentage !== undefined ? sc.advance_percentage : (sc.advancePercentage || 40),
          sc.advance_day !== undefined ? sc.advance_day : (sc.advanceDay || 20),
          sc.payday_day !== undefined ? sc.payday_day : (sc.paydayDay || 5),
          sc.use_custom_advance !== undefined ? (sc.use_custom_advance ? 1 : 0) : (sc.useCustomAdvance ? 1 : 0),
          sc.custom_advance_amount !== undefined ? sc.custom_advance_amount : (sc.customAdvanceAmount || 0),
          sc.is_active !== undefined ? (sc.is_active ? 1 : 0) : (sc.isActive !== false ? 1 : 0),
          sc.use_custom_taxes !== undefined ? (sc.use_custom_taxes ? 1 : 0) : (sc.useCustomTaxes ? 1 : 0),
          sc.custom_inss_amount !== undefined ? sc.custom_inss_amount : (sc.customInssAmount || 0),
          sc.custom_irrf_amount !== undefined ? sc.custom_irrf_amount : (sc.customIrrfAmount || 0),
          sc.tax_year !== undefined ? sc.tax_year : (sc.taxYear || 2026)
        );
      }

      // Re-insert salary monthly records
      if (Array.isArray(data.salaryMonthlyRecords)) {
        for (const sr of data.salaryMonthlyRecords) {
          await db.run(
            `INSERT INTO salary_monthly_records (
              id, user_id, year, month, projected_advance, projected_payday,
              real_advance, real_payday, advance_date, payday_date, notes,
              advance_transaction_id, payday_transaction_id
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            sr.id || randomUUID(),
            userId,
            sr.year,
            sr.month,
            sr.projected_advance !== undefined ? sr.projected_advance : (sr.projectedAdvance || 0),
            sr.projected_payday !== undefined ? sr.projected_payday : (sr.projectedPayday || 0),
            sr.real_advance !== undefined ? sr.real_advance : (sr.realAdvance ?? null),
            sr.real_payday !== undefined ? sr.real_payday : (sr.realPayday ?? null),
            sr.advance_date || sr.advanceDate || null,
            sr.payday_date || sr.paydayDate || null,
            sr.notes || '',
            sr.advance_transaction_id || sr.advanceTransactionId || null,
            sr.payday_transaction_id || sr.paydayTransactionId || null
          );
        }
      }

      // Re-insert salary tax tables
      if (Array.isArray(data.salaryTaxTables)) {
        for (const tt of data.salaryTaxTables) {
          await db.run(
            `INSERT INTO salary_tax_tables (
              id, user_id, year, inss_brackets, inss_ceiling,
              irrf_brackets, dependent_deduction, simplified_deduction
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            tt.id || randomUUID(),
            userId,
            tt.year,
            typeof (tt.inss_brackets || tt.inssBrackets) === 'string'
              ? (tt.inss_brackets || tt.inssBrackets)
              : JSON.stringify(tt.inss_brackets || tt.inssBrackets || []),
            tt.inss_ceiling !== undefined ? tt.inss_ceiling : (tt.inssCeiling || 0),
            typeof (tt.irrf_brackets || tt.irrfBrackets) === 'string'
              ? (tt.irrf_brackets || tt.irrfBrackets)
              : JSON.stringify(tt.irrf_brackets || tt.irrfBrackets || []),
            tt.dependent_deduction !== undefined ? tt.dependent_deduction : (tt.dependentDeduction || 0),
            tt.simplified_deduction !== undefined ? tt.simplified_deduction : (tt.simplifiedDeduction || 0)
          );
        }
      }

      // Re-insert salary itemized entries
      if (Array.isArray(data.salaryItemizedEntries)) {
        for (const it of data.salaryItemizedEntries) {
          await db.run(
            `INSERT INTO salary_itemized_entries (
              id, user_id, year, month, type, name, amount, is_recurring, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            it.id || randomUUID(),
            userId,
            it.year,
            it.month,
            it.type,
            it.name,
            it.amount,
            it.is_recurring !== undefined ? (it.is_recurring ? 1 : 0) : (it.isRecurring ? 1 : 0),
            it.notes || ''
          );
        }
      }

      // Re-insert salary thirteenth configs
      if (Array.isArray(data.salaryThirteenthConfigs)) {
        for (const st of data.salaryThirteenthConfigs) {
          await db.run(
            `INSERT INTO salary_thirteenth_configs (
              id, user_id, year, months_worked, first_installment_month,
              first_installment_percentage, first_installment_pay_day, second_installment_pay_day,
              custom_first_installment_amount, custom_second_installment_amount,
              first_installment_real, second_installment_real,
              first_installment_date, second_installment_date,
              first_installment_transaction_id, second_installment_transaction_id,
              notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            st.id || randomUUID(),
            userId,
            st.year,
            st.months_worked !== undefined ? st.months_worked : (st.monthsWorked || 12),
            st.first_installment_month !== undefined ? st.first_installment_month : (st.firstInstallmentMonth ?? 10),
            st.first_installment_percentage !== undefined ? st.first_installment_percentage : (st.firstInstallmentPercentage || 50),
            st.first_installment_pay_day !== undefined ? st.first_installment_pay_day : (st.firstInstallmentPayDay || 30),
            st.second_installment_pay_day !== undefined ? st.second_installment_pay_day : (st.secondInstallmentPayDay || 20),
            st.custom_first_installment_amount !== undefined ? st.custom_first_installment_amount : (st.customFirstInstallmentAmount ?? null),
            st.custom_second_installment_amount !== undefined ? st.custom_second_installment_amount : (st.customSecondInstallmentAmount ?? null),
            st.first_installment_real !== undefined ? st.first_installment_real : (st.firstInstallmentReal ?? null),
            st.second_installment_real !== undefined ? st.second_installment_real : (st.secondInstallmentReal ?? null),
            st.first_installment_date || st.firstInstallmentDate || null,
            st.second_installment_date || st.secondInstallmentDate || null,
            st.first_installment_transaction_id || st.firstInstallmentTransactionId || null,
            st.second_installment_transaction_id || st.secondInstallmentTransactionId || null,
            st.notes || ''
          );
        }
      }

      // Re-insert salary vacation configs
      if (Array.isArray(data.salaryVacationConfigs)) {
        for (const sv of data.salaryVacationConfigs) {
          await db.run(
            `INSERT INTO salary_vacation_configs (
              id, user_id, year, vacation_days, sell_days,
              start_date, advance_thirteenth, custom_amount,
              real_amount, payment_date, transaction_id, notes
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            sv.id || randomUUID(),
            userId,
            sv.year,
            sv.vacation_days !== undefined ? sv.vacation_days : (sv.vacationDays || 30),
            sv.sell_days !== undefined ? sv.sell_days : (sv.sellDays || 0),
            sv.start_date || sv.startDate || '',
            sv.advance_thirteenth !== undefined ? (sv.advance_thirteenth ? 1 : 0) : (sv.advanceThirteenth ? 1 : 0),
            sv.custom_amount !== undefined ? sv.custom_amount : (sv.customAmount ?? null),
            sv.real_amount !== undefined ? sv.real_amount : (sv.realAmount ?? null),
            sv.payment_date || sv.paymentDate || null,
            sv.transaction_id || sv.transactionId || null,
            sv.notes || ''
          );
        }
      }

      await db.run('COMMIT');

      res.json({
        success: true,
        stats: {
          transactions: (data.transactions || []).length,
          creditCards: (data.creditCards || []).length,
          bills: (data.bills || []).length,
          budgets: (data.budgets || []).length,
          financialGoals: (data.financialGoals || []).length,
          savingsTransactions: (data.savingsTransactions || []).length,
          loans: (data.loans || []).length,
          customCategories: (data.customCategories || []).length,
          cardMonthlyClosings: (data.cardMonthlyClosings || []).length,
          salaryMonthlyRecords: (data.salaryMonthlyRecords || []).length,
          salaryThirteenthConfigs: (data.salaryThirteenthConfigs || []).length,
          salaryVacationConfigs: (data.salaryVacationConfigs || []).length,
        },
      });
    } catch (err) {
      await db.run('ROLLBACK');
      throw err;
    }
  } catch (error) {
    console.error('Erro em POST /api/restore:', error);
    res.status(500).json({ error: error.message });
  }
});

// Reset all account data
app.post('/api/reset-data', async (req, res) => {
  try {
    const db = await initDb();
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Não autorizado.' });
    }

    await db.run('BEGIN TRANSACTION');
    try {
      await db.run('DELETE FROM goal_contributions WHERE user_id = ?', userId);
      await db.run('DELETE FROM financial_goals WHERE user_id = ?', userId);
      await db.run('DELETE FROM budgets WHERE user_id = ?', userId);
      await db.run('DELETE FROM bill_monthly_amounts WHERE user_id = ?', userId);
      await db.run('DELETE FROM bill_payments WHERE user_id = ?', userId);
      await db.run('DELETE FROM bills WHERE user_id = ?', userId);
      await db.run('DELETE FROM loan_payments WHERE user_id = ?', userId);
      await db.run('DELETE FROM loans WHERE user_id = ?', userId);
      await db.run('DELETE FROM savings_transactions WHERE user_id = ?', userId);
      await db.run('DELETE FROM recurring_transactions WHERE user_id = ?', userId);
      await db.run('DELETE FROM transactions WHERE user_id = ?', userId);
      await db.run('DELETE FROM card_monthly_closings WHERE user_id = ?', userId);
      await db.run('DELETE FROM credit_cards WHERE user_id = ?', userId);
      await db.run('DELETE FROM custom_categories WHERE user_id = ?', userId);
      await db.run('DELETE FROM salary_monthly_records WHERE user_id = ?', userId);
      await db.run('DELETE FROM salary_configs WHERE user_id = ?', userId);
      await db.run('DELETE FROM salary_tax_tables WHERE user_id = ?', userId);
      await db.run('DELETE FROM salary_itemized_entries WHERE user_id = ?', userId);
      await db.run('DELETE FROM salary_thirteenth_configs WHERE user_id = ?', userId);
      await db.run('DELETE FROM salary_vacation_configs WHERE user_id = ?', userId);

      await db.run('COMMIT');

      res.json({
        success: true,
        message: 'Todos os dados da conta foram resetados com sucesso.',
      });
    } catch (err) {
      await db.run('ROLLBACK');
      throw err;
    }
  } catch (error) {
    console.error('Erro em POST /api/reset-data:', error);
    res.status(500).json({ error: error.message });
  }
});

app.use('/api', (_req,res) => res.status(404).json({error:'Rota não encontrada'}));
const distDir=path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../dist');
app.use(express.static(distDir));
app.get('/{*splat}', (_req,res) => res.sendFile(path.join(distDir,'index.html')));

// Start server
const start = async () => {
  try {
    await initDb();
    console.log('[FinControl SQLite Server] Banco inicializado com sucesso.');
    const server = app.listen(PORT, '0.0.0.0', () => {
      console.log(`[FinControl SQLite Server] Rodando em http://localhost:${PORT}`);
    });
    server.on('error', (err) => {
      console.error('[FinControl SQLite Server] Erro no servidor:', err);
    });
  } catch (err) {
    console.error('[FinControl SQLite Server] Erro fatal ao iniciar:', err);
    process.exit(1);
  }
};

start();


