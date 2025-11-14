import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../../../contexts/LanguageContext';
import { api } from '../../../api';

export const DatabaseEditorTab: React.FC = () => {
    const { t } = useTranslation();
    const [tables, setTables] = useState<string[]>([]);
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [tableData, setTableData] = useState<any[]>([]);
    const [totalRows, setTotalRows] = useState(0);
    const [currentPage, setCurrentPage] = useState(1);
    const [isLoading, setIsLoading] = useState(false);
    const [editingRowId, setEditingRowId] = useState<any | null>(null);
    const [editingRowData, setEditingRowData] = useState<any | null>(null);

    const ROWS_PER_PAGE = 20;

    useEffect(() => {
        const fetchTables = async () => {
            try {
                const tableList = await api.getDbTables();
                setTables(tableList);
            } catch (err) {
                alert((err as Error).message);
            }
        };
        fetchTables();
    }, []);

    const fetchTableData = useCallback(async (tableName: string, page: number) => {
        setIsLoading(true);
        try {
            const { rows, total } = await api.getDbTableData(tableName, page, ROWS_PER_PAGE);
            setTableData(rows);
            setTotalRows(total);
        } catch (err) {
            alert((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        if (selectedTable) {
            fetchTableData(selectedTable, currentPage);
        }
    }, [selectedTable, currentPage, fetchTableData]);

    const handleSelectTable = (tableName: string) => {
        setSelectedTable(tableName);
        setCurrentPage(1);
        setEditingRowId(null);
    };

    const getPrimaryKeyCol = (tableName: string | null): string => {
        if (!tableName) return 'id';
        const map: { [key: string]: string } = {
            users: 'id', characters: 'user_id', sessions: 'token',
            messages: 'id', tavern_messages: 'id', game_data: 'key',
            market_listings: 'id', market_bids: 'id',
        };
        return map[tableName] || 'id';
    };

    const handleEditClick = (row: any) => {
        const primaryKeyCol = getPrimaryKeyCol(selectedTable);
        setEditingRowId(row[primaryKeyCol]);
        setEditingRowData({ ...row });
    };

    const handleCancelEdit = () => {
        setEditingRowId(null);
        setEditingRowData(null);
    };

    const handleSaveEdit = async () => {
        if (!selectedTable || !editingRowData) return;

        // Validate JSON fields before saving
        for (const key in editingRowData) {
            if (typeof editingRowData[key] === 'string' && editingRowData[key].startsWith('{') && editingRowData[key].endsWith('}')) {
                try {
                    JSON.parse(editingRowData[key]);
                } catch (e) {
                    alert(`${t('admin.db.errorInvalidJSON')} (pole: ${key})`);
                    return;
                }
            }
        }
        
        try {
            await api.updateDbRow(selectedTable, editingRowData);
            alert(t('admin.db.updateSuccess'));
            handleCancelEdit();
            fetchTableData(selectedTable, currentPage);
        } catch (err) {
            alert((err as Error).message);
        }
    };

    const handleDeleteRow = async (row: any) => {
        if (window.confirm(t('admin.db.deleteConfirm'))) {
            if (!selectedTable) return;
            const primaryKeyCol = getPrimaryKeyCol(selectedTable);
            try {
                await api.deleteDbRow(selectedTable, row[primaryKeyCol]);
                alert(t('admin.db.deleteSuccess'));
                fetchTableData(selectedTable, currentPage);
            } catch (err) {
                alert((err as Error).message);
            }
        }
    };

    const totalPages = Math.ceil(totalRows / ROWS_PER_PAGE);

    const renderCell = (row: any, col: string) => {
        const isEditing = editingRowId === row[getPrimaryKeyCol(selectedTable)];
        let value = isEditing ? editingRowData[col] : row[col];

        if (typeof value === 'object' && value !== null) {
            value = JSON.stringify(value, null, 2);
        }
        
        const isJson = typeof value === 'string' && value.startsWith('{') && value.endsWith('}');

        if (isEditing) {
            return (
                <td key={col} className="p-2 border border-slate-700">
                    {isJson ? (
                        <textarea
                            value={value}
                            onChange={e => setEditingRowData({ ...editingRowData, [col]: e.target.value })}
                            className="w-full h-40 bg-slate-900 text-xs font-mono"
                        />
                    ) : (
                        <input
                            type="text"
                            value={value}
                            onChange={e => setEditingRowData({ ...editingRowData, [col]: e.target.value })}
                            className="w-full bg-slate-900"
                        />
                    )}
                </td>
            );
        }

        return (
            <td key={col} className="p-2 border border-slate-700 text-xs">
                {isJson ? <pre className="whitespace-pre-wrap break-all">{value}</pre> : String(value)}
            </td>
        );
    };

    return (
        <div className="animate-fade-in">
            <h3 className="text-2xl font-bold text-indigo-400 mb-4">{t('admin.db.title')}</h3>
            <div className="flex gap-2 mb-4 flex-wrap">
                <strong className="mr-2 self-center">{t('admin.db.tables')}:</strong>
                {tables.map(table => (
                    <button key={table} onClick={() => handleSelectTable(table)} className={`px-3 py-1 text-sm rounded ${selectedTable === table ? 'bg-indigo-600' : 'bg-slate-700 hover:bg-slate-600'}`}>
                        {table}
                    </button>
                ))}
            </div>

            {selectedTable && (
                <div>
                    <div className="flex justify-between items-center mb-2">
                        <p className="text-sm text-gray-400">{t('admin.db.totalRows', { count: totalRows })}</p>
                        <div className="flex items-center gap-2">
                            <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="px-3 py-1 text-sm rounded bg-slate-700 disabled:opacity-50">
                                {t('admin.db.prev')}
                            </button>
                            <span className="text-sm">{t('admin.db.page', { current: currentPage, total: totalPages })}</span>
                            <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} className="px-3 py-1 text-sm rounded bg-slate-700 disabled:opacity-50">
                                {t('admin.db.next')}
                            </button>
                        </div>
                    </div>
                    {isLoading ? <p>{t('admin.db.loading')}</p> : (
                        <div className="overflow-x-auto">
                            <table className="w-full border-collapse border border-slate-700">
                                <thead>
                                    <tr className="bg-slate-800">
                                        {tableData.length > 0 && Object.keys(tableData[0]).map(col => <th key={col} className="p-2 border border-slate-700 text-left">{col}</th>)}
                                        <th className="p-2 border border-slate-700">{t('admin.db.actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {tableData.map((row, index) => {
                                        const primaryKeyCol = getPrimaryKeyCol(selectedTable);
                                        const isEditing = editingRowId === row[primaryKeyCol];
                                        return (
                                            <tr key={row[primaryKeyCol] || index} className="hover:bg-slate-800/50">
                                                {Object.keys(row).map(col => renderCell(row, col))}
                                                <td className="p-2 border border-slate-700">
                                                    {isEditing ? (
                                                        <div className="flex flex-col gap-1">
                                                            <button onClick={handleSaveEdit} className="px-2 py-1 text-xs rounded bg-green-700">{t('admin.db.save')}</button>
                                                            <button onClick={handleCancelEdit} className="px-2 py-1 text-xs rounded bg-slate-600">{t('admin.db.cancel')}</button>
                                                        </div>
                                                    ) : (
                                                        <div className="flex flex-col gap-1">
                                                            <button onClick={() => handleEditClick(row)} className="px-2 py-1 text-xs rounded bg-sky-700">{t('admin.db.edit')}</button>
                                                            <button onClick={() => handleDeleteRow(row)} className="px-2 py-1 text-xs rounded bg-red-800">{t('admin.db.delete')}</button>
                                                        </div>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
            {!selectedTable && <p className="text-gray-500">{t('admin.db.noTable')}</p>}
        </div>
    );
};
