
import { GameData } from '../../types';
import { GeneralTab } from './tabs/GeneralTab';
import { UsersTab } from './tabs/UsersTab';
import { TriviaTab } from './tabs/TriviaTab';
import { LocationsTab } from './tabs/LocationsTab';
import { ExpeditionsTab } from './tabs/ExpeditionsTab';
import { EnemiesTab } from './tabs/EnemiesTab';
import { BossesTab } from './tabs/BossesTab';
import { ItemsTab } from './tabs/ItemsTab';
import { AffixesTab } from './tabs/AffixesTab';
import { QuestsTab } from './tabs/QuestsTab';
import { UniversityTab } from './tabs/UniversityTab';
import { RitualsTab } from './tabs/RitualsTab';
import { GuildsTab } from './tabs/GuildsTab';
import { HuntingTab } from './tabs/HuntingTab';
import { ItemCreatorTab } from './tabs/ItemCreatorTab';
import { PvpTab } from './tabs/PvpTab';
import { ItemInspectorTab } from './tabs/ItemInspectorTab';
import { DuplicationAuditTab } from './tabs/DuplicationAuditTab';
import { OrphanAuditTab } from './tabs/OrphanAuditTab';
import { DataIntegrityTab } from './tabs/DataIntegrityTab';
import { DatabaseEditorTab } from './tabs/DatabaseEditorTab';
import { TowersTab } from './tabs/TowersTab';
import { CraftingSettingsTab } from './tabs/CraftingSettingsTab';
import { ItemSetsTab } from './tabs/ItemSetsTab';

export type AdminTabId = 'general' | 'users' | 'locations' | 'expeditions' | 'enemies' | 'bosses' | 'items' | 'itemSets' | 'itemCreator' | 'affixes' | 'quests' | 'pvp' | 'itemInspector' | 'duplicationAudit' | 'orphanAudit' | 'dataIntegrity' | 'university' | 'hunting' | 'trivia' | 'rituals' | 'guilds' | 'databaseEditor' | 'towers' | 'crafting';

export interface AdminTabDefinition {
    id: AdminTabId;
    label: string;
    component: React.FC<any>;
    props?: (gameData: GameData, onUpdate: any) => any;
}

export const ADMIN_TABS: AdminTabDefinition[] = [
    { id: 'general', label: 'Ogólne', component: GeneralTab },
    { id: 'users', label: 'Użytkownicy', component: UsersTab },
    { id: 'locations', label: 'Lokacje', component: LocationsTab, props: (d, u) => ({ locations: d.locations, onGameDataUpdate: u }) },
    { id: 'expeditions', label: 'Wyprawy', component: ExpeditionsTab, props: (d, u) => ({ expeditions: d.expeditions, locations: d.locations, enemies: d.enemies, itemTemplates: d.itemTemplates, onGameDataUpdate: u }) },
    { id: 'towers', label: 'Wieże Mroku', component: TowersTab, props: (d, u) => ({ gameData: d, onGameDataUpdate: u }) },
    { id: 'enemies', label: 'Wrogowie', component: EnemiesTab, props: (d, u) => ({ enemies: d.enemies, itemTemplates: d.itemTemplates, onGameDataUpdate: u }) },
    { id: 'bosses', label: 'Bossowie', component: BossesTab, props: (d, u) => ({ enemies: d.enemies, itemTemplates: d.itemTemplates, onGameDataUpdate: u }) },
    { id: 'items', label: 'Przedmioty', component: ItemsTab, props: (d, u) => ({ itemTemplates: d.itemTemplates, onGameDataUpdate: u }) },
    { id: 'itemSets', label: 'Zestawy', component: ItemSetsTab, props: (d, u) => ({ gameData: d, onGameDataUpdate: u }) },
    { id: 'affixes', label: 'Afiksy', component: AffixesTab, props: (d, u) => ({ affixes: d.affixes, onGameDataUpdate: u }) },
    { id: 'quests', label: 'Zadania', component: QuestsTab, props: (d, u) => ({ gameData: d, onGameDataUpdate: u }) },
    { id: 'university', label: 'Umiejętności', component: UniversityTab, props: (d, u) => ({ skills: d.skills, onGameDataUpdate: u }) },
    { id: 'rituals', label: 'Rytuały', component: RitualsTab, props: (d, u) => ({ gameData: d, onGameDataUpdate: u }) },
    { id: 'crafting', label: 'Rzemiosło', component: CraftingSettingsTab, props: (d, u) => ({ gameData: d, onGameDataUpdate: u }) },
    { id: 'guilds', label: 'Gildie', component: GuildsTab },
    { id: 'hunting', label: 'Polowania', component: HuntingTab },
    { id: 'trivia', label: 'Info', component: TriviaTab },
    { id: 'itemCreator', label: 'Kreator', component: ItemCreatorTab, props: (d) => ({ itemTemplates: d.itemTemplates, affixes: d.affixes }) },
    { id: 'pvp', label: 'PvP', component: PvpTab },
    { id: 'itemInspector', label: 'Inspektor', component: ItemInspectorTab, props: (d) => ({ gameData: d }) },
    { id: 'orphanAudit', label: 'Audyt Widm', component: OrphanAuditTab },
    { id: 'duplicationAudit', label: 'Audyt Duplikatów', component: DuplicationAuditTab },
    { id: 'dataIntegrity', label: 'Audyty Techniczne', component: DataIntegrityTab },
    { id: 'databaseEditor', label: 'Baza Danych', component: DatabaseEditorTab },
];
