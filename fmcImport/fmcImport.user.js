// ==UserScript==
// @name         GeoFS - FMC import
// @version      0.2.0
// @description  Enables the new GeoFS 3.8 FMC to read old FMC routes and import from SimBrief
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

    const button = createTag('input',{type:'button',value:'SimBrief import',style:'background:none;color:white;border:0'});
    $('.geofs-flightPlanHeader')[0].appendChild(button);
    button.onclick = (e) => {
        if (!localStorage.simbriefUsername || e.ctrlKey)
            localStorage.simbriefUsername = prompt('SimBrief Username', localStorage.simbriefUsername);
        fetch('https://www.simbrief.com/api/xml.fetcher.php?json=1&username='+localStorage.simbriefUsername).then(data=>data.json()).then(json=>{
            if (!json || !json.navlog) return;
            console.log(json);
            geofs.flightPlan.waypointArray = json.navlog.fix.map(entry => ({
                ident:entry.ident,
                lat:parseFloat(entry.pos_lat),
                lon:parseFloat(entry.pos_long),
                alt:parseInt(entry.altitude_feet),
                spd:(entry.type=='ltlg'||entry.stage=='CRZ') ? Math.round(entry.mach*66.6)*10 : parseInt(entry.ind_airspeed),
                type:"FIX"
            }));
            geofs.flightPlan.refreshWaypoints();
        });
    };
    function createTag(e,t={},n){const r=document.createElement(e);return Object.keys(t).forEach(e=>r.setAttribute(e,t[e])),n&&(r.innerHTML=n),r}
})();