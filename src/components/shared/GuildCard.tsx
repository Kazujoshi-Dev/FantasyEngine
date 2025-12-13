
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { PublicGuildProfile } from '../../types';
import { useTranslation } from '../../contexts/LanguageContext';
import { UsersIcon } from '../icons/UsersIcon';
import { ShieldIcon } from '../icons/ShieldIcon';
import { StarIcon } from '../icons/StarIcon';

interface GuildCardProps {
    guildId: number;
    onClose: () => void;
}

export const GuildCard: React.FC<GuildCardProps> = ({ guildId, onClose }) => {
    const { t } = useTranslation();
    const [profile, setProfile] = useState<PublicGuildProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            setLoading(true);
            try {
                const data = await api.getGuildProfile(guildId);
                setProfile(data);
            } catch (err: any) {
                setError(err.message || 'Nie udało się pobrać profilu gildii');
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, [guildId]);

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
            >
                <div className="flex flex-col items-center mb-6 relative z-10">
                    <div className="w-24 h-24 rounded-full border-4 border-slate-600 bg-slate-900 overflow-hidden shadow-lg mb-4 flex items-center justify-center">
                        {profile.crestUrl ? (
                            <img src={profile.crestUrl} alt={profile.name} className="w-full h-full object-cover" />
                        ) : (
                            <ShieldIcon className="h-12 w-12 text-gray-600" />
                        )}
                    </div>
                   
                    <h2 className="text-3xl font-bold text-white mb-1 flex items-center gap-2">
                        <span className="text-amber-400 font-mono">[{profile.tag}]</span>
                        {profile.name}
                    </h2>
                    <p className="text-indigo-400 font-medium">
                        Lider: {profile.leaderName}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6 relative z-10">
                    <div className="bg-slate-700/30 p-3 rounded-lg flex flex-col items-center">
                        <div className="flex items-center text-sky-400 mb-1">
                            <UsersIcon className="h-4 w-4 mr-1" />
                            <span className="text-xs font-bold uppercase">Członkowie</span>
                        </div>
                        <span className="text-xl font-mono font-bold text-white">{profile.memberCount} / {profile.maxMembers}</span>
                    </div>
                    <div className="bg-slate-700/30 p-3 rounded-lg flex flex-col items-center">
                        <div className="flex items-center text-amber-400 mb-1">
                            <StarIcon className="h-4 w-4 mr-1" />
                            <span className="text-xs font-bold uppercase">Suma Poziomów</span>
                        </div>
                        <span className="text-xl font-mono font-bold text-white">
                            {profile.totalLevel}
                        </span>
                    </div>
                </div>

                <div className="flex justify-between items-center bg-slate-900/50 p-3 rounded-lg border border-slate-700 mb-6">
                    <div className="text-center w-1/2 border-r border-slate-700">
                        <p className="text-xs text-gray-500 uppercase">Rekrutacja</p>
                        <p className={`font-bold ${profile.isPublic ? 'text-green-400' : 'text-red-400'}`}>
                            {profile.isPublic ? 'Otwarta' : 'Zamknięta'}
                        </p>
                    </div>
                    <div className="text-center w-1/2">
                        <p className="text-xs text-gray-500 uppercase">Min. Poziom</p>
                        <p className="font-bold text-white">{profile.minLevel}</p>
                    </div>
                </div>

                {profile.description && (
                    <div className="bg-slate-900/30 p-4 rounded-lg border border-slate-700/50 mb-6 relative z-10 max-h-40 overflow-y-auto">
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Opis</h4>
                        <p className="text-sm text-gray-300 italic whitespace-pre-line leading-relaxed">
                            "{profile.description}"
                        </p>
                    </div>
                )}

                <button 
                    onClick={onClose}
                    className="w-full py-3 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-colors relative z-10"
                >
                    Zamknij
                </button>
            </div>
        </div>
    );
};
