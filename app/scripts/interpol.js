(function () {
var undefined;

function OutOfRange () { };
var BeforeStart = new OutOfRange();
var AfterEnd = new OutOfRange();

/* Usage:
var interpolate = new Interpol( [[0, 0], [5, 10]], 0 );
interpolate.by(2); //=> [2, 4];
*/

function makeNewEmpty(object) {
	return (Object.prototype.toString.call(object) === '[object Array]')? [] : {};
}

var Interpol = function (points, key) {
	var me = this;

	function mix (leftPoint, rightPoint, relativePosition) {
		var o = makeNewEmpty(leftPoint);
		for (var key in leftPoint) {
			var val = leftPoint[key] * (1 - relativePosition)
				+ rightPoint[key] * relativePosition;
			if (!isNaN(val)) o[key] = val;
		}
		return o;
	}

	function find (value) {
		var leftIndex = points.length - 1;

		if (points[leftIndex][key] < value) return AfterEnd;
		if (points[0][key] > value) return BeforeStart;

		while (leftIndex >= 0 && points[leftIndex][key] > value) leftIndex--;

		var rightIndex = Math.min(leftIndex + 1, points.length - 1);

		var deltaRightLeft = points[rightIndex][key] - points[leftIndex][key];
		var deltaValueLeft = value - points[leftIndex][key];
		var relativePosition = deltaValueLeft/deltaRightLeft;

		return [leftIndex, rightIndex, relativePosition];
	}

	function interpolate (value) {
		var p = find(value);
		if (p instanceof OutOfRange) return false;
		return mix(points[p[0]], points[p[1]], p[2]);
	}

	function interpolateUpTo (value) {
		var p = find(value);
		if (p === BeforeStart) return false;
		var r = points.slice(0, p[1]);
		r.push(mix(points[p[0]], points[p[1]], p[2]));
		return r;
	}

	this.by = interpolate;
	this.until = interpolateUpTo;
}

window.M.Interpol = Interpol;

})();
