
import React, { useEffect } from 'react';

interface ContextMenuProps {
  x: number;
  y: number;
  options: { label: string; action: () => void }[];
  onClose: () => void;
}

export const ContextMenu: React.FC<ContextMenuProps> = ({ x, y, options, onClose }) => {
    useEffect(() => {
        const handleClick = () => {
            onClose();
        };
        document.addEventListener('click', handleClick, { once: true });
        return () => document.removeEventListener('click', handleClick);
    }, [onClose]);

    return (
        <div
            className="absolute z-20 bg-slate-900 border border-slate-700 rounded-md shadow-lg py-1 w-32 animate-fade-in"
            style={{ top: y, left: x }}
            onClick={(e) => e.stopPropagation()} // Prevent closing when clicking inside
        >
            {options.map((option, index) => (
                <button
                    key={index}
                    onClick={() => { option.action(); onClose(); }}
                    className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-indigo-600 hover:text-white"
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
};
