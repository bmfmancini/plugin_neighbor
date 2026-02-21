// Neighbor map filtering helpers
// Loaded before js/map.js.

var filterNodes = function(nodes) {
	if (!mapOptions.hostFilter) return nodes;

	try {
		var regex = new RegExp(mapOptions.hostFilter, "i");
		return nodes.filter(function(node) {
			return regex.test(String(node.label || ""));
		});
	} catch (error) {
		console.warn("[neighbor map] invalid host filter regex:", mapOptions.hostFilter, error);
		return nodes;
	}
};

var filterEdges = function(nodes, edges) {
	var filteredNodes = filterNodes(nodes);

	// If user selected specific hosts, include selected hosts and direct neighbors.
	if (mapOptions.selectedHosts && mapOptions.selectedHosts.length) {
		var sel = new Set(mapOptions.selectedHosts.map(String));
		var visible = new Set();

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

	var nodeIds = new Set(filteredNodes.map(function(n) { return String(n.id); }));
	var filteredEdges = edges.filter(function(edge) {
		return nodeIds.has(String(edge.source)) && nodeIds.has(String(edge.target));
	});

	// Filter by last seen if specified.
	if (mapOptions.lastSeen) {
		var filterTime = moment().subtract(mapOptions.lastSeen, "days");
		filteredEdges = filteredEdges.filter(function(edge) {
			var edgeTime = moment(edge.last_seen, "YYYY-MM-DD HH:mm:ss");
			return edgeTime.isAfter(filterTime);
		});
	}

	return { nodes: filteredNodes, edges: filteredEdges };
};

var reindexArray = function(arr) {
	return arr.filter(function(item) { return item != null; });
};
