import express from 'express';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { initDb } from './db.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

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
      budgetsRows,
      goalsRows,
      contributionsRows,
      categoriesRows,
    ] = await Promise.all([
      db.all('SELECT * FROM transactions WHERE user_id = ? ORDER BY date DESC, created_at DESC', userId),
      db.all('SELECT * FROM recurring_transactions WHERE user_id = ? ORDER BY date ASC', userId),
      db.all('SELECT * FROM credit_cards WHERE user_id = ? ORDER BY name ASC', userId),
      db.all('SELECT * FROM savings_transactions WHERE user_id = ? ORDER BY date DESC, created_at DESC', userId),
      db.all('SELECT * FROM loans WHERE user_id = ? ORDER BY date DESC', userId),
      db.all('SELECT * FROM loan_payments WHERE user_id = ? ORDER BY date DESC', userId),
      db.all('SELECT * FROM bills WHERE user_id = ? ORDER BY due_day ASC', userId),
      db.all('SELECT * FROM bill_payments WHERE user_id = ?', userId),
      db.all('SELECT * FROM budgets WHERE user_id = ?', userId),
      db.all('SELECT * FROM financial_goals WHERE user_id = ?', userId),
      db.all('SELECT * FROM goal_contributions WHERE user_id = ? ORDER BY date DESC', userId),
      db.all('SELECT * FROM custom_categories WHERE user_id = ? ORDER BY name ASC', userId),
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
      })),
      billPayments: billPaymentsRows.map(r => ({
        id: r.id,
        billId: r.bill_id,
        year: Number(r.year),
        month: Number(r.month),
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
          payment_method, credit_card_id, installment_id, recurring_id, is_paid
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
          t.isPaid ? 1 : 0
        );
      }
      await insertStmt.finalize();

      if (pendingBillPayment) {
        const paymentId = pendingBillPayment.id || randomUUID();
        await db.run(
          'INSERT INTO bill_payments (id, user_id, bill_id, year, month) VALUES (?, ?, ?, ?, ?)',
          paymentId,
          userId,
          pendingBillPayment.billId,
          pendingBillPayment.year,
          pendingBillPayment.month
        );
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
        is_paid = ?
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
      id,
      userId
    );

    res.json({ success: true });
  } catch (error) {
    console.error('Erro em PUT /api/transactions/:id:', error);
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
      'INSERT INTO credit_cards (id, user_id, name, closing_day, due_day, limit_amount) VALUES (?, ?, ?, ?, ?, ?)',
      id,
      userId,
      data.name,
      data.closingDay,
      data.dueDay,
      data.limit
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
      'UPDATE credit_cards SET name = ?, closing_day = ?, due_day = ?, limit_amount = ? WHERE id = ? AND user_id = ?',
      data.name,
      data.closingDay,
      data.dueDay,
      data.limit,
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

    await db.run(
      'INSERT INTO bills (id, user_id, name, due_day, estimated_amount, category, status) VALUES (?, ?, ?, ?, ?, ?, ?)',
      id,
      userId,
      data.name,
      data.dueDay,
      data.estimatedAmount,
      data.category,
      'active'
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
      'UPDATE bills SET name = ?, due_day = ?, estimated_amount = ?, category = ?, status = ? WHERE id = ? AND user_id = ?',
      data.name,
      data.dueDay,
      data.estimatedAmount,
      data.category,
      data.status || 'active',
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
    res.json({ success: true });
  } catch (error) {
    console.error('Erro em DELETE /api/bills/:id:', error);
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

