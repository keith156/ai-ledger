
export enum TransactionType {
  INCOME = 'INCOME',
  EXPENSE = 'EXPENSE',
  DEBT = 'DEBT',
  DEBT_PAYMENT = 'DEBT_PAYMENT'
}

export interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  counterparty?: string;
  note?: string;
  date: string; // ISO string
}

export interface User {
  id: string;
  email: string;
  businessName: string;
  currency: string;
}

export interface ParseResult {
  intent: 'RECORD' | 'QUERY' | 'UNKNOWN';
  type?: TransactionType;
  amount?: number;
  category?: string;
  counterparty?: string;
  queryRange?: 'today' | 'week' | 'month';
  rawText: string;
}

export interface AppState {
  user: User | null;
  transactions: Transaction[];
  isLoading: boolean;
}
