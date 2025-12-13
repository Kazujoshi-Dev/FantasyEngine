
import React, { createContext, useContext } from 'react';
import { Language } from '../types';

interface LanguageContextType {
    lang: Language;
    t: (key: string, options?: any) => string;
}

export const LanguageContext = createContext<LanguageContextType>({
    lang: Language.PL,
    t: (key: string) => key,
});

export const useTranslation = () => useContext(LanguageContext);
