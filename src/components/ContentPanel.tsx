
import React, { ReactNode } from 'react';

interface ContentPanelProps {
    title?: string;
    children: ReactNode;
    className?: string;
}

export const ContentPanel: React.FC<ContentPanelProps> = ({ title, children, className = '' }) => {
    return (
        <div className={`flex flex-col h-full ${className}`}>
            {title && (
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-700/50">
                    <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-cyan-400 drop-shadow-sm">
                        {title}
                    </h2>
                </div>
            )}
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar">
                {children}
            </div>
        </div>
    );
};
