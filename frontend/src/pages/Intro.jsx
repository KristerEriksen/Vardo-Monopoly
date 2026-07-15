import { useState } from "react";
import { useNavigate } from "react-router-dom";

const TIMEOUT_MS = 6000;

async function postForm(path, fields) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams(fields).toString(),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

export default function Intro() {
  const navigate = useNavigate();
  const [createName, setCreateName] = useState("");
  const [createPass, setCreatePass] = useState("");
  const [joinName, setJoinName] = useState("");
  const [joinRoom, setJoinRoom] = useState("");
  const [joinPass, setJoinPass] = useState("");
  const [busy, setBusy] = useState(null); // "create" | "join" | null
  const [error, setError] = useState({});

  /*
    Backend svarer med JSON {roomId, joinToken}. joinToken er engangs og
    utløper etter 60 sekunder — den gir socket-tilkoblingen adgang til rommet
    (useSocket henter den fra sessionStorage og bytter den mot en spiller-token).
  */
  function enterGame(username, roomId, joinToken) {
    localStorage.setItem("monopoly-username", username.trim());
    sessionStorage.setItem(`monopoly-join-${roomId}`, joinToken);
    navigate(`/Game?RoomId=${roomId}`);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setBusy("create");
    setError({});
    try {
      const res = await postForm("/createGame", {
        createUsername: createName,
        createPassword: createPass,
      });
      const data = await res.json();
      if (!res.ok || !data.joinToken) throw new Error(data.error || "create-failed");
      enterGame(createName, data.roomId, data.joinToken);
    } catch {
      setError({ create: "Kunne ikke opprette spill. Sjekk at backend kjører på port 3000." });
      setBusy(null);
    }
  }

  async function handleJoin(e) {
    e.preventDefault();
    setBusy("join");
    setError({});
    try {
      const res = await postForm("/joinGame", {
        joinUsername: joinName,
        joinRoomID: joinRoom.trim(),
        joinPassword: joinPass,
      });
      if (res.status === 401) {
        setError({ join: "Feil rom-ID eller passord." });
        setBusy(null);
        return;
      }
      const data = await res.json();
      if (!res.ok || !data.joinToken) throw new Error(data.error || "join-failed");
      enterGame(joinName, data.roomId, data.joinToken);
    } catch {
      setError({ join: "Fikk ikke kontakt med serveren. Sjekk at backend kjører på port 3000." });
      setBusy(null);
    }
  }

  return (
    <div className="intro-page">
      <div className="intro-hero">
        <div className="intro-rule" />
        <div className="intro-eyebrow">Eiendomsspill</div>
        <h1 className="intro-title">VARD<span className="o">Ø</span></h1>
        <div className="intro-tag">Norges østligste by</div>
      </div>

      <div className="intro-cards">
        <form className="intro-card" onSubmit={handleCreate}>
          <h2>Opprett spill</h2>
          <p className="card-sub">Lag et nytt rom og del rom-ID-en med vennene dine.</p>
          <div className="field">
            <label htmlFor="createName">Navn</label>
            <input
              id="createName"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              required
              maxLength={20}
              autoComplete="nickname"
            />
          </div>
          <div className="field">
            <label htmlFor="createPass">Rom-passord</label>
            <input
              id="createPass"
              type="password"
              value={createPass}
              onChange={(e) => setCreatePass(e.target.value)}
              required
            />
          </div>
          {error.create && <div className="form-error">{error.create}</div>}
          <button type="submit" className="btn-primary" disabled={busy !== null}>
            {busy === "create" ? "Oppretter …" : "Opprett rom"}
          </button>
        </form>

        <form className="intro-card" onSubmit={handleJoin}>
          <h2>Bli med i spill</h2>
          <p className="card-sub">Skriv inn rom-ID og passord du har fått av verten.</p>
          <div className="field">
            <label htmlFor="joinName">Navn</label>
            <input
              id="joinName"
              value={joinName}
              onChange={(e) => setJoinName(e.target.value)}
              required
              maxLength={20}
              autoComplete="nickname"
            />
          </div>
          <div className="field">
            <label htmlFor="joinRoom">Rom-ID</label>
            <input
              id="joinRoom"
              value={joinRoom}
              onChange={(e) => setJoinRoom(e.target.value)}
              required
              inputMode="numeric"
              placeholder="f.eks. 4231"
            />
          </div>
          <div className="field">
            <label htmlFor="joinPass">Rom-passord</label>
            <input
              id="joinPass"
              type="password"
              value={joinPass}
              onChange={(e) => setJoinPass(e.target.value)}
              required
            />
          </div>
          {error.join && <div className="form-error">{error.join}</div>}
          <button type="submit" className="btn-primary" disabled={busy !== null}>
            {busy === "join" ? "Blir med …" : "Bli med"}
          </button>
        </form>
      </div>

      <p className="intro-note">
        Maks 4 spillere per rom. Navnet lagres kun lokalt i nettleseren din —
        andre spillere ser deg som «Spiller N».
      </p>
    </div>
  );
}
