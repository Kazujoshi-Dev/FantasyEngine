
import React, { useState } from 'react';
import { api } from '../api';
import { useTranslation } from '../contexts/LanguageContext';

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
        <div className="min-h-screen flex items-center justify-center font-sans bg-slate-900">
            <div className="w-full max-w-md bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-2xl shadow-2xl p-8 text-white">
                <h2 className="text-4xl font-bold text-center mb-2 text-indigo-400">
                    {isLoginView ? t('auth.welcomeBack') : t('auth.joinAdventure')}
                </h2>
                <p className="text-center text-gray-400 mb-8">
                    {isLoginView ? t('auth.loginPrompt') : t('auth.registerPrompt')}
                </p>

                {error && <p className="bg-red-900/50 border border-red-700 text-red-300 text-center p-3 rounded-lg mb-6">{error}</p>}
                {message && <p className="bg-green-900/50 border border-green-700 text-green-300 text-center p-3 rounded-lg mb-6">{message}</p>}

                <form onSubmit={isLoginView ? handleLogin : handleRegister} className="space-y-6">
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
    );
};
