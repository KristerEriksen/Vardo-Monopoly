/*
  Kortene i backend/chance.json og backend/cChest.json. Nøkkelen er den
  eksakte kortteksten (cardValue) slik den dukker opp i "message"-eventet.
  Tekstene er allerede norske, så `no` brukes mest til små opprydninger.

  flow forteller turmotoren hva serveren gjør med kortet:
  - "move":    en ny playerMoved kommer etterpå — turen avgjøres da
  - "advance": serveren gir turen videre med en gang
  - "dead":    kortet har ingen server-håndtering (turen må reddes klientside)
*/

export const CHANCE_CARDS = {
  'Gå til "Start"': {
    no: "Gå til START. Motta 2 000 kr.",
    flow: "move",
  },
  'Gå til "Skolegata"': {
    no: "Gå til Skolegata.",
    flow: "move",
  },
  'Gå til "Vadsøgata"': {
    no: "Gå til Vadsøgata.",
    flow: "move",
  },
  'Gå til "Feskebruket" eller "Søppeldynga" utifra ka som e nærmest': {
    no: "Gå til Østpolen Kro eller Pub1 — det som e nærmest. Er det ledig kan du kjøpe. Er det eid: kast terningan (bestemmer kor mange øl du kjøpte) og betal eieren 10 ganger summen.",
    flow: "move",
  },
  "Gå til nærmeste butikk utifra ka som e nærmest": {
    no: "Gå til nærmeste butikk. Er den ledig kan du kjøpe den. Er den eid: betal eieren.",
    flow: "move",
  },
  "Du fant 100kr på gata": {
    no: "Du fant 100 kr på gata!",
    flow: "advance",
  },
  "Sykemeldingskort fra jobb": {
    no: "Sykemeldingskort fra jobb — slipp unna overtid på feskebruket. Spares til du trenger det.",
    flow: "advance",
  },
  "Rygg tre gate tilbake": {
    no: "Rygg tre gater tilbake.",
    flow: "move",
  },
  "Du må på overtids arbeid": {
    no: "Du må på overtidsarbeid på feskebruket! Gå direkte dit — ikke pass START.",
    flow: "move",
  },
  "Du må betale for søppeltømming 50kr per leilighet, 150kr per hus.": {
    no: "Du må betale for søppeltømming: 50 kr per leilighet, 150 kr per hus.",
    flow: "advance",
  },
  'Gå til "123 Thai"': {
    no: "Gå til 123 Thai.",
    flow: "move",
  },
  'Gå til "Vardøhus festning"': {
    no: "Gå til Vardøhus Festning.",
    flow: "move",
  },
  "Din tur å spandere en runde øl på gutta betal vær spiller 100kr": {
    no: "Din tur å spandere en runde øl på gutta — betal 100 kr til hver spiller.",
    flow: "advance",
  },
  "Du vant 200kr på skraplodd": {
    no: "Du vant 200 kr på skraplodd!",
    flow: "advance",
  },
};

export const CHEST_CARDS = {
  'Gå til "Start"': {
    no: "Gå til START. Motta 2 000 kr.",
    flow: "move",
  },
  "Han onkel fikk mye fangst på havet så du fikk en 500lapp": {
    no: "Han onkel fikk mye fangst på havet, så du fikk en 500-lapp.",
    flow: "advance",
  },
  "Du mesta pengboka å mesta 300kr": {
    no: "Du mesta pengboka — og mesta 300 kr.",
    flow: "advance",
  },
  "Du panta etter festen fra helga å fikk 200kr": {
    no: "Du panta etter festen fra helga og fikk 200 kr.",
    flow: "advance",
  },
  "Sykemeldingskort fra jobb": {
    // Felleskasse-varianten gir et sykemeldingskort (freeJailCard i backend).
    no: "Sykemeldingskort fra jobb — spar det for å slippe overtid på Feskebruket.",
    flow: "advance",
  },
  "Du må jobbe overtid på feskebruke": {
    no: "Du må jobbe overtid på feskebruket! Gå direkte dit — ikke pass START.",
    flow: "move",
  },
  "Du fikk en 100 lapp av ho besta": {
    no: "Du fikk en 100-lapp av ho besta.",
    flow: "advance",
  },
  "Du har bursdag så alle spelleran spandere en øl vært 100kr på dæ": {
    no: "Du har bursdag! Alle spelleran spandere en øl (100 kr) på dæ.",
    flow: "advance",
  },
  "Du fikk 300kr i erstatning etter jobbskaden": {
    no: "Du fikk 300 kr i erstatning etter jobbskaden.",
    flow: "advance",
  },
  "Du sklei på isen å måtte på legevakta 200kr": {
    no: "Du sklei på isen og måtte på legevakta. Betal 200 kr.",
    flow: "advance",
  },
  "Du må betale barnebidrag på 300kr": {
    no: "Du må betale barnebidrag på 300 kr.",
    flow: "advance",
  },
  "Du solgte et kg torsketonga å fikk 200kr": {
    no: "Du solgte et kilo torsketonga og fikk 200 kr.",
    flow: "advance",
  },
  "+150kr per hus.": {
    no: "+150 kr per hus du eier.",
    flow: "advance",
  },
  "Du fant en 100 lapp i sofaen på noppen": {
    no: "Du fant en 100-lapp i sofaen på Noppen.",
    flow: "advance",
  },
  "Huske du dem 200kr du lånte bort 2 mnd sia (nei det gjør du ikke) du fikk dem værtfall endelig tilbake": {
    no: "Huske du dem 200 kr du lånte bort for to måneder sia? (Nei.) Du fikk dem værtfall endelig tilbake.",
    flow: "advance",
  },
  "Du fikk skattepengan tilbake. Motta 300kr": {
    no: "Du fikk skattepengan tilbake. Motta 300 kr.",
    flow: "advance",
  },
};
