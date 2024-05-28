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

    this.resetTracker();
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

FlightHandler.prototype.resetTracker = function() {
    this.tracker = {
        airborneTime: 0,
        groundTime: 0,
        airspeed: 0
    };
};

FlightHandler.prototype.stopTracking = function() {
    const flight = this.getCurrent();
    if (!flight || !flight.times)
        return;

    flight.times.end = now();
    if (flight.arrvtime !== undefined) {
        const actualTime = new Date(flight.times.end*1000);
        const plannedTime = new Date();
        plannedTime.setHours(...flight.arrvtime.split(':'));
        flight.delay = Math.floor((actualTime - plannedTime)/1000);
    }
    this.sync();
};

FlightHandler.prototype.startTracking = function() {
    const flight = this.getCurrent();
    if (!flight)
        return;

    this.resetTracker();
    flight.times = {
        start: now(),
        takeoff: 0,
        landing: 0,
        end: 0
    };
    if (flight.depttime !== undefined) {
        const actualTime = new Date(flight.times.start*1000);
        const plannedTime = new Date();
        plannedTime.setHours(...flight.depttime.split(':'));
        flight.delay = diffDate(actualTime, plannedTime);
        //flight.delay = Math.floor((actualTime - plannedTime)/1000);
    }
    this.sync();
};

const _trackStatus = keyMap([STATUS.ONGROUND, STATUS.DEPARTURE, STATUS.AIRBORNE, STATUS.ARRIVAL, STATUS.ABORTED, STATUS.DIVERTED]);
FlightHandler.prototype.update = function() {
    const flight = this.getCurrent();
    if (!flight || !_trackStatus[flight.status])
        return;

    const tracker = this.tracker;
    const times = flight.times;
    const plane = geofs.aircraft.instance;
    let airborne = !plane.groundContact && !plane.waterContact;
    if (airborne) {
        tracker.airborneTime++;
        tracker.groundTime = 0;
        tracker.airspeed = (tracker.airspeed*9 + plane.trueAirSpeed) / 10;
        flight.traveled = (flight.traveled||0) + plane.groundSpeed;
    } else {
        tracker.groundTime++;
        tracker.airborneTime = 0;
        tracker.airspeed = undefined;
        flight.taxiDist = (flight.taxiDist||0) + plane.groundSpeed;
    }

    switch (flight.status) {
        case STATUS.ONGROUND:
        case STATUS.DEPARTURE: {
            if (tracker.airborneTime > 5 && plane.groundSpeed > 10) {
                flight.status = STATUS.AIRBORNE;
                if (!times.takeoff) {
                    times.takeoff = now()-tracker.airborneTime;
                }
            }
        } break;

        case STATUS.AIRBORNE: {
            if (tracker.groundTime < 5)
                break;

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
                flight.crashed = true;
            }
            if (!times.landing) {
                times.landing = now()-tracker.groundTime;
            }
        } break;
    }
    this.sync();
};