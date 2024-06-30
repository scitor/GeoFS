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
 * @param {RandomJobsMod} mod
 * @constructor
 */
function FlightHandler (mod) {
    this.aHandler = mod.aHandler;
    this.airport = mod.airport;
    this.store = mod.store;

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
    const id = (icao) => this.aHandler.getIcaoId(icao);
    if (!info.id)
        info.id = Date.now();

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

FlightHandler.prototype.hasOrigin = function() {
    const flight = this.getCurrent();
    return flight && flight.orgn && flight.orgn.length;
};

FlightHandler.prototype.getOrigin = function() {
    const flight = this.getCurrent();
    return flight && flight.orgn;
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
    this.archiveFlight();
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
    this.flightTape = [];
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
        flight.delay = diffDate(plannedTime, actualTime);
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
        flight.delay = diffDate(plannedTime, actualTime);
    }
    this.sync();
};

FlightHandler.prototype.getAvgAirspeed = function() {
    return this.tracker && this.tracker.airspeed;
};

FlightHandler.prototype.archiveFlight = function() {
    const flight = this.getCurrent();
    if (!flight || !flight.id || !localStorage)
        return;

    const storage = new ObjectStore([this.store.storageKey, flight.id].join('_'));
    storage.set('flight', flight);
    storage.set('tape', this.flightTape);
    if (geofs.api.map.flightPath)
        storage.set('route', geofs.api.map.flightPath._latlngs.map((p,i) => [p.lat,p.lng]));
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
        tracker.airspeed = ((tracker.airspeed||plane.trueAirSpeed)*29 + plane.trueAirSpeed) / 30;
        flight.traveled = (flight.traveled||0) + plane.groundSpeed;
    } else {
        tracker.groundTime++;
        tracker.airborneTime = 0;
        tracker.airspeed = undefined;
        flight.taxiDist = (flight.taxiDist||0) + plane.groundSpeed;
    }
    const flRecord = window.flight.recorder.makeRecord();
    const tapeSample = ['time', 'coord', 'controls', 'state', 'velocities', 'accelerations'].reduce((p, c) => {
        p.push(flRecord[c]);
        return p;
    }, []);
    tapeSample[3][0] = tapeSample[3][0] ? 1 : 0;
    tapeSample[3][1] = tapeSample[3][1] ? 1 : 0;
    this.flightTape.push(tapeSample);

    switch (flight.status) {
        case STATUS.ONGROUND:
        case STATUS.DEPARTURE: {
            if (tracker.airborneTime < 5 || plane.groundSpeed < 10)
                break;

            flight.status = STATUS.AIRBORNE;
            if (!times.takeoff) {
                times.takeoff = now()-tracker.airborneTime;
            }
        } break;

        case STATUS.AIRBORNE: {
            if (tracker.groundTime < 5)
                break;

            const icao = this.airport.icao;
            if (icao) {
                if (icao == flight.dest) {
                    flight.status = STATUS.ARRIVAL;
                } else if (icao == flight.orgn) {
                    flight.status = STATUS.ABORTED;
                } else {
                    flight.status = STATUS.DIVERTED;
                }
                times.landing = now()-tracker.groundTime;
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