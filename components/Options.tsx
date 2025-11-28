
import React, { useState } from 'react';
import { ContentPanel } from './ContentPanel';
import { PlayerCharacter, Language } from '../types';
import { useTranslation } from '../contexts/LanguageContext';
import { api } from '../api';

interface OptionsProps {
  character: PlayerCharacter;
  onCharacterUpdate: (character: PlayerCharacter, immediate?: boolean) => void;
}

export const Options: React.FC<OptionsProps> = ({ character, onCharacterUpdate }) => {
  const { t } = useTranslation();
  const [selectedLang, setSelectedLang] = useState(character.settings?.language || Language.PL);
  const [description, setDescription] = useState(character.description || '');
  const [avatarUrl, setAvatarUrl] = useState(character.avatarUrl || '');
  
  // Security State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{ type: 'success' | 'error' | null, message: string }>({ type: null, message: '' });

  const [saveProfileStatus, setSaveProfileStatus] = useState<'idle' | 'saving' | 'saved'>('idle');

  const handleSaveProfile = () => {
    setSaveProfileStatus('saving');
    const updatedChar: PlayerCharacter = {
      ...character,
      description,
      avatarUrl,
      settings: {
        ...character.settings,
        language: selectedLang,
      },
    };
    onCharacterUpdate(updatedChar, true);
    
    setTimeout(() => {
        setSaveProfileStatus('saved');
        setTimeout(() => setSaveProfileStatus('idle'), 2000);
    }, 300);
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

  return (
    <ContentPanel title={t('options.title')}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Column 1: Profile & General */}
          <div className="space-y-6">
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

                    <div className="flex justify-end items-center h-10 pt-2 border-t border-slate-700/50">
                        {saveProfileStatus === 'saved' && <p className="text-green-400 mr-4 animate-fade-in">{t('options.saveSuccess')}</p>}
                        <button
                        onClick={handleSaveProfile}
                        disabled={saveProfileStatus !== 'idle'}
                        className="px-6 py-2 rounded-md bg-green-700 hover:bg-green-600 font-bold disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
                        >
                        {saveProfileStatus === 'saving' ? t('admin.general.saving') + '...' : t('options.save')}
                        </button>
                    </div>
                </div>
              </div>
          </div>

          {/* Column 2: Security */}
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
                        className="px-6 py-2 rounded-md bg-indigo-600 hover:bg-indigo-700 font-bold disabled:bg-slate-600 disabled:cursor-not-allowed transition-colors"
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
