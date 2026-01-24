import { useEffect, useState } from "react";
import { io } from "socket.io-client";

export default function useSocket() {
  const [socket, setSocket] = useState(null);
  const [players, setPlayers] = useState([]);

  // Cookie helpers
  function getCookie(name) {
    const cookie = document.cookie
      .split("; ")
      .find((c) => c.startsWith(name + "="));

    return cookie ? cookie.split("=")[1] : null;
  }

  const roomId = new URLSearchParams(window.location.search).get("RoomId");
  const playerNumb = getCookie("playerNumb");

  useEffect(() => {
    const s = io("http://localhost:3000", {
      query: {
        playerNumb,
        roomId
      }
    });

    setSocket(s);

    s.on("setPlayerCookie", (roomId, playerN) => {
      document.cookie = `roomId=${roomId}`;
      document.cookie = `playerNumb=${playerN}`;
    });

    // Update players on spawn
    s.on("playerSpawned", (playersList) => {
      setPlayers(playersList);
    });

    // Update players on movement
    s.on("playerMoved", (_, __, ___, playersList) => {
      setPlayers(playersList);
    });

    return () => s.disconnect();
  }, []);

  return { socket, players, setPlayers, roomId, playerNumb };
}
