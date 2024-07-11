'use strict';

/**
 * @param {RandomJobsMod} mod
 * @constructor
 */
function MainWindow(mod) {
    this.mod = mod;
    mod.window = this;

    this.last = {icao:'',time:0};
}

MainWindow.prototype.init = function() {
    $.get(`${githubRepo}/randomJobs/styles.css?${now()}`, data => {
        document.head.appendChild(createTag('style',{type:'text/css'}, data));
    });
    $.get(`${githubRepo}/randomJobs/flags16.css?${now()}`, data => {
        document.head.appendChild(createTag('style',{type:'text/css'}, data));
    });
    const uiRightDom = $('.geofs-ui-right')[0];
    this.ctrlPadDom = appendNewChild(uiRightDom, 'div', {class:'jobs-pad'}, 1);

    this.padLabelDom = appendNewChild(this.ctrlPadDom, 'div', {class:'control-pad-label transp-pad'});
    this.padLabelDom.innerHTML = 'JOBS';
    this.padLabelDom.onclick = (e) => this.toggleWindow(e);

    this.jobsWindowDom = appendNewChild(document.body, 'div', {class:'jobs-window'});
    this.jobsWindowDom.innerHTML = '<p style="text-align:center;">... initializing ...</p>';
    this.jobsWindowDom.style.left = (window.innerWidth*2)+'px';
    this.jobsWindowDom.style.display = 'none';

    $.get(`${githubRepo}/randomJobs/window.html?${now()}`, data => {
        this.populate(data);
        this.jobsWindowDom.style.display = '';
    });
};

/**
 * @param {string} tpl
 */
MainWindow.prototype.populate = function(tpl) {
    this.jobsWindowDom.innerHTML = tpl;
    this.headerDom = {
        title: this.jobsWindowDom.querySelector('.jobs-title'),
        locinfo: this.jobsWindowDom.querySelector('.locinfo'),
        coords: this.jobsWindowDom.querySelector('.coords'),
        metar: this.jobsWindowDom.querySelector('.metar'),
    };
    this.footerDom = this.jobsWindowDom.querySelector('.jobs-footer');
    this.footerDom.innerHTML = 'Random Jobs v' + this.mod.version;
    this.footerDom.onclick = (e) => this.handleMainMenu(e);

    this.mainMenuDom = this.jobsWindowDom.querySelector('.jobs-menu');
    this.mainMenuDom.onclick = (e) => this.handleMainMenu(e);

    this.contentDom = this.jobsWindowDom.querySelector('.jobs-content');

    this.jobsPage = new AirportPage(this);
    this.jobsPage.populate(this.contentDom.querySelector('.page-jobs'));

    this.flightPage = new FlightplanPage(this);
    this.flightPage.populate(this.contentDom.querySelector('.page-flight'));

    this.careerPage = new CareerPage(this);
    this.careerPage.populate(this.contentDom.querySelector('.page-career'));

    this.headerDom.metar.onclick = () => this.windyPopup();
    this.makeDraggable(this.headerDom.title);
    this.makeScalable(this.headerDom.title);
    this.makeScalable(this.footerDom);

    this.jobsWindowDom.onkeydown =
    this.jobsWindowDom.onkeyup =
    this.jobsWindowDom.onkeypress = function (e) {
        e.stopImmediatePropagation();
    };
    this.populated = true;
};

let scale = 1;
MainWindow.prototype.makeScalable = function(header) {
    const win = this.jobsWindowDom;
    header.onwheel = (e) => {
        scale = Math.min(1, Math.max(0.5, scale + (e.deltaY < 0 ? 0.1 : -0.1)));
        win.style.scale = scale;
    };
};

MainWindow.prototype.makeDraggable = function(header) {
    const offset = [0,0], win = this.jobsWindowDom;
    header.onmousedown = (e) => {
        e.preventDefault();
        offset[0] = e.clientX - win.offsetLeft;
        offset[1] = e.clientY - win.offsetTop;
        header.addEventListener('mouseup', onMouseUp);
        document.addEventListener('mousemove', onMouseMove);
    };
    function onMouseMove(e) {
        e.preventDefault();
        win.style.left = (e.clientX - offset[0]) + 'px';
        win.style.top = (e.clientY - offset[1]) + 'px';
        win.style.transition = 'none';
    }
    function onMouseUp() {
        win.style.transition = '';
        header.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('mousemove', onMouseMove);
    }
};

MainWindow.prototype.windyPopup = function() {
    const icao = this.mod.airport.icao;
    if (icao) {
        const coords = this.mod.aHandler.getAirportCoords(icao);
        if (coords)
            window.open('https://embed.windy.com/embed.html?type=map&location=coordinates&zoom=7&lat='+coords[0]+'&lon='+coords[1],'_blank','popup=1',false);
    }
};

let _windowFirstTime = true;
/**
 * @param {Event} e
 */
MainWindow.prototype.toggleWindow = function(e) {
    if (e.target != this.padLabelDom) return;
    if (this.padLabelDom.classList.contains('blue-pad')) {
        this.padLabelDom.classList.remove('blue-pad');
        this.ctrlPadDom.classList.remove('open');
        this.jobsWindowDom.dataset.left = this.jobsWindowDom.style.left;
        this.jobsWindowDom.style.left = (window.innerWidth*2) + 'px';
    } else {
        this.padLabelDom.classList.add('blue-pad');
        this.ctrlPadDom.classList.add('open');
        if (this.jobsWindowDom.dataset.left)
            this.jobsWindowDom.style.left = this.jobsWindowDom.dataset.left;
        else
            this.jobsWindowDom.style.left = (window.innerWidth - this.jobsWindowDom.offsetWidth - 80) + 'px';

        if (_windowFirstTime) {
            this.mainMenuDom.querySelector('li[data-id=flight]').click();
            _windowFirstTime = false;
        }
    }
};

/**
 * @param {PointerEvent} e
 */
MainWindow.prototype.handleMainMenu = function(e) {
    if (!(e.target instanceof HTMLElement)) return;
    /** @type {HTMLElement} */
    const buttonDom = e.target;
    const menuId = buttonDom.dataset.id;
    this.contentDom.querySelectorAll(':scope > div').forEach(div => {
        const active = div.classList.contains('page-'+menuId);
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
        case 'career': this.careerPage.reloadList(); break;
        // @todo case 'config': this.loadConfigList(); break;
    }
};

MainWindow.prototype.update = function() {
    if (!this.populated)
        return;

    this.updateHeader();
    if (this._activeMenu == 'flight') {
        this.flightPage.refreshDisplays();
        this.flightPage.handleActiveButtons();
    }
};

MainWindow.prototype.reloadJobsList = function() {
    this.jobsPage.reloadList();
};

MainWindow.prototype.updateHeader = function() {
    const dom = this.headerDom;
    if (!geofs.aircraft.instance.groundContact && !geofs.aircraft.instance.waterContact) {
        dom.title.innerHTML = 'AIRBORNE';
        dom.locinfo.innerHTML = 'ALT SPEED HDG ETE';
        dom.coords.innerHTML = '';
        dom.metar.innerHTML = '';
        return;
    }
    const icao = this.mod.airport.icao;
    if (icao === this.last.icao)
        return;

    if (icao) {
        const info = this.mod.aHandler.getAirportInfo(icao);
        let airportName = this.mod.aHandler.getAirportName(icao) || info.name;
        dom.title.innerHTML = airportName.replace(' International ', ' Intl. ').replace(/ Airport$/, '');
        let locinfo = icao;
        if (info.iata) locinfo+= ' ('+info.iata+')';
        if (info.city) locinfo+= ', '+info.city;
        if (info.state) locinfo+= ', '+info.state;
        if (info.country) {
            locinfo = createTag('a',{class:'flag '+info.country.toLowerCase(),title:info.country}).outerHTML + locinfo;
        }

        dom.locinfo.innerHTML = locinfo;
        const aCoords = this.mod.aHandler.getAirportCoords(icao);
        dom.coords.innerHTML = 'Coords ' + aCoords.map(c=>c.toFixed(4)).join(', ');
        dom.coords.innerHTML += ', Elevation ' + info.elevation + ' ft';
        dom.metar.innerHTML = 'METAR: receiving ...';
        this.mod.aHandler.fetchAirportWeather(icao, json => {
            if (json && json.METAR) {
                dom.metar.innerHTML = 'METAR:';
                const weather = Object.keys(json).map(k => k+':'+json[k]).join('\n');
                dom.metar.appendChild(createTag('a',{title:weather}, json.METAR));
                if (json.altimHg) dom.coords.innerHTML += ', inHg:'+json.altimHg;
                if (json.fltCat) dom.coords.innerHTML += ' ('+json.fltCat+')';
            } else
                dom.metar.innerHTML = 'METAR: INOP';
        });
    } else {
        dom.title.innerHTML = '... no airport nearby ...';
        dom.locinfo.innerHTML = '';
        dom.coords.innerHTML = '';
        dom.metar.innerHTML = '';
    }

    this.last.icao = icao;
};
