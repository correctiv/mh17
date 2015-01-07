$(function () {
'use strict';
var HALFPI = Math.PI/2;
var $window = $(window);

FastClick.attach(document.body);
$('input[type="range"]').rangeslider({polyfill:false});

function s (px) {
	return px * window.devicePixelRatio;
}

var fontFamily = 'sans-serif';

var template = '//tiles.odcdn.de/mh17/{Z}/{X}/{Y}.png';
var provider = new MM.TemplatedLayer(template);
var map = new MM.Map('map-container', provider, null, [
	// new MM.DragHandler(map),
	// new MM.DoubleClickHandler(map),
	// Allow smooth zooming
	// new MM.MouseWheelHandler(map).precise(true)
]);
var bounds = {
	nw: new MM.Location(51, 41),
	se: new MM.Location(46, 35)
}
map.setExtent([bounds.nw , bounds.se], true);
map.coordLimits = [
	map.locationCoordinate(bounds.nw).zoomTo(5),
	map.locationCoordinate(bounds.se).zoomTo(12)
];
provider.tileLimits = map.coordLimits;

$window.resize(function () {
	map.setExtent([bounds.nw , bounds.se], true);
});

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
map.addCallback('drawn', overlay.redraw);
map.addCallback('drawn', function () { drawFlights(null, true); });

var nofly = overlay.addLayer('nofly');
nofly.setBaseStyles({
	fillStyle: 'rgba(0,0,0,.2)',
	font: s(14)+'px '+fontFamily,
	textAlign: 'center',
	textBaseline: 'middle'
});
$.getJSON('data/no-fly.geojson', function (FeatureCollection) {
	nofly.projectGeoJSON(FeatureCollection);
	nofly.always(function () {
		nofly.ctx.save();
		nofly.drawGeoJSON(FeatureCollection, function (ctx) {
			ctx.fill();
		});
		nofly.ctx.fillStyle = 'rgba(0,0,0,.5)';

		// Hardcoding this couldn't possibly be a bad idea!
		var heightString = (M.params.date === '2014-07-24')? '' : 'unterhalb 9750 m';
		nofly.fillText(heightString, [0.2138, 0.31], 0, 8);
		nofly.ctx.font = 'bold ' + nofly.ctx.font;
		nofly.fillText('Flugverbot', [0.2138, 0.31], 0, -8);
		nofly.ctx.restore();
	})
});

var arrivedAlpha = .04;
var underwayAlpha = .5;

var arrived = overlay.addLayer('arrived');
var underway = overlay.addLayer('underway');
var label = overlay.addLayer('label');
var hotspots = overlay.addLayer('hotspots', { interactive: true });

underway.setBaseStyles({
	lineWidth: s(5),
	lineJoin: 'round'
});
arrived.setBaseStyles({
	lineWidth: s(5),
	globalAlpha: arrivedAlpha,
	lineJoin: 'round'
});
label.setBaseStyles({
	font: s(14) + 'px ' + fontFamily,
	lineWidth: s(3),
	textAlign: 'right',
	textBaseline: 'middle',
	lineJoin: 'round',
	strokeStyle: '#fff'
});

M.params.date = M.params.date || '2014-07-17';
var date = M.params.date;
$('.js-date-'+date).addClass('selected');
$.getJSON('data/'+date+'.json', M.flights.pushBulk);
M.flights.on('bulkpushed', M.clock.init);
M.flights.on('bulkpushed', function () {
	if (M.params.t) {
		var time = M.params.t;
		if (isNaN(+time)) time = new Date(time);
		M.clock.time(+time);
	}
	if (M.params.paused) {
		$('#button-play-pause').click();
	}
});
M.flights.on('bulkpushed', function () {
	// Mark the last reported position of MH17
	var mh17 = M.flights.find('Malaysia Airlines 17')[0];
	mh17.notify = true;
	var lastPoint = mh17.route.points[mh17.route.points.length - 1];
	nofly.always(function () {
		this.rotateTranslateDo(lastPoint, 0, function () {
			this.ctx.globalAlpha = .5;
			this.ctx.lineWidth = s(5);
			this.ctx.beginPath();
			this.ctx.moveTo(s(-8), s(-8));
			this.ctx.lineTo(s(8), s(8));
			this.ctx.moveTo(s(-8), s(8));
			this.ctx.lineTo(s(8), s(-8));
			this.ctx.stroke();
			this.ctx.fillStyle = '#000';
			this.ctx.textAlign = 'left';
			this.ctx.fillText('Absturz von MH17', s(15), 0);
		});
	});
});

hotspots.on('mouseenter', function (flight) {
	hoverFlight = flight;
	if (M.clock.paused()) drawFlightLabel(flight);
});
hotspots.on('mouseleave', function () {
	hoverFlight = null;
	if (M.clock.paused()) drawFlights();
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
function drawNotificationMarker (flight, layer, radius) {
	layer = layer || underway;
	layer.ctx.save();
	layer.ctx.globalCompositeOperation = 'darker';
	layer.ctx.globalAlpha = 1;
	layer.ctx.strokeStyle = 'rgba(255,0,0,.5)';
	layer.ctx.lineWidth = s(4);
	layer.drawCircle(flight.position, 20);
	layer.ctx.stroke();
	layer.ctx.restore();
}

var drawFlights = (function () {
	var previouslyArrived = [];
	var allowRumble = true;

	return function (time, clearAll) {
		time = M.clock.time();
		var flights = M.flights.until(time);

		function drawUnderway (flight) {
			// Fade out flights that are about to arrive
			var untilArrival = Math.min(1, (flight.object.route.latest - time)/300000);
			var alpha = arrivedAlpha + untilArrival * (underwayAlpha - arrivedAlpha);
			alpha = Math.max(alpha, arrivedAlpha)
			underway.ctx.save();
			if (hoverFlight && flight.object === hoverFlight.object) {
				drawFlightLabel(flight);
			}
			if (flight.object.notify) {
				drawNotificationMarker(flight);
			}

			underway.ctx.globalAlpha = 1;
			var centerColor = 'rgba(0,0,0,'+alpha+')';
			var edgeColor = 'rgba(0,0,0,'+arrivedAlpha+')';
			underway.drawFadingLine(flight.route, centerColor, edgeColor, 150);

			underway.ctx.globalAlpha = alpha;
			drawPlaneMarker(flight);

			underway.ctx.restore();

			hotspots.drawHotspot(flight.position, 20, flight);
		}
		function drawArrived (flight) {
			if (flight.object.notify) {
				var pos = flight.object.route.points[flight.object.route.points.length-1];
				drawNotificationMarker({ position: pos }, arrived);
				if (allowRumble) M.rumble();
			}
			arrived.drawLine(flight.route);
		}

		underway.clear();
		hotspots.clear();
		label.clear();

		flights.underway.forEach(drawUnderway);
		if (flights.arrived.length > previouslyArrived.length && !clearAll) {
			allowRumble = true;
			H.array.diff(
				previouslyArrived,
				flights.arrived,
				function (f) { return f.object.id; }
			).forEach(drawArrived);
		} else if (flights.arrived.length < previouslyArrived.length || clearAll) {
			// We're going back in time!
			arrived.clear();
			allowRumble = false;
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
