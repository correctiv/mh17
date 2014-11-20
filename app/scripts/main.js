$(function () {
var M = window.M;

var map = new M.Map($('#map-container'), {
	bounds: {
		n: 57, s: 43, w: 23, e: 47
	},
	width: 800,
	height: 600
});
map.addLayer('geography');

$.getJSON('data/ukraine.geojson', map.layers.geography.drawGeoJSON);

map.addLayer('flightPaths');

$.getJSON('data/flights.json', M.flights.pushBulk);
M.flights.on('bulkpushed', M.clock.init);
M.clock.on('tick', function (time) {
	map.layers.flightPaths.clear();
	var flights = M.flights.until(time);
	flights.forEach(function (flight) {
		if (!flight) return;
		map.layers.flightPaths.drawLine(flight.route);
	});
});
});
