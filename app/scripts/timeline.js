M.timeline = (function () {
	function hour (time) { return (new Date(time)).getHours(); }
	function day (time) { return (new Date(time)).getDate(); }
	function month (time) { return (new Date(time)).getMonth(); }

	var scaleFactor = window.devicePixelRatio;

	var timeScale = 4/6e5; // pixels per millisecond

	function s (value) {
		// Returns a value scaled by a pre-set factor
		// Intended to simplify drawing for high-res displays
		return value * scaleFactor;
	}
	function font(ctx, fontSize) {
		fontSize = fontSize || 9;
		ctx.font = s(fontSize)+"pt "+$(document.body).css('font-family');
	}

	var defaults = {
		strokeStyle: '#999',
		fillStyle: '#000',
		lineWidth: s(1/window.devicePixelRatio)
	}
	var countGraph = {
		strokeStyle: 'rgba(0, 132, 186, .2)',
		fillStyle: 'rgba(0, 132, 186, .1)',
		lineWidth: defaults.lineWidth
	}

	function coordinates (/* time, [referenceTime,] layout */) {
		var time, referenceTime, layout;
		time = arguments[0];
		layout = arguments[arguments.length - 1];
		if (arguments.length > 2) referenceTime = arguments[1];
		else referenceTime = M.clock.earliest();
		
		var coords;
		var offset = time - referenceTime;
		
		({
			timeline: function () {
				coords = { x: offset * timeScale };
			}
		})[layout]();
		return coords;
	}

	function setCanvasSize (canvas, width, height) {
		canvas.setAttribute('width', s(width));
		canvas.setAttribute('height', s(height));
		canvas.style.width = width + 'px';
		canvas.style.height = height + 'px';
	}

	function timelineGraph (now, canvas) {
		if (!canvas) canvas = document.createElement('canvas');
		now = M.clock.earliest();
		var $canvas = $(canvas);

		var width = (M.clock.latest()-now)*timeScale;
		var height = $canvas.height();
		$canvas.attr('width', s(width));
		$canvas.attr('height', s(height));
		$canvas.css({width: width + 'px', height: height + 'px'});

		function xCenter (val) {
			return val + 0.5;// + width * 0.5;
		}

		var ctx = canvas.getContext('2d');
		ctx.clearRect(0, 0, s(width), s(height));

		var current = M.clock.earliest(), end = M.clock.latest();

		// Draw diagram
		var planeCounts = [];
		while (current < end) {
			planeCounts.push( { time: current, count: M.flights.until(current).underway.length } );
			current += 3e5;
		}
		var maxPlaneCount = 30;
		ctx.beginPath();
		ctx.moveTo(0, s(height));
		planeCounts.forEach(function(count) {
			var x = coordinates(count.time, now, 'timeline').x;
			var y = height - height * count.count / (1.2*maxPlaneCount);
			ctx.lineTo(s(xCenter(x)), s(y));
		});
		ctx.lineTo(width, s(height));

		ctx.strokeStyle = countGraph.strokeStyle;
		ctx.fillStyle = countGraph.fillStyle;
		ctx.lineWidth = countGraph.lineWidth;

		ctx.stroke();
		ctx.fill();

		ctx.strokeStyle = defaults.strokeStyle;
		ctx.fillStyle = defaults.fillStyle;
		ctx.lineWidth = defaults.lineWidth;
		font(ctx, 9);
		ctx.textAlign = 'center';
		ctx.textBaseline = 'top';

		// Draw ticks
		current = moment.tz(M.clock.earliest(), M.settings.timezone).startOf('hour');
		end = moment.tz(M.clock.latest(), M.settings.timezone);
		while (current.isBefore(end)) {
			var x = coordinates(current, now, 'timeline').x;
			if (x >= 0 || x <= width) {
				var tickHeight;
				var h = current.hour();
				if (h === 0) {
					tickHeight = .2*height;
				} else if (h === 12) {
					tickHeight = .15*height;
				} else {
					tickHeight = .1*height;
				}
				if (h % 6 === 0) ctx.fillText(h, s(xCenter(x)), s(tickHeight));
				ctx.beginPath();
				ctx.moveTo(s(xCenter(x)), 0);
				ctx.lineTo(s(xCenter(x)), s(tickHeight));
				ctx.stroke();
				current.add(1, 'hour');
			}
		}

		return canvas;

		// Draw current time marker
		ctx.lineWidth = s(2);
		ctx.beginPath();
		ctx.moveTo(s(xCenter(0)), 0);
		ctx.lineTo(s(xCenter(0)), s(height));
		ctx.stroke();

		return canvas;
	}

	return {timeline: timelineGraph, timeScale: timeScale};
})();


M.timeHUD = (function () {
	var $element,
	$day,	$month,	$year,	$hour,	$minute;

	var months = ('Jan Feb Mär Apr Mai Jun Jul Aug Sep Okt Nov Dez').split(' ');
	
	function zerofill (number, length) {
		number = '' + number;
		for (var i = number.length; i<length; i++) {
			number = '0' + number;
		}
		return number;
	}

	function updateTime (time) {
		time = moment.tz(time, M.settings.timezone);
		$day.text(zerofill(time.date(), 2));
		$month.text(months[time.month()]);
		$year.text(time.year());
		$hour.text(zerofill(time.hours(), 2));
		$minute.text(zerofill(time.minutes(), 2));
	}

	function init (element) {
		$element = $(element);
		$day = $element.find('.js-day');
		$month = $element.find('.js-month');
		$year = $element.find('.js-year');
		$hour = $element.find('.js-hour');
		$minute = $element.find('.js-minute');
		M.clock.on('tick', updateTime);
	}

	return {
		init: init
	}
})();

$(function () {
	var timeScale = 1/M.timeline.timeScale;
	var drawn = false;

	function moveTimeline (time) {
		if (!drawn) drawTimeline();
		if (!+time) time = M.clock.time();
		var dTime = time - M.clock.earliest();
		$('#timeline-graph').css('marginLeft', -dTime * M.timeline.timeScale);
	}
	function drawTimeline (time) {
		if (!+time) time = M.clock.time();
		M.timeline.timeline(time, document.getElementById('timeline-graph'));
		drawn = true;
	}
	M.clock.on('tick', moveTimeline);
	$(window).on('resize', moveTimeline);

	var $timeline = $('.timeline-chart');
	var $document = $(document);
	var dragStartX, dragStartSimTime, lastSimTime, lastRealTime, dragging = false, wasRunning;
	$document.on('mousedown', '.timeline-chart', function (event) {
		dragging = true;
		$(document.body).addClass('dragging');
		dragStartX = event.screenX;
		dragStartSimTime = M.clock.time();
		wasRunning = M.clock.running();
		M.clock.pause();
		inertia.stop();
	});
	$document.on('mousemove', function (event) {
		if (!dragging) return;
		event.preventDefault();
		var dX = dragStartX - event.screenX;
		var dTime = dX * timeScale;
		lastSimTime = dragStartSimTime + dTime;
		lastRealTime = Date.now();
		M.clock.set(lastSimTime);
	});
	$document.on('mouseup', function (event) {
		if (!dragging) return;
		dragging = false;
		$(document.body).removeClass('dragging');

		var dX = dragStartX - event.screenX;
		var dTime = dX * timeScale;
		var newSimTime = dragStartSimTime + dTime;
		var newRealTime = Date.now();
		var dragSpeed = (newSimTime - lastSimTime)/(newRealTime - lastRealTime);
		M.clock.set(newSimTime);

		// inertia
		inertia.start(dragSpeed);

		if(wasRunning) M.clock.start();
	});

	var inertia = (function () {
		function timing (dTime, duration) {
			duration = duration || 1000;
			var progress = Math.min(dTime/duration, 1);
			return progress;
		}

		var interval;

		/*return {
			start: function (startSpeed) {
				window.clearInterval(interval);
				var finalSpeed = M.clock.speed();
				var dropRealTime = Date.now();
				interval = window.setInterval(function () {
					var dTime = Date.now() - dropRealTime;
					var factor = timing(dTime);
					M.clock.speed(startSpeed * (1-factor) + finalSpeed * factor);
					if (factor === 1) window.clearInterval(interval);
				}, 20);
			},
			stop: function () {
				window.clearInterval(interval);
			}
		};*/
		return {
			start: function () {},
			stop: function () {}
		}
	})();

	var keyDown = {
		32: function spaceKey (ev) { ev.preventDefault(); $('#button-play-pause').addClass('active'); },
		37: function leftKey (ev) { ev.preventDefault; M.clock.set(M.clock.time() - (ev.shiftKey? 36e5 : 6e4)) },
		39: function rightKey (ev) { ev.preventDefault; M.clock.set(M.clock.time() + (ev.shiftKey? 36e5 : 6e4)) }
	}
	var keyUp = {
		32: function spaceKey () { $('#button-play-pause').removeClass('active').click(); }
	}
	$(document).keydown(function (event) {
		try { keyDown[event.keyCode](event); } catch (e) {}
	});
	$(document).keyup(function (event) {
		try { keyUp[event.keyCode](event); } catch (e) {}
	});

	$('#button-play-pause').click(function () {
		var $this = $(this);
		if (M.clock.paused()) {
			M.clock.start();
			$this.addClass('playing').removeClass('paused');
		} else {
			M.clock.pause();
			$this.addClass('paused').removeClass('playing');
		}
	});
	$('.slider-simulation-speed').on('mousemove change', function () {
		var speed = Math.pow(parseInt($(this).val(), 10) * 0.5, 3);
		$(document.body).toggleClass('backwards', speed < 0);
		M.clock.speed(speed);
	});
	M.timeHUD.init('.timeline-time-hud');

});
