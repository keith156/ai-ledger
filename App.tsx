
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
  saveUser, 
  generateDemoData 
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
    <div className="fixed inset-0 z-50 bg-white flex flex-col p-8">
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

      <div className="space-y-6">
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

  // Auth related state
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
    const demoTxs = generateDemoData();
    saveUser(newUser);
    saveTransactions(demoTxs);
    setState({ user: newUser, transactions: demoTxs, isLoading: false });
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
      alert("I didn't quite catch that. Try 'Sold stock 5000'");
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

  // Logic to calculate who owes what
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
    // Only return those who still owe money (balance > 0)
    return Object.entries(balances)
      .filter(([_, bal]) => bal > 0)
      .map(([name, bal]) => ({ name, balance: bal }));
  }, [state.transactions]);

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
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="your@email.com"
                value={authData.email}
                onChange={e => setAuthData({...authData, email: e.target.value})}
              />
            </div>
            <button className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl shadow-lg hover:bg-slate-800 transition-all active:scale-[0.98]">
              Get Started
            </button>
          </form>
          <p className="text-center mt-6 text-xs text-slate-400">
            By continuing, you agree to our simple terms.
          </p>
        </div>
      </div>
    );
  }

  if (showOnboarding) {
    return <OnboardingSlider onFinish={() => setShowOnboarding(false)} />;
  }

  const today = new Date().toDateString();
  const todayTxs = state.transactions.filter(t => new Date(t.date).toDateString() === today);
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
    "Sold bread 5000",
    "Paid rent 100,000",
    "Bought fuel 20,000",
    "Musa owes me 15,000",
    "John paid back 5000",
    "Bought stock 45,000",
    "Paid salary 50,000"
  ];

  return (
    <div className="min-h-screen pb-48 max-w-lg mx-auto bg-slate-50 relative">
      <header className="px-6 pt-8 pb-4 bg-white border-b border-slate-100 flex justify-between items-center sticky top-0 z-20 h-20">
        <div className="flex items-center gap-3">
          {activeTab !== 'dashboard' && (
            <button 
              onClick={() => setActiveTab('dashboard')}
              className="p-2 -ml-2 rounded-full hover:bg-slate-50 text-slate-400 transition-colors"
            >
              <Icons.ChevronLeft />
            </button>
          )}
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">{state.user.businessName}</p>
            <h2 className="text-xl font-extrabold text-slate-900 leading-none">{getPageTitle()}</h2>
          </div>
        </div>
        <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 overflow-hidden">
          <Icons.Users />
        </div>
      </header>

      <main className="px-6 mt-6 space-y-6">
        {activeTab === 'dashboard' && (
          <>
            <div className="grid grid-cols-2 gap-4">
              <SummaryCard label="Money In (Today)" amount={incomeToday} colorClass={COLORS.income} icon={<Icons.ArrowUp />} />
              <SummaryCard label="Money Out (Today)" amount={expenseToday} colorClass={COLORS.expense} icon={<Icons.ArrowDown />} />
              <SummaryCard label="Profit (Today)" amount={profitToday} colorClass={COLORS.profit} icon={<Icons.Dashboard />} />
              <SummaryCard label="Total Debt" amount={totalDebtBalance} colorClass={COLORS.debt} icon={<Icons.Users />} />
            </div>

            {/* Generate Report Option */}
            <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
              <div>
                <h3 className="font-bold text-slate-800">Business Report</h3>
                <p className="text-xs text-slate-400">See your progress summary</p>
              </div>
              <button 
                onClick={() => setReportModal('select')}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md shadow-blue-100 flex items-center gap-2"
              >
                <Icons.FileText />
                Generate
              </button>
            </div>

            <div>
              <h3 className="text-lg font-bold text-slate-800 mb-4">Recent Activity</h3>
              <div className="space-y-1">
                {state.transactions.slice(0, 5).map(tx => (
                  <TransactionCard key={tx.id} transaction={tx} />
                ))}
              </div>
              <button 
                onClick={() => setActiveTab('history')}
                className="w-full text-center py-3 text-sm font-bold text-slate-400 hover:text-slate-600"
              >
                See All Transactions
              </button>
            </div>
          </>
        )}

        {activeTab === 'record' && (
          <div className="flex flex-col items-center justify-center pt-8 space-y-8 animate-in fade-in duration-500">
            <div className="text-center space-y-2">
              <div className="inline-block p-6 bg-slate-900 text-white rounded-[2rem] shadow-xl mb-4">
                <Icons.PlusSquare />
              </div>
              <h3 className="text-2xl font-black text-slate-900">How to record?</h3>
              <p className="text-slate-500 px-8">Type what happened or snap a receipt.</p>
            </div>

            <div className="flex gap-4 w-full px-2">
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="flex-1 bg-white border-2 border-dashed border-slate-200 p-6 rounded-3xl flex flex-col items-center gap-3 hover:border-blue-400 transition-colors"
              >
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Icons.Camera /></div>
                <span className="text-sm font-bold text-slate-700">Scan Receipt</span>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  accept="image/*" 
                  capture="environment" 
                  className="hidden" 
                />
              </button>
            </div>

            <div className="w-full overflow-hidden">
               <div className="flex gap-3 overflow-x-auto px-6 pb-4 scrollbar-hide no-scrollbar">
                {exampleChips.map((chip, idx) => (
                  <button 
                    key={idx}
                    onClick={() => {
                      setInputText(chip);
                      handleAction(chip);
                    }}
                    className="whitespace-nowrap bg-white border border-slate-200 px-5 py-3 rounded-2xl text-sm font-bold text-slate-700 shadow-sm active:bg-slate-50 transition-colors border-b-4 border-b-slate-100 active:border-b-0 active:translate-y-[1px]"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <div className="w-full p-6 bg-blue-50 rounded-3xl border border-blue-100">
               <h4 className="text-sm font-black text-blue-900 mb-2 uppercase tracking-tight">Pro Tips</h4>
               <ul className="text-sm text-blue-700 space-y-3 font-semibold">
                 <li className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                   "Sold [item] [price]" (e.g. Sold bread 5000)
                 </li>
                 <li className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                   "Paid [rent/fuel] [price]" (e.g. Paid rent 100,000)
                 </li>
                 <li className="flex items-center gap-2">
                   <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                   "[Name] owes me [price]" (e.g. Musa owes me 15,000)
                 </li>
               </ul>
            </div>
          </div>
        )}

        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">All Transactions</h3>
              <button className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1.5 rounded-full">Filter</button>
            </div>
            {state.transactions.length === 0 ? (
              <div className="text-center py-20 text-slate-400">No transactions recorded yet.</div>
            ) : (
              state.transactions.map(tx => <TransactionCard key={tx.id} transaction={tx} />)
            )}
          </div>
        )}

        {activeTab === 'debts' && (
          <div className="space-y-4">
             <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-800">Current Balances</h3>
            </div>
            {debtBalances.length === 0 ? (
               <div className="text-center py-20 text-slate-400">Everyone has paid!</div>
            ) : (
              debtBalances.map(({ name, balance }) => (
                <div key={name} className="bg-white p-4 rounded-xl border border-slate-100 flex items-center justify-between shadow-sm">
                  <div>
                    <h4 className="font-bold text-slate-800">{name}</h4>
                    <p className="text-xs text-slate-400">Owes you money</p>
                  </div>
                  <div className="text-right flex flex-col items-end">
                    <span className="font-bold text-amber-600 mb-1">{new Intl.NumberFormat().format(balance)}</span>
                    <button 
                      onClick={() => clearFullDebt(name, balance)}
                      className="text-[10px] uppercase font-black bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-lg border border-emerald-100 active:scale-95 transition-transform"
                    >
                      Clear All
                    </button>
                  </div>
                </div>
              ))
            )}
            <div className="p-4 bg-amber-50 rounded-xl border border-amber-100 text-xs text-amber-800 font-medium">
              💡 To record partial payments, type something like <b>"{debtBalances[0]?.name || 'Musa'} paid 2000"</b> on the Record tab.
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
           <div className="space-y-4">
              <h3 className="text-lg font-bold text-slate-800">Settings</h3>
              <div className="bg-white rounded-2xl border border-slate-100 divide-y divide-slate-50 overflow-hidden">
                <button className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-slate-50">
                  <span className="font-semibold text-slate-700">Currency</span>
                  <span className="text-slate-400 font-bold">UGX</span>
                </button>
                <button className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-slate-50">
                  <span className="font-semibold text-slate-700">Export Data (CSV)</span>
                  <Icons.ArrowUp />
                </button>
                <button className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-slate-50">
                  <span className="font-semibold text-slate-700">Help & Support</span>
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-xs">?</div>
                </button>
                <button 
                  onClick={() => {
                    localStorage.clear();
                    window.location.reload();
                  }}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-rose-50 text-rose-600"
                >
                  <span className="font-bold">Logout</span>
                </button>
              </div>
           </div>
        )}
      </main>

      {/* Report Modals */}
      {reportModal === 'select' && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-end justify-center">
          <div className="bg-white w-full max-w-lg rounded-t-[2.5rem] p-8 space-y-6 animate-in slide-in-from-bottom duration-300">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-900">Generate Report</h3>
              <button onClick={() => setReportModal(null)} className="p-2 text-slate-400 hover:text-slate-600">✕</button>
            </div>
            <p className="text-slate-500">How far back do you want to see your business data?</p>
            <div className="grid grid-cols-1 gap-3">
              {['daily', 'weekly', 'monthly'].map((type) => (
                <button 
                  key={type}
                  onClick={() => handleGenerateReport(type as any)}
                  className="w-full p-5 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-blue-50 text-left flex items-center justify-between transition-colors group"
                >
                  <span className="font-bold text-slate-700 capitalize group-hover:text-blue-700">{type} Report</span>
                  <Icons.ArrowUp />
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Floating Entry Bar - ONLY VISIBLE ON RECORD TAB */}
      {activeTab === 'record' && (
        <div className="fixed bottom-16 left-0 right-0 max-w-lg mx-auto px-4 pb-4 pt-2 bg-gradient-to-t from-slate-50 via-slate-50 to-transparent pointer-events-none z-30">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 p-3 pointer-events-auto flex items-center gap-2">
            {parsing && !pendingConfirm ? (
              <div className="flex-1 flex items-center justify-center gap-3 py-2 text-slate-500">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-bold">Kazi is reading...</span>
              </div>
            ) : pendingConfirm ? (
              <div className="flex-1 flex flex-col gap-2 p-2 animate-in fade-in slide-in-from-bottom-2 duration-300 pointer-events-auto">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-black bg-blue-100 text-blue-700 px-2 py-1 rounded">EXTRACTED DATA</span>
                  <button onClick={() => setPendingConfirm(null)} className="text-slate-400 text-xs">✕</button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-slate-400 uppercase font-black tracking-tight">{pendingConfirm.type || 'Transaction'}</p>
                    <p className="text-lg font-black text-slate-900 leading-tight">
                      {pendingConfirm.counterparty || pendingConfirm.category || 'General'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xl font-black text-slate-900">
                      {state.user?.currency} {new Intl.NumberFormat().format(pendingConfirm.amount || 0)}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={confirmTransaction} 
                  className="w-full bg-slate-900 text-white font-black py-4 rounded-xl shadow-lg mt-1 active:scale-95 transition-transform"
                >
                  Confirm & Save
                </button>
              </div>
            ) : (
              <>
                <input 
                  autoFocus
                  value={inputText}
                  onChange={e => setInputText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAction()}
                  placeholder="Tell me what happened..."
                  className="flex-1 px-4 py-2 focus:outline-none text-slate-800 font-medium"
                />
                <button 
                  onClick={() => handleAction()}
                  disabled={parsing || !inputText}
                  className={`p-3 rounded-xl transition-all ${parsing ? 'bg-slate-100 text-slate-300' : 'bg-slate-900 text-white shadow-lg active:scale-90'}`}
                >
                  <Icons.Send />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white border-t border-slate-100 flex justify-around items-end px-2 safe-bottom z-10 h-16">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${activeTab === 'dashboard' ? 'text-slate-900' : 'text-slate-400'}`}
        >
          <Icons.Dashboard />
          <span className="text-[10px] font-bold">Home</span>
        </button>
        <button 
          onClick={() => setActiveTab('history')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${activeTab === 'history' ? 'text-slate-900' : 'text-slate-400'}`}
        >
          <Icons.History />
          <span className="text-[10px] font-bold">Activity</span>
        </button>
        
        {/* Record tab */}
        <button 
          onClick={() => setActiveTab('record')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 relative -top-1 transition-all transform hover:scale-105 active:scale-95`}
        >
          <div className={`p-3 rounded-[1.2rem] shadow-lg border-2 border-slate-50 ${activeTab === 'record' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white'}`}>
            <Icons.Plus />
          </div>
          <span className={`text-[10px] font-black uppercase mt-1 ${activeTab === 'record' ? 'text-blue-600' : 'text-slate-400'}`}>Record</span>
        </button>

        <button 
          onClick={() => setActiveTab('debts')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${activeTab === 'debts' ? 'text-slate-900' : 'text-slate-400'}`}
        >
          <Icons.Users />
          <span className="text-[10px] font-bold">Debts</span>
        </button>
        <button 
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors ${activeTab === 'settings' ? 'text-slate-900' : 'text-slate-400'}`}
        >
          <Icons.Settings />
          <span className="text-[10px] font-bold">Settings</span>
        </button>
      </nav>

      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};

export default App;
