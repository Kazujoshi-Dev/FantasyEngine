
import React, { useState } from 'react';
import { ContentPanel } from './ContentPanel';
import { Language } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { api } from '../api';
import { useCharacter } from '@/contexts/CharacterContext';
import { ShieldIcon } from './icons/ShieldIcon';

export const Options: React.FC = () => {
  const { character, updateCharacter } = useCharacter();
  const { t } = useTranslation();

  if (!character) return null;

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
          {/* Column 1: Profile & General */}
          <div className="space-y-6">
              <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700 shadow-xl">
                <h3 className="text-xl font-bold text-indigo-400 mb-6 border-b border-indigo-500/20 pb-2">{t('options.profile.title')}</h3>
                
                <div className="space-y-5">
                    <div>
                        <label htmlFor="language-select" className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">{t('options.language')}</label>
                        <select
                        id="language-select"
                        value={selectedLang}
                        onChange={(e) => setSelectedLang(e.target.value as Language)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                        >
                        <option value={Language.PL}>{t('languages.pl')}</option>
                        <option value={Language.EN}>{t('languages.en')}</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">{t('options.profile.avatarUrl')}</label>
                        <div className="flex gap-4 items-start">
                            <input 
                                type="text" 
                                value={avatarUrl} 
                                onChange={e => setAvatarUrl(e.target.value)} 
                                placeholder="https://example.com/avatar.png"
                                className="flex-grow bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                            />
                            {avatarUrl && (
                                <div className="w-10 h-10 rounded-full border-2 border-indigo-500 overflow-hidden bg-slate-900 flex-shrink-0">
                                    <img 
                                        src={avatarUrl} 
                                        alt="Preview" 
                                        className="w-full h-full object-cover"
                                        onError={(e) => (e.currentTarget.style.display = 'none')}
                                    />
                                </div>
                            )}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">{t('options.profile.description')}</label>
                        <textarea 
                            value={description} 
                            onChange={e => setDescription(e.target.value)} 
                            rows={4}
                            placeholder={t('options.profile.descriptionPlaceholder')}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500 resize-none"
                        />
                    </div>
                    
                    {/* Email Section */}
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">Adres Email (Odzyskiwanie)</label>
                        {hasEmail ? (
                             <div className="w-full bg-slate-800/80 border border-green-700/50 rounded-lg px-4 py-3 flex items-center justify-between">
                                 <span className="text-gray-200 font-mono text-sm">{character.email}</span>
                                 <div className="flex items-center gap-1.5 text-green-400 text-[10px] font-black uppercase tracking-widest bg-green-900/30 px-2 py-1 rounded border border-green-500/20">
                                     <ShieldIcon className="h-3 w-3" />
                                     Zabezpieczone
                                 </div>
                             </div>
                        ) : (
                            <div className="space-y-2 bg-amber-900/10 p-3 rounded-lg border border-amber-700/30">
                                <input 
                                    type="email" 
                                    value={email} 
                                    onChange={e => setEmail(e.target.value)} 
                                    placeholder="twoj@email.com"
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-indigo-500"
                                    autoComplete="email"
                                />
                                <p className="text-[10px] text-amber-500 font-bold uppercase tracking-tight">
                                    Uwaga: Email służy wyłącznie do odzyskiwania hasła.
                                </p>
                                {emailStatus.message && (
                                    <p className={`text-xs font-bold ${emailStatus.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                                        {emailStatus.message}
                                    </p>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end items-center pt-4 border-t border-slate-700/50">
                        {saveProfileStatus === 'saved' && <p className="text-green-400 font-bold text-sm mr-4 animate-fade-in">Profil zaktualizowany!</p>}
                        <button
                            onClick={handleSaveProfile}
                            disabled={saveProfileStatus !== 'idle'}
                            className="px-8 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs uppercase tracking-widest disabled:bg-slate-700 disabled:text-gray-500 transition-all shadow-lg active:scale-95"
                        >
                            {saveProfileStatus === 'saving' ? 'Zapisywanie...' : 'Zapisz Zmiany'}
                        </button>
                    </div>
                </div>
              </div>
              
              <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700">
                  <h3 className="text-lg font-bold text-gray-300 mb-4 flex items-center gap-2">Pomoc techniczna</h3>
                  <button 
                    onClick={handleSyncTime}
                    className="w-full px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-xs font-black uppercase tracking-widest text-white transition-all"
                  >
                      Synchronizuj Zegar
                  </button>
                  <p className="text-[10px] text-gray-500 mt-2 italic">Użyj tej opcji, jeśli liczniki czasu (wyprawy, polowania) nie zgadzają się z rzeczywistością.</p>
              </div>
          </div>

          {/* Column 2: Security */}
          <div>
              <div className="bg-slate-900/40 p-6 rounded-xl border border-slate-700 shadow-xl">
                <h3 className="text-xl font-bold text-red-400 mb-6 border-b border-red-500/20 pb-2">{t('options.security.title')}</h3>
                
                <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">{t('options.security.oldPassword')}</label>
                        <input 
                            type="password" 
                            value={oldPassword} 
                            onChange={e => setOldPassword(e.target.value)} 
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-red-500"
                            required
                            autoComplete="current-password"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">{t('options.security.newPassword')}</label>
                        <input 
                            type="password" 
                            value={newPassword} 
                            onChange={e => setNewPassword(e.target.value)} 
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-red-500"
                            required
                            autoComplete="new-password"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-black uppercase tracking-widest text-gray-500 mb-2">{t('options.security.confirmPassword')}</label>
                        <input 
                            type="password" 
                            value={confirmPassword} 
                            onChange={e => setConfirmPassword(e.target.value)} 
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-red-500"
                            required
                            autoComplete="new-password"
                        />
                    </div>

                    {passwordStatus.message && (
                        <div className={`p-2 rounded-lg text-center text-xs font-bold uppercase tracking-tight ${passwordStatus.type === 'success' ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'}`}>
                            {passwordStatus.message}
                        </div>
                    )}

                    <div className="flex justify-end pt-4 border-t border-slate-700/50">
                        <button
                        type="submit"
                        disabled={!oldPassword || !newPassword || !confirmPassword}
                        className="px-8 py-3 rounded-xl bg-red-700 hover:bg-red-600 text-white font-black text-xs uppercase tracking-widest disabled:bg-slate-700 disabled:text-gray-500 transition-all shadow-lg active:scale-95"
                        >
                        Zmień Hasło
                        </button>
                    </div>
                </form>
              </div>
          </div>
      </div>
    </ContentPanel>
  );
};
