var socket = io.connect(document.URL);

socket.on('connect', function(data) {
	socket.emit('join', 'Hello World from client');
});

var colorPicker = new iro.ColorPicker("#colorpicker", {
	width: 200,
	height: 200,
	color: {
		r: Math.floor(Math.random() * 256),
		g: Math.floor(Math.random() * 256),
		b: Math.floor(Math.random() * 256)
	},
	markerRadius: 8,
	anticlockwise: true,
	css: {
		"#color": {
			"background-color": "$color",
			"border-color": "$color"
		}
	}
});

$("#color").click(function() {
	$("#colorpicker").toggle();
});

$("#colorpicker").click(function() {
	$(this).toggle();
});

$("#validateConnection").click(function() {
	playerColor = color(colorPicker.color.hexString);
	socket.emit("playerInfos", {color: colorPicker.color.hexString, name: $("#pseudo").val()});
});

socket.on('connectionComplete', function() {
	$("#messages").hide();
	$("#chatBox").hide();
	$("#timer").hide();
	$(canvas).hide();
	$("#connectionForm").hide()
	$("#gameState").text("Choisir un salon");
	$("#roomList").show();
	$("#createRoom").show();
});

$("#createRoom").click(function() {
	$(this).hide();
	$("#gameState").text("Création du salon");
	$("#createRoomForm").show();
});

$("#createRoomForm").submit(function(e) {
	e.preventDefault();
	socket.emit("createRoom", {nbPlayers: $("#nbPlayers").val(), name: $("#roomName").val()});
});

socket.on("roomCreated", function() {
	$("#createRoomForm").hide();
	socket.emit('joinRoom', {name: $("#roomName").val()});
});

socket.on('gameStart', function() {
	$("#createRoomForm").hide();
	$("#createRoom").hide();
	$("#roomList").hide();
	$("#timer").hide();
	$("#gameState").text("Waouh");
	$("#messages").show();
	$("#chatBox").show();
	$(canvas).show();
});

socket.on('waitingForPlayers', function() {
	$("#createRoomForm").hide();
	$("#createRoom").hide();
	$("#roomList").hide();
	$("#messages").show();
	$("#chatBox").show();
	$("#gameState").text("En attente de joueurs..");
});

socket.on('gameEnd', function(data) {
	$("#gameState").text("C'est " + data.winner + " qui gagne la partie !");
	$("#resetGame").show();
	$("#timer").show();
});

socket.on("timer", function(data) {
	$("#timer").text(data);
});

$("#chatForm").submit(function(e) {
	e.preventDefault();
	if ($('#chatInput').val() != "") {
		socket.emit('chatMessage', $('#chatInput').val());
		$('#chatInput').val('');
	};
});

socket.on("chatMessage", function(data) {
	var circle = $("<div>");
	circle.css({
		"border-radius": "50%",
		"height": "15px",
		"width": "15px",
		"background-color": data.color,
		"display": "inline-block",
		"position": "absolute",
		"margin": "6px 0 0 5px"
	});
	var name = $("<div>").css("position", "relative");
	name.append(circle);
	name.append($("<span>").text(data.name + " : " + data.message).css("margin", "0 0 0 25px"));
	$("#messages").append(name);
	$("#messages").scrollTop($("#messages")[0].scrollHeight);
});

$(document).on('click', '.rooms', function() {
	socket.emit('joinRoom', {name: $(this).contents().get(0).nodeValue});
});

socket.on("roomList", function(data) {
	$('#roomList').html('');
	for (var room of data) {
		var newRoom = $("<li class='rooms list-group-item d-flex justify-content-between align-items-center'>");
		var badge = room.connected + '/' + room.requested;
		newRoom.text(room.name);
		newRoom.append($("<span class='badge badge-primary badge-pill'>").text(badge));
		$("#roomList").append($(newRoom));
	};
});