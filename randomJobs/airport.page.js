'use strict';

/**
 * @param {MainWindow} window
 * @constructor
 */
function AirportPage(window) {
    this.jobsWindow = window;
    this.mod = window.mod;

}

/**
 * @param {HTMLElement} dom
 */
AirportPage.prototype.populate = function(dom) {
    this.dom = {
        listHeader: dom.querySelector('div'),
        list: dom.querySelector('ul'),
        loadButton: dom.querySelector('input')
    };
    this.dom.listHeader.onclick = (e) => this.sortList(e);
    this.dom.loadButton.onclick = () => this.loadJobs();
    //@todo config (autoload list)
    //new IntersectionObserver(() => this.loadJobs()).observe(this.dom.loadButton);
};

AirportPage.prototype.loadJobs = function() {
    for (let i = 0; i < 20; ++i) {
        this.mod.generateJob();
    }
    this.reloadList();
};

AirportPage.prototype.sortList = function(e) {
    const target = e.target;
    let sortFn;
    this._lastSort = !this._lastSort;
    if (target == this.dom.listHeader.children[0]) {
        sortFn = (a,b) => a.regional - b.regional || (this._lastSort ? a.flightno.localeCompare(b.flightno) : b.flightno.localeCompare(a.flightno));
    } else if (target == this.dom.listHeader.children[1]) {
        sortFn = (a,b) => a.regional - b.regional || (this._lastSort ? a.dest.localeCompare(b.dest) : b.dest.localeCompare(a.dest));
    } else if (target == this.dom.listHeader.children[2]) {
        sortFn = (a,b) => a.regional - b.regional || (this._lastSort ? b.dist - a.dist : a.dist - b.dist);
    }
    if (sortFn)
        this.mod.sortJobsList(sortFn);

    this.reloadList();
};

AirportPage.prototype.reloadList = function() {
    this.dom.list.innerHTML = '';
    const jobsList = this.mod.getJobsList();
    jobsList.forEach(job => {
        const jobDom = appendNewChild(this.dom.list, 'li', {class:'job-entry-available'});

        let src = `${githubRepo}/randomJobs/airline.png`;
        if (job.regional) {
            src = `${githubRepo}/randomJobs/regional.png`;
        } else {
            if (this.mod.aHandler.hasAIcon(job.airline))
                src = `https://www.flightaware.com/images/airline_logos/24px/${job.airline}.png`;
        }
        const flightNoDom = appendNewChild(jobDom, 'div',{class:'flightno'});
        const aInfo = this.mod.aHandler.getAInfo(job.airline);
        appendNewChild(flightNoDom, 'img', {src, alt:aInfo.name, title:aInfo.name, referrerpolicy:'no-referrer'});

        flightNoDom.appendChild(createTag('span', {}, job.flightno));
        jobDom.appendChild(createTag('div',{class:'dest'}, job.dest));
        jobDom.appendChild(createTag('div',{class:'dist'}, Math.round(convert.kmToNm(job.dist/1000)) + 'NM'));

        const actionsDom = appendNewChild(jobDom,'div',{class:'actions'});
        const actionMapDom = appendNewChild(actionsDom, 'button', {class:'action-plan mdl-button--icon'});
        actionMapDom.appendChild(createTag('i',{class:'material-icons'},'insights'));
        actionMapDom.onclick = () => {
            geofs.api.map.clearPath();
            geofs.api.map.setPathPoints([
                this.mod.aHandler.getAirportCoords(job.dept),
                this.mod.aHandler.getAirportCoords(job.dest)
            ]);
            geofs.api.map.stopCreatePath();
            ui.panel.show(".geofs-map-list");
        };
        const actionPlanDom = appendNewChild(actionsDom, 'button', {class:'action-plan mdl-button--icon'});
        actionPlanDom.appendChild(createTag('i',{class:'material-icons'},'airplane_ticket'));
        actionPlanDom.onclick = () => {
            this.mod.flight.setCurrent(Object.assign({},job));
            this.jobsWindow.mainMenuDom.querySelector('li[data-id=flight]').click();
        };
    });
};