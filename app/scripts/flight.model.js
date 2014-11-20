(function () {
	var module = {};
	var eventListeners = {};
	var undefined;
	var dateKey = 3;

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

	function push (flight) {
		var route = new Route(flight.pop());
		earliest = Math.min(earliest, route.earliest);
		latest = Math.max(latest, route.latest);

		flights.push({
			number: flight.shift(),
			start: flight.shift(),
			end: flight.shift(),
			route: route
		});
	}

	function pushBulk (flights) {
		flights.forEach(push);
		trigger('bulkpushed', { earliest: earliest, latest: latest, time: earliest });
	}

	function atTime (time) {
		return flights.map(function (flight) {
			if (time < flight.route.earliest || time > flight.route.latest) return;
			var pos = flight.route.interpolate.by(time);
			return {
				number: flight.number,
				start: flight.start,
				end: flight.end,
				position: pos
			}
		});
	}

	function untilTime (time) {
		return flights.map(function (flight) {
			if (time < flight.route.earliest) return;
			var pos = flight.route.interpolate.until(time);
			return {
				number: flight.number,
				start: flight.start,
				end: flight.end,
				route: pos
			}
		});
	}

	module.push = push;
	module.pushBulk = pushBulk;
	module.at = atTime;
	module.until = untilTime;
	module.raw = flights;
	module.on = addEventListener;

	M.flights = module;

})();
