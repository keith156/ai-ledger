
import { Transaction, TransactionType, User } from "../types";

const STORAGE_KEY = 'kazi_ledger_data';
const USER_KEY = 'kazi_ledger_user';

export const getStoredTransactions = (): Transaction[] => {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
};

export const saveTransactions = (txs: Transaction[]) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(txs));
};

export const getStoredUser = (): User | null => {
  const data = localStorage.getItem(USER_KEY);
  return data ? JSON.parse(data) : null;
};

export const saveUser = (user: User) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
};

export const clearAllData = () => {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(USER_KEY);
};

export const generateDemoData = (): Transaction[] => {
  const now = new Date();
  const day = (d: number) => {
    const date = new Date(now);
    date.setDate(now.getDate() - d);
    return date.toISOString();
  };

  return [
    { id: '1', type: TransactionType.INCOME, amount: 45000, category: 'Sales', date: day(0) },
    { id: '2', type: TransactionType.EXPENSE, amount: 12000, category: 'Stock', date: day(0) },
    { id: '3', type: TransactionType.INCOME, amount: 35000, category: 'Sales', date: day(1) },
    { id: '4', type: TransactionType.EXPENSE, amount: 8000, category: 'Transport', date: day(1) },
    { id: '5', type: TransactionType.DEBT, amount: 15000, category: 'Credit', counterparty: 'Musa', date: day(2) },
    { id: '6', type: TransactionType.EXPENSE, amount: 200000, category: 'Rent', date: day(5) },
  ];
};
