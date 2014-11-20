window.M.Map = function (container, options) {
	var o = {};

	var parent = this;
	var $container = $(container);
	this.layers = {};

	var bounds = {};

	// Will be called at the very end of the class definition
	function init () {
		this.setDimensions({ width: options.width, height: options.height });
		this.setBounds(options.bounds);
	}

	// Helper functions
	function s (px) {
		return px * window.devicePixelRatio;
	}

	// GeoJSON functions
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
		return o.width * (xR - bounds.w) / (bounds.e - bounds.w);
	}
	function yAbs (yR) {
		return o.height * (yR - bounds.n) / (bounds.s - bounds.n);
	}

	function x (l) { return xAbs(xRel(l)); }
	function y (l) { return yAbs(yRel(l)); }


	function Layer (name, options) {
		var $canvas = $('<canvas>');
		var canvas = $canvas[0];
		var ctx = canvas.getContext('2d');
		$canvas.attr('id', 'map-layer-'+name);
		$container.append($canvas);
		options = options || {};

		var lX = x;
		var lY = y;

		if (options.projected) {
			lX = function (pt) { return xAbs(pt[0]); };
			lY = function (pt) { return yAbs(pt[1]); };
		}

		ctx.fillStyle = '#000';
		ctx.strokeStyle = '#000';

		ctx.fillRect(0,0, 50, 50);

		this._updateDimensions = function () {
			setHeight(o.height);
			setStyle(o.width);
		}

		function setStyle (w) {
			if (w === undefined) return;
			$canvas.attr('width', s(w));
			$canvas.css('width', w + 'px');
		}

		function setHeight (h) {
			if (h === undefined) return;
			$canvas.attr('height', s(h));
			$canvas.css('height', h + 'px');
		}

		var styles = (function () {
			var backup = {};
			function set (styles, makeBackup) {
				if (makeBackup === undefined) makeBackup = true;
				for (var property in styles) {
					if (makeBackup) backup[property] = styles[property];
					ctx[property] = styles[property];
				}
			}
			function restore () {
				set(backup, false);
				backup = {};
			}
			return {
				set: set,
				restore: restore
			}
		})();

		this.drawGeoJSON = function (features) {
			features.forEach(function (feature) {
				project[feature.type](feature);

				styles.set(feature.properties.style);
				ctx.beginPath();
				renderPath[feature.geometry.type].call(ctx, feature.geometry.coordinates);
				feature.properties.draw.forEach(function (action) {
					ctx[action]();
				});
				styles.restore();
			});
		}

		this.drawLine = function (points) {
			ctx.beginPath();
			this.moveTo(points[0]);
			points.slice(1).forEach(this.lineTo);
			ctx.stroke();
		}

		this.moveTo = function (point) {
			ctx.moveTo(s(lX(point)), s(lY(point)));
		}

		this.lineTo = function (point) {
			ctx.lineTo(s(lX(point)), s(lY(point)));
		}

		this.drawCircle = function (point, r) {
			console.log(s(lX(point)), s(lY(point)));
			ctx.beginPath();
			ctx.arc(s(lX(point)), s(lY(point)), s(r), 0, 2 * Math.PI);
			ctx.fill();
		}

		this.drawMarker = function (point) {
			this.drawCircle(point, 5);
		}

		this.clear = function () {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
		}

		this.delete = function () {
			$canvas.remove();
			delete parent.layers[name];
		}

		this.ctx = ctx;
		this._updateDimensions();
	}

	this.addLayer = function (name, options) {
		var l = new Layer(name, options);
		parent.layers[name] = l;
		return l;
	}

	this.setDimensions = function (dimensions) {
		for (var name in this.layers) {
			this.layers[name]._setDimensions(dimensions);
		}
		$.extend(o, dimensions);
		$container.css(dimensions);
	}

	this.setBounds = function (b) {
		var nw = [b.w, b.n];
		var se = [b.e, b.s];
		bounds.w = xRel(nw);
		bounds.n = yRel(nw);
		bounds.e = xRel(se);
		bounds.s = yRel(se);
	}

	init.call(this);
}
