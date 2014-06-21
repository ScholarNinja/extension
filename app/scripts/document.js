'use strict';

var _ = require('underscore');
var async = require('async');

// Join the DHT network
var dht = require('./dht');
dht.createOrJoin();

// Prepare the pipeline
var lunr = require('lunr');
var pipeline = new lunr.Pipeline();
pipeline.add(lunr.trimmer);
pipeline.add(lunr.stemmer);
pipeline.add(lunr.stopWordFilter);

var documents;

// Fields and boosts
var fields = {
    title: 10,
    authors: 3,
    abstract: 2,
    journal: 2,
    fulltext: 1
};

function restore() {
    chrome.storage.local.get('documents', function (obj) {
        if(obj.documents === undefined) {
            documents = {};
        } else {
            documents = obj.documents;
        }
    });

    // Also serialize DHT entries
}

restore();

function store(documents) {
    chrome.storage.local.set(documents);
}

/* Document example

We use DOI as docref if
it exists.

docref = "10.1371/journal.pone.0004821"

Or by hashing the document's fields, we get a docref:
8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4

"10.1371/journal.pone.0004821" = {
    url: "http://www.plosone.org/article/info%3Adoi%2F10.1371%2Fjournal.pone.0004821",
    doi: "10.1371/journal.pone.0004821",
    title: "The Action of Key Factors in Protein Evolution at High Temporal Resolution",
    authors: "Armin Schmitt, Johannes Schuchhardt, Gudrun A. Brockmann",
    year: "2009",
    journal: "PLOS ONE"
}
*/

function get(ref, callback) {
    if(documents[ref]) {
        callback(null, documents[ref]);
    } else {
        dht.get(ref, function(entries, error) {
            if(error) {
                callback(error);
            } else if(entries.length === 0) {
                callback('Does not exist.');
            } else {
                // Cache locally
                documents[ref] = entries[0];
                callback(null, entries[0]);
            }
        });
    }
}

function add(doc) {
    // Try to get document, don't index it if it already exists:
    get(doc.id, function(error) {
        // Document doesn't exist
        if(error) {
            // Save document locally and to DHT, without the full text.
            documents[doc.id] = doc;
            console.log('Added document', doc.id, 'to index.');
            dht.put(doc.id, _.omit(doc, 'fulltext'));

            Object.keys(fields).forEach(function (key){
                var keywords = pipeline.run(lunr.tokenizer(doc[key]));
                keywords.forEach(function(keyword) {
                    // Add to DHT: [key]keyword: doc.id
                    // E.g. [title]cancer
                    var dhtKey = '[' + key + ']' + keyword;
                    dht.put(dhtKey, doc.id);
                });
            });

            // Cache node's entries locally

            doc.links.forEach(function(link) {
                // Add to DHT [URL]link: doc.id
                var dhtKey = '[URL]' + link;
                dht.put(dhtKey, doc.id);
            });
            // Update documents cache
            store(documents);
        } else {
            console.log('Document is already indexed');
        }
    });
}

// Scoring example
// title: 10,
// authors: 3,
// abstract: 2,
// journal: 2,
// fulltext: 1

// query = hello machine

// keyword 1 = hello

// title: [1]
// abstract: [1,3]
// fulltext: [2,1]
// authors: [1,2]

// union = {
//   1: 15 (10+3+2),
//   2: 4 (1+3),
//   3: 2
// }

// keyword 2 = machine

// title: [2,3]
// abstract: [2]
// fulltext: [2,1]
// authors: [4]

// union = {
//   1: 1,
//   2: 14,
//   3: 10
//   4: 3
// }

// [keyword 2 union, keyword 1 union] intersection =

// {
//   1: 16,
//   2: 18,
//   3: 12
// }

// Document 2 has highest score.

function find(query, port) {
    // Enable full URL search, naïve.
    var keywords;
    if(query.match(/^http:\/\//)) {
        keywords = [query];
    } else {
        keywords = pipeline.run(lunr.tokenizer(query));
    }

    async.map(keywords, findByKeyword, function (error, keywordsIdsAndScores) {
        var response;
        if(error) {
            response = {status: 'FAIL'};
            port.postMessage(response);
        } else {
            // keywordsIdsAndScores e.g.
            // [{1: 10, 2: 13, 3: 7}, { ... }]
            response = {status: 'OK'};
            var scores = {};
            var keys = [];
            _.each(keywordsIdsAndScores, function(idsAndScores) {
                keys.push(_.keys(idsAndScores));
                _.each(idsAndScores, function (score, id) {
                    if(scores[id]) {
                        scores[id] = scores[id] + score;
                    } else {
                        scores[id] = score;
                    }
                });
            });
            var matchingDocuments = _.intersection.apply(_, keys);
            matchingDocuments = _.sortBy(matchingDocuments, function (key) {
                return -scores[key];
            });

            async.map(matchingDocuments, get.bind(this), function (error, result) {
                if(error) {
                    response = {status: 'FAIL'};
                } else {
                    // An array of documents
                    response.results = result;
                }
                port.postMessage(response);
            });
        }
    });
}

function findByKeyword(keyword, callback) {
    // First build fieldsWithKeywords array, e.g.:
    // [{'title': keyword}, {'authors': keyword}]
    // Or only [{URL: keyword}] if we're looking for URL.
    var fieldsWithKeywords;

    if (keyword.match(/^http:\/\//)) {
        fieldsWithKeywords = [{URL: keyword}];
    } else {
        fieldsWithKeywords = _.map(_.keys(fields), function(field) {
            var pair = {};
            pair[field] = keyword;
            return pair;
        });
    }

    // Iterate through each indexed field asynchronously
    async.map(fieldsWithKeywords, findByFieldAndKeyword, function (error, fieldsAndIds) {
        if (error) {
            console.log('Failed to find', keyword, ':', error);
            callback(error);
        } else {
            // fieldsAndIds = [{title: [1,2]}, {autors: [2,3]}, {...}, ...]
            var result = {};
            _.each(fieldsAndIds, function(fieldAndIds) {
                var field = _.keys(fieldAndIds)[0];
                var ids = _.values(fieldAndIds)[0];
                _.each(ids, function(id) {
                    // Score is either 1 or specific value per field
                    var score = fields[field] ? fields[field] : 1;
                    // Adds up the scores according to boosts
                    if(result[id]) {
                        result[id] = result[id] + score;
                    } else {
                        result[id] = score;
                    }
                });
            });
            // result e.g. {1: 10, 2: 13, 3: 3}
            callback(null, result);
        }
    });
}

function findByFieldAndKeyword(fieldKeyword, callback) {
    var field = _.keys(fieldKeyword)[0];
    var keyword = fieldKeyword[field];

    dht.get('[' + field + ']' + keyword, function(entries, error) {
        if (error) {
            console.log('Failed to retrieve entries:', error);
            callback(error);
        } else {
            var result = {};
            result[field] = _.flatten(entries);
            callback(null, result);
        }
    });
}

module.exports.find = find;
module.exports.add = add;