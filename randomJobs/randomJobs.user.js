// ==UserScript==
// @name         GeoFS Random Jobs
// @version      0.8.6.1168
// @description  Adds basic transport jobs to GeoFS
// @author       TurboMaximus
// @match        https://*/geofs.php*
// @icon         https://raw.githubusercontent.com/scitor/GeoFS/master/randomJobs/logo.png
// @require      https://raw.githubusercontent.com/scitor/GeoFS/master/geofs.lib.js?0.8.6.1168
// @require      https://raw.githubusercontent.com/scitor/GeoFS/master/randomJobs/patch.js?0.8.6.1168
// @require      https://raw.githubusercontent.com/scitor/GeoFS/master/randomJobs/manager.js?0.8.6.1168
// @require      https://raw.githubusercontent.com/scitor/GeoFS/master/randomJobs/airport.handler.js?0.8.6.1168
// @require      https://raw.githubusercontent.com/scitor/GeoFS/master/randomJobs/flight.handler.js?0.8.6.1168
// @require      https://raw.githubusercontent.com/scitor/GeoFS/master/randomJobs/generator.js?0.8.6.1168
// @require      https://raw.githubusercontent.com/scitor/GeoFS/master/randomJobs/window.js?0.8.6.1168
// @require      https://raw.githubusercontent.com/scitor/GeoFS/master/randomJobs/career.page.js?0.8.6.1168
// @require      https://raw.githubusercontent.com/scitor/GeoFS/master/randomJobs/airport.page.js?0.8.6.1168
// @require      https://raw.githubusercontent.com/scitor/GeoFS/master/randomJobs/flightplan.page.js?0.8.6.1168
// @downloadURL  https://raw.githubusercontent.com/scitor/GeoFS/master/randomJobs/randomJobs.user.js
// @grant        none
// ==/UserScript==
'use strict';

const githubRepo = 'https://raw.githubusercontent.com/scitor/GeoFS/master';
let wait = 1;
(function init() {
    if (!Object.keys(aList[0]).length && wait<5) {
        return setTimeout(init, 1000 * wait++);
    }
    geofs.randomJobs = new RandomJobsMod(aList, aIndex, '0.8.6.1168');
    geofs.randomJobs.init(() => new MainWindow(geofs.randomJobs).init());
})();