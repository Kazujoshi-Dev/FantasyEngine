import { Language } from '../types';
import pl from './locales/pl';

export const translations = {
    [Language.PL]: pl,
};

// Helper to access nested properties by dot notation
const getNestedValue = (obj: any, path: string): string => {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj) || path;
};

export const getT = (lang: Language) => (key: string, options?: { [key: string]: string | number }): string => {
    const langFile = translations[Language.PL]; // For now, only PL is supported
    let value = getNestedValue(langFile, key);

    if (value && options) {
        Object.keys(options).forEach(optKey => {
            const regex = new RegExp(`\\{${optKey}\\}`, 'g');
            value = value.replace(regex, String(options[optKey]));
        });
    }

    return value;
};