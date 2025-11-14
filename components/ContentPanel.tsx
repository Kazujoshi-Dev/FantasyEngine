import React from 'react';

interface ContentPanelProps {
  title: string;
  children: React.ReactNode;
}

export const ContentPanel: React.FC<ContentPanelProps> = ({ title, children }) => {
  return (
    <div className="bg-slate-800/30 rounded-xl shadow-2xl p-6 animate-fade-in">
      <h2 className="text-3xl font-bold text-white mb-6 pb-4 border-b border-slate-700/50">{title}</h2>
      <div>{children}</div>
    </div>
  );
};