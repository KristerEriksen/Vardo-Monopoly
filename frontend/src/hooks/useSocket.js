import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import plots from "../data/plots.json";
import { translateMessage, tileNameFor } from "../utils/messages";

const STEP_MS = 120; // tempo på brikke-animasjonen (ms per rute)
const CARD_PAUSE_MS = 2500; // pause så kortmeldingen rekker å leses
const CARD_SHOW_MS = 6500; // hvor lenge kort-overlegget står

/*
  Identitet: serveren gir oss en token (setPlayerToken) som alle senere
  hendelser autentiseres med. Tokenen lagres per rom, så gamle rom ikke
  forstyrrer nye. Ved reconnect med gyldig token resynker serveren oss
  (playerSpawned + plots med eierskap).
*/
function storageKey(roomId) {
  return `monopoly-token-${roomId}`;
}
function loadIdentity(roomId) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(roomId)) || "null");
  } catch {
    return null;
  }
}
function saveIdentity(roomId, token, playerNumb) {
  localStorage.setItem(storageKey(roomId), JSON.stringify({ token, playerNumb }));
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export default function useSocket(roomId) {
  const [socket, setSocket] = useState(null);
  const [players, setPlayers] = useState([]);
  const [balances, setBalances] = useState({});
  const [owners, setOwners] = useState({});
  const [houses, setHouses] = useState({});
  const [myNumb, setMyNumb] = useState(null);
  const [turnNumb, setTurnNumb] = useState(null);
  const [dice, setDice] = useState(null);
  const [log, setLog] = useState([]);
  const [card, setCard] = useState(null);
  const [propertyOffer, setPropertyOffer] = useState(null);
  const [auction, setAuction] = useState(null);
  const [jailCard, setJailCard] = useState(false);
  const [moving, setMoving] = useState(false);
  const [debt, setDebt] = useState(null);
  const [error, setError] = useState(null);
  const [winner, setWinner] = useState(null);

  const socketRef = useRef(null);
  const tokenRef = useRef(null);
  const meRef = useRef(null);
  const playersRef = useRef([]);
  const ownersRef = useRef({});
  const utilityRef = useRef(false);
  const aucStarterRef = useRef(null);
  const pendingUtilityRef = useRef(null);
  const startedRef = useRef(false);
  const logIdRef = useRef(0);
  const cardTimerRef = useRef(null);

  useEffect(() => {
    if (!roomId || startedRef.current) return;
    startedRef.current = true;

    /* ---------- turmotor ----------
       Backend broadcaster aldri hvem som har turen etter at en handling er
       ferdig, men nextPlayerTurn(X) på serveren setter alltid turen til
       spilleren ETTER X — uansett hvem som "har" den nå. Derfor kan alle
       klienter regne ut det samme: tur = neste(X) når Xs handling er avgjort. */
    function nextOf(n) {
      // Konkurs-spillere hoppes over, akkurat som serverens nextPlayerTurn.
      const numbers = playersRef.current
        .filter((p) => p.bankrupt !== true)
        .map((p) => p.playerNumb)
        .sort((a, b) => a - b);
      if (!numbers.length) return n;
      const idx = numbers.indexOf(n);
      if (idx === -1) return numbers[0];
      return numbers[(idx + 1) % numbers.length];
    }
    function advanceFrom(n) {
      setTurnNumb(nextOf(n));
    }

    function addLog(rawText) {
      // Bytt "Spiller N" med spillerens faktiske navn i loggteksten.
      const text = rawText.replace(/Spiller (\d+)/g, (_, n) => nameOf(n));
      setLog((prev) => {
        if (prev[0]?.text === text) return prev; // backend dobbeltsender enkelte meldinger
        return [{ id: ++logIdRef.current, text }, ...prev].slice(0, 25);
      });
    }

    function setOwner(pos, player) {
      if (pos == null) return;
      ownersRef.current = { ...ownersRef.current, [pos]: player };
      setOwners(ownersRef.current);
    }

    function showCard(effect) {
      setCard({ kind: effect.kind, player: effect.player, text: effect.card.text });
      clearTimeout(cardTimerRef.current);
      cardTimerRef.current = setTimeout(() => setCard(null), CARD_SHOW_MS);
    }

    const saved = loadIdentity(roomId);
    if (saved?.token) {
      tokenRef.current = saved.token;
      meRef.current = Number(saved.playerNumb);
      setMyNumb(Number(saved.playerNumb));
    }

    // Nye spillere trenger en engangs joinToken fra intro-siden (lagt i
    // sessionStorage av create/join). Har vi allerede en spiller-token for
    // rommet, brukes den i stedet og serveren resynker oss.
    const joinKey = `monopoly-join-${roomId}`;
    const joinToken = sessionStorage.getItem(joinKey) ?? "";
    const myName = localStorage.getItem("monopoly-username") ?? "";

    // Samme opphav som siden lastes fra (Vite proxyer /socket.io i dev, Express serverer alt i prod).
    const s = io({
      query: { token: saved?.token ?? "", joinToken, roomId, name: myName },
    });
    socketRef.current = s;
    setSocket(s);

    s.on("setPlayerToken", (token, n) => {
      tokenRef.current = token;
      meRef.current = Number(n);
      setMyNumb(Number(n));
      saveIdentity(roomId, token, Number(n));
      sessionStorage.removeItem(joinKey); // engangs — brukt nå
      // Koble til på nytt med tokenen: serverens resync-svar gir full
      // plot-status (eierskap), som nye spillere ellers ikke får.
      s.io.opts.query = { token, roomId };
      s.disconnect().connect();
    });

    s.on("gameError", (msg) => {
      setError(msg || "Ukjent feil");
    });

    // Spillet er over — én spiller står igjen.
    s.on("gameOver", (n) => setWinner(Number(n)));

    // Viser terningkastet serveren sendte.
    s.on("diceResult", (n, d1, d2) => {
      setDice({ byPlayer: Number(n), d1, d2, total: d1 + d2 });
    });

    // Full plot-status fra serveren (resync + etter hus-kjøp/salg) —
    // eierskap og hus er fasit herfra.
    s.on("plots", (serverPlots) => {
      const own = {};
      const hs = {};
      for (const p of serverPlots) {
        if (p.owner != null) own[p.position] = Number(p.owner);
        if (p.houses > 0) hs[p.position] = p.houses;
      }
      ownersRef.current = own;
      setOwners(own);
      setHouses(hs);
    });

    s.on("playerSpawned", (list) => {
      playersRef.current = list;
      setPlayers(list);
      setBalances((prev) => {
        const next = { ...prev };
        for (const p of list) if (next[p.playerNumb] == null) next[p.playerNumb] = p.balance;
        return next;
      });
      // Server-sannhet ved innmelding/resync — resynker turvisningen.
      const holder = list.find((p) => p.playerTurn);
      if (holder) setTurnNumb(holder.playerNumb);
    });

    s.on("balanceChange", (n, balance) => {
      setBalances((prev) => ({ ...prev, [n]: balance }));
      // Etter sjansekort til eid forretning/transport venter serveren på et
      // ekstra terningkast før turen går videre — betalingen er signalet.
      if (pendingUtilityRef.current === Number(n)) {
        pendingUtilityRef.current = null;
        advanceFrom(Number(n));
      }
    });

    s.on("message", (raw) => {
      const { text, effect } = translateMessage(raw);
      addLog(text);
      if (!effect) return;
      if (effect.type === "buy" || effect.type === "auctionWin") {
        setOwner(effect.pos, effect.player);
        if (effect.type === "buy") advanceFrom(effect.player);
        // auctionWin: turen håndteres av auctionOver-eventet
      } else if (effect.type === "debt") {
        // Spillet venter på at skyldneren selger seg ut av gjelden.
        setTurnNumb(effect.player);
      } else if (effect.type === "debtPaid") {
        advanceFrom(effect.player);
        if (effect.player === meRef.current) setDebt(null);
      } else if (effect.type === "bankrupt") {
        // Serveren sender playerSpawned + plots rett etterpå — de er fasit.
        if (effect.player === meRef.current) setDebt(null);
      } else if (effect.type === "card") {
        showCard(effect);
        if (effect.card.flow === "advance") {
          advanceFrom(effect.player);
        } else if (effect.card.flow === "dead") {
          // Kort uten server-håndtering: flytt turen videre klientside.
          advanceFrom(effect.player);
        }
        // flow "move": en ny playerMoved kommer og avgjør turen
      }
    });

    s.on("propertyAvailable", (cost, name) => {
      setPropertyOffer({ cost, name: tileNameFor(name) });
    });

    s.on("clearButtons", (buttons) => {
      if (buttons.includes("buyButton") || buttons.includes("aucButton")) setPropertyOffer(null);
      if (buttons.includes("jailButton")) setJailCard(false);
      // "output" gjaldt den gamle én-linjes tekstboksen — loggen beholdes.
    });

    s.on("utilityDice", () => {
      utilityRef.current = true;
    });

    // Gjeld: serveren sier fra når vi må selge, og når gjelden er betalt.
    s.on("mustSell", (amount) => setDebt(amount));
    s.on("debtPaid", () => setDebt(null));

    s.on("jailCardAvailable", () => setJailCard(true));

    s.on("auctionStarted", (propName, n) => {
      aucStarterRef.current = Number(n);
      setAuction({ propName: tileNameFor(propName), turnNumb: Number(n), baseline: 0 });
      addLog(`Spiller ${n} startet auksjon om ${tileNameFor(propName)}.`);
    });

    s.on("playerBid", (price, nextN) => {
      setAuction((prev) => prev && { ...prev, baseline: price + 1, turnNumb: Number(nextN) });
    });

    s.on("auctionOver", () => {
      setAuction(null);
      if (aucStarterRef.current != null) {
        advanceFrom(aucStarterRef.current);
        aucStarterRef.current = null;
      }
    });

    // Server-signaturen varierer: ved vanlige terningkast er 5. argument et tall (terningen),
    // ved kort-flytting er det `true` (vent til kortet er lest først), og 7. argument er satt når
    // spilleren skal flytte bakover.
    s.on("playerMoved", async (n, fromPos, toPos, list, arg5, arg6, arg7) => {
      const waitBefore = arg5 === true;
      const moveBack = arg7 === true;
      const mover = Number(n);

      setTurnNumb(mover); // spilleren er i aksjon nå (terningen vises via diceResult)

      // Sikkerhetsnett hvis vi ikke har rukket å få playerSpawned ennå.
      if (!playersRef.current.length) playersRef.current = list;
      setPlayers((prev) => (prev.length ? prev : list));

      setMoving(true);
      if (waitBefore) await sleep(CARD_PAUSE_MS);

      let i = fromPos;
      while (i !== toPos) {
        i = moveBack ? i - 1 : i + 1;
        if (i > 39) i = 0;
        if (i < 0) i = 39;
        const pos = i;
        setPlayers((prev) => prev.map((p) => (p.playerNumb === mover ? { ...p, playerPos: pos } : p)));
        await sleep(STEP_MS);
      }
      setMoving(false);

      const plot = plots.find((p) => p.position === toPos);
      const forcedJail = waitBefore && plot?.type === "jail";

      // Backend venter på finishedMoving fra spilleren som flyttet før den
      // avgjør hva ruten betyr. Unntak: tvungen fengselsflytting — der har
      // goToJail() allerede gitt turen videre, og en finishedMoving ville
      // bare trigget jail-casen en gang til.
      if (mover === meRef.current && !forcedJail && tokenRef.current) {
        s.emit("finishedMoving", tokenRef.current);
      }

      // Forutsi serverens turhåndtering ut fra rutetypen og eierskapet.
      if (forcedJail) {
        advanceFrom(mover);
      } else if (plot) {
        switch (plot.type) {
          case "property":
          case "railroad":
          case "utility": {
            const owner = ownersRef.current[toPos];
            if (owner == null) {
              // Kjøpstilbud — turen blir hos spilleren til kjøp/auksjon er avgjort.
            } else if (owner === mover) {
              advanceFrom(mover);
            } else if (waitBefore && (plot.type === "railroad" || plot.type === "utility")) {
              // Sjansekort til eid forretning/transport: eieren får betalt
              // først etter et ekstra terningkast fra spilleren.
              pendingUtilityRef.current = mover;
            } else {
              advanceFrom(mover); // leie trekkes automatisk
            }
            break;
          }
          case "tax":
          case "jail":
            advanceFrom(mover);
            break;
          case "start":
          case "free-parking":
            // Serveren gir turen videre; klienten forutser hvem som blir nest.
            advanceFrom(mover);
            break;
          // chance/cChest: kortmeldingen avgjør turen
          default:
            break;
        }
      }
    });

    return () => {
      s.disconnect();
      socketRef.current = null;
      startedRef.current = false;
      clearTimeout(cardTimerRef.current);
    };
  }, [roomId]);

  // Slår opp en spillers faktiske navn (fra playerSpawned). Faller tilbake til "Spiller N".
  function nameOf(n) {
    if (n == null) return "";
    const p = playersRef.current.find((pl) => pl.playerNumb === Number(n));
    return p?.name || `Spiller ${n}`;
  }

  function rollDice() {
    const s = socketRef.current;
    const token = tokenRef.current;
    if (!s || !token) return;
    // Ber serveren kaste; resultatet kommer tilbake via diceResult.
    if (utilityRef.current) {
      utilityRef.current = false;
      s.emit("utilityDiceRolled", token);
    } else {
      s.emit("diceRolled", token);
    }
  }

  function buyProperty() {
    if (tokenRef.current) socketRef.current?.emit("buyProperty", tokenRef.current);
  }

  function startAuction() {
    if (tokenRef.current) socketRef.current?.emit("auctionStarted", tokenRef.current);
  }

  function bid(amount) {
    if (tokenRef.current) socketRef.current?.emit("playerBid", tokenRef.current, amount);
  }

  function fold(amount) {
    if (tokenRef.current) socketRef.current?.emit("playerFold", tokenRef.current, amount);
  }

  function useJailCard() {
    if (tokenRef.current) socketRef.current?.emit("jailCardUsed", tokenRef.current);
  }

  function buyHouse(propertyPos) {
    if (tokenRef.current) socketRef.current?.emit("buyHouse", tokenRef.current, propertyPos);
  }

  function sellHouse(propertyPos) {
    if (tokenRef.current) socketRef.current?.emit("sellHouse", tokenRef.current, propertyPos);
  }

  function sellProperty(propertyPos) {
    if (tokenRef.current) socketRef.current?.emit("sellProperty", tokenRef.current, propertyPos);
  }

  function dismissCard() {
    clearTimeout(cardTimerRef.current);
    setCard(null);
  }

  return {
    socket,
    players,
    balances,
    owners,
    houses,
    myNumb,
    turnNumb,
    dice,
    log,
    card,
    propertyOffer,
    auction,
    jailCard,
    moving,
    debt,
    error,
    winner,
    rollDice,
    buyProperty,
    startAuction,
    bid,
    fold,
    useJailCard,
    buyHouse,
    sellHouse,
    sellProperty,
    dismissCard,
    nameOf,
  };
}
