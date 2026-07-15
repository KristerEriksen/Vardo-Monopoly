export const GROUPS = {
  g1: { name: "Kiberg Brun",  color: "#8b5e3c" },
  g2: { name: "Lyseblå",      color: "#7ec4e8" },
  g3: { name: "Rosa",         color: "#e84a9b" },
  g4: { name: "Oransje",      color: "#e8843f" },
  g5: { name: "Rød",          color: "#d64545" },
  g6: { name: "Gul",          color: "#e8c33f" },
  g7: { name: "Grønn",        color: "#3fa06a" },
  g8: { name: "Mørkeblå",     color: "#4a5fd0" },
};

const IMG = (f) => `/streetimages/${f}`;

/*
  Navn og priser speiler backend/public/plots.json 1:1 (pris i kr).
  Posisjonene følger klassisk Monopol-rekkefølge rundt brettet.
*/
export const TILES = [
  { pos:0,  kind:"corner",   id:"start",     title:"START",            sub:"Hent 2000 kr" },
  { pos:1,  kind:"property", group:"g1", name:"Havnegata (Kiberg)",  price:600, img:IMG("havnegata.jpg") },
  { pos:2,  kind:"chest",    id:"chest1",    title:"Felleskasse" },
  { pos:3,  kind:"property", group:"g1", name:"Idrettsveien (Kiberg)", price:600, img:IMG("idrettsveien.jpg") },
  { pos:4,  kind:"tax",      id:"tax1",      title:"Inntektsskatt",    sub:"Betal 1500 kr" },
  { pos:5,  kind:"transport", name:"123 Thai", price:2000, icon:"shop", img:IMG("123thai.jpg") },
  { pos:6,  kind:"property", group:"g2", name:"Abrahamsensgate (Kiberg)", price:1000, img:IMG("abrahamsensgate.jpg") },
  { pos:7,  kind:"chance",   id:"chance1",   title:"Sjanse" },
  { pos:8,  kind:"property", group:"g2", name:"Sandvikveien",       price:1000, img:IMG("sandvikveien.jpg") },
  { pos:9,  kind:"property", group:"g2", name:"Vinkelgata",         price:1200, img:IMG("vinkelgata.jpg") },
  { pos:10, kind:"corner",   id:"jail",      title:"FESKEBRUKET",      sub:"Bare på besøk" },
  { pos:11, kind:"property", group:"g3", name:"Vadsøgata",          price:1400, img:IMG("vadsogata.jpg") },
  { pos:12, kind:"utility",  name:"Østpolen Kro", price:1500, icon:"shop", img:IMG("utility.png") },
  { pos:13, kind:"property", group:"g3", name:"Grønnegata",         price:1400, img:IMG("gronnegata.jpg") },
  { pos:14, kind:"property", group:"g3", name:"Søndre Langgate",    price:1600, img:IMG("sondrelanggate.jpg") },
  { pos:15, kind:"transport", name:"Sandtorget", price:2000, icon:"shop", img:IMG("sandtorget.jpg") },
  { pos:16, kind:"property", group:"g4", name:"Finnmarksveien",     price:1800, img:IMG("finnmarksveien.jpg") },
  { pos:17, kind:"chest",    id:"chest2",    title:"Felleskasse" },
  { pos:18, kind:"property", group:"g4", name:"Batterigata",        price:1800, img:IMG("batterigata.jpg") },
  { pos:19, kind:"property", group:"g4", name:"Idrettsgata",        price:2000, img:IMG("idrettsgate.jpg") },
  { pos:20, kind:"corner",   id:"parking",   title:"GRATIS\nPARKERING",sub:"Pust ut" },
  { pos:21, kind:"property", group:"g5", name:"St. Hanshaugen",     price:2200, img:IMG("sthanshaugen.jpg") },
  { pos:22, kind:"chance",   id:"chance2",   title:"Sjanse" },
  { pos:23, kind:"property", group:"g5", name:"Kirkegata",          price:2200, img:IMG("kirkegata.jpg") },
  { pos:24, kind:"property", group:"g5", name:"Skolegata",          price:2400, img:IMG("skolegata.jpg") },
  { pos:25, kind:"transport", name:"Kent Bye Kolonial", price:2000, icon:"shop", img:IMG("kentbye.jpg") },
  { pos:26, kind:"property", group:"g6", name:"Rømoveien",          price:2600, img:IMG("romoveien.jpg") },
  { pos:27, kind:"property", group:"g6", name:"Skagveien",          price:2600, img:IMG("skagveien.jpg") },
  { pos:28, kind:"utility",  name:"Pub1", price:1500, icon:"shop", img:IMG("utility.png") },
  { pos:29, kind:"property", group:"g6", name:"Per Larssens Gate",  price:2800, img:IMG("perlarsensgate.jpg") },
  { pos:30, kind:"corner",   id:"goToJail",  title:"DRA PÅ\nJOBB",    sub:"Overtid på Feskebruket" },
  { pos:31, kind:"property", group:"g7", name:"Strandgata",         price:3000, img:IMG("strandgaten.jpg") },
  { pos:32, kind:"property", group:"g7", name:"Kaigata",            price:3000, img:IMG("kaigata.jpg") },
  { pos:33, kind:"chest",    id:"chest3",    title:"Felleskasse" },
  { pos:34, kind:"property", group:"g7", name:"Skippergata",        price:3200, img:IMG("skippergata.jpg") },
  { pos:35, kind:"transport", name:"Nordrevåg Kiosken", price:2000, icon:"shop", img:IMG("nordrevagkiosken.png") },
  { pos:36, kind:"chance",   id:"chance3",   title:"Sjanse" },
  { pos:37, kind:"property", group:"g8", name:"Steggelnesset",      price:3500, img:IMG("steggelnesset.jpg") },
  { pos:38, kind:"tax",      id:"tax2",      title:"Luksusskatt",      sub:"Betal 2000 kr" },
  { pos:39, kind:"property", group:"g8", name:"Vardøhus Festning",  price:4000, img:IMG("festningen.jpg") },
];

export function gridPos(pos) {
  if (pos === 0)  return { row: 11, col: 11 };
  if (pos < 10)   return { row: 11, col: 11 - pos };
  if (pos === 10) return { row: 11, col: 1 };
  if (pos < 20)   return { row: 11 - (pos - 10), col: 1 };
  if (pos === 20) return { row: 1, col: 1 };
  if (pos < 30)   return { row: 1, col: (pos - 20) + 1 };
  if (pos === 30) return { row: 1, col: 11 };
  return { row: (pos - 30) + 1, col: 11 };
}

export function orientFor(pos) {
  if ([0, 10, 20, 30].includes(pos)) return "corner";
  if (pos < 10)  return "bottom";
  if (pos < 20)  return "left";
  if (pos < 30)  return "top";
  return "right";
}
