export default function FilterBar({
  search,
  onSearchChange,
  formatFilter,
  onFormatChange,
  tagFilter,
  onTagChange,
  allTags,
}) {
  return (
    <div className="filter-bar">
      <div className="search-box">
        <svg viewBox="0 0 24 24" className="search-icon">
          <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
        </svg>
        <input
          type="text"
          placeholder="搜尋劇本名稱、作者、備註..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {search && (
          <button className="clear-btn" onClick={() => onSearchChange('')}>
            ✕
          </button>
        )}
      </div>
      <div className="filter-row">
        <div className="filter-group">
          <label>格式</label>
          <select value={formatFilter} onChange={(e) => onFormatChange(e.target.value)}>
            <option value="all">全部</option>
            <option value="digital">電子檔</option>
            <option value="paper">紙本</option>
          </select>
        </div>
        <div className="filter-group">
          <label>標籤</label>
          <select value={tagFilter} onChange={(e) => onTagChange(e.target.value)}>
            <option value="all">全部</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>
                {tag}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
