'use strict';

/**
 * @param {JobsManager} jobsManager
 * @constructor
 */
function AirportHandler (jobsManager) {
    this.jobMngr = jobsManager;
    this.aIndex = jobsManager.aIndex;
    this.aList = jobsManager.aList;
    this.nearbyCache = {};
    this.aInfo = {};
}

AirportHandler.prototype.init = function() {
    const aList = this.aList[3];
    aList.forEach((entry,id) => {
        const [icao,iata,name] = entry.split('|');
        this.aInfo[icao] = {id,iata,icao,name};
    });
};

AirportHandler.prototype.hasAIcon = function(icao) {
    return this.aList[7][icao[0]] && this.aList[7][icao[0]][icao[1]] && this.aList[7][icao[0]][icao[1]][icao[2]];
};
AirportHandler.prototype.getAInfo = function(icao) {
    if (icao.length == 1)
        return {icao, iata:icao, name:this.getRegionalsName(icao)};

    return this.aInfo[icao];
};
AirportHandler.prototype.getIATAInfo = function(iata) {
    if (iata.length == 1)
        return {icao:iata, iata, name:this.getRegionalsName(iata)};

    return Object.values(this.aInfo).find(a => a.iata == iata);
};
AirportHandler.prototype.getIcaoId = function(icao) {
    if (!icao || !icao.length) return 0;
    const idx = this.aList[2].indexOf(icao);
    if (idx == -1) {
        this.aList[2].push(icao);
        return this.aList[2].length-1;
    }
    return idx;
};
AirportHandler.prototype.getListStr = function(id) {
    if (id===0) return '';
    return this.aList[5][id];
};
AirportHandler.prototype.updateCurrentAirport = function(coords) {
    const nearby = [0, 1].map(s => this.aIndex[s].nearby([coords[0], coords[1]], 5e3)[0]);
    if (nearby[0] && nearby[1]) {
        const nearbyCoords = nearby.map((icao,s) => this.aList[s][icao]);
        if (this.aIndex[0].dist(...coords,...nearbyCoords[0]) < this.aIndex[1].dist(...coords,...nearbyCoords[1])) {
            return [nearby[0], 0];
        }
        return [nearby[1], 1];
    } else if (nearby[0]) {
        return [nearby[0], 0];
    } else if (nearby[1]) {
        return [nearby[1], 1];
    }
    return [null,null];
};
AirportHandler.prototype.getNearbyAirports = function(coords, dist) {
    if (this.nearbyCache[dist] === undefined) {
        this.nearbyCache[dist] = [0, 1].map(s => this.aIndex[s].nearby([coords[0], coords[1]], dist));
    }
    return this.nearbyCache[dist];
};

AirportHandler.prototype.fetchAirportWeather = function(icao, callback) {
    if (window.METAR!==undefined) callback(window.METAR[icao]);
    else callback();
};

AirportHandler.prototype.getAirportDist = function(from, dest) {
    try {
        return this.aIndex[0].dist(...this.getAirportCoords(from),...this.getAirportCoords(dest));
    } catch (e) {
        console.log(from,dest,e);
        return 0;
    }
};
AirportHandler.prototype.getAirportCoords = function(icao) {
    if (this.aList[0][icao])
        return [this.aList[0][icao][0], this.aList[0][icao][1]];
    if (this.aList[1][icao])
        return [this.aList[1][icao][0], this.aList[1][icao][1]];
};
AirportHandler.prototype.getAirportName = function(icao) {
    if (this.aList[0][icao])
        return this.aList[0][icao][2];
    if (this.aList[1][icao])
        return this.aList[1][icao][2];
};
AirportHandler.prototype.getAirportInfo = function(icao) {
    const empty = {elevation: '', iata: '', country: '', state: '', city: '', name: '', tz: ''};
    const idx = this.aList[2].indexOf(icao);
    if (idx == -1 || !this.aList[6][idx]) {
        return empty;
    }
    return ['elevation','iata','country','state','city','name','tz'].reduce((p,c,i) => {
        if (c=='elevation')
            p[c] = this.aList[6][idx][i];
        else
            p[c] = this.getListStr(this.aList[6][idx][i]);
        return p;
    }, empty);
};

AirportHandler.prototype.getRegionalsName = function(char) {
    const regionalsNames = { // fictional regional names (by ChatGPT)
        A: 'Aerofleet Airways', B: 'BlueWave Airlines', C: 'Cloudline Aviation', D: 'DreamSky Airlines', E: 'Eclipse Air',
        F: 'Freedom Flyers', G: 'Galaxy Wings', H: 'Horizon Vista Airways', I: 'Infinity Airlines', J: 'Jetstream Airways',
        K: 'Keystone Airlines', L: 'Luminary Airlines', M: 'Meridian Air', N: 'Northern Lights Air', O: 'Odyssey Air',
        P: 'Phoenix Wings', Q: 'Quantum Air', R: 'Radiant Airlines', S: 'SkyBound Airlines', T: 'TranquilAirways',
        U: 'Uplift Airlines', V: 'Vortex Skyways', W: 'Windward Jet', X: 'Xenon Air', Y: 'Yonder Airways',
        Z: 'Zenith Sky'
    };
    return regionalsNames[char.toLocaleUpperCase()];
};