'use strict';

/**
 * @typedef {Object} STATUS
 */
const STATUS = {
    PLANING: 'planing',
    DEPARTURE: 'departure',
    ONGROUND: 'on ground',
    AIRBORNE: 'airborne',
    ARRIVAL: 'arrival',
    DIVERTED: 'diverted',
    CRASHED: 'crashed',
    ABORTED: 'aborted',
    FINISHED: 'finished'
};

/**
 * @param {JobsManager} jobsManager
 * @constructor
 */
function FlightHandler (jobsManager) {
    this.jobMngr = jobsManager;
    this.store = jobsManager.store;

    this.tracker = {
        airborneTime: 0,
        groundTime: 0
    };
}

/**
 * @returns {string}
 */
FlightHandler.prototype.getStatus = function() {
    return this.store.get('currentFlight')?.status;
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

    if (!info.status)
        info.status = STATUS.PLANING;

    return this.store.set('currentFlight', info);
};

FlightHandler.prototype.clearCurrent = function() {
    return this.store.del('currentFlight');
};

FlightHandler.prototype.sync = function() {
    this.store.sync();
};

FlightHandler.prototype.hasDeparture = function() {
    const flight = this.getCurrent();
    return flight && flight.dept && flight.dept.length;
};

FlightHandler.prototype.getDeparture = function() {
    const flight = this.getCurrent();
    return flight && flight.dept;
};

FlightHandler.prototype.hasDestination = function() {
    const flight = this.getCurrent();
    return flight && flight.dest && flight.dest.length;
};

FlightHandler.prototype.getDestination = function() {
    const flight = this.getCurrent();
    return flight && flight.dest;
};


FlightHandler.prototype.startFlight = function() {
    const flight = this.getCurrent();
    if (!flight)
        return;

    flight.status = STATUS.DEPARTURE;
    this.startTracking();
};

FlightHandler.prototype.finishFlight = function() {
    const flight = this.getCurrent();
    if (!flight)
        return;

    flight.status = STATUS.FINISHED;
    this.stopTracking();
};

FlightHandler.prototype.cancelFlight = function() {
    const flight = this.getCurrent();
    if (!flight)
        return;

    flight.status = STATUS.ABORTED;
    this.store.sync();
};

FlightHandler.prototype.resetFlight = function() {
    this.setCurrent({});
};

FlightHandler.prototype.stopTracking = function() {
    const flight = this.getCurrent();
    if (!flight || !flight.times)
        return;

    flight.times.end = now();
    this.sync();
};

FlightHandler.prototype.startTracking = function() {
    const flight = this.getCurrent();
    if (!flight)
        return;

    this.tracker = {
        airborneTime: 0,
        groundTime: 0
    };

    flight.times = {
        start: now(),
        takeoff: 0,
        landing: 0,
        end: 0
    };
    this.sync();
};

const _trackStatus = keyMap([STATUS.ONGROUND, STATUS.DEPARTURE, STATUS.AIRBORNE]);
FlightHandler.prototype.update = function() {
    const flight = this.getCurrent();
    if (!flight || !_trackStatus[flight.status])
        return;

    const tracker = this.tracker;
    const times = flight.times;
    const plane = geofs.aircraft.instance;

    if (!plane.groundContact && !plane.waterContact) {
        tracker.airborneTime++;
        tracker.groundTime = 0;
    } else {
        tracker.airborneTime = 0;
        tracker.groundTime++;
    }
    switch (flight.status) {
        case STATUS.ONGROUND:
        case STATUS.DEPARTURE: {
            if (!times.start) {
                times.start = now();
            }
            if (tracker.airborneTime > 5 && plane.groundSpeed > 10) {
                flight.status = STATUS.AIRBORNE;

                if (!times.takeoff) {
                    times.takeoff = now()-tracker.airborneTime;
                }
            }
        } break;

        case STATUS.AIRBORNE: {
            if (tracker.groundTime > 5) {
                if (this.jobMngr.currentAirport) {
                    if (this.jobMngr.currentAirport == flight.dest) {
                        flight.status = STATUS.ARRIVAL;
                    } else if (this.jobMngr.currentAirport == flight.dept) {
                        flight.status = STATUS.ABORTED;
                    } else {
                        flight.status = STATUS.DIVERTED;
                    }
                } else {
                    flight.status = STATUS.ONGROUND;
                }
                if (plane.crashed) {
                    flight.status = STATUS.CRASHED;
                }
                if (!times.landing) {
                    times.landing = now()-tracker.groundTime;
                }
            }
        } break;
    }
    this.sync();
};