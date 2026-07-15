/* global React */
(() => {
const T_GROUPS = window.MONOPOLY_DATA.GROUPS;

// Photo-forward tile: image fills the cell, a scrim + label sit at the bottom,
// a slim color bar marks the property group. All text reads horizontally.

function PhotoTile({ tile, orient, onClick }) {
  const group = tile.group ? T_GROUPS[tile.group] : null;
  const bg = tile.img ? { backgroundImage: `url("${tile.img}")` } : null;
  return (
    <button className={`tile photo po-${orient}`} onClick={onClick} data-comment-anchor={`tile-${tile.pos}`}>
      <div className="tile-photo" style={bg}>
        <image-slot
          id={`slot-${tile.pos}`}
          shape="rect"
          fit="cover"
          src={tile.img || ""}
          placeholder={tile.name}
        ></image-slot>
      </div>
      {group && <span className="tile-bar" style={{ background: group.color }} />}
      <div className="tile-scrim" />
      <div className="tile-label">
        <span className="tile-name">{tile.name}</span>
        {tile.price != null && <span className="tile-price">{tile.price.toLocaleString("no-NO")}</span>}
      </div>
    </button>
  );
}

function SpecialTile({ tile, orient, onClick }) {
  const k = tile.kind;
  return (
    <button className={`tile special ${k} po-${orient}`} onClick={onClick} data-comment-anchor={`tile-${tile.pos}`}>
      <div className="tile-photo special-photo">
        <div className="special-icon" aria-hidden="true">
          {k === "chest" && <ChestIcon />}
          {k === "chance" && <ChanceIcon />}
          {k === "tax" && <TaxIcon />}
        </div>
      </div>
      <div className="tile-scrim" />
      <div className="tile-label">
        <span className="tile-name">{tile.title}</span>
        {tile.sub && <span className="tile-price special-sub">{tile.sub}</span>}
      </div>
    </button>
  );
}

function CornerTile({ tile, onClick }) {
  const id = tile.id;
  return (
    <button className={`tile corner corner-${id}`} onClick={onClick} data-comment-anchor={`tile-${tile.pos}`}>
      <div className="corner-glyph">
        {id === "start" && <StartGlyph />}
        {id === "jail" && <JailGlyph />}
        {id === "parking" && <ParkingGlyph />}
        {id === "goToJail" && <GoToJailGlyph />}
      </div>
      <div className="corner-text">
        <div className="corner-title">{tile.title}</div>
        {tile.sub && <div className="corner-sub">{tile.sub}</div>}
      </div>
    </button>
  );
}

// ---- ICONS ----
function ChestIcon() { return (
  <svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="5" y="12" width="22" height="13" rx="1.5"/>
    <path d="M5 17 H27"/>
    <path d="M6 12 Q6 7 10 7 H22 Q26 7 26 12"/>
    <path d="M16 15 V19"/>
  </svg>
);}
function ChanceIcon() { return (
  <svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 12 Q11 7 16 7 Q21 7 21 12 Q21 15 16 17 V20"/>
    <circle cx="16" cy="24.5" r="1.1" fill="currentColor" stroke="none"/>
  </svg>
);}
function TaxIcon() { return (
  <svg viewBox="0 0 32 32" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 6 V26"/>
    <path d="M20.5 10.5 Q16 8 13 11 Q11 14 16 16 Q21 18 19 21.5 Q16 24 11.5 21.5"/>
  </svg>
);}

// Travel runs counter-clockwise: from START (bottom-right) the next tile is to
// the LEFT, so the GO arrow points left-and-down (out toward the corner edge).
function StartGlyph() { return (
  <svg viewBox="0 0 64 64" width="46" height="46" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
    <path d="M50 20 H20 V44"/>
    <path d="M30 34 L20 44 L10 34"/>
  </svg>
);}
function JailGlyph() { return (
  <svg viewBox="0 0 64 64" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="16" y="16" width="32" height="32" rx="3"/>
    <path d="M26 16 V48 M38 16 V48"/>
  </svg>
);}
function ParkingGlyph() { return (
  <svg viewBox="0 0 64 64" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="14" y="14" width="36" height="36" rx="8"/>
    <path d="M26 24 V42 M26 24 H34 Q39 24 39 29 Q39 34 34 34 H26"/>
  </svg>
);}
function GoToJailGlyph() { return (
  <svg viewBox="0 0 64 64" width="44" height="44" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
    <rect x="18" y="18" width="30" height="30" rx="3"/>
    <path d="M27 18 V48 M37 18 V48"/>
    <path d="M14 14 L22 22 M22 14 L14 22"/>
  </svg>
);}

function dispatchTile(tile, orient, onClick) {
  switch (tile.kind) {
    case "corner":     return <CornerTile tile={tile} onClick={onClick} />;
    case "property":
    case "transport":
    case "utility":    return <PhotoTile tile={tile} orient={orient} onClick={onClick} />;
    case "chest":
    case "chance":
    case "tax":        return <SpecialTile tile={tile} orient={orient} onClick={onClick} />;
    default: return null;
  }
}

function orientFor(pos) {
  if ([0,10,20,30].includes(pos)) return "corner";
  if (pos < 10)  return "bottom";
  if (pos < 20)  return "left";
  if (pos < 30)  return "top";
  return "right";
}

window.MONOPOLY_TILES = { dispatchTile, orientFor };
})();
