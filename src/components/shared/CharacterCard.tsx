
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
            } catch (err: any) {
                setError(err.message || 'Nie udało się pobrać profilu');
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [characterName]);

    const activeRank = useMemo(() => {
        if (!profile?.activeRankId || !gameData?.playerRanks) return null;
        return gameData.playerRanks.find(r => r.id === profile.activeRankId);
    }, [profile, gameData]);

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 text-white">
                    {t('loading')}
                </div>
            </div>
        );
    }

    if (error || !profile) {
        return (
            <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
                <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 text-white text-center">
                    <p className="text-red-400 mb-4">{error || 'Błąd'}</p>
                    <button onClick={onClose} className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded">Zamknij</button>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div 
                className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 max-w-lg w-full relative overflow-hidden" 
                onClick={e => e.stopPropagation()}
                style={{ 
                    backgroundImage: activeRank ? `none` : 'var(--window-bg)',
                    backgroundColor: activeRank ? activeRank.backgroundColor : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundBlendMode: 'overlay'
                }}
            >
                {/* Header / Avatar */}
                <div className="flex flex-col items-center mb-6 relative z-10">
                    {activeRank && (
                        <span 
                            className="mb-2 px-3 py-1 rounded text-sm font-black uppercase tracking-widest shadow-lg border border-white/20"
                            style={{ backgroundColor: 'rgba(0,0,0,0.3)', color: activeRank.textColor }}
                        >
                            {activeRank.name}
                        </span>
                    )}
                    <div className="relative">
                         <div className="w-24 h-24 rounded-full border-4 border-slate-600 bg-slate-900 overflow-hidden shadow-lg mb-4">
                            {profile.avatarUrl ? (
                                <img src={profile.avatarUrl} alt={profile.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-4xl text-gray-600 font-bold">
                                    {profile.name.charAt(0).toUpperCase()}
                                </div>
                            )}
                        </div>
                        <div 
                            className={`absolute bottom-5 right-1 w-5 h-5 rounded-full border-2 border-slate-800 ${profile.isOnline ? 'bg-green-500' : 'bg-red-500'}`}
                            title={profile.isOnline ? 'Online' : 'Offline'}
                        ></div>
                    </div>
                   
                    <h2 className="text-3xl font-bold text-white mb-1 drop-shadow-md">{profile.name}</h2>
                    <p className="text-indigo-400 font-medium bg-black/20 px-4 py-1 rounded-full">
                        {t(`race.${profile.race}`)} {profile.characterClass ? `| ${t(`class.${profile.characterClass}`)}` : ''} | Lvl {profile.level}
                    </p>
                </div>

                {/* Guild Info */}
                {profile.guildName && (
                    <div className="bg-slate-900/50 rounded-lg p-3 mb-6 text-center border border-indigo-900/30 relative z-10">
                        <p className="text-sm text-gray-400 uppercase tracking-widest text-[10px] mb-1">{t('sidebar.guild')}</p>
                        <p className="text-amber-400 font-bold text-lg">
                            <span className="text-white mr-2">[{profile.guildTag}]</span>
                            {profile.guildName}
                        </p>
                    </div>
                )}

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
                    <div className="bg-black/30 p-3 rounded-lg flex flex-col items-center backdrop-blur-sm border border-white/5">
                        <div className="flex items-center text-sky-400 mb-1">
                            <StarIcon className="h-4 w-4 mr-1" />
                            <span className="text-xs font-bold uppercase">{t('ranking.experience')}</span>
                        </div>
                        <span className="text-xl font-mono font-bold text-white" title="Całkowite PD">{profile.experience.toLocaleString()}</span>
                    </div>
                    <div className="bg-black/30 p-3 rounded-lg flex flex-col items-center backdrop-blur-sm border border-white/5">
                        <div className="flex items-center text-red-400 mb-1">
                            <TrophyIcon className="h-4 w-4 mr-1" />
                            <span className="text-xs font-bold uppercase">PvP (W/L)</span>
                        </div>
                        <span className="text-xl font-mono font-bold text-white">
                            <span className="text-green-400">{profile.pvpWins}</span> / <span className="text-red-400">{profile.pvpLosses}</span>
                        </span>
                    </div>
                </div>

                {/* Description */}
                {profile.description && (
                    <div className="bg-black/30 p-4 rounded-lg border border-white/10 mb-6 relative z-10 max-h-40 overflow-y-auto backdrop-blur-sm">
                        <h4 className="text-xs font-bold text-gray-400 uppercase mb-2">Opis Postaci</h4>
                        <p className="text-sm text-gray-200 italic whitespace-pre-line leading-relaxed">
                            "{profile.description}"
                        </p>
                    </div>
                )}

                <button 
                    onClick={onClose}
                    className="w-full py-3 bg-white/10 hover:bg-white/20 text-white font-bold rounded-lg transition-colors border border-white/20 relative z-10 backdrop-blur-md"
                >
                    Zamknij
                </button>
            </div>
        </div>
    );
};
