import { useRef, useEffect } from "react";
import Tile from "./Tile";
import { gridPos, orientFor } from "../data/tiles";

export default function Board({ tiles, players, owners = {}, houses = {}, nameOf, onOpen }) {
  const fitRef = useRef(null);
  const boardRef = useRef(null);

  useEffect(() => {
    function fit() {
      const fitEl = fitRef.current, board = boardRef.current;
      if (!fitEl || !board) return;
      // Mål plassen brettet faktisk har fått (sidepanelet tar resten av bredden).
      const stage = fitEl.parentElement;
      const rect = stage.getBoundingClientRect();
      const availW = rect.width;
      const availH = window.innerHeight - rect.top - 22;
      const s = Math.max(0.3, Math.min(availW / 1000, availH / 1000, 2.4));
      board.style.transform = `scale(${s})`;
      fitEl.style.width  = `${1000 * s}px`;
      fitEl.style.height = `${1000 * s}px`;
    }
    fit();
    window.addEventListener("resize", fit);
    const ro = new ResizeObserver(fit);
    if (fitRef.current?.parentElement) ro.observe(fitRef.current.parentElement);
    const t = setTimeout(fit, 200);
    return () => { window.removeEventListener("resize", fit); ro.disconnect(); clearTimeout(t); };
  }, []);

  return (
    <div className="board-stage">
      <div className="board-fit" ref={fitRef}>
        <div className="board" ref={boardRef}>
          {tiles.map((t) => {
            const { row, col } = gridPos(t.pos);
            const orient = orientFor(t.pos);
            const tilePlayers = players.filter((p) => p.playerPos === t.pos);
            return (
              <div
                key={t.pos}
                className="cell"
                style={{ gridRow: row, gridColumn: col }}
              >
                <Tile
                  tile={t}
                  orient={orient}
                  players={tilePlayers}
                  owner={owners[t.pos]}
                  houses={houses[t.pos] || 0}
                  nameOf={nameOf}
                  onClick={() => onOpen(t.pos)}
                />
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
      <div className="center-rule" />
      <div className="center-eyebrow">Eiendomsspill</div>
      <h1 className="center-title">VARD<span className="o">Ø</span></h1>
      <div className="center-tag">Norges østligste by</div>
    </div>
  );
}
