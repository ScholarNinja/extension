'use strict';
/*jshint -W061 */

var $ = require('jquery');

var rules = {
    'PLOS': {
        url: /plos.*\.org\/article\/info/,
        journal: '$(".logo:first img").attr("alt")',
        title: '$(".header h1").text().trim()',
        authors: '$(".authors:first .person").map(function(e) { return $(this).children().remove().end().text().trim().replace(/[\\s,]+$/g, ""); }).get().join(", ")',
        article: '$(".article").text()',
        year: '$(".date-doi-line li:first").text().split(", ")[1]',
        doi: '$(".header > ul.date-doi-line > li:nth-child(2)").text()'
    },
    'eLife': {
        url: /elifesciences\.org\/content\//,
        journal: '"eLife"',
        title: '$(".page-title").text()',
        authors: '$(".elife-article-author-item").map(function() { return $(this).text() }).get().join(", ")',
        article: '$(".pane-content:has(#main-text)").text()',
        year: '$(".highwire-doi-epubdate-data").text().split(", ")[1]',
        doi: '"DOI: " + $(".elife-doi-doi").text().replace("http://dx.doi.org/", "")'
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
    console.log('Extracting ' + document.URL + 'with '+ rule);
    rule = rules[rule];
    var message = {
        id: document.URL,
        journal: eval(rule.journal),
        title: eval(rule.title),
        authors: eval(rule.authors),
        article: eval(rule.article),
        year: eval(rule.year),
        doi: eval(rule.doi),
        url: document.URL,
        method: 'POST',
    };
    return message;
};

module.exports.supported = supported;
module.exports.extract = extract;