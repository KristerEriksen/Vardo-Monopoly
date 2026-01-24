import { type } from "os";
import { json } from "stream/consumers";
import cChest from "/Users/kriae/OneDrive/Programmering/Monopoly/backend/cChest.json" with {type: "json"};
import chanceCards from "/Users/kriae/OneDrive/Programmering/Monopoly/backend/chance.json" with {type: "json"};

let figures = ["css/img/blåBrikke.png", "css/img/orgBrikke.png", "css/img/gronnBrikke.png", "css/img/lillaBrikke.png"]

export default class game{
    constructor(roomId, roomPassword, plots){
        this.roomId = roomId;
        this.password = roomPassword;
        this.plots = JSON.parse(JSON.stringify(plots));
        this.playersAuction = [];
        this.auctionTurnIndex = 0;
        this.aucStartedBy = null;
        this.aucProperty = null;
        this.players = [];
    }
    
    getRoomId(){
        return this.roomId;
    }
    getPassword(){
        return this.password;
    }

    
    addPlayer(socket, io){
        console.log("NEW PLAYER")
        socket.join(this.roomId);
        this.players.push({"playerNumb": this.players.length + 1, "playerTurn": this.players.length == 0, "playerPos": 0, "figure": figures[this.players.length], "balance": 1000, "inJail": 0, "jailCard": 0});
        let cookiePlayerNumb = this.players.length;
        console.log("cookiePlayerNummb: ", cookiePlayerNumb)
        socket.emit("setPlayerCookie", this.roomId, cookiePlayerNumb);
        io.to(this.roomId).emit("balanceChange", cookiePlayerNumb, 1000);
        io.to(this.roomId).emit("playerSpawned", this.players);
        if(cookiePlayerNumb > 1){
            let i = 1;
            while(i < cookiePlayerNumb){
                socket.emit("balanceChange", i, this.players[i-1].balance);
                i += 1;
            }
        }
    }

    //funksjon som sjekker hvilken plot spiller har landet på og kjører funksjoner eller gjør noe utifra hvilken plot spiller lander på. 
    checkPlot(socket, io, plot, playerNumb, diceNumb){
        socket.emit("clearButtons", ["output"]);
        let player = this.players.find(p => p.playerNumb == playerNumb);
        let owner = this.players.find(p => p.playerNumb == plot.owner);
        switch(plot.type){
            case "property":
                if(plot.owner == null){
                    socket.emit("propertyAvailable", plot.cost, plot.name);
                    break;
                } else if(plot.owner == playerNumb){
                    this.nextPlayerTurn(player);
                    break;
                } else{
                    //Sjekker om en player eier alle av den fargen den lander på og at den ikke eier noen hus på dem. 
                    let ownedPlotsCount = this.plots.filter(p => p.color == plot.color && p.owner == owner.playerNumb).length;
                    if(ownedPlotsCount == 3 || (ownedPlotsCount == 2 && (plot.color == "Brown" || plot.color == "dBlue"))){
                        if(plot.houses == 0){
                            owner.balance += plot.housesLeases[0] * 2;
                            player.balance -= plot.housesLeases[0] * 2; 
                            io.to(this.roomId).emit("balanceChange", playerNumb, player.balance);
                            io.to(this.roomId).emit("balanceChange", owner.playerNumb, owner.balance);
                            io.to(this.roomId).emit("message", `player: ${player.playerNumb} (balance: ${player.balance}) landed on player: ${owner.playerNumb} (balance: ${owner.balance}) property and owes him ${plot.housesLeases[0] * 2}`)
                        } else {
                            owner.balance += plot.housesLeases[plot.houses]
                            player.balance -= plot.housesLeases[plot.houses]
                            io.to(this.roomId).emit("balanceChange", playerNumb, player.balance);
                            io.to(this.roomId).emit("balanceChange", owner.playerNumb, owner.balance);
                            io.to(this.roomId).emit("message", `player: ${player.playerNumb} (balance: ${player.balance}) landed on player: ${owner.playerNumb} (balance: ${owner.balance}) property and owes him ${plot.housesLeases[plot.houses]}`)
                        }
                    } else {
                        owner.balance += plot.housesLeases[0];
                        player.balance -= plot.housesLeases[0];
                        io.to(this.roomId).emit("balanceChange", playerNumb, player.balance);
                        io.to(this.roomId).emit("balanceChange", owner.playerNumb, owner.balance);
                        io.to(this.roomId).emit("message", `player: ${player.playerNumb} (balance: ${player.balance}) landed on player: ${owner.playerNumb} (balance: ${owner.balance}) property and owes him ${plot.housesLeases[0]}`)
                    }
                    this.nextPlayerTurn(player);
                }
                break;
            case "cChest":
                this.communityChest(socket, io, player, diceNumb);
                break;
            case "chance":
                this.chanceFunc(socket, io, player, diceNumb);
                break;
            case "tax":
                socket.emit("message", `You have to pay ${plot.name} of $${plot.cost}`);
                player.balance -= plot.cost;
                io.to(this.roomId).emit("balanceChange", playerNumb, player.balance);
                this.nextPlayerTurn(player);
                break;
            case "goToJail":
                io.to(this.roomId).emit("message", `Player Nr: ${player.playerNumb} landed on go to jail and is now in jail`);
                this.goToJail(socket, io, player);
                break;
            case "utility":
                if(plot.owner == null){
                    socket.emit("propertyAvailable", plot.cost, plot.name);
                    break;
                }
                let utilityCount = this.plots.filter(p => p.owner == owner.playerNumb && p.type == "utility").length;
                let utilPay = 0;
                if(utilityCount == 2){
                    utilPay = diceNumb * 10;
                } else {
                    utilPay = diceNumb * 4;
                }
                player.balance -= utilPay;
                owner.balance += utilPay;
                socket.emit("message", `You have to pay ${utilPay} for using player nr: ${owner.playerNumb} utility`);
                io.to(this.roomId).emit("balanceChange", playerNumb,  player.balance);
                this.nextPlayerTurn(player);
                break;
            case "railroad":
                if(plot.owner == null){
                    socket.emit("propertyAvailable", plot.cost, plot.name);
                    break;
                }
                let railroadRent = [25, 50, 100, 200];
                let railroadCount = this.plots.filter(p => p.owner == owner.playerNumb && p.type == "railroad").length;
                let railroadPay = railroadRent[railroadCount - 1];
                player.balance -= railroadPay;
                socket.emit("message", `You have to pay $${railroadPay} for using player nr: ${owner.playerNumb} railroad.`);
                io.to(this.roomId).emit("balanceChange", playerNumb,  player.balance);
                this.nextPlayerTurn(player);
                break;
            case "jail":
                this.nextPlayerTurn(player);
                if(player.jailCard > 0 && player.inJail > 0){
                    socket.emit("jailCardAvailable");
                }
                break;
        }
    }

    //Funksjon som kjører vist spiller lander på en "community chest" plot.
    communityChest(socket, io, player, diceNumb){
        let chestNumb = Math.floor(Math.random() * 16) + 1;
        //let chestNumb = 1;
        let chestCard = cChest.find(c => c.cardNumb == chestNumb);
        io.to(this.roomId).emit("message", `Player Nr: ${player.playerNumb} landed on community chest and got the card: "${chestCard.cardValue}"`);
        switch(chestCard.Action){
            case "Collect":
                player.balance += chestCard.Value;
                io.to(this.roomId).emit("balanceChange", player.playerNumb, player.balance);
                this.nextPlayerTurn(player);
                break;
            case "Pay":
                player.balance -= chestCard.Value;
                io.to(this.roomId).emit("balanceChange", player.playerNumb, player.balance);
                this.nextPlayerTurn(player);
                break;
            case "Go":
                let goPlot = this.plots.find(p => p.position == 0);
                player.playerPos = 0;
                player.balance += 200;
                io.to(this.roomId).emit("balanceChange", player.playerNumb, player.balance);
                io.to(this.roomId).emit("playerMoved", player.playerNumb, player.playerPos, goPlot.position, this.players);
                this.nextPlayerTurn(player);
                break;
            case "goToJail":
                this.goToJail(socket, io, player);
                io.to(this.roomId).emit("message", `Player Nr: ${player.playerNumb} landed on community chest and got the card: "${chestCard.cardValue}"`);
                break;
            case "collectAll":
                this.collectAll(io, player, chestCard.Value);
                this.nextPlayerTurn(player);
                break;
        }
    }



    //Funksjon som kjører vist en spiller lander på en "chance" plot på brettet. 
    chanceFunc(socket, io, player, diceNumb){
        //let chanceNumb = Math.floor(Math.random() * 14) + 1;
        let chanceNumb = 2;
        let chanceCard = chanceCards.find(c => c.cardNumb == chanceNumb);
        io.to(this.roomId).emit("message", `Player Nr: ${player.playerNumb} landed on chance and got the card: "${chanceCard.cardValue}"`);
        switch (chanceCard.Action) {
            case "move":
                let moveTo = this.plots.find(p => p.name == chanceCard.Value);
                player.playerPos = moveTo.position;
                io.to(this.roomId).emit("playerMoved", player.playerNumb, player.playerPos, moveTo.position, this.players, true);
                this.collectGoMoney(io, player, player.playerPos, moveTo.position);
                this.nextPlayerTurn(player);
                break;
            case "collect":
                player.balance += chanceCard.Value;
                io.to(this.roomId).emit("balanceChange", player.playerNumb, player.balance);
                this.nextPlayerTurn(player);
                break;
            case "payAll":
                this.payAll(io, player, chanceCard.Value);
                this.nextPlayerTurn(player);
                break;
            //Flytter spiller til nermereste railroad eller utility. 
            case "moveNearest":
                let i = player.playerPos;
                let propertyOwner = null;
                let oldPlotPos = i;
                let finalPlot = null;
                while(true){
                    let plot = this.plots.find(p => p.position == i);
                    if(plot.type == chanceCard.Value){
                        io.to(this.roomId).emit("playerMoved", player.playerNumb, player.playerPos, i, this.players, true);
                        player.playerPos = i;
                        finalPlot = plot;
                        if(plot.owner != null && plot.owner != player.playerNumb){
                            propertyOwner = plot.owner;
                        }
                        break;
                    }
                    if(i + 1 > 39){
                        i = 0;
                    }
                    else{
                        i++;
                    }
                }
                this.collectGoMoney(io, player, oldPlotPos, finalPlot.position);
                if(propertyOwner != null){
                    socket.emit("utilityDice");
                    break;
                }
                socket.emit("propertyAvailable", finalPlot.cost, finalPlot.name);
                break;
            case "getOutOfJailCard":
                player.jailCard += 1;
                this.nextPlayerTurn(player);
                break;
            case "moveBack":
                io.to(this.roomId).emit("playerMoved", player.playerNumb, player.playerPos, player.playerPos - 3, this.players, true, null, true);
                player.playerPos -= 3;
                break;
            //Spiller må betale reperasjon for alle husene og hotell spiller eier. 
            case "repairs":
                let houseCount = 0;
                let hotelCount = 0;
                let ownedPlot = this.plots.filter(p => p.owner == player.playerNumb);
                for(let i = 0; i < ownedPlot.length; i++){
                    houseCount += ownedPlot[i].houses;
                    hotelCount += ownedPlot[i].hotels;
                }
                player.balance -= houseCount * 25;
                player.balance -= hotelCount * 100;
                this.nextPlayerTurn(player);
                io.to(this.roomId).emit("balanceChange", player.playerNumb, player.balance);
                break;
            case "goToJail":
                io.to(this.roomId).emit("message", `Player Nr: ${player.playerNumb} landed on chance and got the card: "${chanceCard.cardValue}"`);
                this.goToJail(socket, io, player);
                break;
            case "Go":
                let goPlot = this.plots.find(p => p.position == 0);
                player.playerPos = 0;
                player.balance += 200;
                this.nextPlayerTurn(player);
                io.to(this.roomId).emit("balanceChange", player.playerNumb, player.balance);
                io.to(this.roomId).emit("playerMoved", player.playerNumb, player.playerPos, goPlot.position, this.players);
                break;
        }
    }

    collectGoMoney(io, player, oldPos, newPos){
        console.log("oldPos:", oldPos);
        console.log("newPos:", newPos);
        if(oldPos > newPos){
            console.log("collectGoMoney");
            player.balance += 200;
            io.to(this.roomId).emit("balanceChange", player.playerNumb, player.balance)
        }
    }

    //funksjon som trekker penger fra en spiller å gir til alle spillerene. 
    payAll(io, player, toPay){
        for(let i = 0; i < this.players.length; i++){
            if(player.playerNumb != i + 1){
                this.players[i].balance += toPay;
                player.balance -= toPay;
                io.to(this.roomId).emit("balanceChange", player.playerNumb, player.balance);
                io.to(this.roomId).emit("balanceChange", this.players[i].playerNumb, this.players[i].balance);
            }
        }
    }

    //Funksjon som trekker en pengesum fra alle spillerene å gir til en spiller. 
    collectAll(io, player, toPay){
        for(let i = 0; i < this.players.length; i++){
            if(player.playerNumb != i + 1){
                this.players[i].balance -= toPay;
                player.balance += toPay;
                io.to(this.roomId).emit("balanceChange", player.playerNumb, player.balance);
                io.to(this.roomId).emit("balanceChange", this.players[i].playerNumb, this.players[i].balance);
            }
        }
    }

    //Funksjon som sender en spiller i fengsel.
    goToJail(socket, io, player){
        let jailPlot = this.plots.find(p => p.type == "jail");
        player.inJail = 2;
        io.to(this.roomId).emit("playerMoved", player.playerNumb, player.playerPos, jailPlot.position, this.players, true);
        player.playerPos = jailPlot.position;
        if(player.jailCard != 0){
            socket.emit("jailCardAvailable");
        }
        this.nextPlayerTurn(player);
    }

    //funksjon som kjøres når en spiller har rullet terning. 
    rollDice(socket, io, diceNumb, playerNumb, sameDice){
        let player = this.players.find(p => p.playerNumb == playerNumb);
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
                io.to(this.roomId).emit("balanceChange", playerNumb, player.balance);
            } else{
                playerNewPos += diceNumb;
            }

            //Finner riktig plot og plot info. 
            let plot = this.plots.find(plot => plot.position == playerNewPos)
            io.to(this.roomId).emit("playerMoved", player.playerNumb, player.playerPos, plot.position, this.players, diceNumb);
            player.playerPos = playerNewPos;
            player.playerTurn = false;
        }
    }

    /*
    Funksjon som brukes vist en dice må rulles etter en spiller har landet en plass som ved kortet. "Advance token to the nearest Utility. If unowned, 
    you may buy it from the Bank. If owned, throw dice and pay owner a total 10 times the amount thrown."
    */
    rollUtilityDice(socket, io, diceNumb, playerNumb){
        let player = this.players.find(p => p.playerNumb == playerNumb);
        player.balance -= diceNumb * 10;
        io.to(this.roomId).emit("balanceChange", playerNumb, player.balance);
        this.nextPlayerTurn(player);
    }   

    //Funksjon som brukes for å kjøpe en property som player står på. 
    buyProperty(socket, io, playerNumb){
        let player = this.players.find(p => p.playerNumb == playerNumb);
        let plot = this.plots.find(plot => plot.position == player.playerPos);
        if(player.balance >= plot.cost && plot.owner == null){
            plot.owner = playerNumb;
            player.balance -= plot.cost;
            io.to(this.roomId).emit("message", `Player: ${playerNumb} bought ${plot.name} for ${plot.cost}$`)
            io.to(this.roomId).emit("balanceChange", playerNumb, player.balance);
            socket.emit("clearButtons", ["buyButton", "aucButton"]);
            this.nextPlayerTurn(player);
        }
        else{
            socket.emit("message", "Not enough money to buy that property");
        }
    }


    //Finner neste player for å sette playerTurn = true, vist neste ikke finnes så gå tilbake i loopen. 
    nextPlayerTurn(player){
        let nextPlayer = this.players.find(p => p.playerNumb == (player.playerNumb + 1));
        if(nextPlayer == undefined){
            nextPlayer = this.players.find(p => p.playerNumb == (player.playerNumb - this.players.length) + 1)
        }
        player.playerTurn = false;
        nextPlayer.playerTurn = true;
    }


    auctionStarted(io, playerNumb){
        let player = this.players.find(p => p.playerNumb == playerNumb);
        this.aucProperty = this.plots.find(p => p.position == player.playerPos);
        console.log("propType: ", this.aucProperty.type);
        if(this.aucProperty.type != "property" && this.aucProperty.type != "railroad" && this.aucProperty.type != "utility" || this.aucProperty.owner != null){
            return;
        }
        this.aucStartedBy = player; 
        let property = this.plots.find(p => p.position == player.playerPos);
        let startIndex = this.players.findIndex(p => p.playerNumb == playerNumb);
        this.playersAuction = this.players.slice(startIndex).concat(this.players.slice(0, startIndex));
        io.to(this.roomId).emit("auctionStarted", property.name, playerNumb)
    }

    playerBid(socket, io, auctionBid, playerNumb){
        let brokePlayers = this.playersAuction.filter(p => p.balance < auctionBid)
        for(let i = 0; i < brokePlayers.length; i++){
            this.playerFolded(io, brokePlayers[i].playerNumb, auctionBid);
            if(this.playersAuction.length <= 1){
                return;
            }
        }
        if(!this.playersAuction.find(p => p.playerNumb == playerNumb)){
            return;
        }
        if(this.auctionTurnIndex >= this.playersAuction.length){
            this.auctionTurnIndex = 0;
        }
        if(this.playersAuction.length <= 1){
            return;
        }
        if(this.auctionTurnIndex + 1 == this.playersAuction.length){
            this.auctionTurnIndex = 0;
        } else {
            this.auctionTurnIndex += 1;
        }
        let nextPlayer = this.playersAuction[this.auctionTurnIndex];
        io.to(this.roomId).emit("playerBid", auctionBid, nextPlayer.playerNumb)
    }

    playerFolded(io, playerNumb, auctionBid, message){
        this.playersAuction = this.playersAuction.filter(p => p.playerNumb != playerNumb)
        io.to(this.roomId).emit("message", `Player Nr ${playerNumb} folded`);
        if(this.playersAuction.length == 1){
            console.log("playerAuction0", this.playersAuction[0]);
            this.playersAuction[0].balance -= auctionBid;
            let property = this.plots.find(p => p.position == this.aucStartedBy.playerPos);
            property.owner = this.playersAuction[0].playerNumb;
            this.nextPlayerTurn(this.aucStartedBy);
            io.to(this.roomId).emit("auctionOver");
            io.to(this.roomId).emit("balanceChange", this.playersAuction[0].playerNumb, this.playersAuction[0].balance);
            io.to(this.roomId).emit("message", `player ${this.playersAuction[0].playerNumb} bought ${property.name} for $${auctionBid}`)
            io.to(this.roomId).emit("clearButtons", ["aucButton", "buyButton"])
            this.playersAuction = [];
            this.auctionTurnIndex = 0;
        }
    }

    finishedMoving(socket, io, finalPlot, playerNumb, diceNumb){
        let plot = this.plots.find(p => p.position == finalPlot.position);
        this.checkPlot(socket, io, plot, playerNumb, diceNumb);
    }
}