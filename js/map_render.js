// Neighbor map rendering and simulation helpers
// Loaded before js/map.js.

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

// Process edge data and add types/colors
function processEdgeData(edges) {
	// Color gradient for utilization
	const colorArray = generateColor("#ff3300", "#66ff66", 10);

	edges.forEach((edge, i) => {
		// Convert vis.js format to D3 format — be defensive about incoming shapes
		// prefer existing `source`/`target`, otherwise fall back to `from`/`to`.
		edge.source = (edge.source ?? edge.from ?? edge.src ?? null);
		edge.target = (edge.target ?? edge.to ?? edge.dst ?? null);

		// Normalize numeric ids when possible (helps d3 id matching)
		if (edge.source !== null && edge.source !== undefined && String(edge.source).match(/^\d+$/)) {
			edge.source = Number(edge.source);
		}
		if (edge.target !== null && edge.target !== undefined && String(edge.target).match(/^\d+$/)) {
			edge.target = Number(edge.target);
		}

		// Determine edge type based on protocol (preserve existing if present)
		if (edge.protocol === 'cdp' || edge.protocol === 'lldp') {
			edge.type = 'physical';
		} else if (['bgp', 'ospf', 'isis', 'eigrp'].includes(edge.protocol)) {
			edge.type = 'logical';
		} else {
			edge.type = edge.type ?? 'physical'; // default
		}

		// Process traffic data for colors — `edge.poller` may be a JSON string from server
		let pollerData = edge.poller;
		if (typeof pollerData === 'string') {
			try { pollerData = JSON.parse(pollerData); } catch (err) { pollerData = {}; }
		}

		if (pollerData?.traffic_in) {
			let deltaMax = Math.max(pollerData.traffic_in.delta, pollerData.traffic_out.delta);
			deltaMax = parseInt(deltaMax * 8 / 1000 / 1000); // Convert to Mbps
			const intSpeed = edge.value || 100; // Default 100Mbps if no speed
			const percUtilised = deltaMax / intSpeed * 100;
			const colorIndex = Math.min(Math.floor(percUtilised / 10), colorArray.length - 1);

			const color = "#" + colorArray[colorIndex];
			edge.color = {
				color: color,
				highlight: color,
				hover: color,
				opacity: 1.0
			};

			// Add traffic info to title
			const delta_in = Number(pollerData.traffic_in.delta * 8 / 1000 / 1000).toFixed(2);
			const delta_out = Number(pollerData.traffic_out.delta * 8 / 1000 / 1000).toFixed(2);
			edge.title = (edge.title || "") + `<br>Inbound: ${delta_in} Mbps, Outbound: ${delta_out} Mbps`;
		}

		// Diagnostic: if source/target missing warn (helps find server/client shape mismatch)
		if (edge.source === null || edge.source === undefined || edge.target === null || edge.target === undefined) {
			console.warn('[neighbor map] edge missing source/target — will be filtered out:', edge);
		}

	});
}

// Create the D3 visualization
function createVisualization(container, nodes, physicalEdges, logicalEdges, physics) {
	d3.select("#map_container").selectAll("*").remove();

	// Determine container size robustly — prefer the element's client size but
	// expand it to fill the visible viewport area when the parent uses
	// percentage heights (this prevents nodes being clipped at the bottom).
	const rect = container.getBoundingClientRect();
	const clientW = container.clientWidth || 0;
	const clientH = container.clientHeight || 0;

	// Compute available viewport space below the container's top edge and use it
	const viewportAvailableH = Math.max(0, window.innerHeight - rect.top - 20); // 20px bottom margin
	let width  = Math.max(clientW, Math.min(window.innerWidth,  Math.max(800, clientW || 800)));
	let height = Math.max(clientH, Math.min(viewportAvailableH, Math.max(600, clientH || 600)));

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
	const allEdges = [...physicalEdges, ...logicalEdges];

	// Ensure all nodes have IDs
	nodes.forEach((node, i) => {
		if (!node.id && node.id !== 0) {
			node.id = i;
		}
	});

	// Create SVG with defs
	const svg = d3.select(container).append("svg")
		.attr("width", width)
		.attr("height", height);

	const defs = svg.append("defs");
	defs.html(window.routerSymbol);

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
	const physicalLinkGroup = svg.append("g").attr("class", "links-physical");
	const logicalLinkGroup  = svg.append("g").attr("class", "links-logical");
	const nodeGroup         = svg.append("g").attr("class", "nodes");

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
	const physicalLink = physicalLinkGroup
		.selectAll("line")
		.data(physicalEdges)
		.enter().append("line")
		.attr("class", "physical-link")
		.attr("stroke", d => d.color?.color || "#555")
		.attr("stroke-width", 3)
		.attr("stroke-linecap", "round");

	// Create logical links (lightning bolts)
	const logicalLink = logicalLinkGroup
		.selectAll("path")
		.data(logicalEdges)
		.enter().append("path")
		.attr("class", "logical-link")
		.attr("stroke", d => d.color?.color || "#e65100")
		.attr("stroke-width", 3)
		.attr("fill", "none")
		.attr("stroke-dasharray", "8,4");

	// Create nodes with router symbols
	const node = nodeGroup
		.selectAll("g")
		.data(nodes)
		.enter().append("g")
		.attr("class", "node")
		.call(d3.drag()
			.on("start", dragstarted)
			.on("drag", dragged)
			.on("end", dragended));

	// Add router symbol to each node — wrap in a <g> so we can scale via transform
	const iconScale = nodeSize / 24;
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
			const positions = {};
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
	const autoFit = (animated) => {
		const padding = nodeSize + 60;
		const xs = nodes.map(n => n.x);
		const ys = nodes.map(n => n.y);
		const minX  = Math.min(...xs) - padding;
		const maxX  = Math.max(...xs) + padding;
		const minY  = Math.min(...ys) - padding;
		const maxY  = Math.max(...ys) + padding;
		const bboxW = maxX - minX;
		const bboxH = maxY - minY;
		if (bboxW < 1 || bboxH < 1) return;
		const scale = Math.min(width / bboxW, height / bboxH, 1.5);
		const tx    = (width  - scale * (minX + maxX)) / 2;
		const ty    = (height - scale * (minY + maxY)) / 2;
		const t     = d3.zoomIdentity.translate(tx, ty).scale(scale);
		if (animated) {
			svg.transition().duration(600).call(zoom.transform, t);
		} else {
			svg.call(zoom.transform, t);
		}
	};

	// Pin every node once the simulation has settled so nothing drifts afterwards
	const pinAllNodes = () => {
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
		const sliderHtml =
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
			const s = nodeSize / 24;
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
	const edgeId = d.id;
	const x = event.clientX;
	const y = event.clientY;

	if (d.graph_id) {
		if (!$("div." + edgeId).length) {
			$("#cactiContent").append("<div class='" + edgeId + "' style='left:" + x + "px; top:" + y + "px; position:absolute'></div>");
			$("div." + edgeId).append("<div id='tooltip_" + edgeId + "' class='mydxtooltip tooltip_" + edgeId + "'></div>");
		} else {
			$("div." + edgeId).animate({left: x, top: y}, 0);
		}

		const graph_id = d.graph_id;
		const graph_height = 150;
		const graph_width = 600;
		const rra_id = 1;
		const now = new Date();
		const graph_end = Math.round(now.getTime() / 1000);
		const graph_start = graph_end - 86400;

		const url = '../../graph_json.php?' +
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
				const template = "<img id='graph_" + data.local_graph_id +
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

					let tooltipRef = null;
					const tooltip = $("div.tooltip_" + edgeId).dxTooltip({
						target: "div." + edgeId,
						position: "right",
						closeOnOutsideClick: () => tooltipRef && tooltipRef.hide(),
						contentTemplate: (contentData) => contentData.html(template)
					}).dxTooltip("instance");
					tooltipRef = tooltip;

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
	const w = (network && network.width) ? network.width : (document.getElementById('map_container')?.clientWidth || window.innerWidth);
	const h = (network && network.height) ? network.height : (document.getElementById('map_container')?.clientHeight || window.innerHeight);
	const pad = Math.max(nodeSize, 40); // keep icon fully visible
	const minX = pad / 2;
	const maxX = Math.max(minX, w - pad / 2);
	const minY = pad / 2;
	const maxY = Math.max(minY, h - pad / 2);

	const nx = Math.max(minX, Math.min(event.x, maxX));
	const ny = Math.max(minY, Math.min(event.y, maxY));

	d.fx = nx;
	d.fy = ny;
}

function dragended(event, d) {
	if (!event.active) simulation.alphaTarget(0);
	// Ensure final pinned position also remains within bounds
	const w = (network && network.width) ? network.width : (document.getElementById('map_container')?.clientWidth || window.innerWidth);
	const h = (network && network.height) ? network.height : (document.getElementById('map_container')?.clientHeight || window.innerHeight);
	const pad = Math.max(nodeSize, 40);
	const minX = pad / 2;
	const maxX = Math.max(minX, w - pad / 2);
	const minY = pad / 2;
	const maxY = Math.max(minY, h - pad / 2);

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
	const s = "0123456789abcdef";
	let i = parseInt(c);
	if (i === 0 || isNaN(c)) return "00";
	i = Math.round(Math.min(Math.max(0, i), 255));
	return s.charAt((i - i % 16) / 16) + s.charAt(i % 16);
}

function convertToHex(rgb) {
	return hex(rgb[0]) + hex(rgb[1]) + hex(rgb[2]);
}

function convertToRGB(hex) {
	const color = [];
	color[0] = parseInt((hex).substring(0, 2), 16);
	color[1] = parseInt((hex).substring(2, 4), 16);
	color[2] = parseInt((hex).substring(4, 6), 16);
	return color;
}

function generateColor(colorStart, colorEnd, colorCount) {
	const start = convertToRGB(colorStart);
	const end = convertToRGB(colorEnd);
	const len = colorCount;
	let alpha = 0.0;
	const colors = [];

	for (let i = 0; i < len; i++) {
		const c = [];
		alpha += (1.0 / len);
		c[0] = start[0] * alpha + (1 - alpha) * end[0];
		c[1] = start[1] * alpha + (1 - alpha) * end[1];
		c[2] = start[2] * alpha + (1 - alpha) * end[2];
		colors.push(convertToHex(c));
	}
	return colors;
}
