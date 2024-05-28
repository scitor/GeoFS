'use strict';

/**
 * @param {JobsWindow} jobsWindow
 * @constructor
 */
function FlightPage (jobsWindow) {
    this.window = jobsWindow;
    this.jobMngr = jobsWindow.jobMngr;
}

/**
 * @param {HTMLElement} dom
 */
FlightPage.prototype.populate = function(dom) {
    this.buttonsDom = {
        resetFlight: dom.querySelector('#flight-reset'),
        cancelFlight: dom.querySelector('#flight-cancel'),
        startFlight: dom.querySelector('#flight-start'),
        finishFlight: dom.querySelector('#flight-finish'),
    };

    this.inputsDom = {
        flightno: dom.querySelector('#flight-number'),
        tailno: dom.querySelector('#flight-tailnumber'),
        dept: dom.querySelector('#flight-departure-icao'),
        dest: dom.querySelector('#flight-destination-icao'),
        depttime: dom.querySelector('#flight-departure-scheduled'),
        arrvtime: dom.querySelector('#flight-arrival-scheduled'),
    };

    this.displaysDom = {
        depttimeActual: dom.querySelector('#flight-departure-actual'),
        arrvtimeActual: dom.querySelector('#flight-arrival-actual'),
        arrvtimeActualLabel: dom.querySelector('#flight-arrival-actual').previousSibling,
        speedAvg: dom.querySelector('#flight-speed-avg'),
        traveled: dom.querySelector('#flight-traveled'),
        delay: dom.querySelector('#flight-delay'),
        delayLabel: dom.querySelector('#flight-delay').previousSibling,
        duration: dom.querySelector('#flight-duration'),
        durationLabel: dom.querySelector('#flight-duration').previousSibling,
    };
    this.flightStatusDom = dom.querySelector('.flight-status');
    this.airlineInfoDom = dom.querySelector('.airline-info');
    this.destInfoDom = dom.querySelector('.destination-info');
    this.destInfoDom.onclick = () => this.windyPopup();

    Object.keys(this.inputsDom).forEach(k => {
        this.inputsDom[k].onchange = () => this.handleInputChange(k);
    });

    this.buttonsDom.resetFlight.onclick = () => this.resetFlight();
    this.buttonsDom.cancelFlight.onclick = () => this.cancelFlight();
    this.buttonsDom.startFlight.onclick = () => this.startFlight();
    this.buttonsDom.finishFlight.onclick = () => this.finishFlight();

    dom.onkeydown =
    dom.onkeyup =
    dom.onkeypress = function (e) {
        e.stopImmediatePropagation();
    }
};

FlightPage.prototype.finishFlight = function() {
    this.jobMngr.flight.finishFlight();
    this.updateForm();
};

FlightPage.prototype.startFlight = function() {
    this.jobMngr.flight.startFlight();
    this.updateForm();
};

FlightPage.prototype.cancelFlight = function() {
    this.jobMngr.flight.cancelFlight();
    this.updateForm();
};

FlightPage.prototype.resetFlight = function() {
    this.jobMngr.flight.resetFlight();
    this.updateForm();
    this.refreshDisplays();
};

FlightPage.prototype.handleInputChange = function(key) {
    const job = this.jobMngr.flight.getCurrent();
    if (job) {
        job[key] = this.inputsDom[key].value.toLocaleUpperCase();
        this.jobMngr.flight.sync();
    }
    this.updateForm();
};

FlightPage.prototype.windyPopup = function() {
    const flight = this.jobMngr.flight.getCurrent();
    if (flight && flight.dest) {
        const coords = this.jobMngr.aHandler.getAirportCoords(flight.dest);
        if (coords)
            window.open('https://embed.windy.com/embed.html?type=map&location=coordinates&zoom=7&lat='+coords[0]+'&lon='+coords[1],'_blank','popup=1',false);
    }
};

FlightPage.prototype.buttonMask = function(bReset,bCancel,bStart,bFinish) {
    bReset ?  $(this.buttonsDom.resetFlight).show() :  $(this.buttonsDom.resetFlight).hide();
    bCancel ? $(this.buttonsDom.cancelFlight).show() : $(this.buttonsDom.cancelFlight).hide();
    bStart ?  $(this.buttonsDom.startFlight).show() :  $(this.buttonsDom.startFlight).hide();
    bFinish ? $(this.buttonsDom.finishFlight).show() : $(this.buttonsDom.finishFlight).hide();
};

FlightPage.prototype.handleButtonVisibility = function(status) {
    if (status == STATUS.PLANING || status == STATUS.FINISHED)
        this.buttonMask(1,0,1,0);
    else if (status == STATUS.ABORTED || status == STATUS.CRASHED)
        this.buttonMask(1,0,0,1);
    else
        this.buttonMask(0,1,0,1);
};

const _endPhase = keyMap([STATUS.ARRIVAL,STATUS.DIVERTED,STATUS.ABORTED,STATUS.CRASHED]);
FlightPage.prototype.handleActiveButtons = function() {
    const HINTS = {
        ready: 'Ready to depart!',
        finished: 'Ready to deboard!',
        noDept: 'No departure entered!',
        noDest: 'No destination entered!',
        notAtDept: 'Not at departure airport!',
        notAtDest: 'Not at destination airport!',
        airborne: 'Still airborne!',
        moving: 'Airplane moving!',
        parkingBrake: 'Parking brake not set!',
        planPhase: 'Start planning flight first',
        completePhase: 'Complete flight phase first'
    };
    const flight = this.jobMngr.flight;
    const preventStartFlight = [];
    const preventFinishFlight = [];

    const status = flight.getStatus();
    if (status == STATUS.PLANING) {
        if (!flight.hasDeparture()) {
            preventStartFlight.push(HINTS.noDept);
            preventFinishFlight.push(HINTS.noDept);
        } else if (flight.getDeparture() != this.jobMngr.currentAirport) {
            preventStartFlight.push(HINTS.notAtDept);
        }
    }

    if (!flight.hasDestination()) {
        preventStartFlight.push(HINTS.noDest);
        preventFinishFlight.push(HINTS.noDest);
    } else if (flight.hasDestination() && (flight.getDestination() != this.jobMngr.currentAirport)) {
        if (!_endPhase[status])
            preventFinishFlight.push(HINTS.notAtDest);
    }

    if (!geofs.aircraft.instance.groundContact) {
        preventStartFlight.push(HINTS.airborne);
        preventFinishFlight.push(HINTS.airborne);
    }

    if (geofs.aircraft.instance.groundSpeed > 1) {
        preventStartFlight.push(HINTS.moving);
        preventFinishFlight.push(HINTS.moving);
    }

    if (!geofs.aircraft.instance.brakesOn) {
        preventStartFlight.push(HINTS.parkingBrake);
        preventFinishFlight.push(HINTS.parkingBrake);
    }

    if (status != STATUS.PLANING) {
        preventStartFlight.push(HINTS.planPhase);
    }
    if (!_endPhase[status]) {
        preventFinishFlight.push(HINTS.completePhase);
    }

    this.buttonsDom.startFlight.title = preventStartFlight.join('\n') || HINTS.ready;
    this.buttonsDom.startFlight.disabled = preventStartFlight.length > 0;

    this.buttonsDom.finishFlight.title = preventFinishFlight.join('\n') || HINTS.finished;
    this.buttonsDom.finishFlight.disabled = preventFinishFlight.length > 0;
};

const _inputKeys = ['flightno', 'tailno', 'dept', 'dest', 'depttime', 'arrvtime'];
FlightPage.prototype.updateForm = function() {
    const flight = this.jobMngr.flight.getCurrent();
    if (!flight) {
        _inputKeys.forEach(k => { this.inputsDom[k].value = '' });
        this.airlineInfoDom.innerHTML = '';
        this.destInfoDom.innerHTML = '';
        return this.buttonMask(1,0,1,0);
    }
    this.handleButtonVisibility(flight.status);
    _inputKeys.forEach(k => {
        this.inputsDom[k].value = flight[k] || '';
    });
    flight.airline = '';
    if (flight.flightno && flight.flightno.length) {
        let aInfo = this.jobMngr.aHandler.getIATAInfo(flight.flightno.substr(0,2));
        if (!aInfo)
            aInfo = this.jobMngr.aHandler.getIATAInfo(flight.flightno[0]);
        if (aInfo) {
            flight.airline = aInfo.icao;
            this.updateAirlineInfo(flight.airline);
        }
    }
    if (!flight.airline)
        this.airlineInfoDom.innerHTML = '';

    if (flight.dest && flight.dest.length > 3) {
        const icao = flight.dest.toLocaleUpperCase();
        this.updateDestinationInfo(icao);
    } else
        this.destInfoDom.innerHTML = '';
};

FlightPage.prototype.updateAirlineInfo = function(icao) {
    if (icao.length == 3) {
        const aInfo = this.jobMngr.aHandler.getAInfo(icao);
        if (aInfo) {
            let src;
            if (this.jobMngr.aHandler.hasAIcon(aInfo.icao)) {
                src = `https://www.flightaware.com/images/airline_logos/24px/${icao}.png`;
            } else {
                src = `${githubRepo}/randomJobs/airline.png`;
            }
            this.airlineInfoDom.innerHTML = createTag('img', {src}).outerHTML + aInfo.name;
        }
    } else if (icao.length == 1) {
        this.airlineInfoDom.innerHTML = createTag('img', {src:`${githubRepo}/randomJobs/regional.png`}).outerHTML;
        this.airlineInfoDom.innerHTML += this.jobMngr.aHandler.getRegionalsName(icao);
    }
};

FlightPage.prototype.updateDestinationInfo = function(icao) {
    const aInfo = this.jobMngr.aHandler.getAirportInfo(icao);
    let aName = this.jobMngr.aHandler.getAirportName(icao);
    let locinfo = '';
    if (aInfo) {
        aName = aName || aInfo.name;
        if (aInfo.country) {
            aName = createTag('a',{class:'flag '+aInfo.country.toLowerCase(),title:aInfo.country}).outerHTML + aName;
        }
        if (aInfo.iata) locinfo+= ' ('+aInfo.iata+')';
        if (aInfo.city) locinfo+= ', '+aInfo.city;
        this.jobMngr.aHandler.fetchAirportWeather(icao, json => {
            if (json && json.METAR) {
                let metar = '';
                if (json.altimHg) metar += ' inHg:'+json.altimHg;
                if (json.fltCat) metar += ' ('+json.fltCat+')';
                const weather = Object.keys(json).map(k => k+':'+json[k]).join('\n');
                locinfo += createTag('a',{title:weather},metar).outerHTML;

                this.destInfoDom.innerHTML = aName.replace(' International ', ' Intl. ').replace(/ Airport$/, '');
                this.destInfoDom.innerHTML += createTag('small',{},locinfo).outerHTML;
            }
        });
    }
    this.destInfoDom.innerHTML = aName.replace(' International ', ' Intl. ').replace(/ Airport$/, '');
    this.destInfoDom.innerHTML += createTag('small',{},locinfo).outerHTML;
};

const _displayKeys = ['depttimeActual','arrvtimeActual', 'speedAvg', 'traveled', 'delay', 'duration'];
FlightPage.prototype.refreshDisplays = function() {
    const flight = this.jobMngr.flight.getCurrent();
    const dDom = this.displaysDom;
    if (!flight || flight.status == STATUS.PLANING) {
        _displayKeys.forEach(k => {
            dDom[k].value = '';
        });
        this.flightStatusDom.innerHTML = '';
        dDom.arrvtimeActualLabel.nodeValue = 'Actual Arr';
        dDom.delayLabel.nodeValue = 'On Time';
        dDom.durationLabel.nodeValue = 'Duration';
        return;
    }
    this.flightStatusDom.innerHTML = flight.status.replace(STATUS.AIRBORNE,'flight').toLocaleUpperCase();
    if (!flight.times)
        return;

    dDom.traveled.value = Math.round(convert.kmToNm(flight.traveled/1000)) || '';
    if (flight.delay) {
        const delay = Math.abs(flight.delay);
        dDom.delay.value = [zeroPad(Math.floor(delay/3600)), zeroPad(Math.round(delay/60)%60)].join(':');
        dDom.delayLabel.nodeValue = flight.delay < -900 ? 'Delay' : (flight.delay > 0 ? 'Early' : 'On Time');
    }

    const duration = flight.times.end ? flight.times.end-flight.times.start :
                   (flight.times.landing||now())-(flight.times.takeoff||flight.times.start);
    dDom.duration.value = [zeroPad(Math.floor(duration/3600)), zeroPad(Math.round(duration/60)%60)].join(':');
    dDom.durationLabel.nodeValue = flight.times.end || !flight.times.takeoff ? 'Duration' : 'Duration (air)';
    const avgSpeed = flight.traveled > 1e3 && duration>60 ? flight.traveled / duration : 0;
    dDom.speedAvg.value = Math.round(convert.mpsToKts(avgSpeed)) || '';

    if (flight.times.start) {
        const startTime = new Date(flight.times.start*1000);
        dDom.depttimeActual.value = humanTime(startTime);
    }
    if (flight.times.end) {
        const endTime = new Date(flight.times.end*1000);
        dDom.arrvtimeActual.value = humanTime(endTime);
        dDom.arrvtimeActualLabel.nodeValue = 'Actual Arr';

    } else if (flight.status == STATUS.AIRBORNE && avgSpeed) {
        const estTime = Math.max(0,Math.round((flight.dist-flight.traveled)/avgSpeed));
        const estDate = new Date((now()+estTime)*1000);
        dDom.arrvtimeActual.value = humanTime(estDate);
        dDom.arrvtimeActualLabel.nodeValue = 'Estimated Arr';
    }
};
