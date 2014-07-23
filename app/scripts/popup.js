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
            // authorString: "Hello M, Barbarot S, Néel A, Connault J, Graveleau J, Durant C, Decaux O, Hamidou M."
            // citedByCount: 0
            // doi: "10.1016/j.revmed.2013.08.014"
            // hasDbCrossReferences: "N"
            // hasLabsLinks: "N"
            // hasReferences: "Y"
            // hasTMAccessionNumbers: "N"
            // hasTextMinedTerms: "N"
            // id: "24070793"
            // inEPMC: "N"
            // inPMC: "N"
            // isOpenAccess: "N"
            // issue: "1"
            // journalIssn: "0248-8663"
            // journalTitle: "Rev Med Interne"
            // journalVolume: "35"
            // luceneScore: "685.9628"
            // pageInfo: "28-38"
            // pmid: "24070793"
            // pubType: "journal article; english abstract"
            // pubYear: "2014"
            // source: "MED"
            // title: "Manifestations cutanées associées aux gammapathies monoclonales."

            log('Received', 'result'.pluralize(response.results.length, 'results'));
            var results = response.results;
            if(results.length === 0) {
                $('#results').html('No results found.');
            } else {
                for (var i = 0; i < results.length; i++) {
                    if(results[i].doi) {
                        results[i].url = 'http://dx.doi.org/' + results[i].doi;
                    }
                    else {
                        results[i].url = 'http://europepmc.org/abstract/MED/' + results[i].pmid;
                    }
                    var html = '<div class="result"><h2><a href="' + results[i].url  +'" target="_blank">' +
                        results[i].title  + '</a></h2>' +
                        '<p>' + results[i].authorString + ' &mdash; ' + results[i].journalTitle +
                        ' (' + results[i].pubYear + ')</p></div>';
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
