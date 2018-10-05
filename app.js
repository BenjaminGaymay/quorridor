// Server creation

var express = require('express');
var app = express();

var server = require('http').Server(app);
var io = require('socket.io')(server);

app.use(express.static(__dirname + '/public'));
app.get('/', function (request, response) {
	response.sendFile(__dirname + '/public/html/index.html');
});

server.listen(3000);


// Basics functions

function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}

function arrayIndex(first, second) {

	var copy = JSON.stringify([second[1], second[0]]);
	second = JSON.stringify(second);


	for (var i = 0 ; i < first.length ; i++) {
		if (JSON.stringify(first[i]) == second) {
			return i;
		} else if (JSON.stringify(first[i]) == copy) {
			return i;
		};
	};
	return -1;
}


// Room's relatives functions

var roomList = [];

class Room {
	constructor(infos) {
		this.players = [];
		this.turn = Math.floor(Math.random() * infos.nbPlayers);
		this.nbPlayers = infos.nbPlayers;
		this.name = infos.name;
		this.start = false;
	}

	getNbPlayers() {
		return this.players.length;
	}

	isClientTurn(client) {
		return client.id == this.players[this.turn].datas.id;
	}

	startGame() {
		this.start = true;
		var talker = this.players[0];

		if (talker) {
			talker.broadcast.emit('roomList', getJoinableRooms());
			talker.emit('roomList', getJoinableRooms());

			for (var player of this.players) {
				player.emit('gameStart');
				player.datas.wallsRemaining = 20 / this.players.length;
				player.emit('wallsRemaining', player.datas.wallsRemaining);
			};

			givePositionToPlayers(talker.datas.room.players);
			talker.datas.room.nextTurn();
		};
	}

	nextTurn() {
		this.players[this.turn].emit('turnEnd');
		this.turn = (this.turn + 1) % this.nbPlayers;

		this.players[this.turn].datas.deplacements = getMovePossibilites(this.players,
			this.players[this.turn].datas.pos, this.players[this.turn]);
		this.players[this.turn].emit('yourTurn', this.players[this.turn].datas.deplacements);
	}

	getPlayerByID(id) {
		for (var player of this.players) {
			if (player.datas.id == id) {
				return player;
			};
		};
	}

	clientWin(client) {
		for (var player of this.players) {
			player.emit('gameEnd', {winner: client.datas.name});
		};

		this.resetRoom();
	}

	resetRoom() {
		for (var player of this.players) {
			player.datas.walls = [];
			player.datas.pos = 76;
		};

		resetTimer(10, this);
	}
}


function resetTimer(secondsLeft, room) {
	setTimeout(function() {
		if (secondsLeft < 0) {
			for (var player of room.players) {
				player.emit("resetGame");
			};
			room.startGame();
		} else {
			for (var player of room.players) {
				player.emit("timer", secondsLeft);
			};
			resetTimer(secondsLeft - 1, room)
		};
	}, 1000);
}


function getRoomByName(name) {
	for (var room of roomList) {
		if (room.name == name) {
			return room;
		};
	};
}

function getJoinableRooms() {
	var getUnStartedRoom = roomList.filter(function(value) {
		return value.start == false;
	});

	return getUnStartedRoom.map(function(room) {
		return {
			name: room.name,
			connected: room.players.length,
			requested: room.nbPlayers
		};
	});
}

function removeEmptyRooms() {

	for (var i = 0 ; i < roomList.length ; i++) {
		if (roomList[i].players.length == 0) {
			roomList.splice(i, 1);
			i = 0;
		};
	};
}

function notSuperimposed(walls, newWall) {
	for (var wall of walls) {
		if (newWall % 2 == 0 && ((wall == newWall - 2 && wall % 16 != 14) || wall == newWall ||
		wall == newWall + 1 || (wall == newWall + 2 && wall % 16 != 0))) {
			return false;
		} else if (newWall % 2 == 1 && (wall == newWall - 16 ||
			wall == newWall - 1 || wall == newWall || wall == newWall + 16)) {
				return false;
		};
	};
	return true;
}


// Client's relatives functions

class Client {
	constructor() {
		this.walls = [];
		this.pos = 76;
	};

	win() {
		return (this.pos >= 0 && this.pos < 9);
	}
}


// Communication with Clients

function sendNewClientPos(client, moveInfos) {
	var tmp = JSON.parse(JSON.stringify(moveInfos));

	for (var player of client.datas.room.players) {
		tmp.from = getRotationByIndexInRoom(client, player, moveInfos.from);
		tmp.to = getRotationByIndexInRoom(client, player, moveInfos.to);
		player.emit('move', tmp);
	};
}

function sendNewWallPos(client, wallInfos) {
	var tmp = JSON.parse(JSON.stringify(wallInfos));

	for (var player of client.datas.room.players) {
		tmp.wallID = getRotationByIndexInRoom(client, player, wallInfos.wallID, true);
		player.datas.walls.push(tmp.wallID);
		player.emit('newWall', tmp);
	};
}

function givePositionToPlayers(playersInRoom) {

	for (var playerInRoom of playersInRoom) {
		for (var playerToAdd of playersInRoom) {
			playerInRoom.emit('move', {
				playerID: playerToAdd.datas.id,
				to: getRotationByIndexInRoom(playerToAdd, playerInRoom, playerToAdd.datas.pos),
				color: playerToAdd.datas.color
			});
		};
	};
}


// Deplacements specifics functions

function getMovePossibilites(players, cell, playerWhoPlay) {
	var cells = [cell - 9, cell % 9 == 8 ? -1 : cell + 1, cell + 9, cell % 9 == 0 ? -1 : cell - 1];
	var dynamicPos, relativeCell, line, column;
	var impossibleMoves = [];
	var jumpMoves = [];
	var finalCells = [];

	for (var player of players) {
		dynamicPos = getRotationByIndexInRoom(player, playerWhoPlay, player.datas.pos);

		if (cells.includes(dynamicPos)) {
			switch (playerWhoPlay.datas.pos - dynamicPos) {
				case -9:
					jumpMoves.push([dynamicPos, dynamicPos + 9]);
					jumpMoves.push([dynamicPos, (dynamicPos - 1) % 9 == 8 ? -1 : dynamicPos - 1]);
					jumpMoves.push([dynamicPos, (dynamicPos + 1) % 9 == 0 ? -1 : dynamicPos + 1]);
					break;
				case -1:
					jumpMoves.push([dynamicPos, (dynamicPos + 1) % 9 == 0 ? -1 : dynamicPos + 1]);
					jumpMoves.push([dynamicPos, dynamicPos + 9]);
					jumpMoves.push([dynamicPos, dynamicPos - 9]);
					break;
				case 1:
					jumpMoves.push([dynamicPos, (dynamicPos - 1) % 9 == 8 ? -1 : dynamicPos - 1]);
					jumpMoves.push([dynamicPos, dynamicPos - 9]);
					jumpMoves.push([dynamicPos, dynamicPos + 9]);
					break;
				case 9:
					jumpMoves.push([dynamicPos, dynamicPos - 9]);
					jumpMoves.push([dynamicPos, (dynamicPos - 1) % 9 == 8 ? -1 : dynamicPos - 1]);
					jumpMoves.push([dynamicPos, (dynamicPos + 1) % 9 == 0 ? -1 : dynamicPos + 1]);
					break;
			};
		};

	};

	for (var player of players) {
		dynamicPos = getRotationByIndexInRoom(player, playerWhoPlay, player.datas.pos);

		if (cells.includes(dynamicPos)) {
			cells.splice(cells.indexOf(dynamicPos), 1);
		};

		for (var i = 0 ; i < jumpMoves.length ; i++) {
			if (jumpMoves[i][1] == dynamicPos) {
				jumpMoves[i][1] = -1;
			};
		};

	};

	for (var wall of playerWhoPlay.datas.walls) {
		relativeCell = (wall % 2 == 0 ? wall : wall - 1) / 2;
		line = Math.floor(relativeCell / 8);
		column = relativeCell % 8;

		relativeCell = line * 9 + column;

		switch (wall % 2) {
			case 0:
				// Jump Top
				impossibleMoves.push([relativeCell - 9, relativeCell + 9]);
				impossibleMoves.push([relativeCell - 8, relativeCell + 10]);

				// Jump Bot
				impossibleMoves.push([relativeCell, relativeCell + 18]);
				impossibleMoves.push([relativeCell + 1, relativeCell + 19]);

				// Jump Diag
				impossibleMoves.push([relativeCell, relativeCell + 10]);
				impossibleMoves.push([relativeCell + 1, relativeCell + 8]);

				// Normal
				impossibleMoves.push([relativeCell, relativeCell + 9]);
				impossibleMoves.push([relativeCell + 1, relativeCell + 10]);
				break;
			case 1:
				// Jump Left
				impossibleMoves.push([relativeCell - 1, relativeCell + 1]);
				impossibleMoves.push([relativeCell + 8, relativeCell + 10]);

				// Jump Right
				impossibleMoves.push([relativeCell, relativeCell + 2]);
				impossibleMoves.push([relativeCell + 9, relativeCell + 11]);

				// Jump Diag
				impossibleMoves.push([relativeCell, relativeCell + 10]);
				impossibleMoves.push([relativeCell + 1, relativeCell + 8]);

				// Normal
				impossibleMoves.push([relativeCell, relativeCell + 1]);
				impossibleMoves.push([relativeCell + 9, relativeCell + 10]);
				break;
		};
	};

	for (var i = 0 ; i < jumpMoves.length ; i++) {
		if (arrayIndex(impossibleMoves, [playerWhoPlay.datas.pos, jumpMoves[i][1]]) != -1 ||
			arrayIndex(impossibleMoves, [playerWhoPlay.datas.pos, jumpMoves[i][0]]) != -1 ||
			arrayIndex(impossibleMoves, [jumpMoves[i][0], jumpMoves[i][1]]) != -1) {
			jumpMoves[i][1] = -1;
		};
	};

	for (var i = 0 ; i < jumpMoves.length - 2 ; i += 3) {
		if (jumpMoves[i][1] == -1) {
			cells.push(jumpMoves[i + 1][1]);
			cells.push(jumpMoves[i + 2][1]);
		} else {
			cells.push(jumpMoves[i][1]);
		};
	};

	for (var cell of cells) {
		if (arrayIndex(impossibleMoves, [playerWhoPlay.datas.pos, cell]) == -1) {
			finalCells.push(cell);
		};
	};

	return finalCells;
}

function getRotationByIndexInRoom(playerWhoMove, playerWhoReceive, pos, wall = false) {

	var playersInRoom = playerWhoMove.datas.room.players.length;
	var moveIndex = playerWhoMove.datas.room.players.indexOf(playerWhoMove);
	var receiveIndex = playerWhoMove.datas.room.players.indexOf(playerWhoReceive);
	var tmpPos, line, column, reversePos, quarterPos, quarterReversePos;

	if (wall) {
		tmpPos = (pos % 2 == 0 ? pos : pos - 1) / 2;
		line = Math.floor(tmpPos / 8);
		column = tmpPos % 8;
		reversePos = ((7 - line) * 8 + 7 - column) * 2 + (pos % 2 != 0 ? 1 : 0);
		quarterPos = ((7 - column) * 8 + line) * 2 + (pos % 2 == 0 ? 1 : 0);
		quarterReversePos = (column * 8 + (7 - line)) * 2 + (pos % 2 == 0 ? 1 : 0);
	} else {
		line = Math.floor(pos / 9);
		column = pos % 9;
		reversePos = (8 - line) * 9 + (8 - column);
		quarterPos = (8 - column) * 9 + line;
		quarterReversePos = column * 9 + (8 - line);
	};

	switch (playersInRoom) {
		case 2:
			switch (moveIndex - receiveIndex) {
				case -1: return reversePos;
				case 0: return pos;
				case 1: return reversePos;
			};

		case 3:
			switch (moveIndex - receiveIndex) {
				case -2: return reversePos;
				case -1: return quarterPos;
				case 0: return pos;
				case 1: return quarterReversePos;
				case 2: return reversePos;
			};

		case 4:
			switch (moveIndex - receiveIndex) {
				case -3: return quarterReversePos;
				case -2: return reversePos;
				case -1: return quarterPos;
				case 0: return pos;
				case 1: return quarterReversePos;
				case 2: return reversePos;
				case 3: return quarterPos;
			};
	};
}


// Pathfinder

function getNodeNeighbours(id, impossibleMoves) {
	var neighbours = [id - 9, id + 9, id % 9 == 8 ? -1 : id + 1, id % 9 == 0 ? -1 : id - 1].filter(function(value) {
		return value >= 0 && value < 81 && arrayIndex(impossibleMoves, [id, value]) == -1;
	});

	return neighbours;
};

function pathfinder(impossibleMoves, actualPos, objectives, seenPos = [], impossiblePos = []) {
	if (objectives.indexOf(actualPos) != -1) {
		return seenPos;
	};

	seenPos.push(actualPos);
	var neighbours = getNodeNeighbours(actualPos, impossibleMoves);
	for (var neighbour of neighbours) {
		if (seenPos.indexOf(neighbour) == -1 && impossiblePos.indexOf(neighbour) == -1) {
			var tmp = pathfinder(impossibleMoves, neighbour, objectives, seenPos, impossiblePos);
			if (tmp) {
				return tmp;
			} else {
				impossiblePos.push(neighbour);
			};
		};
	};
	return undefined;
};

function doesntBlockAnybody(client, newWall) {
	var objectives = [0 , 1, 2, 3, 4, 5, 6, 7, 8];

	for (var player of client.datas.room.players) {
		dynamicPos = getRotationByIndexInRoom(player, client, player.datas.pos);

		impossibleMoves = [];

		for (var wall of client.datas.walls.concat([newWall])) {
			relativeCell = (wall % 2 == 0 ? wall : wall - 1) / 2;
			line = Math.floor(relativeCell / 8);
			column = relativeCell % 8;

			relativeCell = line * 9 + column;

			switch (wall % 2) {
				case 0:
					impossibleMoves.push([relativeCell, relativeCell + 9]);
					impossibleMoves.push([relativeCell + 1, relativeCell + 10]);
					break;
				case 1:
					impossibleMoves.push([relativeCell, relativeCell + 1]);
					impossibleMoves.push([relativeCell + 9, relativeCell + 10]);
					break;
			};
		};

		var dynamicObjective = [];
		for (var pos of objectives) {
			dynamicObjective.push(getRotationByIndexInRoom(player, client, pos));
		};


		if (!pathfinder(impossibleMoves, dynamicPos, dynamicObjective)) {
			return false;
		};
	};
	return true;
};


// Clients listeners

io.on('connection', function(client) {

    client.on('join', function() {
		client.datas = new Client(client);
		client.datas.id = client.id;

		removeEmptyRooms();
		client.emit('roomList', getJoinableRooms());
	});

	client.on('playerInfos', function(data) {
		client.datas.color = data.color;
		if (data.name.length > 0) {
			client.datas.name = data.name;
			client.emit('connectionComplete');
		}
	});

	client.on('createRoom', function(data) {
		if (data.name.length > 0 && getRoomByName(data.name) == undefined) {
			removeEmptyRooms();
			roomList.push(new Room(data));
			var joinableRooms = getJoinableRooms();

			client.broadcast.emit('roomList', joinableRooms);
			client.emit('roomList', joinableRooms);
			client.emit('roomCreated');
		};
	});

	client.on('joinRoom', function(data) {
		var joinRoom = getRoomByName(data.name);

		if (joinRoom === undefined) {
			return false;
		};
		joinRoom.players.push(client);
		client.datas.room = joinRoom;

		client.datas.room.players = client.datas.room.players.filter(onlyUnique);

		var joinableRooms = getJoinableRooms();

		client.broadcast.emit('roomList', joinableRooms);
		client.emit('roomList', joinableRooms);

		if (client.datas.room.getNbPlayers() == client.datas.room.nbPlayers) {
			client.datas.room.startGame();
		} else {
			client.emit("waitingForPlayers");
		};
	});

	client.on("chatMessage", function(data) {
		if (client.datas.room) {
			for (var player of client.datas.room.players) {
				player.emit('chatMessage', {
					name: client.datas.name,
					message: data,
					color: client.datas.color
				});
			};
		};
	});

	client.on('move', function(data) {
		if (client.datas.room &&
			client.datas.room.isClientTurn(client.datas) &&
			client.datas.deplacements.includes(data.cell)) {

			var moveInfos = {
				playerID: client.datas.id,
				from: client.datas.pos,
				to: data.cell,
				color: client.datas.color
			};

			client.datas.pos = data.cell;
			sendNewClientPos(client, moveInfos);
			if (client.datas.win()) {
				client.datas.room.clientWin(client);
			} else {
				client.datas.room.nextTurn();
			};
		};
	});

	client.on("newWall", function(data) {
		if (client.datas.room &&
			client.datas.room.isClientTurn(client.datas) &&
			client.datas.wallsRemaining > 0 &&
			notSuperimposed(client.datas.walls, data.wall) &&
			doesntBlockAnybody(client, data.wall)) {

				var wallInfos = {
					wallID: data.wall,
					color: client.datas.color
				};

				sendNewWallPos(client, wallInfos);
				client.datas.wallsRemaining -= 1;
				client.emit('wallsRemaining', client.datas.wallsRemaining);
				client.datas.room.nextTurn();
			};
	});

	client.on("disconnect", function() {
		if (client && client.datas &&
			"room" in client.datas && client.datas.room) {
			room = client.datas.room;
			if (room.start == false) {
				for (var i = 0 ; i < room.players.length ; i++) {
					if (client.datas.id == room.players[i].id) {
						room.players.splice(i, 1);
					};
				};
			} else {
				for (var player of room.players) {
					player.datas.room = undefined;
					player.datas.walls = [];
					player.pos = 76;
					player.emit("resetGame");
					player.emit("connectionComplete");
				};
				room.players = [];
			};
			removeEmptyRooms();
			var joinableRooms = getJoinableRooms();
			client.broadcast.emit('roomList', joinableRooms);
		};
	});

});