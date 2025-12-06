
import React from 'react';
import { Guild } from '../../types';

export const GuildAltar: React.FC<{ guild: Guild }> = ({ guild }) => {
    return (
        <div className="h-[70vh] overflow-y-auto pr-2 animate-fade-in">
            <div className="bg-slate-900/40 p-8 rounded-xl border border-purple-900/30 flex flex-col items-center text-center gap-6 min-h-full justify-center">
                <h3 className="text-3xl font-bold text-purple-500 tracking-wider uppercase border-b border-purple-900/50 pb-4 px-12 drop-shadow-lg">
                    Ołtarz Mroku
                </h3>
                
                <div className="max-w-3xl bg-slate-950/80 p-10 rounded-lg border border-purple-500/30 shadow-[0_0_40px_rgba(88,28,135,0.15)] relative overflow-hidden group backdrop-blur-sm">
                    {/* Decorative background element */}
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-600 to-transparent opacity-70"></div>
                    <div className="absolute -left-10 -top-10 w-32 h-32 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>
                    <div className="absolute -right-10 -bottom-10 w-32 h-32 bg-purple-900/20 rounded-full blur-3xl pointer-events-none"></div>
                    
                    <p className="text-lg text-purple-100/90 italic leading-loose font-serif relative z-10">
                        "Ołtarz Mroku, wyrzeźbiony z czarnego jak noc obsydianu, pulsuje tępym, nieludzkim światłem. 
                        Gdy członkowie gildii składają na nim esencje w ofierze — skrzepłe, jarzące się szczątki istot, 
                        które nie powinny istnieć — kamień wchłania je niczym wygłodniała bestia. 
                        W zamian Ołtarz uwalnia w eter ciężką, lepką energię, która spowija wybranych niczym cień o własnej woli. 
                        Ci, którzy odważą się przyjąć ten dar, zyskują tymczasową moc…"
                    </p>

                    {/* Decorative bottom element */}
                    <div className="absolute bottom-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-purple-900 to-transparent opacity-70"></div>
                </div>
                
                <div className="text-xs text-purple-400/40 uppercase tracking-widest mt-8 flex items-center gap-2">
                    <span className="h-[1px] w-12 bg-purple-900/50"></span>
                    Wkrótce nadejdzie czas ofiary
                    <span className="h-[1px] w-12 bg-purple-900/50"></span>
                </div>
            </div>
        </div>
    );
};
