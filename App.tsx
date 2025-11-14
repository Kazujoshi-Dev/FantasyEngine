




import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { Statistics } from './components/Statistics';
import { Equipment } from './components/Equipment';
import { Expedition, ExpeditionSummaryModal } from './components/Expedition';
import { Location } from './components/Location';
import { Camp } from './components/Camp';
import { Resources } from './components/Resources';
import { Ranking } from './components/Ranking';
import { Options } from './components/Options';
import { Trader } from './components/Trader';
import { Blacksmith } from './components/Blacksmith';
import { Messages, ComposeMessageModal } from './components/Messages';
import { Quests } from './components/Quests';
import { Tavern } from './components/Tavern';
import { Market } from './components/Market';
import { AdminPanel } from './components/AdminPanel';
import { Auth } from './components/Auth';
import { CharacterCreation } from './components/CharacterCreation';
import { 
    Tab, PlayerCharacter, Race, Language, GameData, 
    RankingPlayer, ExpeditionRewardSummary, Message, TavernMessage, ItemInstance,
    AdminCharacterInfo, PvpRewardSummary, CharacterClass, User
} from './types';
import { LanguageContext } from './contexts/LanguageContext';
import { getT } from './i18n';
import { api } from './api';

export const App: React.FC = () => {
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);
  
  const [gameData, setGameData] = useState<GameData | null>(null);
  const [playerCharacter, setPlayerCharacter] = useState<PlayerCharacter | null>(null);
  const [baseCharacter, setBaseCharacter] = useState<PlayerCharacter | null>(null);
  
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Statistics);
  
  const [expeditionSummary, setExpeditionSummary] = useState<ExpeditionRewardSummary | null>(null);
  const [pvpSummary, setPvpSummary] = useState<{ summary: PvpRewardSummary, isDefender: boolean } | null>(null);
  const [isComposeModalOpen, setIsComposeModalOpen] = useState(false);
  const [composeModalInitial, setComposeModalInitial] = useState<{ recipient?: string; subject?: string }>({});

  const [ranking, setRanking] = useState<RankingPlayer[]>([]);
  const [isRankingLoading, setIsRankingLoading] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [tavernMessages, setTavernMessages] = useState<TavernMessage[]>([]);
  const [traderInventory, setTraderInventory] = useState<ItemInstance[]>([]);
  const [allCharacters, setAllCharacters] = useState<AdminCharacterInfo[]>([]);
  const [allCharacterNames, setAllCharacterNames] = useState<string[]>([]);
  
  const characterUpdateIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const tavernIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const lang = playerCharacter?.settings?.language || Language.PL;
  const t = useMemo(() => getT(lang), [lang]);

  const showAlert = (err: any) => {
    const message = (err as Error).message || t('error.unknown');
    alert(`${t('error.title')}: ${message}`);
  };

  const handleCharacterUpdate = useCallback((char: PlayerCharacter, immediate = false) => {
    setPlayerCharacter(char);
    if(immediate) {
        setBaseCharacter(char);
    }
  }, []);

  const loadInitialData = useCallback(async () => {
    if (!token) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    try {
      const [gData, charData] = await Promise.all([
        api.getGameData(),
        api.getCharacter()
      ]);
      setGameData(gData);
      if (charData) {
        setPlayerCharacter(charData);
        setBaseCharacter(charData);
      }
    } catch (err) {
      console.error(err);
      if ((err as Error).message === 'Invalid token') {
        handleLogout();
      } else {
        showAlert(err);
      }
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  const handleLogout = () => {
    if (token) api.logout(token);
    localStorage.removeItem('token');
    setToken(null);
    setPlayerCharacter(null);
  };
  
  const handleLoginSuccess = (newToken: string) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const handleCharacterCreate = async (character: { name: string, race: Race }) => {
    if (!gameData) return;
    const startLocation = gameData.locations.find(l => l.isStartLocation);
    if (!startLocation) {
        showAlert(new Error('Start location not configured.'));
        return;
    }
    try {
        const newChar = await api.createCharacter(character.name, character.race, startLocation.id);
        setPlayerCharacter(newChar);
        setBaseCharacter(newChar);
    } catch (err) {
        showAlert(err);
        throw err;
    }
  };
  
  const renderContent = () => {
    if (!playerCharacter || !gameData) return null;
    const currentLocation = gameData.locations.find(loc => loc.id === playerCharacter.currentLocationId);
    if (!currentLocation) return <p>Error: Current location not found.</p>;

    switch (activeTab) {
      case Tab.Statistics: return <Statistics character={playerCharacter} />;
      case Tab.Equipment: return <Equipment character={playerCharacter} itemTemplates={gameData.itemTemplates} affixes={gameData.affixes} />;
      // ... A lot more tabs will be rendered here
      default: return null;
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen text-white">{t('loading')}</div>;
  }
  
  if (!token) {
    return <Auth onLoginSuccess={handleLoginSuccess} settings={gameData?.settings} />;
  }

  if (!playerCharacter) {
    return <CharacterCreation onCharacterCreate={handleCharacterCreate} />;
  }

  return (
    <LanguageContext.Provider value={{ lang, t }}>
      {/* fix: Access gameBackground from gameData.settings */}
      <div className="flex h-screen bg-cover bg-center" style={{ backgroundImage: `url(${gameData?.settings?.gameBackground || 'game_background.png'})` }}>
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} playerCharacter={playerCharacter} />
        <main className="flex-1 p-6 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </LanguageContext.Provider>
  );
};