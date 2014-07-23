'use strict';

chrome.runtime.onInstalled.addListener(function (details) {
    console.log('previousVersion', details.previousVersion);
});

var extractor = require('./extractor');
var doc = require('./document');
var hattori = require('./hattori');

chrome.runtime.onConnect.addListener(function(port) {
    if(port.name === 'popup') {
        port.onMessage.addListener(function(request) {
            console.log('Received message from', port.name);
            if (request.method === 'GET') {
                doc.find(request.query, port);
            }
        });
    } else if(port.name === 'content') {
        port.onMessage.addListener(function(request) {
            console.log('Received message from', port.name);

            if(request.method === 'POST') {
                // Temporarily disable. Look at https://github.com/ScholarNinja/extension/issues/8
                // doc.add(request);
                port.postMessage({service: 'document', results: 'OK'});
            }
        });
    } else if(port.name === 'hattori') {
        port.onMessage.addListener(function(url) {
            hattori.find(url, function(results) {
                port.postMessage({service: 'hattori', results: results});
            });
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
        getSettings();
    }
});

chrome.tabs.onHighlighted.addListener(function() {
    getSettings();
});

chrome.windows.onFocusChanged.addListener(function() {
    getSettings();
});
