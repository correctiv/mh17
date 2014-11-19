(function () {
	var module = {};
	var eventListeners = {};
	var undefined;

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
			point[0] = +(new Date(point[0]));
		});
		this.earliest = points[0][0];
		this.latest = points[points.length-1][0];
		this.points = points;
		this.interpolate = new M.Interpol(points, [{ key: 0, name: 'time' }]);
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
			var pos = flight.route.interpolate.by.time(time);
			return {
				number: flight.number,
				start: flight.start,
				end: flight.end,
				position: pos
			}
		});
	}

	module.push = push;
	module.pushBulk = pushBulk;
	module.at = { time: atTime };
	module.raw = flights;
	module.on = addEventListener;

	M.flights = module;

})();
