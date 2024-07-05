// ==UserScript==
// @name         FMC import
// @version      0.1.0
// @description  Enables the new GeoFS 3.8 FMC to read old FMC routes
// @author       TurboMaximus
// @match        https://*/geofs.php*
// @downloadURL  https://github.com/scitor/GeoFS/raw/master/fmcImport/fmcImport.user.js
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function init() {
    'use strict';

    if (!window.jQuery)
        return setTimeout(init, 1000);

    geofs.flightPlan.import = function(json) {
        let waypoints = [];
        json = JSON.parse(json);
        if (Array.isArray(json) && typeof json[0] == 'string') {
            json = json[3].map(fmc=>({ident:fmc[0],lat:fmc[1],lon:fmc[2],alt:fmc[3]||"",spd:"",type:"FIX"}));
        }
        json.nodes ? json.nodes.forEach(function(c, d) {
            void 0 == c.alt && (c.alt = "");
            void 0 == c.spd && (c.spd = "");
            waypoints.push(c)
        }) : waypoints = json;
        geofs.flightPlan.waypointArray = waypoints;
        geofs.flightPlan.refreshWaypoints()
    };
})();