/*
  Oversetter backend-meldingene (norske, med $-beløp og backend-navn) til
  visningstekst med Vardø-navnene og kr-beløp, og trekker ut strukturert info
  (hvem kjøpte hva, hvilket kort ble trukket) som turmotoren i useSocket bruker.

  Pengeskala: plots.json og kortene er nå i kr direkte, så ingen omregning.
*/
import plots from "../data/plots.json";
import { TILES } from "../data/tiles";
import { CHANCE_CARDS, CHEST_CARDS } from "../data/backendCards";

export const SCALE = 1;

export function kr(serverAmount) {
  return `${(Number(serverAmount) * SCALE).toLocaleString("no-NO")} kr`;
}

const posByBackendName = new Map(plots.map((p) => [p.name, p.position]));
const tileByPos = new Map(TILES.map((t) => [t.pos, t]));

// Backend-navn (f.eks. "Reading Railroad") -> Vardø-navn ("Vardø Lufthavn").
export function tileNameFor(backendName) {
  const pos = posByBackendName.get(backendName);
  const tile = pos != null ? tileByPos.get(pos) : null;
  return tile ? tile.name || tile.title : backendName;
}

export function posFor(backendName) {
  return posByBackendName.get(backendName) ?? null;
}

// Eksakte meldingsformater fra backend/gameClass.js (norsk).
const RE = {
  rent: /^Spiller (\d+) \(saldo: (-?\d+)\) landet på spiller (\d+) \(saldo: (-?\d+)\) sin tomt og skylder (-?\d+)$/,
  tax: /^Du må betale (.+) på \$(-?\d+)$/,
  sentToJail: /^Spiller nr: (\d+) landet på "gå i fengsel" og er nå i fengsel$/,
  chestCard: /^Spiller nr: (\d+) landet på felleskasse og fikk kortet: "([\s\S]+)"$/,
  chanceCard: /^Spiller nr: (\d+) landet på sjanse og fikk kortet: "([\s\S]+)"$/,
  utilityRent: /^Du må betale (-?\d+) for å bruke spiller nr: (\d+) sitt verk$/,
  railroadRent: /^Du må betale \$(-?\d+) for å bruke spiller nr: (\d+) sin jernbane\.$/,
  jailWait: /^Du er i fengsel og fikk ikke like terninger, så du må vente (-?\d+) runder til$/,
  passedGo: /^Du passerte START og fikk \$(-?\d+)$/,
  notEnough: /^Ikke nokk penger for å kjøpe den tomten$/,
  houseBought: /^Spiller (\d+) kjøpte et hus på (.+) for (-?\d+(?:\.\d+)?)\$$/,
  houseSold: /^Spiller (\d+) solgte et hus på (.+) for (-?\d+(?:\.\d+)?)\$$/,
  propertySold: /^Spiller (\d+) solgte (.+) for (-?\d+(?:\.\d+)?)\$$/,
  bought: /^Spiller (\d+) kjøpte (.+) for (-?\d+(?:\.\d+)?)\$$/,
  folded: /^Spiller nr (\d+) trakk seg$/,
  debt: /^Spiller (\d+) skylder (-?\d+)\$ og må selge hus\/tomter for å betale gjelden$/,
  debtPaid: /^Spiller (\d+) betalte gjelden på (-?\d+)\$$/,
  bankrupt: /^Spiller (\d+) gikk konkurs$/,
  auctionWon: /^Spiller (\d+) kjøpte (.+) for \$(-?\d+)$/,
};

const TAX_NAMES = { "income Tax": "inntektsskatt", "luxury Tax": "luksusskatt" };

/*
  Returnerer { text, effect } der effect er null eller:
  { type: "buy" | "auctionWin", player, pos }
  { type: "card", kind: "chance" | "chest", player, card: { text, flow } }
*/
export function translateMessage(raw) {
  let m;

  if ((m = raw.match(RE.rent))) {
    const [, payer, , owner, , amount] = m;
    return {
      text: `Spiller ${payer} landet på Spiller ${owner} sin tomt og betaler ${kr(amount)} i leie.`,
      effect: null,
    };
  }
  if ((m = raw.match(RE.tax))) {
    return {
      text: `Du betaler ${TAX_NAMES[m[1]] ?? m[1]}: ${kr(m[2])}.`,
      effect: null,
    };
  }
  if ((m = raw.match(RE.sentToJail))) {
    return { text: `Spiller ${m[1]} må jobbe overtid på Feskebruket.`, effect: null };
  }
  if ((m = raw.match(RE.chestCard)) || (m = raw.match(RE.chanceCard))) {
    const kind = raw.includes("felleskasse") ? "chest" : "chance";
    const table = kind === "chest" ? CHEST_CARDS : CHANCE_CARDS;
    const known = table[m[2]];
    const card = known ?? { no: m[2], flow: "advance" };
    return {
      text: `Spiller ${m[1]} trakk ${kind === "chest" ? "et felleskassekort" : "et sjansekort"}: «${card.no}»`,
      effect: { type: "card", kind, player: Number(m[1]), card: { text: card.no, flow: card.flow } },
    };
  }
  if ((m = raw.match(RE.utilityRent))) {
    return {
      text: `Terningen avgjorde hvor mange øl du kjøpte — du betaler ${kr(m[1])} hos Spiller ${m[2]}.`,
      effect: null,
    };
  }
  if ((m = raw.match(RE.railroadRent))) {
    return {
      text: `Du betaler ${kr(m[1])} for å bruke Spiller ${m[2]} sin næringsvirksomhet.`,
      effect: null,
    };
  }
  if ((m = raw.match(RE.jailWait))) {
    return {
      text: `Du må jobbe overtid på Feskebruket — stå over ${m[1]} runde${m[1] === "1" ? "" : "r"} til.`,
      effect: null,
    };
  }
  if ((m = raw.match(RE.passedGo))) {
    return { text: `Du passerte START og mottok ${kr(m[1])}.`, effect: null };
  }
  if (RE.notEnough.test(raw)) {
    return { text: "Du har ikke råd til denne tomten.", effect: null };
  }
  // Hus-meldingene må sjekkes før det generelle kjøps-mønsteret — ellers
  // tolkes "kjøpte et hus på X" som tomtekjøp og turmotoren flytter turen.
  if ((m = raw.match(RE.houseBought))) {
    return {
      text: `Spiller ${m[1]} bygde et hus på ${tileNameFor(m[2])} for ${kr(m[3])}.`,
      effect: null,
    };
  }
  if ((m = raw.match(RE.houseSold))) {
    return {
      text: `Spiller ${m[1]} solgte et hus på ${tileNameFor(m[2])} og fikk ${kr(m[3])}.`,
      effect: null,
    };
  }
  // Tomtesalg må sjekkes etter hus-salg (samme "sold ... for ...$"-form).
  if ((m = raw.match(RE.propertySold))) {
    return {
      text: `Spiller ${m[1]} solgte ${tileNameFor(m[2])} tilbake til banken for ${kr(m[3])}.`,
      effect: null, // eierskap/hus synkes via plots-eventet
    };
  }
  if ((m = raw.match(RE.debt))) {
    return {
      text: `Spiller ${m[1]} skylder ${kr(m[2])} og må selge hus/tomter for å betale gjelden!`,
      effect: { type: "debt", player: Number(m[1]) },
    };
  }
  if ((m = raw.match(RE.debtPaid))) {
    return {
      text: `Spiller ${m[1]} betalte gjelden på ${kr(m[2])}.`,
      effect: { type: "debtPaid", player: Number(m[1]) },
    };
  }
  if ((m = raw.match(RE.bankrupt))) {
    return {
      text: `Spiller ${m[1]} er konkurs! Alt spilleren eide er solgt.`,
      effect: { type: "bankrupt", player: Number(m[1]) },
    };
  }
  if ((m = raw.match(RE.bought))) {
    return {
      text: `Spiller ${m[1]} kjøpte ${tileNameFor(m[2])} for ${kr(m[3])}.`,
      effect: { type: "buy", player: Number(m[1]), pos: posFor(m[2]) },
    };
  }
  if ((m = raw.match(RE.folded))) {
    return { text: `Spiller ${m[1]} kastet seg.`, effect: null };
  }
  if ((m = raw.match(RE.auctionWon))) {
    return {
      text: `Spiller ${m[1]} vant auksjonen om ${tileNameFor(m[2])} for ${kr(m[3])}.`,
      effect: { type: "auctionWin", player: Number(m[1]), pos: posFor(m[2]) },
    };
  }

  // Ukjent format — vis rå melding i stedet for å miste informasjon.
  return { text: raw, effect: null };
}
