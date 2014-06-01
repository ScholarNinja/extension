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
        }, 100);
    };
};

$(document).ready(function (){
    $('input').bind('keyup', debounce(function () {
        $('#results').empty();

        var message = {
            method: 'GET',
            query: $(this).val()
        };

        chrome.runtime.sendMessage(message, function(response) {
            console.log('Received search response');

            for (var i = 0; i < response.length; i++) {
                var html = '<div class="result"><h2><a href="' + response[i].url  +'" target="_blank">' +
                    response[i].title  + '</a></h2>' +
                    '<p>' + response[i].authors + ' &mdash; ' + response[i].journal +
                    ' (' + response[i].year + ')</p></div>';
                $('#results').append(html);
            }
        });
    }));
});
