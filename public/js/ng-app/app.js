/**
 * Created by apple on 03/05/15.
 */
angular.module('cats', [
        'btford.socket-io',
        'swipe'
    ]).
    constant('SOCKET_URL', 'ws://localhost:3001').
    factory('mySocket', ['socketFactory', 'SOCKET_URL', function (socketFactory, SOCKET_URL) {

        return socketFactory({
            ioSocket: io.connect(SOCKET_URL)
        });

    }]).controller('GameController', ['$scope', 'mySocket', '$http', function ($scope, mySocket, $http) {

        // use dummy values initially
        var myCatIndex    = -1;

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
         * Check if we have any cat at these coordinates
         *
         * @param {int} x
         * @param {int} y
         * @returns {boolean}
         */
        var isAtPosition = function (x, y) {

            var found = false;

            $scope.catsPlaying.forEach(function (cat) {
                if (cat.position.x === x && cat.position.y === y) {
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

            var currentPosition = $scope.catsPlaying[myCatIndex].position;
            var newPosition     = currentPosition[axis] += value;
            var maxAxisValue    = $scope.gridData.size[axis] - 1;

            if (newPosition < 0) {
                newPosition = maxAxisValue;
            }

            if (newPosition > maxAxisValue) {
                newPosition = 0;
            }

            $scope.myCat.position[axis]            = newPosition;
            $scope.catsPlaying[myCatIndex].position[axis] = newPosition;

            mySocket.emit('player moved', {"cat": $scope.myCat});
        };

        /**
         * Update index of our cats by scanning through
         * all the cats
         */
        var updateMyCatIndex = function () {
            var index = 0;
            $scope.catsPlaying.forEach(function (cat) {
                if (cat.socketId === $scope.myCat.socketId) {
                    myCatIndex = index;
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

            var socketToUpdate = data.cat.socketId,
                newScore       = data.cat.catInfo.score;

            //check if our cat needs to be updated
            if (socketToUpdate === $scope.myCat.socketId) {
                $scope.myCat.catInfo.score = newScore;
            }

            // update all cats
            $scope.catsPlaying.forEach(function (cat) {
                if (cat.socketId === socketToUpdate) {
                    cat.catInfo.score = newScore;
                }
            });
        };

        /**
         * While cats are fighting, add this to indicate the hits
         * @param {string} sound
         */
        var makeSound = function (sound) {
            $scope.sounds.push(sound);
        };

        /**
         * Find our cat in the array of cats and update it's position
         * @param {object} cats
         */
        var findAndUpdateMyCat = function (cats) {
            cats.forEach(function (cat) {
                if (cat.socketId === $scope.myCat.socketId) {
                    $scope.myCat = cat;
                }
            });
        };

        /**
         * Run when we joined the game
         */
        mySocket.on('joined game', function (data) {
            $scope.myCat    = data.newCat;
            $scope.gridData = data.gridData;
        });

        /**
         * Run when any player joined/dropped
         */
        mySocket.on('players changed', function (data) {
            $scope.catsPlaying = data.cats;
            updateMyCatIndex();
            $scope.initalising = false;
        });

        /**
         * Run when any player moved
         */
        mySocket.on('player moved', function (data) {

            // skip any updates if it was our move
            if (data.cat.catInfo.id === $scope.myCat.catInfo.id) {
                return;
            }

            // update position of player, which moved
            $scope.catsPlaying.forEach(function (cat) {
                if (cat.catInfo.id === data.cat.catInfo.id) {
                    cat.position = data.cat.position;
                }
            });
        });

        /**
         * Run when 2 cats collided with each other,
         * then fight starts
         */
        mySocket.on('collision detected', function (data) {

            var isMyCatFighting = false;

            // check if it's our fight and set flag accordingly
            data.cats.forEach(function (cat) {
                 if (cat.socketId === $scope.myCat.socketId) {
                     isMyCatFighting = true;
                 }
            });

            $scope.isMyFight       = isMyCatFighting === true;
            $scope.isOthersFight   = isMyCatFighting === false;
        });

        /**
         * Run when cat is scratching
         */
        mySocket.on('score up', function (data) {
            makeSound(data.sound);
            updateScore(data);
        });

        /**
         * Run when fight is completed
         */
        mySocket.on('fight completed', function (data) {

            // update all cats
            $scope.catsPlaying = data.cats;

            // update our cat
            findAndUpdateMyCat(data.cats);

            $scope.isMyFight     = false;
            $scope.isOthersFight = false;
            $scope.sounds        = [];
        });

        /**
         * Check if our cat sits at these coordinates
         *
         * @param {int} rowIndex
         * @param {int} cellIndex
         * @returns {boolean}
         */
        $scope.isMyCat = function (rowIndex, cellIndex) {
            return isAtPosition(rowIndex, cellIndex) && rowIndex === $scope.myCat.position.x && cellIndex === $scope.myCat.position.y;
        };

        /**
         * Check if any cat sits at these coordinates
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
         * update cat's position
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
                mySocket.emit('score up', {"cat": $scope.myCat});
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
        $scope.myCat       = {};
        $scope.catsPlaying = [];
        $scope.isMyFight   = false;
        $scope.sounds      = [];

        $http.jsonp('http://localhost:3001/api/get-names?callback=JSON_CALLBACK', {params: {name: "adam"}}).then(function (r) {
           console.log(r.data);
        });

}]).factory('socket', ["$rootScope", "io", function($rootScope, io) {
        var socket = io.connect(),
            events = {},
            that   = {};

        var addCallback = function(name, callback) {
            var event = events[name],
                wrappedCallback = wrapCallback(callback);

            if (!event) {
                event = events[name] = [];
            }

            event.push({ callback: callback, wrapper: wrappedCallback });
            return wrappedCallback;
        };

        var removeCallback = function(name, callback) {
            var event = events[name],
                wrappedCallback;

            if (event) {
                for(var i = event.length - 1; i >= 0; i--) {
                    if (event[i].callback === callback) {
                        wrappedCallback = event[i].wrapper;
                        event.slice(i, 1);
                        break;
                    }
                }
            }
            return wrappedCallback;
        };

        var removeAllCallbacks = function(name) {
            delete events[name];
        };

        var wrapCallback = function(callback) {
            var wrappedCallback = angular.noop;

            if (callback) {
                wrappedCallback = function() {
                    var args = arguments;
                    $rootScope.$apply(function() {
                        callback.apply(socket, args);
                    });
                };
            }
            return wrappedCallback;
        };

        var listener = function(name, callback) {
            return {
                bindTo: function(scope) {
                    if (scope != null) {
                        scope.$on('$destroy', function() {
                            that.removeListener(name, callback);
                        });
                    }
                }
            };
        };

        that = {
            on: function(name, callback) {
                socket.on(name, addCallback(name, callback));
                return listener(name, callback);
            },
            once: function(name, callback) {
                socket.once(name, addCallback(name, callback));
                return listener(name, callback);
            },
            removeListener: function(name, callback) {
                socket.removeListener(name, removeCallback(name, callback));
            },
            removeAllListeners: function(name) {
                socket.removeAllListeners(name);
                removeAllCallbacks(name);
            },
            emit: function(name, data, callback) {
                if (callback) {
                    socket.emit(name, data, wrapCallback(callback));
                }
                else {
                    socket.emit(name, data);
                }
            }
        };

        return that;
    }])
    .factory('io', function() {
        return io;
    });
