var geofs = {
    api: {
        map: {
            addRunwayMarker: function (a) {},
            setPathPoints: function (a) {},
            clearPath: function () {},
            stopCreatePath: function () {},
            markerLayers: {tiles: {key: [{runway: {name: ''}}]}},
            _map: {
                distance: function (a, b) {}
            }
        }
    },
    aircraft: {
        instance: {
            getCurrentCoordinates: function () {},
            relativeAltitude: 0,
            groundSpeed: 0,
            brakesOn: false,
            groundContact: false,
            waterContact: false,
            trueAirSpeed: 0
        }
    },
    randomJobs: {}
};
var weather;
var flight;
var ui = {
    panel: {
        show: function () {
        }
    }
};
var jQuery;
function $ (a) {
    this.getJSON = function () {};
    this.get = function () {};
};
$.prototype.hide = function(){};
$.prototype.show = function(){};
var localStorage;
var METAR;
Set.prototype.union = function(){};