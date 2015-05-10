/* global require, process, __dirname */

// set up ======================================================================
var express        = require('express');
var port  	       = process.env.PORT || 3001; 				// set the port
var bodyParser     = require('body-parser');
var methodOverride = require('method-override');
var logger         = require('morgan');
var app            = require('express')();
var http           = require('http').Server(app);
var io             = require('socket.io')(http);
var _              = require('underscore');
var path           = require('path');
//var serverIp       = require('os').networkInterfaces().en0[1].address; // on mac anyways ;)

app.use(express.static(__dirname + '/public'));  // serve static (public) content
app.use(logger('dev')); 						    // log every request to the console

// http://stackoverflow.com/questions/24330014/bodyparser-is-deprecated-express-4
app.use(bodyParser.urlencoded({
    extended: true
}));

app.use(bodyParser.json());
app.use(methodOverride());  // simulate DELETE and PUT

var gridSize = {x: 10, y: 6}; // how many boxes will grid contain
var fightEnd = 3; // how many seconds will fight last

var allPlayersList = [
    {"id": 1, "name": "Charlie",img: "cat1.png", free: true, score: 0},
    {"id": 2, "name": "Bettie",img: "cat2.png", free: true, score: 0},
    {"id": 3, "name": "Fibi",img: "cat3.gif", free: true, score: 0},
    {"id": 4, "name": "Kittie",img: "cat4.png", free: true, score: 0},
    {"id": 5, "name": "Baltazar",img: "cat5.png", free: true, score: 0},
    {"id": 6, "name": "Bob",img: "cat6.png", free: true, score: 0},
    {"id": 7, "name": "Splinter", img: "cat1.png", free: true, score: 0},
    {"id": 8, "name": "Krang", img: "cat2.png", free: true, score: 0},
    {"id": 9, "name": "Samantha", img: "cat3.png", free: true, score: 0},
    {"id": 10, "name": "Dora", img: "cat4.png", free: true, score: 0}
];

var fightSounds = [
    "ball up",
    "bang out",
    "beat down",
    "beat ass",
    "beat the hell out",
    "bust on",
    "bust up",
    "playerch the fair one",
    "chuck 'em ",
    "drop gloves",
    "dustup",
    "get crunk with",
    "get medieval",
    "aaarrrggghhh",
    "go postal",
    "hose",
    "jack up",
    "kick ass",
    "back off",
    "mess up",
    "open a can of whoop ass",
    "put the beat down",
    "put the smack down",
    "ro-sham-bo",
    "smack down",
    "take down",
    "take it outside",
    "take out",
    "tote an ass whuppin'"
];

var gridVertical   = _.range(gridSize.y),
    gridHorizontal = _.range(gridSize.x);

var gridData = {
    'size': gridSize,
    'vertical': gridVertical,
    'horizontal': gridHorizontal
};

var playersPlaying = [];

/**
 * Get free player and change it's status to free:false
 * @returns {undefined}
 */
var getFreePlayer = function () {

    var found = undefined;

    allPlayersList.forEach(function (player) {
        if (!found && player.free === true) {
            player.free = false;
            found       = player;
            return found;
        }
    });

    return found;
};

var makeNewPlayer = function (socketId) {
    return {
        "socketId": socketId,
        info: getFreePlayer(),
        position: {x: _.random(0, gridSize.x - 1), y: _.random(0, gridSize.y - 1)}
    };
};

var makeRandomSound = function () {
    return fightSounds[_.random(0, fightSounds.length - 1)];
};

// sockets =====================================================================

var emitNewPlayerList = function () {
    io.emit('players changed', {"players": playersPlaying});
};

io.on('connection', function (socket) {

    var socketId = socket.conn.id;

    console.log('Player connected: ' + socketId);

    // 1. create new player if any left
    var newPlayer = makeNewPlayer(socketId);
    playersPlaying.push(newPlayer);

    // 2. send out an update to socket with socket id
    socket.emit('joined game', {
        "newPlayer": newPlayer,
        "gridData": gridData
    });

    // 3. send out an update to everyone with new list of players
    emitNewPlayerList();

    socket.on('disconnect', function () {

        // 1. get player to drop (we will need it's index)
        var playerToDrop = _.findWhere(playersPlaying, {"socketId": socketId});

        console.log('Player disconnected: ' + socketId);

        // 2. get rid of the player with that id from the list of playing players
        playersPlaying = _.filter(playersPlaying, function (player) {
            return player.socketId !== socketId;
        });

        // 3. update free'd up player in the list of all players
        allPlayersList.forEach(function (player) {
            if (player.id === playerToDrop.info.id) {
                player.free = true;
            }
        });

        // 4. notify all that player with new list of players
        emitNewPlayerList();
    });

    socket.on('player moved', function (data) {

        // update current playersPlaying, also look for collision
        playersPlaying.forEach(function (player) {

            // check for collision and emit it asap!
            if (_.isEqual(player.position, data.player.position)) {
                io.emit('collision detected', {"players": [data.player, player]});

                // emit fight end after timeout
                setTimeout(function () {

                    // re-spawn players at random places,
                    // @todo check to make sure 2 players don't spawn at same location!!
                    playersPlaying.forEach(function (player) {
                        player.position = {x: _.random(0, gridSize.x - 1), y: _.random(0, gridSize.y - 1)};
                    });

                    io.emit('fight completed', {"players": playersPlaying});
                }, fightEnd * 1000);
            }

            // update position of player, which needs to be updated
            if (player.socketId === data.player.socketId) {
                player.position = data.player.position;
            }
        });

        // emit position change to all the players
        io.emit('player moved', data);
    });

    socket.on('score up', function (data) {

        // update current playersPlaying
        playersPlaying.forEach(function (player) {

            // update position of player, which needs to be updated
            if (player.socketId === data.player.socketId) {
                player.info.score += 1;
            }
        });

        // emit to all that score changed
        data.player.info.score += 1;
        data.sound = data.player.info.name + ': Meow ~~ ' + makeRandomSound() + '!';
        io.emit('score up', data);
    });
});

// routes ======================================================================

//app.all('*', function(req, res, next) {
//    res.header('Access-Control-Allow-Origin', '*');
//    res.header('Access-Control-Allow-Methods', 'PUT, GET, POST, DELETE, OPTIONS');
//    res.header('Access-Control-Allow-Headers', 'Content-Type');
//    next();
//});

app.get('/', function(req, res) {
    res.sendFile(path.resolve(__dirname + "/public/index.html")); // load view
});

// listen (start app with node server.js) ======================================
http.listen(port, function() {
    console.log('listening on *:' + port);
});
