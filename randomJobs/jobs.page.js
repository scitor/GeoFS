'use strict';

/**
 * @param {JobsWindow} window
 * @constructor
 */
function JobsPage(window) {
    this.jobsWindow = window;
    this.jobMngr = window.jobMngr;

}

/**
 * @param {HTMLElement} dom
 */
JobsPage.prototype.populate = function(dom) {
    this.dom = {
        listHeader: dom.querySelector('div'),
        list: dom.querySelector('ul'),
        loadButton: dom.querySelector('input')
    };
    this.dom.loadButton.onclick = () => this.loadJobs();
    this.dom.listHeader.onclick = (e) => this.sortList(e);
};

JobsPage.prototype.loadJobs = function() {
    for (let i = 0; i < this.jobMngr.rng(10, 10); ++i) {
        this.jobMngr.generateJob();
    }
    this.reloadList();
};

JobsPage.prototype.sortList = function(e) {
    const target = e.target;
    let sortFn = ()=>{};
    this._lastSort = !this._lastSort;
    if (target == this.dom.listHeader.children[0]) {
        sortFn = (a,b) => a.regional - b.regional || (this._lastSort ? a.flightno.localeCompare(b.flightno) : b.flightno.localeCompare(a.flightno));
    } else if (target == this.dom.listHeader.children[1]) {
        sortFn = (a,b) => a.regional - b.regional || (this._lastSort ? a.dest.localeCompare(b.dest) : b.dest.localeCompare(a.dest));
    } else {
        sortFn = (a,b) => a.regional - b.regional || (this._lastSort ? b.dist - a.dist : a.dist - b.dist);
    }
    this.jobMngr.sortJobsList(sortFn);
    this.reloadList();
};

JobsPage.prototype.reloadList = function() {
    this.dom.list.innerHTML = '';
    const jobsList = this.jobMngr.getJobsList();
    jobsList.forEach(job => {
        const jobDom = appendNewChild(this.dom.list, 'li', {class:'job-entry-available'});

        let src = `${githubRepo}/randomJobs/airline.png`;
        if (job.regional) {
            src = `${githubRepo}/randomJobs/regional.png`;
        } else {
            if (this.jobMngr.aHandler.hasAIcon(job.airline))
                src = `https://www.flightaware.com/images/airline_logos/24px/${job.airline}.png`;
        }
        const flightNoDom = appendNewChild(jobDom, 'div',{class:'flightno'});
        const aInfo = this.jobMngr.aHandler.getAInfo(job.airline);
        appendNewChild(flightNoDom, 'img', {src, alt:aInfo.name, title:aInfo.name, referrerpolicy:'no-referrer'});

        flightNoDom.appendChild(createTag('span', {}, job.flightno));
        jobDom.appendChild(createTag('div',{class:'dest'}, job.dest));
        jobDom.appendChild(createTag('div',{class:'dist'}, Math.round(convert.kmToNm(job.dist/1000))));

        const actionsDom = appendNewChild(jobDom,'div',{class:'actions'});
        const actionMapDom = appendNewChild(actionsDom, 'button', {class:'action-plan mdl-button--icon'});
        actionMapDom.appendChild(createTag('i',{class:'material-icons'},'insights'));
        actionMapDom.onclick = () => {
            geofs.api.map.clearPath();
            geofs.api.map.setPathPoints([
                this.jobMngr.aHandler.getAirportCoords(job.dept),
                this.jobMngr.aHandler.getAirportCoords(job.dest)
            ]);
            geofs.api.map.stopCreatePath();
            ui.panel.show(".geofs-map-list");
        };
        const actionPlanDom = appendNewChild(actionsDom, 'button', {class:'action-plan mdl-button--icon'});
        actionPlanDom.appendChild(createTag('i',{class:'material-icons'},'airplane_ticket'));
        actionPlanDom.onclick = () => {
            this.jobMngr.flight.setCurrent(Object.assign({},job));
            this.jobsWindow.mainMenuDom.querySelector('li[data-id=flight]').click();
        };
    });
};