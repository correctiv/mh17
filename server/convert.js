var fs = require('fs');
var simplify = require('simplify-js');

var result = JSON.parse(fs.readFileSync('data/raw.json'));
var flights = result.hits.hits.map(function (r) { return r._source });

var bounds = {
	n: 57, s: 43, w: 23, e: 47
}

function checkBounds (point) {
	return (
		point[0] >= bounds.w && point[0] <= bounds.e &&
		point[1] >= bounds.s && point[1] <= bounds.n
	);
}

function xRel (l) { return l[0] / 180; }
function yRel (l) { return Math.log(Math.tan(Math.PI/4+l[1]*(Math.PI/180)/2)) / Math.PI; }

flights = flights.map(function (flight) {
	var f = [];
	var route = flight.route.coordinates.map(function (point, i) {
		var profilePoint = flight.profile[i];
		// { q: 'squawk', h: heading, s: groundSpeed, t: 'time', a: altitude }
		return [point[0], point[1], profilePoint.a, profilePoint.t];
	}).filter(checkBounds);

	if (route.length === 0) return;

	route = simplify(route, .02, true);
	route.forEach(function project (point) {
		var x = xRel(point), y = yRel(point);
		point[0] = x;
		point[1] = y;
	});

	f.push(flight.flight);
	f.push(flight.start.airport);
	f.push(flight.end.airport);
	f.push(route);

	return f;
}).filter(function (e) { return e; });

var s = JSON.stringify(flights);
fs.writeFileSync('data/flights.json', s);
console.log(Math.round(s.length / 1000) + ' kB');
