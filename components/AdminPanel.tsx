
import React from 'react';
import { GameData, PlayerCharacter, GameSettings } from '../types';
import { UsersTab } from './admin/tabs/UsersTab';

interface AdminPanelProps {
    gameData: GameData;
    allCharacters: any[];
    onDeleteUser: (id: number) => Promise<void>;
    onDeleteCharacter: (id: number) => Promise<void>;
    onResetCharacterStats: (id: number) => Promise<void>;
    onResetCharacterProgress: (id: number) => Promise<void>;
    onHealCharacter: (id: number) => Promise<void>;
    onUpdateCharacterGold: (id: number, gold: number) => Promise<void>;
    onForceTraderRefresh: () => void;
    onRegenerateCharacterEnergy: (id: number) => Promise<void>;
    onChangeUserPassword: (id: number, pass: string) => Promise<void>;
}

export const AdminPanel: React.FC<AdminPanelProps> = (props) => {
    // Mocking the tab switching logic to include the snippet
    const activeTab = 'users'; 
    const safeGameData = props.gameData;

    switch (activeTab) {
        case 'users':
            return <UsersTab 
                      allCharacters={props.allCharacters || []}
                      gameData={safeGameData}
                      onHealCharacter={props.onHealCharacter}
                      onResetCharacterStats={props.onResetCharacterStats}
                      onResetCharacterProgress={props.onResetCharacterProgress}
                      onDeleteCharacter={props.onDeleteCharacter}
                      onUpdateCharacterGold={props.onUpdateCharacterGold}
                      onRegenerateCharacterEnergy={props.onRegenerateCharacterEnergy}
                      onChangeUserPassword={props.onChangeUserPassword}
                   />;
        default:
            return <div>Select a tab</div>;
    }
};
