var socket = io.connect(document.URL);

socket.on('connect', function(data) {
	socket.emit('join', 'Hello World from client');
});

var colorPicker = new iro.ColorPicker("#colorpicker", {
	width: 200,
	height: 200,
	color: {r: 0, g: 255, b: 0},
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

$("#validateConnection").click(function() {
	$("#connectionForm").hide()
	socket.emit("playerInfos", {color: colorPicker.color.hexString, name: $("#pseudo").val()});
});

socket.on('connectionComplete', function() {
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
	$(this).hide();
	socket.emit("createRoom", {nbPlayers: $("#nbPlayers").val(), name: $("#roomName").val()});
	socket.on("roomCreated", function() {
		socket.emit('joinRoom', {name: $("#roomName").val()});
	});
});

socket.on('gameStart', function() {
	$("#createRoom").hide();
	$("#roomList").hide();
	$("#gameState").text("Waouh");
	$("#messages").show();
	$("#chatBox").show();
	$(canvas).show();
});

socket.on('waitingForPlayers', function() {
	$("#createRoom").hide();
	$("#roomList").hide();
	$("#messages").show();
	$("#chatBox").show();
	$("#gameState").text("En attente de joueurs..");
});

socket.on('gameEnd', function(data) {
	$("#gameState").text("Player " + data.winner + " win!");
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
	console.log(data);
	for (var room of data) {
		var newRoom = $("<li class='rooms list-group-item d-flex justify-content-between align-items-center'>");
		var badge = room.connected + '/' + room.requested;
		newRoom.text(room.name);
		newRoom.append($("<span class='badge badge-primary badge-pill'>").text(badge));
		$("#roomList").append($(newRoom));
	};
});