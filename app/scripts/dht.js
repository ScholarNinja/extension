'use strict';

var Peer = require('peerjs');
var Chord = require('webrtc-chord-browserify');

var _ = require('underscore');

var eliminatedPeers = [];

var peerJsConfig = {
    host: '54.187.230.130',
    port: 9000,
    debug: 3,
    config: {
        iceServers: [
            {url: 'stun:stun.l.google.com:19302'}
            // {url: 'stun:54.187.230.130'},
            //{url: 'turn:scholar@54.187.230.130', credential: 'ninja'}
        ]
    }
};

var config = {
    peer: { // The object to pass to the Peer constructor.
        options: peerJsConfig
    },
    numberOfEntriesInSuccessorList: 3,
    connectionPoolSize: 20,
    connectionOpenTimeout: 30000,
    requestTimeout: 180000,
    stabilizeTaskInterval: 30000,
    fixFingerTaskInterval: 30000,
    checkPredecessorTaskInterval: 30000
};

// Create a new chord instance
var chord = new Chord(config);

var peer = new Peer(peerJsConfig);

var updatePeerId = function(peerId) {
    console.log('My peer ID: ' + peerId);
};

var errorHandler = function(error) {
    if (error) {
        console.log('Failed: ' + error);
    }
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
        eliminatedPeers.push(currentPeer);
    } else {
        updatePeerId(myPeerId);
    }
};

var createOrJoin = function(id) {
    var peers = [];
    peer.listAllPeers(function (keys) {
        keys.map(function(p) {
            // Don't connect to self, or chord's PeerId, or any eliminated peers
            if(p !== id && p !== chord.getPeerId() && eliminatedPeers.indexOf(p) === -1) {
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
            console.log('Unable to join any of the existing peers. Failing.');
        } else {
            // Create a new chord network
            console.log('Creating new network');
            chord.create(create);
        }
    });
    peer.destroy();
};

peer.on('open', createOrJoin);

function search(query) {
    // Split query by keyword
    var keywords = query.split(' ');

    // Retrieve entries
    var all = [];
    var results = [];
    _.each(keywords, function (key) {
        chord.retrieve(key, function(entries, error) {
            if (error) {
                console.log('Failed to retrieve entries: ' + error);
            }
            all.push(_.flatten(entries));
            if(key === _.last(keywords)) {
                results = _.intersection.apply(_, all);
                console.log(results);
            }
        });
    });
}

window.onunload = window.onbeforeunload = function() {
    if (!!peer && !peer.destroyed) {
        peer.destroy();
    }
    chord.leave();
};

module.exports = chord;
module.exports.get = chord.retrieve;
module.exports.put = chord.insert;
module.exports.remove = chord.remove;
module.exports.search = search;