
import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useTranslation } from '../contexts/LanguageContext';
import { GameSettings } from '../types';

interface AuthProps {
    onLoginSuccess: (token: string) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLoginSuccess }) => {
    const { t } = useTranslation(); // Use the hook at the top level
    const [isLoginView, setIsLoginView] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [settings, setSettings] = useState<GameSettings | undefined>(undefined);
    
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);
    const images = settings?.titleScreen?.images || [];
    const description = settings?.titleScreen?.description || '';

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

    const performAuthAction = async (endpoint: 'login' | 'register') => {
        setIsLoading(true);
        setError(null);
        setMessage(null);

        try {
            if (endpoint === 'register') {
                await api.register({ username, password });
                setMessage('Registration successful! You can now log in.');
                setIsLoginView(true);
                setUsername('');
                setPassword('');
            } else {
                const { token } = await api.login({ username, password });
                onLoginSuccess(token);
            }
        } catch (err: any) {
            setError(err.message);
            if (endpoint === 'login') {
                setPassword('');
            }
        } finally {
            setIsLoading(false);
        }
    };
    
    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        performAuthAction('login');
    };

    const handleRegister = (e: React.FormEvent) => {
        e.preventDefault();
        performAuthAction('register');
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
                                {isLoginView ? t('auth.welcomeBack') : t('auth.joinAdventure')}
                            </h2>
                            <p className="text-center text-gray-400 mb-6">
                                {isLoginView ? t('auth.loginPrompt') : t('auth.registerPrompt')}
                            </p>

                            {error && <p className="bg-red-900/50 border border-red-700 text-red-300 text-center p-3 rounded-lg mb-4">{error}</p>}
                            {message && <p className="bg-green-900/50 border border-green-700 text-green-300 text-center p-3 rounded-lg mb-4">{message}</p>}

                            <form onSubmit={isLoginView ? handleLogin : handleRegister} className="space-y-4">
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
                                    />
                                </div>
                                <div>
                                    <label htmlFor="password"className="block text-sm font-medium text-gray-300 mb-2">
                                        {t('auth.password')}
                                    </label>
                                    <input
                                        type="password"
                                        id="password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-slate-900/70 border border-slate-700 rounded-lg px-4 py-3 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition-all duration-200"
                                        required
                                    />
                                </div>
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="w-full bg-indigo-600 text-white font-bold py-3 rounded-lg text-lg hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition-all duration-200 ease-in-out shadow-lg disabled:shadow-none"
                                >
                                    {isLoading ? t('auth.processing') : (isLoginView ? t('auth.login') : t('auth.register'))}
                                </button>
                            </form>

                            <div className="mt-6 text-center">
                                <button onClick={() => { setIsLoginView(!isLoginView); setError(null); setMessage(null); }} className="text-sm text-indigo-400 hover:text-indigo-300">
                                    {isLoginView ? t('auth.toggleToRegister') : t('auth.toggleToLogin')}
                                </button>
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
                    href="https://discord.gg/5GJ5hP5z"
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
