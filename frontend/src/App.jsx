import { useEffect, useState } from "react";
import Board from "./components/Board";
import Controls from "./components/Controls";
import useSocket from "./hooks/useSocket";

export default function App() {
  const { socket, players, setPlayers, roomId, playerNumb } = useSocket();
  const [plots, setPlots] = useState([]);

  useEffect(() => {
    import("./data/plots.json").then((data) => setPlots(data.default));
  }, []);

  if (!plots.length) return <div>Laster brett...</div>;

  return (
    <div className="game-container" style={{ display: "flex", gap: "40px" }}>
      <Board plots={plots} players={players} />
      <Controls socket={socket} roomId={roomId} playerNumb={playerNumb} />
    </div>
  );
}
