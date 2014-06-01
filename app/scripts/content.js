'use strict';

var extractor = require('./extractor');
var rule = extractor.supported(document.URL);

console.log('Hello I am Open Scholar content script.');

if(rule) {
    var message = extractor.extract(document, rule);

    chrome.runtime.sendMessage(message, function(response) {
        console.log(response);
    });
}