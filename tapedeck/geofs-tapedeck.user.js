// ==UserScript==
// @name         GeoFS Flight Recorder Tapedeck
// @version      1.0.2
// @description  Adds ability to load / save flight recorder "tapes"
// @author       TurboMaximus
// @match        https://www.geo-fs.com/geofs.php
// @icon         https://www.geo-fs.com/favicon.ico
// @downloadURL  https://github.com/scitor/GeoFS/raw/master/tapedeck/geofs-tapedeck.user.js
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function init() {
    'use strict';

    if (!window.jQuery) {
        return setTimeout(init, 1000);
    }

    document.querySelector('.geofs-f-recordPlayer.geofs-slider-container').style.left = '420px';
    const btnBox = document.querySelector('.geofs-f-recordPlayer > .geofs-ui-bottom-box');
    const tapeSaveBtn = appendNewChild(btnBox, 'button', {
        class: 'mdl-button mdl-js-button mdl-button--icon',
        title: 'Save current Flight Recorder Tape'
    });
    tapeSaveBtn.innerHTML = '<i class="material-icons">download</i>';
    tapeSaveBtn.onclick = () => {
        if (!flight.recorder.tape.length) {
            return;
        }
        const jsonString = JSON.stringify(
            compressTape([...flight.recorder.tape]),
            (key, value) => (typeof value === 'number') ? parseFloat(value.toFixed(6)) : value
        );
        const dataJson = 'data:text/json;charset=utf-8,' + encodeURIComponent(jsonString);
        createTag('a', {href: dataJson, download: 'GeoFS-tape-' + Math.round(new Date() / 1000) + '.json'}).click();
    };

    const tapeLoadBtn = appendNewChild(btnBox, 'button', {
        class: 'mdl-button mdl-js-button mdl-button--icon',
        title: 'Load Flight Recorder Tape'
    });
    tapeLoadBtn.innerHTML = '<i class="material-icons">upload</i>';
    tapeLoadBtn.onclick = () => {
        const input = createTag('input', {type: 'file'});
        input.onchange = () => loadTape(input);
        input.click();
    };

    function loadTape(fileInput) {
        const reader = new FileReader();
        reader.addEventListener('load', (event) => {
            try {
                flight.recorder.tape = decompressTape(JSON.parse(event.target.result));
                flight.recorder.enterPlayback();
            } catch (e) {
            }
        });
        fileInput.files.length && reader.readAsText(fileInput.files[0]);
    }

    const keys = ['time', 'coord', 'controls', 'state', 'velocities', 'accelerations'];

    function compressTape(tape) {
        return tape.map(i => {
            const v = keys.reduce((p, c) => {
                p.push(i[c]);
                return p;
            }, []);
            v[3][0] = v[3][0] ? 1 : 0;
            v[3][1] = v[3][1] ? 1 : 0;
            return v;
        });
    }

    function decompressTape(json) {
        return json.map(i => {
            i[3][0] = i[3][0] == '1';
            i[3][1] = i[3][1] == '1';
            return keys.reduce((p, c) => {
                p[c] = i.shift();
                return p;
            }, {});
        });
    }

    function createTag(e,t={}){const n=document.createElement(e);return Object.keys(t).forEach(e=>n.setAttribute(e,t[e])),n}
    function appendNewChild(e,t,n={},r=-1){n=createTag(t,n);return r<0?e.appendChild(n):e.insertBefore(n,e.children[r]),n}

})();