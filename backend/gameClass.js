import { type } from "os";
import { json } from "stream/consumers";
import cChest from "./cChest.json" with {type: "json"};
import chanceCards from "./chance.json" with {type: "json"};

// Brikkebildene spillerne får tildelt i rekkefølge (spiller 1 = blå, spiller 2 = oransje osv.)
let figures = ["css/img/blåBrikke.png", "css/img/orgBrikke.png", "css/img/gronnBrikke.png", "css/img/lillaBrikke.png"]

// Én instans av denne klassen = ett spillrom. Holder på all tilstand for rommet:
// spillerne, brettet (plots) og status for en eventuell auksjon.
export default class game{
    constructor(roomId, roomPassword, plots){
        this.roomId = roomId;                            // rom-ID-en dette spillet hører til
        this.createdAt = Date.now();                     // når rommet ble opprettet (for opprydning av ubrukte rom)
        this.password = roomPassword;                    // passordet som kreves for å bli med
        this.plots = JSON.parse(JSON.stringify(plots));  // dyp kopi av brettet, så hvert rom har sitt eget
        this.playersAuction = [];                        // spillerne som fortsatt er med i en pågående auksjon
        this.auctionTurnIndex = 0;                       // hvem sin tur det er til å by
        this.aucStartedBy = null;                        // spilleren som startet auksjonen
        this.aucProperty = null;                         // tomten det auksjoneres om
        this.aucHighBid = 0;                             // høyeste bud så langt i en auksjon
        this.players = [];                               // alle spillerne i rommet
    }

    getRoomId(){
        return this.roomId;
    }
    getPassword(){
        return this.password;
    }

    // Sender hele spilltilstanden til én enkelt socket. Brukes når en spiller kobler
    // til igjen (refresh) og trenger å bygge opp brettet sitt på nytt.
    resync(socket){
        socket.emit("playerSpawned", this.players);
        socket.emit("plots", this.plots);
    }

    // Legger til en ny spiller i rommet. Returnerer spillerens nummer, eller
    // undefined vist rommet allerede er fullt (maks 4 spillere).
    addPlayer(socket, io, name){
        if(this.players.length >= 4) return;
        console.log("NEW PLAYER")
        socket.join(this.roomId);
        // Begrenser navnelengden (klienten kan sende hva som helst).
        let safeName = (typeof name == "string" ? name : "").slice(0, 20);
        // Ny spiller: starter med 15000 i saldo, på START (posisjon 0), ikke i fengsel og uten gjeld.
        // playerTurn er true bare for den aller første spilleren som blir med. left blir true vist spilleren forlater.
        this.players.push({"playerNumb": this.players.length + 1, "playerTurn": this.players.length == 0, "playerPos": 0, "figure": figures[this.players.length], "balance": 15000, "inJail": 0, "jailCard": 0, "bankrupt": false, "debt": null, "name": safeName, "lastRoll": 0, "left": false});
        let cookiePlayerNumb = this.players.length;
        console.log("cookiePlayerNummb: ", cookiePlayerNumb)
        io.to(this.roomId).emit("balanceChange", cookiePlayerNumb, 15000);
        io.to(this.roomId).emit("playerSpawned", this.players);
        // Send de allerede eksisterende spillernes saldo til den nye spilleren, så den ser riktige tall med en gang.
        if(cookiePlayerNumb > 1){
            let i = 1;
            while(i < cookiePlayerNumb){
                socket.emit("balanceChange", i, this.players[i-1].balance);
                i += 1;
            }
        }
        return cookiePlayerNumb;
    }

    // Sjekker hvilken rute spilleren har landet på og kjører riktig logikk ut fra rutetypen.
    checkPlot(socket, io, plot, playerNumb, diceNumb){
        socket.emit("clearButtons", ["output"]);
        let player = this.players.find(p => p.playerNumb == playerNumb);
        let owner = this.players.find(p => p.playerNumb == plot.owner);
        switch(plot.type){
            case "property":
                if(plot.owner == null){
                    // Ingen eier tomten → spilleren får tilbud om å kjøpe den.
                    socket.emit("propertyAvailable", plot.cost, plot.name);
                    break;
                } else if(plot.owner == playerNumb){
                    // Spilleren eier tomten selv → ingenting skjer, turen går videre.
                    this.nextPlayerTurn(player);
                    break;
                } else{
                    // En annen eier tomten → regn ut leie. Dobbel leie vist eieren har hele fargegruppen uten hus.
                    let ownedPlotsCount = this.plots.filter(p => p.color == plot.color && p.owner == owner.playerNumb).length;
                    let leie = plot.housesLeases[0];
                    if(ownedPlotsCount == 3 || (ownedPlotsCount == 2 && (plot.color == "Brown" || plot.color == "dBlue"))){
                        if(plot.houses == 0){
                            leie = plot.housesLeases[0] * 2;
                        } else {
                            leie = plot.housesLeases[plot.houses];
                        }
                    }
                    // Trekker leien vist spilleren har råd, ellers må spilleren selge eller gå konkurs.
                    if(this.chargePlayer(socket, io, player, leie, owner.playerNumb, true)){
                        io.to(this.roomId).emit("message", `Spiller ${player.playerNumb} (saldo: ${player.balance}) landet på spiller ${owner.playerNumb} (saldo: ${owner.balance}) sin tomt og skylder ${leie}`)
                        this.nextPlayerTurn(player);
                    }
                }
                break;
            case "cChest":
                this.communityChest(socket, io, player, diceNumb);
                break;
            case "chance":
                this.chanceFunc(socket, io, player, diceNumb);
                break;
            case "tax":
                // Skatterute → spilleren betaler et fast beløp til banken.
                socket.emit("message", `Du må betale ${plot.name} på $${plot.cost}`);
                if(this.chargePlayer(socket, io, player, plot.cost, null, true)){
                    this.nextPlayerTurn(player);
                }
                break;
            case "goToJail":
                io.to(this.roomId).emit("message", `Spiller nr: ${player.playerNumb} landet på "gå i fengsel" og er nå i fengsel`);
                this.goToJail(socket, io, player);
                break;
            case "utility":
                if(plot.owner == null){
                    socket.emit("propertyAvailable", plot.cost, plot.name);
                    break;
                }
                // Leie for verk (utility): 40x terning vist eieren har ett verk, 100x vist eieren har begge.
                let utilityCount = this.plots.filter(p => p.owner == owner.playerNumb && p.type == "utility").length;
                let utilPay = 0;
                if(utilityCount == 2){
                    utilPay = diceNumb * 100;
                } else {
                    utilPay = diceNumb * 40;
                }
                if(this.chargePlayer(socket, io, player, utilPay, owner.playerNumb, true)){
                    socket.emit("message", `Du må betale ${utilPay} for å bruke spiller nr: ${owner.playerNumb} sitt verk`);
                    this.nextPlayerTurn(player);
                }
                break;
            case "railroad":
                if(plot.owner == null){
                    socket.emit("propertyAvailable", plot.cost, plot.name);
                    break;
                }
                // Leie for jernbane øker med hvor mange jernbaner eieren har (1-4 stk).
                let railroadRent = [250, 500, 1000, 2000];
                let railroadCount = this.plots.filter(p => p.owner == owner.playerNumb && p.type == "railroad").length;
                let railroadPay = railroadRent[railroadCount - 1];
                if(this.chargePlayer(socket, io, player, railroadPay, owner.playerNumb, true)){
                    socket.emit("message", `Du må betale $${railroadPay} for å bruke spiller nr: ${owner.playerNumb} sin jernbane.`);
                    this.nextPlayerTurn(player);
                }
                break;
            case "jail":
                // "Bare på besøk"-ruten. Turen går videre, men vist spilleren har et fengselskort tilbys det.
                this.nextPlayerTurn(player);
                if(player.jailCard > 0 && player.inJail > 0){
                    socket.emit("jailCardAvailable");
                }
                break;
            case "start":
            case "free-parking":
                // START/Gratis parkering: ingen handling, bare gi turen videre.
                this.nextPlayerTurn(player);
                break;
        }
    }

    // Kjøres når spilleren lander på en felleskasse-rute. Trekker et tilfeldig kort og utfører handlingen.
    communityChest(socket, io, player, diceNumb){
        let chestNumb = Math.floor(Math.random() * 16) + 1;
        //let chestNumb = 1;
        let chestCard = cChest.find(c => c.cardNumb == chestNumb);
        io.to(this.roomId).emit("message", `Spiller nr: ${player.playerNumb} landet på felleskasse og fikk kortet: "${chestCard.cardValue}"`);
        switch(chestCard.Action){
            case "Collect":
                // Spilleren får penger fra banken.
                player.balance += chestCard.Value;
                io.to(this.roomId).emit("balanceChange", player.playerNumb, player.balance);
                this.nextPlayerTurn(player);
                break;
            case "Pay":
                // Spilleren betaler penger til banken.
                if(this.chargePlayer(socket, io, player, chestCard.Value, null, true)){
                    this.nextPlayerTurn(player);
                }
                break;
            case "Go":
                // Flytt til START og få 2000.
                let goPlot = this.plots.find(p => p.position == 0);
                player.playerPos = 0;
                player.balance += 2000;
                io.to(this.roomId).emit("balanceChange", player.playerNumb, player.balance);
                io.to(this.roomId).emit("playerMoved", player.playerNumb, player.playerPos, goPlot.position, this.players);
                this.nextPlayerTurn(player);
                break;
            case "goToJail":
                this.goToJail(socket, io, player);
                io.to(this.roomId).emit("message", `Spiller nr: ${player.playerNumb} landet på felleskasse og fikk kortet: "${chestCard.cardValue}"`);
                break;
            case "collectAll":
                // Alle andre spillere betaler til denne spilleren.
                this.collectAll(io, player, chestCard.Value);
                this.nextPlayerTurn(player);
                break;
            case "freeJailCard":
                // Spilleren får et sykemeldingskort (samme som sjansekortet).
                player.jailCard += 1;
                this.nextPlayerTurn(player);
                break;
            case "collectPerHouse":
                // Spilleren får Value kr for hvert hus den eier.
                let houseTotal = 0;
                let ownedHouses = this.plots.filter(p => p.owner == player.playerNumb);
                for(let i = 0; i < ownedHouses.length; i++){
                    houseTotal += ownedHouses[i].houses;
                }
                player.balance += houseTotal * chestCard.Value;
                io.to(this.roomId).emit("balanceChange", player.playerNumb, player.balance);
                this.nextPlayerTurn(player);
                break;
        }
    }



    // Kjøres når spilleren lander på en sjanse-rute. Trekker et kort og utfører handlingen.
    chanceFunc(socket, io, player, diceNumb){
        let chanceNumb = Math.floor(Math.random() * 14) + 1;
        let chanceCard = chanceCards.find(c => c.cardNumb == chanceNumb);
        io.to(this.roomId).emit("message", `Spiller nr: ${player.playerNumb} landet på sjanse og fikk kortet: "${chanceCard.cardValue}"`);
        switch (chanceCard.Action) {
            case "move":
                // Flytt spilleren til en navngitt rute. Lagrer gammel posisjon før flytting —
                // brukt til animasjonen og til å avgjøre om START passeres.
                let moveTo = this.plots.find(p => p.name == chanceCard.Value);
                let oldMovePos = player.playerPos;
                io.to(this.roomId).emit("playerMoved", player.playerNumb, oldMovePos, moveTo.position, this.players, true);
                this.collectGoMoney(io, player, oldMovePos, moveTo.position);
                player.playerPos = moveTo.position;
                this.nextPlayerTurn(player);
                break;
            case "collect":
                // Spilleren får penger.
                player.balance += chanceCard.Value;
                io.to(this.roomId).emit("balanceChange", player.playerNumb, player.balance);
                this.nextPlayerTurn(player);
                break;
            case "payAll":
                // Spilleren betaler et beløp til hver av de andre spillerne.
                this.payAll(io, player, chanceCard.Value);
                this.nextPlayerTurn(player);
                break;
            case "moveNearest":
                // Flytter spilleren til nærmeste jernbane eller verk (av typen kortet peker på).
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
                    // Ruta er eid → spilleren må kaste terning for å regne ut leia.
                    socket.emit("utilityDice");
                    break;
                }
                // Ruta er ledig → spilleren får tilbud om å kjøpe.
                socket.emit("propertyAvailable", finalPlot.cost, finalPlot.name);
                break;
            case "getOutOfJailCard":
                // Spilleren får et sykemeldingskort (slipper overtid neste gang den havner der).
                player.jailCard += 1;
                this.nextPlayerTurn(player);
                break;
            case "moveBack":
                // Flytter spilleren 3 ruter bakover.
                io.to(this.roomId).emit("playerMoved", player.playerNumb, player.playerPos, player.playerPos - 3, this.players, true, null, true);
                player.playerPos -= 3;
                break;
            case "repairs":
                // Spilleren må betale reparasjon for alle hus og hoteller den eier.
                let houseCount = 0;
                let hotelCount = 0;
                let ownedPlot = this.plots.filter(p => p.owner == player.playerNumb);
                for(let i = 0; i < ownedPlot.length; i++){
                    // 5 hus regnes som ett hotell.
                    if(ownedPlot[i].houses == 5){
                        hotelCount += 1;
                    } else {
                        houseCount += ownedPlot[i].houses;
                    }
                }
                let repairCost = houseCount * 50 + hotelCount * 150;
                if(this.chargePlayer(socket, io, player, repairCost, null, true)){
                    this.nextPlayerTurn(player);
                }
                break;
            case "goToJail":
                io.to(this.roomId).emit("message", `Spiller nr: ${player.playerNumb} landet på sjanse og fikk kortet: "${chanceCard.cardValue}"`);
                this.goToJail(socket, io, player);
                break;
            case "Go":
                // Flytt til START og få 2000.
                let goPlot = this.plots.find(p => p.position == 0);
                player.playerPos = 0;
                player.balance += 2000;
                this.nextPlayerTurn(player);
                io.to(this.roomId).emit("balanceChange", player.playerNumb, player.balance);
                io.to(this.roomId).emit("playerMoved", player.playerNumb, player.playerPos, goPlot.position, this.players);
                break;
        }
    }

    // Gir spilleren 2000 for å passere START. Vist den nye posisjonen er lavere enn den gamle
    // har spilleren gått forbi START (rundt brettet).
    collectGoMoney(io, player, oldPos, newPos){
        console.log("oldPos:", oldPos);
        console.log("newPos:", newPos);
        if(oldPos > newPos){
            console.log("collectGoMoney");
            player.balance += 2000;
            io.to(this.roomId).emit("balanceChange", player.playerNumb, player.balance)
        }
    }

    // Trekker penger fra én spiller og gir til alle de andre.
    payAll(io, player, toPay){
        for(let i = 0; i < this.players.length; i++){
            if(player.playerNumb != i + 1 && this.players[i].bankrupt != true){
                // Spilleren kan ikke gå i minus, betaler bare det den har råd til.
                let payAmount = toPay;
                if(payAmount > player.balance){
                    payAmount = player.balance;
                }
                this.players[i].balance += payAmount;
                player.balance -= payAmount;
                io.to(this.roomId).emit("balanceChange", player.playerNumb, player.balance);
                io.to(this.roomId).emit("balanceChange", this.players[i].playerNumb, this.players[i].balance);
            }
        }
    }

    // Trekker penger fra alle de andre spillerne og gir til én spiller.
    collectAll(io, player, toPay){
        for(let i = 0; i < this.players.length; i++){
            if(player.playerNumb != i + 1 && this.players[i].bankrupt != true){
                // Spillerne kan ikke gå i minus, betaler bare det de har råd til.
                let payAmount = toPay;
                if(payAmount > this.players[i].balance){
                    payAmount = this.players[i].balance;
                }
                this.players[i].balance -= payAmount;
                player.balance += payAmount;
                io.to(this.roomId).emit("balanceChange", player.playerNumb, player.balance);
                io.to(this.roomId).emit("balanceChange", this.players[i].playerNumb, this.players[i].balance);
            }
        }
    }

    // Sender en spiller i fengsel: setter inJail = 2 (antall runder) og flytter brikken til fengsel.
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

    // Bruker et sykemeldingskort: slipper spilleren unna overtid på Feskebruket så den kan kaste vanlig.
    useJailCard(socket, io, playerNumb){
        let player = this.players.find(p => p.playerNumb == playerNumb);
        if(player.jailCard > 0 && player.inJail > 0){
            player.jailCard -= 1;
            player.inJail = 0;
            io.to(this.roomId).emit("message", `Spiller ${playerNumb} brukte et sykemeldingskort og slipper overtid`);
            socket.emit("clearButtons", ["jailButton"]);
        }
    }

    // Kjøres når en spiller kaster terning. Serveren trekker terningene, flytter brikken og
    // håndterer fengsel + passering av START.
    rollDice(socket, io, playerNumb){
        let player = this.players.find(p => p.playerNumb == playerNumb);
        let playerNewPos = player.playerPos;
        // Bare spilleren som faktisk har turen får flytte.
        if(player.playerTurn == true){
            // Trekker to terninger og sender resultatet til alle klientene.
            let dice1 = Math.floor(Math.random() * 6) + 1;
            let dice2 = Math.floor(Math.random() * 6) + 1;
            let diceNumb = dice1 + dice2;
            let sameDice = dice1 == dice2;
            io.to(this.roomId).emit("diceResult", playerNumb, dice1, dice2);
            if(player.inJail != 0){
                // I fengsel: må rulle like terninger for å komme ut, ellers venter man en runde til.
                if(sameDice == false){
                    socket.emit("message", `Du er i fengsel og fikk ikke like terninger, så du må vente ${player.inJail} runder til`);
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
            // Vist spilleren går forbi posisjon 40 (rundt brettet) passeres START og man får 2000.
            if(player.playerPos + diceNumb >= 40){
                playerNewPos += diceNumb -= 40;
                player.balance += 2000;
                socket.emit("message", "Du passerte START og fikk $2000");
                io.to(this.roomId).emit("balanceChange", playerNumb, player.balance);
            } else{
                playerNewPos += diceNumb;
            }

            // Finner ruta spilleren lander på og forteller alle klientene om flyttingen.
            let plot = this.plots.find(plot => plot.position == playerNewPos)
            io.to(this.roomId).emit("playerMoved", player.playerNumb, player.playerPos, plot.position, this.players, diceNumb);
            player.playerPos = playerNewPos;
            player.lastRoll = diceNumb;   // siste terningkast, brukes av finishedMoving
            player.playerTurn = false;
        }
    }

    /*
    Brukes vist en terning må rulles etter at spilleren har landet et sted via et kort, f.eks:
    "Advance token to the nearest Utility. If unowned, you may buy it from the Bank.
    If owned, throw dice and pay owner a total 10 times the amount thrown."
    */
    rollUtilityDice(socket, io, playerNumb){
        let player = this.players.find(p => p.playerNumb == playerNumb);
        // Trekker terningen og sender resultatet til klientene.
        let dice1 = Math.floor(Math.random() * 6) + 1;
        let dice2 = Math.floor(Math.random() * 6) + 1;
        let diceNumb = dice1 + dice2;
        io.to(this.roomId).emit("diceResult", playerNumb, dice1, dice2);
        // Betaler eieren av verket/kroa spilleren står på.
        let plot = this.plots.find(p => p.position == player.playerPos);
        let ownerNumb = plot != undefined ? plot.owner : null;
        if(this.chargePlayer(socket, io, player, diceNumb * 100, ownerNumb, true)){
            this.nextPlayerTurn(player);
        }
    }

    // Brukes for å kjøpe tomten spilleren står på.
    buyProperty(socket, io, playerNumb){
        let player = this.players.find(p => p.playerNumb == playerNumb);
        let plot = this.plots.find(plot => plot.position == player.playerPos);
        // Kan ikke kjøpe vist spilleren har gjeld som ikke er betalt.
        if(player.debt != null) return;
        if(player.balance >= plot.cost && plot.owner == null){
            plot.owner = playerNumb;
            player.balance -= plot.cost;
            io.to(this.roomId).emit("message", `Spiller ${playerNumb} kjøpte ${plot.name} for ${plot.cost}$`)
            io.to(this.roomId).emit("balanceChange", playerNumb, player.balance);
            socket.emit("clearButtons", ["buyButton", "aucButton"]);
            this.nextPlayerTurn(player);
        }
        else{
            socket.emit("message", "Ikke nokk penger for å kjøpe den tomten");
        }
    }


    // Setter turen til neste spiller. Går rundt i loopen vist man er på siste spiller,
    // og hopper over spillere som har gått konkurs.
    nextPlayerTurn(player){
        // Ingen aktive spillere igjen → ikke gå i evig loop.
        if(this.players.every(p => p.bankrupt == true || p.left == true)) return;
        let nextPlayer = this.players.find(p => p.playerNumb == (player.playerNumb + 1));
        if(nextPlayer == undefined){
            nextPlayer = this.players.find(p => p.playerNumb == (player.playerNumb - this.players.length) + 1)
        }
        player.playerTurn = false;
        // Hopper over spillere som er konkurs eller har forlatt spillet.
        if(nextPlayer.bankrupt == true || nextPlayer.left == true){
            this.nextPlayerTurn(nextPlayer);
            return;
        }
        nextPlayer.playerTurn = true;
    }

    // Markerer en spiller som forlatt (etter frakobling) og gir turen videre vist det var deres tur.
    playerLeft(io, playerNumb){
        let player = this.players.find(p => p.playerNumb == playerNumb);
        if(player == undefined || player.left == true) return;
        player.left = true;
        io.to(this.roomId).emit("message", `Spiller ${playerNumb} forlot spillet`);
        if(player.playerTurn == true){
            this.nextPlayerTurn(player);
        }
        io.to(this.roomId).emit("playerSpawned", this.players);
    }

    // Spilleren koblet til igjen — ikke lenger regnet som forlatt.
    playerReturned(playerNumb){
        let player = this.players.find(p => p.playerNumb == playerNumb);
        if(player != undefined) player.left = false;
    }


    // Starter en auksjon for tomten spilleren står på. Bare ledige tomter/jernbaner/verk kan auksjoneres.
    auctionStarted(io, playerNumb){
        let player = this.players.find(p => p.playerNumb == playerNumb);
        this.aucProperty = this.plots.find(p => p.position == player.playerPos);
        console.log("propType: ", this.aucProperty.type);
        if(this.aucProperty.type != "property" && this.aucProperty.type != "railroad" && this.aucProperty.type != "utility" || this.aucProperty.owner != null){
            return;
        }
        this.aucStartedBy = player;
        this.aucHighBid = 0;
        let property = this.plots.find(p => p.position == player.playerPos);
        // Byrekkefølgen starter hos spilleren som startet auksjonen og går rundt.
        let startIndex = this.players.findIndex(p => p.playerNumb == playerNumb);
        this.playersAuction = this.players.slice(startIndex).concat(this.players.slice(0, startIndex));
        io.to(this.roomId).emit("auctionStarted", property.name, playerNumb)
    }

    // Håndterer et bud i en auksjon. Kaster automatisk ut spillere som ikke har råd til budet,
    // og sender turen videre til neste byder.
    playerBid(socket, io, auctionBid, playerNumb){
        // Bud må være et positivt, endelig tall som er høyere enn forrige bud.
        if(typeof auctionBid != "number" || !Number.isFinite(auctionBid) || auctionBid <= 0 || auctionBid <= this.aucHighBid){
            return;
        }
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
        this.aucHighBid = auctionBid;
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

    // Fjerner en spiller fra auksjonen. Vist bare én spiller er igjen har den vunnet tomten.
    playerFolded(io, playerNumb, auctionBid, message){
        this.playersAuction = this.playersAuction.filter(p => p.playerNumb != playerNumb)
        io.to(this.roomId).emit("message", `Spiller nr ${playerNumb} trakk seg`);
        if(this.playersAuction.length == 1){
            console.log("playerAuction0", this.playersAuction[0]);
            // Siste spiller igjen vinner og betaler budet sitt.
            this.playersAuction[0].balance -= auctionBid;
            let property = this.plots.find(p => p.position == this.aucStartedBy.playerPos);
            property.owner = this.playersAuction[0].playerNumb;
            this.nextPlayerTurn(this.aucStartedBy);
            io.to(this.roomId).emit("auctionOver");
            io.to(this.roomId).emit("balanceChange", this.playersAuction[0].playerNumb, this.playersAuction[0].balance);
            io.to(this.roomId).emit("message", `Spiller ${this.playersAuction[0].playerNumb} kjøpte ${property.name} for $${auctionBid}`)
            io.to(this.roomId).emit("clearButtons", ["aucButton", "buyButton"])
            this.playersAuction = [];
            this.auctionTurnIndex = 0;
        }
    }

    // Kalles fra klienten når brikke-animasjonen er ferdig. Kjører logikken for ruta spilleren
    // står på, ut fra serverens egen posisjon og siste terningkast.
    finishedMoving(socket, io, playerNumb){
        let player = this.players.find(p => p.playerNumb == playerNumb);
        let plot = this.plots.find(p => p.position == player.playerPos);
        this.checkPlot(socket, io, plot, playerNumb, player.lastRoll);
    }

    // Trekker penger fra en spiller og gir til en annen spiller eller banken. Vist spilleren ikke har råd
    // må den selge hus/tomter til gjelden er betalt, og vist det ikke er nok går spilleren konkurs.
    // Returnerer true vist betalingen gikk gjennom med en gang, false vist spilleren fikk gjeld eller gikk konkurs.
    chargePlayer(socket, io, player, amount, toPlayerNumb, holdTurn){
        if(player.balance >= amount){
            // Spilleren har råd → betal med en gang.
            player.balance -= amount;
            if(toPlayerNumb != null){
                let toPlayer = this.players.find(p => p.playerNumb == toPlayerNumb);
                toPlayer.balance += amount;
                io.to(this.roomId).emit("balanceChange", toPlayer.playerNumb, toPlayer.balance);
            }
            io.to(this.roomId).emit("balanceChange", player.playerNumb, player.balance);
            return true;
        }
        // Sjekker om spilleren har råd hvis den selger alle hus og tomter den eier.
        if(player.balance + this.getPlayerAssets(player) < amount){
            this.playerBankrupt(io, player, toPlayerNumb);
            return false;
        }
        // Spilleren har råd hvis den selger, så den får gjeld og må selge til gjelden er betalt.
        player.debt = {"amount": amount, "toPlayer": toPlayerNumb, "holdTurn": holdTurn};
        io.to(this.roomId).emit("message", `Spiller ${player.playerNumb} skylder ${amount}$ og må selge hus/tomter for å betale gjelden`);
        socket.emit("mustSell", amount);
        return false;
    }

    // Regner ut hvor mye en spiller får vist den selger alt den eier. Alt selges for halv pris.
    getPlayerAssets(player){
        let assets = 0;
        let ownedPlots = this.plots.filter(p => p.owner == player.playerNumb);
        for(let i = 0; i < ownedPlots.length; i++){
            assets += ownedPlots[i].cost / 2;
            if(ownedPlots[i].houses > 0){
                assets += ownedPlots[i].houses * (ownedPlots[i].housePrice / 2);
            }
        }
        return assets;
    }

    // Sjekker om spilleren har nok penger til å betale gjelden sin etter et salg. Vist ja: betal og gå videre.
    checkDebt(socket, io, player){
        if(player.debt == null) return;
        if(player.balance >= player.debt.amount){
            let debt = player.debt;
            player.debt = null;
            player.balance -= debt.amount;
            if(debt.toPlayer != null){
                let toPlayer = this.players.find(p => p.playerNumb == debt.toPlayer);
                toPlayer.balance += debt.amount;
                io.to(this.roomId).emit("balanceChange", toPlayer.playerNumb, toPlayer.balance);
            }
            io.to(this.roomId).emit("balanceChange", player.playerNumb, player.balance);
            io.to(this.roomId).emit("message", `Spiller ${player.playerNumb} betalte gjelden på ${debt.amount}$`);
            socket.emit("debtPaid");
            // Vist gjelden holdt tilbake turen (f.eks. leie), gi turen videre nå som den er betalt.
            if(debt.holdTurn == true){
                this.nextPlayerTurn(player);
            }
        }
    }

    // Spilleren går konkurs. Alt den eier selges/nullstilles, og verdien går til den man skylder penger.
    playerBankrupt(io, player, toPlayerNumb){
        let payout = player.balance + this.getPlayerAssets(player);
        let ownedPlots = this.plots.filter(p => p.owner == player.playerNumb);
        for(let i = 0; i < ownedPlots.length; i++){
            ownedPlots[i].owner = null;
            ownedPlots[i].houses = 0;
        }
        player.balance = 0;
        player.bankrupt = true;
        player.debt = null;
        if(toPlayerNumb != null){
            let toPlayer = this.players.find(p => p.playerNumb == toPlayerNumb);
            toPlayer.balance += payout;
            io.to(this.roomId).emit("balanceChange", toPlayer.playerNumb, toPlayer.balance);
        }
        // Turen må gis videre før playerSpawned sendes, så alle klientene får riktig turflagg.
        this.nextPlayerTurn(player);
        io.to(this.roomId).emit("balanceChange", player.playerNumb, player.balance);
        io.to(this.roomId).emit("message", `Spiller ${player.playerNumb} gikk konkurs`);
        io.to(this.roomId).emit("plots", this.plots);
        io.to(this.roomId).emit("playerSpawned", this.players);
        // Sjekk om det bare er én spiller igjen etter konkursen.
        this.checkGameOver(io);
    }

    // Sjekker om spillet er over: er bare én spiller igjen som ikke er konkurs, har den vunnet.
    checkGameOver(io){
        let alive = this.players.filter(p => p.bankrupt != true);
        if(alive.length == 1){
            io.to(this.roomId).emit("message", `Spiller ${alive[0].playerNumb} vant spillet!`);
            io.to(this.roomId).emit("gameOver", alive[0].playerNumb);
        }
    }

    // Selger en tomt tilbake til banken for halv pris. Eventuelle hus på tomten selges også for halv pris.
    sellProperty(socket, io, playerNumb, propertyPos){
        let plot = this.plots.find(p => p.position == propertyPos);
        let player = this.players.find(p => p.playerNumb == playerNumb);
        if(!plot || !player) return;
        if(plot.owner != playerNumb) return;
        let saleValue = plot.cost / 2;
        if(plot.houses > 0){
            saleValue += plot.houses * (plot.housePrice / 2);
            plot.houses = 0;
        }
        plot.owner = null;
        player.balance += saleValue;
        io.to(this.roomId).emit("balanceChange", playerNumb, player.balance);
        io.to(this.roomId).emit("message", `Spiller ${playerNumb} solgte ${plot.name} for ${saleValue}$`);
        io.to(this.roomId).emit("plots", this.plots);
        // Vist spilleren hadde gjeld, sjekk om salget dekket den.
        this.checkDebt(socket, io, player);
    }

    // Selger ett hus på en tomt spilleren eier. Gir halv huspris tilbake.
    sellHouse(socket, io, playerNumb, propertyPos){
        let plot = this.plots.find(p => p.position == propertyPos);
        let player = this.players.find(p => p.playerNumb == playerNumb);
        if(!plot || !player) return;
        if(plot.owner != playerNumb) return;
        // Husene må selges jevnt: selg fra tomten med flest hus først.
        let unevenPlot = this.plots.find(p => p.color == plot.color && p.owner == playerNumb && p.houses > plot.houses);
        if(unevenPlot != undefined){
            socket.emit("message", "Du må selge husene jevnt fra fargegruppen");
            return;
        }
        if(plot.houses > 0){
            plot.houses -= 1;
            player.balance += (plot.housePrice / 2);
            io.to(this.roomId).emit("balanceChange", playerNumb, player.balance);
            io.to(this.roomId).emit("message", `Spiller ${playerNumb} solgte et hus på ${plot.name} for ${plot.housePrice / 2}$`);
            io.to(this.roomId).emit("plots", this.plots);
            // Vist spilleren hadde gjeld, sjekk om salget dekket den.
            this.checkDebt(socket, io, player);
        }
    }

    // Kjøper ett hus på en tomt spilleren eier. Krever hele fargegruppen. 5 hus = hotell.
    buyHouse(socket, io, playerNumb, propertyPos){
        let plot = this.plots.find(p => p.position == propertyPos);
        let player = this.players.find(p => p.playerNumb == playerNumb);
        if(!plot || !player) return;
        if(plot.type != "property" || plot.owner != playerNumb) return;
        // Kan ikke kjøpe hus vist spilleren har gjeld.
        if(player.debt != null) return;
        // Sjekker om spilleren eier alle tomtene i fargegruppen (samme sjekk som leie-utregningen i checkPlot).
        let ownedPlotsCount = this.plots.filter(p => p.color == plot.color && p.owner == playerNumb).length;
        if(!(ownedPlotsCount == 3 || (ownedPlotsCount == 2 && (plot.color == "Brown" || plot.color == "dBlue")))){
            socket.emit("message", "Du må eie alle tomtene i fargegruppen for å bygge hus");
            return;
        }
        // Husene må fordeles jevnt: en tomt kan ikke ha 2 hus mens en annen i gruppen har 0.
        let unevenPlot = this.plots.find(p => p.color == plot.color && p.houses < plot.houses);
        if(unevenPlot != undefined){
            socket.emit("message", "Du må fordele husene jevnt på fargegruppen");
            return;
        }
        if(plot.houses >= 5){
            socket.emit("message", "Denne tomten har allerede hotell");
            return;
        }
        if(player.balance < plot.housePrice){
            socket.emit("message", "Ikke nokk penger for å kjøpe hus");
            return;
        }
        plot.houses += 1;
        player.balance -= plot.housePrice;
        io.to(this.roomId).emit("balanceChange", playerNumb, player.balance);
        io.to(this.roomId).emit("message", `Spiller ${playerNumb} kjøpte et hus på ${plot.name} for ${plot.housePrice}$`);
        io.to(this.roomId).emit("plots", this.plots);
    }
}
