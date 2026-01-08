
import { supabase } from '../services/supabase';
import { Transaction, User, TransactionType } from "../types";

export const getStoredTransactions = async (userId: string): Promise<Transaction[]> => {
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false });

  if (error) {
    console.error("Fetch error:", error);
    return [];
  }
  return data as Transaction[];
};

export const saveTransaction = async (userId: string, tx: Omit<Transaction, 'id'>): Promise<string> => {
  const { data, error } = await supabase
    .from('transactions')
    .insert([{ ...tx, user_id: userId }])
    .select();

  if (error) throw error;
  return data[0].id;
};

export const saveUserProfile = async (user: User) => {
  const { error } = await supabase
    .from('profiles')
    .upsert({ 
      id: user.id, 
      business_name: user.businessName, 
      currency: user.currency 
    });
    
  if (error) console.error("Profile save error:", error);
};

export const getUserProfile = async (userId: string): Promise<User | null> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) return null;
  
  return {
    id: data.id,
    email: '', // Email comes from auth
    businessName: data.business_name,
    currency: data.currency
  };
};

export const logoutUser = async () => {
  await supabase.auth.signOut();
  window.location.reload();
};
