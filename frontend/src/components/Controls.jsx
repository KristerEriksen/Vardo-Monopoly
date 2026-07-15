import { useEffect, useState } from "react";
import { kr } from "../utils/messages";

const PLAYER_COLORS = ["#e0653f", "#3fa7d6", "#3fa06a", "#e8c33f"];

// Serveren regner nå direkte i kr.
const BID_STEPS = [
  { add: 10, label: "+10" },
  { add: 50, label: "+50" },
  { add: 100, label: "+100" },
  { add: 500, label: "+500" },
];

export default function Controls({ game }) {
  const {
    players, balances, myNumb, turnNumb, dice, log,
    card, propertyOffer, auction, jailCard, moving, debt,
    rollDice, buyProperty, startAuction, bid, fold, useJailCard, dismissCard, nameOf,
  } = game;

  const myBalance = balances[myNumb] ?? 0;
  const myBankrupt = players.find((p) => p.playerNumb === myNumb)?.bankrupt === true;
  const myTurn = turnNumb != null && turnNumb === myNumb;
  const canRoll = myNumb != null && !moving && !myBankrupt && debt == null && (turnNumb == null || myTurn);

  return (
    <div className="game-panel">
      {debt != null && (
        <div className="panel-box warn-banner">
          Du skylder {kr(debt)}! Klikk på tomtene dine på brettet og selg hus
          eller tomter til gjelden er betalt — spillet venter på deg.
        </div>
      )}

      {myBankrupt && (
        <div className="panel-box warn-banner">
          Du er konkurs og er ute av spillet. Alt du eide er solgt.
        </div>
      )}

      <div className="panel-row">
        <div className="panel-box players-strip">
          {players.length === 0 && <span className="msg-muted">Venter på spillere …</span>}
          {players.map((p) => (
            <div
              key={p.playerNumb}
              className={`player-chip${p.playerNumb === turnNumb ? " on-turn" : ""}${p.bankrupt ? " bankrupt" : ""}`}
            >
              <span
                className="p-dot"
                style={{ background: PLAYER_COLORS[(p.playerNumb - 1) % PLAYER_COLORS.length] }}
              />
              <span className="p-name">
                {nameOf(p.playerNumb)}
                {p.playerNumb === myNumb ? " (deg)" : ""}
              </span>
              {p.bankrupt ? (
                <span className="bankrupt-flag">konkurs</span>
              ) : (
                <span className="p-bal">{kr(balances[p.playerNumb] ?? p.balance)}</span>
              )}
              {!p.bankrupt && p.playerNumb === turnNumb && <span className="turn-flag">tur</span>}
            </div>
          ))}
        </div>
      </div>

      <div className="panel-row">
        <div className="panel-box dice-box">
          <button className="btn-dice" onClick={rollDice} disabled={!canRoll}>
            Kast terning
          </button>
          <div className="dice-info">
            <span className="dice-faces">
              {dice
                ? dice.d1 != null
                  ? `${dice.d1} + ${dice.d2} = ${dice.total}`
                  : `${nameOf(dice.byPlayer)} kastet ${dice.total}`
                : "—"}
            </span>
            <span className={`turn-text${myTurn ? " my-turn" : ""}`}>
              {turnNumb == null
                ? "…"
                : myTurn
                  ? "Din tur!"
                  : `${nameOf(turnNumb)} sin tur`}
            </span>
          </div>
        </div>
      </div>

      {propertyOffer && (
        <div className="panel-row">
          <div className="panel-box offer-box">
            <span className="offer-text">
              <strong>{propertyOffer.name}</strong> er ledig for {kr(propertyOffer.cost)}
            </span>
            <button className="btn-primary" onClick={buyProperty}>Kjøp</button>
            <button className="btn-ghost" onClick={startAuction}>Auksjon</button>
          </div>
        </div>
      )}

      {jailCard && (
        <div className="panel-row">
          <div className="panel-box offer-box">
            <button className="btn-ghost" onClick={useJailCard}>
              Bruk sykemeldingskort
            </button>
          </div>
        </div>
      )}

      <div className="panel-row">
        <div className="panel-box log-box">
          <div className="log-head">Hendelser</div>
          {log.length === 0 ? (
            <span className="msg-muted">Ingen hendelser ennå.</span>
          ) : (
            <ul className="log-list">
              {log.map((e) => (
                <li key={e.id}>{e.text}</li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {card && (
        <div className="card-overlay" onClick={dismissCard}>
          <div className={`game-card ${card.kind}`} onClick={(e) => e.stopPropagation()}>
            <div className="card-kind">{card.kind === "chance" ? "Sjanse" : "Felleskasse"}</div>
            <div className="card-player">{nameOf(card.player)} trakk:</div>
            <p className="card-text">{card.text}</p>
            <button className="btn-ghost card-close" onClick={dismissCard}>Lukk</button>
          </div>
        </div>
      )}

      {auction && (
        <AuctionBox
          auction={auction}
          myNumb={myNumb}
          myBalance={myBalance}
          bid={bid}
          fold={fold}
          nameOf={nameOf}
        />
      )}
    </div>
  );
}

function AuctionBox({ auction, myNumb, myBalance, bid, fold, nameOf }) {
  const [composed, setComposed] = useState(auction.baseline);
  const [hint, setHint] = useState("");
  const myTurn = auction.turnNumb === myNumb;

  // Nytt bud fra en annen spiller flytter minsteprisen.
  useEffect(() => {
    setComposed(auction.baseline);
    setHint("");
  }, [auction.baseline, auction.turnNumb]);

  function add(amount) {
    if (composed + amount > myBalance) {
      setHint("Du har ikke råd til å by så mye.");
      return;
    }
    setComposed(composed + amount);
  }

  return (
    <div className="auction-overlay">
      <div className="auction-card">
        <div className="auction-head">Auksjon</div>
        <h3 className="auction-prop">{auction.propName}</h3>
        <div className="auction-turn">
          {myTurn ? "Din tur til å by" : `${nameOf(auction.turnNumb)} sin tur til å by`}
        </div>
        <div className="auction-price">{kr(composed)}</div>
        <div className="auction-adds">
          {BID_STEPS.map((step) => (
            <button
              key={step.add}
              className="btn-ghost"
              disabled={!myTurn}
              onClick={() => add(step.add)}
            >
              {step.label}
            </button>
          ))}
          <button className="btn-ghost" disabled={!myTurn} onClick={() => setComposed(auction.baseline)}>
            Nullstill
          </button>
        </div>
        {hint && <div className="form-error">{hint}</div>}
        <div className="auction-actions">
          <button className="btn-primary" disabled={!myTurn} onClick={() => bid(composed)}>
            By {kr(composed)}
          </button>
          <button className="btn-ghost" disabled={!myTurn} onClick={() => fold(composed)}>
            Kast deg
          </button>
        </div>
      </div>
    </div>
  );
}
