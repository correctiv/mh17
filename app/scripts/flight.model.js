(function () {
	var module = {};
	var eventListeners = {};
	var undefined;
	var dateKey = 2;

	var earliest = Infinity, latest = 0;

	function addEventListener (listener, callback) {
		if (!eventListeners[listener]) eventListeners[listener] = [];
		eventListeners[listener].push(callback);
	}

	function trigger (listener, data) {
		if (eventListeners[listener]) {
			eventListeners[listener].forEach(function (cb) {
				cb(data);
			});
		}
	}

	function Route (points) {
		points.forEach(function (point) {
			point[dateKey] = +(new Date(point[dateKey]));
		});
		this.earliest = points[0][dateKey];
		this.latest = points[points.length-1][dateKey];
		this.points = points;
		this.interpolate = new M.Interpol(points, dateKey);
	}

	var flights = [];
	var currentId = 0;

	function push (flight) {
		var route = new Route(flight.pop());
		earliest = Math.min(earliest, route.earliest);
		latest = Math.max(latest, route.latest);

		flights.push({
			id: (currentId++),
			number: flight.shift(),
			start: flight.shift(),
			end: flight.shift(),
			route: route
		});
	}

	function pushBulk (flights) {
		flights.forEach(push);
		trigger('bulkpushed', { earliest: earliest, latest: latest, time: earliest, speed: 50, caffeinated: true });
	}

	function calculateHeading (route) {
		var end   = route[route.length-1];
		var start = route[route.length-2] || end;
		var dx = end[0] - start[0];
		var dy = end[1] - start[1];
		return -Math.atan2(dy, dx);
	}

	function untilTime (time) {
		var r = { underway: [], arrived: [] };
		flights.forEach(function (flight) {
			if (time < flight.route.earliest) return;
			var route = flight.route.interpolate.until(time);
			var heading = calculateHeading(route);
			var dest = (time < flight.route.latest)? r.underway : r.arrived;
			dest.push({
				object: flight,
				heading: heading,
				position: route[route.length-1],
				route: route
			});
		});
		return r;
	}

	module.push = push;
	module.pushBulk = pushBulk;
	module.until = untilTime;
	module.raw = flights;
	module.on = addEventListener;

	M.flights = module;

})();
