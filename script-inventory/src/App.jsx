import { useState, useMemo } from 'react';
import { useScripts, useTags } from './hooks/useScripts';
import Header from './components/Header';
import FilterBar from './components/FilterBar';
import ScriptCard from './components/ScriptCard';
import ScriptForm from './components/ScriptForm';
import ExportButton from './components/ExportButton';
import './App.css';

export default function App() {
  const { scripts, loading, addScript, updateScript, deleteScript } = useScripts();
  const allTags = useTags(scripts);

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [search, setSearch] = useState('');
  const [formatFilter, setFormatFilter] = useState('all');
  const [tagFilter, setTagFilter] = useState('all');

  const filtered = useMemo(() => {
    return scripts.filter((s) => {
      if (formatFilter !== 'all' && s.format !== formatFilter) return false;
      if (tagFilter !== 'all' && !(s.tags || []).includes(tagFilter)) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = [s.name, s.author, s.notes, s.location, ...(s.tags || [])]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [scripts, search, formatFilter, tagFilter]);

  const digitalCount = scripts.filter((s) => s.format === 'digital').length;
  const paperCount = scripts.filter((s) => s.format === 'paper').length;

  const handleSave = async (data) => {
    if (editing) {
      await updateScript(editing.id, data);
    } else {
      await addScript(data);
    }
    setShowForm(false);
    setEditing(null);
  };

  const handleEdit = (script) => {
    setEditing(script);
    setShowForm(true);
  };

  const handleDelete = async (script) => {
    if (window.confirm('確定要刪除這個劇本嗎？')) {
      await deleteScript(script.id, script.filePath);
    }
  };

  const handleCancel = () => {
    setShowForm(false);
    setEditing(null);
  };

  return (
    <div className="app">
      <Header
        totalCount={scripts.length}
        digitalCount={digitalCount}
        paperCount={paperCount}
      />

      <div className="toolbar">
        <ExportButton scripts={filtered} />
        <button className="btn primary add-btn" onClick={() => setShowForm(true)}>
          ＋ 新增劇本
        </button>
      </div>

      <FilterBar
        search={search}
        onSearchChange={setSearch}
        formatFilter={formatFilter}
        onFormatChange={setFormatFilter}
        tagFilter={tagFilter}
        onTagChange={setTagFilter}
        allTags={allTags}
      />

      {loading ? (
        <div className="loading">載入中...</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📚</div>
          <p>{scripts.length === 0 ? '還沒有劇本，點擊「新增劇本」開始吧！' : '沒有符合條件的劇本'}</p>
        </div>
      ) : (
        <div className="script-grid">
          {filtered.map((script) => (
            <ScriptCard
              key={script.id}
              script={script}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {showForm && (
        <ScriptForm
          editing={editing}
          onSave={handleSave}
          onCancel={handleCancel}
          allTags={allTags}
        />
      )}
    </div>
  );
}
