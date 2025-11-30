
import React, { useState } from 'react';
import { GameData, AdminCharacterInfo } from '../../../types';
import { CharacterInspectorModal } from '../editors/CharacterInspectorModal';

interface UsersTabProps {
    allCharacters: any[];
    gameData: GameData;
    onHealCharacter: (id: number) => Promise<void>;
    onResetCharacterStats: (id: number) => Promise<void>;
    onResetCharacterProgress: (id: number) => Promise<void>;
    onDeleteCharacter: (id: number) => Promise<void>;
    onUpdateCharacterGold: (id: number, gold: number) => Promise<void>;
    onRegenerateCharacterEnergy: (id: number) => Promise<void>;
    onChangeUserPassword: (id: number, pass: string) => Promise<void>;
}

export const UsersTab: React.FC<UsersTabProps> = (props) => {
    const [inspectingChar, setInspectingChar] = useState<AdminCharacterInfo | null>(null);

    // Mocking onInspectCharacter since it wasn't in props but is used in snippet
    const onInspectCharacter = (char: any) => setInspectingChar(char);

    return (
        <div>
            <h3>Users Tab</h3>
            {/* ... other UI ... */}
            {inspectingChar && (
                <CharacterInspectorModal 
                  characterInfo={inspectingChar}
                  gameData={props.gameData}
                  onClose={() => setInspectingChar(null)}
                  onHealCharacter={props.onHealCharacter}
                  onRegenerateCharacterEnergy={props.onRegenerateCharacterEnergy}
                  onResetCharacterStats={props.onResetCharacterStats}
                  onResetCharacterProgress={props.onResetCharacterProgress}
                  onDeleteCharacter={props.onDeleteCharacter}
                  onChangeUserPassword={props.onChangeUserPassword}
                  onInspectCharacter={onInspectCharacter}
                />
            )}
        </div>
    );
};
