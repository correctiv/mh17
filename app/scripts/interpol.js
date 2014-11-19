(function () {
var undefined;

/* Usage:
var interpolate = new Interpol( [[0, 0], [5, 10]], [{ name: 'time', key: 0 }] );
interpolate.by.time(2); //=> [2, 4];
*/

function makeNewEmpty(object) {
	return (Object.prototype.toString.call(object) === '[object Array]')? [] : {};
}

var Interpol = function (points, interpolators) {
	var me = this;
	this.by = {};

	function mix (leftPoint, rightPoint, relativePosition) {
		var o = makeNewEmpty(leftPoint);
		for (key in leftPoint) {
			var val = leftPoint[key] * (1 - relativePosition)
				+ rightPoint[key] * relativePosition;
			if (!isNaN(val)) o[key] = val;
		}
		return o;
	}

	interpolators.forEach(function (i) {
		var key = i.key;
		var name = '' + (i.name || key);

		function interpolate (value) {
			var leftIndex = points.length - 1;
			if (points[leftIndex][key] < value) return false;
			while (leftIndex >= 0 && points[leftIndex][key] > value) {
				leftIndex--;
			}
			if (leftIndex === -1) return false;
			var rightIndex = Math.min(leftIndex + 1, points.length - 1);

			var deltaRightLeft = points[rightIndex][key] - points[leftIndex][key];
			var deltaValueLeft = value - points[leftIndex][key];
			var relativePosition = deltaValueLeft/deltaRightLeft;

			return mix(points[leftIndex], points[rightIndex], relativePosition);
		}
		me.by[name] = interpolate;
	});
}

window.M.Interpol = Interpol;

})();
