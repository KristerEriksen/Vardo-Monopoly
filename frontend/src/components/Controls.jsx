export default function Controls({ socket, roomId, playerNumb }) {

  function rollDice() {
    const d1 = Math.floor(Math.random() * 6) + 1;
    const d2 = Math.floor(Math.random() * 6) + 1;
    const same = d1 === d2;
    const total = d1 + d2;

    socket.emit("diceRolled", roomId, total, playerNumb, same);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <button onClick={rollDice}>Roll Dice</button>
    </div>
  );
}
