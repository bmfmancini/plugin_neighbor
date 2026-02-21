$(document).ready(function() {
	renderNeighborTypeSelector('xdp');

	$.ajax({
		method: 'POST',
		url: 'ajax.php',
		data: {
			action: 'ajax_neighbors_xdp',
			__csrf_magic: csrfMagicToken
		},
		dataType: 'jsonp',
		success: function(response) {
			const data = normalizeNeighborResponse(response);
			renderNeighborTable('#xdp_neighbors_holder', [
				{ dataField: 'hostname', caption: 'Hostname (A)' },
				{ dataField: 'interface_name', caption: 'Interface (A)' },
				{ dataField: 'interface_alias', caption: 'Description (A)' },
				{ dataField: 'interface_speed', caption: 'Speed' },
				{ dataField: 'neighbor_hostname', caption: 'Hostname (B)' },
				{ dataField: 'neighbor_interface_name', caption: 'Interface (B)' },
				{ dataField: 'neighbor_interface_alias', caption: 'Description (B)' },
				{ dataField: 'neighbor_platform', caption: 'Neighbor Platform' },
				{ dataField: 'last_seen', caption: 'Last Seen', dataType: 'datetime', formatter: formatNeighborDateTime }
			], data);
		},
		error: function() {
			$('#xdp_neighbors_holder').html("<div class='neighbor-error'>Failed to load neighbor data.</div>");
		}
	});
});
