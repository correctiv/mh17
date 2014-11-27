$(function () {

var $embedCodeField = $('#embed textarea');
$embedCodeField.val(
	$embedCodeField.val().replace(/src=".*?"/, 'src="'+window.location+'"')
);

var $overlay = $('.modal-overlay');

$('.modal').each(function (i, modal) {
	var $modal = $(modal);
	$('[href=#'+modal.id+']').each(function (j, anchor) {
		$(anchor).click(function (ev) {
			ev.preventDefault();
			$modal.addClass('visible').removeClass('hidden');
			$overlay.addClass('visible').removeClass('hidden');
		});
	});
});

$overlay.click(function () {
	$overlay.addClass('hidden').removeClass('visible');
	$('.modal').addClass('hidden').removeClass('visible');
});

var $tbody = $('#flightlist tbody')
M.flights.on('bulkpushed', function () {
	M.flights.raw.forEach(function (flight) {
		if (!flight.start && !flight.end && !flight.number) return;
		$tr = $('<tr>');
		$number = $('<td>').addClass('number').text(flight.number);
		$start = $('<td>').addClass('start').text(flight.start);
		$end = $('<td>').addClass('end').text(flight.end);

		$tr.append($number, $start, $end);
		$tbody.append($tr);
	});
});

});
