/* exported filterEdges, reindexArray */

// Neighbor map filtering helpers
// Loaded before js/map.js.

function filterNodes(nodes) {
	if (!mapOptions.hostFilter) return nodes;

	try {
		const regex = new RegExp(mapOptions.hostFilter, 'i');
		return nodes.filter(function(node) {
			return regex.test(String(node.label || ''));
		});
	} catch (error) {
		console.warn('[neighbor map] invalid host filter regex:', mapOptions.hostFilter, error);
		return nodes;
	}
}

function filterEdges(nodes, edges) {
	let filteredNodes = filterNodes(nodes);

	// If user selected specific hosts, include selected hosts and direct neighbors.
	if (mapOptions.selectedHosts && mapOptions.selectedHosts.length) {
		const sel = new Set(mapOptions.selectedHosts.map(String));
		const visible = new Set();

		filteredNodes.forEach(function(n) {
			if (sel.has(String(n.id))) visible.add(String(n.id));
		});

		edges.forEach(function(e) {
			if (sel.has(String(e.source)) || sel.has(String(e.target))) {
				visible.add(String(e.source));
				visible.add(String(e.target));
			}
		});

		filteredNodes = filteredNodes.filter(function(n) {
			return visible.has(String(n.id));
		});
	}

	const nodeIds = new Set(filteredNodes.map(function(n) { return String(n.id); }));
	let filteredEdges = edges.filter(function(edge) {
		return nodeIds.has(String(edge.source)) && nodeIds.has(String(edge.target));
	});

	// Filter by last seen if specified.
	if (mapOptions.lastSeen) {
		const filterTime = moment().subtract(mapOptions.lastSeen, 'days');
		filteredEdges = filteredEdges.filter(function(edge) {
			const edgeTime = moment(edge.last_seen, 'YYYY-MM-DD HH:mm:ss');
			return edgeTime.isAfter(filterTime);
		});
	}

	return { nodes: filteredNodes, edges: filteredEdges };
}

function reindexArray(arr) {
	return arr.filter(function(item) { return item !== null && item !== undefined; });
}
