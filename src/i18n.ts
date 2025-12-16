
import { Language } from './types';
import pl from './i18n/locales/pl/index';

const resources: Record<Language, any> = {
    [Language.PL]: pl,
    [Language.EN]: pl, // Fallback to PL for EN if EN locale is missing
};

export const getT = (lang: Language) => {
    return (key: string, options?: any) => {
        const keys = key.split('.');
        let value = resources[lang];
        for (const k of keys) {
            value = value?.[k];
        }
        
        if (value === undefined) return key;

        if (typeof value === 'string' && options) {
            return value.replace(/\{(\w+)\}/g, (_, v) => options[v] !== undefined ? options[v] : `{${v}}`);
        }
        
        return value;
    };
};
