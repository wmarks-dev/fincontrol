import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'fincontrol.sqlite');

let dbPromise = null;

export async function initDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await open({
        filename: dbPath,
        driver: sqlite3.Database,
      });

      await db.exec('PRAGMA foreign_keys = ON;');
      await db.exec('PRAGMA journal_mode = WAL;');

      // Create Tables
      await db.exec(`
        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          description TEXT NOT NULL,
          amount REAL NOT NULL,
          date TEXT NOT NULL,
          type TEXT NOT NULL,
          category TEXT NOT NULL,
          payment_method TEXT NOT NULL,
          credit_card_id TEXT,
          installment_id TEXT,
          recurring_id TEXT,
          is_paid INTEGER DEFAULT 0,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);

        CREATE TABLE IF NOT EXISTS recurring_transactions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          description TEXT NOT NULL,
          amount REAL NOT NULL,
          date TEXT NOT NULL,
          type TEXT NOT NULL,
          category TEXT NOT NULL,
          payment_method TEXT NOT NULL,
          credit_card_id TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_recurring_user ON recurring_transactions(user_id);

        CREATE TABLE IF NOT EXISTS credit_cards (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          closing_day INTEGER NOT NULL,
          due_day INTEGER NOT NULL,
          limit_amount REAL NOT NULL,
          theme TEXT DEFAULT 'black',
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_cards_user ON credit_cards(user_id);

        CREATE TABLE IF NOT EXISTS savings_transactions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          amount REAL NOT NULL,
          date TEXT NOT NULL,
          description TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_savings_user ON savings_transactions(user_id);

        CREATE TABLE IF NOT EXISTS loans (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          person TEXT NOT NULL,
          initial_amount REAL NOT NULL,
          paid_amount REAL NOT NULL DEFAULT 0,
          date TEXT NOT NULL,
          description TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_loans_user ON loans(user_id);

        CREATE TABLE IF NOT EXISTS loan_payments (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          loan_id TEXT NOT NULL,
          amount REAL NOT NULL,
          date TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_loan_payments_user ON loan_payments(user_id);
        CREATE INDEX IF NOT EXISTS idx_loan_payments_loan ON loan_payments(loan_id);

        CREATE TABLE IF NOT EXISTS bills (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          due_day INTEGER NOT NULL,
          estimated_amount REAL NOT NULL,
          category TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'active',
          start_year INTEGER,
          start_month INTEGER,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_bills_user ON bills(user_id);

        CREATE TABLE IF NOT EXISTS bill_payments (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          bill_id TEXT NOT NULL,
          year INTEGER NOT NULL,
          month INTEGER NOT NULL,
          amount REAL,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_bill_payments_user ON bill_payments(user_id);

        CREATE TABLE IF NOT EXISTS bill_monthly_amounts (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          bill_id TEXT NOT NULL,
          year INTEGER NOT NULL,
          month INTEGER NOT NULL,
          amount REAL NOT NULL,
          created_at TEXT DEFAULT (datetime('now')),
          UNIQUE(user_id, bill_id, year, month)
        );
        CREATE INDEX IF NOT EXISTS idx_bill_monthly_amounts_user ON bill_monthly_amounts(user_id);

        CREATE TABLE IF NOT EXISTS budgets (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          category_id TEXT NOT NULL,
          amount REAL NOT NULL,
          month INTEGER NOT NULL,
          year INTEGER NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_budgets_user ON budgets(user_id);

        CREATE TABLE IF NOT EXISTS financial_goals (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          target_amount REAL NOT NULL,
          current_amount REAL NOT NULL DEFAULT 0,
          target_date TEXT,
          status TEXT NOT NULL DEFAULT 'active',
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_goals_user ON financial_goals(user_id);

        CREATE TABLE IF NOT EXISTS goal_contributions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          goal_id TEXT NOT NULL,
          savings_transaction_id TEXT NOT NULL,
          amount REAL NOT NULL,
          date TEXT NOT NULL,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_contributions_user ON goal_contributions(user_id);
        CREATE INDEX IF NOT EXISTS idx_contributions_goal ON goal_contributions(goal_id);

        CREATE TABLE IF NOT EXISTS custom_categories (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          icon TEXT NOT NULL,
          is_custom INTEGER DEFAULT 1,
          created_at TEXT DEFAULT (datetime('now'))
        );
        CREATE INDEX IF NOT EXISTS idx_categories_user ON custom_categories(user_id);
      `);

      // Migrations for existing databases
      try {
        await db.exec(`ALTER TABLE credit_cards ADD COLUMN theme TEXT DEFAULT 'black';`);
      } catch (e) {
        // column already exists, safe to ignore
      }

      try {
        await db.exec(`ALTER TABLE bill_payments ADD COLUMN amount REAL;`);
      } catch (e) {
        // column already exists, safe to ignore
      }

      try {
        await db.exec(`ALTER TABLE bills ADD COLUMN start_year INTEGER;`);
      } catch (e) {
        // column already exists, safe to ignore
      }

      try {
        await db.exec(`ALTER TABLE bills ADD COLUMN start_month INTEGER;`);
      } catch (e) {
        // column already exists, safe to ignore
      }

      try {
        await db.exec(`
          UPDATE bills
          SET start_year = CAST(strftime('%Y', COALESCE(created_at, datetime('now'))) AS INTEGER),
              start_month = CAST(strftime('%m', COALESCE(created_at, datetime('now'))) AS INTEGER) - 1
          WHERE start_year IS NULL;
        `);
      } catch (e) {
        // safe to ignore
      }

      return db;
    })();
  }
  return dbPromise;
}
