'use strict';

var _ = require('underscore');
var $ = require('jquery');
var eliminatedPeers = [];
var chord;

var peerJsConfig = {
    host: '85.159.214.207',
    port: 9000,
    debug: 1,
    config: {
        iceServers: [
            // Using public STUN/TURN for now.
            {url: 'stun:stun.l.google.com:19302'},
            {
                url: 'turn:numb.viagenie.ca',
                credential: 'muazkh',
                username: 'webrtc@live.com'
            }
            // {url: 'stun:scholar.ninja:3478'},
            // {url: 'turn:scholar@scholar.ninja:3478', credential: 'ninja'}
        ]
    }
};

var config = {
    peer: { // The object to pass to the Peer constructor.
        options: peerJsConfig
    },
    numberOfEntriesInSuccessorList: 3,
    connectionPoolSize: 10,
    connectionOpenTimeout: 10000,
    requestTimeout: 180000,
    debug: false,
    stabilizeTaskInterval: 30000,
    fixFingerTaskInterval: 30000,
    checkPredecessorTaskInterval: 30000
};

// Use the existing peer ID, if we have it.
chrome.storage.local.get('peer', function (obj) {

    if(obj.peer !== undefined) {
        config.peer.id = obj.peer.id;
    }
});

chord = new Chord(config);


var updatePeerId = function(peerId) {
    console.log('My peer ID: ' + peerId);
    chrome.storage.local.set({peer: {id: peerId}});
    // Restore the DHT entries, if we have them.
    chrome.storage.local.get('entries', function (obj) {
        if(obj.entries !== undefined) {
            chord.setEntries(obj.entries);
        }
    });
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

            // First peer
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
        // Retry with another peer after 1 second
        var currentPeer = error.message.substr(22,16);
        eliminatedPeers.push(currentPeer, myPeerId);
        setTimeout(createOrJoin, 1000);
    } else {
        updatePeerId(myPeerId);
    }
};

window.onunload = window.onbeforeunload = function() {
    chord.leave();
};

chord.onentriesinserted = _.debounce(function() {
    console.log('Storing entries locally.');
    chrome.storage.local.set({entries: chord.getEntries()});
}, 10000);

module.exports = chord;
module.exports.get = chord.retrieve;
module.exports.put = chord.insert;
module.exports.remove = chord.remove;
module.exports.createOrJoin = createOrJoin;