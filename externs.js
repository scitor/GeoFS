var geofs = {
    api: {
        map: {
            addRunwayMarker: function (a) {},
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
    randomJobs: {},
    nav: {
        fixes: {},
        removeNavaid: function() {}
    },
    isPaused: function() {},
    flightPlan: {
        waypointArray: [],
        refreshWaypoints: function () {},
        selectWaypoint: function () {}
    }
};
var weather;
var flight = {
  recorder: {
    makeRecord: function() {}
  }};
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
}
$.prototype.hide = function(){};
$.prototype.show = function(){};
var localStorage;
var METAR;