
import React, { createContext, useState, useContext, ReactNode, useMemo } from 'react';
import { PlayerCharacter, GameData } from '../types';
import { calculateDerivedStats } from '@/logic/stats';

interface CharacterContextType {
    character: PlayerCharacter | null;
    baseCharacter: PlayerCharacter | null; // The raw, non-calculated character
    derivedCharacter: PlayerCharacter | null; // The fully calculated character with item stats
    setCharacter: React.Dispatch<React.SetStateAction<PlayerCharacter | null>>;
    gameData: GameData | null;
    setGameData: React.Dispatch<React.SetStateAction<GameData | null>>;
    updateCharacter: (updatedCharacter: PlayerCharacter) => void;
}

const CharacterContext = createContext<CharacterContextType | undefined>(undefined);

export const CharacterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [baseCharacter, setCharacter] = useState<PlayerCharacter | null>(null);
    const [gameData, setGameData] = useState<GameData | null>(null);

    const derivedCharacter = useMemo(() => {
        if (!baseCharacter || !gameData) return baseCharacter;
        
        return calculateDerivedStats(
            baseCharacter, 
            gameData.itemTemplates || [], 
            gameData.affixes || [],
            baseCharacter.guildBarracksLevel,
            baseCharacter.guildShrineLevel,
            gameData.skills || [],
            baseCharacter.activeGuildBuffs || []
        );
    }, [baseCharacter, gameData]);
    
    // Wrapper to allow optimistic UI updates
    const updateCharacter = (updatedCharacter: PlayerCharacter) => {
        setCharacter(updatedCharacter);
    };

    return (
        <CharacterContext.Provider value={{ 
            character: derivedCharacter,
            baseCharacter,
            derivedCharacter,
            setCharacter, 
            gameData, 
            setGameData,
            updateCharacter
        }}>
            {children}
        </CharacterContext.Provider>
    );
};

export const useCharacter = (): CharacterContextType => {
    const context = useContext(CharacterContext);
    if (context === undefined) {
        throw new Error('useCharacter must be used within a CharacterProvider');
    }
    return context;
};
