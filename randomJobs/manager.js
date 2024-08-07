'use strict';

/**
* @typedef {Object} JobObj
* @property {number} id
* @property {string} orgn origin ICAO
* @property {string} dest destination ICAO
* @property {string} flightno number
* @property {string} airline ICAO
* @property {boolean} regional
* @property {number} dist geo distance
* @property {number} worth estimated insurance basis (wip)
*/
let JobObj;

/**
 * @param {Object} aList
 * @param {Object} aIndex
 * @param {string} version
 * @constructor
 */
function RandomJobsMod(aList, aIndex, version) {
    this.version = version;
    this.aList = aList;
    this.aIndex = aIndex;

    this.last = {icao:'',time:0};
    this.airport = {
        icao: undefined,
        major: undefined,
        nearby: {},
        jobs: [],
        max: [0,0],
    };

    /** @type {MainWindow} */
    this.window = null;
    this.store = new ObjectStore('RJFlightV1');
    this.archive = new IndexedDB({
        key: 'RJFlightV1',
        stores: {
            flights: {keyPath: 'id'},
            tapes: {keyPath: 'id'},
            routes: {keyPath: 'id'}
        }
    });
    this.aHandler = new AirportHandler(this);
    this.flight = new FlightHandler(this);
    this.generator = new JobGenerator(this);

    this.rng = mulberry32((new Date()).getHours());
}
RandomJobsMod.prototype.init = function(ready) {
    if (!Object.keys(aList[0]).length) {
        ['major','minor'].forEach(s => Object.values(geofs.api.map.markerLayers[s].tiles).forEach(row => {
            row.forEach(m => {
                if (m && m.runway)
                    add2AList(m.runway);
            });
        }));
    }
    this.aList.forEach((sList, s) => Object.keys(sList).forEach(icao => this.aIndex[s].addPoint(icao, ...sList[icao])));
    $.getJSON(`${githubRepo}/icaos.json?${now()}`, json => {
        json.forEach(e => aList.push(e));
        this.aHandler.init();
        setInterval(() => this.update(), 1000);
        ready();
    });
};
RandomJobsMod.prototype.update = function() {
    if (flight.recorder.playing || geofs.isPaused()) return;
    this.updateCurrentAirport();
    this.flight.update();
    this.window && this.window.update();
};

RandomJobsMod.prototype.updateCurrentAirport = function() {
    const coords = geofs.aircraft.instance.getCurrentCoordinates();
    const [icao, major] = this.aHandler.getAirportNearby(coords);
    if (icao === this.last.icao && now() < this.last.time+60)
        return;

    this.airport.icao = icao;
    this.airport.major = major;
    if (icao) {
        this.rng = mulberry32(this.aHandler.getIcaoId(icao)+(new Date()).getHours());
        //@todo config (min/max job generation)
        this.airport.max = [30, 70].map(i=>Math.round(this.rng(i,5)));
    } else {
        this.airport.nearby = {};
        this.airport.jobs = [];
    }
    if ((icao !== this.last.icao) && this.window)
        this.window.reloadJobsList();
    this.last.icao = icao;
    this.last.time = now();
};

RandomJobsMod.prototype.getIcao = function() {
    return this.airport.icao;
};

RandomJobsMod.prototype.removeHistoryEntry = function(id) {
    this.archive.del('flights', id);
    this.archive.del('tapes', id);
    this.archive.del('routes', id);
};

RandomJobsMod.prototype.getHistory = function() {
    return this.archive.promiseGetAll('flights');
};

RandomJobsMod.prototype.getJobsList = function() {
    return [...this.airport.jobs];
};
RandomJobsMod.prototype.sortJobsList = function(sortFn) {
    this.airport.jobs.sort(sortFn);
};

RandomJobsMod.prototype.generateJob = function() {
    const flight = this.flight.getCurrent();
    if (!this.airport.icao || flight && flight.status == STATUS.AIRBORNE)
        return;

    return this.generator.generateJob();
};

RandomJobsMod.prototype.generateFlightPlan = function(orgn, dest) {
    const navs = [];
    const orgnC = this.aHandler.getAirportCoords(orgn);
    const destC = this.aHandler.getAirportCoords(dest);
    const dist = this.aIndex[0].dist;
    const distTotal = dist(...orgnC, ...destC);
    const midC = [(orgnC[0] + destC[0])/2, (orgnC[1] + destC[1])/2];
    Object.keys(geofs.nav.fixes).forEach(fixKey => geofs.nav.fixes[fixKey].forEach(fix => {
        const distMid = dist(...midC, ...fix);
        if (distMid < distTotal/3) {
            const distOrgn = dist(...orgnC, ...fix);
            const distDest = dist(...destC, ...fix);
            navs.push([...fix, fixKey, distOrgn, distMid, distDest]);
        }
    }));
    const waypoints = [{ ident:orgn, lat:orgnC[0], lon:orgnC[1] }];
    const navOrgn = navs.sort((a,b) => a[3] - b[3])[0];
    if (navOrgn) {
        waypoints.push({ ident:navOrgn[2], lat:navOrgn[0], lon:navOrgn[1]});
    }
    if (distTotal > 500e3 && distTotal < 1000e3) {
        const navMid = navs.sort((a,b) => a[4] - b[4])[0];
        if (navMid && !waypoints.find(w=>w.ident==navMid[2]))
            waypoints.push({ ident:navMid[2], lat:navMid[0], lon:navMid[1]});
    }
    const navDest = navs.sort((a,b) => a[5] - b[5])[0];
    if (navDest && !waypoints.find(w=>w.ident==navDest[2])) {
        waypoints.push({ ident:navDest[2], lat:navDest[0], lon:navDest[1]});
    }
    if (waypoints.length == 1) {
        waypoints.push({ ident:'FIX', lat:midC[0], lon:midC[1]});
    }
    waypoints.push({ ident:dest, lat:destC[0], lon:destC[1] });
    geofs.flightPlan.clear();
    geofs.flightPlan.trackedWaypoint = undefined;
    geofs.flightPlan.waypointArray.forEach(a => a.navaid && a.navaid.fromFlightPlan && geofs.nav.removeNavaid(a.navaid.id));
    geofs.flightPlan.waypointArray = waypoints.map(w => Object.assign({type:'fix',alt:'',spd:''},w)).map(w => {w.lat+=0.000001;w.lon+=0.000001;return w});
    geofs.flightPlan.refreshWaypoints();
    geofs.flightPlan.isOpen || geofs.flightPlan.toggle();

    return navs;
};