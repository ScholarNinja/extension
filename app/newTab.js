/**
 * Created by chowmean on 6/1/16.
 */

document.addEventListener('DOMContentLoaded', function() {
    var checkPageButton = document.getElementById('checkPage');
    checkPageButton.addEventListener('click', function() {
        var home=document.getElementById('search').value;
        newURL="https://scholar.google.co.in/scholar?hl=en&q="+home;
        chrome.tabs.create({ url: newURL }

        )    }, false);
}, false);

