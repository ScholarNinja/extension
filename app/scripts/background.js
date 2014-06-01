'use strict';

var extractor = require('./extractor');

chrome.runtime.onInstalled.addListener(function (details) {
    console.log('previousVersion', details.previousVersion);
});

var lunr = require('lunr');
var index;
var articles;

// Restore from storage
chrome.storage.local.get('index', function (obj) {
    if (typeof(obj.index) !== 'string') {
        index = lunr(function () {
            this.ref('id');
            this.field('title', {boost: 10});
            this.field('article');
            this.field('authors');
            this.field('journal');
        });
    } else {
        index = lunr.Index.load(JSON.parse(obj.index));
    }
});

chrome.storage.local.get('articles', function (obj) {
    if(obj.articles === undefined) {
        articles = {};
    } else {
        articles = obj.articles;
    }
});

chrome.runtime.onMessage.addListener(
  function(request, sender, sendResponse) {

    var whodunnit = sender.tab ?
        'a content script:' + sender.tab.url :
        'the extension';

    console.log('Received message with method ' + request.method +
                ' from ' + whodunnit);

    if(request.method === 'POST') {
        index.add(request);
        articles[request.id] = request;
        console.log('Added document ' + request.id + ' to index.');
        chrome.storage.local.set({
            articles: articles,
            index: JSON.stringify(index)
        });
        sendResponse('OK');
    } else if (request.method === 'GET') {
        var results = index.search(request.query).map(function (result) {
            return articles[result.ref];
        });
        console.log('Found ' + results.length + ' articles.');
        sendResponse(results);
    }
});

// Icons indicate if Open Scholar is supported for a given URL

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

