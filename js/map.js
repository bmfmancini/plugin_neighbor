
// D3.js Network Topology Visualization
// Displays physical devices with router images and logical connections with lightning bolts

var tooltips = [];		// Array to store and destroy tooltips
var mapOptions = {
	ajax: true,				// Fetch from Ajax by default
	refreshInterval: 30000,	// 30 seconds for live updates
	selectedHosts: []	// Array of selected host IDs for filtered view
};
var nodesData = [];			// Native array for nodes
var edgesData = [];			// Native array for edges
var simulation = null;		// D3 force simulation
var svg = null;				// SVG container
var zoom = null;			// D3 zoom behavior
var network = {};			// Network object for compatibility
var refreshTimer = null;	// Timer for live updates
var nodeSize = 48;			// Icon size in pixels (controlled by slider)
var labelSize = 12;			// Label font size in pixels (controlled by slider)

// SVG symbols for router icons
const routerSymbol = `
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

// Lightning bolt path generator
function createLightningBolt(x1, y1, x2, y2, segments = 8) {
	const dx = x2 - x1;
	const dy = y2 - y1;
	const distance = Math.sqrt(dx * dx + dy * dy);
	const segmentLength = distance / segments;

	let path = `M ${x1} ${y1}`;

	for (let i = 1; i < segments; i++) {
		const ratio = i / segments;
		const x = x1 + dx * ratio;
		const y = y1 + dy * ratio;

		// Add zigzag perpendicular to the line
		const angle = Math.atan2(dy, dx);
		const offset = (i % 2 === 0 ? 1 : -1) * 3; // 3px zigzag
		const zigzagX = x + Math.sin(angle) * offset;
		const zigzagY = y - Math.cos(angle) * offset;

		path += ` L ${zigzagX} ${zigzagY}`;
	}

	path += ` L ${x2} ${y2}`;
	return path;
}

var filterHosts = function(e) {
	var value = e.component.option("value");
	mapOptions.hostFilter = value;
	mapOptions.ajax = false;
	drawMap();
}

var updateLastSeen = function(e) {
	var value = e.component.option("value");
	mapOptions.lastSeen = value;
	mapOptions.ajax = false;
	drawMap();
}

// Store the coords and options
var storeCoords = function() {
	var items = nodesData.map(function(node) {
		return {
			id: node.id,
			label: node.label,
			x: node.x,
			y: node.y
		};
	});

	var canvas_x = network.width;
	var canvas_y = network.height;

	var jsonItems = JSON.stringify(items);

	$.ajax({
		method: "POST",
		url: "ajax.php",
		dataType: "jsonp",
		data: {
			action: "ajax_map_save_options",
			__csrf_magic: csrfMagicToken,
			items: jsonItems,
			user_id: user_id,
			rule_id: rule_id,
			canvas_x: canvas_x,
			canvas_y: canvas_y
		},
		success: function(response) {
			var message = response.Response?.[0]?.message || "";
			DevExpress.ui.notify(message, "success", 3000);
		},
		error: function() {
			DevExpress.ui.notify("Error saving map positions", "error", 3000);
		}
	});
}

// Reset map positions
var resetMap = function() {
	$.ajax({
		method: "POST",
		url: "ajax.php",
		dataType: "jsonp",
		data: {
			action: "ajax_map_reset_options",
			format: "jsonp",
			__csrf_magic: csrfMagicToken,
			user_id: user_id,
			rule_id: rule_id
		},
		success: function(response) {
			var message = response.Response?.[0]?.message || "";
			DevExpress.ui.notify(message, "success", 3000);
			mapOptions.ajax = true;
			drawMap();
		},
		error: function() {
			DevExpress.ui.notify("Error resetting map", "error", 3000);
		}
	});
}

// Filter nodes by host pattern
var filterNodes = function(nodes) {
	if (!mapOptions.hostFilter) return nodes;

	var regex = new RegExp(mapOptions.hostFilter, "i");
	return nodes.filter(node => node.label.match(regex));
}

// Filter edges by last seen time and node filtering
var filterEdges = function(nodes, edges) {
	var filteredNodes = filterNodes(nodes);
	// If user selected specific hosts, include only those hosts and any nodes directly connected to them
	if (mapOptions.selectedHosts && mapOptions.selectedHosts.length) {
		var sel = new Set(mapOptions.selectedHosts.map(String));
		// collect node ids that should be visible: selected + direct neighbors
		var visible = new Set();
		filteredNodes.forEach(n => { if (sel.has(String(n.id))) visible.add(String(n.id)); });
		edges.forEach(e => {
			if (sel.has(String(e.source)) || sel.has(String(e.target))) {
				visible.add(String(e.source));
				visible.add(String(e.target));
			}
		});
		filteredNodes = filteredNodes.filter(n => visible.has(String(n.id)));
	}
	// Coerce to string so integer IDs and string IDs both match
	var nodeIds = new Set(filteredNodes.map(n => String(n.id)));

	// Filter edges to only include those between visible nodes
	var filteredEdges = edges.filter(edge =>
		nodeIds.has(String(edge.source)) && nodeIds.has(String(edge.target))
	);

	// Filter by last seen if specified
	if (mapOptions.lastSeen) {
		var filterTime = moment().subtract(mapOptions.lastSeen, 'days');
		filteredEdges = filteredEdges.filter(edge => {
			var edgeTime = moment(edge.last_seen, "YYYY-MM-DD HH:mm:ss");
			return edgeTime.isAfter(filterTime);
		});
	}

	return { nodes: filteredNodes, edges: filteredEdges };
}

// Reindex arrays to ensure sequential keys
var reindexArray = function(arr) {
	return arr.filter(item => item != null);
}

var drawMap = function() {
	var container = document.getElementById('map_container');

	// If no map (rule) is selected and there are no host filters selected,
	// don't fetch or render a map by default — show a helpful placeholder instead.
	var selectedHostsExist = Array.isArray(mapOptions.selectedHosts) && mapOptions.selectedHosts.length > 0;
	// Only treat a map as "selected" when the toolbar SelectBox actually has a user-chosen value.
	var selectBoxValue = (typeof selectBox !== 'undefined' && selectBox && typeof selectBox.option === 'function') ? selectBox.option('value') : null;
	var hasMapSelected = selectBoxValue !== null && selectBoxValue !== undefined && String(selectBoxValue) !== '';
	// If neither a map nor hosts are selected, show placeholder and skip rendering
	if (!selectedHostsExist && !hasMapSelected) {
		stopLiveUpdates();
		// clear any existing visualization and show a placeholder message
		d3.select("#map_container").selectAll("*").remove();
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
		var physics = true;
		var dataOptions = {
			action: "ajax_interface_map",
			rule_id: rule_id,
			__csrf_magic: csrfMagicToken,
			selected_hosts: (mapOptions.selectedHosts && mapOptions.selectedHosts.length) ? mapOptions.selectedHosts.join(',') : ''
		};
		if (mapOptions.ajax == true) {
			$.ajax({
			method: "POST",
			url: "ajax.php",
			data: dataOptions,
			dataType: "jsonp",
			success: function(response) {
				var responseArray = response.Response?.[0] || [];
				var edges = responseArray.edges || [];
				var nodes = responseArray.nodes || [];

				// If the user has selected hosts, pre-filter edges returned by server as a safety net
				if (mapOptions.selectedHosts && mapOptions.selectedHosts.length) {
					var sel = new Set(mapOptions.selectedHosts.map(String));
					edges = edges.filter(e => sel.has(String(e.from)) || sel.has(String(e.to)) || sel.has(String(e.source)) || sel.has(String(e.target)));
				}
				// Preserve previously pinned positions so live updates don't re-scatter nodes
				if (nodesData.length) {
					var posMap = {};
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
				var filtered = filterEdges(nodes, edges);
				nodes = filtered.nodes;
				edges = filtered.edges;

				// Separate edges by type
				var physicalEdges = edges.filter(e => e.type === 'physical');
				var logicalEdges = edges.filter(e => e.type === 'logical');

				// Keep globals in sync so storeCoords() can read live positions
				nodesData = nodes;
				edgesData = edges;

				// Create the visualization
				createVisualization(container, nodes, physicalEdges, logicalEdges, physics);

				// Start live updates if enabled
				if (mapOptions.refreshInterval > 0) {
					startLiveUpdates();
				}
			}
		});
	} else {
		// Use cached data for filtering
		var nodes = mapOptions.ajaxNodes.slice();
		var edges = mapOptions.ajaxEdges.slice();

		var filtered = filterEdges(nodes, edges);
		nodes = filtered.nodes;
		edges = filtered.edges;

		var physicalEdges = edges.filter(e => e.type === 'physical');
		var logicalEdges = edges.filter(e => e.type === 'logical');

		nodesData = reindexArray(nodes);
		edgesData = reindexArray(edges);

	}
}

// Process edge data and add types/colors
function processEdgeData(edges) {
	// Color gradient for utilization
	var colorArray = generateColor("#ff3300", "#66ff66", 10);

	edges.forEach((edge, i) => {
		// Convert vis.js format to D3 format
		edge.source = edge.from;
		edge.target = edge.to;

		// Determine edge type based on protocol
		if (edge.protocol === 'cdp' || edge.protocol === 'lldp') {
			edge.type = 'physical';
		} else if (['bgp', 'ospf', 'isis', 'eigrp'].includes(edge.protocol)) {
			edge.type = 'logical';
		} else {
			edge.type = 'physical'; // default
		}

		// Process traffic data for colors
		var pollerData = edge.poller;
		if (pollerData?.traffic_in) {
			var deltaMax = Math.max(pollerData.traffic_in.delta, pollerData.traffic_out.delta);
			deltaMax = parseInt(deltaMax * 8 / 1000 / 1000); // Convert to Mbps
			var intSpeed = edge.value || 100; // Default 100Mbps if no speed
			var percUtilised = deltaMax / intSpeed * 100;
			var colorIndex = Math.min(Math.floor(percUtilised / 10), colorArray.length - 1);

			var color = "#" + colorArray[colorIndex];
			edge.color = {
				color: color,
				highlight: color,
				hover: color,
				opacity: 1.0
			};

			// Add traffic info to title
			var delta_in = Number(pollerData.traffic_in.delta * 8 / 1000 / 1000).toFixed(2);
			var delta_out = Number(pollerData.traffic_out.delta * 8 / 1000 / 1000).toFixed(2);
			edge.title = (edge.title || "") + `<br>Inbound: ${delta_in} Mbps, Outbound: ${delta_out} Mbps`;
		}
	});
}

// Create the D3 visualization
function createVisualization(container, nodes, physicalEdges, logicalEdges, physics) {
	d3.select("#map_container").selectAll("*").remove();

	// Determine container size robustly — prefer the element's client size but
	// expand it to fill the visible viewport area when the parent uses
	// percentage heights (this prevents nodes being clipped at the bottom).
	var rect = container.getBoundingClientRect();
	var clientW = container.clientWidth || 0;
	var clientH = container.clientHeight || 0;

	// Compute available viewport space below the container's top edge and use it
	var viewportAvailableH = Math.max(0, window.innerHeight - rect.top - 20); // 20px bottom margin
	var width  = Math.max(clientW, Math.min(window.innerWidth,  Math.max(800, clientW || 800)));
	var height = Math.max(clientH, Math.min(viewportAvailableH, Math.max(600, clientH || 600)));

	// If the container was using percentage heights and clientH is small, grow it to use viewport space
	if (clientH < Math.min(600, viewportAvailableH)) {
		height = Math.max(600, viewportAvailableH);
		container.style.height = height + "px"; // expand the container so SVG uses full visible area
	}

	if (width < 100) width = Math.max(window.innerWidth - 40, 800);

	// Ensure the container has explicit pixel dimensions for consistent dragging/clamping
	container.style.width  = width  + "px";
	container.style.height = height + "px";

	// Combine all edges for the simulation
	var allEdges = [...physicalEdges, ...logicalEdges];

	// Ensure all nodes have IDs
	nodes.forEach((node, i) => {
		if (!node.id && node.id !== 0) {
			node.id = i;
		}
	});

	// Create SVG with defs
	var svg = d3.select(container).append("svg")
		.attr("width", width)
		.attr("height", height);

	var defs = svg.append("defs");
	defs.html(routerSymbol);

	// Add zoom behavior
	zoom = d3.zoom()
		.scaleExtent([0.1, 4])
		.on("zoom", zoomed);

	svg.call(zoom);

	// Initialise all nodes close to centre so disconnected ones don't scatter
	nodes.forEach(node => {
		if (typeof node.x !== 'number' || isNaN(node.x)) {
			node.x = width  / 2 + (Math.random() - 0.5) * 60;
			node.y = height / 2 + (Math.random() - 0.5) * 60;
		}
	});

	// Create groups for different layers
	var physicalLinkGroup = svg.append("g").attr("class", "links-physical");
	var logicalLinkGroup  = svg.append("g").attr("class", "links-logical");
	var nodeGroup         = svg.append("g").attr("class", "nodes");

	// Create force simulation
	try {
		simulation = d3.forceSimulation(nodes)
			.force("link",    d3.forceLink(allEdges).id(d => d.id).distance(180))
			.force("charge",  d3.forceManyBody().strength(-600))
			.force("center",  d3.forceCenter(width / 2, height / 2).strength(0.15))
			.force("collide", d3.forceCollide(nodeSize))
			.alphaDecay(0.05)
			.velocityDecay(0.6);

		if (!physics) simulation.stop();
	} catch (error) {
		console.error("Error creating force simulation:", error);
		return;
	}

	// Create physical links (solid lines)
	var physicalLink = physicalLinkGroup
		.selectAll("line")
		.data(physicalEdges)
		.enter().append("line")
		.attr("class", "physical-link")
		.attr("stroke", d => d.color?.color || "#555")
		.attr("stroke-width", 3)
		.attr("stroke-linecap", "round");

	// Create logical links (lightning bolts)
	var logicalLink = logicalLinkGroup
		.selectAll("path")
		.data(logicalEdges)
		.enter().append("path")
		.attr("class", "logical-link")
		.attr("stroke", d => d.color?.color || "#e65100")
		.attr("stroke-width", 3)
		.attr("fill", "none")
		.attr("stroke-dasharray", "8,4");

	// Create nodes with router symbols
	var node = nodeGroup
		.selectAll("g")
		.data(nodes)
		.enter().append("g")
		.attr("class", "node")
		.call(d3.drag()
			.on("start", dragstarted)
			.on("drag", dragged)
			.on("end", dragended));

	// Add router symbol to each node — wrap in a <g> so we can scale via transform
	var iconScale = nodeSize / 24;
	node.append("g")
		.attr("class", "node-icon")
		.attr("transform", `scale(${iconScale})`)
		.append("use")
			.attr("href", "#router")
			.attr("width",  24)
			.attr("height", 24)
			.attr("x", -12)
			.attr("y", -12);

	// Add labels below the icon
	node.append("text")
		.attr("class", "node-label")
		.attr("text-anchor", "middle")
		.attr("dy", nodeSize / 2 + 14)
		.style("font-size", labelSize + "px")
		.style("font-family", "Arial, sans-serif")
		.style("font-weight", "600")
		.style("fill", "#1a1a2e")
		.text(d => d.label);

	// Add tooltips and interactions
	physicalLink.on("dblclick", handleEdgeClick);
	logicalLink.on("dblclick", handleEdgeClick);

	node.on("drag", () => hideTooltips());
	svg.on("wheel", () => hideTooltips());
	svg.on("click", () => hideTooltips());

	// Simulation tick function
	simulation.on("tick", function() {
		// Update physical links
		physicalLink
			.attr("x1", d => d.source.x)
			.attr("y1", d => d.source.y)
			.attr("x2", d => d.target.x)
			.attr("y2", d => d.target.y);

		// Update logical links with lightning bolt paths
		logicalLink.attr("d", d => createLightningBolt(d.source.x, d.source.y, d.target.x, d.target.y));

		// Update node positions
		node.attr("transform", d => `translate(${d.x},${d.y})`);
	});

	// Store network object for compatibility
	network = {
		simulation: simulation,
		svg: svg,
		nodes: nodes,
		edges: [...physicalEdges, ...logicalEdges],
		width: width,
		height: height,
		getPositions: function() {
			var positions = {};
			nodes.forEach(n => positions[n.id] = {x: n.x, y: n.y});
			return positions;
		},
		setData: function(data) {
			// Update data and restart simulation
			this.nodes = data.nodes;
			this.edges = data.edges;
			simulation.nodes(this.nodes);
			simulation.force("link").links(this.edges);
			simulation.alpha(1).restart();
		},
		fit: function() {
			simulation.restart();
		}
	};

	// Auto-fit: centres all nodes in the viewport
	var autoFit = (animated) => {
		var padding = nodeSize + 60;
		var xs = nodes.map(n => n.x);
		var ys = nodes.map(n => n.y);
		var minX  = Math.min(...xs) - padding;
		var maxX  = Math.max(...xs) + padding;
		var minY  = Math.min(...ys) - padding;
		var maxY  = Math.max(...ys) + padding;
		var bboxW = maxX - minX;
		var bboxH = maxY - minY;
		if (bboxW < 1 || bboxH < 1) return;
		var scale = Math.min(width / bboxW, height / bboxH, 1.5);
		var tx    = (width  - scale * (minX + maxX)) / 2;
		var ty    = (height - scale * (minY + maxY)) / 2;
		var t     = d3.zoomIdentity.translate(tx, ty).scale(scale);
		if (animated) {
			svg.transition().duration(600).call(zoom.transform, t);
		} else {
			svg.call(zoom.transform, t);
		}
	};

	// Pin every node once the simulation has settled so nothing drifts afterwards
	var pinAllNodes = () => {
		nodes.forEach(n => { n.fx = n.x; n.fy = n.y; });
	};

	simulation.on("end", () => {
		autoFit(true);
		pinAllNodes();
	});
	// Fallback: pin + fit after 3 s in case the simulation ends early or not at all
	setTimeout(() => { autoFit(true); pinAllNodes(); }, 3000);

	// Inject the icon-size slider if not already present
	if (!document.getElementById('node_size_slider')) {
		var sliderHtml =
			"<div id='node_size_ctrl' style='" +
			"position:absolute;top:8px;right:12px;background:rgba(255,255,255,0.88);" +
			"border:1px solid #ccc;border-radius:6px;padding:6px 12px;" +
		"font:12px Arial,sans-serif;z-index:10;display:flex;align-items:center;gap:12px;'>" +
		"<label for='node_size_slider'>&#128269; Icon</label>" +
		"<input id='node_size_slider' type='range' min='24' max='96' step='4' value='" + nodeSize + "'" +
		" style='width:90px;cursor:pointer;'>" +
		"<label for='label_size_slider'>&#65313; Text</label>" +
		"<input id='label_size_slider' type='range' min='8' max='32' step='1' value='" + labelSize + "'" +
		" style='width:90px;cursor:pointer;'>" +
			"</div>";
		$("#map_container").css("position", "relative").prepend(sliderHtml);

		document.getElementById('node_size_slider').addEventListener('input', function() {
			nodeSize = parseInt(this.value);
			var s = nodeSize / 24;
			d3.selectAll(".node-icon")
				.attr("transform", `scale(${s})`);
			d3.selectAll(".node-label")
				.attr("dy", nodeSize / 2 + 14);
			// Update collide force radius
			simulation.force("collide", d3.forceCollide(nodeSize));
			simulation.alpha(0.1).restart();
		});

		document.getElementById('label_size_slider').addEventListener('input', function() {
			labelSize = parseInt(this.value);
			d3.selectAll(".node-label")
				.style("font-size", labelSize + "px");
		});
	}
}

// Handle edge double-click for tooltips
function handleEdgeClick(event, d) {
	var edgeId = d.id;
	var x = event.clientX;
	var y = event.clientY;

	if (d.graph_id) {
		if (!$("div." + edgeId).length) {
			$("#cactiContent").append("<div class='" + edgeId + "' style='left:" + x + "px; top:" + y + "px; position:absolute'></div>");
			$("div." + edgeId).append("<div id='tooltip_" + edgeId + "' class='mydxtooltip tooltip_" + edgeId + "'></div>");
		} else {
			$("div." + edgeId).animate({left: x, top: y}, 0);
		}

		var graph_id = d.graph_id;
		var graph_height = 150;
		var graph_width = 600;
		var rra_id = 1;
		var now = new Date();
		var graph_end = Math.round(now.getTime() / 1000);
		var graph_start = graph_end - 86400;

		var url = '../../graph_json.php?' +
			'local_graph_id=' + graph_id +
			'&graph_height=' + graph_height +
			'&graph_start=' + graph_start +
			'&graph_end=' + graph_end +
			'&rra_id=' + rra_id +
			'&graph_width=' + graph_width +
			'&disable_cache=true';

		$.ajax({
			dataType: "json",
			url: url,
			data: { __csrf_magic: csrfMagicToken },
			success: function(data) {
				var template = "<img id='graph_" + data.local_graph_id +
					"' src='data:image/" + data.type + ";base64," + data.image +
					"' graph_start='" + data.graph_start +
					"' graph_end='" + data.graph_end +
					"' graph_left='" + data.graph_left +
					"' graph_top='" + data.graph_top +
					"' graph_width='" + data.graph_width +
					"' graph_height='" + data.graph_height +
					"' image_width='" + data.image_width +
					"' image_height='" + data.image_height +
					"' canvas_left='" + data.graph_left +
					"' canvas_top='" + data.graph_top +
					"' canvas_width='" + data.graph_width +
					"' canvas_height='" + data.graph_height +
					"' width='" + data.image_width +
					"' height='" + data.image_height +
					"' value_min='" + data.value_min +
					"' value_max='" + data.value_max + "'>";

				var tooltip = $("div.tooltip_" + edgeId).dxTooltip({
					target: "div." + edgeId,
					position: "right",
					closeOnOutsideClick: () => tooltip.hide(),
					contentTemplate: (contentData) => contentData.html(template)
				}).dxTooltip("instance");

				tooltips[edgeId] = tooltip;
				tooltip.show();
			}
		});
	}
}

// Drag functions — nodes stay pinned where dropped (sticky)
function dragstarted(event, d) {
	if (!event.active) simulation.alphaTarget(0.3).restart();
	d.fx = d.x;
	d.fy = d.y;
	d3.select(this).select(".node-icon").style("cursor", "grabbing");
}

function dragged(event, d) {
	// Prevent nodes from being dragged outside the visible canvas by clamping coordinates
	var w = (network && network.width) ? network.width : (document.getElementById('map_container')?.clientWidth || window.innerWidth);
	var h = (network && network.height) ? network.height : (document.getElementById('map_container')?.clientHeight || window.innerHeight);
	var pad = Math.max(nodeSize, 40); // keep icon fully visible
	var minX = pad / 2;
	var maxX = Math.max(minX, w - pad / 2);
	var minY = pad / 2;
	var maxY = Math.max(minY, h - pad / 2);

	var nx = Math.max(minX, Math.min(event.x, maxX));
	var ny = Math.max(minY, Math.min(event.y, maxY));

	d.fx = nx;
	d.fy = ny;
}

function dragended(event, d) {
	if (!event.active) simulation.alphaTarget(0);
	// Ensure final pinned position also remains within bounds
	var w = (network && network.width) ? network.width : (document.getElementById('map_container')?.clientWidth || window.innerWidth);
	var h = (network && network.height) ? network.height : (document.getElementById('map_container')?.clientHeight || window.innerHeight);
	var pad = Math.max(nodeSize, 40);
	var minX = pad / 2;
	var maxX = Math.max(minX, w - pad / 2);
	var minY = pad / 2;
	var maxY = Math.max(minY, h - pad / 2);

	d.fx = Math.max(minX, Math.min(d.fx, maxX));
	d.fy = Math.max(minY, Math.min(d.fy, maxY));

	// Keep fx/fy set so the node stays exactly where the user left it.
	// Do NOT null them out — that would release the pin and let the sim bounce the node.
	d3.select(this).select(".node-icon").style("cursor", "grab");
}

// Zoom function
function zoomed(event) {
	d3.selectAll(".links-physical, .links-logical, .nodes").attr("transform", event.transform);
}

// Live updates
function startLiveUpdates() {
	if (refreshTimer) clearInterval(refreshTimer);
	refreshTimer = setInterval(() => {
		mapOptions.ajax = true;
		drawMap();
	}, mapOptions.refreshInterval);
}

function stopLiveUpdates() {
	if (refreshTimer) {
		clearInterval(refreshTimer);
		refreshTimer = null;
	}
}

// Hide all tooltips
function hideTooltips() {
	Object.keys(tooltips).forEach(key => {
		if (tooltips[key]) {
			tooltips[key].dispose();
			delete tooltips[key];
		}
	});
}

// Color generation functions
function hex(c) {
	var s = "0123456789abcdef";
	var i = parseInt(c);
	if (i == 0 || isNaN(c)) return "00";
	i = Math.round(Math.min(Math.max(0, i), 255));
	return s.charAt((i - i % 16) / 16) + s.charAt(i % 16);
}

function convertToHex(rgb) {
	return hex(rgb[0]) + hex(rgb[1]) + hex(rgb[2]);
}

function convertToRGB(hex) {
	var color = [];
	color[0] = parseInt((hex).substring(0, 2), 16);
	color[1] = parseInt((hex).substring(2, 4), 16);
	color[2] = parseInt((hex).substring(4, 6), 16);
	return color;
}

function generateColor(colorStart, colorEnd, colorCount) {
	var start = convertToRGB(colorStart);
	var end = convertToRGB(colorEnd);
	var len = colorCount;
	var alpha = 0.0;
	var colors = [];

	for (var i = 0; i < len; i++) {
		var c = [];
		alpha += (1.0 / len);
		c[0] = start[0] * alpha + (1 - alpha) * end[0];
		c[1] = start[1] * alpha + (1 - alpha) * end[1];
		c[2] = start[2] * alpha + (1 - alpha) * end[2];
		colors.push(convertToHex(c));
	}
	return colors;
}

// Initialize on document ready
$(document).ready(function() {
	$("#positions").click(storeCoords);
	drawMap();
});