
import React, { useState, useEffect } from 'react';
import { GameData, ItemRarity, EssenceType, CraftingSettings, ResourceCost } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';
import { getCampUpgradeCost, getWorkshopUpgradeCost } from '../../../logic/stats';
import { calculateCraftingCost } from '../../../logic/crafting_frontend_helper';

interface CraftingSettingsTabProps {
    gameData: GameData;
    onGameDataUpdate: (key: string, data: any) => void;
}

export const CraftingSettingsTab: React.FC<CraftingSettingsTabProps> = ({ gameData, onGameDataUpdate }) => {
    const { t } = useTranslation();
    const [settings, setSettings] = useState<CraftingSettings>({
        costs: {},
        workshopUpgrades: {}
    });

    // Load initial state either from DB or fallbacks
    useEffect(() => {
        const dbSettings = gameData.settings?.crafting;
        if (dbSettings) {
            setSettings(dbSettings);
        } else {
            // Generate defaults from current hardcoded logic to pre-fill
            const defaults: CraftingSettings = { costs: {}, workshopUpgrades: {} };
            
            // Rarity Costs
            Object.values(ItemRarity).forEach(r => {
                // Mock character for calculation (no class bonus)
                const cost = calculateCraftingCost(r, { characterClass: undefined } as any);
                defaults.costs[r] = { gold: cost.gold, essences: cost.essences };
            });

            // Workshop Levels (1-10 upgrades)
            for(let i=2; i<=10; i++) {
                const cost = getWorkshopUpgradeCost(i);
                defaults.workshopUpgrades[i] = { gold: cost.gold, essences: cost.essences };
            }
            setSettings(defaults);
        }
    }, [gameData]);

    const handleRarityCostChange = (rarity: ItemRarity, field: 'gold' | 'essence', value: any, essenceType?: EssenceType) => {
        setSettings(prev => {
            const current = prev.costs[rarity] || { gold: 0, essences: [] };
            let newEssences = [...current.essences];

            if (field === 'gold') {
                return { ...prev, costs: { ...prev.costs, [rarity]: { ...current, gold: parseInt(value) || 0 } } };
            } else if (field === 'essence' && essenceType) {
                 const idx = newEssences.findIndex(e => e.type === essenceType);
                 const amount = parseInt(value) || 0;
                 
                 if (amount <= 0 && idx > -1) {
                     newEssences.splice(idx, 1);
                 } else if (idx > -1) {
                     newEssences[idx].amount = amount;
                 } else if (amount > 0) {
                     newEssences.push({ type: essenceType, amount });
                 }
                 
                 return { ...prev, costs: { ...prev.costs, [rarity]: { ...current, essences: newEssences } } };
            }
            return prev;
        });
    };

    const handleWorkshopCostChange = (level: number, field: 'gold' | 'essence', value: any, essenceType?: EssenceType) => {
        setSettings(prev => {
            const current = prev.workshopUpgrades[level] || { gold: 0, essences: [] };
            let newEssences = [...current.essences];

            if (field === 'gold') {
                return { ...prev, workshopUpgrades: { ...prev.workshopUpgrades, [level]: { ...current, gold: parseInt(value) || 0 } } };
            } else if (field === 'essence' && essenceType) {
                 const idx = newEssences.findIndex(e => e.type === essenceType);
                 const amount = parseInt(value) || 0;
                 
                 if (amount <= 0 && idx > -1) {
                     newEssences.splice(idx, 1);
                 } else if (idx > -1) {
                     newEssences[idx].amount = amount;
                 } else if (amount > 0) {
                     newEssences.push({ type: essenceType, amount });
                 }
                 
                 return { ...prev, workshopUpgrades: { ...prev.workshopUpgrades, [level]: { ...current, essences: newEssences } } };
            }
            return prev;
        });
    };

    const handleSave = () => {
        // Deep merge with existing settings
        const newSettings = {
            ...(gameData.settings || {}),
            crafting: settings
        };
        onGameDataUpdate('settings', newSettings);
        alert('Zapisano ustawienia craftingu.');
    };

    const getEssenceAmount = (list: ResourceCost[], type: EssenceType) => {
        return list.find(e => e.type === type)?.amount || 0;
    };

    return (
        <div className="animate-fade-in space-y-8 pb-10">
            <div className="flex justify-between items-center">
                <h3 className="text-2xl font-bold text-indigo-400">Ekonomia Warsztatu</h3>
                <button onClick={handleSave} className="px-6 py-2 bg-green-700 hover:bg-green-600 rounded font-bold text-white shadow-lg">Zapisz Zmiany</button>
            </div>

            {/* CRAFTING COSTS */}
            <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700">
                <h4 className="text-xl font-bold text-amber-400 mb-4 border-b border-slate-700 pb-2">Koszty Wytwarzania (Crafting)</h4>
                <div className="space-y-6">
                    {Object.values(ItemRarity).map(rarity => {
                        const cost = settings.costs[rarity] || { gold: 0, essences: [] };
                        return (
                            <div key={rarity} className="bg-slate-800/50 p-4 rounded-lg">
                                <h5 className="font-bold text-white mb-2">{t(`rarity.${rarity}`)}</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
                                    <div>
                                        <label className="text-xs text-gray-400 block mb-1">Złoto</label>
                                        <input type="number" value={cost.gold} onChange={e => handleRarityCostChange(rarity, 'gold', e.target.value)} className="bg-slate-900 p-1.5 rounded border border-slate-600 w-full text-amber-400 font-mono" />
                                    </div>
                                    {Object.values(EssenceType).map(eType => (
                                        <div key={eType}>
                                            <label className="text-xs text-gray-400 block mb-1">{t(`resources.${eType}`)}</label>
                                            <input 
                                                type="number" 
                                                min="0"
                                                value={getEssenceAmount(cost.essences, eType)} 
                                                onChange={e => handleRarityCostChange(rarity, 'essence', e.target.value, eType)} 
                                                className="bg-slate-900 p-1.5 rounded border border-slate-600 w-full font-mono text-sm" 
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* WORKSHOP UPGRADES */}
            <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700">
                <h4 className="text-xl font-bold text-indigo-400 mb-4 border-b border-slate-700 pb-2">Koszty Ulepszeń Warsztatu</h4>
                <p className="text-sm text-gray-400 mb-4">Określ koszt przejścia na dany poziom. Np. "Poziom 2" to koszt ulepszenia z poziomu 1 na 2.</p>
                <div className="space-y-4">
                    {Array.from({length: 9}, (_, i) => i + 2).map(level => {
                        const cost = settings.workshopUpgrades[level] || { gold: 0, essences: [] };
                        return (
                             <div key={level} className="bg-slate-800/50 p-4 rounded-lg">
                                <h5 className="font-bold text-white mb-2">Poziom {level}</h5>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-center">
                                    <div>
                                        <label className="text-xs text-gray-400 block mb-1">Złoto</label>
                                        <input type="number" value={cost.gold} onChange={e => handleWorkshopCostChange(level, 'gold', e.target.value)} className="bg-slate-900 p-1.5 rounded border border-slate-600 w-full text-amber-400 font-mono" />
                                    </div>
                                    {Object.values(EssenceType).map(eType => (
                                        <div key={eType}>
                                            <label className="text-xs text-gray-400 block mb-1">{t(`resources.${eType}`)}</label>
                                            <input 
                                                type="number" 
                                                min="0"
                                                value={getEssenceAmount(cost.essences, eType)} 
                                                onChange={e => handleWorkshopCostChange(level, 'essence', e.target.value, eType)} 
                                                className="bg-slate-900 p-1.5 rounded border border-slate-600 w-full font-mono text-sm" 
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>
            
            <div className="flex justify-end sticky bottom-4">
                <button onClick={handleSave} className="px-8 py-3 bg-green-700 hover:bg-green-600 rounded font-bold text-white shadow-xl border border-green-500">Zapisz Ustawienia</button>
            </div>
        </div>
    );
};
