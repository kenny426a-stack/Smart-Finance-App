import { useState, useEffect, useRef } from 'react';
import { 
  Wallet, 
  TrendingUp, 
  Calendar, 
  MessageSquare, 
  Plus, 
  ArrowRight, 
  PieChart, 
  AlertCircle,
  CheckCircle2,
  RefreshCcw,
  PiggyBank,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FinancialState, Transaction } from './types';

const getMonthDaysInfo = (date: Date) => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  
  let totalWeekdays = 0;
  let totalWeekends = 0;
  let remainingWeekdays = 0;
  let remainingWeekends = 0;

  for (let d = 1; d <= lastDay; d++) {
    const current = new Date(year, month, d);
    const dayOfWeek = current.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (isWeekend) {
      totalWeekends++;
      if (d >= date.getDate()) remainingWeekends++;
    } else {
      totalWeekdays++;
      if (d >= date.getDate()) remainingWeekdays++;
    }
  }

  return { totalWeekdays, totalWeekends, remainingWeekdays, remainingWeekends };
};

const INITIAL_STATE: FinancialState = {
  income: 0,
  targetSavings: 0,
  livingExpenses: 0,
  weekdayPool: 0,
  weekendPool: 0,
  weekdayDaysLeft: 0,
  weekendDaysLeft: 0,
  rolloverToWeekend: 0,
  isInitialized: false,
};

export default function App() {
  const [state, setState] = useState<FinancialState>(() => {
    const saved = localStorage.getItem('finance_state');
    return saved ? JSON.parse(saved) : INITIAL_STATE;
  });

  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    const saved = localStorage.getItem('finance_transactions');
    return saved ? JSON.parse(saved) : [];
  });

  const [input, setInput] = useState('');
  const [showInvestDetails, setShowInvestDetails] = useState(false);
  const [messages, setMessages] = useState<{ text: string; sender: 'user' | 'coach'; type?: string }[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    localStorage.setItem('finance_state', JSON.stringify(state));
    localStorage.setItem('finance_transactions', JSON.stringify(transactions));
  }, [state, transactions]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (state.isInitialized) {
      const { remainingWeekdays, remainingWeekends } = getMonthDaysInfo(new Date());
      if (remainingWeekdays !== state.weekdayDaysLeft || remainingWeekends !== state.weekendDaysLeft) {
        setState(prev => ({
          ...prev,
          weekdayDaysLeft: remainingWeekdays,
          weekendDaysLeft: remainingWeekends
        }));
      }
    }
  }, [state.isInitialized, state.weekdayDaysLeft, state.weekendDaysLeft]);

  const addMessage = (text: string, sender: 'user' | 'coach', type: string = 'info') => {
    setMessages(prev => [...prev, { text, sender, type }]);
  };

  const handleInitialize = (income: number, savings: number) => {
    const livingExpenses = income - savings;
    const weekdayPool = livingExpenses * 0.45;
    const weekendPool = livingExpenses * 0.55;

    const { totalWeekdays, totalWeekends, remainingWeekdays, remainingWeekends } = getMonthDaysInfo(new Date());

    const newState: FinancialState = {
      income,
      targetSavings: savings,
      livingExpenses,
      weekdayPool,
      weekendPool,
      weekdayDaysLeft: remainingWeekdays,
      weekendDaysLeft: remainingWeekends,
      rolloverToWeekend: 0,
      isInitialized: true,
    };

    setState(newState);
    setTransactions([]);
    
    const dailyWeekday = (weekdayPool / totalWeekdays).toFixed(0);
    const dailyWeekend = (weekendPool / totalWeekends).toFixed(0);

    addMessage(`初始化成功！(本月週期：1號至月底)\n\n💰 月入：$${income}\n🎯 儲蓄：$${savings}\n🏠 生活費：$${livingExpenses}\n\n📅 本月平日總數：${totalWeekdays} 天\n🎉 本月週末總數：${totalWeekends} 天\n\n💡 平日每日預算：$${dailyWeekday}\n💡 週末每日預算：$${dailyWeekend}\n\n記住，平日省下的錢會自動滾入週末。祝你自律愉快。`, 'coach', 'success');
  };

  const handleExpense = (amount: number, category: string) => {
    if (!state.isInitialized) {
      addMessage('請先初始化你的財務狀況。', 'coach', 'error');
      return;
    }

    const now = new Date();
    const isWeekend = [0, 6].includes(now.getDay());
    const { remainingWeekdays, remainingWeekends } = getMonthDaysInfo(now);

    const newTransaction: Transaction = {
      id: Math.random().toString(36).substr(2, 9),
      amount,
      category,
      date: now.toISOString(),
      isWeekend,
    };

    setTransactions(prev => [newTransaction, ...prev]);

    setState(prev => {
      let updated = { ...prev };
      const currentRemaining = isWeekend ? remainingWeekends : remainingWeekdays;
      const dailyLimit = isWeekend 
        ? prev.weekendPool / currentRemaining
        : prev.weekdayPool / currentRemaining;

      if (isWeekend) {
        updated.weekendPool -= amount;
      } else {
        updated.weekdayPool -= amount;
        
        if (amount < dailyLimit) {
          const savings = dailyLimit - amount;
          updated.rolloverToWeekend += savings;
          updated.weekendPool += savings;
        }
      }
      
      updated.weekdayDaysLeft = remainingWeekdays;
      updated.weekendDaysLeft = remainingWeekends;
      
      return updated;
    });

    const currentRemaining = isWeekend ? remainingWeekends : remainingWeekdays;
    const dailyLimit = isWeekend 
      ? (state.weekendPool - amount) / currentRemaining 
      : (state.weekdayPool - amount) / currentRemaining;

    const advice = amount > 1000 
      ? "這筆支出有點驚人，你是打算把下個月的飯錢也吃掉嗎？" 
      : amount > dailyLimit 
        ? "超支警告！你今天的消費已經超過了平均限額，請克制。" 
        : "不錯的控制，省下的錢會讓你週末過得更體面。";
    
    addMessage(`記錄支出：$${amount} (${category})\n\n${advice}\n\n📊 當前池狀態：\n平日池剩餘：$${(isWeekend ? state.weekdayPool : state.weekdayPool - amount).toFixed(0)}\n週末池剩餘：$${(isWeekend ? state.weekendPool - amount : state.weekendPool).toFixed(0)}\n當日剩餘可用額度：$${Math.max(0, dailyLimit).toFixed(0)}\n週末基金增量：$${state.rolloverToWeekend.toFixed(0)}`, 'coach', amount > dailyLimit ? 'warning' : 'success');
  };

  const handleInvestmentStatus = () => {
    if (!state.isInitialized) {
      addMessage('請先初始化。', 'coach', 'error');
      return;
    }

    const investTotal = state.targetSavings * 0.6;
    const indexFunds = investTotal * 0.6;
    const cashFlow = investTotal * 0.3;
    const satellite = investTotal * 0.1;

    addMessage(`📈 投資配置分析 (6-3-1 法則)：\n\n總投資額：$${investTotal.toFixed(0)}\n\n1. 指數基金 (60%)：$${indexFunds.toFixed(0)} (建議：VOO/2800)\n2. 收息/現金流 (30%)：$${cashFlow.toFixed(0)} (建議：貨幣基金)\n3. 衛星投資 (10%)：$${satellite.toFixed(0)} (建議：高增長標的)\n\n💡 下一步行動：\n市場波動時，請保持冷靜。你的自律是最好的槓桿。`, 'coach', 'info');
  };

  const processCommand = (cmd: string) => {
    addMessage(cmd, 'user');
    
    const initMatch = cmd.match(/初始化：月入\s*(\d+),\s*儲蓄\s*(\d+)/);
    const expenseMatch = cmd.match(/支出：\s*(\d+),\s*(.+)/);
    const quickExpenseMatch = cmd.match(/^(\d+)\s+(.+)$/);
    
    if (initMatch) {
      handleInitialize(Number(initMatch[1]), Number(initMatch[2]));
    } else if (expenseMatch) {
      handleExpense(Number(expenseMatch[1]), expenseMatch[2]);
    } else if (quickExpenseMatch) {
      handleExpense(Number(quickExpenseMatch[1]), quickExpenseMatch[2]);
    } else if (cmd.includes('投資狀態')) {
      handleInvestmentStatus();
    } else {
      addMessage('我不明白這個指令。請使用：\n1. 初始化：月入 [金額], 儲蓄 [金額]\n2. 支出：[金額], [類別]\n3. 快速記帳：[金額] [類別] (例如：100 午餐)\n4. 投資狀態', 'coach', 'error');
    }
    setInput('');
  };

  const today = new Date().toISOString().split('T')[0];
  const todayTransactions = transactions.filter(t => t.date.split('T')[0] === today);
  const todaySpentWeekday = todayTransactions.filter(t => !t.isWeekend).reduce((sum, t) => sum + t.amount, 0);
  const todaySpentWeekend = todayTransactions.filter(t => t.isWeekend).reduce((sum, t) => sum + t.amount, 0);

  const dailyBudgetWeekday = state.weekdayDaysLeft > 0 ? (state.weekdayPool + todaySpentWeekday) / state.weekdayDaysLeft : 0;
  const dailyBudgetWeekend = state.weekendDaysLeft > 0 ? (state.weekendPool + todaySpentWeekend) / state.weekendDaysLeft : 0;

  const isWeekendToday = new Date().getDay() === 0 || new Date().getDay() === 6;
  const currentDailyBudget = isWeekendToday ? dailyBudgetWeekend : dailyBudgetWeekday;
  const currentTodaySpent = isWeekendToday ? todaySpentWeekend : todaySpentWeekday;
  const remainingTodayBudget = currentDailyBudget - currentTodaySpent;

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="bg-[#0A0A0A]/80 backdrop-blur-md border-b border-white/5 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
              <TrendingUp size={24} />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Smart Finance Coach</h1>
              <p className="text-xs text-white/40 font-medium uppercase tracking-wider">Professional Budgeting</p>
            </div>
          </div>
          {state.isInitialized && (
            <button 
              onClick={() => { if(confirm('重置所有數據？')) { setState(INITIAL_STATE); setTransactions([]); setMessages([]); } }}
              className="p-2 hover:bg-white/5 rounded-full transition-colors text-white/40 hover:text-red-400"
            >
              <RefreshCcw size={20} />
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Dashboard */}
        <div className="lg:col-span-7 space-y-6">
          {!state.isInitialized ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#151619] rounded-3xl p-8 border border-white/5 shadow-xl"
            >
              <h2 className="text-2xl font-semibold mb-2">歡迎，自律者。</h2>
              <p className="text-white/50 mb-8">請在右側對話框輸入初始化指令開始你的理財之旅。</p>
              <div className="space-y-4">
                <div className="p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10">
                  <p className="text-sm font-medium text-emerald-400 mb-1">範例指令：</p>
                  <code className="text-xs text-emerald-400/70 font-mono">初始化：月入 50000, 儲蓄 20000</code>
                </div>
              </div>
            </motion.div>
          ) : (
            <>
              {/* Top Summary & Quick Input Box */}
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-[#1A1B1E] p-6 rounded-3xl border border-emerald-500/20 shadow-2xl shadow-emerald-500/5 relative overflow-hidden"
              >
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-400">
                        <Wallet size={24} />
                      </div>
                      <div>
                        <h3 className="font-bold text-lg">今日預算概覽</h3>
                        <p className="text-xs text-white/40 uppercase tracking-widest font-bold">
                          {new Date().getDay() === 0 || new Date().getDay() === 6 ? 'Weekend Mode' : 'Weekday Mode'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className={`text-3xl font-bold ${remainingTodayBudget < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                        ${remainingTodayBudget.toFixed(0)}
                      </div>
                      <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold">今日剩餘可用</div>
                    </div>
                  </div>

                  <div className="space-y-2 mb-8">
                    <div className="flex justify-between text-xs font-bold text-white/60">
                      <span>今日消費進度</span>
                      <span className={remainingTodayBudget < 0 ? 'text-red-400' : 'text-emerald-400'}>
                        {Math.round((currentTodaySpent / (currentDailyBudget || 1)) * 100)}%
                      </span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (currentTodaySpent / (currentDailyBudget || 1)) * 100)}%` }}
                        className={`h-full transition-colors duration-500 ${remainingTodayBudget < 0 ? 'bg-red-500' : 'bg-emerald-500'}`}
                      />
                    </div>
                  </div>

                  {/* Quick Input */}
                  <form 
                    onSubmit={(e) => { e.preventDefault(); if(input.trim()) processCommand(input); }}
                    className="relative"
                  >
                    <input 
                      type="text"
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder="快速記帳 (例如：100 午餐)..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-5 pr-14 text-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none text-white placeholder:text-white/20"
                    />
                    <button 
                      type="submit"
                      className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95 flex items-center justify-center"
                    >
                      <ArrowRight size={20} />
                    </button>
                  </form>
                </div>
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-emerald-500/5 blur-3xl rounded-full" />
              </motion.div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-4">
                <motion.div 
                  whileHover={{ y: -2 }}
                  className="bg-[#151619] p-6 rounded-3xl border border-white/5 shadow-sm"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400">
                      <Calendar size={18} />
                    </div>
                    <span className="text-sm font-medium text-white/40">平日池 (45%)</span>
                  </div>
                  <div className="text-3xl font-light tracking-tight mb-1 text-white">
                    ${state.weekdayPool.toFixed(0)}
                  </div>
                  <div className="text-xs text-white/30 font-medium mb-4">
                    剩餘 {state.weekdayDaysLeft} 天 • 每日約 ${(state.weekdayPool / state.weekdayDaysLeft).toFixed(0)}
                  </div>
                  
                  {/* Progress Bars */}
                  <div className="space-y-3 pt-2 border-t border-white/5">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] uppercase tracking-wider text-white/30 font-bold">
                        <span>總剩餘金額</span>
                        <span>{Math.round((state.weekdayPool / (state.livingExpenses * 0.45 || 1)) * 100)}%</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (state.weekdayPool / (state.livingExpenses * 0.45 || 1)) * 100)}%` }}
                          className="h-full bg-blue-500"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>

                <motion.div 
                  whileHover={{ y: -2 }}
                  className="bg-[#151619] p-6 rounded-3xl border border-white/5 shadow-sm"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-8 h-8 bg-amber-500/10 rounded-lg flex items-center justify-center text-amber-400">
                      <Calendar size={18} />
                    </div>
                    <span className="text-sm font-medium text-white/40">週末池 (55%)</span>
                  </div>
                  <div className="text-3xl font-light tracking-tight mb-1 text-white">
                    ${state.weekendPool.toFixed(0)}
                  </div>
                  <div className="text-xs text-white/30 font-medium mb-4">
                    剩餘 {state.weekendDaysLeft} 天 • 每日約 ${(state.weekendPool / state.weekendDaysLeft).toFixed(0)}
                  </div>

                  {/* Progress Bars */}
                  <div className="space-y-3 pt-2 border-t border-white/5">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[10px] uppercase tracking-wider text-white/30 font-bold">
                        <span>總剩餘金額</span>
                        <span>{Math.round((state.weekendPool / (state.livingExpenses * 0.55 || 1)) * 100)}%</span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (state.weekendPool / (state.livingExpenses * 0.55 || 1)) * 100)}%` }}
                          className="h-full bg-amber-500"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Investment Card (Collapsible) */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-[#1A1B1E] text-white rounded-3xl shadow-2xl border border-white/5 relative overflow-hidden"
              >
                <button 
                  onClick={() => setShowInvestDetails(!showInvestDetails)}
                  className="w-full p-6 flex items-center justify-between hover:bg-white/5 transition-colors text-left"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center">
                      <TrendingUp size={20} className="text-emerald-400" />
                    </div>
                    <div>
                      <h3 className="font-medium">投資配置 (6-3-1)</h3>
                      <p className="text-xs text-white/40">基於儲蓄額的 60%</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <div className="text-xl font-light">${(state.targetSavings * 0.6).toFixed(0)}</div>
                      <div className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Total Investable</div>
                    </div>
                    <div className="text-white/20">
                      {showInvestDetails ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </div>
                  </div>
                </button>

                <AnimatePresence>
                  {showInvestDetails && (
                    <motion.div 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-6 pt-2 space-y-4 border-t border-white/5">
                        {[
                          { label: '指數基金 (60%)', value: 0.6, color: 'bg-emerald-500' },
                          { label: '收息/現金流 (30%)', value: 0.3, color: 'bg-blue-500' },
                          { label: '衛星投資 (10%)', value: 0.1, color: 'bg-amber-500' },
                        ].map((item, i) => (
                          <div key={i} className="flex justify-between items-center py-2 border-b border-white/5 last:border-0">
                            <span className="text-xs text-white/60">{item.label}</span>
                            <span className="text-sm font-medium text-white/90">${(state.targetSavings * 0.6 * item.value).toFixed(0)}</span>
                          </div>
                        ))}
                        <p className="text-[10px] text-white/20 italic mt-4">
                          * 建議定期平衡資產配置，以維持風險與收益的平衡。
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                
                {/* Decorative element */}
                <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-emerald-500/5 blur-3xl rounded-full pointer-events-none" />
              </motion.div>

              {/* Recent Transactions */}
              <div className="space-y-4">
                <h3 className="text-sm font-bold uppercase tracking-widest text-white/20 px-2">最近支出</h3>
                <div className="space-y-2">
                  <AnimatePresence initial={false}>
                    {transactions.length === 0 ? (
                      <div className="text-center py-12 text-white/10 italic">尚無支出記錄</div>
                    ) : (
                      transactions.slice(0, 5).map((t) => (
                        <motion.div 
                          key={t.id}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="bg-[#151619] p-4 rounded-2xl border border-white/5 flex items-center justify-between hover:bg-[#1A1B1E] transition-colors"
                        >
                          <div className="flex items-center gap-4">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${t.isWeekend ? 'bg-amber-500/10 text-amber-400' : 'bg-blue-500/10 text-blue-400'}`}>
                              {t.isWeekend ? <Calendar size={18} /> : <Wallet size={18} />}
                            </div>
                            <div>
                              <div className="font-medium text-white/90">{t.category}</div>
                              <div className="text-xs text-white/30">{new Date(t.date).toLocaleDateString()}</div>
                            </div>
                          </div>
                          <div className="text-lg font-medium text-white">-${t.amount}</div>
                        </motion.div>
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Column: Coach Chat */}
        <div className="lg:col-span-5 flex flex-col h-[calc(100vh-160px)] sticky top-24">
          <div className="bg-[#151619] rounded-3xl border border-white/5 shadow-2xl flex flex-col h-full overflow-hidden">
            {/* Chat Header */}
            <div className="p-4 border-b border-white/5 flex items-center gap-3 bg-[#151619]">
              <div className="relative">
                <div className="w-10 h-10 bg-emerald-500 rounded-full flex items-center justify-center text-white">
                  <MessageSquare size={20} />
                </div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-400 border-2 border-[#151619] rounded-full" />
              </div>
              <div>
                <div className="text-sm font-bold text-white">理財教練</div>
                <div className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Online • Rational</div>
              </div>
            </div>

            {/* Input Area (Moved to Top for convenience) */}
            <div className="p-4 bg-[#1A1B1E] border-b border-white/5">
              <form 
                onSubmit={(e) => { e.preventDefault(); if(input.trim()) processCommand(input); }}
                className="relative"
              >
                <input 
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="輸入指令 (例如：100 午餐)..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl py-4 pl-5 pr-14 text-sm focus:ring-2 focus:ring-emerald-500 transition-all outline-none text-white placeholder:text-white/20 shadow-inner"
                />
                <button 
                  type="submit"
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 w-10 h-10 bg-emerald-500 text-white rounded-xl shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all active:scale-95 flex items-center justify-center"
                >
                  <ArrowRight size={20} />
                </button>
              </form>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { label: '初始化', cmd: '初始化：月入 50000, 儲蓄 20000', icon: <PiggyBank size={12} /> },
                  { label: '記支出', cmd: '支出：150, 午餐', icon: <Wallet size={12} /> },
                  { label: '投資狀態', cmd: '投資狀態', icon: <TrendingUp size={12} /> },
                ].map((btn, i) => (
                  <button 
                    key={i}
                    onClick={() => setInput(btn.cmd)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 text-[10px] font-bold uppercase tracking-wider text-white/40 hover:text-emerald-400 hover:bg-emerald-500/10 transition-all border border-white/5"
                  >
                    {btn.icon}
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth bg-[#151619]/50"
            >
              {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-20">
                  <PiggyBank size={48} />
                  <p className="text-sm max-w-[200px]">
                    你好。我是你的理財教練。
                    請輸入指令開始管理你的財富。
                  </p>
                </div>
              )}
              {messages.map((msg, i) => (
                <motion.div 
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.sender === 'user' 
                      ? 'bg-emerald-500 text-white rounded-tr-none shadow-lg shadow-emerald-500/10' 
                      : msg.type === 'error'
                        ? 'bg-red-500/10 text-red-400 border border-red-500/20 rounded-tl-none'
                        : msg.type === 'warning'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-tl-none'
                          : 'bg-white/5 text-white/80 rounded-tl-none border border-white/5'
                  }`}>
                    {msg.text}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Footer removed as input moved to top */}
          </div>
        </div>
      </main>
    </div>
  );
}
