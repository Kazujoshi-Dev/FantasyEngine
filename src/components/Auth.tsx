
import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useTranslation } from '../contexts/LanguageContext';
import { GameSettings } from '../types';

interface AuthProps {
    onLoginSuccess: (token: string) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLoginSuccess }) => {
    const { t } = useTranslation();
    const [view, setView] = useState<'login' | 'register' | 'forgot' | 'reset'>('login');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [email, setEmail] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [settings, setSettings] = useState<GameSettings | undefined>(undefined);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    useEffect(() => {
        api.getGameData().then(data => setSettings(data.settings)).catch(console.error);
    }, []);

    const images = settings?.titleScreen?.images || [];

    return (
        <>
            <div className="fixed inset-0 bg-cover bg-center" style={{ backgroundImage: settings?.loginBackground ? `url(${settings.loginBackground})` : "url('login_background.png')" }} />
            <div className="relative min-h-screen flex flex-col items-center justify-center p-4">
                <main className="w-full max-w-6xl bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl shadow-2xl p-6 text-white flex flex-col md:flex-row gap-6">
                    
                    {/* Sekcja formularza (H1 dla SEO) */}
                    <section className="w-full md:w-1/3 lg:w-2/5 flex flex-col justify-center p-4">
                        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700/50">
                            {settings?.logoUrl && <img src={settings.logoUrl} alt="Kroniki Mroku Logo" className="mx-auto max-h-40 mb-6" />}
                            
                            <h1 className="text-3xl font-bold text-center mb-2 text-indigo-400">
                                {view === 'login' ? 'Zaloguj się do Kronik Mroku' : 'Zarejestruj się w darmowej grze RPG'}
                            </h1>
                            
                            <form onSubmit={(e) => { e.preventDefault(); /* login logic */ }} className="space-y-4">
                                <input type="text" placeholder="Użytkownik" className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-3" />
                                <input type="password" placeholder="Hasło" className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-3" />
                                <button type="submit" className="w-full bg-indigo-600 font-bold py-3 rounded-lg text-lg">
                                    {view === 'login' ? 'Wejdź do Gry' : 'Rozpocznij Przygodę'}
                                </button>
                            </form>
                            
                            <div className="mt-4 text-center">
                                <button onClick={() => setView(view === 'login' ? 'register' : 'login')} className="text-indigo-400 text-sm hover:underline">
                                    {view === 'login' ? 'Nie masz konta? Stwórz postać za darmo' : 'Masz już konto? Zaloguj się'}
                                </button>
                            </div>
                        </div>
                    </section>

                    {/* Sekcja opisowa (H2 i Content dla SEO) */}
                    <section className="w-full md:w-2/3 lg:w-3/5 flex flex-col justify-center p-4">
                        <div className="bg-slate-900/30 rounded-lg overflow-hidden border border-slate-700/50 shadow-2xl">
                            <div className="relative aspect-video bg-slate-800">
                                {images.length > 0 && <img src={images[currentImageIndex]} alt="Podgląd rozgrywki Kroniki Mroku" className="w-full h-full object-cover" />}
                            </div>
                            <div className="p-6 bg-slate-800/50">
                                <h2 className="text-xl font-bold text-indigo-300 mb-2">Odkryj mroczne sekrety przeglądarkowego świata fantasy</h2>
                                <p className="text-gray-300 text-sm leading-relaxed text-justify">
                                    {settings?.titleScreen?.description || 'Kroniki Mroku to browser-based fantasy game, oferująca unikalny system rzemiosła, handlu między graczami oraz epickich walk z bossami w trybie multiplayer.'}
                                </p>
                                <div className="mt-4 flex gap-4 text-xs text-gray-500 font-bold uppercase tracking-widest">
                                    <span>✓ Bez pobierania</span>
                                    <span>✓ Free to Play</span>
                                    <span>✓ Aktywna społeczność</span>
                                </div>
                            </div>
                        </div>
                    </section>
                </main>
            </div>
        </>
    );
};
