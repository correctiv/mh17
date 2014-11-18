var fs = require('fs');
var simplify = require('simplify-js');

var result = JSON.parse(fs.readFileSync('data/raw.json'));
var flights = result.hits.hits.map(function (r) { return r._source });

flights = flights.map(function (flight) {
	var f = [];
	var route = flight.route.coordinates.map(function (point, i) {
		var profilePoint = flight.profile[i];
		// { q: 'squawk', h: heading, s: groundSpeed, t: time, a: altitude }
		return [profilePoint.t, point[0], point[1], profilePoint.a];
	});

	f.push(flight.flight);
	f.push(flight.start.airport);
	f.push(flight.end.airport);
	f.push(simplify(route, .2, true));

	return f;
});

fs.writeFileSync('data/flights.json', JSON.stringify(flights));
