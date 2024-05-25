'use strict';

/**
 * @param {JobsManager} jobsManager
 */
function JobsWindow(jobsManager) {
    this.jobMngr = jobsManager;
    jobsManager.window = this;
}

JobsWindow.prototype.init = function() {
    appendNewChild(document.head, 'link', { rel: 'stylesheet',
        href: `${githubRepo}/randomJobs/styles.css?${now()}`
    });
    appendNewChild(document.head, 'link', { rel: 'stylesheet',
        href: `${githubRepo}/randomJobs/flags16.css?${now()}`
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

/**
 * @param {Event} e
 */
JobsWindow.prototype.toggleWindow = function(e) {
    if (e.target != this.ctrlPadDom) return;
    if (this.padLabelDom.classList.contains('blue-pad')) {
        this.padLabelDom.classList.remove('blue-pad');
        this.jobsWindowDom.style.right = '-500px';
    } else {
        this.padLabelDom.classList.add('blue-pad');
        this.jobsWindowDom.style.right = '80px';
    }
};

/**
 * @param {Event} e
 */
JobsWindow.prototype.handleMainMenu = function(e) {
    /** @type {HTMLElement} */
    const buttonDom = e.target;
    const text = buttonDom.innerHTML;
    this.contentDom.querySelectorAll(':scope > div').forEach(div => {
        const active = div.classList.contains('list-'+text.toLocaleLowerCase());
        div.style.display = active ? '' : 'none';
    });
    this.mainMenuDom.querySelectorAll('ul > li').forEach(li => {
        if (li.innerHTML == text)
            li.classList.add('active');
        else
            li.classList.remove('active');
    });
    this._activeMenu = text.toLocaleLowerCase();
    switch (text.toLocaleLowerCase()){
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
    if (this._activeMenu == 'flight')
        this.flightPage.refreshDisplays();
};

JobsWindow.prototype.updateHeader = function() {
    const dom = this.headerDom;
    const icao = this.jobMngr.currentAirport;
    if (icao == this._lastUpdateIcao)
        return;

    this._lastUpdateIcao = icao;
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
