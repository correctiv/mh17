$(function () {
var M = window.M;

var map = new M.Map($('#map-container'), {
	bounds: {
		n: 51, s: 46, w: 35, e: 41
	},
	width: $(window).width(),
	height: $(window).height()
});

var HALFPI = Math.PI/2;

function s (px) {
	return px * window.devicePixelRatio;
}

var fontFamily = 'sans-serif';

map.addLayer('raster');
map.addLayer('geography');
map.addLayer('places');

map.layers.places.setBaseStyles({
	globalAlpha: .8,
	textAlign: 'center',
	textBaseline: 'middle',
	strokeStyle: '#fff',
	lineWidth: 3,
	lineJoin: 'round'
});

var mapImage = document.createElement('img');
var mapImageBounds = {
	se: [47.825696220889604, 39.21293632536268],
	nw: [27.797508301428522, 53.546269658694584]
};
mapImage.setAttribute('src', 'images/map.jpg');
$.getJSON('data/ukraine.geojson', function (FeatureCollection) {
	$(mapImage).load(function () {
		map.layers.raster.always(function () {
			this.ctx.save();
			this.ctx.globalAlpha = .5;
			this.drawImage(mapImage, mapImageBounds);
			this.ctx.globalAlpha = 1;
			this.prepareGeoJSONPath(FeatureCollection.features[2]);
			this.ctx.clip();
			this.drawImage(mapImage, mapImageBounds);
			this.ctx.restore();
			this.ctx.lineWidth = 2;
			this.ctx.strokeStyle = 'rgba(0,0,0,.2)';
			this.ctx.stroke();
		});
	});
});
$.getJSON('data/urban-areas.geojson', function (FeatureCollection) {
	map.layers.places.always(function (layer) {
		layer.ctx.save();
		layer.ctx.fillStyle = 'rgba(0,0,0,.2)';
		layer.drawGeoJSON(FeatureCollection, function () { this.fill(); });
		layer.ctx.restore();
	});
});
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
	map.layers.places.always(function (layer) {
		places.forEach(function (place) {
			if (place.scalerank > 7) return;
			var size = 14 - place.scalerank;
			layer.ctx.font = s(Math.max(size + 4, 8))+'px ' + fontFamily;
			var name = place.name;
			if (place.scalerank <= 5) layer.ctx.font = 'bold ' + layer.ctx.font;
			layer.strokeFillText(name, [place.x, place.y], 0, 0);
		});
	});
});

var arrivedAlpha = .04;
var underwayAlpha = .25;

var opts = { projected: true }
var arrived = map.addLayer('arrived', opts);
var underway = map.addLayer('underway', opts);
var label = map.addLayer('label', opts);
var hotspots = map.addLayer('hotspots', { interactive: true, projected: true });

underway.setBaseStyles({
	lineWidth: 3,
	lineJoin: 'round'
});
arrived.setBaseStyles({
	lineWidth: 3,
	globalAlpha: arrivedAlpha,
	lineJoin: 'round'
});
label.setBaseStyles({
	font: s(14) + 'px ' + fontFamily,
	lineWidth: 3,
	textAlign: 'right',
	textBaseline: 'middle',
	lineJoin: 'round',
	strokeStyle: '#fff'
});

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
	var xAnchor = -20;
	if (angle > HALFPI) {
		angle -= Math.PI;
		textAlign = 'left';
		xAnchor *= -1;
	} else if (angle < -HALFPI) {
		angle += Math.PI;
		textAlign = 'left';
		xAnchor *= -1;
	}

	var vOffset = 8;
	var topLine = flight.object.number;
	var bottomLine = flight.object.start + '—' + flight.object.end;
	if (bottomLine === '—') {
		bottomLine = '';
		vOffset = 0;
	} else if (topLine === '') {
		vOffset = 0;
	}
	if (topLine === '' && bottomLine === '') {
		bottomLine = '(keine Daten)';
	}

	label.rotateTranslateDo(flight.position, angle, function () {
		this.ctx.textAlign = textAlign;
		this.ctx.strokeText(bottomLine, s(xAnchor), s(vOffset));
		this.ctx.fillText(bottomLine, s(xAnchor), s(vOffset));
		this.ctx.font = 'bold ' + this.ctx.font;
		this.ctx.strokeText(topLine, s(xAnchor), s(-vOffset));
		this.ctx.fillText(topLine, s(xAnchor), s(-vOffset));
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
		var untilArrival = Math.min(1, (flight.object.route.latest - time)/300000);
		var alpha = arrivedAlpha + untilArrival * (underwayAlpha - arrivedAlpha);
		underway.ctx.save();
		if (flight.object === hoverFlight) {
			drawFlightLabel(flight);
		}
		if (flight.notify) {
			drawMH17Marker(flight);
		}
		underway.ctx.globalAlpha = 2*alpha;
		drawPlaneMarker(flight);
		underway.ctx.globalAlpha = alpha;
		underway.drawLine(flight.route);
		hotspots.drawHotspot(flight.position, 15, flight.object);
		underway.ctx.restore();
	}
	function drawArrived (flight) {
		arrived.drawLine(flight.route);
	}

	underway.clear();
	hotspots.clear();
	label.clear();
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

var resizeTimeout;
var resizeHandler = function () {
	map.setDimensions($(window).width(), $(window).height());
}
$(window).resize(resizeHandler);
});
