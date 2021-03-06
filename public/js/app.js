/**
 * Created by apple on 03/05/15.
 */
angular.module('app', [
        'btford.socket-io',
        'swipe'
    ]).
    constant('SOCKET_ADDRESS', location.origin.replace(/^http/, 'ws')).
    factory('mySocket', ['socketFactory', 'SOCKET_ADDRESS', function (socketFactory, SOCKET_ADDRESS) {

        return socketFactory({
            ioSocket: io.connect(SOCKET_ADDRESS)
        });

    }]).controller('AppController', ['$scope', 'mySocket', function ($scope, mySocket) {

        // use dummy values initially
        var myPlayerIndex = -1;

        var animations = [
            'zoomOut',
            'zoomOutDown',
            'zoomOutLeft',
            'zoomOutRight',
            'zoomOutUp',
            'bounceOutRight',
            'bounceOutUp',
            'fadeOut',
            'fadeOutDown',
            'fadeOutDownBig',
            'fadeOutLeft',
            'fadeOutLeftBig',
            'fadeOutRight',
            'zoomOutRight',
            'zoomOutUp',
            'bounceOut',
            'bounceOut',
            'bounceOut',
            'bounceOutDown',
            'bounceOutLeft',
            'bounceOutRight',
            'bounceOutUp',
            'fadeOut',
            'fadeOutDown',
            'fadeOutDownBig',
            'fadeOutLeft',
            'fadeOutLeftBig',
            'fadeOutRight',
            'zoomOutRight',
            'zoomOutUp',
            'bounceOut',
            'bounceOutDown',
            'bounceOutLeft',
            'bounceOutRight',
            'bounceOutUp',
            'fadeOut',
            'fadeOutRightBig',
            'fadeOutUp',
            'fadeOutUpBig',
            'bounceOutDown',
            'bounceOutLeft',
            'bounceOutRight',
            'bounceOutUp',
            'fadeOut',
            'fadeOutDown',
            'fadeOutDownBig',
            'fadeOutLeft'
        ];

        // define keyboard codes
        $scope.KEY_CODE = {
            LEFT: 37,
            RIGHT: 39,
            UP: 38,
            DOWN: 40
        };

        /**
         * Check if we have any player at these coordinates
         *
         * @param {int} x
         * @param {int} y
         * @returns {boolean}
         */
        var isAtPosition = function (x, y) {

            var found = false;

            $scope.playersPlaying.forEach(function (player) {
                if (player.position.x === x && player.position.y === y) {
                    found = true;
                }
            });

            return found;
        };

        /**
         * Update x and y coordinates,
         * if there is no space to move -
         * appear on the other side of the grid
         *
         * @param {string} axis
         * @param {int} value
         */
        var updatePosition = function (axis, value) {

            var currentPosition = $scope.playersPlaying[myPlayerIndex].position;
            var newPosition     = currentPosition[axis] += value;
            var maxAxisValue    = $scope.gridData.size[axis] - 1;

            if (newPosition < 0) {
                newPosition = maxAxisValue;
            }

            if (newPosition > maxAxisValue) {
                newPosition = 0;
            }

            $scope.myPlayer.position[axis]                      = newPosition;
            $scope.playersPlaying[myPlayerIndex].position[axis] = newPosition;

            mySocket.emit('player moved', {"player": $scope.myPlayer});
        };

        /**
         * Update index of our players by scanning through
         * all the players
         */
        var updateMyPlayerIndex = function () {
            var index = 0;
            $scope.playersPlaying.forEach(function (player) {
                if (player.clientId === $scope.myPlayer.clientId) {
                    myPlayerIndex = index;
                }
                index++;
            });
        };

        /**
         * Update score
         *
         * @param {object} data
         */
        var updateScore = function (data) {

            var socketToUpdate = data.player.clientId,
                newScore       = data.player.info.score;

            //check if our player needs to be updated
            if (socketToUpdate === $scope.myPlayer.clientId) {
                $scope.myPlayer.info.score = newScore;
            }

            // update all players
            $scope.playersPlaying.forEach(function (player) {
                if (player.clientId === socketToUpdate) {
                    player.info.score = newScore;
                }
            });
        };

        /**
         * While players are fighting, add this to indiplayere the hits
         * @param {string} sound
         */
        var makeSound = function (sound) {
            $scope.sounds.push(sound);
        };

        /**
         * Find our player in the array of players and update it's position
         * @param {object} players
         */
        var findAndUpdateMyPlayer = function (players) {
            players.forEach(function (player) {
                if (player.clientId === $scope.myPlayer.clientId) {
                    $scope.myPlayer = player;
                }
            });
        };

        /**
         * Run when we joined the game
         */
        mySocket.on('joined game', function (data) {
            $scope.myPlayer    = data.newPlayer;
            $scope.gridData = data.gridData;
        });

        /**
         * Run when any player joined/dropped
         */
        mySocket.on('players changed', function (data) {
            $scope.playersPlaying = data.players;
            updateMyPlayerIndex();
            $scope.initalising = false;
        });

        /**
         * Run when any player moved
         */
        mySocket.on('player moved', function (data) {

            // skip any updates if it was our move
            if (data.player.info.id === $scope.myPlayer.info.id) {
                return;
            }

            // update position of player, which moved
            $scope.playersPlaying.forEach(function (player) {
                if (player.info.id === data.player.info.id) {
                    player.position = data.player.position;
                }
            });
        });

        /**
         * Run when 2 players collided with each other,
         * then fight starts
         */
        mySocket.on('collision detected', function (data) {

            var isMyPlayerFighting = false;

            // check if it's our fight and set flag accordingly
            data.players.forEach(function (player) {
                 if (player.clientId === $scope.myPlayer.clientId) {
                     isMyPlayerFighting = true;
                 }
            });

            $scope.isMyFight       = isMyPlayerFighting === true;
            $scope.isOthersFight   = isMyPlayerFighting === false;
        });

        /**
         * Run when player is scratching
         */
        mySocket.on('score up', function (data) {
            makeSound(data.sound);
            updateScore(data);
        });

        /**
         * Run when fight is completed
         */
        mySocket.on('fight completed', function (data) {

            // update all players
            $scope.playersPlaying = data.players;

            // update our player
            findAndUpdateMyPlayer(data.players);

            $scope.isMyFight     = false;
            $scope.isOthersFight = false;
            $scope.sounds        = [];
        });

        /**
         * Check if our player sits at these coordinates
         *
         * @param {int} rowIndex
         * @param {int} cellIndex
         * @returns {boolean}
         */
        $scope.isMyPlayer = function (rowIndex, cellIndex) {
            return isAtPosition(rowIndex, cellIndex) && rowIndex === $scope.myPlayer.position.x && cellIndex === $scope.myPlayer.position.y;
        };

        /**
         * Check if any player sits at these coordinates
         *
         * @param {int} rowIndex
         * @param {int} cellIndex
         * @returns {boolean}
         */
        $scope.isAtPosition = function (rowIndex, cellIndex) {
            return isAtPosition(rowIndex, cellIndex);
        };

        /**
         * Add behaviour when key up is fired,
         * update player's position
         *
         * @param {object} keyEvent
         * @param {int} keyCode Optional, if not provided, it will be extracted from $event
         */
        $scope.move = function(keyEvent, keyCode) {

            if ($scope.isOthersFight) {
                return;
            }

            if (!keyCode) {
                keyCode = keyEvent.keyCode;
            }

            if ($scope.isMyFight) {
                mySocket.emit('score up', {"player": $scope.myPlayer});
                return;
            }

            switch (keyCode) {

                case $scope.KEY_CODE.LEFT:
                    updatePosition('x', -1);
                    break;

                case $scope.KEY_CODE.RIGHT:
                    updatePosition('x', +1);
                    break;

                case $scope.KEY_CODE.UP:
                    updatePosition('y', -1);
                    break;

                case $scope.KEY_CODE.DOWN:
                    updatePosition('y', +1);
                    break;

                default:
                    break;
            }
        };

        $scope.getSoundClass = function (index) {
            return animations[index];
        };

        // initially, show loading screen
        $scope.initalising = true;

        // init default data
        $scope.myPlayer       = {};
        $scope.playersPlaying = [];
        $scope.isMyFight      = false;
        $scope.sounds         = [];
        $scope.playerType     = 'cat';
}]);
