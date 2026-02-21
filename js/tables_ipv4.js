$(document).ready(function() {
	renderNeighborTypeSelector('ipv4');

	$.ajax({
		method: 'POST',
		url: 'ajax.php',
		data: {
			action: 'ajax_neighbors_ipv4',
			__csrf_magic: csrfMagicToken
		},
		dataType: 'jsonp',
		success: function(response) {
			const data = normalizeNeighborResponse(response);
			renderNeighborTable('#xdp_neighbors_holder', [
				{ dataField: 'vrf', caption: 'VRF' },
				{ dataField: 'hostname', caption: 'Hostname (A)' },
				{ dataField: 'interface_name', caption: 'Interface (A)' },
				{ dataField: 'interface_alias', caption: 'Description (A)' },
				{ dataField: 'interface_ip', caption: 'IP Address (A)' },
				{ dataField: 'neighbor_hostname', caption: 'Hostname (B)' },
				{ dataField: 'neighbor_interface_name', caption: 'Interface (B)' },
				{ dataField: 'neighbor_interface_alias', caption: 'Description (B)' },
				{ dataField: 'neighbor_interface_ip', caption: 'IP Address (B)' },
				{ dataField: 'last_seen', caption: 'Last Seen', dataType: 'datetime', formatter: formatNeighborDateTime }
			], data);
		},
		error: function() {
			$('#xdp_neighbors_holder').html("<div style='padding:10px;color:#b94a48;'>Failed to load neighbor data.</div>");
		}
	});
});
