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

var opts = { projected: true }
var arrived = map.addLayer('arrived', opts);
var underway = map.addLayer('underway', opts);
underway.ctx.lineWidth = 3;
arrived.ctx.lineWidth = 3;
arrived.ctx.globalAlpha = .05;

$.getJSON('data/flights.json', M.flights.pushBulk);
M.flights.on('bulkpushed', M.clock.init);

var previousArrivedLength = 0;
var previouslyArrived = [];
M.clock.on('tick', function (time) {
	var flights = M.flights.until(time);

	underway.clear();
	flights.underway.forEach(function (flight) {
		underway.drawLine(flight.route);
	});
	if (flights.arrived.length > previouslyArrived.length) {
		H.array.diff(
			previouslyArrived,
			flights.arrived,
			function (f) { return f.object.id; }
		).forEach(function (flight) {
			arrived.drawLine(flight.route);
		});
	} else if (flights.arrived.length < previouslyArrived.length) {
		// We're going back in time!
		arrived.clear();
		flights.arrived.forEach(function (flight) {
			arrived.drawLine(flight.route);
		});
	}
	previouslyArrived = flights.arrived;
});
});
