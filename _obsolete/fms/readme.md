# Flight Management System for GeoFS (Obsolete)

## This mod is obsolete since GeoFS 3.8

A very basic FMS for GeoFS using native flight paths for autopilot GPS/VOR/ILS navigation.

- [alpha demo](https://youtu.be/1d1XBDeL_Sc)
- [fmc route import](https://youtu.be/UpVoFMS6Ouw)

## features (alpha preview)

- using the "Create flight path" functions on the map to follow a visual track
- uses native autopilot (as the only thing it does is queue GPS fixes)
- all flight control functionality is base game
- uses the OBS headings to (try to) follow the exact headings (probelmatic on short segments)
- FMC route import, otherwise incompatible with FMC/AP++ (as it's a "casual" replacement)
- uses GPS fixes or available navaids on the map (keep in mind: VOR have a limited range, GPS fixes are unlimited, currently disabled due to range problems)
- audible alert tones for enabling/disabling AP (configurable)

## planned
- VNAV
- Speed control
- some kind of CDU

## problems & bugs
- yes, many
