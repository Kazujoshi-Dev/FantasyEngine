
import React from 'react';

interface ContentPanelProps {
  title: string;
  children: React.ReactNode;
}

export const ContentPanel: React.FC<ContentPanelProps> = ({ title, children }) => {
  return (
    <div 
        className="bg-slate-800/30 rounded-xl shadow-2xl p-6 animate-fade-in border border-slate-700/50"
        style={{ 
            backgroundImage: 'var(--window-bg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundBlendMode: 'overlay' // Ensures text remains readable if texture is bright
        }}
    >
      <h2 className="text-3xl font-bold text-white mb-6 pb-4 border-b border-slate-700/50 relative z-10">{title}</h2>
      <div className="relative z-10">{children}</div>
    </div>
  );
};
