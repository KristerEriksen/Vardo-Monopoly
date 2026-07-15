/* global React, ReactDOM */
(() => {
const { useState, useEffect } = React;
const APP_TILES = window.MONOPOLY_DATA.TILES;
const APP_gridPos = window.MONOPOLY_DATA.gridPos;
const { dispatchTile, orientFor } = window.MONOPOLY_TILES;
const { Modal } = window.MONOPOLY_MODAL;

const LS_KEY = "monopoly-overrides-v1";
function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}

function App() {
  const [openTile, setOpenTile] = useState(null);
  const [overrides, setOverrides] = useState(loadOverrides);

  function setOverride(pos, patch) {
    setOverrides((prev) => {
      const next = { ...prev, [pos]: { ...(prev[pos] || {}), ...patch } };
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }

  // Merge overrides into displayed tile copy
  const tilesView = APP_TILES.map((t) => {
    const o = overrides[t.pos] || {};
    return { ...t, name: o.name ?? t.name, title: o.name ?? t.title, desc: o.desc ?? t.desc };
  });

  return (
    <div className="page">
      <Header />
      <BoardStage tiles={tilesView} onOpen={setOpenTile} />
      {openTile != null && (
        <Modal
          tile={tilesView.find((t) => t.pos === openTile)}
          overrides={overrides}
          setOverride={setOverride}
          onClose={() => setOpenTile(null)}
        />
      )}
    </div>
  );
}

function Header() {
  return (
    <header className="header">
      <div className="brand">
        <span className="brand-mark">V</span>
        <div className="brand-text">
          <span className="brand-name">VARDØ</span>
          <span className="brand-sub">Eiendomsspill</span>
        </div>
      </div>
      <div className="header-hint">Klikk en rute for info · dra inn dine egne bilder</div>
    </header>
  );
}

function BoardStage({ tiles, onOpen }) {
  const fitRef = React.useRef(null);
  const boardRef = React.useRef(null);
  React.useEffect(() => {
    function fit() {
      const fitEl = fitRef.current, board = boardRef.current;
      if (!fitEl || !board) return;
      const availW = window.innerWidth - 24;
      const availH = window.innerHeight - 96;
      const s = Math.max(0.3, Math.min(availW / 1000, availH / 1000, 2.4));
      board.style.transform = `scale(${s})`;
      fitEl.style.width = `${1000 * s}px`;
      fitEl.style.height = `${1000 * s}px`;
    }
    fit();
    window.addEventListener("resize", fit);
    const t = setTimeout(fit, 200);
    return () => { window.removeEventListener("resize", fit); clearTimeout(t); };
  }, []);

  return (
    <div className="board-stage">
      <div className="board-fit" ref={fitRef}>
        <div className="board" ref={boardRef} data-screen-label="01 Brett">
          {tiles.map((t) => {
            const { row, col } = APP_gridPos(t.pos);
            return (
              <div
                key={t.pos}
                className={`cell cell-${orientFor(t.pos)}`}
                style={{ gridRow: row, gridColumn: col }}
              >
                {dispatchTile(t, orientFor(t.pos), () => onOpen(t.pos))}
              </div>
            );
          })}
          <BoardCenter />
        </div>
      </div>
    </div>
  );
}

function BoardCenter() {
  return (
    <div className="board-center">
      <div className="center-rule"></div>
      <div className="center-eyebrow">Eiendomsspill</div>
      <h1 className="center-title">VARD<span className="o">Ø</span></h1>
      <div className="center-tag">Verdens østligste by</div>
      <div className="center-meta">
        <div className="m"><span className="mv">40</span><span className="ml">Ruter</span></div>
        <div className="m"><span className="mv">22</span><span className="ml">Gater</span></div>
        <div className="m"><span className="mv">2–6</span><span className="ml">Spillere</span></div>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
})();
