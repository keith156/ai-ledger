
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';
import { auth, googleProvider } from './services/firebase';
import { 
  Transaction, 
  TransactionType, 
  User, 
  ParseResult, 
  AppState 
} from './types';
import { 
  getStoredTransactions, 
  saveTransaction, 
  saveUserProfile,
  getUserProfile
} from './utils/storage';
import { parseInputText, parseReceiptImage } from './services/geminiService';
import { Icons, COLORS } from './constants';
import { SummaryCard } from './components/SummaryCard';
import { TransactionCard } from './components/TransactionCard';

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    user: null,
    transactions: [],
    isLoading: true,
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'record' | 'debts' | 'settings'>('dashboard');
  const [inputText, setInputText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<ParseResult | null>(null);
  const [reportModal, setReportModal] = useState<'select' | 'view' | null>(null);
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly' | null>(null);
  
  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setIsSyncing(true);
        try {
          // Fetch profile
          let profile = await getUserProfile(firebaseUser.uid);
          if (!profile) {
            profile = {
              id: firebaseUser.uid,
              email: firebaseUser.email || '',
              businessName: `${firebaseUser.displayName || 'My'}'s Business`,
              currency: 'UGX',
              picture: firebaseUser.photoURL || undefined
            };
            await saveUserProfile(profile);
          }
          
          // Fetch transactions
          const txs = await getStoredTransactions(firebaseUser.uid);
          setState({ user: profile, transactions: txs, isLoading: false });
        } catch (err) {
          console.error("Data load error:", err);
          setState(prev => ({ ...prev, isLoading: false }));
        } finally {
          setIsSyncing(false);
        }
      } else {
        setState({ user: null, transactions: [], isLoading: false });
      }
    });
    return () => unsubscribe();
  }, []);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
      alert("Please ensure your Google pop-up isn't blocked!");
    }
  };

  const handleLogout = () => signOut(auth);

  const handleAction = async (textOverride?: string) => {
    const textToParse = textOverride || inputText;
    if (!textToParse.trim()) return;
    
    setParsing(true);
    const result = await parseInputText(textToParse);
    setParsing(false);
    
    if (result.intent === 'RECORD') {
      setPendingConfirm(result);
      setActiveTab('record');
    } else if (result.intent === 'QUERY') {
      if (result.queryRange) setActiveTab('history');
      setInputText('');
    }
  };

  const confirmTransaction = async () => {
    if (!pendingConfirm || !state.user) return;
    
    const newTx: Omit<Transaction, 'id'> = {
      type: pendingConfirm.type || TransactionType.INCOME,
      amount: pendingConfirm.amount || 0,
      category: pendingConfirm.category || 'General',
      counterparty: pendingConfirm.counterparty,
      date: new Date().toISOString(),
    };

    setIsSyncing(true);
    try {
      const docId = await saveTransaction(state.user.id, newTx);
      const fullTx: Transaction = { ...newTx, id: docId };
      setState(prev => ({ ...prev, transactions: [fullTx, ...prev.transactions] }));
      setPendingConfirm(null);
      setInputText('');
      setActiveTab('dashboard');
    } finally {
      setIsSyncing(false);
    }
  };

  const settleDebt = async (name: string, balance: number) => {
    if (!state.user) return;
    const paymentTx: Omit<Transaction, 'id'> = {
      type: TransactionType.DEBT_PAYMENT,
      amount: balance,
      category: 'Settlement',
      counterparty: name,
      date: new Date().toISOString(),
    };
    setIsSyncing(true);
    try {
      const docId = await saveTransaction(state.user.id, paymentTx);
      const fullTx: Transaction = { ...paymentTx, id: docId };
      setState(prev => ({ ...prev, transactions: [fullTx, ...prev.transactions] }));
    } finally {
      setIsSyncing(false);
    }
  };

  const debtBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    state.transactions.forEach(tx => {
      if (tx.counterparty) {
        const name = tx.counterparty.trim();
        if (!balances[name]) balances[name] = 0;
        if (tx.type === TransactionType.DEBT) balances[name] += tx.amount;
        else if (tx.type === TransactionType.DEBT_PAYMENT) balances[name] -= tx.amount;
      }
    });
    return Object.entries(balances)
      .filter(([_, bal]) => bal > 0)
      .map(([name, bal]) => ({ name, balance: bal }));
  }, [state.transactions]);

  if (state.isLoading) return (
    <div className="h-screen flex flex-col items-center justify-center font-black text-slate-900 bg-white gap-4">
      <div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
      <span className="tracking-widest uppercase text-[10px]">Booting Kazi Cloud...</span>
    </div>
  );

  if (!state.user) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 w-full safe-top safe-bottom">
        <div className="w-full max-w-sm flex flex-col items-center animate-fade-in">
          <div className="mb-12 text-center">
            <div className="inline-block p-6 bg-slate-900 text-white rounded-[2.5rem] mb-6 shadow-2xl"><Icons.Dashboard /></div>
            <h1 className="text-5xl font-black text-slate-900 mb-3 tracking-tighter">Kazi</h1>
            <p className="text-slate-400 font-medium px-4">Your business records, synced to your Google Account.</p>
          </div>
          
          <div className="w-full space-y-4">
            <button 
              onClick={handleGoogleLogin}
              className="w-full bg-slate-900 text-white font-black py-5 rounded-3xl shadow-xl active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <Icons.PlusSquare />
              Sign in with Google
            </button>
            <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
              <p className="text-[11px] text-blue-700 font-bold text-center leading-tight">
                PRO TIP: Tap the Share icon on your phone and select "Add to Home Screen" for the full app experience.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const todayStr = new Date().toDateString();
  const todayTxs = state.transactions.filter(t => new Date(t.date).toDateString() === todayStr);
  const incomeToday = todayTxs.filter(t => t.type === TransactionType.INCOME || t.type === TransactionType.DEBT_PAYMENT).reduce((sum, t) => sum + t.amount, 0);
  const expenseToday = todayTxs.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + t.amount, 0);
  const totalDebtBalance = debtBalances.reduce((sum, d) => sum + d.balance, 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center w-full">
      <header className="w-full sticky top-0 bg-white/80 backdrop-blur-md border-b border-slate-100 z-40 safe-top">
        <div className="max-w-lg mx-auto px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {activeTab !== 'dashboard' && (
              <button onClick={() => setActiveTab('dashboard')} className="p-2 -ml-2 rounded-full text-slate-400 active:scale-75 transition-transform"><Icons.ChevronLeft /></button>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none truncate">{state.user.businessName}</p>
                {isSyncing && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />}
              </div>
              <h2 className="text-xl font-black text-slate-900 leading-none truncate capitalize">{activeTab}</h2>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-200 overflow-hidden shadow-inner flex-shrink-0">
            {state.user.picture ? <img src={state.user.picture} alt="P" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center font-black text-slate-400">{state.user.businessName[0].toUpperCase()}</div>}
          </div>
        </div>
      </header>

      <main className="w-full max-w-lg px-6 py-8 pb-48 flex-1">
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-2 gap-4">
              <SummaryCard label="Daily In" amount={incomeToday} colorClass={COLORS.income} icon={<Icons.ArrowUp />} />
              <SummaryCard label="Daily Out" amount={expenseToday} colorClass={COLORS.expense} icon={<Icons.ArrowDown />} />
              <SummaryCard label="Profit/Loss" amount={incomeToday - expenseToday} colorClass={COLORS.profit} icon={<Icons.Dashboard />} />
              <SummaryCard label="Credit" amount={totalDebtBalance} colorClass={COLORS.debt} icon={<Icons.Users />} />
            </div>
            
            <button onClick={() => setReportModal('select')} className="w-full bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl flex items-center justify-between text-white active:scale-[0.98] transition-all">
              <div className="text-left"><h3 className="font-black text-xl mb-1">Financial Health</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Generate Audit Report</p></div>
              <div className="bg-blue-600 p-4 rounded-2xl shadow-lg"><Icons.FileText /></div>
            </button>

            <div className="space-y-4 pt-4">
              <div className="flex justify-between items-center"><h3 className="text-lg font-black text-slate-900 tracking-tight">Recent Activity</h3><button onClick={() => setActiveTab('history')} className="text-xs font-black text-blue-600 uppercase tracking-widest">See All</button></div>
              <div className="space-y-2">
                {state.transactions.length === 0 ? <div className="py-20 text-center text-slate-300 font-bold italic bg-white rounded-[2rem] border-2 border-dashed border-slate-100">Empty Ledger</div> : state.transactions.slice(0, 5).map(tx => <TransactionCard key={tx.id} transaction={tx} />)}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-lg font-black text-slate-900">Historical Logs</h3>
            {state.transactions.length === 0 ? <div className="py-32 text-center text-slate-300 font-bold italic">No records found.</div> : state.transactions.map(tx => <TransactionCard key={tx.id} transaction={tx} />)}
          </div>
        )}

        {activeTab === 'debts' && (
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-lg font-black text-slate-900">Active Receivables</h3>
            {debtBalances.length === 0 ? <div className="py-32 text-center text-slate-300 font-bold italic">No outstanding debts.</div> : debtBalances.map(({ name, balance }) => (
              <div key={name} className="bg-white p-6 rounded-[2rem] border border-slate-100 flex items-center justify-between shadow-sm">
                <div className="min-w-0"><h4 className="font-black text-slate-900 text-lg mb-1">{name}</h4><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Owes you</p></div>
                <div className="text-right flex flex-col items-end flex-shrink-0 ml-4">
                  <span className="font-black text-amber-600 text-xl mb-2">{new Intl.NumberFormat().format(balance)}</span>
                  <button onClick={() => settleDebt(name, balance)} className="text-[10px] uppercase font-black bg-slate-900 text-white px-5 py-2.5 rounded-xl active:scale-90 transition-transform shadow-md">Settle All</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && (
           <div className="space-y-8 animate-fade-in">
              <h3 className="text-lg font-black text-slate-900">Preferences</h3>
              <div className="bg-white rounded-[2.5rem] border border-slate-100 divide-y divide-slate-50 overflow-hidden shadow-sm">
                <div className="px-8 py-6 flex justify-between items-center"><span className="font-bold text-slate-600">Base Currency</span><span className="text-slate-900 font-black tracking-tight">{state.user.currency}</span></div>
                <div className="px-8 py-6 flex flex-col"><span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-2">Connected Identity</span><div className="flex items-center gap-3"><div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center font-black text-[10px] uppercase">{state.user.email[0]}</div><span className="font-bold text-slate-900 truncate">{state.user.email}</span></div></div>
                <button onClick={handleLogout} className="w-full px-8 py-6 text-left hover:bg-slate-50 text-slate-900 font-black active:bg-slate-100 transition-colors">Sign Out</button>
              </div>
              <div className="text-center"><p className="text-[10px] font-black text-slate-200 uppercase tracking-[0.3em]">Built for Efficiency • v2.1-REAL</p></div>
           </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-100 z-50 safe-bottom">
        <div className="max-w-lg mx-auto flex justify-around items-end h-16 px-2">
          <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${activeTab === 'dashboard' ? 'text-slate-900' : 'text-slate-300'}`}><Icons.Dashboard /><span className="text-[9px] font-black uppercase tracking-widest">Home</span></button>
          <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${activeTab === 'history' ? 'text-slate-900' : 'text-slate-300'}`}><Icons.History /><span className="text-[9px] font-black uppercase tracking-widest">Log</span></button>
          <button onClick={() => setActiveTab('record')} className={`flex flex-col items-center justify-center gap-1 flex-1 relative -top-3 transition-transform active:scale-90`}><div className={`p-4 rounded-[1.8rem] shadow-2xl ${activeTab === 'record' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white'}`}><Icons.Plus /></div></button>
          <button onClick={() => setActiveTab('debts')} className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${activeTab === 'debts' ? 'text-slate-900' : 'text-slate-300'}`}><Icons.Users /><span className="text-[9px] font-black uppercase tracking-widest">Debts</span></button>
          <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${activeTab === 'settings' ? 'text-slate-900' : 'text-slate-300'}`}><Icons.Settings /><span className="text-[9px] font-black uppercase tracking-widest">Profile</span></button>
        </div>
      </nav>

      {activeTab === 'record' && (
        <div className="fixed bottom-20 left-0 right-0 w-full flex justify-center px-4 pb-4 z-50 pointer-events-none">
          <div className="bg-white rounded-[2rem] shadow-[0_32px_64px_rgba(0,0,0,0.15)] border border-slate-100 p-2 pointer-events-auto flex items-center gap-2 w-full max-w-lg animate-in slide-in-from-bottom duration-300">
            {parsing && !pendingConfirm ? (
              <div className="flex-1 flex items-center justify-center gap-3 py-4 text-slate-400"><div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /><span className="text-sm font-black uppercase tracking-widest">AI Thinking...</span></div>
            ) : pendingConfirm ? (
              <div className="flex-1 flex flex-col gap-4 p-6">
                <div className="flex justify-between items-center"><span className="text-[10px] font-black bg-blue-100 text-blue-700 px-3 py-1.2 rounded-full uppercase tracking-widest">Verify Record</span><button onClick={() => setPendingConfirm(null)} className="text-slate-300">✕</button></div>
                <div className="flex items-center justify-between"><div><p className="text-[10px] text-slate-300 uppercase font-black tracking-widest mb-1">{pendingConfirm.type}</p><p className="text-2xl font-black text-slate-900">{pendingConfirm.counterparty || pendingConfirm.category}</p></div><div className="text-right"><p className="text-3xl font-black text-slate-900">{state.user?.currency} {new Intl.NumberFormat().format(pendingConfirm.amount || 0)}</p></div></div>
                <button onClick={confirmTransaction} disabled={isSyncing} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all disabled:opacity-50">Confirm & Save</button>
              </div>
            ) : (
              <>
                <input 
                  autoFocus
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAction()}
                  placeholder="Tell Kazi what happened..."
                  className="flex-1 px-6 py-4 focus:outline-none text-slate-900 font-bold text-[16px] bg-transparent"
                />
                <button onClick={() => handleAction()} disabled={parsing || !inputText} className={`p-5 rounded-2xl transition-all ${parsing || !inputText ? 'bg-slate-50 text-slate-200' : 'bg-slate-900 text-white shadow-xl active:scale-75'}`}><Icons.Send /></button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
