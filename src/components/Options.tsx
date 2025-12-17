
import React, { useState, useMemo } from 'react';
import { ContentPanel } from './ContentPanel';
import { Language, PlayerRank } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { api } from '../api';
import { useCharacter } from '@/contexts/CharacterContext';
import { ShieldIcon } from './icons/ShieldIcon';
import { StarIcon } from './icons/StarIcon';

export const Options: React.FC = () => {
  const { character, updateCharacter, gameData } = useCharacter();
  const { t } = useTranslation();

  if (!character || !gameData) return null;

  const [selectedLang, setSelectedLang] = useState(character.settings?.language || Language.PL);
  const [description, setDescription] = useState(character.description || '');
  const [avatarUrl, setAvatarUrl] = useState(character.avatarUrl || '');
  
  // Security State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  // Email State
  const [email, setEmail] = useState('');
  const [emailStatus, setEmailStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });
  const hasEmail = !!character.email && character.email.length > 0;

  const [saveProfileStatus, setSaveProfileStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const myRanks = useMemo(() => {
    return (gameData.playerRanks || []).filter(r => character.ownedRankIds?.includes(r.id));
  }, [gameData.playerRanks, character.ownedRankIds]);

  const handleRankSelect = async (rankId: string | null) => {
      try {
          const updated = await api.setActiveRank(rankId);
          updateCharacter(updated);
      } catch (e: any) { alert(e.message); }
  };

  const handleSaveProfile = async () => {
    setSaveProfileStatus('saving');
    const updateData: any = {
        description, avatarUrl,
        settings: { ...character.settings, language: selectedLang }
    };
    if (!hasEmail && email.trim()) updateData.email = email.trim();

    try {
        const updatedChar = await api.updateCharacter(updateData);
        updateCharacter(updatedChar);
        setSaveProfileStatus('saved');
        setTimeout(() => setSaveProfileStatus('idle'), 2000);
    } catch (e: any) {
        alert('Błąd zapisu: ' + (e.message || 'Unknown error'));
        setSaveProfileStatus('idle');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (newPassword !== confirmPassword) { setPasswordStatus({ type: 'error', message: t('options.security.passwordsDoNotMatch') }); return; }
      try {
          await api.changePassword(oldPassword, newPassword);
          setPasswordStatus({ type: 'success', message: t('options.security.passwordChanged') });
          setOldPassword(''); setNewPassword(''); setConfirmPassword('');
      } catch (err: any) { setPasswordStatus({ type: 'error', message: err.message }); }
  };

  return (
    <ContentPanel title={t('options.title')}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
              {myRanks.length > 0 && (
                  <div className="bg-slate-900/40 p-6 rounded-xl border border-amber-500/30">
                      <h3 className="text-xl font-bold text-amber-400 mb-4 flex items-center gap-2"><StarIcon className="h-5 w-5"/> Twoje Rangi</h3>
                      <div className="grid grid-cols-1 gap-2">
                          <button 
                            onClick={() => handleRankSelect(null)}
                            className={`p-3 rounded-lg border text-left transition-all ${!character.activeRankId ? 'bg-slate-700 border-indigo-500 ring-1 ring-indigo-500' : 'bg-slate-800 border-slate-700 hover:bg-slate-700'}`}
                          >
                              <span className="font-bold text-gray-400">Brak Rangi</span>
                          </button>
                          {myRanks.map(rank => (
                              <button
                                key={rank.id}
                                onClick={() => handleRankSelect(rank.id)}
                                className={`p-3 rounded-lg border text-left transition-all flex justify-between items-center overflow-hidden relative ${character.activeRankId === rank.id ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-700 hover:border-slate-500'}`}
                                style={{ 
                                    backgroundImage: rank.backgroundImageUrl ? `url(${rank.backgroundImageUrl})` : 'none',
                                    backgroundColor: rank.backgroundImageUrl ? 'transparent' : '#1e293b',
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                }}
                              >
                                  <span className="font-black uppercase tracking-widest text-sm z-10" style={{ color: rank.textColor, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>{rank.name}</span>
                                  <span className="text-[10px] italic z-10" style={{ color: rank.textColor, textShadow: '0 1px 3px rgba(0,0,0,0.8)' }}>
                                      {Object.entries(rank.bonus || {}).map(([k,v]) => `+${v} ${k}`).join(', ')}
                                  </span>
                              </button>
                          ))}
                      </div>
                  </div>
              )}

              <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700">
                <h3 className="text-xl font-bold text-indigo-400 mb-4">{t('options.profile.title')}</h3>
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">{t('options.language')}</label>
                        <select value={selectedLang} onChange={(e) => setSelectedLang(e.target.value as Language)} className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2">
                        <option value={Language.PL}>{t('languages.pl')}</option>
                        <option value={Language.EN}>{t('languages.en')}</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">{t('options.profile.avatarUrl')}</label>
                        <input type="text" value={avatarUrl} onChange={e => setAvatarUrl(e.target.value)} placeholder="https://..." className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">{t('options.profile.description')}</label>
                        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2" />
                    </div>
                    <div className="flex justify-end pt-2 border-t border-slate-700/50">
                        {saveProfileStatus === 'saved' && <p className="text-green-400 mr-4 animate-fade-in">{t('options.saveSuccess')}</p>}
                        <button onClick={handleSaveProfile} className="px-6 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold">{t('options.save')}</button>
                    </div>
                </div>
              </div>
          </div>

          <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700 h-fit">
            <h3 className="text-xl font-bold text-red-400 mb-4">{t('options.security.title')}</h3>
            <form onSubmit={handleChangePassword} className="space-y-4">
                <input type="password" value={oldPassword} onChange={e => setOldPassword(e.target.value)} placeholder="Stare hasło" className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2" required />
                <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Nowe hasło" className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2" required />
                <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Powtórz hasło" className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2" required />
                {passwordStatus.message && <p className={`p-2 rounded text-center text-sm ${passwordStatus.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>{passwordStatus.message}</p>}
                <button type="submit" className="w-full py-2 bg-red-700 hover:bg-red-600 rounded font-bold text-white transition-colors">{t('options.security.changePassword')}</button>
            </form>
          </div>
      </div>
    </ContentPanel>
  );
};
