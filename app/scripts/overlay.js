window.M.Overlay = function (container, options) {
	var o = {};

	var parent = this;
	var $container = $(container);
	this.layers = {};

	var bounds = {};

	// Will be called at the very end of the class definition
	function init () {
		this.setBounds(options.bounds);
		this.setDimensions(options.width, options.height);
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
			c[0] = xRel(c);
			c[1] = yRel(c);
		}
	}
		
	var renderGeoJSON = {
		'MultiPolygon': function(mp) {
			mp.forEach(renderGeoJSON.Polygon, this);
		},
		'Polygon': function(p) {
			p.forEach(renderGeoJSON.LineString, this);
		},
		'MultiLineString': function(ml) {
			ml.forEach(renderGeoJSON.LineString, this);
		},
		'LineString': function(l) {
			this.moveTo(s(x(l[0])), s(y(l[0])));
			l.slice(1).forEach(function(c){
				this.lineTo(s(x(c)), s(y(c)));
			}, this);
		},
		'MultiPoint': function(p) {
			console.warn('MultiPoint geometry not implemented in renderGeoJSON');
		},
		'Point': function(p) {
			this.fillRect(s(x(p)-5), s(y(p)-5), s(10), s(10));
		}
	};

	// Map projection functions; both take a [lon, lat] array and return
	// a value between -1 and 1.
	function xRel (l) { return l[0] / 180; }
	function yRel (l) { return Math.log(Math.tan(Math.PI/4+l[1]*(Math.PI/180)/2)) / Math.PI; }

	function xAbs (xR) {
		// var abs = o.width * (xR - bounds.w) / (bounds.e - bounds.w);
		// debugger;
		return o.width * (xR - bounds.w) / (bounds.e - bounds.w);
	}
	function yAbs (yR) {
		return o.height * (yR - bounds.n) / (bounds.s - bounds.n);
	}

	function x (l) { return xAbs(l[0]); }
	function y (l) { return yAbs(l[1]); }

	function Layer (name, options) {
		var $canvas = $('<canvas>');
		var canvas = $canvas[0];
		var ctx = canvas.getContext('2d');
		$canvas.attr('id', 'map-layer-'+name);
		$container.append($canvas);
		options = options || {};
		var me = this;

		var baseStyles;

		ctx.fillStyle = '#000';
		ctx.strokeStyle = '#000';

		this._updateDimensions = function () {
			setHeight(o.height);
			setStyle(o.width);
			// this.redraw();
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

		function applyBaseStyles () {
			if (!baseStyles) return;
			baseStyles.forEach(function (style) {
				ctx[style.property] = style.value;
			});
		}

		this.redraw = function () {
			this.clear();
			applyBaseStyles();
			trigger('redraw', me);
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

		var eventHandlers = {};
		this.on = function (event, handler) {
			if (!eventHandlers[event]) eventHandlers[event] = [];
			eventHandlers[event].push(handler);
		}

		this.always = function (handler) {
			this.on('redraw', handler);
			handler.call(me, me);
		}

		function trigger (event, data) {
			if (!eventHandlers[event]) return false;
			eventHandlers[event].forEach(function (h) {
				h.call(me, data);
			});
		}

		this.setBaseStyles = function (s) {
			baseStyles = [];
			for (var property in s) {
				baseStyles.push({ property: property, value: s[property] });
			}
			applyBaseStyles();
		}

		this.projectGeoJSON = function (f) {
			project[f.type](f);
		}

		this.drawGeoJSON = function (FeatureCollection, callback) {
			FeatureCollection.features.sort(function (a, b) {
				return (a.properties.layer||0) - (b.properties.layer||0);
			});

			FeatureCollection.features.forEach(function (feature) {
				ctx.beginPath();
				renderGeoJSON[feature.geometry.type].call(ctx, feature.geometry.coordinates);
				if (callback) callback.call(ctx, ctx);
			});
		}

		this.drawLine = function (points) {
			ctx.beginPath();
			this.moveTo(points[0]);
			points.slice(1).forEach(this.lineTo);
			ctx.stroke();
		}

		this.drawFadingLine = function (points, centerColor, edgeColor, radius) {
			var last = points[points.length-1];
			var cX = s(x(last));
			var cY = s(y(last));
			var grd = ctx.createRadialGradient(cX, cY, 0, cX, cY, s(radius));
			grd.addColorStop(0.000, centerColor);
			grd.addColorStop(1.000, edgeColor);
			ctx.strokeStyle = grd;
			ctx.beginPath();
			this.moveTo(points[0]);
			points.slice(1).forEach(this.lineTo);
			ctx.stroke();
		}

		this.moveTo = function (point) {
			ctx.moveTo(s(x(point)), s(y(point)));
		}

		this.lineTo = function (point) {
			ctx.lineTo(s(x(point)), s(y(point)));
		}

		this.drawCircle = function (point, r) {
			ctx.beginPath();
			ctx.arc(s(x(point)), s(y(point)), s(r), 0, 2 * Math.PI);
		}

		this.drawSquarePoint = function (center, side) {
			ctx.fillRect(s(x(center)-side/2), s(y(center)-side/2), side, side);
		}

		this.drawMarker = function (image, point, angle) {
			if (angle) {
				this.rotateTranslateDo(point, angle, function () {
					ctx.drawImage(image, s(image.width/-2), s(image.height/-2), s(image.width), s(image.height));
				});
			} else {
			}
		}

		this.drawImage = function (image, bounds) {
			bounds = {
				n: y(bounds.nw),
				w: x(bounds.nw),
				s: y(bounds.se),
				e: x(bounds.se)
			}
			var width = s(bounds.e-bounds.w);
			var height = s(bounds.s-bounds.n);
			ctx.drawImage(image, s(bounds.w), s(bounds.n), s(bounds.e-bounds.w), s(bounds.s-bounds.n));
		}

		this.fillText = function (text, point, pixelOffsetX, pixelOffsetY) {
			ctx.fillText(text, s(x(point) + pixelOffsetX), s(y(point) + pixelOffsetY));
		}

		this.strokeFillText = function (text, point, pixelOffsetX, pixelOffsetY) {
			ctx.strokeText(text, s(x(point) + pixelOffsetX), s(y(point) + pixelOffsetY));
			ctx.fillText(text, s(x(point) + pixelOffsetX), s(y(point) + pixelOffsetY));
		}

		this.rotateTranslateDo = function (point, angle, callback) {
			ctx.save();
			ctx.translate(s(x(point)), s(y(point)));
			if (angle) ctx.rotate(angle);
			callback.call(this, this);
			ctx.restore();
		}

		this.clear = function () {
			hotspotIndex = {};
			ctx.clearRect(0, 0, canvas.width, canvas.height);
		}

		this.delete = function () {
			$canvas.remove();
			delete parent.layers[name];
		}

		var hotspotIndex = {};
		if (options.interactive) {
			this.drawHotspot = function (point, r, data) {
				var col = [
					(Math.random()*256)|0,
					(Math.random()*256)|0,
					(Math.random()*256)|0
				];
				ctx.fillStyle = 'rgb(' + col.join() + ')';
				this.drawCircle(point, r);
				this.ctx.fill();
				hotspotIndex[col.join()] = data;
			}

			$canvas.css('opacity', 0);

			var currentHoverTarget = null;

			$canvas.on('mousemove mouseenter mouseleave', function (ev) {
				var x = ev.offsetX, y = ev.offsetY;
				col = ctx.getImageData(s(x), s(y), 1, 1).data;
				col = [col[0], col[1], col[2]].join();

				if (hotspotIndex[col]) {
					var data = hotspotIndex[col];
					$canvas.css('cursor', 'pointer');
					trigger('mousemove', data);
					if (currentHoverTarget !== data) trigger('mouseenter', data);
					currentHoverTarget = data;
				} else {
					if (currentHoverTarget) trigger('mouseleave', currentHoverTarget);
					$canvas.css('cursor', 'default');
					currentHoverTarget = null;
				}
			});
		}

		this.ctx = ctx;
		this._updateDimensions();
	}

	this.addLayer = function (name, options) {
		var l = new Layer(name, options);
		parent.layers[name] = l;
		return l;
	}

	this.setBounds = function (b) {
		bounds = b;
	}

	this.setDimensions = function (width, height) {
		o.width = width;
		o.height = height;
		for (var name in parent.layers) {
			parent.layers[name]._updateDimensions();
		}
	};

	this.redraw = function () {
		for (var name in parent.layers) {
			parent.layers[name].redraw();
		}
	}

	init.call(this);
}
