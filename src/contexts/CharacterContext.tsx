
import React, { createContext, useState, useContext, ReactNode, useMemo, useEffect } from 'react';
import { PlayerCharacter, GameData } from '../types';
import { calculateDerivedStats } from '@/logic/stats';
import { api } from '../api';

interface CharacterContextType {
    character: PlayerCharacter | null;
    baseCharacter: PlayerCharacter | null;
    derivedCharacter: PlayerCharacter | null;
    setCharacter: React.Dispatch<React.SetStateAction<PlayerCharacter | null>>;
    gameData: GameData | null;
    setGameData: React.Dispatch<React.SetStateAction<GameData | null>>;
    updateCharacter: (updatedCharacter: PlayerCharacter) => void;
    loading: boolean;
    error: string | null;
}

const CharacterContext = createContext<CharacterContextType | undefined>(undefined);

export const CharacterProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [baseCharacter, setCharacter] = useState<PlayerCharacter | null>(null);
    const [gameData, setGameData] = useState<GameData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const initData = async () => {
            const token = api.getAuthToken();
            if (!token) {
                setLoading(false);
                return;
            }

            try {
                const [char, data] = await Promise.all([
                    api.getCharacter(),
                    api.getGameData(),
                    api.synchronizeTime()
                ]);
                
                setCharacter(char);
                setGameData(data);
            } catch (err: any) {
                console.error("Initialization error:", err);
                setError(err.message);
                if (err.message === 'Invalid token') {
                    localStorage.removeItem('token');
                    window.location.reload();
                }
            } finally {
                setLoading(false);
            }
        };

        initData();
    }, []);

    const derivedCharacter = useMemo(() => {
        if (!baseCharacter || !gameData) return baseCharacter;
        
        return calculateDerivedStats(
            baseCharacter, 
            gameData.itemTemplates || [], 
            gameData.affixes || [],
            baseCharacter.guildBarracksLevel || 0,
            baseCharacter.guildShrineLevel || 0,
            gameData.skills || [],
            baseCharacter.activeGuildBuffs || [],
            gameData.itemSets || [] // Przekazanie zestawów
        );
    }, [baseCharacter, gameData]);
    
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
            updateCharacter,
            loading,
            error
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
