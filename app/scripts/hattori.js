'use strict';

var $ = require('jquery');
var _ = require('underscore');
var async = require('async');

var cayley = 'http://localhost:64210/api/v1/query/gremlin';

var cache = {};

function find(url, callback) {
    var ajax = $.ajax({
        type: 'POST',
        url: cayley,
        data: 'g.Vertex("' + url + '").In("code").Out("code").All()',
        dataType: 'text',
        processData: false,
        contentType: 'text/plain'
    });


    ajax.done(function(results) {

        results = JSON.parse(results);
        var pairs = _.pairs(_.countBy(results.result, 'id'));

        pairs = _.sortBy(pairs, function (item) {
            return -item[1];
        });

        pairs = _.map(pairs, function(pair) {
            if(pair[0] !== url) {
                return {url: pair[0], citations: pair[1]};
            }
        });

        pairs = _.compact(pairs);

        async.map(pairs, enrich, function(err, results) {
            results = _.compact(results);
            console.log(results);
            callback(results);
        });
    });

    return ajax;
}

function enrich(pair, callback) {
    var citations = pair.citations;
    var matches = pair.url.match(/github.com\/(.+)\/(.+)$/);
    if(matches) {
        var url = 'https://api.github.com/repos/' + matches[1] + '/' + matches[2];
        if(cache[url]) {
            callback(null, cache[url]);
        } else {
            $.getJSON(url)
            .done(function(response) {
                response.citations = citations;
                cache[url] = response;
                callback(null, response);
            })
            .fail(function () {
                callback(null, null);
            });
        }
    }
    else {
        callback(null, null);
    }
}

var rules = {
    'GitHub': {
        url: /github\.com\/.+\/.+/
    }
};

function supported(url) {
    var support;
    $.each(rules, function(rule) {
        if(url.match(rules[rule].url)) {
            console.log('Matches rule: ' + rule);
            support = rule;
            return false;
        }
    });
    return support;
}

function cleanUrl(url) {
    // Clean the URL
    return url.replace(/^https?:\/\//, '');
}

module.exports.find = find;
module.exports.supported = supported;
module.exports.cleanUrl = cleanUrl;
