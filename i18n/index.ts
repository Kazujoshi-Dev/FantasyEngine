import { Language } from '../types';
import pl from './locales/pl';
import en from './locales/en';

export const translations = {
    [Language.PL]: pl,
    [Language.EN]: en,
};

// Helper to access nested properties by dot notation
const getNestedValue = (obj: any, path: string): string => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj) || path;
};

export const getT = (lang: Language) => (key: string, options?: { [key: string]: string | number }): string => {
    const langFile = translations[lang] || translations[Language.PL];
    let value = getNestedValue(langFile, key);
    if (options) {
        Object.keys(options).forEach(k => {
            value = value.replace(new RegExp(`{${k}}`, 'g'), String(options[k]));
        });
    }
    return value;
};