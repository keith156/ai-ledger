import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
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
  saveUser
} from './utils/storage';
import { parseInputText, parseReceiptImage } from './services/geminiService';
import { Icons, COLORS } from './constants';
import { SummaryCard } from './components/SummaryCard';
import { TransactionCard } from './components/TransactionCard';

const OnboardingSlider: React.FC<{ onFinish: () => void }> = ({ onFinish }) => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const slides = [
    {
      title: "Welcome to Kazi Ledger",
      description: "Track your business money by just typing like you're sending a message.",
      examples: ["'Sold bread 5000'", "'Paid rent 300,000'"],
      icon: <div className="p-4 bg-blue-50 text-blue-600 rounded-full"><Icons.Dashboard /></div>
    },
    {
      title: "Record Anything",
      description: "Bought stock? Paid a worker? Just type it and we'll handle the math.",
      examples: ["'Bought fuel 20,000'", "'Paid transport 5000'"],
      icon: <div className="p-4 bg-emerald-50 text-emerald-600 rounded-full"><Icons.ArrowUp /></div>
    },
    {
      title: "Track Who Owes You",
      description: "Never forget a debt. Record credit sales instantly.",
      examples: ["'Musa owes me 15,000'", "'John paid back 5000'"],
      icon: <div className="p-4 bg-amber-50 text-amber-600 rounded-full"><Icons.Users /></div>
    }
  ];

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col p-8">
      <div className="flex-1 flex flex-col items-center justify-center text-center space-y-8">
        <div className="animate-bounce">
          {slides[currentSlide].icon}
        </div>
        <div>
          <h2 className="text-3xl font-extrabold text-slate-900 mb-4">{slides[currentSlide].title}</h2>
          <p className="text-slate-500 text-lg leading-relaxed">{slides[currentSlide].description}</p>
        </div>
        <div className="w-full space-y-3">
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Try typing like this:</p>
          {slides[currentSlide].examples.map((ex, i) => (
            <div key={i} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 font-mono text-slate-700 font-bold">
              {ex}
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6 safe-bottom">
        <div className="flex justify-center gap-2">
          {slides.map((_, i) => (
            <div key={i} className={`h-2 rounded-full transition-all duration-300 ${i === currentSlide ? 'w-8 bg-slate-900' : 'w-2 bg-slate-200'}`} />
          ))}
        </div>
        <button 
          onClick={() => {
            if (currentSlide < slides.length - 1) {
              setCurrentSlide(currentSlide + 1);
            } else {
              onFinish();
            }
          }}
          className="w-full bg-slate-900 text-white font-bold py-5 rounded-2xl shadow-xl active:scale-[0.98] transition-all"
        >
          {currentSlide === slides.length - 1 ? "Start Recording" : "Next"}
        </button>
      </div>
    </div>
  );
};

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    user: null,
    transactions: [],
    isLoading: true,
  });
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'record' | 'debts' | 'settings'>('dashboard');
  const [inputText, setInputText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [pendingConfirm, setPendingConfirm] = useState<ParseResult | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [reportModal, setReportModal] = useState<'select' | 'view' | null>(null);
  const [reportType, setReportType] = useState<'daily' | 'weekly' | 'monthly' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [authData, setAuthData] = useState({ email: '', business: '' });

  useEffect(() => {
    const user = getStoredUser();
    const txs = getStoredTransactions();
    
    if (user) {
      setState({ user, transactions: txs, isLoading: false });
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const newUser: User = { 
      id: Math.random().toString(), 
      email: authData.email, 
      businessName: authData.business || 'My Business',
      currency: 'UGX'
    };
    saveUser(newUser);
    saveTransactions([]); 
    setState({ user: newUser, transactions: [], isLoading: false });
    setShowOnboarding(true);
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
      if (result.queryRange) {
        setActiveTab('history');
      }
      setInputText('');
    } else {
      alert("I didn't quite catch that. Try 'Sold bread 5000'");
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
          alert("Couldn't read receipt. Try another photo?");
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setParsing(false);
      alert("Error scanning photo.");
    }
  };

  const confirmTransaction = () => {
    if (!pendingConfirm) return;
    
    const newTx: Transaction = {
      id: Math.random().toString(),
      type: pendingConfirm.type || TransactionType.INCOME,
      amount: pendingConfirm.amount || 0,
      category: pendingConfirm.category || 'General',
      counterparty: pendingConfirm.counterparty,
      date: new Date().toISOString(),
    };

    const updated = [newTx, ...state.transactions];
    setState(prev => ({ ...prev, transactions: updated }));
    saveTransactions(updated);
    setPendingConfirm(null);
    setInputText('');
    setActiveTab('dashboard');
  };

  const clearFullDebt = (name: string, balance: number) => {
    const paymentTx: Transaction = {
      id: Math.random().toString(),
      type: TransactionType.DEBT_PAYMENT,
      amount: balance,
      category: 'Debt Clearance',
      counterparty: name,
      date: new Date().toISOString(),
    };
    const updated = [paymentTx, ...state.transactions];
    setState(prev => ({ ...prev, transactions: updated }));
    saveTransactions(updated);
  };

  const debtBalances = useMemo(() => {
    const balances: Record<string, number> = {};
    state.transactions.forEach(tx => {
      if (tx.counterparty) {
        const name = tx.counterparty.trim();
        if (!balances[name]) balances[name] = 0;
        
        if (tx.type === TransactionType.DEBT) {
          balances[name] += tx.amount;
        } else if (tx.type === TransactionType.DEBT_PAYMENT) {
          balances[name] -= tx.amount;
        }
      }
    });
    return Object.entries(balances)
      .filter(([_, bal]) => bal > 0)
      .map(([name, bal]) => ({ name, balance: bal }));
  }, [state.transactions]);

  const reportData = useMemo(() => {
    if (!reportType) return null;
    
    const now = new Date();
    const startDate = new Date();
    
    if (reportType === 'daily') {
      startDate.setHours(0, 0, 0, 0);
    } else if (reportType === 'weekly') {
      startDate.setDate(now.getDate() - 7);
    } else if (reportType === 'monthly') {
      startDate.setDate(now.getDate() - 30);
    }
    
    const filtered = state.transactions.filter(t => new Date(t.date) >= startDate);
    const directSales = filtered.filter(t => t.type === TransactionType.INCOME).reduce((sum, t) => sum + t.amount, 0);
    const debtRecovered = filtered.filter(t => t.type === TransactionType.DEBT_PAYMENT).reduce((sum, t) => sum + t.amount, 0);
    const totalIn = directSales + debtRecovered;
    const expenses = filtered.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + t.amount, 0);
    const newDebtIssued = filtered.filter(t => t.type === TransactionType.DEBT).reduce((sum, t) => sum + t.amount, 0);

    const categories: Record<string, number> = {};
    filtered.filter(t => t.type === TransactionType.EXPENSE).forEach(t => {
      categories[t.category] = (categories[t.category] || 0) + t.amount;
    });
    
    const topCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const profit = totalIn - expenses;
    const profitMargin = totalIn > 0 ? (profit / totalIn) * 100 : 0;
        
    return { 
      directSales, debtRecovered, totalIn, expenses, newDebtIssued,
      net: profit, profitMargin, topCategories, transactions: filtered,
      count: filtered.length, period: reportType 
    };
  }, [reportType, state.transactions]);

  if (state.isLoading) {
    return <div className="h-screen flex items-center justify-center font-bold text-slate-400">Loading Kazi Ledger...</div>;
  }

  if (!state.user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-slate-100">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-extrabold text-slate-900 mb-2">Kazi Ledger</h1>
            <p className="text-slate-500">Business tracking for the everyday owner.</p>
          </div>
          
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Business Name</label>
              <input 
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-[16px]"
                placeholder="e.g. Mama Mary's Shop"
                value={authData.business}
                onChange={e => setAuthData({...authData, business: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Email</label>
              <input 
                type="email"
                required
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-[16px]"
                placeholder="your@email.com"
                value={authData.email}
                onChange={e => setAuthData({...authData, email: e.target.value})}
              />
            </div>
            <button className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 transition-all active:scale-[0.98]">
              Get Started
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (showOnboarding) {
    return <OnboardingSlider onFinish={() => setShowOnboarding(false)} />;
  }

  const todayStr = new Date().toDateString();
  const todayTxs = state.transactions.filter(t => new Date(t.date).toDateString() === todayStr);
  const incomeToday = todayTxs.filter(t => t.type === TransactionType.INCOME || t.type === TransactionType.DEBT_PAYMENT).reduce((sum, t) => sum + t.amount, 0);
  const expenseToday = todayTxs.filter(t => t.type === TransactionType.EXPENSE).reduce((sum, t) => sum + t.amount, 0);
  const profitToday = incomeToday - expenseToday;
  const totalDebtBalance = debtBalances.reduce((sum, d) => sum + d.balance, 0);

  const getPageTitle = () => {
    switch (activeTab) {
      case 'history': return 'Activity Log';
      case 'record': return 'New Entry';
      case 'debts': return 'Debt Tracking';
      case 'settings': return 'Settings';
      default: return 'Dashboard';
    }
  };

  const handleGenerateReport = (type: 'daily' | 'weekly' | 'monthly') => {
    setReportType(type);
    setReportModal('view');
  };

  const exampleChips = [
    "Sold bread 5000", "Paid rent 100,000", "Bought fuel 20,000",
    "Musa owes me 15,000", "John paid back 5000", "Bought stock 45,000", "Paid salary 50,000"
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center w-full overflow-x-hidden">
      {/* Header Container - edge to edge bg */}
      <header className="w-full bg-white border-b border-slate-100 sticky top-0 z-40">
        <div className="max-w-lg mx-auto w-full px-6 h-20 flex justify-between items-center">
          <div className="flex items-center gap-3">
            {activeTab !== 'dashboard' && (
              <button onClick={() => setActiveTab('dashboard')} className="p-2 -ml-2 rounded-full hover:bg-slate-50 text-slate-400 active:scale-90 transition-transform">
                <Icons.ChevronLeft />
              </button>
            )}
            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{state.user.businessName}</p>
              <h2 className="text-xl font-extrabold text-slate-900 leading-none">{getPageTitle()}</h2>
            </div>
          </div>
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 overflow-hidden font-bold">
            {state.user.businessName[0]}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="w-full max-w-lg px-6 py-6 pb-48 flex-1">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <SummaryCard label="Money In" amount={incomeToday} colorClass={COLORS.income} icon={<Icons.ArrowUp />} />
              <SummaryCard label="Money Out" amount={expenseToday} colorClass={COLORS.expense} icon={<Icons.ArrowDown />} />
              <SummaryCard label="Profit Today" amount={profitToday} colorClass={COLORS.profit} icon={<Icons.Dashboard />} />
              <SummaryCard label="Total Debt" amount={totalDebtBalance} colorClass={COLORS.debt} icon={<Icons.Users />} />
            </div>
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div><h3 className="font-bold text-slate-800">Detailed Reports</h3><p className="text-xs text-slate-400">Analyze your cashflow</p></div>
              <button onClick={() => setReportModal('select')} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold active:scale-95 transition-transform"><Icons.FileText /></button>
            </div>
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800">Recent Activity</h3>
              <div className="space-y-1">
                {state.transactions.length === 0 ? <div className="py-12 text-center text-slate-400 text-sm italic">No entries yet.</div> : state.transactions.slice(0, 5).map(tx => <TransactionCard key={tx.id} transaction={tx} />)}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'record' && (
          <div className="flex flex-col items-center justify-center pt-8 space-y-8 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
              <div className="inline-block p-6 bg-slate-900 text-white rounded-[2rem] shadow-xl mb-4"><Icons.PlusSquare /></div>
              <h3 className="text-2xl font-black text-slate-900">New Record</h3>
              <p className="text-slate-500 px-8">Type the activity or scan a receipt.</p>
            </div>
            <div className="flex gap-4 w-full px-2">
              <button onClick={() => fileInputRef.current?.click()} className="flex-1 bg-white border-2 border-dashed border-slate-200 p-6 rounded-3xl flex flex-col items-center gap-3 active:bg-slate-50">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Icons.Camera /></div>
                <span className="text-sm font-bold text-slate-700">Scan Receipt</span>
                <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept="image/*" capture="environment" className="hidden" />
              </button>
            </div>
            <div className="w-full overflow-hidden">
               <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar">
                {exampleChips.map((chip, idx) => (
                  <button key={idx} onClick={() => { setInputText(chip); handleAction(chip); }} className="whitespace-nowrap bg-white border border-slate-200 px-5 py-3 rounded-2xl text-sm font-bold text-slate-700 shadow-sm active:bg-slate-100">{chip}</button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800">All Transactions</h3>
            {state.transactions.length === 0 ? <div className="text-center py-20 text-slate-400">No history found.</div> : state.transactions.map(tx => <TransactionCard key={tx.id} transaction={tx} />)}
          </div>
        )}

        {activeTab === 'debts' && (
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-800">Debt Balances</h3>
            {debtBalances.length === 0 ? <div className="text-center py-20 text-slate-400">All settled!</div> : debtBalances.map(({ name, balance }) => (
              <div key={name} className="bg-white p-4 rounded-xl border border-slate-100 flex items-center justify-between shadow-sm">
                <div><h4 className="font-bold text-slate-800">{name}</h4><p className="text-xs text-slate-400">Owes money</p></div>
                <div className="text-right flex flex-col items-end">
                  <span className="font-bold text-amber-600 mb-1">{new Intl.NumberFormat().format(balance)}</span>
                  <button onClick={() => clearFullDebt(name, balance)} className="text-[10px] uppercase font-black bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg active:scale-95 transition-transform">Clear</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'settings' && (
           <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800">Settings</h3>
              <div className="bg-white rounded-2xl border border-slate-100 divide-y overflow-hidden">
                <div className="px-6 py-4 flex justify-between items-center"><span className="font-semibold text-slate-700">Currency</span><span className="text-slate-400 font-bold">{state.user.currency}</span></div>
                <button onClick={() => { localStorage.clear(); window.location.reload(); }} className="w-full px-6 py-4 text-left hover:bg-rose-50 text-rose-600 font-bold active:bg-rose-100 transition-colors">Logout & Clear Data</button>
              </div>
           </div>
        )}
      </main>

      {/* Modals & Floating UI */}
      {reportModal === 'select' && (
        <div className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex items-end justify-center px-4 pb-8">
          <div className="bg-white w-full max-w-lg rounded-[2.5rem] p-8 space-y-6 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center"><h3 className="text-xl font-black text-slate-900">Audit</h3><button onClick={() => setReportModal(null)} className="p-2 text-slate-400">✕</button></div>
            <div className="grid grid-cols-1 gap-3">
              {['daily', 'weekly', 'monthly'].map((type) => (
                <button key={type} onClick={() => handleGenerateReport(type as any)} className="w-full p-5 rounded-2xl border border-slate-100 bg-slate-50 text-left flex justify-between items-center group active:bg-blue-50">
                  <span className="font-bold text-slate-700 capitalize">{type} Audit</span><Icons.ArrowUp />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {reportModal === 'view' && reportData && (
        <div className="fixed inset-0 z-[110] bg-slate-50 animate-in slide-in-from-bottom duration-300 flex flex-col overflow-x-hidden">
          <header className="w-full bg-white border-b sticky top-0 z-10">
            <div className="max-w-lg mx-auto w-full px-6 h-20 flex justify-between items-center">
              <button onClick={() => setReportModal('select')} className="p-2 -ml-2 text-slate-400 active:scale-90"><Icons.ChevronLeft /></button>
              <h3 className="text-lg font-black text-slate-900 capitalize">{reportData.period} Audit</h3>
              <button onClick={() => setReportModal(null)} className="p-2 text-slate-400 active:scale-90">✕</button>
            </div>
          </header>
          <div className="flex-1 overflow-y-auto w-full max-w-lg mx-auto p-6 space-y-8 no-scrollbar">
             <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] shadow-2xl space-y-6">
                <div><p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">Net Position</p><h4 className={`text-4xl font-black ${reportData.net >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{state.user.currency} {new Intl.NumberFormat().format(reportData.net)}</h4></div>
                <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-6">
                   <div><p className="text-slate-500 text-[10px] font-bold uppercase mb-1">Total Inflow</p><p className="text-emerald-400 font-black text-lg">{new Intl.NumberFormat().format(reportData.totalIn)}</p></div>
                   <div><p className="text-slate-500 text-[10px] font-bold uppercase mb-1">Total Outflow</p><p className="text-rose-400 font-black text-lg">{new Intl.NumberFormat().format(reportData.expenses)}</p></div>
                </div>
             </div>
             <div className="space-y-4"><h5 className="font-black text-slate-900 flex items-center gap-2"><div className="w-2 h-6 bg-slate-300 rounded-full" />Transaction Audit</h5><div className="space-y-2">{reportData.transactions.map(tx => <TransactionCard key={tx.id} transaction={tx} />)}</div></div>
          </div>
          <div className="p-6 bg-white border-t safe-bottom w-full flex justify-center">
            <button onClick={() => setReportModal(null)} className="w-full max-w-lg bg-slate-900 text-white py-4 rounded-2xl font-black active:scale-[0.98] transition-all">Close Audit</button>
          </div>
        </div>
      )}

      {/* Floating Record Input */}
      {activeTab === 'record' && (
        <div className="fixed bottom-16 left-0 right-0 w-full flex justify-center px-4 pb-4 pt-2 pointer-events-none z-50">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 pointer-events-auto flex items-center gap-2 w-full max-w-lg">
            {parsing && !pendingConfirm ? (
              <div className="flex-1 flex items-center justify-center gap-3 py-2 text-slate-500"><div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" /><span className="text-sm font-bold">Kazi is reading...</span></div>
            ) : pendingConfirm ? (
              <div className="flex-1 flex flex-col gap-2 p-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="flex justify-between items-center"><span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-1 rounded uppercase">Check Data</span><button onClick={() => setPendingConfirm(null)} className="text-slate-400 text-xs">✕</button></div>
                <div className="flex items-center justify-between"><div><p className="text-xs text-slate-400 uppercase font-black">{pendingConfirm.type}</p><p className="text-lg font-black text-slate-900">{pendingConfirm.counterparty || pendingConfirm.category}</p></div><div className="text-right"><p className="text-xl font-black text-slate-900">{state.user?.currency} {new Intl.NumberFormat().format(pendingConfirm.amount || 0)}</p></div></div>
                <button onClick={confirmTransaction} className="w-full bg-slate-900 text-white font-black py-4 rounded-xl shadow-lg mt-1 active:scale-95 transition-transform">Confirm & Save</button>
              </div>
            ) : (
              <>
                <input 
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAction()}
                  placeholder="Tell me what happened..."
                  className="flex-1 px-4 py-3 focus:outline-none text-slate-800 font-medium text-[16px]"
                />
                <button onClick={() => handleAction()} disabled={parsing || !inputText} className={`p-3 rounded-xl transition-all ${parsing ? 'bg-slate-100 text-slate-300' : 'bg-slate-900 text-white shadow-lg active:scale-90'}`}><Icons.Send /></button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Navigation - sticky to full viewport width */}
      <nav className="fixed bottom-0 left-0 right-0 w-full bg-white border-t border-slate-100 z-40">
        <div className="max-w-lg mx-auto flex justify-around items-end px-2 safe-bottom h-16">
          <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${activeTab === 'dashboard' ? 'text-slate-900' : 'text-slate-400'}`}><Icons.Dashboard /><span className="text-[10px] font-bold">Home</span></button>
          <button onClick={() => setActiveTab('history')} className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${activeTab === 'history' ? 'text-slate-900' : 'text-slate-400'}`}><Icons.History /><span className="text-[10px] font-bold">Activity</span></button>
          <button onClick={() => setActiveTab('record')} className={`flex flex-col items-center justify-center gap-1 flex-1 relative -top-1 transition-all transform`}><div className={`p-3 rounded-[1.2rem] shadow-lg ${activeTab === 'record' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white'}`}><Icons.Plus /></div><span className={`text-[10px] font-black uppercase mt-1 ${activeTab === 'record' ? 'text-blue-600' : 'text-slate-400'}`}>Record</span></button>
          <button onClick={() => setActiveTab('debts')} className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${activeTab === 'debts' ? 'text-slate-900' : 'text-slate-400'}`}><Icons.Users /><span className="text-[10px] font-bold">Debts</span></button>
          <button onClick={() => setActiveTab('settings')} className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${activeTab === 'settings' ? 'text-slate-900' : 'text-slate-400'}`}><Icons.Settings /><span className="text-[10px] font-bold">Settings</span></button>
        </div>
      </nav>
    </div>
  );
};

export default App;