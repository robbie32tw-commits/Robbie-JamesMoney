export default function Header({ totalCount, digitalCount, paperCount }) {
  return (
    <header className="app-header">
      <div className="header-top">
        <h1>劇本庫存系統</h1>
        <p className="subtitle">Script Inventory</p>
      </div>
      <div className="stats-bar">
        <div className="stat-chip">
          <span className="stat-label">總數</span>
          <span className="stat-value">{totalCount}</span>
        </div>
        <div className="stat-chip digital">
          <span className="stat-label">電子檔</span>
          <span className="stat-value">{digitalCount}</span>
        </div>
        <div className="stat-chip paper">
          <span className="stat-label">紙本</span>
          <span className="stat-value">{paperCount}</span>
        </div>
      </div>
    </header>
  );
}
