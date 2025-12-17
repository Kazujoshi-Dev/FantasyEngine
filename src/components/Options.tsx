
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
    setEmailStatus({ type: null, message: '' });
    
    const updateData: any = {
        description,
        avatarUrl,
        settings: {
            ...character.settings,
            language: selectedLang
        }
    };

    if (!hasEmail && email.trim()) {
        updateData.email = email.trim();
    }

    try {
        const updatedChar = await api.updateCharacter(updateData);
        if (updateData.email && !updatedChar.email) {
             updatedChar.email = updateData.email;
        }

        updateCharacter(updatedChar);
        setSaveProfileStatus('saved');
        
        if (updateData.email) {
             setEmailStatus({ type: 'success', message: 'Email został przypisany do konta.' });
             setEmail(''); 
        }

        setTimeout(() => setSaveProfileStatus('idle'), 2000);
    } catch (e: any) {
        if (e.message && e.message.includes('email')) {
             setEmailStatus({ type: 'error', message: 'Ten email jest już zajęty.' });
        } else {
             alert('Failed to save profile: ' + (e.message || 'Unknown error'));
        }
        setSaveProfileStatus('idle');
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
      e.preventDefault();
      if (newPassword !== confirmPassword) {
          setPasswordStatus({ type: 'error', message: t('options.security.passwordsDoNotMatch') });
          return;
      }
      if (newPassword.length < 6) {
          setPasswordStatus({ type: 'error', message: t('options.security.passwordTooShort') });
          return;
      }

      try {
          await api.changePassword(oldPassword, newPassword);
          setPasswordStatus({ type: 'success', message: t('options.security.passwordChanged') });
          setOldPassword('');
          setNewPassword('');
          setConfirmPassword('');
      } catch (err: any) {
          setPasswordStatus({ type: 'error', message: err.message });
      }
  };

  const handleSyncTime = async () => {
      const offset = await api.synchronizeTime();
      alert(`Czas zsynchronizowany. Offset: ${offset.toFixed(0)}ms`);
  };

  return (
    <ContentPanel title={t('options.title')}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
              {/* Ranks Selection */}
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
                                className={`p-3 rounded-lg border text-left transition-all flex justify-between items-center ${character.activeRankId === rank.id ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-slate-700 hover:border-slate-500'}`}
                                style={{ backgroundColor: rank.backgroundColor }}
                              >
                                  <span className="font-bold" style={{ color: rank.textColor }}>{rank.name}</span>
                                  <span className="text-[10px] opacity-70 italic" style={{ color: rank.textColor }}>
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
                        <label htmlFor="language-select" className="block text-sm font-medium text-gray-300 mb-1">{t('options.language')}</label>
                        <select
                        id="language-select"
                        value={selectedLang}
                        onChange={(e) => setSelectedLang(e.target.value as Language)}
                        className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2"
                        >
                        <option value={Language.PL}>{t('languages.pl')}</option>
                        <option value={Language.EN}>{t('languages.en')}</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">{t('options.profile.avatarUrl')}</label>
                        <div className="flex gap-4 items-start">
                            <input 
                                type="text" 
                                value={avatarUrl} 
                                onChange={e => setAvatarUrl(e.target.value)} 
                                placeholder="https://example.com/avatar.png"
                                className="flex-grow bg-slate-800 border border-slate-600 rounded-md px-3 py-2"
                            />
                            {avatarUrl && (
                                <img 
                                    src={avatarUrl} 
                                    alt="Preview" 
                                    className="w-10 h-10 rounded-full object-cover border border-slate-500 bg-slate-900"
                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                />
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">{t('options.profile.description')}</label>
                        <textarea 
                            value={description} 
                            onChange={e => setDescription(e.target.value)} 
                            rows={4}
                            placeholder={t('options.profile.descriptionPlaceholder')}
                            className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2"
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Adres Email (Odzyskiwanie hasła)</label>
                        {hasEmail ? (
                             <div className="w-full bg-slate-800/80 border border-green-700/50 rounded-md px-4 py-3 flex items-center justify-between">
                                 <div className="flex items-center gap-2">
                                     <span className="text-gray-200 font-mono">{character.email}</span>
                                 </div>
                                 <div className="flex items-center gap-1.5 text-green-400 text-xs font-bold uppercase tracking-wider bg-green-900/30 px-2 py-1 rounded">
                                     <ShieldIcon className="h-3 w-3" />
                                     Zabezpieczone
                                 </div>
                             </div>
                        ) : (
                            <div className="space-y-1 bg-amber-900/10 p-3 rounded border border-amber-700/30">
                                <input 
                                    type="email" 
                                    value={email} 
                                    onChange={e => setEmail(e.target.value)} 
                                    placeholder="twoj@email.com"
                                    className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2"
                                    autoComplete="email"
                                />
                                <p className="text-xs text-amber-500 mt-1">
                                    <strong>Uwaga:</strong> Adres email można przypisać do konta tylko raz. Służy on wyłącznie do odzyskiwania hasła.
                                </p>
                                {emailStatus.message && (
                                    <p className={`text-xs ${emailStatus.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                                        {emailStatus.message}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end items-center h-10 pt-2 border-t border-slate-700/50">
                        {saveProfileStatus === 'saved' && <p className="text-green-400 mr-4 animate-fade-in">{t('options.saveSuccess')}</p>}
                        <button
                        onClick={handleSaveProfile}
                        disabled={saveProfileStatus !== 'idle'}
                        className="px-6 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 text-white font-bold disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                        >
                        {saveProfileStatus === 'saving' ? t('admin.general.saving') + '...' : t('options.save')}
                        </button>
                    </div>
                </div>
              </div>
          </div>

          <div>
              <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700">
                <h3 className="text-xl font-bold text-red-400 mb-4">{t('options.security.title')}</h3>
                <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">{t('options.security.oldPassword')}</label>
                        <input 
                            type="password" 
                            value={oldPassword} 
                            onChange={e => setOldPassword(e.target.value)} 
                            className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2"
                            required
                            autoComplete="current-password"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">{t('options.security.newPassword')}</label>
                        <input 
                            type="password" 
                            value={newPassword} 
                            onChange={e => setNewPassword(e.target.value)} 
                            className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2"
                            required
                            autoComplete="new-password"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">{t('options.security.confirmPassword')}</label>
                        <input 
                            type="password" 
                            value={confirmPassword} 
                            onChange={e => setConfirmPassword(e.target.value)} 
                            className="w-full bg-slate-800 border border-slate-600 rounded-md px-3 py-2"
                            required
                            autoComplete="new-password"
                        />
                    </div>

                    {passwordStatus.message && (
                        <div className={`p-2 rounded text-center text-sm ${passwordStatus.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                            {passwordStatus.message}
                        </div>
                    )}

                    <div className="flex justify-end pt-2 border-t border-slate-700/50">
                        <button
                        type="submit"
                        disabled={!oldPassword || !newPassword || !confirmPassword}
                        className="px-6 py-2 rounded-md bg-red-700 hover:bg-red-600 text-white font-bold disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                        >
                        {t('options.security.changePassword')}
                        </button>
                    </div>
                </form>
              </div>
          </div>
      </div>
    </ContentPanel>
  );
};
