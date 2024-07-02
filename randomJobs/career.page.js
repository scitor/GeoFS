'use strict';

/**
 * @param {MainWindow} window
 * @constructor
 */
function CareerPage(window) {
    this.window = window;
    this.mod = window.mod;
    this._listCols = {
        flightno:0,
        dest: 0,
        dist: 0,
        actions: 0
    };
}

/**
 * @param {HTMLElement} dom
 */
CareerPage.prototype.populate = function(dom) {
    this.dom = {
        listHeader: dom.querySelector('div'),
        list: dom.querySelector('ul')
    };
    this.dom.listHeader.onclick = (e) => this.toggleCols(e);
};

CareerPage.prototype.toggleCols = function(e) {
    const target = e.target;
    if (target == this.dom.listHeader.children[0]) {
        const cols = ['Airline / Flight', 'Dept Time'];
        this._listCols.flightno = ((this._listCols.flightno||0)+1) % cols.length;
        target.innerHTML = cols[this._listCols.flightno];

    } else if (target == this.dom.listHeader.children[1]) {
        const cols = ['Destination', 'Origin'];
        this._listCols.dest = ((this._listCols.dest||0)+1) % cols.length;
        target.innerHTML = cols[this._listCols.dest];

    } else if (target == this.dom.listHeader.children[2]) {
        const cols = ['Traveled', 'Duration', 'Avg kts'];
        this._listCols.dist = ((this._listCols.dist||0)+1) % cols.length;
        target.innerHTML = cols[this._listCols.dist];

    } else if (target == this.dom.listHeader.children[3]) {
        const cols = ['☐','☑','☒'];
        this._listCols.actions = ((this._listCols.actions||0)+1) % cols.length;
        target.innerHTML = cols[this._listCols.actions];
    }

    this.reloadList();
};

CareerPage.prototype.reloadList = async function() {
    this.dom.list.innerHTML = '';
    const flightsList = await this.mod.getHistory();
    let lastDate = '';
    flightsList.forEach(entry => {
        const startDate = humanDate(new Date(entry.times.start*1000));
        if (lastDate != startDate) {
            const dateRowDom = appendNewChild(this.dom.list, 'li', {class:'date-entry'});
            dateRowDom.innerText = lastDate = startDate;
        }
        const jobDom = appendNewChild(this.dom.list, 'li', {class:'list-entry'});

        if (this._listCols.flightno === 0) {
            let src = `${githubRepo}/randomJobs/airline.png`;
            if (entry.regional) {
                src = `${githubRepo}/randomJobs/regional.png`;
            } else {
                if (this.mod.aHandler.hasAIcon(entry.airline))
                    src = `https://www.flightaware.com/images/airline_logos/24px/${entry.airline}.png`;
            }
            const flightNoDom = appendNewChild(jobDom, 'div',{class:'flightno'});
            const aInfo = this.mod.aHandler.getAInfo(entry.airline);
            appendNewChild(flightNoDom, 'img', {src, alt:aInfo.name, title:aInfo.name, referrerpolicy:'no-referrer'});

            flightNoDom.appendChild(createTag('span', {}, entry.flightno));
        } else if (this._listCols.flightno === 1) {
            const flightNoDom = appendNewChild(jobDom, 'div',{class:'flightno'});
            flightNoDom.appendChild(createTag('span', {}, (entry.depttime||'') + ' ('+humanTime(new Date(entry.times.start*1000))+')'));
        }
        jobDom.appendChild(createTag('div',{class:'dest'}, this._listCols.dest === 0 ? entry.dest : entry.orgn));

        const duration = entry.times.end - entry.times.start;
        let distVal = '';
        if (this._listCols.dist === 0)
            distVal = Math.round(convert.kmToNm(entry.traveled/1000)) + 'NM';
        else {
            if (this._listCols.dist === 2)
                distVal = Math.round(convert.mpsToKts(entry.traveled/duration));
            else
                distVal = [zeroPad(Math.floor(duration/3600)), zeroPad(Math.floor(duration/60)%60)].join(':');
        }
        jobDom.appendChild(createTag('div',{class:'dist'}, distVal));

        const actionsDom = appendNewChild(jobDom,'div',{class:'actions'});
        if (this._listCols.actions === 0) {
            const actionMapDom = appendNewChild(actionsDom, 'button', {class:'action-plan mdl-button--icon'});
            actionMapDom.appendChild(createTag('i',{class:'material-icons'},'insights'));
            actionMapDom.onclick = () => this.actionMap(entry);

            const actionPlanDom = appendNewChild(actionsDom, 'button', {class:'action-plan mdl-button--icon'});
            actionPlanDom.appendChild(createTag('i',{class:'material-icons'},'airplane_ticket'));
            actionPlanDom.onclick = () => this.actionLoad(entry);

        } else if (this._listCols.actions === 1) {
            const gpxDownloadDom = appendNewChild(actionsDom, 'button', {class: 'action-plan mdl-button--icon'});
            gpxDownloadDom.appendChild(createTag('i', {class: 'material-icons', title: 'Download GPX'}, 'location_on'));
            gpxDownloadDom.onclick = () => this.actionDownloadGPX(entry, duration);

            const flightTapeDom = appendNewChild(actionsDom, 'button', {class: 'action-plan mdl-button--icon'});
            flightTapeDom.appendChild(createTag('i', {class: 'material-icons', title: 'Download Flight Tape'}, 'download' ));
            flightTapeDom.onclick = () => this.actionDownloadFlightTape(entry);
        } else if (this._listCols.actions === 2) {
            const actionRemoveDom = appendNewChild(actionsDom, 'button', {class:'action-plan mdl-button--icon'});
            actionRemoveDom.appendChild(createTag('i',{class:'material-icons'},'delete'));
            actionRemoveDom.onclick = () => {
                this.mod.removeHistoryEntry(entry.id);
                setTimeout(() => this.reloadList(),100);
            };
        }
    });
};

CareerPage.prototype.actionDownloadFlightTape = async function(entry) {
    const flightTape = await this.mod.archive.promiseGet('tapes', entry.id);
    const dataURI = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(flightTape.tape));
    const filename = ['GeoFS-tape', humanDate(new Date(entry.times.start * 1000))];
    if (entry.flightno)
        filename.push(entry.flightno);
    filename.push(entry.orgn);
    filename.push(entry.dest);
    createTag('a', {href: dataURI, download: filename.join('_') + '.json'}).click();
};

CareerPage.prototype.actionDownloadGPX = async function(entry, duration) {
    const xmlDoc = createTag('xmlDoc');
    const gpxDom = appendNewChild(xmlDoc, 'gpx', {
        xmlns: 'http://www.topografix.com/GPX/1/1',
        version: '1.1',
        creator: 'RandomJobsV' + this.mod.version,
        'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
        'xsi:schemaLocation': 'http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd'
    });
    const metadataDom = appendNewChild(gpxDom, 'metadata');
    metadataDom.appendChild(createTag('name',{},'Flight ' + entry.flightno + ' ('+[entry.orgn,entry.dest].join('-') +')'));
    metadataDom.appendChild(createTag('desc',{}, [
        'Dist ' + Math.round(convert.kmToNm(entry.dist/1000)) + 'NM',
        'Traveled ' + Math.round(convert.kmToNm(entry.traveled/1000))+'NM',
        'Duration ' + [zeroPad(Math.floor(duration/3600)), zeroPad(Math.round(duration/60)%60)].join(':'),
        'Avg kts ' + Math.round(convert.mpsToKts(entry.traveled/duration))
    ].join(', ')));

    const trkDom = appendNewChild(gpxDom, 'trk');
    let trkSeg = appendNewChild(trkDom, 'trkseg');
    const flightTape = await this.mod.archive.promiseGet('tapes', entry.id);
    if (!flightTape) return;
    const lastSample = {lat: 0, lon: 0};
    flightTape.tape.forEach(sample => {
        const dist = geofs.api.map._map.distance({lat: lastSample.lat, lng: lastSample.lon}, {lat: sample[1][0], lng: sample[1][1]});
        if (dist < 1) return;
        if (dist > 3000)
            trkSeg = appendNewChild(trkDom, 'trkseg');
        const wpt = appendNewChild(trkSeg, 'trkpt', {lat: sample[1][0], lon: sample[1][1]});
        wpt.appendChild(createTag('ele',{}, sample[1][2]));
        wpt.appendChild(createTag('desc',{}, [
            'Speed: ' + Math.round(convert.mpsToKts(sample[4].reduce((p,c) => p+c,0)))+'kts',
            'Alt: ' + Math.round(convert.metersToFeet(sample[1][2])) + 'ft'
        ].join('\n')));
        lastSample.lat = sample[1][0];
        lastSample.lon = sample[1][1];
    });
    const flightRoute = await this.mod.archive.promiseGet('routes', entry.id);
    if (flightRoute) {
        const rteDom = appendNewChild(gpxDom, 'rte');
        flightRoute.route.forEach(pt => {
            rteDom.appendChild(createTag('rtept',{lat:pt[0], lon:pt[1]}));
        });
    }

    const dataURI = 'data:text/xml;charset=utf-8,' + encodeURIComponent('<?xml version="1.0" encoding="utf-8"?>'+xmlDoc.innerHTML);
    const filename = ['GeoFS-flight', humanDate(new Date(entry.times.start * 1000))];
    if (entry.flightno)
        filename.push(entry.flightno);
    filename.push(entry.orgn);
    filename.push(entry.dest);
    createTag('a', {href: dataURI, download: filename.join('_') + '.gpx'}).click();
};

CareerPage.prototype.actionLoad = function(entry) {
    this.mod.flight.setCurrent(Object.assign({},entry));
    this.window.mainMenuDom.querySelector('li[data-id=flight]').click();
};

CareerPage.prototype.actionMap = function(entry) {
    geofs.api.map.clearPath();
    geofs.api.map.setPathPoints([
        this.mod.aHandler.getAirportCoords(entry.orgn),
        this.mod.aHandler.getAirportCoords(entry.dest)
    ]);
    geofs.api.map.stopCreatePath();
    ui.panel.show(".geofs-map-list");
};