'use strict';

/**
 * @param {MainWindow} mainWindow
 * @constructor
 */
function AirportPage(mainWindow) {
    this.window = mainWindow;
    this.mod = mainWindow.mod;
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
        const jobDom = appendNewChild(this.dom.list, 'li', {class:'list-entry'});

        let src = `${githubRepo}/randomJobs/airline.png`;
        let css = '';
        if (job.regional) {
            src = `${githubRepo}/randomJobs/regional.png`;
        } else if (this.mod.aHandler.hasAIcon(job.airline)) {
            src = `${githubRepo}/randomJobs/com.png`;
            css = 'airline-icon icao-'+job.airline;
        }
        const flightNoDom = appendNewChild(jobDom, 'div',{class:'flightno'});
        const aInfo = this.mod.aHandler.getAInfo(job.airline);
        appendNewChild(flightNoDom, 'img', {src, alt:aInfo.name, title:aInfo.name, class:css});

        flightNoDom.appendChild(createTag('span', {}, job.flightno));
        jobDom.appendChild(createTag('div',{class:'dest'}, job.dest));
        jobDom.appendChild(createTag('div',{class:'dist'}, Math.round(convert.kmToNm(job.dist/1000)) + 'NM'));

        const actionsDom = appendNewChild(jobDom,'div',{class:'actions'});
        const actionMapDom = appendNewChild(actionsDom, 'button', {class:'action-plan mdl-button--icon'});
        actionMapDom.appendChild(createTag('i',{class:'material-icons'},'insights'));
        actionMapDom.onclick = () => {
            ui.panel.show(".geofs-map-list");
            this.mod.generateFlightPlan(job.orgn, job.dest);
        };
        const actionPlanDom = appendNewChild(actionsDom, 'button', {class:'action-plan mdl-button--icon'});
        actionPlanDom.appendChild(createTag('i',{class:'material-icons'},'airplane_ticket'));
        actionPlanDom.onclick = () => {
            this.mod.flight.setCurrent(Object.assign({},job));
            this.window.mainMenuDom.querySelector('li[data-id=flight]').click();
        };
    });
};