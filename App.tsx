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
    AdminCharacterInfo, PvpRewardSummary, CharacterClass, User, GameSettings, EssenceType
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
  const dataFetchIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const lang = playerCharacter?.settings?.language || gameData?.settings.language || Language.PL;
  const t = useMemo(() => getT(lang), [lang]);

  const showAlert = (err: any) => {
    const message = (err as Error).message || t('error.unknown');
    alert(`${t('error.title')}: ${message}`);
  };
  
  const handleLogout = useCallback(() => {
    if (token) api.logout(token);
    localStorage.removeItem('token');
    setToken(null);
    setPlayerCharacter(null);
    setBaseCharacter(null);
    setGameData(null); // Clear all data on logout
    if (characterUpdateIntervalRef.current) clearInterval(characterUpdateIntervalRef.current);
    if (dataFetchIntervalRef.current) clearInterval(dataFetchIntervalRef.current);
  }, [token]);

  const handleCharacterUpdate = useCallback((char: PlayerCharacter, immediate = false) => {
    setPlayerCharacter(char);
    if(immediate) {
        setBaseCharacter(char);
    }
  }, []);
  
  const loadInitialData = useCallback(async () => {
    setIsLoading(true);
    try {
      const gData = await api.getGameData();
      setGameData(gData);

      if (token) {
        const charData = await api.getCharacter();
        if (charData) {
          setPlayerCharacter(charData);
          setBaseCharacter(charData);
        }
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
  }, [token, handleLogout]);


  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);
  
  // Periodic Data Fetching
  useEffect(() => {
    if (token && playerCharacter) {
      // Fetch character data more frequently for energy/health updates
      characterUpdateIntervalRef.current = setInterval(async () => {
        try {
          const charData = await api.getCharacter();
          handleCharacterUpdate(charData, true);
        } catch (err) {
           if ((err as Error).message === 'Invalid token') handleLogout();
        }
      }, 5000);

      // Fetch other data less frequently
      const fetchData = async () => {
        try {
          setMessages(await api.getMessages());
          setTavernMessages(await api.getTavernMessages());
        } catch (err) {
          if ((err as Error).message === 'Invalid token') handleLogout();
        }
      };
      fetchData(); // Initial fetch
      dataFetchIntervalRef.current = setInterval(fetchData, 30000);

      return () => {
        if (characterUpdateIntervalRef.current) clearInterval(characterUpdateIntervalRef.current);
        if (dataFetchIntervalRef.current) clearInterval(dataFetchIntervalRef.current);
      };
    }
  }, [token, playerCharacter, handleLogout, handleCharacterUpdate]);


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

    // ====== EXPEDITION ======
    const handleStartExpedition = useCallback(async (expeditionId: string) => {
        if (!playerCharacter || !gameData) return;
        const expedition = gameData.expeditions.find(e => e.id === expeditionId);
        if (!expedition) return;

        const updatedCharacter: PlayerCharacter = {
            ...playerCharacter,
            resources: { ...playerCharacter.resources, gold: playerCharacter.resources.gold - expedition.goldCost },
            stats: { ...playerCharacter.stats, currentEnergy: playerCharacter.stats.currentEnergy - expedition.energyCost },
            activeExpedition: {
                expeditionId,
                finishTime: Date.now() + expedition.duration * 1000,
                enemies: [], combatLog: [], rewards: { gold: 0, experience: 0 }
            }
        };
        handleCharacterUpdate(updatedCharacter, true); // Optimistic update
        try {
            await api.updateCharacter(updatedCharacter);
        } catch (err) { showAlert(err); }
    }, [playerCharacter, gameData, handleCharacterUpdate]);

    const handleCompleteExpedition = useCallback(async () => {
        try {
            const { updatedCharacter, summary } = await api.completeExpedition();
            handleCharacterUpdate(updatedCharacter, true);
            setExpeditionSummary(summary);
        } catch (err) { showAlert(err); }
    }, [handleCharacterUpdate]);

    // ====== CAMP ======
    const getCampUpgradeCost = (level: number) => Math.floor(100 * Math.pow(1.8, level - 1));
    const getChestUpgradeCost = (level: number) => ({ gold: Math.floor(250 * Math.pow(1.9, level - 1)), essences: [{ type: EssenceType.Common, amount: 10 * level }] });
    const getBackpackUpgradeCost = (level: number) => ({ gold: Math.floor(200 * Math.pow(1.7, level - 1)), essences: [{ type: EssenceType.Common, amount: 5 * level }] });
    const handleToggleResting = useCallback(async () => {
        if (!playerCharacter) return;
        const isResting = !playerCharacter.isResting;
        const updatedChar = { ...playerCharacter, isResting, restStartHealth: isResting ? playerCharacter.stats.currentHealth : playerCharacter.restStartHealth };
        handleCharacterUpdate(updatedChar, true);
        try { await api.updateCharacter(updatedChar); } catch(err) { showAlert(err) }
    }, [playerCharacter, handleCharacterUpdate]);
    const handleHealToFull = useCallback(async () => {
        try {
            const updatedChar = await api.healToFull();
            handleCharacterUpdate(updatedChar, true);
        } catch(err) { showAlert(err) }
    }, [handleCharacterUpdate]);
    const handleUpgradeBuilding = useCallback(async (building: 'camp' | 'chest' | 'backpack') => {
         try {
            const updatedChar = await api.upgradeBuilding(building);
            handleCharacterUpdate(updatedChar, true);
        } catch(err) { showAlert(err) }
    }, [handleCharacterUpdate]);

    // ====== RANKING / PVP ======
    const handleFetchRanking = useCallback(async () => {
        setIsRankingLoading(true);
        try {
            setRanking(await api.getRanking());
        } catch (err) { showAlert(err); } 
        finally { setIsRankingLoading(false); }
    }, []);
    const handleAttackPlayer = useCallback(async (defenderId: number) => {
        try {
            const { summary, updatedAttacker } = await api.attackPlayer(defenderId);
            handleCharacterUpdate(updatedAttacker, true);
            setPvpSummary({ summary, isDefender: false });
        } catch (err) { showAlert(err); }
    }, [handleCharacterUpdate]);

    // ====== TRADER ======
    const handleFetchTraderInventory = useCallback(async (force = false) => {
        try { setTraderInventory(await api.getTraderInventory(force)); } catch(err) { showAlert(err) }
    }, []);
    const handleBuyItem = useCallback(async (item: ItemInstance) => {
        try {
            const updatedChar = await api.buyItem(item.uniqueId);
            handleCharacterUpdate(updatedChar, true);
            setTraderInventory(prev => prev.filter(i => i.uniqueId !== item.uniqueId));
        } catch (err) { showAlert(err); }
    }, [handleCharacterUpdate]);
    const handleSellItems = useCallback(async (items: ItemInstance[]) => {
        try {
            const updatedChar = await api.sellItems(items.map(i => i.uniqueId));
            handleCharacterUpdate(updatedChar, true);
        } catch (err) { showAlert(err); }
    }, [handleCharacterUpdate]);

    // ====== BLACKSMITH ======
    const handleDisenchantItem = useCallback(async (item: ItemInstance) => {
        try {
            const { updatedCharacter, result } = await api.disenchantItem(item.uniqueId);
            handleCharacterUpdate(updatedCharacter, true);
            return result;
        } catch (err) { showAlert(err); return { success: false }; }
    }, [handleCharacterUpdate]);
    const handleUpgradeItem = useCallback(async (item: ItemInstance) => {
        try {
            const { updatedCharacter, result } = await api.upgradeItem(item.uniqueId);
            handleCharacterUpdate(updatedCharacter, true);
            return result;
        } catch (err) { showAlert(err); return { success: false, messageKey: 'error.title' }; }
    }, [handleCharacterUpdate]);

    // ====== MESSAGES ======
    const handleFetchMessages = useCallback(async () => {
        try { setMessages(await api.getMessages()); } catch (err) { showAlert(err); }
    }, []);
    const handleSendMessage = useCallback(async (data: { recipientName: string; subject: string; content: string }) => {
        try { await api.sendMessage(data); await handleFetchMessages(); } catch (err) { showAlert(err); throw err; }
    }, [handleFetchMessages]);
    const handleDeleteMessage = useCallback(async (id: number) => {
        try { await api.deleteMessage(id); setMessages(prev => prev.filter(m => m.id !== id)); } catch (err) { showAlert(err); }
    }, []);
    const handleMarkAsRead = useCallback(async (id: number) => {
        try { await api.markMessageAsRead(id); setMessages(prev => prev.map(m => m.id === id ? { ...m, is_read: true } : m)); } catch (err) { showAlert(err); }
    }, []);
    const handleClaimReturn = useCallback(async (id: number) => {
        try { const updatedChar = await api.claimMarketReturn(id); handleCharacterUpdate(updatedChar, true); await handleFetchMessages(); return true; }
        catch (err) { showAlert(err); return false; }
    }, [handleCharacterUpdate, handleFetchMessages]);
    const handleBulkDelete = useCallback(async (type: 'read' | 'all' | 'expedition_reports') => {
        try { await api.deleteBulkMessages(type); await handleFetchMessages(); } catch (err) { showAlert(err); }
    }, [handleFetchMessages]);

    // ====== QUESTS ======
    const handleAcceptQuest = useCallback(async (questId: string) => {
        if (!playerCharacter) return;
        const updatedChar = { ...playerCharacter, acceptedQuests: [...playerCharacter.acceptedQuests, questId] };
        handleCharacterUpdate(updatedChar, true);
        try { await api.updateCharacter(updatedChar); } catch (err) { showAlert(err); }
    }, [playerCharacter, handleCharacterUpdate]);
    const handleCompleteQuest = useCallback(async (questId: string) => {
        try {
            const updatedChar = await api.completeQuest(questId);
            handleCharacterUpdate(updatedChar, true);
        } catch (err) { showAlert(err); }
    }, [handleCharacterUpdate]);

    // ====== TAVERN ======
    const handleSendTavernMessage = useCallback(async (content: string) => {
        try {
            const newMessage = await api.sendTavernMessage(content);
            setTavernMessages(prev => [...prev, newMessage]);
        } catch (err) { showAlert(err); }
    }, []);

    // ====== ADMIN ======
    const handleFetchAllCharacters = useCallback(async () => {
        try { setAllCharacters(await api.getAllCharacters()); } catch(err) { showAlert(err); }
    }, []);
  
  const renderContent = () => {
    if (!playerCharacter || !gameData || !baseCharacter) return null;
    const currentLocation = gameData.locations.find(loc => loc.id === playerCharacter.currentLocationId);
    if (!currentLocation) return <p>Error: Current location not found.</p>;

    switch (activeTab) {
      case Tab.Statistics: return <Statistics character={playerCharacter} />;
      case Tab.Equipment: return <Equipment character={playerCharacter} itemTemplates={gameData.itemTemplates} affixes={gameData.affixes} />;
      case Tab.Expedition: return <Expedition character={playerCharacter} expeditions={gameData.expeditions} enemies={gameData.enemies} currentLocation={currentLocation} onStartExpedition={handleStartExpedition} itemTemplates={gameData.itemTemplates} affixes={gameData.affixes} onCompletion={handleCompleteExpedition} />;
      case Tab.Camp: return <Camp character={playerCharacter} baseCharacter={baseCharacter} onToggleResting={handleToggleResting} onUpgradeCamp={() => handleUpgradeBuilding('camp')} getCampUpgradeCost={getCampUpgradeCost} onCharacterUpdate={handleCharacterUpdate} onHealToFull={handleHealToFull} onUpgradeChest={() => handleUpgradeBuilding('chest')} onUpgradeBackpack={() => handleUpgradeBuilding('backpack')} getChestUpgradeCost={getChestUpgradeCost} getBackpackUpgradeCost={getBackpackUpgradeCost} />;
      case Tab.Location: return <Location playerCharacter={playerCharacter} onCharacterUpdate={handleCharacterUpdate} locations={gameData.locations} />;
      case Tab.Resources: return <Resources character={playerCharacter} />;
      case Tab.Ranking: return <Ranking ranking={ranking} currentPlayer={playerCharacter} onRefresh={handleFetchRanking} isLoading={isRankingLoading} onAttack={handleAttackPlayer} onComposeMessage={(name) => { setComposeModalInitial({ recipient: name }); setIsComposeModalOpen(true); }} />;
      case Tab.Options: return <Options character={playerCharacter} onCharacterUpdate={handleCharacterUpdate} />;
      case Tab.Trader: return <Trader character={playerCharacter} baseCharacter={baseCharacter} itemTemplates={gameData.itemTemplates} affixes={gameData.affixes} settings={gameData.settings} traderInventory={traderInventory} onBuyItem={handleBuyItem} onSellItems={handleSellItems} />;
      case Tab.Blacksmith: return <Blacksmith character={playerCharacter} itemTemplates={gameData.itemTemplates} affixes={gameData.affixes} onDisenchantItem={handleDisenchantItem} onUpgradeItem={handleUpgradeItem} />;
      case Tab.Messages: return <Messages messages={messages} itemTemplates={gameData.itemTemplates} affixes={gameData.affixes} currentPlayer={playerCharacter} onDeleteMessage={handleDeleteMessage} onMarkAsRead={handleMarkAsRead} onCompose={(recipient, subject) => { setComposeModalInitial({ recipient, subject }); setIsComposeModalOpen(true); }} onClaimReturn={handleClaimReturn} onDeleteBulk={handleBulkDelete} />;
      case Tab.Quests: return <Quests character={playerCharacter} quests={gameData.quests} enemies={gameData.enemies} itemTemplates={gameData.itemTemplates} affixes={gameData.affixes} onAcceptQuest={handleAcceptQuest} onCompleteQuest={handleCompleteQuest} />;
      case Tab.Tavern: return <Tavern character={playerCharacter} messages={tavernMessages} onSendMessage={handleSendTavernMessage} />;
      case Tab.Market: return <Market character={playerCharacter} gameData={gameData} onCharacterUpdate={handleCharacterUpdate} />;
      case Tab.Admin: return <AdminPanel gameData={gameData} onGameDataUpdate={async (key, data) => { await api.updateGameData(key, data); await loadInitialData(); }} onSettingsUpdate={async (settings) => { await api.updateGameSettings(settings); await loadInitialData(); }} users={[]} onDeleteUser={() => {}} allCharacters={allCharacters} onDeleteCharacter={async (id) => { await api.deleteCharacter(id); await handleFetchAllCharacters(); }} onResetCharacterStats={api.resetCharacterStats} onHealCharacter={api.healCharacter} onUpdateCharacterGold={api.updateCharacterGold} onForceTraderRefresh={() => handleFetchTraderInventory(true)} onResetAllPvpCooldowns={api.resetAllPvpCooldowns} onSendGlobalMessage={api.sendGlobalMessage} onRegenerateCharacterEnergy={api.regenerateCharacterEnergy} onChangeUserPassword={api.changeUserPassword} onInspectCharacter={api.inspectCharacter} onDeleteCharacterItem={api.deleteCharacterItem} />;
      default: return null;
    }
  };
  
    // Effect for fetching data needed by specific tabs when they are opened
    useEffect(() => {
        if (activeTab === Tab.Ranking) handleFetchRanking();
        if (activeTab === Tab.Trader) handleFetchTraderInventory();
        if (activeTab === Tab.Admin) handleFetchAllCharacters();
        if (activeTab === Tab.Messages || isComposeModalOpen) {
            (async () => {
                try { setAllCharacterNames(await api.getCharacterNames()); } catch (err) { console.error(err); }
            })();
        }
    }, [activeTab, isComposeModalOpen, handleFetchRanking, handleFetchTraderInventory, handleFetchAllCharacters]);


  if (isLoading) {
    return <div className="flex items-center justify-center h-screen bg-slate-900 text-white">{t('loading')}</div>;
  }
  
  if (!token) {
    return <Auth onLoginSuccess={handleLoginSuccess} settings={gameData?.settings} />;
  }

  if (!playerCharacter) {
    return <CharacterCreation onCharacterCreate={handleCharacterCreate} />;
  }
  
  const currentLocation = gameData?.locations.find(loc => loc.id === playerCharacter.currentLocationId);

  return (
    <LanguageContext.Provider value={{ lang, t }}>
         {expeditionSummary && (
            <ExpeditionSummaryModal 
                reward={expeditionSummary} 
                onClose={() => setExpeditionSummary(null)} 
                characterName={playerCharacter.name} 
                itemTemplates={gameData?.itemTemplates || []}
                affixes={gameData?.affixes || []}
            />
        )}
        {pvpSummary && (
             <ExpeditionSummaryModal
                    reward={{
                        combatLog: pvpSummary.summary.combatLog,
                        isVictory: pvpSummary.summary.isVictory,
                        totalGold: pvpSummary.summary.gold,
                        totalExperience: pvpSummary.summary.experience,
                        rewardBreakdown: [], itemsFound: [], essencesFound: {}
                    }}
                    onClose={() => setPvpSummary(null)}
                    characterName={pvpSummary.summary.attacker.name}
                    itemTemplates={gameData?.itemTemplates || []}
                    affixes={gameData?.affixes || []}
                    isPvp={true}
                    pvpData={{ attacker: pvpSummary.summary.attacker, defender: pvpSummary.summary.defender }}
                    isDefenderView={pvpSummary.isDefender}
                />
        )}
        {isComposeModalOpen && (
            <ComposeMessageModal 
                allCharacterNames={allCharacterNames}
                onClose={() => setIsComposeModalOpen(false)} 
                onSendMessage={handleSendMessage}
                initialRecipient={composeModalInitial.recipient}
                initialSubject={composeModalInitial.subject}
            />
        )}

      <div className="flex h-screen bg-cover bg-center" style={{ backgroundImage: `url(${gameData?.settings?.gameBackground || 'game_background.png'})` }}>
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          playerCharacter={playerCharacter}
          availableTabs={currentLocation?.availableTabs || []}
          onLogout={handleLogout}
        />
        <main className="flex-1 p-6 overflow-y-auto">
          {renderContent()}
        </main>
      </div>
    </LanguageContext.Provider>
  );
};