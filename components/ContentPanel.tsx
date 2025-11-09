
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

// Add fade-in animation to tailwind config or a global style if possible.
// For this setup, we can add it in index.html, but it's not ideal.
// A simple way without config is to use CSS within a style tag, though this is an exception to the rules for demonstration.
// Better would be to have a tailwind.config.js with animation keyframes.
// Let's add the animation to index.html for simplicity in this constrained environment.
