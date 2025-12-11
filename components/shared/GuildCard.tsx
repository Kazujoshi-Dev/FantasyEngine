
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { PublicGuildProfile } from '../../types';
import { useTranslation } from '../../contexts/LanguageContext';
import { ShieldIcon } from '../icons/ShieldIcon';
import { UsersIcon } from '../icons/UsersIcon';
import { StarIcon } from '../icons/StarIcon';
import { FormattedText } from '../guild/GuildSettings';

interface GuildCardProps {
    guildId: number;
    onClose: () => void;
}

const getImageUrl = (url: string | undefined): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith('http') || url.startsWith('/api/uploads/')) return url;
    const uploadsIndex = url.indexOf('uploads/');
    if (uploadsIndex > -1) {
        return `/api/${url.substring(uploadsIndex)}`;
    }
    return url;
};

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

    const crestSrc = getImageUrl(profile.crestUrl);

    return (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in" onClick={onClose}>
            <div 
                className="bg-slate-800 border border-slate-700 rounded-2xl shadow-2xl p-6 max-w-lg w-full relative overflow-hidden" 
                onClick={e => e.stopPropagation()}
                style={{ 
                    backgroundImage: 'var(--window-bg)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundBlendMode: 'overlay'
                }}
            >
                {/* Header / Crest */}
                <div className="flex flex-col items-center mb-6 relative z-10">
                    <div className="w-32 h-32 mb-4">
                        {crestSrc ? (
                            <img src={crestSrc} alt={profile.name} className="w-full h-full object-contain drop-shadow-xl" />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-600">
                                <ShieldIcon className="h-full w-full opacity-30" />
                            </div>
                        )}
                    </div>
                    <h2 className="text-3xl font-bold text-white mb-1">{profile.name}</h2>
                    <p className="text-amber-400 font-mono text-lg">[{profile.tag}]</p>
                </div>

                {/* Info Grid */}
                <div className="grid grid-cols-2 gap-4 mb-6 relative z-10 text-sm">
                    <div className="bg-slate-700/30 p-3 rounded-lg flex flex-col items-center">
                        <span className="text-gray-400 uppercase text-[10px] tracking-wider mb-1">Lider</span>
                        <span className="font-bold text-white">{profile.leaderName}</span>
                    </div>
                    <div className="bg-slate-700/30 p-3 rounded-lg flex flex-col items-center">
                        <span className="text-gray-400 uppercase text-[10px] tracking-wider mb-1">Założona</span>
                        <span className="font-bold text-white">{new Date(profile.createdAt).toLocaleDateString()}</span>
                    </div>
                    <div className="bg-slate-700/30 p-3 rounded-lg flex flex-col items-center">
                        <div className="flex items-center text-gray-400 mb-1">
                            <UsersIcon className="h-3 w-3 mr-1"/>
                            <span className="text-[10px] uppercase tracking-wider">Członkowie</span>
                        </div>
                        <span className="font-mono font-bold text-white">{profile.memberCount} / {profile.maxMembers}</span>
                    </div>
                    <div className="bg-slate-700/30 p-3 rounded-lg flex flex-col items-center">
                        <div className="flex items-center text-sky-400 mb-1">
                            <StarIcon className="h-3 w-3 mr-1"/>
                            <span className="text-[10px] uppercase tracking-wider">Suma Poziomów</span>
                        </div>
                        <span className="font-mono font-bold text-white">{profile.totalLevel}</span>
                    </div>
                </div>

                {/* Recruitment Status */}
                <div className="bg-slate-900/50 p-2 rounded-lg text-center mb-6 border border-slate-700/50 relative z-10">
                    <p className="text-xs text-gray-400">Status Rekrutacji</p>
                    <p className={`font-bold ${profile.isPublic ? 'text-green-400' : 'text-red-400'}`}>
                        {profile.isPublic ? `Otwarta (Min. Lvl: ${profile.minLevel})` : 'Zamknięta'}
                    </p>
                </div>

                {/* Description */}
                {profile.description && (
                    <div className="bg-slate-900/30 p-4 rounded-lg border border-slate-700/50 mb-6 relative z-10 max-h-60 overflow-y-auto">
                        <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">{t('guild.description')}</h4>
                        <div className="text-sm">
                            <FormattedText text={profile.description} />
                        </div>
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
