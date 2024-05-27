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
        flightno: dom.querySelector('#flightplan-flightno'),
        tailno: dom.querySelector('#flightplan-tailno'),
        dept: dom.querySelector('#flightplan-dept'),
        dest: dom.querySelector('#flightplan-dest'),
        depttime: dom.querySelector('#flightplan-depttime'),
        arrvtime: dom.querySelector('#flightplan-arrvtime'),
    };

    this.displaysDom = {
        depttimeActual: dom.querySelector('#flightplan-depttime-actual'),
        arrvtimeActual: dom.querySelector('#flightplan-arrvtime-actual'),
        speedAvg: dom.querySelector('#flightplan-speed-avg'),
        traveled: dom.querySelector('#flightplan-traveled'),
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

    if (geofs.aircraft.instance.groundSpeed > 10) {
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

FlightPage.prototype.updateForm = function() {
    const inputKeys = ['flightno', 'tailno', 'dept', 'dest', 'depttime', 'arrvtime'];
    const flight = this.jobMngr.flight.getCurrent();
    if (!flight) {
        inputKeys.forEach(k => { this.inputsDom[k].value = '' });
        this.airlineInfoDom.innerHTML = '';
        this.destInfoDom.innerHTML = '';
        return this.buttonMask(1,0,1,0);
    }
    this.handleButtonVisibility(flight.status);
    inputKeys.forEach(k => {
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

FlightPage.prototype.refreshDisplays = function() {
    const flight = this.jobMngr.flight.getCurrent();
    const dDom = this.displaysDom;
    if (!flight || flight.status == STATUS.PLANING) {
        ['depttimeActual','arrvtimeActual', 'speedAvg', 'traveled'].forEach(k => {
            dDom[k].value = '';
        });
        this.flightStatusDom.innerHTML = '';
        return;
    }
    this.flightStatusDom.innerHTML = flight.status.toLocaleUpperCase();
    dDom.speedAvg.value = flight.speedAvg || '';
    dDom.traveled.value = flight.traveled || '';
    dDom.depttimeActual.value =  '';
    dDom.arrvtimeActual.value =  '';

    if (flight.times?.start) {
        const startTime = new Date(flight.times.start*1000);
        dDom.depttimeActual.value = [('0'+startTime.getHours()).slice(-2),('0'+startTime.getMinutes()).slice(-2)].join(':');
    }
    if (flight.times?.end) {
        const endTime = new Date(flight.times.end*1000);
        dDom.arrvtimeActual.value = [('0'+endTime.getHours()).slice(-2),('0'+endTime.getMinutes()).slice(-2)].join(':');
    }
};
