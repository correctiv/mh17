$(function () {
var M = window.M;

var map = new M.Map($('#map-container'), {
	bounds: {
		n: 51, s: 46, w: 35, e: 41
	},
	width: 600,
	height: 600
});

var HALFPI = Math.PI/2;

function s (px) {
	return px * window.devicePixelRatio;
}

map.addLayer('raster');
map.addLayer('geography');
map.addLayer('places');

map.layers.raster.always(function() {
	this.drawImage('images/map.jpg', {
		se: [47.825696220889604, 39.21293632536268],
		nw: [27.797508301428522, 53.546269658694584]
	});
});
$.getJSON('data/ukraine.geojson', map.layers.geography.drawGeoJSON);
$.get('data/places.tsv', function (data) {
	var rows = data.trim().split("\n");
	var headers = rows.shift().split("\t");
	var places = rows.map(function(row) {
		var r = {};
		row.split("\t").forEach(function (v, i) {
			var n = +v;
			r[headers[i]] = isNaN(n)? v : n;
		});
		return r;
	});
	places.forEach(function (place) {
		map.layers.places.always(function () {
			this.drawCircle([place.x, place.y], 10-place.scalerank);
		});
	});
});

var arrivedAlpha = .04;
var underwayAlpha = .6;

var opts = { projected: true }
var arrived = map.addLayer('arrived', opts);
var underway = map.addLayer('underway', opts);
var hotspots = map.addLayer('hotspots', { interactive: true, projected: true });
underway.ctx.lineWidth = 3;
underway.ctx.textAlign = 'right';
underway.ctx.textBaseline = 'bottom';
arrived.ctx.lineWidth = 3;
arrived.ctx.globalAlpha = arrivedAlpha;

$.getJSON('data/flights.json', M.flights.pushBulk);
M.flights.on('bulkpushed', M.clock.init);

hotspots.on('mouseenter', function (flight) {
	hoverFlight = flight;
});
hotspots.on('mouseleave', function () {
	hoverFlight = null;
});

var hoverFlight;
var previouslyArrived = [];

function drawFlightLabel (flight) {
	var angle = flight.heading;
	var textAlign = 'right';
	var xAnchor = -5;
	if (angle > HALFPI) {
		angle -= Math.PI;
		textAlign = 'left';
		xAnchor *= -1;
	} else if (angle < -HALFPI) {
		angle += Math.PI;
		textAlign = 'left';
		xAnchor *= -1;
	}

	underway.rotateTranslateDo(flight.position, angle, function () {
		this.textAlign = textAlign;
		this.fillText(flight.object.number, s(xAnchor), s(-15));
		this.fillText(flight.object.start+'—'+flight.object.end, s(xAnchor), s(-5));
	});
}

var planeMarker = $('<img src="images/plane.png">')[0];
function drawPlaneMarker (flight) {
	underway.drawMarker(planeMarker, flight.position, flight.heading);
}
function drawMH17Marker (flight) {
	underway.ctx.save();
	underway.ctx.fillColor = 'rgba(255,0,0,.5)';
	underway.drawCircle(flight.position, 20);
	underway.ctx.restore();
}

M.clock.on('tick', function (time) {
	var flights = M.flights.until(time);

	function drawUnderway (flight) {
		// Fade out flights that are about to arrive
		if (flight.object === hoverFlight) {
			drawFlightLabel(flight);
		}
		if (flight.object.number === 'MH17') {
			drawMH17Marker(flight);
		}
		drawPlaneMarker(flight);
		var untilArrival = Math.min(1, (flight.object.route.latest - time)/300000);
		underway.ctx.globalAlpha = arrivedAlpha + untilArrival * (underwayAlpha - arrivedAlpha);
		underway.drawLine(flight.route);
		hotspots.drawHotspot(flight.position, 15, flight.object);
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
