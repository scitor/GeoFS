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
    this.archive = mod.archive;

    this.restoreState();
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
    return flight && flight.orgn && !!this.aHandler.getAirportCoords(flight.orgn);
};

FlightHandler.prototype.getOrigin = function() {
    const flight = this.getCurrent();
    return flight && flight.orgn;
};

FlightHandler.prototype.hasDestination = function() {
    const flight = this.getCurrent();
    return flight && flight.dest && !!this.aHandler.getAirportCoords(flight.dest);
};

FlightHandler.prototype.getDestination = function() {
    const flight = this.getCurrent();
    return flight && flight.dest;
};


FlightHandler.prototype.startFlight = function() {
    const flight = this.getCurrent();
    if (!flight)
        return;

    flight.dist = this.aHandler.getAirportDist(flight.orgn, flight.dest) * 1.1;
    flight.status = STATUS.DEPARTURE;
    this.startTracking();
};

FlightHandler.prototype.finishFlight = function() {
    const flight = this.getCurrent();
    if (!flight)
        return;

    if (!flight.traveled)
        flight.traveled = 0;

    if (flight.status != STATUS.ARRIVAL)
        flight.finished = flight.status;
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

FlightHandler.prototype.restoreState = function() {
    this.archive.onGet('tapes', 0, (res) => {
        if (res) this.flightTape = res.tape;
    });
    /*this.archive.onGet('routes', 0, (res) => {
        if (!res) return;
        geofs.api.map.clearPath();
        geofs.api.map.setPathPoints(res.route);
        geofs.api.map.stopCreatePath();
    });*/
};

FlightHandler.prototype.resetTracker = function() {
    this.tracker = {
        time: now(true),
        airborneTime: 0,
        groundTime: 0,
        airspeed: 0
    };

    this.flightTape = [];
    this.archive.del('tapes', 0);
    this.archive.del('routes', 0);
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

    this.archive.del('tapes', 0);
    this.archive.set('flights', flight);
    this.archive.set('tapes', {id:flight.id,tape:this.flightTape});
    /*if (geofs.api.map.flightPath) {
        this.archive.set('routes', {id:flight.id,
            route:geofs.api.map.flightPath._latlngs.map((p,i) => [p.lat,p.lng])
        });
    }*/
};

FlightHandler.prototype.tapeRecord = function() {
    const flRecord = window.flight.recorder.makeRecord();
    const tapeSample = ['ti', 'co', 'ct', 'st', 've', 'acc'].reduce((p, c) => {
        const rec = flRecord[c];
        if (rec.map !== undefined)
            p.push(rec.map(value => (typeof value === 'number') ? parseFloat(value.toFixed(6)) : value));
        else
            p.push(parseFloat(rec.toFixed(2)));
        return p;
    }, []);
    this.flightTape.push(tapeSample);
};

const _trackStatus = keyMap([STATUS.ONGROUND, STATUS.DEPARTURE, STATUS.AIRBORNE, STATUS.ARRIVAL, STATUS.ABORTED, STATUS.DIVERTED]);
FlightHandler.prototype.update = function() {
    const flight = this.getCurrent();
    if (!flight || !_trackStatus[flight.status])
        return;

    const tracker = this.tracker;
    const dt = Math.min(2, now(true) - tracker.time);
    tracker.time = now(true);
    const times = flight.times;
    const plane = geofs.aircraft.instance;
    let airborne = !plane.groundContact && !plane.waterContact;
    if (airborne) {
        flight.airborneTime = (flight.airborneTime||0)+dt;
        tracker.airborneTime += dt;
        tracker.groundTime = 0;
        tracker.airspeed = ((tracker.airspeed||plane.trueAirSpeed)*29 + plane.trueAirSpeed) / 30;
        flight.traveled = (flight.traveled||0) + (plane.groundSpeed*dt);
    } else {
        flight.groundTime = (flight.groundTime||0)+dt;
        tracker.groundTime += dt;
        tracker.airborneTime = 0;
        tracker.airspeed = 0;
        flight.taxiDist = (flight.taxiDist||0) + (plane.groundSpeed*dt);
    }
    if (this.flightTape.length % 120 == 0) {
        this.archive.set('tapes', {id:0,tape:this.flightTape});
        /*if (geofs.api.map.flightPath) {
            this.archive.set('routes', {id:0,
                route:geofs.api.map.flightPath._latlngs.map((p,i) => [p.lat,p.lng])
            });
        }*/
    }
    if (this.flightTape.length % 120 == 0) {
        this.archive.set('tapes', {id:0,tape:this.flightTape});
        /*if (geofs.api.map.flightPath) {
            this.archive.set('routes', {id:0,
                route:geofs.api.map.flightPath._latlngs.map((p,i) => [p.lat,p.lng])
            });
        }*/
    }
    this.tapeRecord();
    setTimeout(()=>this.tapeRecord(),500);

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