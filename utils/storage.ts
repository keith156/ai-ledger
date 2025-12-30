import { Transaction, User } from "../types";

const USER_KEY = 'kazi_ledger_current_user';
const USERS_LIST_KEY = 'kazi_ledger_all_users';

export const getStoredTransactions = (userId: string): Transaction[] => {
  const data = localStorage.getItem(`kazi_ledger_txs_${userId}`);
  return data ? JSON.parse(data) : [];
};

export const saveTransactions = (userId: string, txs: Transaction[]) => {
  localStorage.setItem(`kazi_ledger_txs_${userId}`, JSON.stringify(txs));
};

export const getStoredUser = (): User | null => {
  const data = localStorage.getItem(USER_KEY);
  return data ? JSON.parse(data) : null;
};

export const saveUser = (user: User) => {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  
  // Also keep a list of known users for simulated "Switch Account"
  const allUsersStr = localStorage.getItem(USERS_LIST_KEY);
  const allUsers: User[] = allUsersStr ? JSON.parse(allUsersStr) : [];
  if (!allUsers.find(u => u.id === user.id)) {
    allUsers.push(user);
    localStorage.setItem(USERS_LIST_KEY, JSON.stringify(allUsers));
  }
};

export const clearAllData = () => {
  localStorage.clear();
  window.location.reload();
};

export const logoutUser = () => {
  localStorage.removeItem(USER_KEY);
  window.location.reload();
};
