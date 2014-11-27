M.params = (function () {
	var undefined;

	var query = window.location.search.substring(1);
	if (!query) return {};
	var r = {};
	query = query.split('&');
	query.forEach(function (part) {
		var p = part.split('=');
		var val = (p[1] === undefined)? true : p[1];
		r[p[0]] = val;
	});

	return r;
})();
