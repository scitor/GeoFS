'use strict';

(function patch() {
    if (!geofs || !geofs.map || !geofs.map.addRunwayMarker)
        return setTimeout(patch, 1000);

    const geofs_map_addRunwayMarker = geofs.map.addRunwayMarker;
    geofs.map.addRunwayMarker = function geofs_map_addRunwayMarker__patch(a) {
        add2AList(a);
        return geofs_map_addRunwayMarker(a);
    };
    geofs.nav.loadNavaidsAndRunways();
    geofs.nav.loadFixes();
})();

/**
 * @param {{name:string,heading:number,lat:number,lon:number,length:number,major:boolean}} a
 */
function add2AList(a) {
    const [,name,icao] = a.name.split('|');
    if (icao && icao.length) {
        const s = a.major ? 1 : 0;
        let ap = aList[s][icao];
        if (ap === undefined) {
            ap = [a.lat, a.lon, name];
        } else {
            const [lat,lon,apName] = ap;
            ap = [(lat+a.lat)/2, (lon+a.lon)/2, apName || name];
        }
        aList[s][icao] = ap;
    }
}