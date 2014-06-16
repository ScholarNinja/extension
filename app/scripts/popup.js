'use strict';

var $ = require('jquery');

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

$(document).ready(function (){
    // Setup messaging
    var port = chrome.runtime.connect({name: 'popup'});
    port.onMessage.addListener(function(response) {
        if(response.status === 'FAIL') {
            console.log('Something went wrong:', response);
        } else {
            console.log('Received search response', response);
            var results = response.results;
            if(results.length === 0) {
                $('#log').html('No results found.');
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
        $('#results').empty();

        var message = {
            method: 'GET',
            query: $(this).val()
        };

        if(message.query.length > 0) {
            console.log(message);
            port.postMessage(message);
        }
    }));
});
