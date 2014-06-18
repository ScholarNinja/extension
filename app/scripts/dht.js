'use strict';

var Chord = require('webrtc-chord-browserify');

var $ = require('jquery');

var eliminatedPeers = [];

var peerJsConfig = {
    host: '54.187.230.130',
    port: 9000,
    debug: 1,
    config: {
        iceServers: [
            {url: 'stun:stun.l.google.com:19302'},
            {url: 'turn:scholar@54.187.230.130', credential: 'ninja'}
        ]
    }
};

var config = {
    peer: { // The object to pass to the Peer constructor.
        options: peerJsConfig
    },
    numberOfEntriesInSuccessorList: 3,
    connectionPoolSize: 10,
    connectionOpenTimeout: 30000,
    requestTimeout: 180000,
    debug: false,
    stabilizeTaskInterval: 30000,
    fixFingerTaskInterval: 30000,
    checkPredecessorTaskInterval: 30000
};

// Create a new chord instance
var chord = new Chord(config);

var updatePeerId = function(peerId) {
    console.log('My peer ID: ' + peerId);
};

var errorHandler = function(error) {
    if (error) {
        console.log('Failed: ' + error);
    }
};

var createOrJoin = function() {
    var peers = [];
    $.get(
        'http://' + peerJsConfig.host + ':9001/',
        function(data) {
            // Array of peers on DHT network
            data.map(function(p) {
                // Don't connect to our PeerId, or any eliminated peers
                var myPeerId;
                if(chord._localNode) {
                    myPeerId = chord.getPeerId;
                }

                if (p !== myPeerId && eliminatedPeers.indexOf(p) === -1) {
                    console.log('Peer', p);
                    peers.push(p);
                }
            });

            // First peeer
            if (peers[0]) {
                // Join an existing chord network
                console.log('Joining', peers[0]);
                chord.join(peers[0], join);
            } else if (eliminatedPeers.length !== 0) {
                console.log('Fatal: Unable to join any of the existing peers. Failing.');
            } else {
                // Create a new chord network
                console.log('Creating new network');
                chord.create(create);
            }

        }
    );
};

var create = function(myPeerId, error) {
    if (error) {
        errorHandler(error);
    } else {
        updatePeerId(myPeerId);
    }
};

var join = function(myPeerId, error) {
    if (error) {
        errorHandler(error);
        // Retry with another peer.
        var currentPeer = error.message.substr(22,16);
        eliminatedPeers.push(currentPeer, myPeerId);
        createOrJoin();
    } else {
        updatePeerId(myPeerId);
    }
};


window.onunload = window.onbeforeunload = function() {
    chord.leave();
};

module.exports = chord;
module.exports.get = chord.retrieve;
module.exports.put = chord.insert;
module.exports.remove = chord.remove;
module.exports.createOrJoin = createOrJoin;