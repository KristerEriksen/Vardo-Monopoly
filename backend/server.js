import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import gameClass from "./gameClass.js"
import { Server as socketServer } from "socket.io";
import http from "http";
import plots from "./public/plots.json" with {type: "json"};
import path from "path";
import { fileURLToPath } from "url";

// __dirname finnes ikke i ES-moduler, så vi utleder den fra import.meta.url.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distPath = path.join(__dirname, "..", "frontend", "dist");

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));   // leser skjema-data fra POST-body
app.use(bodyParser.json());                            // leser JSON fra POST-body
app.use(cookieParser());
app.set("view engine", "ejs");

app.use(express.static('public'));
app.use(express.static(distPath));   // serverer den bygde React-frontenden (frontend/dist) i produksjon

// ---- All serverens tilstand ligger i minne ----
let gameMap = new Map();     // roomId -> gameClass-instans (ett spill per rom)
let playerMap = new Map();   // player-token -> { roomId, playerNumb } (identitet for handlinger + reconnect)
let joinTokens = new Map();  // join-token -> { roomId, expiresAt } (engangs-tilgang etter riktig passord)



//########################## Kodet av AI
const MAX_GAMES = 15;        // global grense på antall samtidige spill
const LEAVE_GRACE = 60000;   // 1 min før en spiller som forlater blir hoppet over
let leaveTimers = new Map(); // "roomId-playerNumb" -> timeout for å hoppe over en spiller som forlot

// Enkel rate-limiting mot spam av /createGame: maks CREATE_LIMIT rom per IP per CREATE_WINDOW.
let createLog = new Map();   // ip -> liste med tidspunkt for opprettede rom
const CREATE_LIMIT = 5;
const CREATE_WINDOW = 60000;
function rateLimited(ip){
    let now = Date.now();
    let hits = (createLog.get(ip) || []).filter(t => now - t < CREATE_WINDOW);
    if(hits.length >= CREATE_LIMIT){
        createLog.set(ip, hits);
        return true;
    }
    hits.push(now);
    createLog.set(ip, hits);
    return false;
}
//#############################################

// Slår opp identiteten (rom + spillernummer) ut fra en player-token.
function getPlayerNumbAndRoomFromToken(token){
    return playerMap.get(token);
}

// Henter spillet for et rom. Vist rommet ikke finnes, varsler den klienten og returnerer undefined.
function getGameRoom(socket, roomId){
    let game = gameMap.get(roomId);
    if(game == undefined){
        socket.emit("gameError", "Fant ikke rommet");
        return;
    }
    else{
        return(game);
    }
}

//Slår opp identitet fra token + spillet, samlet ett sted. Returnerer null vist noe mangler.
function resolveGame(socket, token){
    let info = getPlayerNumbAndRoomFromToken(token);
    if(!info) return null;
    let game = getGameRoom(socket, info.roomId);
    if(!game) return null;
    return { game, playerNumb: info.playerNumb, roomId: info.roomId };
}

// Lager en engangs join-token (gyldig i 1 minutt) som beviser at riktig passord ble oppgitt.
function createJoinToken(roomId){
    let joinToken = crypto.randomUUID();
    joinTokens.set(joinToken, {roomId, expiresAt: Date.now() + 60000 });
    return joinToken;
}

// Sjekker og forbruker en join-token (engangsbruk). Returnerer roomId vist gyldig, ellers null.
function checkJoinToken(joinToken){
    let entry = joinTokens.get(joinToken);
    if(!entry) return null;
    joinTokens.delete(joinToken);                        // fjernes uansett → kan bare brukes én gang
    if(Date.now() > entry.expiresAt) return null;        // utløpt
    return entry.roomId;
}

//###################### 
// Hjelpe funksjoner til disconnect handleren (Kodet av AI)
// Teller hvor mange sockets som fortsatt er koblet til et rom.
function roomCount(roomId){
    let room = io.sockets.adapter.rooms.get(roomId);
    return room ? room.size : 0;
}

// Sletter et tomt rom fra minnet og rydder bort alle player-tokens som hørte til rommet.
function deleteRoom(roomId){
    gameMap.delete(roomId);
    for (let [t, v] of playerMap){
        if (v.roomId === roomId) playerMap.delete(t);
    }
    for (let [t, entry] of joinTokens){
        if (entry.roomId === roomId) joinTokens.delete(t);
    }
    console.log("Slettet tomt rom:", roomId);
}
//#####################

const server = http.createServer(app);
const io = new socketServer(server, {
    cors: {
        origin: "*", // tillater alle domener (ikke anbefalt i produksjon)
    }
});

// Oppretter et nytt spill: trekker en ledig rom-ID, lager spillet, og svarer med rom-ID + join-token.
app.post("/createGame", (req, res) => {
    // Avvis vist denne IP-en har opprettet for mange rom nylig.
    if(rateLimited(req.ip)){
        return res.status(429).json({error: "For mange rom opprettet — vent litt og prøv igjen"});
    }
    // Global grense på antall samtidige spill.
    if(gameMap.size >= MAX_GAMES){
        return res.status(503).json({error: "Serveren er full — prøv igjen senere"});
    }
    try{
        // Trekk en ledig rom-ID som ikke allerede er i bruk.
        let newRoomId;
        do {
            newRoomId = Math.floor(Math.random() * 10000);
        } while(gameMap.has(newRoomId));
        gameMap.set(newRoomId, new gameClass(newRoomId, req.body.createPassword, plots));
        console.log("Created Game with RoomID: ", newRoomId);
        let joinToken = createJoinToken(newRoomId);
        res.json({roomId: newRoomId, joinToken});
    }
    catch(error){
        console.log(error);
        res.status(500).json({error: "Kunne ikke opprette spill"});
    }
})

// Blir med i et eksisterende spill: sjekker passord, og svarer med rom-ID + join-token vist alt stemmer.
app.post("/joinGame", (req, res) => {
    let roomId = parseInt(req.body.joinRoomID);
    let game = gameMap.get(roomId);
    if(!game || game.getPassword() !== req.body.joinPassword){
        res.status(401).json({error: "Feil Spill id eller passord"});
        return;
    }
    let joinToken = createJoinToken(roomId);
    res.json({roomId, joinToken });
})

// SPA-fallback: alle andre GET-ruter (f.eks. /Game) serverer React-appen, som styrer rutingen selv.
app.get(/.*/, (req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
})

io.on("connection", (socket) => {
    console.log("connection")
    console.log("handshake:", socket.handshake.query.playerNumb);
    // Klienten sender en player-token vist den har en fra før (refresh). Finnes den → reconnect, ellers ny spiller.
    let token = socket.handshake.query.token;
    let info = getPlayerNumbAndRoomFromToken(token);
    if(!info){
        // ---- Ny spiller ----
        // Krever en gyldig join-token (utstedt av /createGame eller /joinGame etter riktig passord).
        let joinToken = socket.handshake.query.joinToken;
        let roomId = checkJoinToken(joinToken);
        if(roomId == null){
            socket.emit("gameError", "Ugyldig eller utløpt tilgang");
            socket.disconnect(true);
            return;
        }
        console.log("CONNECT ROOMID: ", roomId)
        let game = getGameRoom(socket, parseInt(roomId));
        if(!game){
            socket.disconnect(true)
            return;
        }
        // Legg spilleren til i rommet med navnet fra handshaket. Returnerer null vist rommet er fullt.
        let name = socket.handshake.query.name;
        let playerNumb = game.addPlayer(socket, io, name);
        if(playerNumb == null){
            socket.emit("gameError", "Spillet er fullt");
            socket.disconnect(true);
            return;
        }
        // Utsted en langlevd player-token som identifiserer spilleren for resten av spillet + reconnect.
        let newToken = crypto.randomUUID();
        socket.data = { roomId, playerNumb, token: newToken };
        playerMap.set(newToken, {roomId, playerNumb})
        socket.emit("setPlayerToken", newToken, playerNumb);
    } else {
        // ---- Reconnect (refresh) ----
        // Kjent player-token → meld socketen inn i rommet igjen og send hele spilltilstanden på nytt.
        let {roomId, playerNumb} = info;
        let game = getGameRoom(socket, roomId);
        if(!game) return;
        // Spilleren er tilbake — avbryt en eventuell "forlatt"-timer og fjern forlatt-flagget.
        let key = `${roomId}-${playerNumb}`;
        if(leaveTimers.has(key)){ clearTimeout(leaveTimers.get(key)); leaveTimers.delete(key); }
        game.playerReturned(playerNumb);
        socket.data = { roomId, playerNumb, token };
        socket.join(roomId);
        game.resync(socket);
    }

    // ---- Spill-events ----
    // Hver handler slår opp identitet + spill via resolveGame og avbryter vist noe mangler.
    // playerNumb hentes fra tokenen på serveren.

    socket.on("diceRolled", (token) => {
        let r = resolveGame(socket, token);
        if(!r) return;
        let { game, playerNumb, roomId } = r;
        console.log(`diceRolled | roomId: ${roomId} | type: ${typeof(roomId)}`);
        game.rollDice(socket, io, playerNumb);
    })
    socket.on("utilityDiceRolled", (token) => {
        let r = resolveGame(socket, token);
        if(!r) return;
        let { game, playerNumb, roomId } = r;
        console.log(`utilityDiceRolled | roomId: ${roomId} | type: ${typeof(roomId)}`);
        game.rollUtilityDice(socket, io, playerNumb)
    })
    socket.on("buyProperty", (token) => {
        let r = resolveGame(socket, token);
        if(!r) return;
        let { game, playerNumb, roomId } = r;
        console.log(`buyProperty | roomId: ${roomId} | type: ${typeof(roomId)}`);
        game.buyProperty(socket, io, playerNumb);
    })
    socket.on("finishedMoving", (token) => {
        let r = resolveGame(socket, token);
        if(!r) return;
        let { game, playerNumb, roomId } = r;
        console.log(`finishedMoving | roomId: ${roomId} | type: ${typeof(roomId)}`);
        game.finishedMoving(socket, io, playerNumb)
    })
    socket.on("playerBid", (token, auctionBid) => {
        let r = resolveGame(socket, token);
        if(!r) return;
        let { game, playerNumb, roomId } = r;
        console.log(`playerBid | roomId: ${roomId} | type: ${typeof(roomId)}`);
        game.playerBid(socket, io, auctionBid, playerNumb);
    })
    socket.on("auctionStarted", (token) => {
        let r = resolveGame(socket, token);
        if(!r) return;
        let { game, playerNumb, roomId } = r;
        console.log(`auctionStarted | roomId: ${roomId} | type: ${typeof(roomId)}`);
        game.auctionStarted(io, playerNumb);
    })
    socket.on("playerFold", (token, auctionBid) => {
        let r = resolveGame(socket, token);
        if(!r) return;
        let { game, playerNumb, roomId } = r;
        console.log(`playerFold | roomId: ${roomId} | type: ${typeof(roomId)}`);
        game.playerFolded(io, playerNumb, auctionBid);
    })

    // Selg et hus på en tomt.
    socket.on("sellHouse", (token, propertyPos) => {
        let r = resolveGame(socket, token);
        if(!r) return;
        let { game, playerNumb, roomId } = r;
        game.sellHouse(socket, io, playerNumb, propertyPos);
    })

    // Kjøp et hus på en tomt.
    socket.on("buyHouse", (token, propertyPos) => {
        let r = resolveGame(socket, token);
        if(!r) return;
        let { game, playerNumb, roomId } = r;
        game.buyHouse(socket, io, playerNumb, propertyPos);
    })

    // Selg en hel tomt tilbake til banken.
    socket.on("sellProperty", (token, propertyPos) => {
        let r = resolveGame(socket, token);
        if(!r) return;
        let { game, playerNumb, roomId } = r;
        game.sellProperty(socket, io, playerNumb, propertyPos);
    })

    // Bruk et "kom deg ut av fengsel"-kort.
    socket.on("jailCardUsed", (token) => {
        let r = resolveGame(socket, token);
        if(!r) return;
        let { game, playerNumb, roomId } = r;
        game.useJailCard(socket, io, playerNumb);
    })

    // Disconnect: tomt rom slettes (med en liten pause i tilfelle refresh). Er andre igjen, hoppes den
    // som forlot over etter LEAVE_GRACE vist den ikke er tilbake, så spillet ikke fryser på turen deres.
    socket.on("disconnect", () => {
        console.log("Klient frakoblet:", socket.id);
        let { roomId, playerNumb } = socket.data ?? {};
        if (roomId == null) return;
        if (roomCount(roomId) === 0) {
            setTimeout(() => {
                if (roomCount(roomId) === 0) deleteRoom(roomId);
            }, 30000);
            return;
        }
        let key = `${roomId}-${playerNumb}`;
        if (leaveTimers.has(key)) clearTimeout(leaveTimers.get(key));
        leaveTimers.set(key, setTimeout(() => {
            leaveTimers.delete(key);
            let game = gameMap.get(roomId);
            if (game) game.playerLeft(io, playerNumb);
        }, LEAVE_GRACE));
    });

});




// Periodisk opprydning: fjerner rom som aldri fikk en spiller, og join-tokens som har utløpt.
// (Rom med spillere ryddes av disconnect-handleren.)
setInterval(() => {
    let now = Date.now();
    for(let [roomId, game] of gameMap){
        if(game.players.length === 0 && now - game.createdAt > 120000){
            deleteRoom(roomId);
        }
    }
    for(let [t, entry] of joinTokens){
        if(now > entry.expiresAt) joinTokens.delete(t);
    }
}, 60000);

// Sikkerhetsnett: logg uventede feil i stedet for å ta ned hele serveren (og alle spillene i den).
process.on("uncaughtException", (err) => console.error("uncaughtException:", err));
process.on("unhandledRejection", (err) => console.error("unhandledRejection:", err));

//server.listen(3000, '0.0.0.0', () => {
server.listen(3000, () => {
    console.log("Server kjører på http://localhost:3000");
});
