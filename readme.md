# Flight Management System for GeoFS

A very basic FMS for GeoFS using native flight paths for autopilot GPS/VOR/ILS navigation.

- [demo vid](https://youtu.be/1d1XBDeL_Sc)

## features (alpha preview)

- using the "Create flight path" functions on the map to follow a visual track
- uses native autopilot (as the only thing it does is queue GPS fixes)
- all flight control functionality is base game
- uses the OBS headings to (try to) follow the exact headings (probelmatic on short segments)
- incompatible with FMC/AP++ (as it's a "casual" replacement)
- uses GPS fixes or available navaids on the map (keep in mind: VOR have a limited range, GPS fixes are unlimited)

## planned
- FMC route import
- VNAV
- Speed control

## problems & bugs
- yes, many
