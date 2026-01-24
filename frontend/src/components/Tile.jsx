import "../styles/tile.css";

export default function Tile({ plot, players }) {
  const slots = [
    players.find(p => p.playerNumb === 1 && p.playerPos === plot.position),
    players.find(p => p.playerNumb === 2 && p.playerPos === plot.position),
    players.find(p => p.playerNumb === 3 && p.playerPos === plot.position),
    players.find(p => p.playerNumb === 4 && p.playerPos === plot.position),
  ];

  return (
    <div className="tile">
      <div className="tile-name">{plot.name}</div>

      <div className="player-slots">
        {slots.map((p, i) => (
          <div key={i} className="slot">
            {p ? <img src={p.figure} className="player-icon" /> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
