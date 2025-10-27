import { createContext, useContext } from 'react';
import { Language } from '../types';
import { getT } from '../i18n';

interface LanguageContextType {
    lang: Language;
    // FIX: Updated signature to match the new getT function that supports interpolation.
    t: (key: string, options?: { [key: string]: string | number }) => string;
}

export const LanguageContext = createContext<LanguageContextType>({
    lang: Language.EN,
    t: getT(Language.EN),
});

export const useTranslation = () => useContext(LanguageContext);