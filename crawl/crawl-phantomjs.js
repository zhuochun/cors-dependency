// Author: Wang Zhuochun
// Last Edit: 16/May/2013 07:28 PM

// ========================================
// Require: phantomjs @ http://phantomjs.org/
// Usage:
//     phantomjs crawl-phantomjs.js [-o outputFilename] [-n]
// ========================================

/*jshint browser:true, jquery:true, laxcomma:true, maxerr:50 */

var webpage = require("webpage")
  , fs = require("fs")
  , sys = require("system")
  , list = require("./modules").modules;

// Heading
console.log("\n************* CORS Dependency **************");
console.log("*** To Crawl NUS Module Basic Details ***");
console.log("*****************************************\n");

// Variables
var sem = (function(today) {
        // from CORS Planner util/helper.js
        var result = {
                startYear: 2012, endYear: 2013
              , acadYear: "2012/2013", semester: 2
            }
          , year = today.getFullYear()
          , month = today.getMonth(); // month is [0, 11]

        // Jan 0 - July 6 (this year sem 2)
        // Aug 7 - Nov 10 (next year sem 1)
        // Dec 11 (next year sem 2)
        if (month <= 6) {
            result.startYear = year - 1;
            result.endYear = year;
            result.semester = 2;
        } else if (month >= 11) {
            result.startYear = year;
            result.endYear = year + 1;
            result.semester = 2;
        } else {
            result.startYear = year;
            result.endYear = year + 1;
            result.semester = 1;
        }

        result.acadYear = result.startYear + "/" + result.endYear;

        return result;
    })(new Date())
  , url = function(modCode) {
        // from CORS Planner sg.nus/url.js
        return "https://sit.aces01.nus.edu.sg/cors/jsp/report/ModuleDetailedInfo.jsp?" +
            "acad_y=" + sem.acadYear + "&sem_c=" + sem.semester +
            "&mod_c=" + modCode.toUpperCase();
    }
  , thread = 1 
  , output = "list.js"
  , update = true;

// Args
if (sys.args.length > 1) {
    for (var i = 1; i < sys.args.length; i++) {
        if (sys.args[i] === "-o") {
            output = sys.args[i+1] + ".js";
        } else if (sys.args[i] === "-n") {
            update = false;
        } else if (sys.args[i] === "-t") {
            thread = parseInt(sys.args[i+1], 10);
        }
    }
}

// Crawl and Parse Start

// modules length
var llength = 30//list.length
  , completed = 0;

console.log("list length = " + llength);

// thread variables
var i, max = ((llength / thread) | 0) + 1;

console.log("thread = " + thread + ", max = " + max);

// track performance start
var timeStart = new Date();

for (i = 0; i < thread; i++) {
    var aPage = webpage.create();

    aPage.onConsoleMessage = function(msg) { console.log(msg); };

    visitPage(aPage, max * i, max * (i + 1));
}

// results
var finalList = {}, duplicateList = {};

function visitPage(page, idx, max) {
    // exit
    if (completed >= llength) {
        outputFile(output);

        page.close();

        // performance stop
        var totalTime = new Date() - timeStart;
        console.log("Spent " + (totalTime / 1000).toFixed(2) + "s using " + thread + " pages");

        phantom.exit();

        return ;
    } else if (idx >= llength || idx >= max) {
        page.close();

        return ;
    }

    // get module code from list
    //console.log("Test List Idx = " + idx + ", Item = " + list[idx]);

    var moduleRegex = /[a-z]{2,3}\d{4}[a-z]?/ig,
        module = moduleRegex.exec(list[idx]),
        match;

    //console.log("Module = " + JSON.stringify(module));

    // handle duplicate modules
    match = moduleRegex.exec(list[idx]);
    while (match !== null) {
        duplicateList[match[0]] = { referTo: module[0] };

        //console.log("Match = " + JSON.stringify(match));

        match = moduleRegex.exec(list[idx]);
    }

    // Open Each Degree Module Listings
    page.open(encodeURI(url(module[0])), function(status) {
        // Check for page load success
        if (status !== "success") {
            console.log("===! Unable to access network\n");
        } else {
            // Execute some DOM inspection within the page context
            var result = page.evaluate(function() {
                var j, k, len, tds, result = {}
                  , keys = ["title", "description", "", "", "credits",
                              "prerequisite", "preclusion", "workload", ""];

                console.log("In page: " + location.href);

                function parse() {
                    tds = document.getElementsByClassName("tableframe")[0]
                                  .getElementsByTagName("td");

                    result.code = tds[2].textContent.trim();

                    for (j = 5, k = 0, len = tds.length; j < len; j = j + 2, k++) {
                        if (keys[k] === "") {
                            continue;
                        } else {
                            result[keys[k]] = tds[j].textContent.trim();
                        }
                    }
                }

                try {
                    parse();
                } catch (e) {
                    parse();
                }

                return result;
            });

            // save result to finalList uniquely
            finalList[result.code] = result;

            completed++;

            visitPage(page, idx + 1, max);
        }
    });
}

// ouput module information
function outputFile(output) {
    console.log("===> Output to file [" + output + "] with " + Object.keys(finalList).length + " Modules");

    for (var key in duplicateList) {
        if (duplicateList.hasOwnProperty(key) && !finalList[key])
            finalList[key] = duplicateList[key];
    }

    fs.write(output, "window.moduleList = " + JSON.stringify(finalList) + ";", "w");

    console.log("===> Output Completed");
}

// update global information
function updateFile(global) {
    console.log("===> Update global Info [" + global + "]");

    var file = fs.open(global, "rw"), content = file.read();

    content = content.replace(/lastUpdate\s*:\s*(\".*\")/,
                              "lastUpdate: \"" + (new Date()) + "\"");

    file.write(content);
    file.flush();
    file.close();

    console.log("===> Update Completed");
}
