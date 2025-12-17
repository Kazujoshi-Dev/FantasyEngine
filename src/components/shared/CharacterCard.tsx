
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api';
import { PublicCharacterProfile, PlayerRank } from '../../types';
import { useTranslation } from '../../contexts/LanguageContext';
import { TrophyIcon } from '../icons/TrophyIcon';
import { ShieldIcon } from '../icons/ShieldIcon';
import { StarIcon } from '../icons/StarIcon';
import { useCharacter } from '@/contexts/CharacterContext';

interface CharacterCardProps {
    characterName: string;
    onClose: () => void;
}

export const CharacterCard: React.FC<CharacterCardProps> = ({ characterName, onClose }) => {
    const { t } = useTranslation();
    const { gameData } = useCharacter();
    const [profile, setProfile] = useState<PublicCharacterProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            try {
                const data = await api.getCharacterProfile(characterName);
                setProfile(data);
            } catch (err: any) { setError(err.message || 'Błąd profilu'); } 
            finally { setLoading(false); }
        };
        fetchProfile();
    }, [characterName]);

    const activeRank = useMemo(() => {
        if (!profile?.activeRankId || !gameData?.playerRanks) return null;
        return gameData.playerRanks.find(r => r.id === profile.activeRankId);
    }, [profile, gameData]);

    if (loading) return <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">{t('loading')}</div>;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 max-w-lg w-full relative overflow-hidden" onClick={e => e.stopPropagation()} style={{ backgroundImage: 'var(--window-bg)', backgroundSize: 'cover' }}>
                <div className="flex flex-col items-center mb-6 relative z-10">
                    {activeRank && (
                        <span 
                            className="mb-3 px-4 py-1 rounded text-sm font-black uppercase tracking-widest shadow-2xl border border-white/20"
                            style={{ 
                                backgroundImage: activeRank.backgroundImageUrl ? `url(${activeRank.backgroundImageUrl})` : 'none',
                                backgroundColor: activeRank.backgroundImageUrl ? 'transparent' : '#312e81',
                                backgroundSize: 'cover',
                                backgroundPosition: 'center',
                                color: activeRank.textColor,
                                textShadow: '0 2px 4px rgba(0,0,0,0.8)'
                            }}
                        >
                            {activeRank.name}
                        </span>
                    )}
                    <div className="relative">
                        <div className="w-24 h-24 rounded-full border-4 border-slate-600 bg-slate-900 overflow-hidden shadow-lg mb-4">
                            {profile?.avatarUrl ? <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-4xl text-gray-600 font-bold">{profile?.name.charAt(0)}</div>}
                        </div>
                        <div className={`absolute bottom-5 right-1 w-5 h-5 rounded-full border-2 border-slate-800 ${profile?.isOnline ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-1 drop-shadow-md">{profile?.name}</h2>
                    <p className="text-indigo-400 font-medium bg-black/40 px-4 py-1 rounded-full text-sm">
                        {t(`race.${profile?.race}`)} {profile?.characterClass ? `| ${t(`class.${profile.characterClass}`)}` : ''} | Lvl {profile?.level}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
                    <div className="bg-black/40 p-3 rounded-lg flex flex-col items-center border border-white/5">
                        <StarIcon className="h-4 w-4 text-sky-400 mb-1" />
                        <span className="text-lg font-bold text-white">{profile?.experience.toLocaleString()}</span>
                    </div>
                    <div className="bg-black/40 p-3 rounded-lg flex flex-col items-center border border-white/5">
                        <TrophyIcon className="h-4 w-4 text-red-400 mb-1" />
                        <span className="text-lg font-bold text-white">{profile?.pvpWins} / {profile?.pvpLosses}</span>
                    </div>
                </div>

                {profile?.description && <p className="bg-black/30 p-4 rounded-lg border border-white/5 mb-6 text-sm text-gray-300 italic whitespace-pre-line text-center">{profile.description}</p>}
                <button onClick={onClose} className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg border border-white/10 transition-colors">Zamknij</button>
            </div>
        </div>
    );
};
