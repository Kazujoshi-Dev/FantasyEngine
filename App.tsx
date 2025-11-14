import React, { useState, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { Statistics } from './components/Statistics';
import { Equipment } from './components/Equipment';
import { Tab, PlayerCharacter, Race, CharacterStats, EquipmentSlot, Language, CharacterCamp, CharacterChest, CharacterBackpack, CharacterResources } from './types';
import { LanguageContext } from './contexts/LanguageContext';
import { getT } from './i18n';


const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>(Tab.Statistics);