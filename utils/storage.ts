
import { 
  collection, 
  getDocs, 
  addDoc, 
  query, 
  orderBy, 
  doc, 
  setDoc, 
  getDoc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../services/firebase';
import { Transaction, User } from "../types";

export const getStoredTransactions = async (userId: string): Promise<Transaction[]> => {
  try {
    const q = query(
      collection(db, `users/${userId}/transactions`), 
      orderBy('date', 'desc')
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Transaction[];
  } catch (error) {
    console.error("Error fetching transactions:", error);
    return [];
  }
};

export const saveTransaction = async (userId: string, tx: Omit<Transaction, 'id'>): Promise<string> => {
  try {
    const docRef = await addDoc(collection(db, `users/${userId}/transactions`), tx);
    return docRef.id;
  } catch (error) {
    console.error("Error saving transaction:", error);
    throw error;
  }
};

export const saveUserProfile = async (user: User) => {
  try {
    await setDoc(doc(db, 'users', user.id), user, { merge: true });
  } catch (error) {
    console.error("Error saving user profile:", error);
  }
};

export const getUserProfile = async (userId: string): Promise<User | null> => {
  try {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    return docSnap.exists() ? docSnap.data() as User : null;
  } catch (error) {
    return null;
  }
};
