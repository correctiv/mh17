$(function () {
var M = window.M;
M.map.init(document.getElementById('main-canvas'), {
	bounds: {
		top: 55, bottom: 45, left: 25, right: 45
	}
});

$.getJSON('data/ukraine.geojson', M.map.draw.geoJSON);
$.getJSON('data/flights.json', M.flights.pushBulk);
M.flights.on('bulkpushed', M.clock.init);
M.clock.on('tick', function (time) {
	M.map.clear();
	M.map.draw.flightRoutes(M.flights.until.time(time));
});
});
