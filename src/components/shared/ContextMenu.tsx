
import React, { useEffect, useRef } from 'react';

interface ContextMenuProps {
    x: number;
    y: number;
    options: { label: string; action: () => void }[];
    onClose: () => void;
    item?: any;
    source?: any;
    fromSlot?: any;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, options, onClose }) => {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                onClose();
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [onClose]);

    if (options.length === 0) return null;

    // Adjust position if it goes off screen
    const adjustedX = Math.min(x, window.innerWidth - 160); // Assuming width ~160px
    const adjustedY = Math.min(y, window.innerHeight - (options.length * 40));

    return (
        <div 
            ref={menuRef}
            className="fixed z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-xl py-1 min-w-[150px]"
            style={{ top: adjustedY, left: adjustedX }}
        >
            {options.map((option, index) => (
                <button
                    key={index}
                    onClick={() => {
                        option.action();
                        onClose();
                    }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-slate-700 hover:text-white transition-colors"
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
};
