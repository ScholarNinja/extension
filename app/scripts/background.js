'use strict';

var extractor = require('./extractor');
var dht = require('./dht');

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
    documents[doc.id] = doc;

    Object.keys(fieldBoosts).forEach(function (key){
        var keywords = pipeline.run(lunr.tokenizer(doc[key]));
        keywords.forEach(function(keyword) {
            // Add to DHT: [key]keyword: doc.id
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

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {

    var whodunnit = sender.tab ?
        'a content script:' + sender.tab.url :
        'the extension';

    console.log('Received message with method', request.method,
                'from', whodunnit);

    if(request.method === 'POST') {
        addToIndex(request);
        sendResponse('OK');
    } else if (request.method === 'GET') {
        var results = index.search(request.query).map(function (result) {
            return documents[result.ref];
        });
        console.log('Found ' + results.length + ' documents.');
        sendResponse(results);
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

