// ==UserScript==
// @name         GeoFS FMS
// @version      v0.3 alpha
// @description  Flight management system
// @author       TurboMaximus
// @icon         https://www.geo-fs.com/favicon.ico
// @match        https://www.geo-fs.com/geofs.php
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    geofs.fms = geofs.fms || {};
    geofs.fms.interval = setInterval(() => {
        window.routePos = window.routePos || 0;
        if (!geofs.api.map.flightPath || !geofs.autopilot.on) {
            window.routePos = 0;
            return;
        }

        geofs.api.map.flightPath._lineMarkers.forEach((m,i) => {
            m._icon.style.backgroundColor = (i == window.routePos) && (Math.floor(new Date()/1000)%2) ?
                'red' : (i < window.routePos ? 'grey' : 'white');
            if (i == window.routePos && !m._gpsFix)
                m._gpsFix = geofs.nav.addGPSFIX([m._latlng.lat,m._latlng.lng]);

        });
        let nextWP = geofs.api.map.flightPath._lineMarkers[window.routePos];
        if (!nextWP || geofs.autopilot.mode!='NAV' || nextWP._gpsFix.type=='ILS')
            return;

        let nextWpLatLng = [nextWP._latlng.lat,nextWP._latlng.lng];
        const coords = geofs.aircraft.instance.getCurrentCoordinates();
        const dstToWaypoint = geofs.utils.distanceBetweenLocations(coords, nextWpLatLng);
        // random magic number, works for now overshoots alot tho
        const turnDist = (geofs.aircraft.instance.trueAirSpeed*30);
        if (dstToWaypoint < turnDist) {
            window.routePos++;
            if (nextWP._gpsFix && nextWP._gpsFix.type=='FIX')
                geofs.nav.removeNavaid(nextWP._gpsFix.id);

            nextWP = geofs.api.map.flightPath._lineMarkers[window.routePos];
            if (!nextWP) {
                beep(20,660,50);
                setTimeout(()=>{beep(20,480,50)},50);
                geofs.autopilot.setMode('HDG');
                return;
            }
            const lastWpLatLng = nextWpLatLng;
            nextWpLatLng = [nextWP._latlng.lat,nextWP._latlng.lng];
            if (!nextWP._gpsFix)
                nextWP._gpsFix = getClosestNavaid([nextWP._latlng.lat,nextWP._latlng.lng]);
            if (!nextWP._gpsFix)
                nextWP._gpsFix = geofs.nav.addGPSFIX([nextWP._latlng.lat,nextWP._latlng.lng]);
            geofs.nav.selectNavaid(nextWP._gpsFix.id);
            if (geofs.utils.distanceBetweenLocations(lastWpLatLng, nextWpLatLng) > turnDist)
                geofs.nav.setOBS('GPS', Math.round(geofs.utils.bearingBetweenLocations(lastWpLatLng, nextWpLatLng)),0,true);

            geofs.autopilot.setMode('NAV');
        }
    }, 1000);

    function getClosestNavaid(pos, range=1000, type='ILS') {
        var nearest = [Infinity,null];
        return geofs.nav.navaids.reduce((p,c) => {
            if (!c || c.type!=type)
                return p;

            const dist = geofs.utils.distanceBetweenLocations(pos, [c.lat,c.lon]);
            if (dist < range && dist < nearest[0])
                nearest = [dist, c];

            return nearest[1];
        });
        for (let i=0; i < geofs.nav.navaids.length; i++) {
            if (geofs.nav.navaids[i] &&
                geofs.utils.distanceBetweenLocations(pos, [geofs.nav.navaids[i].lat,geofs.nav.navaids[i].lon]) < range)
                return geofs.nav.navaids[i];
        }
    }
    function importFmcRoute(json) {
        if (json.length && json.length == 4) {
            if (json[3].length == undefined)
                throw 'Invalid FMC route';

            geofs.api.map.clearPath();
            geofs.api.map.setPathPoints(json[3].reduce((p,c) => {
                if (c && c[1] && c[2])
                    p.push([c[1],c[2]]);
                return p;
            },[]));
            geofs.api.map.stopCreatePath();
        }
    }
    var audioContext = AudioContext && new AudioContext();
    function beep(amp, freq, ms){//amp:0..100, freq in Hz, ms
        if (!audioContext) return;
        var osc = audioContext.createOscillator();
        var gain = audioContext.createGain();
        osc.connect(gain);
        osc.frequency.value = freq;
        gain.connect(audioContext.destination);
        gain.gain.value = amp/100;
        osc.start(audioContext.currentTime);
        osc.stop(audioContext.currentTime+ms/1000);
    }
    setTimeout(() => {
        const importButton = $('<input type="button" value="FMC import" style="width: 120px;border: 2px solid #bbb;">');
        let popup;
        importButton.on('click', (e) => {
            popup = window.open('about:blank',  null, 'width=300,height=200,toolbar=0,location=0,status=1,scrollbars=1,resizable=1');
            const fmcImportInput = $('<textarea style="width: 100%;height:100%;border: 2px solid #bbb;"></textarea>');
            popup.document.body.appendChild(fmcImportInput[0]);
            popup.document.head.appendChild($('<title>GeoFS - FMC import</title>')[0]);
            fmcImportInput.on('change keyup', (e) => {
                try{
                    importFmcRoute(JSON.parse(fmcImportInput.val()));
                    fmcImportInput.val('');
                    popup.close();
                } catch (error) {
                    popup.document.head.title = 'Error: '+error;
                }
            });
        });

        const importDiv = $('<div style="position:absolute;top: 48px;left:55px;"></div>');
        importDiv.append(importButton);
        $('div.geofs-clearPath').parent().append(importDiv);

        document.querySelector('input.geofs-autopilot-speed').onwheel = e => {
            geofs.autopilot.setSpeed(parseInt(e.target.value) + e.deltaY/(e.shiftKey ? -100 : -10));
        };
        document.querySelector('input.geofs-autopilot-course').onwheel = e => {
            geofs.autopilot.setCourse(parseInt(e.target.value) + e.deltaY/(e.shiftKey ? -100 : -10));
        };
        document.querySelector('input.geofs-autopilot-altitude').onwheel = e => {
            geofs.autopilot.setAltitude(parseInt(e.target.value) + e.deltaY/(e.shiftKey ? -10 : -1));
        };
        document.querySelector('input.geofs-autopilot-verticalSpeed').onwheel = e => {
            geofs.autopilot.setVerticalSpeed(parseInt(e.target.value) + e.deltaY/(e.shiftKey ? -10 : -1));
        };
    }, 1000);
})();