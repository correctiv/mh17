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

	var first = points[0];
	var last = points[points.length-1];
	var range = last[key]-first[key];

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
		// No binary search, but an informed linear search
		if (last[key] <= value) return AfterEnd;
		if (first[0][key] >= value) return BeforeStart;

		var relativeValue = (value - first[key]) / range;
		var i = (relativeValue * points.length-1)|0;

		var found = false;
		while (!found) {
			if (points[i+1][key] <= value) {
				i++;
			} else if (points[i][key] > value) {
				i--;
			} else {
				found = true;
			}
		}
		var relativePosition = (value - points[i][key])/(points[i+1][key] - points[i][key]);

		return [i, i+1, relativePosition];
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
