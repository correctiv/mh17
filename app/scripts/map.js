window.M.map = (function () {
	var module = {};

	var o = {};

	var canvas, $canvas, ctx;

	// For high-resolution displays where 1px != 1 device pixel
	function s (px) {
		return px * window.devicePixelRatio;
	}

	// https://gist.github.com/RandomEtc/668577
	var project = {
		'FeatureCollection': function(fc) { fc.features.forEach(project.Feature); },
		'Feature': function(f) { project[f.geometry.type](f.geometry.coordinates); },
		'MultiPolygon': function(mp) { mp.forEach(project.Polygon); },    
		'Polygon': function(p) { p.forEach(project.LineString); },
		'MultiLineString': function(ml) { ml.forEach(project.LineString); },
		'LineString': function(l) { l.forEach(project.Point); },
		'MultiPoint': function(mp) { mp.forEach(project.Point); },    
		'Point': function(c) {
			c[0] = x(c);
			c[1] = y(c);
		}
	}
		
	var renderPath = {
		'MultiPolygon': function(mp) {
			mp.forEach(renderPath.Polygon, this);
		},
		'Polygon': function(p) {
			p.forEach(renderPath.LineString, this);
		},
		'MultiLineString': function(ml) {
			ml.forEach(renderPath.LineString, this);
		},
		'LineString': function(l) {
			this.moveTo(s(l[0][0]), s(l[0][1]));
			l.slice(1).forEach(function(c){
				this.lineTo(s(c[0]), s(c[1]));
			}, this);
		},
		'MultiPoint': function(p) {
			console.warn('MultiPoint geometry not implemented in renderPath');
		},
		'Point': function(p) {
			console.warn('Point geometry not implemented in renderPath');
		}
	};

	// Map projection functions; both take a [lon, lat] array and return
	// a value between -1 and 1.
	function xRel (l) { return l[0] / 180; }
	function yRel (l) { return Math.log(Math.tan(Math.PI/4+l[1]*(Math.PI/180)/2)) / Math.PI; }

	function xAbs (xR) {
		return o.width * (xR - o.bounds.left) / (o.bounds.right - o.bounds.left);
	}
	function yAbs (yR) {
		return o.height * (yR - o.bounds.top) / (o.bounds.bottom - o.bounds.top);
	}

	function x (l) { return xAbs(xRel(l)); }
	function y (l) { return yAbs(yRel(l)); }

	function setWidth (w) {
		o.width = w;
		canvas.width = s(w);
		$canvas.css('width', w);
	}
	function setHeight (h) {
		o.height = h;
		canvas.height = s(h);
		$canvas.css('height', h);
	}
	function setBounds (bounds) {
		if (!o.bounds) o.bounds = {};
		var topLeft = [bounds.left, bounds.top];
		var bottomRight = [bounds.right, bounds.bottom];
		o.bounds.left =   xRel(topLeft);
		o.bounds.right =  xRel(bottomRight);
		o.bounds.top =    yRel(topLeft);
		o.bounds.bottom = yRel(bottomRight);
	}


	function init (c, options) {
		canvas = c;
		$canvas = $(canvas);
		ctx = canvas.getContext('2d');
		setWidth(800);
		setHeight(600);
		setBounds(options.bounds);
		ctx.fillStyle = '#ccc';
	};

	function drawGeoJSON (features) {
		features.forEach(function (feature) {
			project[feature.type](feature);
			ctx.beginPath();
			renderPath[feature.geometry.type].call(ctx, feature.geometry.coordinates);
			ctx.fill();
		});
	}

	function drawFlightRoutes (flights) {
		flights.forEach(function (flight) {
			ctx.beginPath();
			var route = flight[3].map(function(pt) {
				return [pt[1], pt[2]];
			})
			ctx.moveTo(s(x(route[0])), s(y(route[0])));
			route.slice(1).forEach(function (point) {
				ctx.lineTo(s(x(point)), s(y(point)));
			});
			ctx.stroke();
		});
	}

	module.init = init;
	module.drawGeoJSON = drawGeoJSON;
	module.drawFlightRoutes = drawFlightRoutes;
	return module;
})();
