$(function () {
var M = window.M;
M.map.init(document.getElementById('main-canvas'), {
	bounds: {
		top: 54, bottom: 44, left: 20, right: 40
	}
});

$.getJSON('data/ukraine.geojson', M.map.drawGeoJSON);
$.getJSON('data/flights.json', M.map.drawFlightRoutes);
});
