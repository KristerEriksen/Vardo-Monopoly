// Vardø Eiendomsspill — board data.
// Real Vardø streets, illustrated artwork per property.
// Original color-group palette (oklch) — not Hasbro's.

const GROUPS = {
  g1: { name: "Vardø Sentrum",     color: "#e0653f" }, // terracotta
  g2: { name: "Idrettsparken",     color: "#3fa7d6" }, // sky
  g3: { name: "Havnedistriktet",   color: "#e84a6f" }, // rose
  g4: { name: "Sandgata",          color: "#f2a541" }, // amber
  g5: { name: "Gamle Vardø",       color: "#b8443a" }, // brick
  g6: { name: "Vestre by",         color: "#e8c33f" }, // mustard
  g7: { name: "Østre by",          color: "#3fa06a" }, // forest
  g8: { name: "Vardøhus",          color: "#5b6ee0" }, // indigo
};

const IMG = (f) => {
  const id = f.replace(/\.[^.]+$/, "");
  return (window.__resources && window.__resources[id]) || `images/${f}`;
};
const TILES = [
  { pos:0,  kind:"corner",  id:"start",     title:"START",          sub:"Hent 4000 kr"  },
  { pos:1,  kind:"property",group:"g1", name:"Vadsøgata",          price:1200, img:IMG("vadsogata.jpg"),
    desc:"Stille boliggate i sentrum. Lavt prisnivå, trygg start." },
  { pos:2,  kind:"chest",   id:"chest1",    title:"Felleskasse" },
  { pos:3,  kind:"property",group:"g1", name:"Finnmarksveien",     price:1200, img:IMG("finnmarksveien.jpg"),
    desc:"Hovedfartsåre gjennom byen. Mye gjennomgangstrafikk." },
  { pos:4,  kind:"tax",     id:"tax1",      title:"Inntektsskatt",  sub:"Betal 2000 kr" },
  { pos:5,  kind:"transport", name:"Vardø Lufthavn", price:2000, icon:"plane",
    desc:"Byens forbindelse til resten av landet." },
  { pos:6,  kind:"property",group:"g2", name:"Idrettsgate",        price:2000, img:IMG("idrettsgate.jpg"),
    desc:"Like ved idrettshallen — liv og røre hver kveld." },
  { pos:7,  kind:"chance",  id:"chance1",   title:"Sjanse" },
  { pos:8,  kind:"property",group:"g2", name:"Idrettsveien",       price:2000, img:IMG("idrettsveien.jpg"),
    desc:"Søsterstrekket til Idrettsgate, med parkering langs hele." },
  { pos:9,  kind:"property",group:"g2", name:"Skolegata",          price:2400, img:IMG("skolegata.jpg"),
    desc:"Skoler og barnefamilier. Livlig om morgenen." },
  { pos:10, kind:"corner",  id:"jail",      title:"FENGSEL",        sub:"Bare på besøk" },
  { pos:11, kind:"property",group:"g3", name:"Strandgaten",        price:2800, img:IMG("strandgaten.jpg"),
    desc:"Brosteinslagt gate med utsikt mot havet." },
  { pos:12, kind:"utility", name:"Kent Bye Kolonial", price:3000, img:IMG("kentbye.jpg"), icon:"shop",
    desc:"Byens kjøpmann gjennom generasjoner." },
  { pos:13, kind:"property",group:"g3", name:"Havnegata",          price:2800, img:IMG("havnegata.jpg"),
    desc:"Skipsanløp og fiskemottak. Salt i lufta." },
  { pos:14, kind:"property",group:"g3", name:"Kaigata",            price:3200, img:IMG("kaigata.jpg"),
    desc:"Rett mot kaifronten — premium beliggenhet." },
  { pos:15, kind:"transport", name:"Vardø Havn", price:2000, icon:"boat",
    desc:"Hurtigruta legger til kai her." },
  { pos:16, kind:"property",group:"g4", name:"Skippergata",        price:3600, img:IMG("skippergata.jpg"),
    desc:"Tradisjonsrik gate med sjømannssjarm." },
  { pos:17, kind:"chest",   id:"chest2",    title:"Felleskasse" },
  { pos:18, kind:"property",group:"g4", name:"Sandtorget",         price:3600, img:IMG("sandtorget.jpg"),
    desc:"Åpen plass, marked på lørdager." },
  { pos:19, kind:"property",group:"g4", name:"Sandvikveien",       price:4000, img:IMG("sandvikveien.jpg"),
    desc:"Lyse boligfelt og småhager." },
  { pos:20, kind:"corner",  id:"parking",   title:"GRATIS PARKERING", sub:"Pust ut" },
  { pos:21, kind:"property",group:"g5", name:"Kirkegata",          price:4400, img:IMG("kirkegata.jpg"),
    desc:"Tett ved kirken — sentralt og verdig." },
  { pos:22, kind:"chance",  id:"chance2",   title:"Sjanse" },
  { pos:23, kind:"property",group:"g5", name:"Grønnegata",         price:4400, img:IMG("gronnegata.jpg"),
    desc:"Trær på begge sider, behagelig om sommeren." },
  { pos:24, kind:"property",group:"g5", name:"Skagveien",          price:4800, img:IMG("skagveien.jpg"),
    desc:"Forbinder vest til øst — alltid trafikk." },
  { pos:25, kind:"transport", name:"Bussterminal", price:2000, icon:"bus",
    desc:"Rutebussen starter og ender her." },
  { pos:26, kind:"property",group:"g6", name:"Per Larsens gate",   price:5200, img:IMG("perlarsensgate.jpg"),
    desc:"Smal og bratt. Lokale kjenner snarveiene." },
  { pos:27, kind:"property",group:"g6", name:"Abrahamsensgate",    price:5200, img:IMG("abrahamsensgate.jpg"),
    desc:"Vernede trehus i rad — gammel stil." },
  { pos:28, kind:"utility", name:"123 Thai", price:3000, img:IMG("123thai.jpg"), icon:"shop",
    desc:"Byens favoritt for takeaway." },
  { pos:29, kind:"property",group:"g6", name:"Vinkelgata",         price:5600, img:IMG("vinkelgata.jpg"),
    desc:"Gjør en skarp sving — det er hele poenget." },
  { pos:30, kind:"corner",  id:"goToJail",  title:"GÅ I FENGSEL",   sub:"Gå direkte"   },
  { pos:31, kind:"property",group:"g7", name:"Søndre Langgate",    price:6000, img:IMG("sondrelanggate.jpg"),
    desc:"Den lengste gata i byen. Tar tid å gå." },
  { pos:32, kind:"property",group:"g7", name:"Batterigata",        price:6000, img:IMG("batterigata.jpg"),
    desc:"Oppkalt etter de gamle kanonstillingene." },
  { pos:33, kind:"chest",   id:"chest3",    title:"Felleskasse" },
  { pos:34, kind:"property",group:"g7", name:"Rømoveien",          price:6400, img:IMG("romoveien.jpg"),
    desc:"Stille endegate med utsikt over byen." },
  { pos:35, kind:"transport", name:"Steggelnesset", price:2000, icon:"boat", img:IMG("steggelnesset.jpg"),
    desc:"Neset mot havet — fyr og fugl." },
  { pos:36, kind:"chance",  id:"chance3",   title:"Sjanse" },
  { pos:37, kind:"property",group:"g8", name:"Festningen",         price:7000, img:IMG("festningen.jpg"),
    desc:"Vardøhus festning på høyden. Byens stolthet." },
  { pos:38, kind:"tax",     id:"tax2",      title:"Luksusskatt",    sub:"Betal 1500 kr" },
  { pos:39, kind:"property",group:"g8", name:"St. Hanshaugen",     price:8000, img:IMG("sthanshaugen.jpg"),
    desc:"Den dyreste adressen i byen. Utsikt over alt." },
];

// 11×11 grid. Start bottom-right (11,11); play runs counter-clockwise on screen.
function gridPos(pos) {
  if (pos === 0) return { row: 11, col: 11 };
  if (pos < 10) return { row: 11, col: 11 - pos };
  if (pos === 10) return { row: 11, col: 1 };
  if (pos < 20) return { row: 11 - (pos - 10), col: 1 };
  if (pos === 20) return { row: 1, col: 1 };
  if (pos < 30) return { row: 1, col: (pos - 20) + 1 };
  if (pos === 30) return { row: 1, col: 11 };
  return { row: (pos - 30) + 1, col: 11 };
}

function rentTable(price) {
  const base = Math.round(price / 60) * 10;
  return [base, base * 5, base * 15, base * 45, base * 70, base * 90];
}

window.MONOPOLY_DATA = { GROUPS, TILES, gridPos, rentTable };
