'use strict';

const STATUS = {
    PLANING: 'planing',
    DEPARTURE: 'departure',
    AIRBORNE: 'airborne',
    ARRIVAL: 'arrival',
    ABORTED: 'aborted',
    FINISHED: 'finished'
};

/**
 * @param {JobsManager} jobsManager
 */
function FlightHandler (jobsManager) {
    this.jobMngr = jobsManager;
    this.store = jobsManager.store;
}

FlightHandler.prototype.clearCurrent = function() {
    return this.store.del('currentFlight');
};

/**
 * @returns {JobObj}
 */
FlightHandler.prototype.getCurrent = function() {
    return this.store.get('currentFlight');
};
/**
 * @param {JobObj} info
 */
FlightHandler.prototype.setCurrent = function(info) {
    const id = (icao) => this.jobMngr.aHandler.getIcaoId(icao);
    if (!info.id)
        info.id = id(info.dept)+''+id(info.dest)+''+now();

    return this.store.set('currentFlight', info);
};
