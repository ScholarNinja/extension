'use strict';

var extractor = require('./extractor');
var dht = require('./dht');
var async = require('async');
var _ = require('underscore');

chrome.runtime.onInstalled.addListener(function (details) {
    console.log('previousVersion', details.previousVersion);
});

var lunr = require('lunr');
var index;
var documents;

// Prepare the pipeline
var pipeline = new lunr.Pipeline();
pipeline.add(lunr.trimmer);
pipeline.add(lunr.stemmer);
pipeline.add(lunr.stopWordFilter);

var indexName = 'index.v2';

var fieldBoosts = {
    title: 10,
    authors: 3,
    abstract: 2,
    journal: 2,
    fulltext: 1
};

/* Document example

We use DOI as docref if
it exists.

docref = "10.1371/journal.pone.0004821"

Or by hashing the document's fields, we get a docref:
8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4

"10.1371/journal.pone.0004821" = {
    url: "http://www.plosone.org/article/info%3Adoi%2F10.1371%2Fjournal.pone.0004821",
    doi: "10.1371/journal.pone.0004821",
    title: "The Action of Key Factors in Protein Evolution at High Temporal Resolution",
    authors: "Armin Schmitt, Johannes Schuchhardt, Gudrun A. Brockmann",
    year: "2009",
    journal: "PLOS ONE"
}
*/

function addToIndex(doc) {
    // Save document locally and to DHT, without the full text.
    documents[doc.id] = doc;
    dht.put(doc.id, _.omit(doc, 'fulltext'));

    Object.keys(fieldBoosts).forEach(function (key){
        var keywords = pipeline.run(lunr.tokenizer(doc[key]));
        keywords.forEach(function(keyword) {
            // Add to DHT: [key]keyword: doc.id
            // E.g. [title]cancer
            var dhtKey = '[' + key + ']' + keyword;
            dht.put(dhtKey, doc.id);
            // console.log('Added document', doc.id, 'to index for', dhtKey);
        });
    });

    doc.links.forEach(function(link) {
        // Add to DHT [URL]link: doc.id
        var dhtKey = '[URL]' + link;
        dht.put(dhtKey, doc.id);
        // console.log('Added document', doc.id, 'to index for', dhtKey);
    });

    var localIndex = {};
    localIndex[indexName] = JSON.stringify(index);
    chrome.storage.local.set(localIndex);
}

function getDocumentFromDht(ref, callback) {
    if(documents[ref]) {
        callback(null, documents[ref]);
    } else {
        dht.get(ref, function(entries, error) {
            if(error) {
                callback(error);
            }
            if(entries[0]) {
                // Cache locally
                documents[ref] = entries[0];
                callback(null, entries[0]);
            }
        });
    }
}

function findDocuments(query, port) {
    var keywords = pipeline.run(lunr.tokenizer(query));
    var refs = [];

    _.each(keywords, function (key) {
        dht.get('[title]' + key, function(entries, error) {
            if (error) {
                console.log('Failed to retrieve entries: ' + error);
            } else {
                refs.push(_.flatten(entries));
                if(key === _.last(keywords)) {
                    // Only intersect if there are more than 1 keywords
                    if(refs.length > 1) {
                        refs = _.intersection.apply(_, refs);
                    } else {
                        refs = refs[0];
                    }
                    async.map(refs, getDocumentFromDht, function (err, results) {
                        if(err) {
                            console.log(err);
                        }
                        console.log(results);
                        port.postMessage(results);
                        console.log('Found ' + results.length + ' documents.');
                    });
                }
            }
        });
    });
}

// Restore from storage
chrome.storage.local.get(indexName, function (obj) {
    if (typeof(obj.index) !== 'string') {
        index = {};
    } else {
        index = JSON.parse(obj.index);
    }
});

chrome.storage.local.get('documents', function (obj) {
    if(obj.documents === undefined) {
        documents = {};
    } else {
        documents = obj.documents;
    }
});

chrome.runtime.onConnect.addListener(function(port) {
    if(port.name === 'popup') {
        port.onMessage.addListener(function(request) {
            console.log('Received message from', port.name);
            if (request.method === 'GET') {
                findDocuments(request.query, port);
            }
        });
    } else {
        port.onMessage.addListener(function(request) {
            console.log('Received message from', port.name);

            if(request.method === 'POST') {
                addToIndex(request);
                port.postMessage('OK');
            }
        });
    }
});

// Icons indicate if Scholar Ninja is supported for a given URL
function getSettings() {
    chrome.tabs.getSelected(undefined, function(tab) {
        var url = tab.url;
        if(extractor.supported(url)) {
            chrome.browserAction.setIcon({path: 'images/activated-icon-19.png'});
        } else {
            chrome.browserAction.setIcon({path: 'images/icon-19.png'});
        }
    });
}

chrome.tabs.onUpdated.addListener(function(tabId, props, tab) {
    // Prevent multiple calls
    if (props.status === 'loading' && tab.selected) {
        // console.info('onUpdated');
        getSettings();
    }
});

chrome.tabs.onHighlighted.addListener(function() {
    //console.info('onHighlighted');
    getSettings();
});

chrome.windows.onFocusChanged.addListener(function() {
    //console.info('onFocusChanged');
    getSettings();
});

