/* global require, process, __dirname */

// set up ======================================================================
var express        = require('express');
var port  	       = process.env.PORT || 3001; 				// set the port
var bodyParser     = require('body-parser');
var methodOverride = require('method-override');
var morgan         = require('morgan');
var app            = require('express')();
var http           = require('http').Server(app);
var io             = require('socket.io')(http);
var _              = require('underscore');

// configure app
app.use(express.static(__dirname + '/public'));                 // set the static files location /public/img will be /img for users
app.use(morgan('dev'));                                         // log every request to the console
app.use(bodyParser.urlencoded({'extended':'true'}));            // parse application/x-www-form-urlencoded
app.use(bodyParser.json());                                     // parse application/json
app.use(bodyParser.json({ type: 'application/vnd.api+json' })); // parse application/vnd.api+json as json
app.use(methodOverride());

// set up grid
var gridSize = {x: 10, y: 6}; // how many boxes will grid contain
var fightEnd = 3;             // how many seconds will fight last

// hard coded list of available players
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
    {"id": 10, "name": "Eoife", img: "cat3.png", free: true, score: 0},
    {"id": 11, "name": "Anne", img: "cat3.png", free: true, score: 0},
    {"id": 12, "name": "Hunky", img: "cat3.png", free: true, score: 0},
    {"id": 13, "name": "Hulk", img: "cat3.png", free: true, score: 0},
    {"id": 14, "name": "Whiskers", img: "cat3.png", free: true, score: 0},
    {"id": 15, "name": "Dolores", img: "cat3.png", free: true, score: 0},
    {"id": 16, "name": "Bull", img: "cat3.png", free: true, score: 0},
    {"id": 17, "name": "Seth", img: "cat3.png", free: true, score: 0},
    {"id": 18, "name": "Kevin", img: "cat3.png", free: true, score: 0},
    {"id": 19, "name": "Barbara", img: "cat3.png", free: true, score: 0},
    {"id": 20, "name": "Zeta", img: "cat3.png", free: true, score: 0},
    {"id": 21, "name": "Dora", img: "cat4.png", free: true, score: 0}
];

// hard coded list of available sounds during fight
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

// generate grid cells
var gridVertical   = _.range(gridSize.y),
    gridHorizontal = _.range(gridSize.x);

// create grid json
var gridData = {
    'size': gridSize,
    'vertical': gridVertical,
    'horizontal': gridHorizontal
};

// init playing players
var playersPlaying = [];

var makeNewPlayer = function (clientId) {

    // get list of free players
    var freePlayers = _.where(allPlayersList, {free: true});

    console.log(freePlayers);

    // pull random player from the list
    var randomPlayer = freePlayers[_.random(0, freePlayers.length - 1)];

    console.log(randomPlayer);

    // change that player's free status to false
    var playerId = randomPlayer.id;
    allPlayersList.forEach(function (player) {
        if (player.id === playerId) {
            player.free = false;
        }
    });

    return {
        clientId: clientId,
        info: randomPlayer,
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

    var clientId = socket.id;

    console.log('Player connected: ' + clientId);

    // 1. create new player if any left
    var newPlayer = makeNewPlayer(clientId);
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
        var playerToDrop = _.findWhere(playersPlaying, {"clientId": clientId});

        console.log('Player disconnected: ' + clientId);

        // 2. get rid of the player with that id from the list of playing players
        playersPlaying = _.filter(playersPlaying, function (player) {
            return player.clientId !== clientId;
        });

        // 3. update free'd up player in the list of all players and reset his/her score
        allPlayersList.forEach(function (player) {
            if (player.id === playerToDrop.info.id) {
                player.free  = true;
                player.score = 0;
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
            if (player.clientId === data.player.clientId) {
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
            if (player.clientId === data.player.clientId) {
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

app.get('*', function(req, res) {
    res.sendFile("./public/index.html"); // load view
});

// listen (start app with node server.js) ======================================
http.listen(port, function() {
    console.log('listening on *:' + port);
});
