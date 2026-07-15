import { useState } from "react";
import { Link, Navigate } from "react-router-dom";
import Board from "../components/Board";
import Controls from "../components/Controls";
import Modal from "../components/Modal";
import useSocket from "../hooks/useSocket";
import { TILES } from "../data/tiles";

const LS_KEY = "monopoly-overrides-v1";
function loadOverrides() {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "{}"); } catch { return {}; }
}

export default function GamePage() {
  const roomId = new URLSearchParams(window.location.search).get("RoomId");
  const game = useSocket(roomId);
  const [openTile, setOpenTile] = useState(null);
  const [overrides, setOverrides] = useState(loadOverrides);

  if (!roomId) return <Navigate to="/" replace />;

  const username = localStorage.getItem("monopoly-username") || "";

  function setOverride(pos, patch) {
    setOverrides((prev) => {
      const next = { ...prev, [pos]: { ...(prev[pos] || {}), ...patch } };
      localStorage.setItem(LS_KEY, JSON.stringify(next));
      return next;
    });
  }

  const tilesView = TILES.map((t) => {
    const o = overrides[t.pos] || {};
    return { ...t, name: o.name ?? t.name, desc: o.desc ?? t.desc };
  });

  const openTileData = openTile != null ? tilesView.find((t) => t.pos === openTile) : null;

  return (
    <div className="page">
      <header className="header">
        <div className="brand">
          <Link to="/" className="brand-mark" title="Til forsiden">V</Link>
          <div className="brand-text">
            <span className="brand-name">VARDØ</span>
            <span className="brand-sub">Eiendomsspill</span>
          </div>
        </div>
        <div className="room-info">
          <span className="room-chip">
            Rom: <strong>{roomId}</strong>
          </span>
          <span className="header-hint">
            {game.myNumb != null
              ? `Du er ${username || game.nameOf(game.myNumb)}`
              : "Kobler til …"}
          </span>
        </div>
      </header>

      <div className="game-main">
        <Board
          tiles={tilesView}
          players={game.players}
          owners={game.owners}
          houses={game.houses}
          nameOf={game.nameOf}
          onOpen={setOpenTile}
        />
        <aside className="side-panel">
          <Controls game={game} />
        </aside>
      </div>

      {openTileData && (
        <Modal
          tile={openTileData}
          game={game}
          overrides={overrides}
          setOverride={setOverride}
          onClose={() => setOpenTile(null)}
        />
      )}

      {game.error && (
        <div className="error-overlay">
          <div className="error-card">
            <h3>Kunne ikke koble til rommet</h3>
            <p><strong>{game.error}.</strong></p>
            <p>
              Tilgangen til et rom er engangs og utløper etter ett minutt —
              gå tilbake til forsiden og bli med i rommet på nytt. Finnes ikke
              rommet lenger (tomme rom slettes etter 30 sekunder), må det
              opprettes et nytt.
            </p>
            <Link to="/" className="btn-primary">Til forsiden</Link>
          </div>
        </div>
      )}

      {game.winner != null && (
        <div className="error-overlay">
          <div className="error-card">
            <h3>🎉 {game.nameOf(game.winner)} vant!</h3>
            <p>Alle de andre spillerne er konkurs. Spillet er over.</p>
            <Link to="/" className="btn-primary">Til forsiden</Link>
          </div>
        </div>
      )}
    </div>
  );
}
