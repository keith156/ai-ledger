import React from 'react';
import { Transaction, TransactionType } from '../types';
import { Icons, COLORS } from '../constants';

interface TransactionCardProps {
  transaction: Transaction;
  onDelete?: (id: string) => void;
}

export const TransactionCard: React.FC<TransactionCardProps> = ({ transaction, onDelete }) => {
  const isIncome = transaction.type === TransactionType.INCOME || transaction.type === TransactionType.DEBT_PAYMENT;
  const isDebt = transaction.type === TransactionType.DEBT;
  
  const formattedAmount = new Intl.NumberFormat().format(transaction.amount);
  const formattedDate = new Date(transaction.date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between mb-2 w-full max-w-full overflow-hidden">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <div className={`p-2 rounded-full flex-shrink-0 ${isIncome ? 'bg-emerald-50 text-emerald-600' : isDebt ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
          {isIncome ? <Icons.ArrowUp /> : isDebt ? <Icons.Users /> : <Icons.ArrowDown />}
        </div>
        <div className="min-w-0 flex-1">
          <h4 className="font-semibold text-slate-800 capitalize truncate">
            {transaction.counterparty ? `${transaction.counterparty}` : transaction.category}
          </h4>
          <p className="text-[10px] text-slate-400 font-medium truncate">
            {transaction.category} • {formattedDate}
          </p>
        </div>
      </div>
      <div className="text-right flex-shrink-0 pl-2">
        <span className={`font-bold text-base whitespace-nowrap ${isIncome ? COLORS.income : isDebt ? COLORS.debt : COLORS.expense}`}>
          {isIncome ? '+' : '-'}{formattedAmount}
        </span>
      </div>
    </div>
  );
};