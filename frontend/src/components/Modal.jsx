import { useEffect, useRef, useState } from "react";
import { GROUPS } from "../data/tiles";
import plots from "../data/plots.json";
import { SCALE, kr } from "../utils/messages";

export default function Modal({ tile, game, overrides, setOverride, onClose }) {
  const dlgRef = useRef(null);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!tile) return null;

  const isProperty = tile.kind === "property";
  const ov = overrides[tile.pos] || {};
  const name = ov.name ?? (tile.name || tile.title);

  const group = tile.group ? GROUPS[tile.group] : null;
  // Faktiske leiepriser fra backend (plots.json), omregnet til kr.
  const plot = plots.find((p) => p.position === tile.pos);
  const rents = isProperty && plot?.housesLeases ? plot.housesLeases.map((v) => v * SCALE) : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} ref={dlgRef}>
        <button className="modal-close" onClick={onClose} aria-label="Lukk">×</button>

        <div
          className="modal-media"
          style={tile.img ? { backgroundImage: `url("${tile.img}")`, backgroundSize: "cover", backgroundPosition: "center" } : null}
        >
          {(tile.kind === "property" || tile.kind === "transport" || tile.kind === "utility") ? (
            tile.img ? (
              <img src={tile.img} alt={name} className="modal-img" />
            ) : null
          ) : (
            <div className="modal-glyph">
              {tile.kind === "chest"  && "Felleskasse"}
              {tile.kind === "chance" && "Sjanse"}
              {tile.kind === "tax"    && "Skatt"}
              {tile.kind === "corner" && tile.title}
            </div>
          )}
          {group && <div className="modal-color-bar" style={{ background: group.color }} />}
        </div>

        <div className="modal-info">
          {group && (
            <div className="modal-group" style={{ color: group.color }}>
              {group.name.toUpperCase()}
            </div>
          )}

          <EditableField
            tag="h2"
            className="modal-title"
            value={name}
            onChange={(v) => setOverride(tile.pos, { name: v })}
          />

          {isProperty && (
            <div className="modal-price">
              Kjøpspris <strong>{tile.price.toLocaleString("no-NO")} kr</strong>
            </div>
          )}
          {tile.kind === "transport" && (
            <div className="modal-price">
              Næringsvirksomhet · <strong>{tile.price.toLocaleString("no-NO")} kr</strong>
            </div>
          )}
          {tile.kind === "utility" && (
            <div className="modal-price">
              Vannhåll · <strong>{tile.price.toLocaleString("no-NO")} kr</strong>
            </div>
          )}

          {rents && (
            <div className="modal-rent">
              <div className="rent-head">Leie</div>
              <ul className="rent-list">
                <RentRow label="Grunnleie"  v={rents[0]} />
                <RentRow label="Med 1 hus"  v={rents[1]} />
                <RentRow label="Med 2 hus"  v={rents[2]} />
                <RentRow label="Med 3 hus"  v={rents[3]} />
                <RentRow label="Med 4 hus"  v={rents[4]} />
                <RentRow label="Med hotell (5 hus)" v={rents[5]} highlight />
                {plot?.housePrice != null && (
                  <RentRow label="Pris per hus" v={plot.housePrice * SCALE} />
                )}
              </ul>
            </div>
          )}

          {(isProperty || tile.kind === "transport" || tile.kind === "utility") && game && (
            <HouseSection tile={tile} plot={plot} game={game} />
          )}
        </div>
      </div>
    </div>
  );
}

function HouseSection({ tile, plot, game }) {
  const pos = tile.pos;
  const isProperty = tile.kind === "property";
  const owner = game.owners?.[pos];
  const houseCount = game.houses?.[pos] ?? 0;
  const isMine = owner != null && owner === game.myNumb;
  const housePrice = plot?.housePrice ?? 0;
  const myBalance = game.balances?.[game.myNumb] ?? 0;

  // Hus krever at man eier hele fargegruppen (samme regel som backend).
  const groupPlots = isProperty ? plots.filter((p) => p.color === plot.color) : [];
  const groupOwned =
    isMine && isProperty && groupPlots.every((p) => game.owners?.[p.position] === game.myNumb);
  // Jevn fordeling: kjøp bare på tomter med færrest hus, selg fra dem med flest.
  const evenBuy = groupPlots.every((p) => (game.houses?.[p.position] ?? 0) >= houseCount);
  const evenSell = groupPlots.every((p) => (game.houses?.[p.position] ?? 0) <= houseCount);

  // Salg til banken: halv tomtepris + halv huspris for husene.
  const saleValue = (plot?.cost ?? 0) / 2 + houseCount * (housePrice / 2);

  return (
    <div className="modal-houses">
      <div className="rent-head">{isProperty ? "Hus" : "Eierskap"}</div>

      {isProperty && (
        <div className="house-status">
          {houseCount === 5 ? (
            <>
              <span className="hotel-block" /> <span>Hotell (fullt utbygd)</span>
            </>
          ) : (
            <>
              {Array.from({ length: 4 }).map((_, i) => (
                <span key={i} className={`house-block${i < houseCount ? "" : " empty"}`} />
              ))}
              <span>{houseCount} av 4 hus{houseCount === 4 ? " — neste kjøp gir hotell" : ""}</span>
            </>
          )}
        </div>
      )}

      {isMine ? (
        <>
          {isProperty && (
            <div className="house-actions">
              <button
                className="btn-primary"
                disabled={!groupOwned || !evenBuy || houseCount >= 5 || myBalance < housePrice}
                onClick={() => game.buyHouse(pos)}
              >
                Kjøp hus ({kr(housePrice)})
              </button>
              <button
                className="btn-ghost"
                disabled={houseCount === 0 || !evenSell}
                onClick={() => game.sellHouse(pos)}
              >
                Selg hus (+{kr(housePrice / 2)})
              </button>
            </div>
          )}
          <div className="house-actions">
            <button className="btn-ghost" onClick={() => game.sellProperty(pos)}>
              Selg tomten til banken (+{kr(saleValue)})
            </button>
          </div>
          {isProperty && !groupOwned && (
            <div className="house-hint">Du må eie alle tomtene i fargegruppen for å bygge hus.</div>
          )}
          {groupOwned && !evenBuy && houseCount < 5 && (
            <div className="house-hint">Jevn fordeling: bygg først på tomtene i gruppen med færrest hus.</div>
          )}
          {houseCount > 0 && !evenSell && (
            <div className="house-hint">Jevn fordeling: selg først fra tomtene i gruppen med flest hus.</div>
          )}
          {groupOwned && evenBuy && houseCount < 5 && myBalance < housePrice && (
            <div className="house-hint">Du har ikke råd til flere hus akkurat nå.</div>
          )}
        </>
      ) : owner != null ? (
        <div className="house-hint">Eies av {game.nameOf(owner)}.</div>
      ) : (
        <div className="house-hint">Ingen eier ennå — kjøp tomten når du lander på den.</div>
      )}
    </div>
  );
}

function RentRow({ label, v, highlight }) {
  return (
    <li className={highlight ? "highlight" : ""}>
      <span>{label}</span>
      <strong>{v.toLocaleString("no-NO")} kr</strong>
    </li>
  );
}

function EditableField({ tag: Tag = "div", className, value, onChange, multiline }) {
  const ref = useRef(null);
  const [editing, setEditing] = useState(false);

  function commit() {
    if (!ref.current) return;
    const v = ref.current.innerText.trim();
    setEditing(false);
    if (v !== value) onChange(v);
  }

  return (
    <Tag
      ref={ref}
      className={`${className} editable${editing ? " is-editing" : ""}`}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onFocus={() => setEditing(true)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (!multiline && e.key === "Enter") { e.preventDefault(); ref.current.blur(); }
        if (e.key === "Escape") ref.current.blur();
      }}
    >
      {value}
    </Tag>
  );
}
