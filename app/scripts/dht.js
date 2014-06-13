'use strict';

var Peer = require('peerjs');
var Chord = require('webrtc-chord-browserify');

var _ = require('underscore');

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
    } else {
        updatePeerId(myPeerId);
    }
};

var config = {
    peer: { // The object to pass to the Peer constructor.
        options: {
            host: 'localhost',
            port: 9000,
            debug: 3,
            config: {
                iceServers: [
                    {url: 'stun:54.187.230.130'},
                    {url: 'stun:stun.l.google.com:19302'},
                    {url: 'turn:gorst@54.187.230.130', credential: 'hero'}
                ]
            }
        }
    },
    numberOfEntriesInSuccessorList: 3,
    connectionPoolSize: 10,
    connectionOpenTimeout: 30000,
    requestTimeout: 180000,
    stabilizeTaskInterval: 30000,
    fixFingerTaskInterval: 30000,
    checkPredecessorTaskInterval: 30000
};



// Create a new chord instance
var chord = new Chord(config);

var peer = new Peer({
    host: 'localhost',
    port: 9000,
    debug: 3,
    config: {
        iceServers: [
            {url: 'stun:54.187.230.130'},
            {url: 'stun:stun.l.google.com:19302'},
            {url: 'turn:gorst@54.187.230.130', credential: 'hero'}
        ]
    }
});

peer.on('open', function(id) {
    var peers = [];
    peer.listAllPeers(function (keys) {
        keys.map(function(p) {
            if(p !== id && p !== chord.getPeerId()) {
                console.log('Peer ' + p);
                peers.push(p);
            }
        });

        // First peeer
        if(peers[0]) {
            // Join an existing chord network
            console.log('Joining ', peers[0]);
            chord.join(peers[0], join);
        } else {
            // Create a new chord network
            console.log('Creating new network');
            chord.create(create);
        }
    });
    peer.destroy();
});

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