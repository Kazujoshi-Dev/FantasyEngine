
import React from 'react';
import { SpyReportResult, GameData, EquipmentSlot } from '../types';
import { CoinsIcon } from './icons/CoinsIcon';
import { CombatantStatsPanel } from './combat/CombatSummary';
import { ItemDetailsPanel } from './shared/ItemSlot';
import { useTranslation } from '../contexts/LanguageContext';

interface SpyReportModalProps {
    report: SpyReportResult;
    onClose: () => void;
    gameData: GameData;
}

const slotOrder: EquipmentSlot[] = [
    EquipmentSlot.Head, EquipmentSlot.Chest, EquipmentSlot.Legs, EquipmentSlot.Feet, 
    EquipmentSlot.MainHand, EquipmentSlot.OffHand
];

export const SpyReportModal: React.FC<SpyReportModalProps> = ({ report, onClose, gameData }) => {
    const { t } = useTranslation();

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div 
                className="bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex justify-between items-center mb-4 border-b border-slate-700 pb-2">
                    <h2 className="text-2xl font-bold text-emerald-400">Raport Szpiegowski: {report.targetName}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
                </div>

                <div className="flex-grow overflow-y-auto pr-2 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Column 1: Wealth & Stats */}
                    <div className="space-y-6">
                        <div className="bg-slate-800/50 p-4 rounded-lg border border-amber-600/30 flex items-center justify-between">
                            <span className="text-gray-300 font-bold uppercase text-sm">Posiadane Złoto</span>
                            <span className="font-mono text-2xl text-amber-400 flex items-center gap-2">
                                {report.gold.toLocaleString()} <CoinsIcon className="h-6 w-6"/>
                            </span>
                        </div>
                        
                        <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700">
                             <h4 className="text-indigo-400 font-bold mb-3 border-b border-slate-700 pb-1">Statystyki Bojowe</h4>
                             {report.stats && <CombatantStatsPanel name={report.targetName} stats={report.stats} />}
                        </div>

                         <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 text-center">
                             <p className="text-gray-400 text-sm">Przedmiotów w plecaku: <span className="text-white font-bold">{report.inventoryCount}</span></p>
                        </div>
                    </div>

                    {/* Column 2: Equipment */}
                    <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-700 flex flex-col h-full">
                        <h4 className="text-sky-400 font-bold mb-3 border-b border-slate-700 pb-1">Wyposażenie</h4>
                        <div className="flex-grow overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                            {slotOrder.map(slot => {
                                const item = report.equipment ? report.equipment[slot] : null;
                                const template = item ? gameData.itemTemplates.find(t => t.id === item.templateId) : null;
                                
                                return (
                                    <div key={slot} className="p-2 bg-slate-900/50 rounded border border-slate-700/50">
                                        <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">{t(`equipment.slot.${slot}`)}</p>
                                        {item && template ? (
                                            <ItemDetailsPanel 
                                                item={item} 
                                                template={template} 
                                                affixes={gameData.affixes} 
                                                size="small" 
                                                compact={true} 
                                                showIcon={false}
                                            />
                                        ) : (
                                            <p className="text-sm text-gray-600 italic">Pusto</p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
