import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { initDb, dbPath } from './db.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// User authentication header middleware
const requireUser = (req, res, next) => {
  const userId = req.headers['x-user-id'];
  if (!userId) {
    return res.status(401).json({ error: 'Usuário não autenticado' });
  }
  req.userId = String(userId);
  next();
};

app.use('/api', requireUser);

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
          payment_method, credit_card_id, installment_id, recurring_id, is_paid, custom_due_date
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          t.customDueDate || null
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
        custom_due_date = ?
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
        payment_method, credit_card_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      id,
      userId,
      data.description,
      data.amount,
      data.date,
      data.type,
      data.category,
      data.paymentMethod,
      data.creditCardId || null,
      'active'
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
    const mirrorTxId = randomUUID();

    await db.run('BEGIN TRANSACTION');
    try {
      await db.run(
        `INSERT INTO loans (
          id, user_id, type, person, initial_amount, paid_amount, date, description, status
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        loanId,
        userId,
        data.type,
        data.person,
        data.initialAmount,
        0,
        data.date,
        data.description,
        'active'
      );

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

      // Re-insert transactions
      if (Array.isArray(data.transactions)) {
        for (const t of data.transactions) {
          await db.run(
            `INSERT INTO transactions (
              id, user_id, description, amount, date, type, category,
              payment_method, credit_card_id, installment_id, recurring_id, is_paid, custom_due_date
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
            t.custom_due_date || t.customDueDate || null
          );
        }
      }

      // Re-insert recurring transactions
      if (Array.isArray(data.recurringTransactions)) {
        for (const r of data.recurringTransactions) {
          await db.run(
            `INSERT INTO recurring_transactions (
              id, user_id, description, amount, date, type, category,
              payment_method, credit_card_id, status
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            r.id,
            userId,
            r.description,
            r.amount,
            r.date,
            r.type,
            r.category,
            r.payment_method || r.paymentMethod,
            r.credit_card_id || r.creditCardId || null,
            r.status || 'active'
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

