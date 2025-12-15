
import React from 'react';
import { Enemy } from '../../types';

interface EnemyPreviewProps {
    floorNumber: number;
    enemies: Enemy[];
}

export const EnemyPreview: React.FC<EnemyPreviewProps> = ({ floorNumber, enemies }) => {
    return (
        <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-700 mb-4">
            <h5 className="text-sm font-bold text-gray-400 mb-3 border-b border-slate-700 pb-1 flex justify-between">
                <span>Piętro {floorNumber}</span>
                <span className="text-xs text-gray-500">{enemies.length} Przeciwników</span>
            </h5>
            
            {enemies.length === 0 ? (
                 <p className="text-gray-500 italic text-xs text-center py-2">Brak danych o wrogach (Losowe spotkanie)</p>
            ) : (
                <div className="flex flex-wrap gap-3 justify-center">
                    {enemies.map((e, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-1 group relative">
                            <div className={`w-12 h-12 rounded-lg flex items-center justify-center border-2 overflow-hidden bg-slate-800 ${e.isBoss ? 'border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'border-slate-600'}`}>
                                {e.image ? (
                                    <img src={e.image} className="w-full h-full object-cover" alt={e.name} />
                                ) : (
                                    <span className="text-xs font-bold text-gray-500">?</span>
                                )}
                            </div>
                            <span className={`text-[10px] font-bold max-w-[80px] truncate text-center ${e.isBoss ? 'text-red-400' : 'text-gray-300'}`}>
                                {e.name}
                            </span>
                            {/* Tooltip on hover */}
                            <div className="absolute bottom-full mb-2 bg-black/90 text-white text-xs p-2 rounded whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20 border border-slate-600">
                                <p className="font-bold text-amber-400">{e.name}</p>
                                <p>HP: {e.stats.maxHealth}</p>
                                <p>Dmg: {e.stats.minDamage}-{e.stats.maxDamage}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
