const FORMAT_LABELS = { digital: '電子檔', paper: '紙本' };

export default function ScriptCard({ script, onEdit, onDelete }) {
  return (
    <div className={`script-card ${script.format}`}>
      <div className="card-header">
        <span className={`format-badge ${script.format}`}>
          {script.format === 'digital' ? '💾' : '📄'} {FORMAT_LABELS[script.format]}
        </span>
        <div className="card-actions">
          <button className="icon-btn edit" onClick={() => onEdit(script)} title="編輯">
            ✏️
          </button>
          <button className="icon-btn delete" onClick={() => onDelete(script.id)} title="刪除">
            🗑️
          </button>
        </div>
      </div>
      <h3 className="card-title">{script.name}</h3>
      {script.author && <p className="card-author">✍️ {script.author}</p>}
      {script.location && <p className="card-location">📍 {script.location}</p>}
      {script.format === 'paper' && script.quantity > 0 && (
        <p className="card-quantity">📦 數量：{script.quantity}</p>
      )}
      {script.tags?.length > 0 && (
        <div className="card-tags">
          {script.tags.map((tag) => (
            <span key={tag} className="tag">
              {tag}
            </span>
          ))}
        </div>
      )}
      {script.notes && <p className="card-notes">{script.notes}</p>}
    </div>
  );
}
