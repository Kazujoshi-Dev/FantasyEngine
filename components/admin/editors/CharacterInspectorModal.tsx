
import React from 'react';
import { GameData, AdminCharacterInfo } from '../../../types';

interface CharacterInspectorModalProps {
    characterInfo: AdminCharacterInfo;
    gameData: GameData;
    onClose: () => void;
    onHealCharacter: (id: number) => Promise<void>;
    onRegenerateCharacterEnergy: (id: number) => Promise<void>;
    onResetCharacterStats: (id: number) => Promise<void>;
    onResetCharacterProgress: (id: number) => Promise<void>;
    onDeleteCharacter: (id: number) => Promise<void>;
    onChangeUserPassword: (id: number, pass: string) => Promise<void>;
    onInspectCharacter: (char: any) => void;
}

export const CharacterInspectorModal: React.FC<CharacterInspectorModalProps> = (props) => {
    const handleAction = (action: (id: number) => Promise<void>) => {
        if(window.confirm('Are you sure?')) {
            action(props.characterInfo.user_id);
        }
    };

    const handleResetProgress = () => {
        if(window.confirm('REALLY reset progress?')) {
            props.onResetCharacterProgress(props.characterInfo.user_id);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-slate-800 p-6 rounded shadow-lg max-w-lg w-full">
                <button onClick={props.onClose} className="float-right text-gray-400 hover:text-white">X</button>
                <h2>Inspecting: {props.characterInfo.name}</h2>
                
                <div className="bg-slate-900/40 p-4 rounded-xl mt-4">
                    <h3 className="font-bold text-lg mb-3 text-gray-200">Akcje na Postaci</h3>
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => handleAction(props.onHealCharacter)} className="px-3 py-2 text-sm rounded bg-green-700 hover:bg-green-600">Ulecz</button>
                      <button onClick={() => handleAction(props.onRegenerateCharacterEnergy)} className="px-3 py-2 text-sm rounded bg-sky-700 hover:bg-sky-600">Zregeneruj Energię</button>
                      <button onClick={() => handleAction(props.onResetCharacterStats)} className="px-3 py-2 text-sm rounded bg-amber-700 hover:bg-amber-600">Resetuj Statystyki</button>
                      <button onClick={handleResetProgress} className="px-3 py-2 text-sm rounded bg-orange-700 hover:bg-orange-600 text-white font-bold border border-orange-500">Resetuj Postęp (Hard)</button>
                      <button onClick={() => handleAction(props.onDeleteCharacter)} className="px-3 py-2 text-sm rounded bg-red-800 hover:bg-red-700 col-span-2">Usuń Postać</button>
                    </div>
                </div>

                <div className="bg-slate-900/40 p-4 rounded-xl mt-4">
                    <h3>Other Info</h3>
                    {/* Placeholder for whatever was in the second div in snippet */}
                </div>
            </div>
        </div>
    );
};
