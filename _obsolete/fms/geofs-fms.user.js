// ==UserScript==
// @name         GeoFMS - Native flight path autopilot
// @version      0.4.8
// @description  Simple autopilot extension to follow flight paths on the map
// @author       TurboMaximus
// @match        https://*/geofs.php*
// @icon         https://github.com/scitor/GeoFS/raw/master/fms/logo.png
// @downloadURL  https://github.com/scitor/GeoFS/raw/master/fms/geofs-fms.user.js
// @grant        none
// ==/UserScript==

const USE_SOUNDS = true;

(function init() {
    'use strict';

    if (!window.jQuery)
        return setTimeout(init, 1000);

    let playedOffline = true;
    let playedOnline = false;
    geofs.fms = geofs.fms || {};
    geofs.fms.loopTrack = false;
    geofs.fms.interval = setInterval(() => {
        if (!geofs || !geofs.api || !geofs.api.map || !geofs.api.map.flightPath || !geofs.autopilot.on) {
            return;
        }
        handleFlightpathMarkers();
        const nextWP = getNextWaypoint();
        if (!nextWP)
            return;

        const nextWpLatLng = [nextWP._latlng.lat,nextWP._latlng.lng];
        if (!nextWP._gpsFix) {
            nextWP._gpsFix = getGpsFix(nextWpLatLng, nextWP._name);
        }

        if (geofs.autopilot.mode!='NAV') {
            if (!playedOffline) {
                beep(10,[[660,50],[480,100]]);
                playedOffline = true;
                playedOnline = false;
            }
            return;
        }

        if (!playedOnline) {
            beep(10,[[480,50],[660,100]]);
            playedOnline = true;
        }
        playedOffline = false;
        const coords = geofs.aircraft.instance.getCurrentCoordinates();
        const dstToWaypoint = geofs.utils.distanceBetweenLocations(coords, nextWpLatLng);
        let turnDist = Math.pow(geofs.aircraft.instance.trueAirSpeed, 2) / (11.26*Math.tan((30 * Math.PI) / 180));
        let newWP = getNextWaypoint(1);
        if (newWP) {
            const curBrg = geofs.nav.currentNAVUnit.course;
            const newBrg = geofs.utils.bearingBetweenLocations(nextWpLatLng, [newWP._latlng.lat,newWP._latlng.lng]);
            turnDist *= Math.max(30, Math.abs((Math.abs(newBrg-curBrg)+180)%360-180)) / 90;
        }
        if (dstToWaypoint > turnDist)
            return;

        nextWP._visited = true;
        if (!newWP) {
            if (nextWP._gpsFix.type == 'ILS') {
                beep(10,[[660,200]]);
                return;
            }
            if (geofs.fms.loopTrack) {
                geofs.api.map.flightPath._lineMarkers.forEach(c => delete c._visited);
                newWP = getNextWaypoint();
            } else {
                geofs.autopilot.setMode('HDG');
                return;
            }
        }
        const newWpLatLng = [newWP._latlng.lat,newWP._latlng.lng];
        if (newWP._gpsFix)
            geofs.nav.removeNavaid(newWP._gpsFix.id);

        newWP._gpsFix = getGpsFix(newWpLatLng, newWP._name);
        geofs.nav.selectNavaid(newWP._gpsFix.id);
        if (geofs.utils.distanceBetweenLocations(newWpLatLng, nextWpLatLng) > turnDist)
            geofs.nav.setOBS('GPS', Math.round(geofs.utils.bearingBetweenLocations(nextWpLatLng, newWpLatLng)), 0, true);

        geofs.autopilot.setMode('NAV');
    }, 1000);

    function getGpsFix(latLng, name) {
        return getClosestNavaid(latLng) || geofs.nav.addNavaid(geofs.nav.generateGPSFIXNavaid(latLng,null,name));
    }

    function getNextWaypoint(skip=0) {
        return geofs.api.map.flightPath._lineMarkers.find(c => !c._visited && !(skip--));
    }

    function handleFlightpathMarkers() {
        let active = true;
        geofs.api.map.flightPath._lineMarkers.forEach((m,i) => {
            m._icon.style.backgroundColor = m._visited ? 'grey' :
                (active && Math.floor(new Date()/1000)%2 ? 'red' : 'white');

            if (m._gpsFix && m._gpsFix.type=='FIX') {
                if (m._visited || !active) {
                    geofs.nav.removeNavaid(m._gpsFix.id);
                    delete m._gpsFix;
                }
            }
            if (!m._visited && active)
                active = false;
        });
    }

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
            json[3].forEach((c,i) => {
                if (c && c[1] && c[2] && geofs.api.map.flightPath._lineMarkers[i])
                    geofs.api.map.flightPath._lineMarkers[i]._name = c[0] + (c[5]&&c[5].length?' ('+c[5]+')':'');
            });
        }
    }
    function exportFmcRoute() {
        if (!geofs.api.map.flightPath) return;
        const jsonString = JSON.stringify(["","","",geofs.api.map.flightPath._latlngs.map((p,i) => ["WP"+i,p.lat,p.lng,null,false,null])],
            (key, value) => (typeof value === 'number') ? parseFloat(value.toFixed(6)) : value
        );
        navigator.clipboard.writeText(jsonString).then(() => {
            const oldVal = this.value;
            this.value = "copied...";
            setTimeout(()=>{this.value = oldVal}, 3000);
        });
    }
    const audioContext = AudioContext && new AudioContext();
    //amp:0..100, [[freq in Hz, ms],..] (https://stackoverflow.com/a/74914407)
    function beep(amp, seq) {
        if (!seq.length || !USE_SOUNDS)
            return;
        const el = seq.shift();
        if (el[0]) {
            const osc = audioContext.createOscillator();
            const gain = audioContext.createGain();
            osc.connect(gain);
            osc.frequency.value = el[0];
            gain.connect(audioContext.destination);
            gain.gain.value = amp/100;
            osc.start(audioContext.currentTime);
            osc.stop(audioContext.currentTime+el[1]/1000);
        }
        if (seq.length)
            setTimeout(()=>{beep(amp,seq)},el[1]);
    }
    setTimeout(() => {
        const importDiv = appendNewChild(document.querySelector('div.geofs-clearPath').parentNode,'div',{style:"position:absolute;top: 48px;left:55px;"});
        const importButton = appendNewChild(importDiv,'input',{type:"button", value:"FMC import", style:"width: 120px;border: 2px solid #bbb;"});
        appendNewChild(importDiv,'input',{type:'button', value:'FMC export', style:"width: 120px;border: 2px solid #bbb;"}).onclick = exportFmcRoute;
        let popup;
        importButton.onclick = e => {
            popup = window.open('about:blank', '_blank', 'popup=1,width=300,height=200');
            popup.document.head.appendChild(createTag('title',{},'GeoFS - FMC import'));
            const fmcImportInput = appendNewChild(popup.document.body,'textarea',{style:"width: 100%;height:100%;border: 2px solid #bbb;"});
            fmcImportInput.onkeyup = e => {
                try{
                    importFmcRoute(JSON.parse(fmcImportInput.value));
                    fmcImportInput.value='';
                    popup.close();
                } catch (error) {
                    popup.document.head.title = 'Error: '+error.message;
                }
            };
        };
    }, 1000);

    function createTag(e,t={},n){const r=document.createElement(e);return Object.keys(t).forEach(e=>r.setAttribute(e,t[e])),n&&(r.innerHTML=n),r}
    function appendNewChild(e,t,n={},r=-1){n=createTag(t,n);return r<0?e.appendChild(n):e.insertBefore(n,e.children[r]),n}
})();