import React, { useState } from 'react';
import { OrphanAuditResult } from '../../../types';
import { useTranslation } from '../../../contexts/LanguageContext';
import { api } from '../../../api';

export const OrphanAuditTab: React.FC = () => {
  const { t } = useTranslation();
  const [orphanResults, setOrphanResults] = useState<OrphanAuditResult[]>([]);
  const [isAuditingOrphans, setIsAuditingOrphans] = useState(false);
  const [isResolvingOrphans, setIsResolvingOrphans] = useState(false);

  const runOrphanAudit = async () => {
    setIsAuditingOrphans(true);
    try {
        const results = await api.runOrphanAudit();
        setOrphanResults(results);
    } catch (err: any) {
        alert(`Orphan audit failed: ${err.message}`);
    } finally {
        setIsAuditingOrphans(false);
    }
  };

  const resolveOrphans = async () => {
    if (window.confirm(`Are you sure you want to resolve ${orphanResults.length} sets of orphaned items? This will permanently delete items that no longer have a valid template.`)) {
        setIsResolvingOrphans(true);
        try {
            const result = await api.resolveOrphans();
            alert(`Resolved orphans. ${result.itemsRemoved} items were removed from ${result.charactersAffected} characters.`);
            await runOrphanAudit(); // Re-run audit
        } catch (err: any) {
            alert(`Failed to resolve orphans: ${err.message}`);
        } finally {
            setIsResolvingOrphans(false);
        }
    }
  };

  return (
    <div className="animate-fade-in">
        <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('admin.orphanAudit.title')}</h3>
        <p className="text-sm text-gray-400 mb-4">
            {t('admin.orphanAudit.description')}
        </p>
        <div className="flex gap-4 mb-4">
            <button onClick={runOrphanAudit} disabled={isAuditingOrphans} className="px-4 py-2 rounded-md bg-sky-700 hover:bg-sky-600 font-semibold disabled:bg-slate-600">
                {isAuditingOrphans ? t('admin.orphanAudit.running') : t('admin.orphanAudit.run')}
            </button>
            {orphanResults.length > 0 && (
                <button onClick={resolveOrphans} disabled={isResolvingOrphans} className="px-4 py-2 rounded-md bg-red-800 hover:bg-red-700 font-semibold disabled:bg-slate-600">
                    {isResolvingOrphans ? t('admin.orphanAudit.resolving') : t('admin.orphanAudit.resolve', { count: orphanResults.reduce((sum, r) => sum + r.orphans.length, 0) })}
                </button>
            )}
        </div>
        {orphanResults.length === 0 && !isAuditingOrphans && <p className="text-gray-400">{t('admin.orphanAudit.noOrphans')}</p>}
        <div className="space-y-2">
            {orphanResults.map(result => (
                <div key={result.userId} className="bg-slate-800/50 p-3 rounded-lg">
                    <p className="font-semibold text-white">{t('admin.orphanAudit.character')}: {result.characterName} (ID: {result.userId})</p>
                    <ul className="list-disc list-inside text-sm text-gray-300 mt-1">
                        {result.orphans.map((orphan, index) => (
                            <li key={index}>{t('admin.orphanAudit.item')}: <span className="font-mono text-red-400">{orphan.templateId}</span>, Unikalne ID: <span className="font-mono text-gray-500">{orphan.uniqueId}</span>, {t('admin.orphanAudit.location')}: <span className="font-mono">{orphan.location}</span></li>
                        ))}
                    </ul>
                </div>
            ))}
        </div>
    </div>
  );
};
