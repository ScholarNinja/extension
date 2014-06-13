'use strict';
/*jshint -W061 */

var $ = require('jquery');
var SHA256 = require('crypto-js/sha256');

var linksRegex = /^https?:\/\/([^.]*\.)?(dx.doi.org|github.com|bitbucket.(com|org)|r-project.org)/;

var rules = {
    'PLOS': {
        url: /plos.*\.org\/article\/info/,
        journal: '$(".logo:first img").attr("alt")',
        title: '$(".header h1").text().trim()',
        authors: '$(".authors:first .person").map(function(e) { return $(this).children().remove().end().text().trim().replace(/[\\s,]+$/g, ""); }).get().join(", ")',
        fulltext: '$(".article").html()',
        abstract: '$(".abstract").text()',
        year: '$(".date-doi-line li:first").text().split(", ")[1]',
        doi: '$(".header > ul.date-doi-line > li:nth-child(2)").text().substr(5)'
    },
    'eLife': {
        url: /elifesciences\.org\/content\//,
        journal: '"eLife"',
        title: '$(".page-title").text()',
        authors: '$(".elife-article-author-item").map(function() { return $(this).text() }).get().join(", ")',
        fulltext: '$("#main-text").html() + $("#references").html()',
        abstract: '$("#abstract").text()',
        year: '$(".highwire-doi-epubdate-data").text().split(", ")[1]',
        doi: '$(".elife-doi-doi").text().replace("http://dx.doi.org/", "")'
    }

};

var supported = function supported(url) {
    var support;
    $.each(rules, function(rule) {
        if(url.match(rules[rule].url)) {
            console.log('Matches rule: ' + rule);
            support = rule;
            return false;
        }
    });
    return support;
};

var extract = function extract(document, rule) {
    console.log('Extracting ' + document.URL + ' with '+ rule);
    rule = rules[rule];
    var message = {
        journal: eval(rule.journal),
        title: eval(rule.title),
        authors: eval(rule.authors),
        abstract: eval(rule.abstract),
        year: eval(rule.year),
        doi: eval(rule.doi),
        url: document.URL
    };

    if (message.doi) {
        message.id = message.doi;
    }
    else {
        message.id = SHA256(message);
    }

    message.fulltext = eval(rule.fulltext);
    message.method = 'POST';
    message.links = $(message.fulltext).find('a').
        map(function(i,e) {
            var url = e.getAttribute('href');
            if(url && url.match(linksRegex)) {
                return url;
            }
        }
    ).get();
    return message;
};

module.exports.supported = supported;
module.exports.extract = extract;