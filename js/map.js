
/* exported updateLastSeen, storeCoords, resetMap, drawMap */

// D3.js Network Topology Visualization
// Displays physical devices with router images and logical connections with lightning bolts
// Shared state is initialized in js/map_state.js.

// SVG symbols for router icons (guarded so re-evaluating the script won't redeclare)
if (typeof window.routerSymbol === 'undefined') {
	window.routerSymbol = `
	<symbol id="router" viewBox="0 0 24 24">
		<rect x="2" y="4" width="20" height="12" rx="2" fill="#e3f2fd" stroke="#1976d2" stroke-width="2"/>
		<circle cx="6" cy="8" r="1.5" fill="#1976d2"/>
		<circle cx="12" cy="8" r="1.5" fill="#1976d2"/>
		<circle cx="18" cy="8" r="1.5" fill="#1976d2"/>
		<circle cx="6" cy="12" r="1.5" fill="#1976d2"/>
		<circle cx="12" cy="12" r="1.5" fill="#1976d2"/>
		<circle cx="18" cy="12" r="1.5" fill="#1976d2"/>
		<path d="M8 16 L12 20 L16 16" stroke="#1976d2" stroke-width="2" fill="none"/>
	</symbol>
`;
}


function updateLastSeen(e) {
	let value = e;
	if (e && typeof e === 'object') {
		if (e.component && typeof e.component.option === 'function') {
			value = e.component.option('value');
		} else if (Object.prototype.hasOwnProperty.call(e, 'value')) {
			value = e.value;
		}
	}
	value = Number(value);
	if (Number.isNaN(value)) {
		value = 3;
	}
	mapOptions.lastSeen = value;
	mapOptions.ajax = false;
	drawMap();
}

function notifyMap(message, level) {
	if (typeof neighborNotify === 'function') {
		neighborNotify(message, level);
		return;
	}
	console.log((level || 'info') + ': ' + message);
}

// Store the coords and options
function storeCoords() {
	const items = nodesData.map(function(node) {
		return {
			id: node.id,
			label: node.label,
			x: node.x,
			y: node.y
		};
	});

	const canvas_x = network.width;
	const canvas_y = network.height;

	const jsonItems = JSON.stringify(items);

	neighborMapSaveOptions(
		{
			action: "ajax_map_save_options",
			__csrf_magic: csrfMagicToken,
			items: jsonItems,
			user_id: user_id,
			rule_id: rule_id,
			canvas_x: canvas_x,
			canvas_y: canvas_y
		},
		function(response) {
			const message = response.Response?.[0]?.message || '';
			notifyMap(message, 'success');
		},
		function() {
			notifyMap('Error saving map positions', 'error');
		}
	);
}

// Reset map positions
function resetMap() {
	neighborMapResetOptions(
		{
			action: 'ajax_map_reset_options',
			format: 'jsonp',
			__csrf_magic: csrfMagicToken,
			user_id: user_id,
			rule_id: rule_id
		},
		function(response) {
			const message = response.Response?.[0]?.message || '';
			notifyMap(message, 'success');
			mapOptions.ajax = true;
			drawMap();
		},
		function() {
			notifyMap('Error resetting map', 'error');
		}
	);
}

// Filtering helpers are loaded from js/map_filters.js.

function drawMap() {
	const container = document.getElementById('map_container');

	// If no map (rule) is selected and there are no host filters selected,
	// don't fetch or render a map by default — show a helpful placeholder instead.
	const selectedHostsExist = Array.isArray(mapOptions.selectedHosts) && mapOptions.selectedHosts.length > 0;
	// Only treat a map as "selected" when the toolbar SelectBox actually has a user-chosen value.
	let selectBoxValue = null;
	if (typeof selectBox !== 'undefined' && selectBox) {
		if (typeof selectBox.option === 'function') {
			selectBoxValue = selectBox.option('value');
		} else if (Object.prototype.hasOwnProperty.call(selectBox, 'value')) {
			selectBoxValue = selectBox.value;
		}
	}
	const hasMapSelected = selectBoxValue !== null && selectBoxValue !== undefined && String(selectBoxValue) !== '';
	// If neither a map nor hosts are selected, show placeholder and skip rendering
	if (!selectedHostsExist && !hasMapSelected) {
			stopLiveUpdates();
		// clear any existing visualization and show a placeholder message
			d3.select('#map_container').selectAll('*').remove();
		if (container) {
			container.style.minHeight = '300px';
			container.innerHTML = "<div style='text-align:center;color:#666;padding:20px;max-width:560px;'><div style='font-size:20px;margin-bottom:8px;font-weight:600;'>No map selected</div><div>Select a map from the toolbar or choose one or more host(s) to view neighbor relationships.</div></div>";
		}
		// Clear any previously loaded data and don't proceed with AJAX
		nodesData = [];
		edgesData = [];
		mapOptions.ajaxNodes = [];
		mapOptions.ajaxEdges = [];
		return;
	}
		let physics = true;
		const dataOptions = {
			action: 'ajax_interface_map',
			rule_id: rule_id,
			__csrf_magic: csrfMagicToken,
			selected_hosts: (mapOptions.selectedHosts && mapOptions.selectedHosts.length) ? mapOptions.selectedHosts.join(',') : ''
		};
		if (mapOptions.ajax === true) {
				neighborMapFetchTopology(
				dataOptions,
				function(response) {
					const responseArray = response.Response?.[0] || {};
						// preserve server-supplied seed so UI/tooling can access it
						mapOptions.seed = responseArray.seed || null;

					// Defensive initialization of nodes/edges from server response
					let edges = Array.isArray(responseArray.edges) ? responseArray.edges : (responseArray.edges || []);
					let nodes = Array.isArray(responseArray.nodes) ? responseArray.nodes : (responseArray.nodes || []);

				// If the user has selected hosts, pre-filter edges returned by server as a safety net
				if (mapOptions.selectedHosts && mapOptions.selectedHosts.length) {
						const sel = new Set(mapOptions.selectedHosts.map(String));
					edges = edges.filter(e => sel.has(String(e.from)) || sel.has(String(e.to)) || sel.has(String(e.source)) || sel.has(String(e.target)));
				}
				// Preserve previously pinned positions so live updates don't re-scatter nodes
				if (nodesData.length) {
						const posMap = {};
					nodesData.forEach(n => { posMap[n.id] = {x: n.x, y: n.y, fx: n.fx, fy: n.fy}; });
					nodes.forEach(n => {
						if (posMap[n.id]) {
							n.x  = posMap[n.id].x;
							n.y  = posMap[n.id].y;
							n.fx = posMap[n.id].fx;
							n.fy = posMap[n.id].fy;
						}
					});
				}				mapOptions.ajaxEdges = edges.slice();
				mapOptions.ajaxNodes = nodes.slice();

				physics = responseArray.physics !== false;

				// Process edge colors and types
				processEdgeData(edges);

				// Filter data
					const filtered = filterEdges(nodes, edges);
				nodes = filtered.nodes;
				edges = filtered.edges;

				// Separate edges by type
					const physicalEdges = edges.filter(e => e.type === 'physical');
					const logicalEdges = edges.filter(e => e.type === 'logical');

				// Keep globals in sync so storeCoords() can read live positions
				nodesData = nodes;
				edgesData = edges;

				// Create the visualization
				createVisualization(container, nodes, physicalEdges, logicalEdges, physics);

				// Start live updates if enabled
					if (mapOptions.refreshInterval > 0) {
						startLiveUpdates();
					}
				},
				function() {
						notifyMap('Error loading map data', 'error');
					}
				);
				} else {
				// Use cached data for filtering
				let nodes = Array.isArray(mapOptions.ajaxNodes) ? mapOptions.ajaxNodes.slice() : [];
				let edges = Array.isArray(mapOptions.ajaxEdges) ? mapOptions.ajaxEdges.slice() : [];

				const filtered = filterEdges(nodes, edges);
				nodes = filtered.nodes;
				edges = filtered.edges;

				const physicalEdges = edges.filter(e => e.type === 'physical');
				const logicalEdges = edges.filter(e => e.type === 'logical');

			nodesData = reindexArray(nodes);
			edgesData = reindexArray(edges);

			createVisualization(container, nodesData, physicalEdges, logicalEdges, physics);

			}
}
// Initialize on document ready
$(document).ready(function() {
		$('#positions').click(storeCoords);
		drawMap();
});
