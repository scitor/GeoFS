// ==UserScript==
// @name         GeoFS UI tweaks
// @version      1.0.1
// @description  Adds various tweaks to the GeoFS UI
// @author       TurboMaximus
// @match        https://www.geo-fs.com/geofs.php
// @icon         https://www.geo-fs.com/favicon.ico
// @downloadURL  https://raw.githubusercontent.com/scitor/GeoFS/master/uiTweaks/geofs-ui-tweaks.user.js
// @run-at       document-end
// @grant        none
// ==/UserScript==

const MOUSEWHEEL_TWEAKS = true; // adds ability to change autopilot values (IAS,HDG,Alt,etc) with the mousewheel
const POPOUT_CHAT = true; // adds ability to popout chat into new window

(function init() {
    'use strict';

    if (!window.jQuery)
        return setTimeout(init, 1000);

    if (MOUSEWHEEL_TWEAKS) {
        document.querySelector('input.geofs-autopilot-speed').onwheel = (event) =>
            geofs.autopilot.setSpeed(parseInt(event.target.value) + event.deltaY/(event.shiftKey ? -100 : -10));
        document.querySelector('input.geofs-autopilot-course').onwheel = (event) =>
            geofs.autopilot.setCourse(parseInt(event.target.value) + event.deltaY/(event.shiftKey ? -100 : -10));
        document.querySelector('input.geofs-autopilot-altitude').onwheel = (event) =>
            geofs.autopilot.setAltitude(parseInt(event.target.value) + event.deltaY/(event.shiftKey ? -10 : -1));
        document.querySelector('input.geofs-autopilot-verticalSpeed').onwheel = (event) =>
            geofs.autopilot.setVerticalSpeed(parseInt(event.target.value) + event.deltaY/(event.shiftKey ? -10 : -1));
    }

    if (POPOUT_CHAT) {
        const popoutChatBtn = $('<button class="mdl-button mdl-js-button mdl-button--icon" tabindex="0"><i class="material-icons">text_fields</i></button>')[0];
        document.querySelectorAll('.geofs-button-mute').forEach(m=>m.parentNode.appendChild(popoutChatBtn));
        let popoutChatWindow, chatParentDiv, chatDiv;
        popoutChatBtn.onclick = function() {
            chatDiv = document.querySelector('.geofs-chat-messages');
            chatParentDiv = chatDiv.parentNode;
            popoutChatWindow = window.open('about:blank',  '_blank', 'height=580, width=680, popup=1');
            popoutChatWindow.document.body.append(chatDiv);
            popoutChatWindow.document.head.append($('<title>GeoFS - Chat</title>')[0]);
            popoutChatWindow.document.head.append($('<style>.geofs-chat-message{opacity:1!important;font-family:sans-serif;}</style>')[0]);
            popoutChatWindow.onbeforeunload = () => chatParentDiv.append(chatDiv);
        };
        window.onbeforeunload = () => popoutChatWindow.close();
    }
})();