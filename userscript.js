// ==UserScript==
// @name         GeoFS FMS
// @version      v0.1
// @description  Flight management system
// @author       TurboMaximus
// @namespace    http://geo-fs.com/
// @icon         https://www.geo-fs.com/favicon.ico
// @match        https://*/geofs.php
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    if (!geofs.fms)
        geofs.fms = {};

    geofs.fms.interval = setInterval(() => {
        window.routePos = window.routePos || 0;
        if (!geofs.api.map.flightPath || !geofs.autopilot.on) {
            window.routePos = 0;
            return;
        }

        geofs.api.map.flightPath._lineMarkers.forEach((m,i) => {
            m._icon.style.backgroundColor = (i == window.routePos) && (Math.floor(new Date()/1000)%2) ? 'red' : 'white';
            if (i == window.routePos && !m._gpsFix)
                m._gpsFix = geofs.nav.addGPSFIX([m._latlng.lat,m._latlng.lng]);

        });
        let nextWP = geofs.api.map.flightPath._lineMarkers[window.routePos];
        if (!nextWP || geofs.autopilot.mode!='NAV' || nextWP._gpsFix.type=='ILS')
            return;

        let nextWpLatLng = [nextWP._latlng.lat,nextWP._latlng.lng];
        const coords = geofs.aircraft.instance.getCurrentCoordinates();
        const dstToWaypoint = geofs.utils.distanceBetweenLocations(coords, nextWpLatLng);
        if (dstToWaypoint < (geofs.aircraft.instance.trueAirSpeed*30)) {
            window.routePos++;
            if (nextWP._gpsFix && nextWP._gpsFix.type=='FIX')
                geofs.nav.removeNavaid(nextWP._gpsFix.id);

            nextWP = geofs.api.map.flightPath._lineMarkers[window.routePos];
            if (nextWP) {
                const lastWpLatLng = nextWpLatLng;
                nextWpLatLng = [nextWP._latlng.lat,nextWP._latlng.lng];
                if (!nextWP._gpsFix) {
                    nextWP._gpsFix = getClosestNavaid([nextWP._latlng.lat,nextWP._latlng.lng]);
                    if (!nextWP._gpsFix)
                        nextWP._gpsFix = geofs.nav.addGPSFIX([nextWP._latlng.lat,nextWP._latlng.lng]);
                }
                geofs.nav.selectNavaid(nextWP._gpsFix.id);
                if (geofs.utils.distanceBetweenLocations(lastWpLatLng, nextWpLatLng) > (geofs.aircraft.instance.trueAirSpeed*30))
                    geofs.nav.setOBS('GPS', Math.round(geofs.utils.bearingBetweenLocations(lastWpLatLng, nextWpLatLng)),0,true);

                geofs.autopilot.setMode('NAV');
            } else {
                geofs.autopilot.setMode('HDG');
            }
        }
        console.log('dist',Math.round(dstToWaypoint));

    }, 1000);

    function getClosestNavaid(pos, range=5000) {
        var nearest = [Infinity,null];
        return geofs.nav.navaids.reduce((p,c) => {
            if (!c)
                return p;

            const dist = geofs.utils.distanceBetweenLocations(pos, [c.lat,c.lon]);
            if (dist < range && dist < nearest[0])
                nearest = [dist, c];

            return nearest[1];
        });
        for (let i=0; i < geofs.nav.navaids.length; i++) {
            if (geofs.nav.navaids[i] && geofs.utils.distanceBetweenLocations(pos, [geofs.nav.navaids[i].lat,geofs.nav.navaids[i].lon]) < range)
                return geofs.nav.navaids[i];
        }
    };
})();