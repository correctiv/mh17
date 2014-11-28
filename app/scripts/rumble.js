M.rumble = (function () {
	var $body = $(document.body);
	var interval = 20;
	var iterations = 8;

	function rumbleStep (tX, tY) {
		var transform = 'translate('+tX+'px, '+tY+'px)';
		$body.css('transform', transform)
			.css('-ms-transform', transform)
			.css('transform', transform);
	}

	return function rumble () {
		var intvl = setInterval(function () {
			rumbleStep(Math.round(5 - 10 * Math.random()), Math.round(5 - 10 * Math.random()));
		}, interval);
		setTimeout(function () {
			clearInterval(intvl);
			rumbleStep(0, 0);
		}, interval*iterations);
	}
})();
