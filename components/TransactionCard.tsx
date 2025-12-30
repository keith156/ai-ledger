
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
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-100 flex items-center justify-between mb-2">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-full ${isIncome ? 'bg-emerald-50 text-emerald-600' : isDebt ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
          {isIncome ? <Icons.ArrowUp /> : isDebt ? <Icons.Users /> : <Icons.ArrowDown />}
        </div>
        <div>
          <h4 className="font-semibold text-slate-800 capitalize">
            {transaction.counterparty ? `${transaction.counterparty}` : transaction.category}
          </h4>
          <p className="text-xs text-slate-400 font-medium">
            {transaction.category} • {formattedDate}
          </p>
        </div>
      </div>
      <div className="text-right">
        <span className={`font-bold text-lg ${isIncome ? COLORS.income : isDebt ? COLORS.debt : COLORS.expense}`}>
          {isIncome ? '+' : '-'}{formattedAmount}
        </span>
      </div>
    </div>
  );
};
