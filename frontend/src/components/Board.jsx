import { mapPlotToGrid } from "../utils/mapPlotToGrid";
import Tile from "./Tile";
import "../styles/board.css";

export default function Board({ plots, players }) {
  return (
    <div className="board">
      {plots.map((plot) => {
        const { row, col } = mapPlotToGrid(plot.position);

        return (
          <div
            key={plot.position}
            style={{
              gridRowStart: row + 1,
              gridColumnStart: col + 1
            }}
          >
            <Tile plot={plot} players={players} />
          </div>
        );
      })}
    </div>
  );
}
