import Papa from 'papaparse';

const FORMAT_LABELS = { digital: '電子檔', paper: '紙本' };

export default function ExportButton({ scripts }) {
  const handleExport = () => {
    if (scripts.length === 0) return;

    const data = scripts.map((s) => ({
      劇本名稱: s.name,
      格式: FORMAT_LABELS[s.format] || s.format,
      '作者/編劇': s.author || '',
      存放位置: s.location || '',
      數量: s.format === 'paper' ? s.quantity || 1 : '-',
      標籤: (s.tags || []).join('、'),
      備註: s.notes || '',
    }));

    const csv = Papa.unparse(data);
    const bom = '﻿';
    const blob = new Blob([bom + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `劇本庫存_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <button className="btn export" onClick={handleExport} disabled={scripts.length === 0}>
      📥 匯出 CSV
    </button>
  );
}
