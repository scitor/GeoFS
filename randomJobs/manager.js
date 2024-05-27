'use strict';

/**
* @typedef {Object} JobObj
* @property {number} id
* @property {string} dept departure ICAO
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
function JobsManager(aList, aIndex, version) {
    this.version = version;
    this.aList = aList;
    this.aIndex = aIndex;

    /** @type {JobsWindow} */
    this.window = null;
    this.store = new ObjectStore('randomJobsV1');
    this.aHandler = new AirportHandler(this);
    this.flight = new FlightHandler(this);

    this.currentAirport = null;
    this.currentAirportMajor = null;
    this.currentAirportJobs = [];
    this.currentAirportMaxJobs = [5,5];

    this.rng = mulberry32((new Date()).getHours());
}
JobsManager.prototype.init = function(getCustomData, ready) {
    /*if (typeof getCustomData === 'function') {
        let customData;
        try {
            importCustomData(getCustomData());
        } catch (e) {
            alert('Custom Data import failed, please check the format!\n'+e.message);
        }
    }*/
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
JobsManager.prototype.update = function() {
    this.flight.update();
    const coords = geofs.aircraft.instance.getCurrentCoordinates();
    const [icao, major] = this.aHandler.updateCurrentAirport(coords);
    if (icao == this._lastUpdateIcao && now()<this._lastUpdateTime+10)
        return;

    this.currentAirport = icao;
    this.currentAirportMajor = major;
    if (icao) {
        this.rng = mulberry32(this.aHandler.getIcaoId(icao)+(new Date()).getHours());
        this.currentAirportMaxJobs = [30,70].map(i=>Math.round(this.rng(i,5)));
    } else {
        this.aHandler.nearbyCache = {};
        this.currentAirportJobs = [];
    }
    this.updateJobsList();
    this._lastUpdateIcao = icao;
    this._lastUpdateTime = now();
};

JobsManager.prototype.updateJobsList = function() {
    this.window.jobsPage.reloadList();
};

JobsManager.prototype.chance = function(percent) {
    return this.rng() < (percent > 1 ? percent/100 : percent);
};
JobsManager.prototype.randomEl = function (array) {
    return array[Math.floor(this.rng() * array.length)];
};
JobsManager.prototype.rngWorth = function(dist, rand, min) {
    return Math.round(this.rng(rand, min) * dist/100);
};
JobsManager.prototype.hasJob = function(dept, dest, airline) {
    return this.currentAirportJobs.find(job => job.dept == dept && job.dest == dest && job.airline == airline);
};
/**
 * @param {string} dept
 * @param {string} dest
 * @param {string} airline
 * @returns {JobObj}
 */
JobsManager.prototype.getJobObj = function(dept, dest, airline=undefined) {

    let flightno, regional = true;
    if (airline) {
        const aInfo = this.aHandler.getAInfo(airline);
        regional = false;
        flightno = (aInfo.iata||aInfo.icao)+Math.round(100+Math.sqrt(this.rng(1e6)));
    } else {
        airline = String.fromCharCode(Math.round(this.rng(25,65)));
        flightno = airline+'-'+Math.round(Math.sqrt(this.rng(1e4)));
    }
    return {dept, dest, flightno, airline, regional,
        dist: this.aHandler.getAirportDist(dept, dest),
    };
};
JobsManager.prototype.getJobsList = function() {
    return [...this.currentAirportJobs];
};
JobsManager.prototype.sortJobsList = function(sortFn) {
    this.currentAirportJobs.sort(sortFn);
};
JobsManager.prototype.generateJob = function() {
    if (!this.currentAirport)
        return;

    const job = this.generateAirlineJob() || this.generateRegionalJob();
    if (job) {
        this.currentAirportJobs.push(job);
        return true;
    }
};
JobsManager.prototype.generateAirlineJob = function() {
    if (this.currentAirportJobs.filter(j=>!j.regional).length > this.currentAirportMaxJobs[0]) return;
    let job;
    const rList = this.aList[4][this.aList[2].indexOf(this.currentAirport)];
    if (!rList) return;
    Object.keys(rList).find(destId => {
        return rList[destId].find(aId => {
            if (!this.hasJob(this.currentAirport, this.aList[2][destId], this.aList[3][aId].split('|')[0])) {
                job = this.getJobObj(this.currentAirport, this.aList[2][destId], this.aList[3][aId].split('|')[0]);
                job.worth = this.rngWorth(job.dist, 2,4);
                return true;
            }
        });
    });
    return job;
};
JobsManager.prototype.generateRegionalJob = function() {
    if (this.currentAirportJobs.filter(j=>j.regional).length > this.currentAirportMaxJobs[1]) return;
    let job;
    const coords = geofs.aircraft.instance.getCurrentCoordinates();
    if (this.currentAirportMajor) {
        let dist = 100e3;
        for (let i = 0; i < 10; i++) {
            dist += i * 100e3;
            const targets = this.aHandler.getNearbyAirports(coords, convert.nmToKm(dist));
            const current = targets[1].indexOf(this.currentAirport);
            if (current > -1) targets[1].splice(current, 1);
            if (targets[1].length && this.chance(1/3)) {
                job = this.getJobObj(this.currentAirport, this.randomEl(targets[1]));
                job.worth = this.rngWorth(job.dist, 2,3);
            }
            if (!job && targets[0].length && this.chance(1/3)) {
                job = this.getJobObj(this.currentAirport, this.randomEl(targets[0]));
                job.worth = this.rngWorth(job.dist, 2,4);
            }
            if (job) {
                return job;
            }
        }
    } else {
        let dist = 100e3;
        for (let i = 0; i < 5; i++) {
            dist += i * 100e3;
            const targets = this.aHandler.getNearbyAirports(coords, convert.nmToKm(dist));
            const current = targets[0].indexOf(this.currentAirport);
            if (current > -1) targets[0].splice(current, 1);
            if (targets[0].length && this.chance(1/3)) {
                job = this.getJobObj(this.currentAirport, this.randomEl(targets[0]));
                job.worth = this.rngWorth(job.dist, 2,5);
            }
            if (!job && targets[1].length) {
                job = this.getJobObj(this.currentAirport, this.randomEl(targets[1]));
                job.worth = this.rngWorth(job.dist, 2,4);
            }
            if (job) {
                return job;
            }
        }
    }
};