export interface FinancialState {
  income: number;
  targetSavings: number;
  livingExpenses: number;
  weekdayPool: number;
  weekendPool: number;
  weekdayDaysLeft: number;
  weekendDaysLeft: number;
  isInitialized: boolean;
}

export interface Transaction {
  id: string;
  amount: number;
  category: string;
  date: string;
  isWeekend: boolean;
}

export interface CoachResponse {
  text: string;
  type: 'info' | 'success' | 'warning' | 'error';
}
