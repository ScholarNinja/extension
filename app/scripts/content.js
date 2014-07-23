'use strict';

var extractor = require('./extractor');
var hattori = require('./hattori');
var _ = require('underscore');
var $ = require('jquery');

var rule = extractor.supported(document.URL);
var hattoriRule = hattori.supported(document.URL);

if(rule) {
    console.log('Hello, this is Scholar Ninja content script. Parsing', rule);

    var message = extractor.extract(document, rule);

    if(message) {
        var port = chrome.runtime.connect({name: 'content'});
        port.postMessage(message);
    }
}

if(hattoriRule) {
    console.log('Hello, this is Scholar Ninja content script. Enhancing', hattoriRule);

    var url = hattori.cleanUrl(document.URL);

    if(url) {
        var port = chrome.runtime.connect({name: 'hattori'});
        port.postMessage(url);
        port.onMessage.addListener(function(response) {
            var elem = $('.repository-sidebar .only-with-full-nav');
            elem.append('<p>You might be also be interested in this software:</p>');
            _.each(response.results, function(result) {
                elem.append('<p><a href="' + result.html_url + '"><strong>' + result.full_name + '</strong></a> by <a href"' + result.owner.html_url + '"><strong>' + result.owner.login + '</strong></a> (Citations ' + result.citations + ', Stars ' + result.stargazers_count + ', Forks ' + result.forks_count + ')</p>');
                elem.append('<p>' + result.description + '</p><hr>');
            });
            console.log(response);
        });

    }
}
