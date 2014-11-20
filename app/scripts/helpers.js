window.H = (function () {
	
	// Returns all items that are in b but not in a
	function diffArray (a, b, accessor) {
		accessor = accessor || function (e) { return e; };
		var inA = a.map(accessor);
		return b.filter(function (e) {
			return inA.indexOf(accessor(e)) < 0;
		});
	}

	return {
		array: { diff: diffArray }
	}
})();
