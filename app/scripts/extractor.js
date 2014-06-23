'use strict';
/*jshint -W061 */

var $ = require('jquery');
var SHA256 = require('crypto-js/sha256');

var links = [
    'dx.doi.org',
    'github.com',
    'bitbucket.(com|org)',
    'r-project.org',
    'sourceforge.net'
];

var linksRegex = new RegExp('^https?://([^.]*\\.)?(' +
    links.join('|') +
    ')',
    'i' // Ignore case
);

var rules = {
    'PLOS': {
        url: /plos.*\.org\/article\/info/,
        journal: '$(".logo:first img").attr("alt")',
        title: '$(".header h1").text().trim()',
        authors: '$(".authors:first .person").map(function(e) { return $(this).children().remove().end().text().trim().replace(/[\\s,]+$/g, ""); }).get().join(", ")',
        abstract: '$(".abstract").text()',
        fulltext: '$(".article").html()',
        year: '$(".date-doi-line li:first").text().split(", ")[1]',
        doi: '$(".header > ul.date-doi-line > li:nth-child(2)").text().substr(5)'
    },
    'eLife': {
        url: /elifesciences\.org\/content\//,
        journal: '"eLife"',
        title: '$(".page-title").text()',
        authors: '$(".elife-article-author-item").map(function() { return $(this).text() }).get().join(", ")',
        abstract: '$("#abstract").text()',
        fulltext: '$("#main-text").html() + $("#references").html()',
        year: '$(".highwire-doi-epubdate-data").text().split(", ")[1]',
        doi: '$(".elife-doi-doi").text().replace("http://dx.doi.org/", "")'
    },
    'ScienceDirect': {
        url: /sciencedirect.com\/science\/article\/pii\//,
        journal: '$(".centerPane .head .title a span").text()',
        title: '$("h1.svTitle").text()',
        authors: '$(".authorGroup .authorName").map(function() { return $(this).text()}).get().join(", ")',
        abstract: '$(".abstract.svAbstract").text()',
        fulltext: '$(".svArticle.section").html() + $(".refText").html()',
        year: '$(".volIssue").text().match(/ ([1-2]\\d\\d\\d)/)[1]',
        doi: '$(".doiLink .doi").text().substr(6)'
    },
    'peerJ': {
        url: /peerj.com\/articles\//,
        journal: '"PeerJ"',
        title: '$("h1.article-title").text()',
        authors: '$(".article-authors span.contrib .name").map(function() { return $(this).text() }).get().join(", ")',
        abstract: '$("article .abstract").text()',
        fulltext: '$("article main").html() + $("footer .ref-list").html()',
        year: '$(".article-dates dd time").get()[0].innerHTML.split("-")[0]',
        doi: '$(".self-citation a:first").text().replace("http://dx.doi.org/", "")'
    },
    'IOPScience': {
        url: /iopscience.iop.org\/.*?\/article/,
        journal: '$("ul.breadcrumbs li:nth-child(1) a").text()',
        title: '$("div.publishingInfo h2").text().trim()',
        authors: '$("p.authors").clone().children().remove().end().text().replace(" and ", ", ")',
        abstract: '$("div.abst div div").text().trim()',
        fulltext: '$("div.section:nth(1)").html() + $("dl.citationlist").html()',
        year: '$("div.publishingInfo p:contains(\'©\')").html().split("<br>")[0].trim().split(" ")[1]',
        doi: '$("div.publishingInfo p a:contains(\'doi\')").text().split(":")[1]'
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

    message.fulltext = $(eval(rule.fulltext));
    message.method = 'POST';
    message.links = message.fulltext.find('a').
        map(function(i,e) {
            var url = e.getAttribute('href');
            if(url && url.match(linksRegex)) {
                return url;
            }
        }
    ).get();

    // We don't need HTML anymore and text is preferred for indexing
    message.fulltext = message.fulltext.text();

    if(message.fulltext.length < 1000) {
        console.log('You do not seem to have fulltext access to this journal.');
        return false;
    } else {
        return message;
    }
};

module.exports.supported = supported;
module.exports.extract = extract;