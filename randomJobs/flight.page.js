'use strict';

/**
 * @param {JobsWindow} jobsWindow
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
        flight: dom.querySelector('#flightplan-flight'),
        airline: dom.querySelector('#flightplan-airline'),
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
    const flight = this.jobMngr.flight.getCurrent();
    if (!flight)
        return;

    flight.status = STATUS.FINISHED;
    this.updateForm();
};

FlightPage.prototype.startFlight = function() {
    const flight = this.jobMngr.flight.getCurrent();
    if (!flight)
        return;

    flight.status = STATUS.DEPARTURE;
    this.updateForm();
};

FlightPage.prototype.cancelFlight = function() {
    const flight = this.jobMngr.flight.getCurrent();
    if (!flight)
        return;

    flight.status = STATUS.ABORTED;
    this.updateForm();
};

FlightPage.prototype.resetFlight = function() {
    const flight = this.jobMngr.flight.getCurrent();
    if (flight && flight.status == STATUS.PLANING) {
        delete flight.id;
        delete flight.status;
    }
    this.jobMngr.flight.setCurrent({status:STATUS.PLANING});
    this.updateForm();
};

FlightPage.prototype.handleInputChange = function(key) {
    const job = this.jobMngr.flight.getCurrent();
    if (job) {
        job[key] = this.inputsDom[key].value.toLocaleUpperCase();
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
    if (status == STATUS.PLANING)   this.buttonMask(1,0,1,0);
    if (status == STATUS.DEPARTURE) this.buttonMask(0,1,0,1);
    if (status == STATUS.AIRBORNE)  this.buttonMask(0,1,0,1);
    if (status == STATUS.ARRIVAL)   this.buttonMask(0,1,0,1);
    if (status == STATUS.FINISHED)  this.buttonMask(1,0,1,0);
    if (status == STATUS.ABORTED)   this.buttonMask(1,0,1,0);
};

FlightPage.prototype.updateForm = function() {
    const inputKeys = ['flight', 'airline', 'dept', 'dest', 'depttime', 'arrvtime'];
    const flight = this.jobMngr.flight.getCurrent();
    if (!flight) {
        inputKeys.forEach(k => { this.inputsDom[k].value = '' });
        this.inputsDom.flight.setAttribute('placeholder','');
        this.airlineInfoDom.innerHTML = '';
        this.destInfoDom.innerHTML = '';
        return this.buttonMask(1,0,1,0);
    }
    this.handleButtonVisibility(flight.status);
    inputKeys.forEach(k => {
        this.inputsDom[k].value = flight[k] || '';
    });
    if (flight.airline && flight.airline.length) {
        const icao = flight.airline.toLocaleUpperCase();
        this.updateAirlineInfo(icao);
    } else {
        this.airlineInfoDom.innerHTML = '';
        this.inputsDom.flight.setAttribute('placeholder','');
    }

    if (flight.dest && flight.dest.length > 3) {
        const icao = flight.dest.toLocaleUpperCase();
        this.updateDestinationInfo(icao);
    } else
        this.destInfoDom.innerHTML = '';
};

FlightPage.prototype.updateAirlineInfo = function(icao) {
    let flightDom = this.inputsDom.flight;
    if (icao.length == 3) {
        const aInfo = this.jobMngr.aHandler.getAInfo(icao);
        if (aInfo) {
            this.airlineInfoDom.innerHTML = aInfo.name;
            flightDom.setAttribute('placeholder',aInfo.iata.toLocaleUpperCase());
            let src;
            if (this.jobMngr.aHandler.hasAIcon(aInfo.icao)) {
                src = `https://www.flightaware.com/images/airline_logos/24px/${icao}.png`;
            } else {
                src = `${githubRepo}/randomJobs/airline.png`;
            }
            this.airlineInfoDom.innerHTML += createTag('img', {src}).outerHTML;
        } else
            flightDom.setAttribute('placeholder','');
    } else if (icao.length == 1) {
        flightDom.setAttribute('placeholder', icao);
        this.airlineInfoDom.innerHTML = this.jobMngr.aHandler.getRegionalsName(icao);
        this.airlineInfoDom.innerHTML += createTag('img', {src:`${githubRepo}/randomJobs/regional.png`}).outerHTML;
    } else
        flightDom.setAttribute('placeholder','');
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
    const displayKeys = ['depttimeActual', 'arrvtimeActual', 'speedAvg', 'traveled'];
    const flight = this.jobMngr.flight.getCurrent();
    if (flight && flight.status != STATUS.PLANING) {
            return displayKeys.forEach(k => { this.displaysDom[k].value = flight[k] || '' });
    }
    displayKeys.forEach(k => { this.displaysDom[k].value = '' });
};
