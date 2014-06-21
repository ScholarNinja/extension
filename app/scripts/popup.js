'use strict';

var $ = require('jquery');

// Quick monkey-patch :)
String.prototype.pluralize = function(count, plural) {
    return (count === 1 ? count + ' ' + this : count + ' ' + plural);
};


var debounce = function (fn) {
    var timeout;
    return function () {
        var args = Array.prototype.slice.call(arguments),
            ctx = this;

        clearTimeout(timeout);
        timeout = setTimeout(function () {
            fn.apply(ctx, args);
        }, 1000);
    };
};

var log = function() {
    var message = Array.prototype.slice.call(arguments).join(' ');
    $('#log').html('<p>' + message + '</p>');
    console.log(message);
};

$(document).ready(function (){
    // Setup messaging
    var port = chrome.runtime.connect({name: 'popup'});
    port.onMessage.addListener(function(response) {
        if(response.status === 'FAIL') {
            log('Something went wrong.');
        } else {
            log('Received', 'result'.pluralize(response.results.length, 'results'));
            var results = response.results;
            console.log(JSON.stringify(results));
            if(results.length === 0) {
                $('#results').html('No results found.');
            } else {
                for (var i = 0; i < results.length; i++) {
                    var html = '<div class="result"><h2><a href="' + results[i].url  +'" target="_blank">' +
                        results[i].title  + '</a></h2>' +
                        '<p>' + results[i].authors + ' &mdash; ' + results[i].journal +
                        ' (' + results[i].year + ')</p></div>';
                    $('#results').append(html);
                    // <p class="abstract">' + results[i].abstract + '</p>
                }
            }
        }
    });

    $('input').bind('keyup', debounce(function () {
        $('#results, #log').empty();

        var message = {
            method: 'GET',
            query: $(this).val()
        };

        if(message.query.length > 0) {
            log('Queried with', message.query, '...');
            port.postMessage(message);
        }
    }));
});
