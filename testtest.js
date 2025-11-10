import { Server } from "socket.io";
import http from "http";
import { type } from "os";
import { json } from "stream/consumers";
import plots from "/Users/kriae/OneDrive/Programmering/Monopoly/plots.json" with {type: "json"};
import cChest from "/Users/kriae/OneDrive/Programmering/Monopoly/cChest.json" with {type: "json"};
import chanceCards from "/Users/kriae/OneDrive/Programmering/Monopoly/chance.json" with {type: "json"};

/*
Todolist:
- Hus
- Fikse outline til "ikke eksisterende" players. 
- Fikse room
- Fikse meny
- Fikse invitation
- Live chat? 
- Leave knapp.
- Mulighet til å kjøpe hus / hotel
- Auction
- Commente koden. 
- Legge til at man ikke kan miste mer penger enn man har i verdi. 
- //FIKSE AT MAN IKKE KAN BLI OVERBYDDDDD 

*/


/*

Lage en Game class som holder alle variabler som ikke er constanter. å alle funksjoner blir metoder. bruke en this.roomId til å sende til bare riktige sockets. 
Lage en id på frontend som sendes til server når nytt spill lages dette blir så this.roomid. bruke passord for å bli med. host bestemmer når spillet skal startes. 
Vær gang en noe sendes fra frontend så må roomId sendes med så på alle socket.on så sjekker den hvilken instans av games classen som matcher room id å kjører funksjonen på den. og emiter tilbake til riktig roomId. 

Auction er vær sin tur. Man må trykke på 1, 20, 50, eller 100 for å velge et beløp. Trykke på bid eller fold. Også kunne minuse eller en "clear" knapp. 
Når jeg trykker bid. så skal mine knapper bli disabled å så skal det stå at player 2 bidder også skal tallet jeg bidda med + 1. 
  
*/

const server = http.createServer();
const io = new Server(server, {
    cors: {
        origin: "*", // tillater alle domener (ikke anbefalt i produksjon)
    }
});

let figures = ["css/img/blåBrikke.png", "css/img/orgBrikke.png", "css/img/gronnBrikke.png", "css/img/lillaBrikke.png"]
let players = []

let playersAuction = []
let auctionTurnIndex = 0;
let aucStartedBy = null;
let aucProperty = null;

let checkCount = 0;
let nextCount = 0;



//funksjon som sjekker hvilken plot spiller har landet på og kjører funksjoner eller gjør noe utifra hvilken plot spiller lander på. 
function checkPlot(socket, io, plot, playerNumb, diceNumb){
    checkCount += 1;
    socket.emit("clearButtons", ["output"]);
    let player = players.find(p => p.playerNumb == playerNumb);
    let owner = players.find(p => p.playerNumb == plot.owner);
    switch(plot.type){
        case "property":
            if(plot.owner == null){
                socket.emit("propertyAvailable", plot.cost, plot.name);
                break;
            } else if(plot.owner == playerNumb){
                nextPlayerTurn(player);
                break;
            } else{
                //Sjekker om en player eier alle av den fargen den lander på og at den ikke eier noen hus på dem. 
                let ownedPlotsCount = plots.filter(p => p.color == plot.color && p.owner == owner.playerNumb).length;
                if(ownedPlotsCount == 3 || (ownedPlotsCount == 2 && (plot.color == "Brown" || plot.color == "dBlue"))){
                    if(plot.houses == 0){
                        owner.balance += plot.housesLeases[0] * 2;
                        player.balance -= plot.housesLeases[0] * 2; 
                        io.emit("balanceChange", playerNumb, player.balance);
                        io.emit("balanceChange", owner.playerNumb, owner.balance);
                        io.emit("message", `player: ${player.playerNumb} (balance: ${player.balance}) landed on player: ${owner.playerNumb} (balance: ${owner.balance}) property and owes him ${plot.housesLeases[0] * 2}`)
                    } else {
                        owner.balance += plot.housesLeases[plot.houses]
                        player.balance -= plot.housesLeases[plot.houses]
                        io.emit("balanceChange", playerNumb, player.balance);
                        io.emit("balanceChange", owner.playerNumb, owner.balance);
                        io.emit("message", `player: ${player.playerNumb} (balance: ${player.balance}) landed on player: ${owner.playerNumb} (balance: ${owner.balance}) property and owes him ${plot.housesLeases[plot.houses]}`)
                    }
                } else {
                    owner.balance += plot.housesLeases[0];
                    player.balance -= plot.housesLeases[0];
                    io.emit("balanceChange", playerNumb, player.balance);
                    io.emit("balanceChange", owner.playerNumb, owner.balance);
                    io.emit("message", `player: ${player.playerNumb} (balance: ${player.balance}) landed on player: ${owner.playerNumb} (balance: ${owner.balance}) property and owes him ${plot.housesLeases[0]}`)
                }
                nextPlayerTurn(player);
            }
            break;
        case "cChest":
            communityChest(socket, io, player, diceNumb);
            break;
        case "chance":
            chanceFunc(socket, io, player, diceNumb);
            break;
        case "tax":
            socket.emit("message", `You have to pay ${plot.name} of $${plot.cost}`);
            player.balance -= plot.cost;
            io.emit("balanceChange", playerNumb, player.balance);
            nextPlayerTurn(player);
            break;
        case "goToJail":
            io.emit("message", `Player Nr: ${player.playerNumb} landed on go to jail and is now in jail`);
            goToJail(socket, io, player);
            break;
        case "utility":
            if(plot.owner == null){
                socket.emit("propertyAvailable", plot.cost, plot.name);
                break;
            }
            let utilityCount = plots.filter(p => p.owner == owner.playerNumb && p.type == "utility").length;
            let utilPay = 0;
            if(utilityCount == 2){
                utilPay = diceNumb * 10;
            } else {
                utilPay = diceNumb * 4;
            }
            player.balance -= utilPay;
            owner.balance += utilPay;
            socket.emit("message", `You have to pay ${utilPay} for using player nr: ${owner.playerNumb} utility`);
            io.emit("balanceChange", playerNumb,  player.balance);
            nextPlayerTurn(player);
            break;
        case "railroad":
            if(plot.owner == null){
                socket.emit("propertyAvailable", plot.cost, plot.name);
                break;
            }
            let railroadRent = [25, 50, 100, 200];
            let railroadCount = plots.filter(p => p.owner == owner.playerNumb && p.type == "railroad").length;
            let railroadPay = railroadRent[railroadCount - 1];
            player.balance -= railroadPay;
            socket.emit("message", `You have to pay $${railroadPay} for using player nr: ${owner.playerNumb} railroad.`);
            io.emit("balanceChange", playerNumb,  player.balance);
            nextPlayerTurn(player);
            break;
        case "jail":
            socket.emit("jailCardAvailable");
            break;
    }
}

//Funksjon som kjører vist spiller lander på en "community chest" plot.
function communityChest(socket, io, player, diceNumb){
    let chestNumb = Math.floor(Math.random() * 16) + 1;
    //let chestNumb = 1;
    let chestCard = cChest.find(c => c.cardNumb == chestNumb);
    io.emit("message", `Player Nr: ${player.playerNumb} landed on community chest and got the card: "${chestCard.cardValue}"`);
    switch(chestCard.Action){
        case "Collect":
            player.balance += chestCard.Value;
            io.emit("balanceChange", player.playerNumb, player.balance);
            nextPlayerTurn(player);
            break;
        case "Pay":
            player.balance -= chestCard.Value;
            io.emit("balanceChange", player.playerNumb, player.balance);
            nextPlayerTurn(player);
            break;
        case "Go":
            let goPlot = plots.find(p => p.position == 0);
            player.playerPos = 0;
            io.emit("playerMoved", player.playerNumb, player.playerPos, goPlot.position, players);
            nextPlayerTurn(player);
            break;
        case "goToJail":
            goToJail(socket, io, player);
            io.emit("message", `Player Nr: ${player.playerNumb} landed on community chest and got the card: "${chestCard.cardValue}"`);
            break;
        case "collectAll":
            collectAll(io, player, chestCard.Value);
            nextPlayerTurn(player);
            break;
    }
}



//Funksjon som kjører vist en spiller lander på en "chance" plot på brettet. 
function chanceFunc(socket, io, player, diceNumb){
    //let chanceNumb = Math.floor(Math.random() * 14) + 1;
    let chanceNumb = 8;
    let chanceCard = chanceCards.find(c => c.cardNumb == chanceNumb);
    io.emit("message", `Player Nr: ${player.playerNumb} landed on chance and got the card: "${chanceCard.cardValue}"`);
    switch (chanceCard.Action) {
        case "move":
            let moveTo = plots.find(p => p.name == chanceCard.Value);
            io.emit("playerMoved", player.playerNumb, player.playerPos, moveTo.position, players, true);
            nextPlayerTurn(player);
            break;
        case "collect":
            player.balance += chanceCard.Value;
            io.emit("balanceChange", player.playerNumb, player.balance);
            nextPlayerTurn(player);
            break;
        case "payAll":
            payAll(io, player, chanceCard.Value);
            nextPlayerTurn(player);
            break;
        //Flytter spiller til nermereste railroad eller utility. 
        case "moveNearest":
            let i = player.playerPos;
            let propertyOwner = null;
            let finalPlot = null;
            while(true){
                let plot = plots.find(p => p.position == i);
                if(plot.type == chanceCard.Value){
                    io.emit("playerMoved", player.playerNumb, player.playerPos, i, players, true);
                    player.playerPos = i;
                    finalPlot = plot;
                    if(plot.owner != null && plot.owner != player.playerNumb){
                        propertyOwner = plot.owner;
                    }
                    break;
                }
                i++
            }
            if(propertyOwner != null){
                socket.emit("utilityDice");
                break;
            }
            socket.emit("propertyAvailable", finalPlot.cost, finalPlot.name);
            break;
        case "getOutOfJailCard":
            player.jailCard += 1;
            nextPlayerTurn(player);
            break;
        case "moveBack":
            io.emit("playerMoved", player.playerNumb, player.playerPos, player.playerPos - 3, players, true, null, true);
            player.playerPos -= 3;
            break;
        //Spiller må betale reperasjon for alle husene og hotell spiller eier. 
        case "repairs":
            let houseCount = 0;
            let hotelCount = 0;
            let ownedPlot = plots.filter(p => p.owner == player.playerNumb);
            for(let i = 0; i < ownedPlot.length; i++){
                houseCount += ownedPlot[i].houses;
                hotelCount += ownedPlot[i].hotels;
            }
            player.balance -= houseCount * 25;
            player.balance -= hotelCount * 100;
            nextPlayerTurn(player);
            io.emit("balanceChange", player.playerNumb, player.balance);
            break;
        case "goToJail":
            io.emit("message", `Player Nr: ${player.playerNumb} landed on chance and got the card: "${chanceCard.cardValue}"`);
            goToJail(socket, io, player);
            break;
        case "Go":
            let goPlot = plots.find(p => p.position == 0);
            player.playerPos = 0;
            nextPlayerTurn(player);
            io.emit("playerMoved", player.playerNumb, player.playerPos, goPlot.position, players);
            break;
    }
}

//funksjon som trekker penger fra en spiller å gir til alle spillerene. 
function payAll(io, player, toPay){
    for(let i = 0; i < players.length; i++){
        if(player.playerNumb != i + 1){
            players[i].balance += toPay;
            player.balance -= toPay;
            io.emit("balanceChange", player.playerNumb, player.balance);
            io.emit("balanceChange", players[i].playerNumb, players[i].balance);
        }
    }
}

//Funksjon som trekker en pengesum fra alle spillerene å gir til en spiller. 
function collectAll(io, player, toPay){
    for(let i = 0; i < players.length; i++){
        if(player.playerNumb != i + 1){
            players[i].balance -= toPay;
            player.balance += toPay;
            io.emit("balanceChange", player.playerNumb, player.balance);
            io.emit("balanceChange", players[i].playerNumb, players[i].balance);
        }
    }
}

//Funksjon som sender en spiller i fengsel.
function goToJail(socket, io, player){
    let jailPlot = plots.find(p => p.type == "jail");
    player.inJail = 2;
    io.emit("playerMoved", player.playerNumb, player.playerPos, jailPlot.position, players, true);
    player.playerPos = jailPlot.position;
    if(player.jailCard != 0){
        socket.emit("jailCardAvailable");
    }
    nextPlayerTurn(player);
}

//funksjon som kjøres når en spiller har rullet terning. 
function rollDice(socket, io, diceNumb, playerNumb, sameDice){
    let player = players.find(p => p.playerNumb == playerNumb);
    let playerNewPos = player.playerPos;
    //Sjekker at ikke player overstiger position 40 (går rundt ved GO) eller er at player ikke er i fengsel.
    if(player.playerTurn == true){
        if(player.inJail != 0){
            if(sameDice == false){
                socket.emit("message", `you are in jaild and dident get the same dice so you have to wait ${player.inJail} rounds more`);
                if(player.inJail == 1){
                    socket.emit("clearButtons", ["jailButton"]);
                }
                player.inJail -= 1;
                return;
            }
            else{
                player.inJail = 0;
            }
        }
        if(player.playerPos + diceNumb >= 40){
            playerNewPos += diceNumb -= 40;
            player.balance += 200;
            socket.emit("message", "you have passed GO and collected $200");
            io.emit("balanceChange", playerNumb, player.balance);
        } else{
            playerNewPos += diceNumb;
        }

        //Finner riktig plot og plot info. 
        let plot = plots.find(plot => plot.position == playerNewPos)
        io.emit("playerMoved", player.playerNumb, player.playerPos, plot.position, players, diceNumb);
        player.playerPos = playerNewPos;
        player.playerTurn = false;
    }
}

/*
Funksjon som brukes vist en dice må rulles etter en spiller har landet en plass som ved kortet. "Advance token to the nearest Utility. If unowned, 
you may buy it from the Bank. If owned, throw dice and pay owner a total 10 times the amount thrown."
*/
function rollUtilityDice(socket, io, diceNumb, playerNumb){
    let player = players.find(p => p.playerNumb == playerNumb);
    player.balance -= diceNumb * 10;
    io.emit("balanceChange", playerNumb, player.balance);
    nextPlayerTurn(player);
}   

//Funksjon som brukes for å kjøpe en property som player står på. 
function buyProperty(socket, io, playerNumb){
    let player = players.find(p => p.playerNumb == playerNumb);
    let plot = plots.find(plot => plot.position == player.playerPos);
    if(player.balance >= plot.cost && plot.owner == null){
        plot.owner = playerNumb;
        player.balance -= plot.cost;
        io.emit("message", `Player: ${playerNumb} bought ${plot.name} for ${plot.cost}$`)
        io.emit("balanceChange", playerNumb, player.balance);
        socket.emit("clearButtons", ["buyButton", "aucButton"]);
        nextPlayerTurn(player);
    }
    else{
        socket.emit("message", "Not enough money to buy that property");
    }
}


//Finner neste player for å sette playerTurn = true, vist neste ikke finnes så gå tilbake i loopen. 
function nextPlayerTurn(player){
    nextCount += 1;
    let nextPlayer = players.find(p => p.playerNumb == (player.playerNumb + 1));
    if(nextPlayer == undefined){
        nextPlayer = players.find(p => p.playerNumb == (player.playerNumb - players.length) + 1)
    }
    player.playerTurn = false;
    nextPlayer.playerTurn = true;
}


function auctionStarted(io, playerNumb){
    let player = players.find(p => p.playerNumb == playerNumb);
    aucProperty = plots.find(p => p.position == player.playerPos);
    console.log("propType: ", aucProperty.type);
    if(aucProperty.type != "property" && aucProperty.type != "railroad" && aucProperty.type != "utility" || aucProperty.owner != null){
        return;
    }
    aucStartedBy = player; 
    let property = plots.find(p => p.position == player.playerPos);
    let startIndex = players.findIndex(p => p.playerNumb == playerNumb);
    playersAuction = players.slice(startIndex).concat(players.slice(0, startIndex));
    io.emit("auctionStarted", property.name, playerNumb)
}

function playerBid(socket, io, auctionBid, playerNumb){
    let brokePlayers = playersAuction.filter(p => p.balance < auctionBid)
    for(let i = 0; i < brokePlayers.length; i++){
        playerFolded(io, brokePlayers[i].playerNumb, auctionBid);
        if(playersAuction.length <= 1){
            return;
        }
    }
    if(!playersAuction.find(p => p.playerNumb == playerNumb)){
        return;
    }
    if(auctionTurnIndex >= playersAuction.length){
        auctionTurnIndex = 0;
    }
    if(playersAuction.length <= 1){
        return;
    }
    if(auctionTurnIndex + 1 == playersAuction.length){
        auctionTurnIndex = 0;
    } else {
        auctionTurnIndex += 1;
    }
    let nextPlayer = playersAuction[auctionTurnIndex];
    io.emit("playerBid", auctionBid, nextPlayer.playerNumb)
}

function playerFolded(io, playerNumb, auctionBid, message){
    playersAuction = playersAuction.filter(p => p.playerNumb != playerNumb)
    io.emit("message", `Player Nr ${playerNumb} folded`);
    if(playersAuction.length == 1){
        console.log("playerAuction0", playersAuction[0]);
        playersAuction[0].balance -= auctionBid;
        let property = plots.find(p => p.position == aucStartedBy.playerPos);
        property.owner = playersAuction[0].playerNumb;
        nextPlayerTurn(aucStartedBy);
        io.emit("auctionOver");
        io.emit("balanceChange", playersAuction[0].playerNumb, playersAuction[0].balance);
        io.emit("message", `player ${playersAuction[0].playerNumb} bought ${property.name} for $${auctionBid}`)
        io.emit("clearButtons", ["aucButton", "buyButton"])
        playersAuction = [];
        auctionTurnIndex = 0;
    }
}


io.on("connection", (socket) => {
    //Sjekker om spiller som kobler seg på er en ny spiller eller bare en refresh. Vist ny spiller så lages en ny spiller. 
    console.log("cookie", socket.handshake.query.player)
    if(socket.handshake.query.player == 0){
        console.log("NEW PLAYER")
        players.push({"playerNumb": players.length + 1, "playerTurn": players.length == 0, "playerPos": 0, "figure": figures[players.length], "balance": 1000, "inJail": 0, "jailCard": 1});
        let cookiePlayerNumb = players.length;
        console.log("cookiePlayerNummb: ", cookiePlayerNumb)
        socket.emit("setPlayerNumber", cookiePlayerNumb);
        io.emit("balanceChange", cookiePlayerNumb, 1000);
        io.emit("playerSpawned", players);
        if(cookiePlayerNumb > 1){
            let i = 1;
            while(i < cookiePlayerNumb){
                socket.emit("balanceChange", i, players[i-1].balance);
                i += 1;
            }
        }
    }

    console.log("PLAYERS: ", players)


    socket.on("diceRolled", (diceNumb, playerNumb, sameDice) => {
        rollDice(socket, io, diceNumb, playerNumb, sameDice);
    })

    socket.on("utilityDiceRolled", (diceNumb, playerNumb) => {
        rollUtilityDice(socket, io, diceNumb, playerNumb)
    })

    socket.on("buyProperty", (playerNumb) => {
        buyProperty(socket, io, playerNumb);
    })

    socket.on("finishedMoving", (playerNumb, finalPlot, diceNumb) => {
        let plot = plots.find(p => p.position == finalPlot.position);
        checkPlot(socket, io, plot, playerNumb, diceNumb);
    })

    socket.on("playerBid", (auctionBid, playerNumb) => {
        playerBid(socket, io, auctionBid, playerNumb);
    })

    socket.on("auctionStarted", (playerNumb) => {
        auctionStarted(io, playerNumb);
    })

    socket.on("playerFold", (playerNumb, auctionBid) => {
        playerFolded(io, playerNumb, auctionBid);
    })

    socket.on("disconnect", () => {
        console.log("Klient frakoblet:", socket.id);
    });
});

server.listen(3000, () => {
    console.log("Server kjører på http://localhost:3000");
});