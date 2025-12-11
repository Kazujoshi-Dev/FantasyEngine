
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
    const [resetToken, setResetToken] = useState('');
    
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [settings, setSettings] = useState<GameSettings | undefined>(undefined);
    
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const images = settings?.titleScreen?.images || [];
    const description = settings?.titleScreen?.description || '';

    useEffect(() => {
        // Check for reset password token in URL
        const path = window.location.pathname;
        if (path.startsWith('/reset-password/')) {
            const token = path.split('/')[2];
            if (token) {
                setResetToken(token);
                setView('reset');
            }
        }
    }, []);

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const data = await api.getGameData();
                setSettings(data.settings);
            } catch (err) {
                console.error("Failed to load game settings for auth screen:", err);
            }
        };
        fetchSettings();
    }, []);

    useEffect(() => {
        if (images.length > 1) {
            const timer = setInterval(() => {
                setCurrentImageIndex(prevIndex => (prevIndex + 1) % images.length);
            }, 7000); // Change image every 7 seconds
            return () => clearInterval(timer);
        }
    }, [images.length]);

    const performAuthAction = async () => {
        setIsLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (view === 'register') {
                await api.register({ username, password, email });
                setMessage('Rejestracja zakończona sukcesem! Możesz się teraz zalogować.');
                setView('login');
                setUsername('');
                setPassword('');
            } else if (view === 'login') {
                const { token } = await api.login({ username, password });
                onLoginSuccess(token);
            } else if (view === 'forgot') {
                const res = await api.forgotPassword(email);
                setMessage(res.message);
                // Don't change view immediately, let user see message
                setEmail('');
            } else if (view === 'reset') {
                const res = await api.resetPassword(resetToken, password);
                setMessage(res.message);
                setView('login');
                setPassword('');
                // Clear token from URL to keep things clean
                window.history.pushState({}, '', '/');
            }
        } catch (err: any) {
            setError(err.message);
            if (view === 'login') {
                setPassword('');
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        performAuthAction();
    };

    const getTitle = () => {
        switch(view) {
            case 'login': return t('auth.welcomeBack');
            case 'register': return t('auth.joinAdventure');
            case 'forgot': return 'Zresetuj Hasło';
            case 'reset': return 'Ustaw Nowe Hasło';
            default: return '';
        }
    };

    const getSubtitle = () => {
        switch(view) {
            case 'login': return t('auth.loginPrompt');
            case 'register': return t('auth.registerPrompt');
            case 'forgot': return 'Podaj swój adres email, aby otrzymać instrukcję resetowania hasła.';
            case 'reset': return 'Wprowadź nowe hasło do swojego konta.';
            default: return '';
        }
    };

    return (
        <>
            <div 
                className="fixed inset-0 bg-cover bg-center"
                style={{ 
                    backgroundImage: settings?.loginBackground 
                        ? `url(${settings.loginBackground})` 
                        : "url('login_background.png')" 
                }}
            />
            <div className="relative min-h-screen flex flex-col items-center justify-center font-sans p-4">
                <div className="w-full max-w-6xl bg-slate-800/30 backdrop-blur-sm border border-slate-700/50 rounded-2xl shadow-2xl p-4 lg:p-6 text-white flex flex-col md:flex-row gap-6">
                    
                    {/* Left Side: Auth Form */}
                    <div className="w-full md:w-1/3 lg:w-2/5 flex flex-col justify-center p-4">
                        <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700/50">
                            {settings?.logoUrl && (
                                <img 
                                    src={settings.logoUrl} 
                                    alt="Logo" 
                                    className="mx-auto max-h-60 w-auto object-contain mb-6"
                                />
                            )}
                            <h2 className="text-3xl font-bold text-center mb-2 text-indigo-400">
                                {getTitle()}
                            </h2>
                            <p className="text-center text-gray-400 mb-6">
                                {getSubtitle()}
                            </p>

                            {error && <p className="bg-red-900/50 border border-red-700 text-red-300 text-center p-3 rounded-lg mb-4">{error}</p>}
                            {message && <p className="bg-green-900/50 border border-green-700 text-green-300 text-center p-3 rounded-lg mb-4">{message}</p>}

                            <form onSubmit={handleSubmit} className="space-y-4">
                                {(view === 'login' || view === 'register') && (
                                    <div>
                                        <label htmlFor="username" className="block text-sm font-medium text-gray-300 mb-2">
                                            {t('auth.username')}
                                        </label>
                                        <input
                                            type="text"
                                            id="username"
                                            value={username}
                                            onChange={(e) => setUsername(e.target.value)}
                                            className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all duration-200"
                                            required
                                            autoComplete="username"
                                            placeholder="Twój login..."
                                        />
                                    </div>
                                )}
                                
                                {/* Pole Email - widoczne przy rejestracji i odzyskiwaniu hasła */}
                                {(view === 'register' || view === 'forgot') && (
                                    <div className="animate-fade-in">
                                        <label htmlFor="email" className="block text-sm font-medium text-gray-300 mb-2">
                                            Adres Email (Opcjonalny)
                                        </label>
                                        <input
                                            type="email"
                                            id="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all duration-200"
                                            // Email is technically optional in DB schema (UNIQUE allows nulls), but recommended for recovery
                                            placeholder="twoj@email.com (do odzyskiwania hasła)"
                                            autoComplete="email"
                                        />
                                        {view === 'register' && <p className="text-xs text-gray-500 mt-1">Ułatwi odzyskanie konta w przyszłości.</p>}
                                    </div>
                                )}

                                {(view === 'login' || view === 'register' || view === 'reset') && (
                                    <div>
                                        <label htmlFor="password"className="block text-sm font-medium text-gray-300 mb-2">
                                            {view === 'reset' ? 'Nowe Hasło' : t('auth.password')}
                                        </label>
                                        <input
                                            type="password"
                                            id="password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all duration-200"
                                            required
                                            minLength={view === 'reset' ? 6 : undefined}
                                            autoComplete={view === 'login' ? "current-password" : "new-password"}
                                        />
                                    </div>
                                )}

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg text-lg hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-200 ease-in-out shadow-lg disabled:shadow-none"
                                >
                                    {isLoading ? t('auth.processing') : (
                                        view === 'login' ? t('auth.login') :
                                        view === 'register' ? t('auth.register') :
                                        view === 'forgot' ? 'Wyślij Link' :
                                        'Zapisz Hasło'
                                    )}
                                </button>
                            </form>

                            <div className="mt-6 text-center space-y-2">
                                {view === 'login' && (
                                    <>
                                        <button onClick={() => { setView('register'); setError(null); setMessage(null); }} className="text-sm text-indigo-400 hover:text-indigo-300 block w-full">
                                            {t('auth.toggleToRegister')}
                                        </button>
                                        <button onClick={() => { setView('forgot'); setError(null); setMessage(null); }} className="text-xs text-gray-500 hover:text-gray-300 block w-full mt-2">
                                            Zapomniałeś hasła?
                                        </button>
                                    </>
                                )}
                                {(view === 'register' || view === 'forgot' || view === 'reset') && (
                                    <button onClick={() => { setView('login'); setError(null); setMessage(null); }} className="text-sm text-indigo-400 hover:text-indigo-300">
                                        Powrót do logowania
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Slider and Description */}
                    <div className="w-full md:w-2/3 lg:w-3/5 flex flex-col justify-center p-4">
                        <div className="bg-slate-900/30 rounded-lg overflow-hidden border border-slate-700/50 shadow-2xl">
                            <div className="relative aspect-video">
                               {images.length > 0 ? (
                                    <div className="slider-viewport">
                                        <div
                                            className="slider-track"
                                            style={{
                                                width: `${images.length * 100}%`,
                                                transform: `translateX(-${currentImageIndex * (100 / images.length)}%)`
                                            }}
                                        >
                                            {images.map((src, index) => (
                                                <img
                                                    key={index}
                                                    src={src}
                                                    alt={`Slide ${index + 1}`}
                                                    className="slider-image"
                                                    style={{ width: `${100 / images.length}%` }}
                                                    onClick={() => setLightboxImage(src)}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="absolute inset-0 bg-slate-800 flex items-center justify-center text-slate-500">
                                        <p>Kroniki Mroku</p>
                                    </div>
                                )}
                            </div>
                            {description && (
                                <div className="p-6 bg-slate-800/50">
                                    <p className="text-gray-300 whitespace-pre-line text-sm leading-relaxed text-justify">{description}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Discord Footer Button */}
                <a
                    href="https://discord.gg/AsstjP8UnF"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-8 flex items-center gap-3 px-8 py-3 bg-[#5865F2] hover:bg-[#4752C4] text-white font-bold rounded-full shadow-xl transition-all transform hover:scale-105 hover:-translate-y-1 border border-indigo-400/30 backdrop-blur-sm group"
                >
                    <svg className="w-6 h-6 transition-transform group-hover:rotate-12" fill="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                    </svg>
                    <span>Dołącz do nas na Discord</span>
                </a>
            </div>
            {lightboxImage && (
                <div
                    className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 cursor-pointer animate-fade-in"
                    onClick={() => setLightboxImage(null)}
                >
                    <img
                        src={lightboxImage}
                        alt="Enlarged view"
                        className="max-w-full max-h-full object-contain cursor-default"
                        onClick={(e) => e.stopPropagation()}
                    />
                </div>
            )}
        </>
    );
};
