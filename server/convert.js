var fs = require('fs');
var csv = require('csv');
var simplify = require('simplify-js');

var airports = {};
var airlines = {};

var toDoCount = 3;

fs.createReadStream('data/openflights/airports.csv')
.pipe(csv.parse())
.on('readable', function () {
	while (row = this.read()) {
		if (row[4]) airports[row[4]] = row[2];
	}
})
.on('end', done);

// We'll use both the IATA database and OpenFlights.
// IATA is more reliable, OpenFlights is more complete.
fs.createReadStream('data/iata-airlines.tsv')
.pipe(csv.parse({ delimiter: "\t" }))
.on('readable', function () {
	while (row = this.read()) {
		// if (row[7] === 'N') continue; // Airline is defunct
		var IATA = row[1];
		// Some airlines run e.g. cargo flights under the same IATA code.
		// Why cargo needs an _IATA_ code at all is beyond me.
		if (airlines[IATA]) continue;
		airlines[IATA] = row[0];
	}
})
.on('end', done);

fs.createReadStream('data/openflights/airlines.csv')
.pipe(csv.parse())
.on('readable', function () {
	while (row = this.read()) {
		if (row[7] === 'N') continue; // Airline is defunct
		var IATA = row[3];
		if (airlines[IATA]) continue;
		airlines[IATA] = row[1];
	}
})
.on('end', done);

function done () {
	toDoCount--;
	if (toDoCount === 0) {
		transform();
	}
}

function transform () {
	var result = JSON.parse(fs.readFileSync('data/raw.json'));
	var flights = result.hits.hits.map(function (r) { return r._source });

	var bounds = {
		n: 52, s: 45, w: 34, e: 42
	}

	var includeAltitude = false;

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
			var altitude = profilePoint.a * includeAltitude;
			return [point[0], point[1], altitude, profilePoint.t];
		}).filter(checkBounds);

		if (route.length === 0) return;

		route = simplify(route, .01, true);
		route.forEach(function project (pt) {
			var x = xRel(pt), y = yRel(pt);
			pt[0] = x;
			pt[1] = y;
		});
		if (!includeAltitude) route = route.map(function (pt) {
			return [pt[0], pt[1], pt[3]];
		});

		// This looks like a mistake, but start and end towns only seem reliable
		// when there's also an associated airport code, otherwise they often
		// seem to be a point en route.
		var start = (flight.start.airport !== '')? airports[flight.start.airport] : '';
		var end = (flight.end.airport !== '')? airports[flight.end.airport] : '';

		var airlineCode = flight.flight.substring(0, 2);
		var flightNumber = flight.flight.substring(2);
		if (airlineCode !== '' && airlines[airlineCode]) {
			f.push(airlines[airlineCode] + ' ' + flightNumber);
		} else {
			f.push(flight.flight);
		}

		f.push(start);
		f.push(end);
		f.push(route);

		return f;
	}).filter(function (e) { return e; });

	var s = JSON.stringify(flights);
	fs.writeFileSync('data/flights.json', s);
	console.log(Math.round(s.length / 1000) + ' kB');
}
