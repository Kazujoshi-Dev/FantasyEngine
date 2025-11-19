import { createContext, useContext } from 'react';
import { Language } from '../types';
import { getT } from '../i18n';

interface LanguageContextType {
    lang: Language;
    t: (key: string, options?: { [key: string]: string | number; }) => string;
}

export const LanguageContext = createContext<LanguageContextType>({
    lang: Language.PL,
    t: getT(Language.PL),
});

export const useTranslation = () => useContext(LanguageContext);