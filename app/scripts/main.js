$(function () {
var M = window.M;

var map = new M.Map($('#map-container'), {
	bounds: {
		n: 51, s: 46, w: 35, e: 41
	},
	width: 600,
	height: 600
});
map.addLayer('geography');

$.getJSON('data/ukraine.geojson', map.layers.geography.drawGeoJSON);

var arrivedAlpha = .04;
var underwayAlpha = .6;

var opts = { projected: true }
var arrived = map.addLayer('arrived', opts);
var underway = map.addLayer('underway', opts);
var hotspots = map.addLayer('hotspots', { interactive: true, projected: true });
underway.ctx.lineWidth = 3;
arrived.ctx.lineWidth = 3;
arrived.ctx.globalAlpha = arrivedAlpha;

$.getJSON('data/flights.json', M.flights.pushBulk);
M.flights.on('bulkpushed', M.clock.init);

hotspots.on('hotspot', function (flight) {
	hoverFlight = flight;
	console.log(flight);
});

var hoverFlight;
var previouslyArrived = [];

function drawFlightLabel (flight) {
	underway.drawMarker(flight.route[flight.route.length-1]);
}

var planeMarker = $('<img src="images/plane.png">')[0];
function drawPlaneMarker (flight) {
	underway.drawMarker(planeMarker, flight.route[flight.route.length-1], flight.heading);
}

M.clock.on('tick', function (time) {
	var flights = M.flights.until(time);

	function drawUnderway (flight) {
		// Fade out flights that are about to arrive
		if (flight.object === hoverFlight) {
			drawFlightLabel(flight);
		}
		drawPlaneMarker(flight);
		var untilArrival = Math.min(1, (flight.object.route.latest - time)/300000);
		underway.ctx.globalAlpha = arrivedAlpha + untilArrival * (underwayAlpha - arrivedAlpha);
		underway.drawLine(flight.route);
		hotspots.drawHotspot(flight.route[flight.route.length-1], 15, flight.object);
	}
	function drawArrived (flight) {
		arrived.drawLine(flight.route);
	}

	underway.clear();
	hotspots.clear();
	flights.underway.forEach(drawUnderway);

	if (flights.arrived.length > previouslyArrived.length) {
		H.array.diff(
			previouslyArrived,
			flights.arrived,
			function (f) { return f.object.id; }
		).forEach(drawArrived);
	} else if (flights.arrived.length < previouslyArrived.length) {
		// We're going back in time!
		arrived.clear();
		flights.arrived.forEach(drawArrived);
	}
	previouslyArrived = flights.arrived;
});
});
