import express from "express";
import bodyParser from "body-parser";
import cookieParser from "cookie-parser";
import gameClass from "./gameClass.js"
import { Server as socketServer } from "socket.io";
import http from "http";
import plots from "./public/plots.json" with {type: "json"};


const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.set("view engine", "ejs");

app.use(express.static('public'));

let gameMap = new Map();

/*
Todolist:
- Hus
- Fikse outline til "ikke eksisterende" players. 
- Fikse meny
- Fikse invitation
- Live chat? 
- Leave knapp.
- Mulighet til å kjøpe hus / hotel
- Commente koden. 
- Fikse bankrupt. 
- Legge til at man ikke kan miste mer penger enn man har i verdi. 
- Fikse At man ser hvem sin tur det er til å kaste terning. 

*/

const server = http.createServer(app);
const io = new socketServer(server, {
    cors: {
        origin: "*", // tillater alle domener (ikke anbefalt i produksjon)
    }
});

app.get("/", (req, res) => {
    res.render("intro.ejs")
})
app.get("/Game", (req, res) => {
    let roomId = req.query.RoomId
    res.render("inGame.ejs", {roomId})
});
app.post("/createGame", (req, res) => {
    try{
        let newRoomId = String(Math.floor(Math.random() * 10000)).padStart(5, "0");
        newRoomId = parseInt(newRoomId);
        gameMap.set(newRoomId, new gameClass(newRoomId, req.body.createPassword, plots));
        console.log("Created Game with RoomID: ", newRoomId);
        console.log("roomId")
        res.redirect(`/Game?RoomId=${newRoomId}`);
    }
    catch(error){
        console.log(error);
    }
})
app.post("/joinGame", (req, res) => {
    let roomId = parseInt(req.body.joinRoomID);
    let game = gameMap.get(roomId);
    if(game != undefined){
        if(game.getPassword() == req.body.joinPassword){
            res.redirect(`/Game?RoomId=${req.body.joinRoomID}`)
        }
    }
})
io.on("connection", (socket) => {
    console.log("connection")
    //Sjekker om spiller som kobler seg på er en ny spiller eller bare en refresh. Vist ny spiller så lages en ny spiller. 
    console.log("handshake:", socket.handshake.query.playerNumb);
    if(socket.handshake.query.playerNumb == "null" || socket.handshake.query.playerNumb == 0){
        let roomId = parseInt(socket.handshake.query.roomId)
        console.log("CONNECT ROOMID: ", roomId)
        let game = gameMap.get(roomId);
        game.addPlayer(socket, io);
    }
    socket.on("diceRolled", (roomId, diceNumb, playerNumb, sameDice) => {
        let game = gameMap.get(parseInt(roomId));
        console.log(`diceRolled | roomId: ${roomId} | type: ${typeof(roomId)}`);
        game.rollDice(socket, io, diceNumb, playerNumb, sameDice);
    })
    socket.on("utilityDiceRolled", (roomId, diceNumb, playerNumb) => {
        let game = gameMap.get(parseInt(roomId));
        console.log(`utilityDiceRolled | roomId: ${roomId} | type: ${typeof(roomId)}`);
        game.rollUtilityDice(socket, io, diceNumb, playerNumb)
    })
    socket.on("buyProperty", (roomId, playerNumb) => {
        let game = gameMap.get(parseInt(roomId));
        console.log(`buyProperty | roomId: ${roomId} | type: ${typeof(roomId)}`);
        game.buyProperty(socket, io, playerNumb);
    })
    socket.on("finishedMoving", (roomId, playerNumb, finalPlot, diceNumb) => {
        let game = gameMap.get(parseInt(roomId));
        console.log(`finishedMoving | roomId: ${roomId} | type: ${typeof(roomId)}`);
        game.finishedMoving(socket, io, finalPlot, playerNumb, diceNumb)
    })
    socket.on("playerBid", (roomId, auctionBid, playerNumb) => {
        let game = gameMap.get(parseInt(roomId));
        console.log(`playerBid | roomId: ${roomId} | type: ${typeof(roomId)}`);
        game.playerBid(socket, io, auctionBid, playerNumb);
    })
    socket.on("auctionStarted", (roomId, playerNumb) => {
        let game = gameMap.get(parseInt(roomId));
        console.log(`auctionStarted | roomId: ${roomId} | type: ${typeof(roomId)}`);
        game.auctionStarted(io, playerNumb);
    })
    socket.on("playerFold", (roomId, playerNumb, auctionBid) => {
        let game = gameMap.get(parseInt(roomId));
        console.log(`playerFold | roomId: ${roomId} | type: ${typeof(roomId)}`);
        game.playerFolded(io, playerNumb, auctionBid);
    })
    socket.on("disconnect", () => {
        console.log("Klient frakoblet:", socket.id);
    });
});
//server.listen(3000, '0.0.0.0', () => {
server.listen(3000, () => {
    console.log("Server kjører på http://localhost:3000");
});


