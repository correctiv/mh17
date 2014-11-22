window.M.Map = function (container, options) {
	var o = {};

	var parent = this;
	var $container = $(container);
	this.layers = {};

	var desiredBounds = {};
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
			c[0] = x(c);
			c[1] = y(c);
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
		var me = this;

		var lX = x;
		var lY = y;

		var baseStyles;

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
			redraw();
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

		function redraw () {
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

		this.drawGeoJSON = function (FeatureCollection, callback) {
			FeatureCollection.features.sort(function (a, b) {
				return (a.properties.layer||0) - (b.properties.layer||0);
			});

			FeatureCollection.features.forEach(function (feature) {
				ctx.beginPath();
				renderGeoJSON[feature.geometry.type].call(ctx, feature.geometry.coordinates);
				callback.call(ctx, ctx);
			});
		}

		this.prepareGeoJSONPath = function (feature) {
			ctx.beginPath();
			renderGeoJSON[feature.geometry.type].call(ctx, feature.geometry.coordinates);
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
			ctx.beginPath();
			ctx.arc(s(lX(point)), s(lY(point)), s(r), 0, 2 * Math.PI);
			ctx.fill();
		}

		this.drawSquarePoint = function (center, side) {
			ctx.fillRect(s(lX(center)-side/2), s(lY(center)-side/2), side, side);
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
				n: lY(bounds.nw),
				w: lX(bounds.nw),
				s: lY(bounds.se),
				e: lX(bounds.se)
			}
			var width = s(bounds.e-bounds.w);
			var height = s(bounds.s-bounds.n);
			console.log(width, height, bounds);
			ctx.drawImage(image, s(bounds.w), s(bounds.n), s(bounds.e-bounds.w), s(bounds.s-bounds.n));
		}

		this.fillText = function (text, point, pixelOffsetX, pixelOffsetY) {
			ctx.fillText(text, s(lX(point) + pixelOffsetX), s(lY(point) + pixelOffsetY));
		}

		this.strokeFillText = function (text, point, pixelOffsetX, pixelOffsetY) {
			ctx.strokeText(text, s(lX(point) + pixelOffsetX), s(lY(point) + pixelOffsetY));
			ctx.fillText(text, s(lX(point) + pixelOffsetX), s(lY(point) + pixelOffsetY));
		}

		this.rotateTranslateDo = function (point, angle, callback) {
			ctx.save();
			ctx.translate(s(lX(point)), s(lY(point)));
			ctx.rotate(angle);
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

	this.setDimensions = function (width, height) {
		// We need to make sure that the desired bounds fit entirely
		// within the viewport defined by the width and the height.
		// To do so, we need to make sure that both have the same aspect ratio
		// (this only works because we're using Web Mercator and because our
		// bounds are pre-projected).
		// This was fun to figure out.
		var n = desiredBounds.n;
		var s = desiredBounds.s;
		var e = desiredBounds.e;
		var w = desiredBounds.w;

		var boundsWidth = e-w;
		var boundsHeight = n-s;

		var vCenter = s + boundsHeight/2;
		var hCenter = w + boundsWidth/2;

		var boundsRatio = boundsWidth/boundsHeight;
		var viewportRatio = width/height;

		console.log(boundsRatio/viewportRatio);

		if (viewportRatio > boundsRatio) {
			// viewport is too wide for bounds
			// we need to widen the bounds
			var scale = viewportRatio / boundsRatio;
			w = hCenter - scale * boundsWidth / 2;
			e = hCenter + scale * boundsWidth / 2;
		} else if (viewportRatio < boundsRatio) {
			// viewport is too tall for the bounds
			// we need to make the bounds taller
			var scale = boundsRatio / viewportRatio;
			s = vCenter - scale * boundsHeight / 2;
			n = vCenter + scale * boundsHeight / 2;
		}

		bounds = {
			n: n,
			s: s,
			e: e,
			w: w
		}

		for (var name in this.layers) {
			this.layers[name]._updateDimensions();
		}
		var obj = {width: width, height: height};
		$.extend(o, obj);
		$container.css(obj);
	}

	this.setBounds = function (b) {
		var nw = [b.w, b.n];
		var se = [b.e, b.s];

		desiredBounds = {
			w: xRel(nw),
			n: yRel(nw),
			e: xRel(se),
			s: yRel(se)
		}
	}

	init.call(this);
}
