var fs = require('fs');
var simplify = require('simplify-js');

var result = JSON.parse(fs.readFileSync('data/raw.json'));
var flights = result.hits.hits.map(function (r) { return r._source });

var bounds = {
	n: 57, s: 43, w: 23, e: 47
}

function checkBounds (point) {
	return (
		point[1] >= bounds.w && point[1] <= bounds.e &&
		point[2] >= bounds.s && point[2] <= bounds.n
	);
}

flights = flights.map(function (flight) {
	var f = [];
	var route = flight.route.coordinates.map(function (point, i) {
		var profilePoint = flight.profile[i];
		// { q: 'squawk', h: heading, s: groundSpeed, t: 'time', a: altitude }
		return [profilePoint.t, point[0], point[1], profilePoint.a];
	}).filter(checkBounds);

	if (route.length === 0) return;

	f.push(flight.flight);
	f.push(flight.start.airport);
	f.push(flight.end.airport);
	f.push(simplify(route, .02, true));

	return f;
}).filter(function (e) { return e; });

var s = JSON.stringify(flights);
fs.writeFileSync('data/flights.json', s);
console.log(Math.round(s.length / 1000) + ' kB');
