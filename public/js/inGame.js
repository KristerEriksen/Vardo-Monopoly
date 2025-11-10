let gameCookie = 0;

console.log("Cookie: ", getCookie("playerNumb"));

let player1Img = document.getElementById("player1Img");
let player2Img = document.getElementById("player2Img");
let player3Img = document.getElementById("player3Img");
let player4Img = document.getElementById("player4Img");

let playersClient = [player1Img, player2Img, player3Img, player4Img]
let outputBox = document.getElementById("outputText")
let buyButton = document.getElementById("buyPropertyButton");
let diceText = document.getElementById("showDice");
let balanceText = document.getElementById("balanceText");

let rollButton = document.getElementById("rollButton");
let buyPropertyButton = document.getElementById("buyPropertyButton");
let resetButton = document.getElementById("resetButton");
let jailCardButton = document.getElementById("jailCardButton");
let auctionButton = document.getElementById("auctionButton");
let auctionBox = document.getElementById("auctionBox");

let balP1 = document.getElementById("balP1");
let balP2 = document.getElementById("balP2");
let balP3 = document.getElementById("balP3");
let balP4 = document.getElementById("balP4");

let b1 = document.getElementById("1Button");
let b20 = document.getElementById("20Button");
let b50 = document.getElementById("50Button");
let b100 = document.getElementById("100Button");
let foldButton = document.getElementById("foldButton");
let bidButton = document.getElementById("bidButton");
let clearButton = document.getElementById("clearButton");
let auctionPropertyText = document.getElementById("aucProperty");
let auctionPlayerTurn = document.getElementById("playerTurnText");
let auctionPriceText = document.getElementById("auctionPrice");

let allBal = [balP1, balP2, balP3, balP4];

let utilityDice = false;

let playerBal = 1000;

let auctionBid = 0;
let finalBid = 0;

rollButton.addEventListener("click", rollDice);
resetButton.addEventListener("click", resetPlayer);
jailCardButton.addEventListener("click", jailCardUsed);

b1.addEventListener("click", priceBid);
b20.addEventListener("click", priceBid);
b50.addEventListener("click", priceBid);
b100.addEventListener("click", priceBid);
clearButton.addEventListener("click", priceBid);

import plots from "/plots.json" with {type: "json"};

//const socket = io("http://192.168.10.193:3000", {
const socket = io("http://localhost:3000", {
	query: { 
		playerNumb: getCookie("playerNumb"),
		roomId: new URLSearchParams(window.location.search).get('RoomId')
	}
});

auctionButton.addEventListener("click", () => {
	socket.emit("auctionStarted", getCookie("roomId"), getCookie("playerNumb"))
});

buyPropertyButton.addEventListener("click", () => {
	socket.emit("buyProperty", getCookie("roomId"), getCookie("playerNumb"))
});

foldButton.addEventListener("click", () => {
	socket.emit("playerFold", getCookie("roomId"), getCookie("playerNumb"), auctionBid)
});

bidButton.addEventListener("click", () => {
	finalBid = auctionBid;
	console.log("FINALEBID: ", finalBid);
	socket.emit("playerBid", getCookie("roomId"), finalBid, getCookie("playerNumb"))
	enableAucButtons(true);
});

function sleep(ms){
	return new Promise(resolve => setTimeout(resolve, ms));
}

function rollDice(){
    let dice1 = Math.floor(Math.random() * 6) + 1;
	let dice2 = Math.floor(Math.random() * 6) + 1;
	//let dice1 = 4;
	//let dice2 = 3;
	let sameDice = false;
	if(dice1 == dice2){
		sameDice = true;
	}
	let diceNumb = dice1 + dice2;

	//let diceNumb = 1;
	diceText.innerHTML = `Dice: ${dice1} | ${dice2} | total: ${diceNumb}`;
    console.log(`Dice result: ${diceNumb}`);
	if(utilityDice == true){
		socket.emit("utilityDiceRolled", getCookie("roomId"), diceNumb, getCookie("playerNumb"), sameDice);
		utilityDice = false;
	}
	else{
		socket.emit("diceRolled", getCookie("roomId"), diceNumb, getCookie("playerNumb"), sameDice);
	}
}

function priceBid(event){
	console.log("priceBid: ", event.target.id);
	let amount = parseInt(event.target.id);
	if(event.target.id == "clearButton"){
		amount = 0;
		auctionBid = finalBid;
	}

	if(auctionBid + amount > playerBal){
		outputBox.innerHTML = "Not enough money to bid that";
		return;
	}
	if(amount > 0){
		auctionBid += amount;
	}

	auctionPriceText.innerHTML = `$${auctionBid}`;
}

function jailCardUsed(){
	socket.emit("jailCardUsed", getCookie("roomId"))
}

function resetPlayer() {
    document.cookie = "playerNumb=0";
	console.log(document.cookie);
    location.reload(); // refresher siden så klienten reconnecter
}

function enableAucButtons(state){
	console.log("enableAuc ", state);
	b1.disabled = state;
	b20.disabled = state;
	b50.disabled = state;
	b100.disabled = state;
	clearButton.disabled = state;
	bidButton.disabled = state;
	foldButton.disabled = state;
}

function getCookie(name){
	console.log("NAME:", name)
	const cookies = document.cookie.split("; ");
	  for (let cookie of cookies) {
	    const [key, value] = cookie.split("=");
		console.log("key", key);
		console.log("keyType", typeof(key))
		console.log("value", value);

	    if (key === name) {
	      try {
	        return decodeURIComponent(value);
	      } catch(e) {
	        console.error("Failed to parse cookie JSON", e);
	        return null;
	      }
	    }
	  }
	  return null;
	}

socket.on("connect", () => {
	console.log("Tilkoblet:", socket.id);
});

socket.on("setPlayerCookie", (roomId, playerNumb) => {
	document.cookie = `roomId=${roomId}`;
	document.cookie = `playerNumb=${playerNumb}`;
	console.log("playerNumber: ", playerNumb)
	console.log("playerNumbCookie: ", document.cookie)
})

socket.on("playerSpawned", (players) => {
	console.log("playerSpawned");
	for(let i = 0; i < players.length; i++){
		playersClient[i].src = players[i].figure
	}
});

socket.on("playerMoved", async (playerNumb, playerCurrentPos, playerNewPos, playersList, waitBefore, diceNumb, moveBack) => {
	let finalPlot = plots.find(p => p.position == playerNewPos);
	//Lager to temperary variabler så jeg ikke endrer den faktiske verdien til topCss og leftCss i JSON filen. 
	let playerTopPos =  finalPlot.topCss;
	let playerLeftPos = finalPlot.leftCss;
	let playersOnPlot = playersList.filter(p => p.playerPos == playerNewPos).length;
	if(waitBefore == true){
		await sleep(4000);
	}
	for(let i = playerCurrentPos; i != playerNewPos;){
		//Brukes vist spiller må flytte seg bakover pga "chanceCard";
		if(moveBack == true){
			i--;
		}
		else{
			i++;
		}
		if(i == 40){
			i = 0;
		}
		let plot = plots.find(p => p.position == i);
		playersClient[playerNumb - 1].style.top = `${plot.topCss}%`;
		playersClient[playerNumb - 1].style.left = `${plot.leftCss}%`;
		await sleep(100);
	}

	switch(playersOnPlot){
		case 1:
			playerLeftPos += 1;
			break;
		case 2:
			playerTopPos += 2;
			break;
	}

	playersClient[playerNumb - 1].style.top = `${playerTopPos}%`;
	playersClient[playerNumb - 1].style.left = `${playerLeftPos}%`;

	if(playerNumb == getCookie("playerNumb")){
		socket.emit("finishedMoving", getCookie("roomId"), playerNumb, finalPlot, diceNumb)
	}
})


socket.on("propertyAvailable", (propPrice, propName) => {
	console.log("PROPERTY AVAILABLE");
	outputBox.innerHTML = `${propName} is available to be bought for ${propPrice}$ choose between buying and actuioning it`
	buyButton.style.opacity = 100;
	buyButton.disabled = false;
	auctionButton.style.opacity = 100;
	auctionButton.disabled = false;
})

socket.on("playerBid", (price, newPlayer) => {
	if(newPlayer == getCookie("playerNumb")){
		enableAucButtons(false);
	}
	finalBid = price + 1;
	auctionPlayerTurn.innerHTML = `Player ${newPlayer}s turn to bid`;
	auctionBid = price + 1;
	auctionPriceText.innerHTML = `$${auctionBid}`;
})

socket.on("clearButtons", (buttons) => {
	console.log("CLEARING BUTTONS: ", buttons);
	if(buttons.includes("buyButton")){
		buyButton.style.opacity = 0;
		buyButton.disabled = true;
	}
	if(buttons.includes("jailButton")){
		jailCardButton.style.opacity = 0;
		jailCardButton.disabled = true;
	}
	if(buttons.includes("output")){
		outputBox.innerHTML = "";
	}
	if(buttons.includes("aucButton")){
		 auctionButton.style.opacity = 0;
		 auctionButton.disabled = true;
	}
})

socket.on("message", (msg) => {
	outputBox.innerHTML = msg;
})

socket.on("balanceChange", (playerNumb, balance) => {
	if(playerNumb == getCookie("playerNumb")){
		balanceText.innerHTML = `Balance: $${balance}`;
		playerBal = balance;
	}
	allBal[playerNumb - 1].innerHTML = `P${playerNumb} Balance: $${balance}`;

})

socket.on("auctionStarted", (propName, playerNumb) => {
	if(playerNumb == getCookie("playerNumb")){
		enableAucButtons(false);
		console.log("TRUE TURE UTRE")
	}
	auctionBox.style.opacity = 100;
	auctionPlayerTurn.innerHTML = `Player ${playerNumb}s turn to bid`;
	auctionPropertyText.innerHTML = propName;
})

socket.on("utilityDice", () => {
	utilityDice = true;
})

socket.on("jailCardAvailable", () => {
	jailCardButton.disabled = false;
	jailCardButton.style.opacity = 100;
})

socket.on("auctionOver", () => {
	enableAucButtons(true);
	auctionBox.style.opacity = 0;
	auctionBid = 0;
	finalBid = 0;
	auctionPriceText.innerHTML = "$0";
})
