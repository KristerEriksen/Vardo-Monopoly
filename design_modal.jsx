/* global React */
(() => {
const { useEffect, useRef, useState } = React;
const M_GROUPS = window.MONOPOLY_DATA.GROUPS;
const M_rentTable = window.MONOPOLY_DATA.rentTable;

function Modal({ tile, overrides, setOverride, onClose }) {
  const dlgRef = useRef(null);
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!tile) return null;

  // For non-property tiles, we still show a richer info popup
  const isProperty = tile.kind === "property";
  const ov = overrides[tile.pos] || {};
  const name = ov.name ?? (tile.name || tile.title);
  const desc = ov.desc ?? (tile.desc || defaultDesc(tile));

  const group = tile.group ? M_GROUPS[tile.group] : null;
  const rents = isProperty ? M_rentTable(tile.price) : null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} ref={dlgRef}>
        <button className="modal-close" onClick={onClose} aria-label="Lukk">×</button>

        <div className="modal-media" style={tile.img ? { backgroundImage: `url("${tile.img}")`, backgroundSize: "cover", backgroundPosition: "center" } : null}>
          {(tile.kind === "property" || tile.kind === "transport" || tile.kind === "utility") ? (
            <image-slot
              id={`slot-${tile.pos}`}
              shape="rect"
              fit="cover"
              src={tile.img || ""}
              placeholder={name}
            ></image-slot>
          ) : (
            <div className="modal-glyph">
              {tile.kind === "chest" && "Felleskasse"}
              {tile.kind === "chance" && "Sjanse"}
              {tile.kind === "tax" && "Skatt"}
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
              Transportlinje · <strong>{tile.price.toLocaleString("no-NO")} kr</strong>
            </div>
          )}

          {tile.kind === "utility" && (
            <div className="modal-price">
              Forretning · <strong>{tile.price.toLocaleString("no-NO")} kr</strong>
            </div>
          )}

          <EditableField
            tag="p"
            className="modal-desc"
            value={desc}
            multiline
            onChange={(v) => setOverride(tile.pos, { desc: v })}
          />

          {rents && (
            <div className="modal-rent">
              <div className="rent-head">Leie</div>
              <ul className="rent-list">
                <RentRow label="Grunnleie" v={rents[0]} />
                <RentRow label="Med 1 hus" v={rents[1]} />
                <RentRow label="Med 2 hus" v={rents[2]} />
                <RentRow label="Med 3 hus" v={rents[3]} />
                <RentRow label="Med 4 hus" v={rents[4]} />
                <RentRow label="Med hotell" v={rents[5]} highlight />
              </ul>
            </div>
          )}

          {(tile.kind === "property" || tile.kind === "transport" || tile.kind === "utility") && (
            <div className="modal-hint">
              <b>Tips:</b> dra et bilde rett inn i feltet over for å bytte motiv. Dobbeltklikk for å justere utsnittet.
            </div>
          )}
        </div>
      </div>
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

function EditableField({ tag = "div", className, value, onChange, multiline }) {
  const ref = useRef(null);
  const [editing, setEditing] = useState(false);

  function commit() {
    if (!ref.current) return;
    const v = ref.current.innerText.trim();
    setEditing(false);
    if (v !== value) onChange(v);
  }

  const Tag = tag;
  return (
    <Tag
      ref={ref}
      className={`${className} editable ${editing ? "is-editing" : ""}`}
      contentEditable
      suppressContentEditableWarning
      spellCheck={false}
      onFocus={() => setEditing(true)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (!multiline && e.key === "Enter") { e.preventDefault(); ref.current.blur(); }
        if (e.key === "Escape") { ref.current.blur(); }
      }}
    >
      {value}
    </Tag>
  );
}

function defaultDesc(tile) {
  switch (tile.kind) {
    case "chest": return "Trekk et kort fra felleskassen.";
    case "chance": return "Trekk et sjansekort. Hva som skjer er opp til kortet.";
    case "tax": return tile.sub || "Innbetaling til kassen.";
    case "corner":
      if (tile.id === "start") return "Hver gang du passerer START får du 4000 kr.";
      if (tile.id === "jail") return "Bare på besøk — med mindre du er sendt hit.";
      if (tile.id === "parking") return "Et sted å hvile. Ingen handling kreves.";
      if (tile.id === "goToJail") return "Gå direkte til fengsel. Ikke pass START.";
      return "";
    default: return "";
  }
}

window.MONOPOLY_MODAL = { Modal };
})();
