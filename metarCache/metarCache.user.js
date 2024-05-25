// ==UserScript==
// @name         GeoFS MetarCache (addon mod)
// @version      1.0
// @description  Doesn't do anything by itself, adds METAR cache from aviationweather.gov to the current window instance.
// @author       TurboMaximus
// @match        https://*/geofs.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=aviationweather.gov
// @downloadURL  https://github.com/scitor/GeoFS/raw/master/metarCache/metarCache.user.js
// @grant        GM_xmlhttpRequest
// @connect      aviationweather.gov
// ==/UserScript==

const interval = 60 * 5;
const METAR = {};
(function() {
    'use strict';
    setInterval(getMetar, interval * 1e3);
    unsafeWindow.METAR = METAR;
    getMetar();
})();
function getMetar() {
    GM_xmlhttpRequest({
        method: "GET",
        url: "https://aviationweather.gov/data/cache/metars.cache.xml",
        onload: cacheMetars
    });
}
function cacheMetars (response) {
    const METARs = response.responseXML.querySelectorAll('METAR');
    METARs.forEach(tag => {
        const icao = getValue(tag, 'station_id');
        const sky = tag.querySelector('sky_condition');
        METAR[icao] = {
            METAR: getValue(tag, 'raw_text'),
            timestamp: getValue(tag, 'observation_time'),
            temp: getValue(tag, 'temp_c'),
            dewpoint: getValue(tag, 'dewpoint_c'),
            windDir: getValue(tag, 'wind_dir_degrees'),
            windSpd: getValue(tag, 'wind_speed_kt'),
            visMil: getValue(tag, 'visibility_statute_mi'),
            altimHg: getValue(tag, 'altim_in_hg'),
            pressMb: getValue(tag, 'sea_level_pressure_mb'),
            skyCov: getValue(sky, 'sky_cover', true),
            skyBse: getValue(sky, 'cloud_base_ft_agl', true),
            fltCat: getValue(tag, 'flight_category'),
            metarType: getValue(tag, 'metar_type'),
            elevation: getValue(tag, 'elevation_m')
        };
    });
}
function getValue(tag, key, attr=false) {
    if (!tag) return;
    if (attr)
        return tag.getAttribute(key);

    const dom = tag.querySelector(key);
    if (dom)
        return dom.innerHTML;
}