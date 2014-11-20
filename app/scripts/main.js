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
arrived.ctx.globalAlpha = .08;

$.getJSON('data/flights.json', M.flights.pushBulk);
M.flights.on('bulkpushed', M.clock.init);

var previousArrivedLength = 0;
var previouslyArrived = [];

function drawFlight (layer) {
	return function (flight) {
		var alpha = layer.ctx.globalAlpha || 1;
		var route = flight.route;
		for (var i = 0, l = route.length; i < l-1; i++) {
			layer.ctx.beginPath();
			layer.moveTo(route[i]);
			layer.lineTo(route[i+1]);
			var opacity = route[i][2] / 45000;
			opacity *= opacity;
			layer.ctx.globalAlpha = opacity * alpha;
			layer.ctx.stroke();
		}
		layer.ctx.globalAlpha = alpha;
	}
}

M.clock.on('tick', function (time) {
	var flights = M.flights.until(time);

	underway.clear();
	flights.underway.forEach(drawFlight(underway));
	if (flights.arrived.length > previouslyArrived.length) {
		H.array.diff(
			previouslyArrived,
			flights.arrived,
			function (f) { return f.object.id; }
		).forEach(drawFlight(arrived));
	} else if (flights.arrived.length < previouslyArrived.length) {
		// We're going back in time!
		arrived.clear();
		flights.arrived.forEach(drawFlight(arrived));
	}
	previouslyArrived = flights.arrived;
});
});
