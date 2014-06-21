'use strict';

var extractor = require('./extractor');
var rule = extractor.supported(document.URL);


if(rule) {
    console.log('Hello, this is Scholar Ninja content script. Parsing', rule);

    var message = extractor.extract(document, rule);

    if(message) {
        var port = chrome.runtime.connect({name: 'content'});
        port.postMessage(message);
    }
}