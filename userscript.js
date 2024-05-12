// ==UserScript==
// @name         GeoFMS - FMS for GeoFS
// @version      v0.4 alpha
// @description  Flight management system for GeoFS
// @author       TurboMaximus
// @icon         https://www.geo-fs.com/favicon.ico
// @match        https://www.geo-fs.com/geofs.php
// @downloadURL  https://raw.githubusercontent.com/scitor/GeoFMS/master/userscript.js
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    geofs.fms = geofs.fms || {};
    geofs.fms.loopTrack = false;
    geofs.fms.interval = setInterval(() => {
        if (!geofs.api.map.flightPath || !geofs.autopilot.on) {
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

        if (geofs.autopilot.mode!='NAV')
            return;

        const coords = geofs.aircraft.instance.getCurrentCoordinates();
        const dstToWaypoint = geofs.utils.distanceBetweenLocations(coords, nextWpLatLng);
        // random magic number, works for now overshoots alot tho
        const turnDist = Math.pow(geofs.aircraft.instance.trueAirSpeed,2) / (11.26*Math.tan((30 * Math.PI) / 180));
        if (dstToWaypoint > turnDist)
            return;

        nextWP._visited = true;
        let newWP = getNextWaypoint();
        if (!newWP) {

            console.log(nextWP);
            if (nextWP._gpsFix.type == 'ILS') {
                beep(10,660,200);
                return;
            }
            if (geofs.fms.loopTrack) {
                geofs.api.map.flightPath._lineMarkers.forEach(c => delete c._visited);
                newWP = getNextWaypoint()
            } else if (nextWP.type != 'ILS') {
                beep(10,660,50);
                setTimeout(()=>{beep(10,480,50)},50);
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

    function getNextWaypoint() {
        return geofs.api.map.flightPath._lineMarkers.find(c => !c._visited);
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
                } else {

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
    const audioContext = AudioContext && new AudioContext();
    function beep(amp, freq, ms){ //amp:0..100, freq in Hz, ms (https://stackoverflow.com/a/74914407)
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
    const speechSynth = new SpeechSynthesisUtterance();
    function say(text) {
        speechSynth.text = text;
        window.speechSynthesis.speak(msg);
    }
    setTimeout(() => {
        const importButton = $('<input type="button" value="FMC import" style="width: 120px;border: 2px solid #bbb;">');
        let popup;
        importButton.on('click', (e) => {
            popup = window.open('about:blank',  '_blank', 'popup=1,width=300,height=200');
            const fmcImportInput = $('<textarea style="width: 100%;height:100%;border: 2px solid #bbb;"></textarea>');
            popup.document.body.appendChild(fmcImportInput[0]);
            popup.document.head.appendChild($('<title>GeoFS - FMC import</title>')[0]);
            fmcImportInput.on('change keyup', (e) => {
                try{
                    importFmcRoute(JSON.parse(fmcImportInput.val()));
                    fmcImportInput.val('');
                    popup.close();
                } catch (error) {
                    popup.document.head.title = 'Error: '+error.message;
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
        document.querySelectorAll('.geofs-button-mute')[1].parentNode.appendChild(
            $('<button class="mdl-button mdl-js-button mdl-button--icon" onclick="geofs.fms.popupChat()" tabindex="0"><i class="material-icons">text_fields</i></button>')[0]
        );
        //window.open('about:blank',  '_blank', 'height=580, width=680, popup=1').document.body.append(document.querySelector('.geofs-chat-messages'))
    }, 1000);
    geofs.fms.popupChat = function() {
        const win = window.open('about:blank',  '_blank', 'height=580, width=680, popup=1');
        win.document.body.append(document.querySelector('.geofs-chat-messages'));
        win.document.head.append($('<style>.geofs-chat-message{opacity:1!important;font-family:sans-serif;}</style>')[0]);
    };
})();