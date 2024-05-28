'use strict';

const aList = [{}, {}];
const aIndex = aList.map(sList => new Index(sList));

// stolen from https://github.com/fboes/metar-parser/blob/main/lib/convert.js
const convert = {
    celsiusToFahrenheit: c => c * 1.8 + 32,
    feetToMeters: ft => ft * 0.3048,
    milesToMeters: mi => mi * 1609.344,
    metersToMiles: m => m / 1609.344,
    kmToNm: km => km / 1.852,
    nmToKm: nm => nm * 1.852,
    inhgToKpa: inHg => inHg / 0.29529988,
    kpaToInhg: kpa => kpa * 0.29529988,
    kphToMps: kph => kph / 3600 * 1000,
    mpsToKts: mps => mps * 1.9438445,
    ktsToMps: kts => kts / 1.9438445
};

/**
 * Create tag with <name attributes=...
 *
 * @param {string} name
 * @param {Object} attributes
 * @param {string|number} content
 * @returns {HTMLElement}
 */
function createTag(name, attributes = {}, content = '') {
    /**
     * @suppress {checkTypes} HTMLElement™
     * @type {HTMLElement}
     */
    const el = document.createElement(name);
    Object.keys(attributes||{}).forEach(k => el.setAttribute(k, attributes[k]));
    if ((''+content).length) {
        el.innerHTML = content;
    }
    return el;
}
/**
 * Creates a new element <tagName attributes=...
 * appends to parent and returns the child for later access
 *
 * @param {HTMLElement} parent
 * @param {string} tagName
 * @param {Object} attributes
 * @param {number} pos insert in Nth position (default append)
 * @returns {HTMLElement}
 */
function appendNewChild(parent, tagName, attributes = {}, pos = -1) {
    const child = createTag(tagName, attributes);
    if (pos < 0) {
        parent.appendChild(child);
    } else {
        parent.insertBefore(child, parent.children[pos]);
    }
    return child;
}
/**
 * Mulberry32 - Random Number Generator
 *
 * A simple generator with a 32-bit state, but is extremely fast and has good quality (author states it passes all tests of gjrand testing suite and has a full 232 period, but I haven't verified).
 *
 * @link https://stackoverflow.com/a/47593316
 *
 * @param {number} seed
 * @returns {function(number=,number=):number}
 */
function mulberry32(seed) {
    return function(range = 1, offset = 0) {
      let t = seed += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return (((t ^ t >>> 14) >>> 0) / 4294967296) * range + offset;
    }
}
function now() {
    return Math.floor(new Date()/1000);
}
function zeroPad(int) {
    return ('0'+int).slice(-2);
}
function humanTime(date) {
    return [zeroPad(date.getHours()),zeroPad(date.getMinutes())].join(':');
}

function keyMap(array) {
    return array.reduce((p, c) => (p[c] = true, p), {});
}

function diffDate(date1, date2, cont=false) {
    if (cont && date2 < date1) {
      date2.setDate(date2.getDate() + 1);
    }
    return Math.round((date2 - date1)/1000);
}
function diffTime(time1, time2, cont=false) {
    const date1 = new Date();
    date1.setHours(...time1.split(':'));
    const date2 = new Date();
    date2.setHours(...time2.split(':'));
    return diffDate(date1, date2, cont);
}

/**
 * @param {Object} aList
 * @constructor
 */
function Index(aList) {
    this.index = new Map();
    this.aList = aList;
    this.int = (f) => parseInt(Math.floor(f), 10);
}

Index.prototype.addPoint = function (name, lat, lng) {
    const iLat = this.int(lat);
    let iLng = this.int(lng);
    if (iLng < -180) {
        iLng += 360;
    } else if (iLng > 180) {
        iLng -= 360;
    }
    if (!this.index.has(iLat)) {
        this.index.set(iLat, new Map());
    }
    if (!this.index.get(iLat).has(iLng)) {
        this.index.get(iLat).set(iLng, new Set());
    }

    this.index.get(iLat).get(iLng).add(name);
};
Index.prototype.nearbyIcao = function (icao, dist) {
    const coords = this.aList[icao];
    return this.nearby(coords, dist);
};
Index.prototype.nearby = function (coords, dist) {
    if (!coords) {
        return [];
    }
    const dDist = dist * (360 / 40e6);
    const bndCoords = [
        [this.int(coords[0] - dDist), this.int(coords[0] + dDist)],
        [this.int(coords[1] - dDist), this.int(coords[1] + dDist)]
    ];
    let grid = new Set();
    for (let iLat = bndCoords[0][0]; iLat <= bndCoords[0][1]; iLat++) {
        for (let iLng = bndCoords[1][0]; iLng <= bndCoords[1][1]; iLng++) {
            let lLng = iLng;
            if (iLng < -180) {
                lLng += 360;
            } else if (iLng > 180) {
                lLng -= 360;
            }
            if (this.index.has(iLat) && this.index.get(iLat).has(lLng)) {
                grid = grid.union(this.index.get(iLat).get(lLng));
            }
        }
    }
    return [...grid].filter(g => this.dist(...coords, ...this.aList[g]) <= dist)
        .sort((a, b) => this.distSq(...coords, ...this.aList[a]) - this.distSq(...coords, ...this.aList[b]));
};
Index.prototype.distSq = function (lat1, lng1, lat2, lng2) {
    const a = lat2 - lat1;
    const b = lng2 - lng1;
    return a * a + b * b;
};
Index.prototype.dist = function (lat1, lng1, lat2, lng2) {
    return geofs.api.map._map.distance({lat: lat1, lng: lng1}, {lat: lat2, lng: lng2});
};

// stolen from https://gist.github.com/samsonjs/716858
const _ObjectStore = {};
/**
 * @param {string} table
 * @constructor
 */
function ObjectStore(table) {
    if (localStorage === undefined)
        localStorage = { setItem:(key, val) => {}, getItem:(key) => {} };

    const jsonString = localStorage.getItem(table);
    if (jsonString !== undefined) {
        try {
            _ObjectStore[table] = JSON.parse(jsonString||'');
        } catch (e) {}
    }
    if (!_ObjectStore[table])
        _ObjectStore[table] = {};

    const object = _ObjectStore[table];

    /**
     * @param {string} key
     * @returns {boolean}
     */
    this.has = key => object[key] !== undefined;

    /**
     * @param {string} key
     * @returns {Object|null}
     */
    this.get = key => object[key];

    /**
     * Sync storage
     */
    this.sync = () => localStorage.setItem(table, JSON.stringify(object));

    /**
     * @param {string} key
     * @param {Object|null} val
     */
    this.set = (key, val) => {
        object[key] = val;
        this.sync();
    };

    /**
     * @param {string} key
     */
    this.del = key => {
        delete object[key];
        this.sync();
    };
}