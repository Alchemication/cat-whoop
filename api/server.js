/* global require, process, __dirname */

// set up ======================================================================
var express        = require('express');
var port  	       = process.env.PORT || 3001; 				// set the port
var database       = require('./config/database'); 			// load the database config
var bodyParser     = require('body-parser');
var methodOverride = require('method-override');
var logger         = require('morgan');
var app            = require('express')();
var http           = require('http').Server(app);
var io             = require('socket.io')(http);
var _              = require('underscore');

app.use(express.static(__dirname + '/public'));  // set the static files location /public/img will be /img for users
app.use(logger('dev')); 						 // log every request to the console

// http://stackoverflow.com/questions/24330014/bodyparser-is-deprecated-express-4
app.use(bodyParser.urlencoded({
    extended: true
}));

//app.use(bodyParser.json());
//app.use(methodOverride());  // simulate DELETE and PUT

var allCats = [
    {"id": 1, "name": "Charlie",color: "gray", free: true, score: 0},
    {"id": 2, "name": "Bettie",color: "yellow", free: true, score: 0},
    {"id": 3, "name": "Fibi",color: "black", free: true, score: 0},
    {"id": 4, "name": "Kittie",color: "pink", free: true, score: 0},
    {"id": 5, "name": "Baltazar",color: "green", free: true, score: 0},
    {"id": 6, "name": "Bob",color: "orange", free: true, score: 0},
    {"id": 7, "name": "Splinter", color: "red", free: true, score: 0},
    {"id": 8, "name": "Krang", color: "beige", free: true, score: 0},
    {"id": 9, "name": "Samantha", color: "indianred", free: true, score: 0},
    {"id": 10, "name": "Dora", color: "steelblue", free: true, score: 0}
];

var fightSounds = [
    "ball up",
    "bang out",
    "beat down",
    "beat ass",
    "beat the hell out",
    "bust on",
    "bust up",
    "catch the fair one",
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

var gridSize = {x: 10, y: 6};

var gridVertical   = _.range(gridSize.y),
    gridHorizontal = _.range(gridSize.x);

var gridData = {
    'size': gridSize,
    'vertical': gridVertical,
    'horizontal': gridHorizontal
};

var catsPlaying = [];

/**
 * Get free cat and change it's status to free:false
 * @returns {undefined}
 */
var getFreeCat = function () {

    var found = undefined;

    allCats.forEach(function (cat) {
        if (!found && cat.free === true) {
            cat.free = false;
            found    = cat;
            return found;
        }
    });

    return found;
};

var makeNewCat = function (socketId) {
    return {
        "socketId": socketId,
        catInfo: getFreeCat(),
        position: {x: _.random(0, gridSize.x - 1), y: _.random(0, gridSize.y - 1)}
    };
};

// sockets =====================================================================

var emitNewPlayerList = function () {
    io.emit('players changed', {"cats": catsPlaying});
};

io.on('connection', function (socket) {

    var socketId = socket.conn.id;

    console.log('User connected: ' + socketId);

    // 1. create new cat if any left
    var newCat = makeNewCat(socketId);
    catsPlaying.push(newCat);

    // 2. send out an update to socket with socket id
    socket.emit('joined game', {
        "newCat": newCat,
        "gridData": gridData
    });

    // 3. send out an update to everyone with new list of cats
    emitNewPlayerList();

    socket.on('disconnect', function () {

        // 1. get cat to drop (we will need it's index)
        var catToDrop = _.findWhere(catsPlaying, {"socketId": socketId});

        console.log('User disconnected: ' + socketId);

        // 2. get rid of the cat with that id from the list of playing cats
        catsPlaying = _.filter(catsPlaying, function (cat) {
            return cat.socketId !== socketId;
        });

        // 3. update free'd up cat in the list of all cats
        allCats.forEach(function (cat) {
            if (cat.id === catToDrop.catInfo.id) {
                cat.free = true;
            }
        });

        // 4. notify all that player with new list of cats
        emitNewPlayerList();
    });

    socket.on('player moved', function (data) {

        // update current catsPlaying, also look for collision
        catsPlaying.forEach(function (cat) {

            // check for collision and emit it asap!
            if (_.isEqual(cat.position, data.cat.position)) {
                io.emit('collision detected', {"cats": [data.cat, cat]});

                setTimeout(function () {

                    // re-spawn cats at random places,
                    // @todo check to make sure 2 cats don't spawn at same location!!
                    catsPlaying.forEach(function (cat) {
                        cat.position = {x: _.random(0, gridSize.x - 1), y: _.random(0, gridSize.y - 1)};
                    });

                    io.emit('fight completed', {"cats": catsPlaying});
                }, 3000);
            }

            // update position of cat, which needs to be updated
            if (cat.catInfo.id === data.cat.catInfo.id) {
                cat.position = data.cat.position;
            }
        });

        // emit position change to all the players
        io.emit('player moved', data);
    });

    socket.on('score up', function (data) {

        // update current catsPlaying
        catsPlaying.forEach(function (cat) {

            // update position of cat, which needs to be updated
            if (cat.socketId === data.cat.socketId) {
                cat.catInfo.score += 1;
            }
        });

        // emit to all that score changed
        data.cat.catInfo.score += 1;
        data.sound = 'Meow ~~ ' + fightSounds[_.random(0, fightSounds.length - 1)] + '!';
        io.emit('score up', data);
    });
});

// routes ======================================================================
app.get('/', function(req, res) {
    res.sendfile('./public/index.html'); // load the single view file (angular will handle the page changes on the front-end)
});

app.get('/api/get-names', function(req, res) {
    res.jsonp({'rows': [1, 2, 3]});
});

// listen (start app with node server.js) ======================================
http.listen(port, function() {
    console.log('listening on *:' + port);
});
