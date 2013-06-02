// Author: Wang Zhuochun
// Last Edit: 02/Jun/2013 02:38 PM

// ========================================
// Require: phantomjs @ http://phantomjs.org/
// Usage:
//     phantomjs crawl-phantomjs.js [-t 20] [-o outputFilename] [-n]
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
  , thread = 29 
  , running_thread = 0
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
var llength = list.length
  , completed = 0;

console.log("list length = " + llength);

// thread variables
var increment = 1, max = ((llength / thread) | 0) + 1;

console.log("thread = " + thread + ", max = " + max);

// track performance start
var timeStart = new Date();

// results
var finalList = {}, duplicateList = {};

createAThread();

function createAThread() {
    if (running_thread >= thread) { return ; }

    var i = 0, key;

    while (running_thread < thread && i < increment) {
        key = "id" + running_thread;

        finalList[key] = {};

        visitPage(max * running_thread, /* index */
                  max * (running_thread + 1), /* max */
                  key /* key */);

        running_thread++;
        i++;
    }

    increment *= 2;
}

function visitPage(idx, max, key) {
    // exit
    if (completed >= llength) {
        outputFile(finalList[key], key + ".txt");
        outputFile(duplicateList, "duplicate.txt");

        finalList[key] = null;

        // performance stop
        var totalTime = new Date() - timeStart;
        console.log("Spent " + (totalTime / 1000).toFixed(2) + "s using " + running_thread + "/" + thread + " threads");

        phantom.exit();

        return ;
    } else if (idx >= llength || idx >= max) {
        outputFile(finalList[key], key + ".txt");

        finalList[key] = null;

        return ;
    }

    // open a page
    var page = webpage.create();
    page.onConsoleMessage = function(msg) { console.log(msg); };

    // get module code from list
    var moduleRegex = /[a-z]{2,3}\d{4}[a-z]{0,2}/ig,
        modules = list[idx].match( moduleRegex );

    if (modules.length > 1) {
        for (var i = 1, len = modules.length; i < len; i++) {
            duplicateList[modules[i]] = { referTo: modules[0] };
        }
    }

    completed++;

    // Open Each Degree Module Listings
    page.open(encodeURI(url(modules[0])), function(status) {
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

                parse();

                return result;
            });

            // save result to finalList uniquely
            finalList[key][result.code] = result;

            createAThread();

            page.close();

            visitPage(idx + 1, max, key);
        }
    });
}

// ouput module information
function outputFile(data, file) {
    console.log("===> Output To [" + file + "]: " + Object.keys(data).length + " Modules");

    fs.write(file, JSON.stringify(data), "w");

    console.log("===> Output Completed (" + completed + "/ " + llength + ")");
}
