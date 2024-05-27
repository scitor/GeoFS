'use strict';

/**
 * @param {JobsManager} jobsManager
 * @constructor
 */
function JobsWindow(jobsManager) {
    this.jobMngr = jobsManager;
    jobsManager.window = this;

    this._lastUpdateIcao = 'INIT';
}

JobsWindow.prototype.init = function() {
    $.get(`${githubRepo}/randomJobs/styles.css?${now()}`, data => {
        document.head.appendChild(createTag('style',{type:'text/css'}, data));
    });
    $.get(`${githubRepo}/randomJobs/flags16.css?${now()}`, data => {
        document.head.appendChild(createTag('style',{type:'text/css'}, data));
    });
    const uiRightDom = $('.geofs-ui-right')[0];
    this.ctrlPadDom = appendNewChild(uiRightDom, 'div', {class:'jobs-pad'}, 1);
    this.ctrlPadDom.onclick = (e) => this.toggleWindow(e);

    this.padLabelDom = appendNewChild(this.ctrlPadDom, 'div', {class:'control-pad-label transp-pad'});
    this.padLabelDom.innerHTML = 'JOBS';

    this.jobsWindowDom = appendNewChild(this.ctrlPadDom, 'div', {class:'jobs-window'});
    this.jobsWindowDom.innerHTML = '<p style="text-align:center;">... initializing ...</p>';

    $.get(`${githubRepo}/randomJobs/window.html?${now()}`, data => {
        this.populate(data);
        setInterval(() => this.update(), 1000);
    });
};

/**
 * @param {string} tpl
 */
JobsWindow.prototype.populate = function(tpl) {
    this.jobsWindowDom.innerHTML = tpl;
    this.headerDom = {
        title: this.jobsWindowDom.querySelector('.jobs-title'),
        locinfo: this.jobsWindowDom.querySelector('.locinfo'),
        coords: this.jobsWindowDom.querySelector('.coords'),
        metar: this.jobsWindowDom.querySelector('.metar'),
    };
    this.footerDom = this.jobsWindowDom.querySelector('.jobs-footer');
    this.footerDom.innerHTML = 'Random Jobs v' + this.jobMngr.version;

    this.mainMenuDom = this.jobsWindowDom.querySelector('.jobs-menu');
    this.mainMenuDom.onclick = (e) => this.handleMainMenu(e);

    this.contentDom = this.jobsWindowDom.querySelector('.jobs-content');

    this.jobsPage = new JobsPage(this);
    this.jobsPage.populate(this.contentDom.querySelector('.list-jobs'));

    this.flightPage = new FlightPage(this);
    this.flightPage.populate(this.contentDom.querySelector('.list-flight'));

    this.headerDom.metar.onclick = () => this.windyPopup();
    this.populated = true;
};

JobsWindow.prototype.windyPopup = function() {
    const icao = this.jobMngr.currentAirport;
    if (icao) {
        const coords = this.jobMngr.aHandler.getAirportCoords(icao);
        if (coords)
            window.open('https://embed.windy.com/embed.html?type=map&location=coordinates&zoom=7&lat='+coords[0]+'&lon='+coords[1],'_blank','popup=1',false);
    }
};

let _windowFirstTime = true;
/**
 * @param {Event} e
 */
JobsWindow.prototype.toggleWindow = function(e) {
    if (e.target != this.ctrlPadDom) return;
    if (this.padLabelDom.classList.contains('blue-pad')) {
        this.padLabelDom.classList.remove('blue-pad');
        this.ctrlPadDom.classList.remove('open');
        this.jobsWindowDom.style.right = '-500px';
    } else {
        this.padLabelDom.classList.add('blue-pad');
        this.ctrlPadDom.classList.add('open');
        this.jobsWindowDom.style.right = '80px';
        if (_windowFirstTime) {
            this.mainMenuDom.querySelector('li[data-id=flight]').click();
            _windowFirstTime = false;
        }
    }
};

/**
 * @param {PointerEvent} e
 */
JobsWindow.prototype.handleMainMenu = function(e) {
    if (!(e.target instanceof HTMLElement)) return;
    /** @type {HTMLElement} */
    const buttonDom = e.target;
    const menuId = buttonDom.dataset.id;
    this.contentDom.querySelectorAll(':scope > div').forEach(div => {
        const active = div.classList.contains('list-'+menuId);
        div.style.display = active ? '' : 'none';
    });
    this.mainMenuDom.querySelectorAll('ul > li').forEach(li => {
        if (li.dataset.id == menuId)
            li.classList.add('active');
        else
            li.classList.remove('active');
    });
    this._activeMenu = menuId;
    switch (menuId){
        case 'jobs': this.jobsPage.reloadList(); break;
        case 'flight': this.flightPage.updateForm(); break;
        // @todo case 'career': this.loadCareerList(); break;
        // @todo case 'config': this.loadConfigList(); break;
    }
};

JobsWindow.prototype.update = function() {
    if (!this.populated)
        return;

    this.updateHeader();
    if (this._activeMenu == 'flight') {
        this.flightPage.refreshDisplays();
        this.flightPage.handleActiveButtons();
    }
};

JobsWindow.prototype.updateHeader = function() {
    const dom = this.headerDom;
    if (!geofs.aircraft.instance.groundContact && !geofs.aircraft.instance.waterContact) {
        dom.title.innerHTML = 'AIRBORNE';
        dom.locinfo.innerHTML = 'ALT SPEED HDG ETE';
        dom.coords.innerHTML = '';
        dom.metar.innerHTML = '';
        return;
    }
    const icao = this.jobMngr.currentAirport;
    if (icao == this._lastUpdateIcao && now()<this._lastUpdateTime+60)
        return;

    this._lastUpdateIcao = icao;
    this._lastUpdateTime = now();
    if (!icao) {
        dom.title.innerHTML = '... no airport nearby ...';
        dom.locinfo.innerHTML = '';
        dom.coords.innerHTML = '';
        dom.metar.innerHTML = '';
    } else {
        const info = this.jobMngr.aHandler.getAirportInfo(icao);
        let airportName = this.jobMngr.aHandler.getAirportName(icao) || info.name;
        dom.title.innerHTML = airportName.replace(' International ', ' Intl. ').replace(/ Airport$/, '');
        let locinfo = icao;
        if (info.iata) locinfo+= ' ('+info.iata+')';
        if (info.city) locinfo+= ', '+info.city;
        if (info.state) locinfo+= ', '+info.state;
        if (info.country) {
            locinfo = createTag('a',{class:'flag '+info.country.toLowerCase(),title:info.country}).outerHTML + locinfo;
        }

        dom.locinfo.innerHTML = locinfo;
        const aCoords = this.jobMngr.aHandler.getAirportCoords(icao);
        dom.coords.innerHTML = 'Coords ' + aCoords.map(c=>c.toFixed(4)).join(', ');
        dom.coords.innerHTML += ', Elevation ' + info.elevation + ' ft';
        dom.metar.innerHTML = 'METAR: receiving ...';
        this.jobMngr.aHandler.fetchAirportWeather(icao, json => {
            if (json && json.METAR) {
                dom.metar.innerHTML = 'METAR:';
                const weather = Object.keys(json).map(k => k+':'+json[k]).join('\n');
                dom.metar.appendChild(createTag('a',{title:weather}, json.METAR));
                if (json.altimHg) dom.coords.innerHTML += ', inHg:'+json.altimHg;
                if (json.fltCat) dom.coords.innerHTML += ' ('+json.fltCat+')';
            } else
                dom.metar.innerHTML = 'METAR: INOP';
        });
    }
};
