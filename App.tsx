
import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from './services/supabase';
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
  getUserProfile,
  logoutUser
} from './utils/storage';
import { parseInputText } from './services/geminiService';
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
  
  // Auth Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [businessNameInput, setBusinessNameInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);

  // Handle Supabase Auth Changes
  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      // Safety timeout: If auth check takes longer than 5 seconds, stop loading
      const timeout = setTimeout(() => {
        if (isMounted && state.isLoading) {
          setState(prev => ({ ...prev, isLoading: false }));
        }
      }, 5000);

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        clearTimeout(timeout);
        
        if (error) throw error;
        
        if (isMounted) {
          if (session) {
            await loadUserData(session.user.id, session.user.email!);
          } else {
            setState(prev => ({ ...prev, isLoading: false }));
          }
        }
      } catch (err: any) {
        console.error("Auth initialization failed:", err);
        if (isMounted) {
          setAuthError("Failed to connect to the server. Please refresh.");
          setState(prev => ({ ...prev, isLoading: false }));
        }
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (isMounted) {
        if (session) {
          await loadUserData(session.user.id, session.user.email!);
        } else {
          setState({ user: null, transactions: [], isLoading: false });
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadUserData = async (userId: string, userEmail: string) => {
    setIsSyncing(true);
    try {
      const profile = await getUserProfile(userId);
      const txs = await getStoredTransactions(userId);
      
      setState({ 
        user: profile ? { ...profile, email: userEmail } : { id: userId, email: userEmail, businessName: 'My Business', currency: 'UGX' }, 
        transactions: txs || [], 
        isLoading: false 
      });
    } catch (error) {
      console.error("Data load error:", error);
      setState(prev => ({ ...prev, isLoading: false }));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      if (isSignUp) {
        if (!businessNameInput.trim()) {
          throw new Error("Please enter your Business Name");
        }
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        
        if (data.user) {
          const newUser: User = {
            id: data.user.id,
            email: email,
            businessName: businessNameInput,
            currency: 'UGX'
          };
          await saveUserProfile(newUser);
          setState(prev => ({ ...prev, user: newUser, isLoading: false }));
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setAuthError(err.message);
      setState(prev => ({ ...prev, isLoading: false }));
    }
  };

  const handleAction = async (textOverride?: string) => {
    const textToParse = textOverride || inputText;
    if (!textToParse.trim()) return;
    
    setParsing(true);
    try {
      const result = await parseInputText(textToParse);
      if (result.intent === 'RECORD') {
        setPendingConfirm(result);
        setActiveTab('record');
      } else if (result.intent === 'QUERY') {
        if (result.queryRange) setActiveTab('history');
        setInputText('');
      }
    } catch (err) {
      console.error("AI Error:", err);
    } finally {
      setParsing(false);
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
    } catch (err: any) {
      alert("Error saving: " + err.message);
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
    } catch (err: any) {
      alert("Sync error: " + err.message);
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

  const reportData = useMemo(() => {
    if (!reportType) return null;
    const startDate = new Date();
    if (reportType === 'daily') startDate.setHours(0, 0, 0, 0);
    else if (reportType === 'weekly') startDate.setDate(startDate.getDate() - 7);
    else if (reportType === 'monthly') startDate.setDate(startDate.getDate() - 30);
    
    const filtered = state.transactions.filter(t => new Date(t.date) >= startDate);
    const income = filtered.filter(t => t.type === TransactionType.INCOME || t.type === TransactionType.DEBT_PAYMENT).reduce((sum, t) => sum + t.amount, 0);
    const expenses = filtered.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + t.amount, 0);
    return { net: income - expenses, totalIn: income, totalOut: expenses, transactions: filtered, period: reportType };
  }, [reportType, state.transactions]);

  if (state.isLoading) return (
    <div className="h-screen flex flex-col items-center justify-center font-black text-slate-900 bg-white gap-4">
      <div className="w-12 h-12 border-4 border-slate-900 border-t-transparent rounded-full animate-spin" />
      <span className="tracking-widest uppercase text-[10px]">Cloud Sync Active...</span>
    </div>
  );

  if (!state.user || (isSignUp && !state.user.businessName)) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-8 w-full safe-top safe-bottom">
        <div className="w-full max-w-sm flex flex-col items-center animate-fade-in">
          <div className="mb-8 text-center">
            <div className="inline-block p-6 bg-slate-900 text-white rounded-[2.5rem] mb-6 shadow-2xl"><Icons.Dashboard /></div>
            <h1 className="text-5xl font-black text-slate-900 mb-3 tracking-tighter">Kazi</h1>
            <p className="text-slate-400 font-medium px-4">Your intelligent cloud ledger</p>
          </div>
          
          <form onSubmit={handleAuth} className="w-full space-y-4">
            {isSignUp && (
              <input 
                required
                value={businessNameInput}
                onChange={e => setBusinessNameInput(e.target.value)}
                placeholder="Business Name"
                className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            )}
            <input 
              required
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email Address"
              className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <input 
              required
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full px-6 py-4 rounded-2xl border border-slate-100 bg-slate-50 text-slate-900 font-bold focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            {authError && (
              <div className="bg-rose-50 text-rose-600 p-4 rounded-xl text-xs font-bold border border-rose-100">
                {authError}
              </div>
            )}
            <button 
              type="submit"
              className="w-full bg-slate-900 text-white font-black py-5 rounded-3xl shadow-xl active:scale-95 transition-all"
            >
              {isSignUp ? 'Create My Account' : 'Sign In'}
            </button>
          </form>

          <button 
            onClick={() => {
              setIsSignUp(!isSignUp);
              setAuthError(null);
            }}
            className="mt-6 text-sm font-black text-blue-600 uppercase tracking-widest"
          >
            {isSignUp ? 'Already have an account? Log In' : 'New here? Create Account'}
          </button>
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
                <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none truncate">{state.user.businessName || 'Business'}</p>
                {isSyncing && <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />}
              </div>
              <h2 className="text-xl font-black text-slate-900 leading-none truncate capitalize">{activeTab}</h2>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-900 flex items-center justify-center text-white font-black text-sm shadow-lg">
            {(state.user.businessName || 'K')[0].toUpperCase()}
          </div>
        </div>
      </header>

      <main className="w-full max-w-lg px-6 py-8 pb-48 flex-1">
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-fade-in">
            <div className="grid grid-cols-2 gap-4">
              <SummaryCard label="Inflow Today" amount={incomeToday} colorClass={COLORS.income} icon={<Icons.ArrowUp />} />
              <SummaryCard label="Outflow Today" amount={expenseToday} colorClass={COLORS.expense} icon={<Icons.ArrowDown />} />
              <SummaryCard label="Day's Profit" amount={incomeToday - expenseToday} colorClass={COLORS.profit} icon={<Icons.Dashboard />} />
              <SummaryCard label="Credit Sales" amount={totalDebtBalance} colorClass={COLORS.debt} icon={<Icons.Users />} />
            </div>
            
            <button onClick={() => setReportModal('select')} className="w-full bg-slate-900 p-8 rounded-[2.5rem] shadow-2xl flex items-center justify-between text-white active:scale-[0.98] transition-all text-left">
              <div><h3 className="font-black text-xl mb-1">Business Audit</h3><p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">Generate Insights</p></div>
              <div className="bg-blue-600 p-4 rounded-2xl shadow-lg"><Icons.FileText /></div>
            </button>

            <div className="space-y-4 pt-4">
              <div className="flex justify-between items-center"><h3 className="text-lg font-black text-slate-900 tracking-tight">Latest Entries</h3><button onClick={() => setActiveTab('history')} className="text-xs font-black text-blue-600 uppercase tracking-widest">View All</button></div>
              <div className="space-y-2">
                {state.transactions.length === 0 ? <div className="py-20 text-center text-slate-300 font-bold italic bg-white rounded-[2rem] border-2 border-dashed border-slate-100">Ledger is empty</div> : state.transactions.slice(0, 5).map(tx => <TransactionCard key={tx.id} transaction={tx} />)}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-lg font-black text-slate-900">Historical Records</h3>
            {state.transactions.length === 0 ? <div className="py-32 text-center text-slate-300 font-bold italic">No data synced yet.</div> : state.transactions.map(tx => <TransactionCard key={tx.id} transaction={tx} />)}
          </div>
        )}

        {activeTab === 'debts' && (
          <div className="space-y-4 animate-fade-in">
            <h3 className="text-lg font-black text-slate-900">Credit Tracking</h3>
            {debtBalances.length === 0 ? <div className="py-32 text-center text-slate-300 font-bold italic">No outstanding balances.</div> : debtBalances.map(({ name, balance }) => (
              <div key={name} className="bg-white p-6 rounded-[2rem] border border-slate-100 flex items-center justify-between shadow-sm">
                <div className="min-w-0"><h4 className="font-black text-slate-900 text-lg mb-1">{name}</h4><p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Awaiting Payment</p></div>
                <div className="text-right flex flex-col items-end flex-shrink-0 ml-4">
                  <span className="font-black text-amber-600 text-xl mb-2">{new Intl.NumberFormat().format(balance)}</span>
                  <button onClick={() => settleDebt(name, balance)} className="text-[10px] uppercase font-black bg-slate-900 text-white px-5 py-2.5 rounded-xl active:scale-90 transition-transform shadow-md">Mark Paid</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && (
           <div className="space-y-8 animate-fade-in">
              <h3 className="text-lg font-black text-slate-900">Account Control</h3>
              <div className="bg-white rounded-[2.5rem] border border-slate-100 divide-y divide-slate-50 overflow-hidden shadow-sm">
                <div className="px-8 py-6 flex justify-between items-center"><span className="font-bold text-slate-600">Currency</span><span className="text-slate-900 font-black tracking-tight">{state.user?.currency}</span></div>
                <div className="px-8 py-6 flex flex-col"><span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">User Email</span><span className="font-bold text-slate-900 truncate">{state.user?.email}</span></div>
                <button onClick={logoutUser} className="w-full px-8 py-6 text-left hover:bg-rose-50 text-rose-600 font-black active:bg-rose-100 transition-colors">Log Out</button>
              </div>
              <div className="text-center p-6 bg-slate-900 rounded-[2.5rem] text-white">
                <p className="text-[11px] font-bold uppercase tracking-widest mb-2">Security: Supabase Protected</p>
                <p className="text-xs text-slate-400 leading-relaxed">Your business data is encrypted and synced across all your devices using enterprise-grade cloud security.</p>
              </div>
           </div>
        )}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-100 z-50 safe-bottom">
        <div className="max-w-lg mx-auto flex justify-around items-end h-16 px-2">
          <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${activeTab === 'dashboard' ? 'text-slate-900' : 'text-slate-300'}`}><Icons.Dashboard /><span className="text-[9px] font-black uppercase tracking-widest">Home</span></button>
          <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${activeTab === 'history' ? 'text-slate-900' : 'text-slate-300'}`}><Icons.History /><span className="text-[9px] font-black uppercase tracking-widest">Logs</span></button>
          <button onClick={() => setActiveTab('record')} className={`flex flex-col items-center justify-center gap-1 flex-1 relative -top-3 transition-transform active:scale-90`}><div className={`p-4 rounded-[1.8rem] shadow-2xl ${activeTab === 'record' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white'}`}><Icons.Plus /></div></button>
          <button onClick={() => setActiveTab('debts')} className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${activeTab === 'debts' ? 'text-slate-900' : 'text-slate-300'}`}><Icons.Users /><span className="text-[9px] font-black uppercase tracking-widest">Credit</span></button>
          <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${activeTab === 'settings' ? 'text-slate-900' : 'text-slate-300'}`}><Icons.Settings /><span className="text-[9px] font-black uppercase tracking-widest">Profile</span></button>
        </div>
      </nav>

      {activeTab === 'record' && (
        <div className="fixed bottom-20 left-0 right-0 w-full flex justify-center px-4 pb-4 z-50 pointer-events-none">
          <div className="bg-white rounded-[2rem] shadow-[0_32px_64px_rgba(0,0,0,0.15)] border border-slate-100 p-2 pointer-events-auto flex items-center gap-2 w-full max-w-lg animate-in slide-in-from-bottom duration-300">
            {parsing && !pendingConfirm ? (
              <div className="flex-1 flex items-center justify-center gap-3 py-4 text-slate-400"><div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /><span className="text-sm font-black uppercase tracking-widest">AI Syncing...</span></div>
            ) : pendingConfirm ? (
              <div className="flex-1 flex flex-col gap-4 p-6">
                <div className="flex justify-between items-center"><span className="text-[10px] font-black bg-blue-100 text-blue-700 px-3 py-1.2 rounded-full uppercase tracking-widest">Confirm Logic</span><button onClick={() => setPendingConfirm(null)} className="text-slate-300">✕</button></div>
                <div className="flex items-center justify-between"><div><p className="text-[10px] text-slate-300 uppercase font-black tracking-widest mb-1">{pendingConfirm.type}</p><p className="text-2xl font-black text-slate-900">{pendingConfirm.counterparty || pendingConfirm.category}</p></div><div className="text-right"><p className="text-3xl font-black text-slate-900">{state.user?.currency} {new Intl.NumberFormat().format(pendingConfirm.amount || 0)}</p></div></div>
                <button onClick={confirmTransaction} disabled={isSyncing} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-all disabled:opacity-50">Sync Record</button>
              </div>
            ) : (
              <>
                <input 
                  autoFocus
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAction()}
                  placeholder="Record sale or expense..."
                  className="flex-1 px-6 py-4 focus:outline-none text-slate-900 font-bold text-[16px] bg-transparent"
                />
                <button onClick={() => handleAction()} disabled={parsing || !inputText} className={`p-5 rounded-2xl transition-all ${parsing || !inputText ? 'bg-slate-50 text-slate-200' : 'bg-slate-900 text-white shadow-xl active:scale-75'}`}><Icons.Send /></button>
              </>
            )}
          </div>
        </div>
      )}

      {reportModal === 'select' && (
        <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-md flex items-end justify-center px-4 pb-8">
          <div className="bg-white w-full max-w-lg rounded-[3rem] p-10 space-y-8 animate-in slide-in-from-bottom duration-500 shadow-2xl">
            <div className="flex justify-between items-center"><h3 className="text-2xl font-black text-slate-900 tracking-tight">Audit Period</h3><button onClick={() => setReportModal(null)} className="text-slate-300 p-2">✕</button></div>
            <div className="grid grid-cols-1 gap-4">
              {['daily', 'weekly', 'monthly'].map((type) => (
                <button key={type} onClick={() => { setReportType(type as any); setReportModal('view'); }} className="w-full p-8 rounded-[2rem] border border-slate-50 bg-slate-50 text-left flex justify-between items-center active:bg-blue-600 active:text-white transition-all group">
                  <span className="font-black text-slate-900 text-lg capitalize group-active:text-white">{type} Audit</span><Icons.ArrowUp />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {reportModal === 'view' && reportData && (
        <div className="fixed inset-0 z-[120] bg-slate-50 flex flex-col animate-in slide-in-from-bottom duration-500 overflow-x-hidden">
          <header className="w-full bg-white border-b sticky top-0 z-10 safe-top">
            <div className="max-w-lg mx-auto w-full px-6 h-20 flex justify-between items-center">
              <button onClick={() => setReportModal('select')} className="p-2 text-slate-400"><Icons.ChevronLeft /></button>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">{reportData.period} Cloud Audit</h3>
              <button onClick={() => setReportModal(null)} className="p-2 text-slate-400">✕</button>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto w-full max-w-lg mx-auto p-6 space-y-10 no-scrollbar">
             <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-10 -mt-10" />
                <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">Net Cash Position</p>
                <h4 className={`text-5xl font-black ${reportData.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{state.user?.currency} {new Intl.NumberFormat().format(reportData.net)}</h4>
                <div className="grid grid-cols-2 gap-8 border-t border-slate-800 pt-8 mt-10">
                   <div><p className="text-slate-500 text-[10px] font-black uppercase mb-1">Total Inflow</p><p className="text-emerald-400 font-black text-xl">{new Intl.NumberFormat().format(reportData.totalIn)}</p></div>
                   <div><p className="text-slate-500 text-[10px] font-black uppercase mb-1">Total Outflow</p><p className="text-rose-400 font-black text-xl">{new Intl.NumberFormat().format(reportData.totalOut)}</p></div>
                </div>
             </div>
             <div className="space-y-6">
               <h5 className="font-black text-slate-900 flex items-center gap-2 px-2">Log Detail</h5>
               <div className="space-y-2 pb-12">
                 {reportData.transactions.length > 0 ? reportData.transactions.map(tx => <TransactionCard key={tx.id} transaction={tx} />) : <div className="p-12 text-center text-slate-400 font-bold italic">No records for this period.</div>}
               </div>
              </div>
          </div>
          <div className="p-6 bg-white border-t safe-bottom w-full flex justify-center"><button onClick={() => setReportModal(null)} className="w-full max-w-lg bg-slate-900 text-white py-5 rounded-[2rem] font-black shadow-xl active:scale-95 transition-transform">Done</button></div>
        </div>
      )}
    </div>
  );
};

export default App;
