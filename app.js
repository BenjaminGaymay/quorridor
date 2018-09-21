var express = require('express');
var app = express();

app.use(express.static(__dirname + '/public'));

var server = require('http').Server(app);
var io = require('socket.io')(server);

server.listen(3000);

app.get('/', function (request, response) {
	response.sendFile(__dirname + '/public/html/index.html');
});

var roomList = [];

class Client {
	constructor() {
		this.walls = [];
		this.pos = 76;
	};

	win() {
		return (this.pos >= 0 && this.pos < 9);
	}
}


class Room {
	constructor(infos) {
		this.players = [];
		this.turn = 0;
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

	nextTurn() {
		this.players[this.turn].emit('turnEnd');
		this.turn = (this.turn + 1) % 2;

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
	}
}

function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}

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

function notSuperimposed(walls, newWall) {
	for (var wall of walls) {
		if (newWall % 2 == 0 && (wall == newWall - 2 || wall == newWall ||
			wall == newWall + 1 || wall == newWall + 2)) {
				return false;
		} else if (newWall % 2 == 1 && (wall == newWall - 16 ||
			wall == newWall - 1 || wall == newWall || wall == newWall + 16)) {
				return false;
		};
	};
	return true;
}

function startMoveListener(client) {
	client.on('move', function(data) {
		if (client.datas.room.isClientTurn(client.datas) &&
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
		if (client.datas.room.isClientTurn(client.datas) &&
			client.datas.wallsRemaining > 0 &&
			notSuperimposed(client.datas.walls, data.wall)) {
			var wallInfos = {
				wallID: data.wall,
				color: client.datas.color
			}
			sendNewWallPos(client, wallInfos);
			client.datas.wallsRemaining -= 1;
			client.emit('wallsRemaining', client.datas.wallsRemaining);
			client.datas.room.nextTurn();
		};
	});
}

function getRotationByIndexInRoom(playerWhoMove, playerWhoReceive, pos, wall = false) {

	var moveIndex = playerWhoMove.datas.room.players.indexOf(playerWhoMove);
	var receiveIndex = playerWhoMove.datas.room.players.indexOf(playerWhoReceive);

	var reverseValue = (wall ? (pos % 2 ? 128 : 126) : 80);

	switch (moveIndex - receiveIndex) {
		case -1: return reverseValue - pos;
		case 0: return pos;
		case 1: return reverseValue - pos;
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

function getMovePossibilites(players, cell, playerWhoPlay) {
	var cells = [cell - 9, cell % 9 == 8 ? -1 : cell + 1, cell + 9, cell % 9 == 0 ? -1 : cell - 1];
	var dynamicPos;

	for (var player of players) {
		dynamicPos = getRotationByIndexInRoom(player, playerWhoPlay, player.datas.pos);

		if (cells.includes(dynamicPos)) {
			cells.splice(cells.indexOf(dynamicPos), 1);
		};

	};

	var impossibleMoves = [];
	var relativeCell, line, column;

	for (var wall of playerWhoPlay.datas.walls) {
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

	var finalCells = [];

	for (var cell of cells) {
		if (arrayIndex(impossibleMoves, [playerWhoPlay.datas.pos, cell]) == -1) {
			finalCells.push(cell);
		};
	};

	return finalCells;
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

io.on('connection', function(client) {
    // console.log('Client connected...');

    client.on('join', function(data) {
		client.datas = new Client(client);
		client.datas.id = client.id;

		removeEmptyRooms();
		client.emit('roomList', getJoinableRooms());
	});

	client.on('playerInfos', function(data) {
		client.datas.color = data.color;
		client.datas.name = data.name;
		client.emit('connectionComplete');
	});

	client.on('createRoom', function(data) {
		removeEmptyRooms();
		roomList.push(new Room(data));
		var joinableRooms = getJoinableRooms();

		client.broadcast.emit('roomList', joinableRooms);
		client.emit('roomList', joinableRooms);
		client.emit('roomCreated');
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

		client.on("chatMessage", function(data) {
			for (var player of client.datas.room.players) {
				player.emit('chatMessage', {name: client.datas.name, message: data, color: client.datas.color});
			};
		});

		if (client.datas.room.getNbPlayers() == client.datas.room.nbPlayers) {

			// -> Lancement de la partie
			client.datas.room.start = true;
			client.broadcast.emit('roomList', getJoinableRooms());
			client.emit('roomList', getJoinableRooms());

			for (var player of client.datas.room.players) {
				player.emit('gameStart');
				player.datas.wallsRemaining = 20 / client.datas.room.players.length;
				player.emit('wallsRemaining', player.datas.wallsRemaining);
				startMoveListener(player);
			};

			givePositionToPlayers(client.datas.room.players);
			client.datas.room.nextTurn();

			// <- Lancement de la partie
		} else {
			client.emit("waitingForPlayers");
		};
	});

	client.on("disconnect", function() {
		if ("room" in client.datas) {
			for (var i = 0 ; i < client.datas.room.players.length ; i++) {
				if (client.datas.id == client.datas.room.players[i].id) {
					client.datas.room.players.splice(i, 1);
				};
			};

			removeEmptyRooms();
			var joinableRooms = getJoinableRooms();
			client.broadcast.emit('roomList', joinableRooms);
		};
	});

});