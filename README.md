# Vardø Monopoly

Et Monopol-inspirert nettbrettspill med Vardø-tema — «Norges østligste by». Flere spillere
oppretter eller blir med i et rom og spiller sammen i sanntid: gater, næringsvirksomhet,
«Feskebruket» (fengsel/overtid), sjanse- og felleskassekort, auksjoner, hus/hotell og konkurs.

Vardø Monopoly er et prosjekt jeg har jobbet med, med en **frontend** bygget i React (Vite) og en
**backend** i Node.js med Express og Socket.IO.

**▶️ Spill det her: http://37.27.206.15:8082/**

## Slik ble det laget

- **Hele frontenden er 100 % «vibe codet».**
- **Backenden er ~90 % kodet for hånd og ~10 % med AI.**

## Frontend

- **React 19** + **Vite**
- **React Router** – ruting mellom forsiden og spillbrettet
- **Socket.IO-client** – sanntidskommunikasjon med serveren
- Håndskrevet **CSS** (ingen UI-rammeverk)

## Backend

- **Node.js** (ES-moduler)
- **Express 5** – HTTP-ruter (opprett / bli med i spill)
- **Socket.IO** – all spillogikk i sanntid (terningkast, kjøp, leie, auksjon, kort, konkurs …)
- **Ingen database** – all spilltilstand ligger i minnet; brett og kort ligger i JSON-filer
- Token-basert identitet + engangs join-tokens for tilgang til rom

## Kjøre lokalt

To terminaler:

```bash
# Backend (port 3000)
cd backend
npm install
node server.js

# Frontend (port 5173)
cd frontend
npm install
npm run dev
```

Åpne deretter http://localhost:5173.

## Deploy

- **Docker** (multi-stage): bygger frontenden, og backenden serverer den ferdig bygde appen samtidig
  som den kjører spillet.
- **GitHub Actions**: bygger imaget, pusher det til GHCR, og deployer til serveren via SSH ved hver
  push til `master`.
