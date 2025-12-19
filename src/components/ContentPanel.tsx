
import React, { ReactNode } from 'react';

interface ContentPanelProps {
    title?: string;
    children: ReactNode;
    className?: string;
}

export const ContentPanel: React.FC<ContentPanelProps> = ({ title, children, className = '' }) => {
    return (
        <div className={`flex flex-col h-full relative ${className}`}>
            {/* Top Ornate Border Overlay */}
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-fantasy-gold/20 to-transparent pointer-events-none"></div>
            
            {title && (
                <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
                    <div className="relative">
                        <h2 className="text-4xl fantasy-header font-black text-transparent bg-clip-text bg-gradient-to-b from-white via-gray-300 to-gray-500 drop-shadow-lg pr-12">
                            {title}
                        </h2>
                        <div className="absolute -bottom-1 left-0 w-3/4 h-1 bg-indigo-600 rounded-full blur-[1px]"></div>
                    </div>
                </div>
            )}
            
            <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar relative">
                {/* Subtle fantasy texture bg */}
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/dark-leather.png')] opacity-10 pointer-events-none"></div>
                <div className="relative z-10">
                    {children}
                </div>
            </div>
            
            {/* Corner Ornaments */}
            <div className="absolute top-0 right-0 w-8 h-8 border-t border-r border-fantasy-gold/10 rounded-tr-xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 w-8 h-8 border-b border-l border-fantasy-gold/10 rounded-bl-xl pointer-events-none"></div>
        </div>
    );
};
