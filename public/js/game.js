function getMinSize() {
	return ($(window).height() < $(window).width() ?
				$(window).height() : $(window).width());
}

var canvas;
var gameBoardWidth = getMinSize();
var gameBoardHeight = gameBoardWidth * 0.8;
var gameboard = [];
var walls = [];
var wallsRemaining = 0;
var playerColor;

class Wall {
	constructor (x, y, size, axe) {
		switch (axe) {
			case "horizontal":
				this.x = x * size + size * 0.05;
				this.y = y * size - size * 0.05 + size;
				this.width = (size * 2) - size * 0.1;
				this.height = size * 0.1;
				this.xEnd = this.x + this.width / 2 - size * 0.1;
				this.yEnd = this.y + this.height;
				break;
			case "vertical":
				this.x = x * size - size * 0.05 + size;
				this.y = y * size + size * 0.05;
				this.width = size * 0.1;
				this.height = (size * 2) - size * 0.1;
				this.xEnd = this.x + this.width;
				this.yEnd = this.y + this.height / 2 - size * 0.1;
				break;
		}
		this.id = walls.length;
		this.color = color(0, 0, 0, 0);
		this.axe = axe;
		this.stroke = false;
	};

	mouseInCell() {
		if (mouseX >= this.x && mouseX <= this.xEnd &&
			mouseY >= this.y && mouseY <= this.yEnd) {
				return true;
		};
	};
};

class Cell {
	constructor (x, y, size) {
		this.id = gameboard.length;
		this.x = x * size + size * 0.05;
		this.y = y * size + size * 0.05;
		this.height = size - size * 0.1;
		this.width = size - size * 0.1;
		this.xEnd = this.x + this.width;
		this.yEnd = this.y + this.height;
		this.color = color("#909090");
		this.size = size;
		this.stroke = false;
	};

	writeID() {
		fill(color("#000000"));
		text(this.id, this.x + this.size / 2, this.y + this.size / 2);
	}

	mouseInCell() {
		if (mouseX >= this.x && mouseX <= this.xEnd &&
					mouseY >= this.y && mouseY <= this.yEnd) {
			return true;
		};
		return false;
	}
};

function setup() {
	var size = (gameBoardHeight - 1) / 9;

	canvas = createCanvas(gameBoardWidth, gameBoardHeight).canvas;
	$(canvas).hide();

	playerColor = color(colorPicker.color.hexString);

	for (var y = 0 ; y < 9 ; y++) {
		for (var x = 0 ; x < 9 ; x++) {
			gameboard.push(new Cell(x, y, size));
		};
	};

	for (var y = 0 ; y < 8 ; y++) {
		for (var x = 0 ; x < 8 ; x++) {
			walls.push(new Wall(x, y, size, "horizontal"));
			walls.push(new Wall(x, y, size, "vertical"));
		};
	};

}


function mousePressed() {
	for (var cell of gameboard) {
		if (cell.mouseInCell() == true) {
			socket.emit('move', {cell: cell.id});
			break;
		};
	};

	for (var wall of walls) {
		if (wall.mouseInCell() == true) {
			socket.emit('newWall', {wall: wall.id});
			break;
		};
	};
}

function draw() {
	background("#FFFFFF");

	for (var cell of gameboard) {
		fill(cell.color);
		if (cell.stroke) {
			// stroke(cell.color);
			// fill(color("#fff"));
			// strokeWeight(4);
			stroke("#000000");
		} else {
			// fill(color(cell.color));
			noStroke();
		};
		rect(cell.x, cell.y, cell.width, cell.height, 10);
	};

	for (var wall of walls) {
		if (wall.stroke) {
			// fill("#fff");
			// stroke(wall.color);
			// strokeWeight(4);
			fill(wall.color);
			stroke("#000000");
			rect(wall.x, wall.y, wall.width, wall.height, 10);
		} else if (wall.mouseInCell() && deplacementCells.length > 0 && wallsRemaining > 0) {
			fill(color("#FFF"));
			stroke(playerColor);
			strokeWeight(4);
			rect(wall.x, wall.y, wall.width, wall.height, 10);
		};
		strokeWeight(1);
	};

	for (var i = 0 ; i < wallsRemaining ; i++) {
		fill(playerColor);
		stroke("#000000");
		rect(gameBoardWidth - walls[0].width * 0.9, i * gameBoardHeight / 10 + gameBoardHeight / 20, walls[0].width * 0.8, walls[0].height, 10);
	};
}

var deplacementCells = [];

socket.on("yourTurn", function(data) {
	$("#gameState").text("C'est ton tour !");
	for (var cell of data) {
		if (cell >= 0 && cell < gameboard.length) {
			// gameboard[cell].color = "#103050";
			gameboard[cell].color = color("#103050");
			deplacementCells.push(gameboard[cell]);
		};
	};
});

socket.on("turnEnd", function() {
	$("#gameState").text("C'est pas encore à toi de jouer..");
});

function resetCells() {
	for (var cell of deplacementCells) {
		// cell.color = "#909090";
		cell.color = color("#909090");
		cell.stroke = false;
	};

	deplacementCells = [];
}

socket.on('move', function(data) {

	resetCells();

	gameboard[data.to].stroke = true;
	// gameboard[data.to].color = data.color;
	gameboard[data.to].color = color(data.color);
	if ("from" in data) {
		gameboard[data.from].stroke = false;
		// 	gameboard[data.from].color = "#909090";
		gameboard[data.from].color = color("#909090");
	};
});

socket.on('newWall', function(data) {

	resetCells();

	// walls[data.wallID].color = data.color;
	walls[data.wallID].color = color(data.color);
	walls[data.wallID].stroke = true;
});

socket.on('wallsRemaining', function(data) {
	wallsRemaining = data;
});

socket.on("resetGame", function() {
	for (var cell of gameboard) {
		// cell.color = "#909090";
		cell.color = color("#909090");
		cell.stroke = false;
	};

	for (var wall of walls) {
		wall.color = color(0, 0, 0, 0);
		wall.stroke = false;
	};
});