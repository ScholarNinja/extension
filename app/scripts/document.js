'use strict';

// var _ = require('underscore');
// var async = require('async');
var $ = require('jquery');

function find(query, port) {

    // hello({"version":"3.0.1","hitCount":74320,"request":{"dataSet":"METADATA","resultType":"LITE","synonym":true,"query":"malaria","page":1},"resultList":{"result":[{"id":"23962577","source":"MED","pmid":"23962577","title":"Is malarial anaemia homologous to neocytolysis after altitude acclimatisation?","authorString":"Fernandez-Arias C, Arias CF, Rodriguez A.","journalTitle":"Int J Parasitol","issue":"1","journalVolume":"44","pubYear":"2014","journalIssn":"0020-7519","pageInfo":"19-22","pubType":"journal article","isOpenAccess":"N","inEPMC":"N","inPMC":"N","citedByCount":0,"hasReferences":"Y","hasTextMinedTerms":"N","hasDbCrossReferences":"N","hasLabsLinks":"N","hasTMAccessionNumbers":"N","luceneScore":"595.09406","doi":"10.1016/j.ijpara.2013.06.011"}
    // http://www.ebi.ac.uk/europepmc/webservices/rest/search/query=malaria&format=json&callback=hello

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

    var searchUrl = 'http://www.ebi.ac.uk/europepmc/webservices/rest/search/query=' + query + '&format=json';

    $.getJSON(searchUrl, function(data) {
        port.postMessage({results: data.resultList.result});
    })
    .done(function() {
        console.log('second success');
    })
    .fail(function() {
        port.postMessage({status: 'FAIL'});
        console.log('error');
    })
    .always(function() {
        console.log('complete');
    });
}

module.exports.find = find;
