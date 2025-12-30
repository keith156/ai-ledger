import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Transaction, 
  TransactionType, 
  User, 
  ParseResult, 
  AppState 
} from './types';
import { 
  getStoredTransactions, 
  saveTransactions, 
  getStoredUser, 
  saveUser,
  logoutUser,
  clearAllData
} from './utils/storage';
import { parseInputText, parseReceiptImage } from './services/geminiService';
import { Icons, COLORS } from './constants';
import { SummaryCard } from './components/SummaryCard';
import { TransactionCard } from './components/TransactionCard';

const OnboardingSlider: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = [
    {
      title: "Welcome to Kazi",
      description: "Business tracking that's as easy as sending a WhatsApp message.",
      examples: ["'Sold bread 5000'", "'Paid rent 300,000'"],
      icon: <div className="p-4 bg-blue-50 text-blue-600 rounded-full"><Icons.Dashboard /></div>
    },
    {
      title: "Record Anything",
      description: "Purchases, sales, or bills. Just type it and we handle the math.",
      examples: ["'Bought fuel 20,000'", "'Paid transport 5000'"],
      icon: <div className="p-4 bg-emerald-50 text-emerald-600 rounded-full"><Icons.ArrowUp /></div>
    },
    {
      title: "Track Debts",
      description: "Never lose money again. Record credit sales and payments instantly.",
      examples: ["'Musa owes me 15,000'", "'John paid back 5000'"],
      icon: <div className="p-4 bg-amber-50 text-amber-600 rounded-full"><Icons.Users /></div>
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col p-8">
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8 max-w-sm mx-auto">
        <div className="animate-bounce">{slides[currentSlide].icon}</div>
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 mb-4">{slides[currentSlide].title}</h2>
          <p className="text-slate-500 text-lg leading-relaxed">{slides[currentSlide].description}</p>
        </div>
        <div className="w-full space-y-3">
          <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Try typing this:</p>
          {slides[currentSlide].examples.map((ex, i) => (
            <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 font-mono text-slate-700 font-bold text-sm">
              {ex}
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-6 safe-bottom max-w-sm mx-auto w-full">
        <div className="flex justify-center gap-2">
          {slides.map((_, i) => (
            <div key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === currentSlide ? 'w-8 bg-slate-900' : 'w-2 bg-slate-200'}`} />
          ))}
        </div>
        <button 
          onClick={() => currentSlide < slides.length - 1 ? setCurrentSlide(currentSlide + 1) : onFinish()}
          className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-transform"
        >
          {currentSlide === slides.length - 1 ? "Start Recording" : "Continue"}
        </button>
      </div>
    </div>
  );
};

const GoogleIcon = () => (
  <svg width="20" height="20" viewBox="0 0 18 18">
    <path fill="#4285F4" d="M17.64 9.2c0-.63-.06-1.25-.16-1.84H9v3.49h4.84c-.21 1.12-.84 2.07-1.79 2.7l2.85 2.21c1.67-1.53 2.64-3.79 2.64-6.56z"/>
    <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.85-2.21c-.79.53-1.8.85-3.11.85-2.39 0-4.41-1.61-5.14-3.77L.9 13.06C2.39 16.03 5.46 18 9 18z"/>
    <path fill="#FBBC05" d="M3.86 10.69c-.19-.57-.3-1.17-.3-1.79s.11-1.22.3-1.79L.9 4.85C.32 5.99 0 7.31 0 8.8s.32 2.81.9 3.95l2.96-2.06z"/>
    <path fill="#EA4335" d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0 5.46 0 2.39 1.97.9 4.94l2.96 2.06C4.59 5.19 6.61 3.58 9 3.58z"/>
  </svg>
);

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    user: null,
    transactions: [],
    isLoading: true,
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'record' | 'debts' | 'settings'>('dashboard');
  const [inputText, setInputText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<ParseResult | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [reportModal, setReportModal] = useState<'select' | 'view' | null>(null);
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [authForm, setAuthForm] = useState({ email: '', business: '' });

  // Initial Data Load
  useEffect(() => {
    const user = getStoredUser();
    if (user) {
      const txs = getStoredTransactions(user.id);
      setState({ user, transactions: txs, isLoading: false });
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const handleLogin = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!authForm.email || !authForm.business) return;

    const newUser: User = { 
      id: btoa(authForm.email).substring(0, 10), 
      email: authForm.email, 
      businessName: authForm.business,
      currency: 'UGX'
    };
    saveUser(newUser);
    const txs = getStoredTransactions(newUser.id);
    setState({ user: newUser, transactions: txs, isLoading: false });
    setShowOnboarding(txs.length === 0);
  };

  const handleGoogleSignup = () => {
    setIsAuthenticating(true);
    // Mimic official Google Auth behavior
    setTimeout(() => {
      const newUser: User = { 
        id: 'G-' + Math.random().toString(36).substr(2, 9), 
        email: 'tester.business@gmail.com', 
        businessName: 'My Enterprise',
        currency: 'UGX'
      };
      saveUser(newUser);
      const txs = getStoredTransactions(newUser.id);
      setState({ user: newUser, transactions: txs, isLoading: false });
      setIsAuthenticating(false);
      setShowOnboarding(txs.length === 0);
    }, 1200);
  };

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
    } else {
      alert("I couldn't understand that. Try: 'Sold bread 5000'");
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setParsing(true);
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const result = await parseReceiptImage(base64, file.type);
        setParsing(false);
        if (result.intent === 'RECORD') {
          setPendingConfirm(result);
        } else {
          alert("Couldn't read this receipt. Try taking a clearer photo.");
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setParsing(false);
      alert("System error reading file.");
    }
  };

  const confirmTransaction = () => {
    if (!pendingConfirm || !state.user) return;
    
    const newTx: Transaction = {
      id: Date.now().toString(),
      type: pendingConfirm.type || TransactionType.INCOME,
      amount: pendingConfirm.amount || 0,
      category: pendingConfirm.category || 'General',
      counterparty: pendingConfirm.counterparty,
      date: new Date().toISOString(),
    };

    const updated = [newTx, ...state.transactions];
    setState(prev => ({ ...prev, transactions: updated }));
    saveTransactions(state.user.id, updated);
    setPendingConfirm(null);
    setInputText('');
    setActiveTab('dashboard');
  };

  const clearFullDebt = (name: string, balance: number) => {
    if (!state.user) return;
    const paymentTx: Transaction = {
      id: Date.now().toString(),
      type: TransactionType.DEBT_PAYMENT,
      amount: balance,
      category: 'Settlement',
      counterparty: name,
      date: new Date().toISOString(),
    };
    const updated = [paymentTx, ...state.transactions];
    setState(prev => ({ ...prev, transactions: updated }));
    saveTransactions(state.user.id, updated);
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

  if (state.isLoading) return <div className="h-screen flex items-center justify-center font-bold text-slate-300 animate-pulse">Initializing Ledger...</div>;

  if (!state.user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 w-full">
        <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-2xl p-8 border border-slate-100 flex flex-col animate-in fade-in zoom-in duration-500">
          <div className="text-center mb-10">
            <div className="inline-block p-4 bg-slate-900 text-white rounded-3xl mb-4 shadow-lg"><Icons.Dashboard /></div>
            <h1 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">Kazi Ledger</h1>
            <p className="text-slate-400 font-medium">Smart business tools for smarter owners.</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <input 
              required
              className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 text-[16px] bg-slate-50/50"
              placeholder="Business Name"
              value={authForm.business}
              onChange={e => setAuthForm({...authForm, business: e.target.value})}
            />
            <input 
              type="email"
              required
              className="w-full px-5 py-4 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-slate-900 text-[16px] bg-slate-50/50"
              placeholder="Email Address"
              value={authForm.email}
              onChange={e => setAuthForm({...authForm, email: e.target.value})}
            />
            <button className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl active:scale-95 transition-transform">
              Get Started
            </button>
          </form>

          <div className="my-10 flex items-center gap-4">
            <div className="h-[1px] flex-1 bg-slate-100" />
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">or secure sign-in</span>
            <div className="h-[1px] flex-1 bg-slate-100" />
          </div>

          <button 
            onClick={handleGoogleSignup}
            disabled={isAuthenticating}
            className="w-full bg-white border border-slate-200 text-slate-700 font-bold py-4 rounded-2xl shadow-sm hover:bg-slate-50 active:scale-95 transition-all flex items-center justify-center gap-3"
          >
            {isAuthenticating ? <div className="w-5 h-5 border-2 border-slate-200 border-t-slate-900 rounded-full animate-spin" /> : <><GoogleIcon /><span>Continue with Google</span></>}
          </button>
        </div>
      </div>
    );
  }

  if (showOnboarding) return <OnboardingSlider onFinish={() => setShowOnboarding(false)} />;

  const todayStr = new Date().toDateString();
  const todayTxs = state.transactions.filter(t => new Date(t.date).toDateString() === todayStr);
  const incomeToday = todayTxs.filter(t => t.type === TransactionType.INCOME || t.type === TransactionType.DEBT_PAYMENT).reduce((sum, t) => sum + t.amount, 0);
  const expenseToday = todayTxs.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + t.amount, 0);
  const totalDebtBalance = debtBalances.reduce((sum, d) => sum + d.balance, 0);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center w-full overflow-x-hidden">
      {/* Universal Header - Fills Width */}
      <header className="w-full bg-white border-b border-slate-100 sticky top-0 z-40 shadow-sm">
        <div className="max-w-lg mx-auto w-full px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {activeTab !== 'dashboard' && (
              <button onClick={() => setActiveTab('dashboard')} className="p-2 -ml-2 rounded-full hover:bg-slate-50 text-slate-400 active:scale-90"><Icons.ChevronLeft /></button>
            )}
            <div className="min-w-0">
              <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest leading-none mb-1 truncate">{state.user.businessName}</p>
              <h2 className="text-xl font-extrabold text-slate-900 leading-none truncate">{activeTab.toUpperCase()}</h2>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center text-sm font-black flex-shrink-0 shadow-md">
            {state.user.businessName[0].toUpperCase()}
          </div>
        </div>
      </header>

      {/* Main Container - Centered and Padded */}
      <main className="w-full max-w-lg px-6 py-6 pb-48 flex-1 overflow-x-hidden">
        {activeTab === 'dashboard' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="grid grid-cols-2 gap-4">
              <SummaryCard label="Inflow" amount={incomeToday} colorClass={COLORS.income} icon={<Icons.ArrowUp />} />
              <SummaryCard label="Outflow" amount={expenseToday} colorClass={COLORS.expense} icon={<Icons.ArrowDown />} />
              <SummaryCard label="Daily Net" amount={incomeToday - expenseToday} colorClass={COLORS.profit} icon={<Icons.Dashboard />} />
              <SummaryCard label="Credit Book" amount={totalDebtBalance} colorClass={COLORS.debt} icon={<Icons.Users />} />
            </div>
            <div onClick={() => setReportModal('select')} className="bg-slate-900 p-6 rounded-3xl shadow-xl flex items-center justify-between text-white active:scale-[0.98] transition-all">
              <div className="min-w-0"><h3 className="font-black text-lg">Financial Audit</h3><p className="text-xs text-slate-400">View detailed health reports</p></div>
              <div className="bg-blue-600 p-3 rounded-xl"><Icons.FileText /></div>
            </div>
            <div className="space-y-4">
              <div className="flex justify-between items-center"><h3 className="text-lg font-black text-slate-900">Recent Logs</h3><button onClick={() => setActiveTab('history')} className="text-xs font-bold text-blue-600">View All</button></div>
              <div className="space-y-1">
                {state.transactions.length === 0 ? <div className="py-12 text-center text-slate-300 italic bg-white rounded-3xl border border-slate-100">Empty ledger. Try recording a sale.</div> : state.transactions.slice(0, 5).map(tx => <TransactionCard key={tx.id} transaction={tx} />)}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'record' && (
          <div className="flex flex-col items-center justify-center pt-10 space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center space-y-3">
              <div className="inline-block p-6 bg-slate-900 text-white rounded-[2.5rem] shadow-2xl mb-4"><Icons.PlusSquare /></div>
              <h3 className="text-3xl font-black text-slate-900">Add Entry</h3>
              <p className="text-slate-400 px-8 font-medium">Capture transactions by text or scan.</p>
            </div>
            <div className="w-full flex gap-4 px-2">
              <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-white border-2 border-dashed border-slate-200 p-8 rounded-[2rem] flex flex-col items-center gap-4 active:bg-slate-50 transition-colors">
                <div className="p-4 bg-blue-50 text-blue-600 rounded-2xl"><Icons.Camera /></div>
                <span className="text-sm font-black text-slate-800">Scan Invoice</span>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" capture="environment" className="hidden" />
              </button>
            </div>
            <div className="w-full overflow-hidden">
               <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-3 ml-2">Quick Actions</p>
               <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar px-1">
                {["Sold item 1000", "Paid rent 50k", "Bought supplies 15k", "Musa owes 10k"].map((chip, idx) => (
                  <button key={idx} onClick={() => { setInputText(chip); handleAction(chip); }} className="whitespace-nowrap bg-white border border-slate-200 px-6 py-4 rounded-2xl text-sm font-bold text-slate-700 shadow-sm active:bg-slate-900 active:text-white transition-all">{chip}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <h3 className="text-lg font-black text-slate-900">Transaction History</h3>
            {state.transactions.length === 0 ? <div className="text-center py-24 text-slate-300 italic">No history found.</div> : state.transactions.map(tx => <TransactionCard key={tx.id} transaction={tx} />)}
          </div>
        )}

        {activeTab === 'debts' && (
          <div className="space-y-4 animate-in fade-in duration-300">
            <h3 className="text-lg font-black text-slate-900">Active Receivables</h3>
            {debtBalances.length === 0 ? <div className="text-center py-24 text-slate-300 italic">Excellent! No pending debts.</div> : debtBalances.map(({ name, balance }) => (
              <div key={name} className="bg-white p-5 rounded-[1.5rem] border border-slate-100 flex items-center justify-between shadow-sm">
                <div className="min-w-0"><h4 className="font-black text-slate-900 truncate">{name}</h4><p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Owes you</p></div>
                <div className="text-right flex flex-col items-end flex-shrink-0 ml-4">
                  <span className="font-black text-amber-600 text-lg mb-1">{new Intl.NumberFormat().format(balance)}</span>
                  <button onClick={() => clearFullDebt(name, balance)} className="text-[10px] uppercase font-black bg-emerald-50 text-emerald-600 px-4 py-2 rounded-xl active:scale-90 transition-transform shadow-sm">Settle</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && (
           <div className="space-y-6 animate-in fade-in duration-300">
              <h3 className="text-lg font-black text-slate-900">Preferences</h3>
              <div className="bg-white rounded-[2rem] border border-slate-100 divide-y overflow-hidden shadow-sm">
                <div className="px-6 py-5 flex justify-between items-center"><span className="font-bold text-slate-600">Currency</span><span className="text-slate-900 font-black">{state.user.currency}</span></div>
                <div className="px-6 py-5 flex flex-col"><span className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Account</span><span className="font-bold text-slate-900">{state.user.email}</span></div>
                <button onClick={logoutUser} className="w-full px-6 py-6 text-left hover:bg-slate-50 text-slate-900 font-black active:bg-slate-100">Log Out</button>
                <button onClick={clearAllData} className="w-full px-6 py-6 text-left hover:bg-rose-50 text-rose-600 font-black active:bg-rose-100">Factory Reset & Wipe</button>
              </div>
              <p className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-[0.2em]">Kazi Ledger v1.0.4 PRO</p>
           </div>
        )}
      </main>

      {/* Audit Modal - Full Viewport Cover */}
      {reportModal === 'view' && reportData && (
        <div className="fixed inset-0 z-[120] bg-slate-50 flex flex-col animate-in slide-in-from-bottom duration-500 overflow-x-hidden">
          <header className="w-full bg-white border-b sticky top-0 z-10">
            <div className="max-w-lg mx-auto w-full px-6 h-20 flex justify-between items-center">
              <button onClick={() => setReportModal('select')} className="p-2 text-slate-400"><Icons.ChevronLeft /></button>
              <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter">{reportData.period} Audit</h3>
              <button onClick={() => setReportModal(null)} className="p-2 text-slate-400">✕</button>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto w-full max-w-lg mx-auto p-6 space-y-10 no-scrollbar">
             <div className="bg-slate-900 text-white p-10 rounded-[3rem] shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full -mr-10 -mt-10" />
                <p className="text-slate-400 text-xs font-black uppercase tracking-widest mb-2">Net Cash Position</p>
                <h4 className={`text-5xl font-black ${reportData.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{state.user.currency} {new Intl.NumberFormat().format(reportData.net)}</h4>
                <div className="grid grid-cols-2 gap-8 border-t border-slate-800 pt-8 mt-10">
                   <div><p className="text-slate-500 text-[10px] font-black uppercase mb-1">Inflow</p><p className="text-emerald-400 font-black text-xl">{new Intl.NumberFormat().format(reportData.totalIn)}</p></div>
                   <div><p className="text-slate-500 text-[10px] font-black uppercase mb-1">Outflow</p><p className="text-rose-400 font-black text-xl">{new Intl.NumberFormat().format(reportData.totalOut)}</p></div>
                </div>
             </div>
             <div className="space-y-6">
               <h5 className="font-black text-slate-900 flex items-center gap-2">Journal Entries</h5>
               <div className="space-y-2">
                 {reportData.transactions.map(tx => <TransactionCard key={tx.id} transaction={tx} />)}
               </div>
              </div>
          </div>
          <div className="p-6 bg-white border-t safe-bottom w-full flex justify-center"><button onClick={() => setReportModal(null)} className="w-full max-w-lg bg-slate-900 text-white py-5 rounded-[2rem] font-black shadow-xl">Close Report</button></div>
        </div>
      )}

      {/* Fixed Footer Nav */}
      <nav className="fixed bottom-0 left-0 right-0 w-full bg-white/90 backdrop-blur-md border-t border-slate-100 z-40">
        <div className="max-w-lg mx-auto flex justify-around items-end px-2 safe-bottom h-16">
          <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${activeTab === 'dashboard' ? 'text-slate-900' : 'text-slate-400'}`}><Icons.Dashboard /><span className="text-[10px] font-black uppercase tracking-tighter">Home</span></button>
          <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${activeTab === 'history' ? 'text-slate-900' : 'text-slate-400'}`}><Icons.History /><span className="text-[10px] font-black uppercase tracking-tighter">Log</span></button>
          <button onClick={() => setActiveTab('record')} className={`flex flex-col items-center justify-center gap-1 flex-1 relative -top-2 active:scale-90 transition-transform`}><div className={`p-4 rounded-[1.5rem] shadow-xl ${activeTab === 'record' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white'}`}><Icons.Plus /></div><span className={`text-[10px] font-black uppercase mt-1 ${activeTab === 'record' ? 'text-blue-600' : 'text-slate-400'}`}>New</span></button>
          <button onClick={() => setActiveTab('debts')} className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${activeTab === 'debts' ? 'text-slate-900' : 'text-slate-400'}`}><Icons.Users /><span className="text-[10px] font-black uppercase tracking-tighter">Debts</span></button>
          <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${activeTab === 'settings' ? 'text-slate-900' : 'text-slate-400'}`}><Icons.Settings /><span className="text-[10px] font-black uppercase tracking-tighter">Settings</span></button>
        </div>
      </nav>

      {/* Floating Entry Bar */}
      {activeTab === 'record' && (
        <div className="fixed bottom-16 left-0 right-0 w-full flex justify-center px-4 pb-4 pt-2 pointer-events-none z-50">
          <div className="bg-white rounded-[1.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.15)] border border-slate-100 p-2 pointer-events-auto flex items-center gap-2 w-full max-w-lg">
            {parsing && !pendingConfirm ? (
              <div className="flex-1 flex items-center justify-center gap-3 py-4 text-slate-500"><div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /><span className="text-sm font-black">AI is analyzing...</span></div>
            ) : pendingConfirm ? (
              <div className="flex-1 flex flex-col gap-3 p-4 animate-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-between items-center"><span className="text-[10px] font-black bg-blue-100 text-blue-700 px-3 py-1 rounded-full uppercase tracking-widest">Verify Detail</span><button onClick={() => setPendingConfirm(null)} className="text-slate-400 text-xs">✕</button></div>
                <div className="flex items-center justify-between"><div><p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">{pendingConfirm.type}</p><p className="text-xl font-black text-slate-900">{pendingConfirm.counterparty || pendingConfirm.category}</p></div><div className="text-right flex-shrink-0 ml-4"><p className="text-2xl font-black text-slate-900">{state.user?.currency} {new Intl.NumberFormat().format(pendingConfirm.amount || 0)}</p></div></div>
                <button onClick={confirmTransaction} className="w-full bg-slate-900 text-white font-black py-5 rounded-2xl shadow-xl mt-2 active:scale-95 transition-transform">Confirm Entry</button>
              </div>
            ) : (
              <>
                <input 
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAction()}
                  placeholder="Tell me what happened..."
                  className="flex-1 px-5 py-4 focus:outline-none text-slate-800 font-bold text-[16px] bg-transparent"
                  inputMode="text"
                />
                <button onClick={() => handleAction()} disabled={parsing || !inputText} className={`p-4 rounded-2xl transition-all ${parsing ? 'bg-slate-100 text-slate-300' : 'bg-slate-900 text-white shadow-lg active:scale-90'}`}><Icons.Send /></button>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Choice Modal */}
      {reportModal === 'select' && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center px-4 pb-8">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 space-y-6 animate-in slide-in-from-bottom duration-300 shadow-2xl">
            <div className="flex justify-between items-center"><h3 className="text-xl font-black text-slate-900">Choose Audit Period</h3><button onClick={() => setReportModal(null)} className="p-2 text-slate-400">✕</button></div>
            <div className="grid grid-cols-1 gap-3">
              {['daily', 'weekly', 'monthly'].map((type) => (
                <button key={type} onClick={() => { setReportType(type as any); setReportModal('view'); }} className="w-full p-6 rounded-3xl border border-slate-100 bg-slate-50 text-left flex justify-between items-center active:bg-blue-600 active:text-white transition-all group">
                  <span className="font-black text-slate-900 capitalize group-active:text-white">{type} Summary</span><Icons.ArrowUp />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;