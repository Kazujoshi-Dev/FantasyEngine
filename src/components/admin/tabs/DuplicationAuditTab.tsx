import React, { useState } from 'react';
import { DuplicationAuditResult } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';
import { api } from '../../../api';

export const DuplicationAuditTab: React.FC = () => {
  const { t } = useTranslation();
  const [duplicationResults, setDuplicationResults] = useState<DuplicationAuditResult[]>([]);
  const [isAuditing, setIsAuditing] = useState(false);
  const [isResolving, setIsResolving] = useState(false);

  const runDuplicationAudit = async () => {
    setIsAuditing(true);
    try {
        const results = await api.runDuplicationAudit();
        setDuplicationResults(results);
    } catch (err: any) {
        alert(`Audit failed: ${err.message}`);
    } finally {
        setIsAuditing(false);
    }
  };
  
  const resolveDuplications = async () => {
    if (window.confirm(t('admin.duplicationAudit.resolveConfirm', { count: duplicationResults.length }))) {
        setIsResolving(true);
        try {
            const result = await api.resolveDuplications();
            alert(t('admin.duplicationAudit.resolveSuccess', { resolvedSets: result.resolvedSets, itemsDeleted: result.itemsDeleted }));
            await runDuplicationAudit(); // Re-run audit to confirm
        } catch (err: any) {
            alert(`Resolution failed: ${err.message}`);
        } finally {
            setIsResolving(false);
        }
    }
  };

  return (
    <div className="animate-fade-in">
       <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('admin.duplicationAudit.title')}</h3>
       <p className="text-sm text-gray-400 mb-4">{t('admin.duplicationAudit.description')}</p>
        <div className="flex gap-4 mb-4">
           <button onClick={runDuplicationAudit} disabled={isAuditing} className="px-4 py-2 rounded-md bg-sky-700 hover:bg-sky-600 font-semibold disabled:bg-slate-600">
               {isAuditing ? t('admin.duplicationAudit.running') : t('admin.duplicationAudit.run')}
           </button>
           {duplicationResults.length > 0 && (
               <button onClick={resolveDuplications} disabled={isResolving} className="px-4 py-2 rounded-md bg-red-800 hover:bg-red-700 font-semibold disabled:bg-slate-600">
                   {isResolving ? t('admin.duplicationAudit.resolving') : t('admin.duplicationAudit.resolve', { count: duplicationResults.length })}
               </button>
           )}
        </div>
        {duplicationResults.length === 0 && !isAuditing && <p className="text-gray-400">{t('admin.duplicationAudit.noDuplicates')}</p>}
        <div className="space-y-2">
           {duplicationResults.map(dup => (
                <div key={dup.uniqueId} className="bg-slate-800/50 p-3 rounded-lg">
                    <p className="font-semibold text-white">{dup.itemName} (ID: {dup.uniqueId})</p>
                    <ul className="list-disc list-inside text-sm text-gray-300 mt-1">
                       {dup.instances.map((inst, index) => (
                           <li key={index}>{t('admin.duplicationAudit.owner')}: {inst.ownerName} ({t('admin.duplicationAudit.location')}: {inst.location})</li>
                       ))}
                    </ul>
                </div>
           ))}
        </div>
   </div>
  );
};
