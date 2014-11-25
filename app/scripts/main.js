$(function () {
'use strict';
var HALFPI = Math.PI/2;
var $window = $(window);

function s (px) {
	return px * window.devicePixelRatio;
}

var fontFamily = 'sans-serif';

var template = 'http://tiles.odcdn.de/odcm/{Z}/{X}/{Y}.png';
var provider = new MM.TemplatedLayer(template);
var map = new MM.Map('map-container', provider);
var bounds = {
	nw: new MM.Location(51, 41),
	se: new MM.Location(46, 35)
}
map.setExtent([bounds.nw , bounds.se]);
// map.coordLimits = [
// 	map.locationCoordinate(bounds.nw).zoomTo(5),
// 	map.locationCoordinate(bounds.se).zoomTo(12)
// ];


var overlay = new M.Overlay($('#map-container'), {
	bounds: {
		n: 51, s: 46, w: 35, e: 41
	},
	width: $window.width(),
	height: $window.height()
});

var reference;

function updateReference () {
	var origin = map.locationPoint(new MM.Location(0, 0));
	var sw = map.locationPoint(new MM.Location(-85.05113, 180));

	reference = {
		origin: origin,
		sw: sw,
		delta: { x: sw.x - origin.x, y: sw.y - origin.y }
	};
}

function updateBounds () {
	var margin = 0;
	var nw = scalePoint([-margin, -margin]);
	var se = scalePoint([$window.width()+margin, $window.height()+margin]);
	var bounds = {
		n: nw[1],
		e: se[0],
		s: se[1],
		w: nw[0]
	};
	overlay.setBounds(bounds);
}

function unscalePoint (point) {
	return [ 
		reference.origin.x + reference.delta.x * point[0],
		reference.origin.y - reference.delta.y * point[1]
	];
}

function scalePoint (point) {
	return [
		(point[0] - reference.origin.x) / reference.delta.x,
		(point[1] - reference.origin.y) / (-reference.delta.y)
	];
}

map.addCallback('drawn', updateReference);
map.addCallback('drawn', updateBounds);
map.addCallback('drawn', function () { drawFlights(null, true); });

var nofly = overlay.addLayer('nofly');
nofly.setBaseStyles({
	fillStyle: 'rgba(0,0,0,.2)'
});
$.getJSON('data/no-fly.geojson', function (FeatureCollection) {
	nofly.projectGeoJSON(FeatureCollection);
	nofly.always(function () {
		nofly.drawGeoJSON(FeatureCollection, function (ctx) {
			ctx.fill();
		});
	})
});

var arrivedAlpha = .04;
var underwayAlpha = .25;

var arrived = overlay.addLayer('arrived');
var underway = overlay.addLayer('underway');
var label = overlay.addLayer('label');
var hotspots = overlay.addLayer('hotspots', { interactive: true });

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

var planeMarker = $('<img src="images/plane.svg">')[0];
function drawPlaneMarker (flight) {
	underway.drawMarker(planeMarker, flight.position, flight.heading);
}
function drawMH17Marker (flight) {
	underway.ctx.save();
	underway.ctx.fillColor = 'rgba(255,0,0,.5)';
	underway.drawCircle(flight.position, 20);
	underway.ctx.restore();
}

var drawFlights = (function () {
	var previouslyArrived = [];

	return function (time, clearAll) {
		time = M.clock.time();
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

		if (flights.arrived.length > previouslyArrived.length && !clearAll) {
			H.array.diff(
				previouslyArrived,
				flights.arrived,
				function (f) { return f.object.id; }
			).forEach(drawArrived);
		} else if (flights.arrived.length < previouslyArrived.length || clearAll) {
			// We're going back in time!
			arrived.clear();
			flights.arrived.forEach(drawArrived);
		}
		previouslyArrived = flights.arrived;
	}
})();

M.clock.on('tick', drawFlights);

var resizeTimeout;
var resizeHandler = function () {
	overlay.setDimensions($window.width(), $window.height());
}
$window.resize(resizeHandler);

});
