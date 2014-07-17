'use strict';

var _ = require('underscore');
var $ = require('jquery');
var eliminatedPeers = [];
var chord;
var onSuccess;
var reloadInterval;

var peerJsConfig = {
    host: 'scholar.ninja',
    // host: 'localhost',
    port: 9003,
    debug: 1,
    config: {
        iceServers: [
            // Using public STUN and our own at scholar.ninja
            { url: 'stun:stun.l.google.com:19302' },
            { url: 'turn:scholar@scholar.ninja:3478', credential: 'ninja'}
        ]
    }
};

var config = {
    peer: { // The object to pass to the Peer constructor.
        options: peerJsConfig
    },
    numberOfEntriesInSuccessorList: 4,
    connectionPoolSize: 10,
    connectionOpenTimeout: 10000,
    requestTimeout: 120000,
    debug: false,
    stabilizeTaskInterval: 30000,
    fixFingerTaskInterval: 30000,
    checkPredecessorTaskInterval: 30000,
};

// Use the existing peer ID, if we have it.
chrome.storage.local.get('peer', function (obj) {
    if(obj.peer !== undefined) {
        config.peer.id = obj.peer.id;
    }
});

chord = new Chord(config);

var updatePeerId = function(peerId) {
    chord._localNode._nodeFactory._connectionFactory._peerAgent._peer.on('error', function(error) {
        console.log(error);
        // Ignore other errors, are handled elswhere.
        if(error.type === 'network') {
            chord._localNode._nodeFactory._connectionFactory._peerAgent._peer.disconnect();
            chord._localNode._nodeFactory._connectionFactory._peerAgent._peer.reconnect();
        }
    });

    console.log('My peer ID: ' + peerId);
    chrome.storage.local.set({peer: {id: peerId}});
    // Restore the DHT entries, if we have them.
    chrome.storage.local.get('entries', function (obj) {
        if(obj.entries !== undefined) {
            chord.setEntries(obj.entries);
        }
    });

    // Let others know we've joined the network
    if(onSuccess) {
        onSuccess(peerId);
    }

    // Temporary fix for Chrome bug: https://code.google.com/p/chromium/issues/detail?id=392651
    if(reloadInterval) {
        clearInterval(reloadInterval);
    }
    reloadInterval = setInterval(function() {
        chord._localNode._nodeFactory._connectionFactory._peerAgent._peer.disconnect();
        window.location.reload();
    }, 60*60*1000);
};

var errorHandler = function(error) {
    if (error) {
        console.log('Failed: ' + error);
    }
};

var createOrJoin = function(onSuccessCallback) {
    onSuccess = onSuccessCallback;
    var peers = [];
    $.get(
        'http://' + peerJsConfig.host + ':9004/',
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

            var randomPeer = _.sample(peers);
            if (randomPeer) {
                // Join an existing chord network
                console.log('Joining', randomPeer);
                chord.join(randomPeer, join);
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

        // Hacky solution for ID is taken issue
        if(error.type === 'unavailable-id') {
            // Example: "ID `w34ru68zauz93sor` is taken"
            // Usually the taken ID will be a stale node (us from the past)
            delete config.peer.id;
        } else if (error.type !== 'network') {
            // Examples:
            // "Failed to open connection to 8brhes5lytmd9529."
            // "FIND_SUCCESSOR request to aoeupaxej1rr7ldi timed out."
            var currentPeer = error.message.match(/to (?:peer )?(\w{16})/)[1];
            eliminatedPeers.push(currentPeer, myPeerId);
        }
        // Retry with another peer after 1 second
        setTimeout(createOrJoin, 1000);
    } else {
        updatePeerId(myPeerId);
    }
};

chord.onentriesinserted = _.debounce(function() {
    console.log('Storing entries locally.');
    chrome.storage.local.set({entries: chord.getEntries()});
}, 10000);

module.exports = chord;
module.exports.retrieve = chord.retrieve;
module.exports.insert = chord.insert;
module.exports.remove = chord.remove;
module.exports.createOrJoin = createOrJoin;
