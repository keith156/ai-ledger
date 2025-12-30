
import React from 'react';

interface SummaryCardProps {
  label: string;
  amount: number;
  colorClass: string;
  icon: React.ReactNode;
}

export const SummaryCard: React.FC<SummaryCardProps> = ({ label, amount, colorClass, icon }) => {
  const formattedAmount = new Intl.NumberFormat().format(Math.abs(amount));
  
  return (
    <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 flex flex-col justify-between h-32">
      <div className="flex justify-between items-start">
        <span className="text-slate-500 font-medium text-sm">{label}</span>
        <div className={`p-1.5 rounded-lg opacity-80 ${colorClass.replace('text-', 'bg-').split('-').slice(0, 2).join('-')}-50 ${colorClass}`}>
          {icon}
        </div>
      </div>
      <div className={`text-2xl font-extrabold tracking-tight ${colorClass}`}>
        {amount < 0 ? '-' : ''}{formattedAmount}
      </div>
    </div>
  );
};
