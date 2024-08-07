'use strict';

/**
 * @param {RandomJobsMod} mod
 * @constructor
 */
function JobGenerator (mod) {
    this.aHandler = mod.aHandler;
    this.aList = mod.aList;
    this.airport = mod.airport;
    
    this.rng = (range = 1, offset = 0) => mod.rng(range,offset);
}

JobGenerator.prototype.chance = function(percent) {
    return this.rng() < (percent > 1 ? percent/100 : percent);
};
JobGenerator.prototype.randomEl = function (array) {
    return array[Math.floor(this.rng() * array.length)];
};
JobGenerator.prototype.hasJob = function(orgn, dest, airline=null) {
    return this.airport.jobs.find(job => job.orgn == orgn && job.dest == dest && (!airline || job.airline == airline));
};
JobGenerator.prototype.generateJob = function() {
    const job = this.generateAirlineJob() || this.generateRegionalJob();
    if (job) {
        this.airport.jobs.push(job);
        return true;
    }
};
JobGenerator.prototype.generateAirlineJob = function() {
    if (this.airport.jobs.filter(j=>!j.regional).length > this.airport.max[0]) return;
    let job;
    const rList = this.aList[4][this.aList[2].indexOf(this.airport.icao)];
    if (!rList) return;
    Object.keys(rList).find(destId => {
        return rList[destId].find(aId => {
            const destIcao = this.aList[2][destId];
            const destKnown = this.aHandler.getAirportName(destIcao) != undefined;
            if (destKnown && !this.hasJob(this.airport.icao, destIcao, this.aList[3][aId].split('|')[0])) {
                job = this.createJobObj(this.airport.icao, destIcao, this.aList[3][aId].split('|')[0]);
                return true;
            }
        });
    });
    return job;
};
JobGenerator.prototype.generateRegionalJob = function() {
    if (this.airport.jobs.filter(j=>j.regional).length > this.airport.max[1]) return;
    let job;
    const coords = geofs.aircraft.instance.getCurrentCoordinates();
    const opts = (this.airport.major) ?
        {range:10, tries: [{major:1, chance:1/3}, {major:0, chance:1/3}]} :
        {range: 5, tries: [{major:0, chance:1/3}, {major:1, chance:1}]};

    let dist = 100e3;
    for (let i = 1; i <= opts.range; i++) {
        dist = i * 100e3;
        const nearby = this.aHandler.getNearbyAirports(coords, convert.nmToKm(dist));
        opts.tries.find(opt => {
            const current = nearby[opt.major].indexOf(this.airport.icao);
            if (current > -1)
                nearby[opt.major].splice(current, 1);

            if (nearby[opt.major].length && (opt.chance===1 || this.chance(opt.chance))) {
                const destIcao = this.randomEl(nearby[opt.major]);
                if (!this.hasJob(this.airport.icao, destIcao)) {
                    job = this.createJobObj(this.airport.icao, destIcao);
                    return true;
                }
            }
        });
        if (job) {
            return job;
        }
    }
};
/**
 * @param {string} orgn
 * @param {string} dest
 * @param {string} airline
 * @returns {JobObj}
 */
JobGenerator.prototype.createJobObj = function(orgn, dest, airline=undefined) {
    let flightno, regional = true;
    if (airline) {
        const aInfo = this.aHandler.getAInfo(airline);
        regional = false;
        flightno = (aInfo.iata||aInfo.icao)+Math.round(100+Math.sqrt(this.rng(1e6)));
    } else {
        airline = String.fromCharCode(Math.round(this.rng(25,65)));
        flightno = airline+'-'+Math.round(Math.sqrt(this.rng(1e4)));
    }
    const dist = this.aHandler.getAirportDist(orgn, dest);
    return {flightno, regional, dist, orgn, dest, airline};
};
