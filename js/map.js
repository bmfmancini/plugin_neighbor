
// D3.js-based Network Visualization (formerly vis.js)
var tooltips = [];		// Array to store and destroy tooltips
var mapOptions = {
	ajax: true				// Fetch from Ajax by default	
};	// Array to store the map options
var nodesData = [];			// Native array for nodes
var edgesData = [];			// Native array for edges
var simulation = null;		// D3 force simulation
var svg = null;				// SVG container
var container = null;		// DOM container element
var zoom = null;			// D3 zoom behavior
var transform = d3.zoomIdentity;  // Current zoom transform
var network = {};			// Network object for compatibility

// Maintain some backwards compatibility as Object.keys not universally available.
Object.size = function(obj) {
var size = 0, key;
	for (key in obj) {
		if (obj.hasOwnProperty(key)) size++;
	}
	return size;
};

// Add compatibility methods to network object
network.width = 1280;
network.height = 1080;

// Color Generation - credits to Euler Junior - https://stackoverflow.com/a/32257791

function hex (c) {
  var s = "0123456789abcdef";
  var i = parseInt (c);
  if (i == 0 || isNaN (c))
	return "00";
  i = Math.round (Math.min (Math.max (0, i), 255));
  return s.charAt ((i - i % 16) / 16) + s.charAt (i % 16);
}

/* Convert an RGB triplet to a hex string */
function convertToHex (rgb) {
  return hex(rgb[0]) + hex(rgb[1]) + hex(rgb[2]);
}

/* Remove '#' in color hex string */
function trim (s) { return (s.charAt(0) == '#') ? s.substring(1, 7) : s }

/* Convert a hex string to an RGB triplet */
function convertToRGB (hex) {
  var color = [];
  color[0] = parseInt ((trim(hex)).substring (0, 2), 16);
  color[1] = parseInt ((trim(hex)).substring (2, 4), 16);
  color[2] = parseInt ((trim(hex)).substring (4, 6), 16);
  return color;
}

function generateColor(colorStart,colorEnd,colorCount){

	var start = convertToRGB (colorStart);    	// The beginning of your gradient
	var end   = convertToRGB (colorEnd);    	// The end of your gradient
	var len = colorCount;						// The number of colors to compute

	//Alpha blending amount
	var alpha = 0.0;
	var colors = [];
	
	for (i = 0; i < len; i++) {
		var c = [];
		alpha += (1.0/len);
		c[0] = start[0] * alpha + (1 - alpha) * end[0];
		c[1] = start[1] * alpha + (1 - alpha) * end[1];
		c[2] = start[2] * alpha + (1 - alpha) * end[2];
		colors.push(convertToHex (c));
	}
	return colors;
}

var filterHosts = function(e) {
	var value = e.component.option("value");
	mapOptions.hostFilter = value;
	mapOptions.ajax = false;		// Just repaint the map, no need to re-pull the ajax
	console.log("Filtering hosts with value:",value,",mapOptions:",mapOptions);
	drawMap();
}

var updateLastSeen = function(e) {
	var value = e.component.option("value");
	mapOptions.lastSeen = value;
	mapOptions.ajax = false;		// Just repaint the map, no need to re-pull the ajax
	console.log("Filtering map with last_seen value:",value,",mapOptions:",mapOptions);
	drawMap();
}


	
var rotateMap = function(e) {
	
	var lastVal = e.previousValue;
	var nowVal = e.value;
	console.log("Now:",nowVal,"Last:",lastVal,"Degrees:",nowVal-lastVal);
	var degrees = nowVal-lastVal;
	mapOptions.rotateDegrees = degrees;
	network.storePositions();
	var items = nodesData.get();
	var pointStore=[];
	for (i in items) {
		converted = network.DOMtoCanvas({x:items[i].x, y:items[i].y});
		pointStore.push([Point(converted.x,converted.y),1]);
		
	}
	var centreCoord = calcWeightedMidpoint(pointStore);		// Find the centre of the map to rotate around that
	console.log('Points are:',pointStore);
	console.log('Centre is:',centreCoord);
	for (i in items) {
			var currentX = items[i].x;
			var currentY = items[i].y;
			newPoint = rotatePoint(centreCoord.x,centreCoord.y,currentX,currentY,degrees);
			console.log("Item moves from:",currentX,",",currentY,'to:',newPoint.x,",",newPoint.y);
			items[i].x = newPoint.x;
			items[i].y = newPoint.y;
	}
	nodesData = items;
	var data = {
		  nodes: nodesData,
		  edges: edgesData
	};
	network.setData(data);
	
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
	
	var seed = 0; // D3 doesn't use seed the same way
	var options = [];
	
	var canvas_x = container ? container.clientWidth : 1280;
	var canvas_y = container ? container.clientHeight : 1080;
	
	var jsonItems = JSON.stringify(items);
	var jsonOptions = JSON.stringify(options);
	console.log("Projected JSON:",jsonItems);
	$.ajax({
		method: "POST",
		url: "ajax.php",
		dataType: "jsonp",
		data : {
			action: "ajax_map_save_options",
			__csrf_magic: csrfMagicToken,
			items: jsonItems,
			options: jsonOptions,
			user_id: user_id,
			rule_id: rule_id,
			canvas_x: canvas_x,
			canvas_y: canvas_y,
			seed: seed
		},
		success: function(response) {
			message = typeof(response.Response[0].message) === 'undefined' ? "" : response.Response[0].message;
			DevExpress.ui.notify(message,"success",3000);
			drawMap();
		},
		error: function(e) {
			DevExpress.ui.notify("Error saving map for user:"+user_id,"error",3000);	
		}
	});
}

// Call the AJAX to reset the map
var resetMap = function() {
	
	$.ajax({
		method: "POST",
		url: "ajax.php",
		dataType: "jsonp",
		data : {
			action: "ajax_map_reset_options",
			format: "jsonp",
			__csrf_magic: csrfMagicToken,
			user_id: user_id,
			rule_id: rule_id
		},
		success: function(response) {
			console.log("resetMap:",response);
			message = typeof(response.Response[0].message) === 'undefined' ? "" : response.Response[0].message;
			DevExpress.ui.notify(message,"success",3000);
			drawMap();
		},
		error: function(e) {
			DevExpress.ui.notify("Error resetting map for user:"+user_id,"error",3000);	
		}
	});
	
}

// Map nodes to array indexed by id
var filterNodes = function(staticNodes) {
	
	var nodes = staticNodes.slice();
	var nodesId = [];
	var filter = mapOptions.hostFilter;
	var regex = new RegExp(filter,"i");
	for (var node in nodes) {
		if (nodes.hasOwnProperty(node)) {
			var id = nodes[node].id;
			var label = nodes[node].label;
			console.log("filterNodes(): ID=",id,", Filter=",mapOptions.hostFilter," , Label =",label);
			if (label.match(regex)) {
				console.log("filterNodes(): Label matching, keeping ID:",id,", array is:",nodesId);
				nodesId[id] = nodes[node];
			}
		}
	}
	return(nodesId);
}

// Filter for only edges matching the hostFilter or edgeFilter values

var filterEdges = function(staticNodes,staticEdges) {
	
	var edges = staticEdges.slice();		// Don't work on the source variables
	var nodes = staticNodes.slice();
	var nodesId = filterNodes(nodes);
	var keeping = [];
	var momentNow = moment([]);
	var filterLastSeen = moment([]);
	filterLastSeen.subtract(mapOptions.lastSeen,'d');
	console.log("Now:",momentNow.format("dddd, MMMM Do YYYY, h:mm:ss a"),"Last Seen:",filterLastSeen.format("dddd, MMMM Do YYYY, h:mm:ss a"));
	for (var edge in edges) {
		if (edges.hasOwnProperty(edge)) {
			var thisEdge = edges[edge];
			var from = thisEdge.from;
			var to = thisEdge.to;
			var edgeLastSeen =  moment(thisEdge.last_seen,"YYYY-MM-DD HH:mm:ss");
			if (!(from in nodesId || to in nodesId)) {
				console.log("Deleting edge:",edge,", data:",edges[edge]);
				delete edges[edge];
			}
			else if (edgeLastSeen.isBefore(filterLastSeen) ) {
				console.log("Delete old edge:",edgeLastSeen.format("dddd, MMMM Do YYYY, h:mm:ss a"),"Filter is:",filterLastSeen.format("dddd, MMMM Do YYYY, h:mm:ss a"));
				delete edges[edge];
			}
			else {
				keeping[from] = true;
				keeping[to] = true;
				console.log("Keeping edge:",edge,", data:",edges[edge],",keeping is:",keeping);
			}
		}
	}
	// Return an object with the filtered edges, plus the nodes we're keeping
	return({
		edges: edges,
		keeping: keeping
	});
}

var reindexObject = function(obj) {
	var newObject = [];
	for (var i in obj) {
		if (obj.hasOwnProperty(i)) {
			newObject.push(obj[i]);	
		}
	}
	return(newObject);
}

var drawMap = function() {
	
	var container = document.getElementById('map_container');
	var physics = true;
	var dataOptions = {
				action: "ajax_interface_map",
				rule_id: rule_id,
				__csrf_magic: csrfMagicToken,
	};
	
	// if (mapOptions.hostFilter) { dataOptions.host_filter = mapOptions.hostFilter;	}
	console.log("drawMap(): mapOptions is",mapOptions);
	
	if (mapOptions.ajax == true) {
		console.log("drawMap() is fetching nodes from AJAX...");
		$.ajax({
				method: "POST",
				url: "ajax.php",
				data: dataOptions,
				dataType: "jsonp",
				// Work with the response
				success: function( response ) {
					responseArray = typeof(response.Response[0]) === 'undefined' ? [] : response.Response[0];
					console.log("AJAX: fetch_nodes = ",responseArray ); // server response
					var edges = typeof(responseArray.edges) === 'undefined' ? [] : responseArray.edges;
					var nodes = typeof(responseArray.nodes) === 'undefined' ? [] : responseArray.nodes;
					mapOptions.ajaxEdges = edges.slice();
					mapOptions.ajaxNodes = nodes.slice();
					console.log("drawMap(): mapOptions AFTER AJAX is",mapOptions);
					
					physics = !(typeof(responseArray.physics) === 'undefined') ? responseArray.physics : true;
					seed = responseArray.seed ? responseArray.seed : false;

					console.log("Physics:",physics);
					console.log("Physics:",responseArray.physics);
					
					// Make the color bands for the links
					var colorArray = generateColor("#ff3300","#66ff66",10);
					for (var i=0; i < edges.length; i++) {
						var pollerData = edges[i].poller;
						if (!(typeof(pollerData.traffic_in) === 'undefined')) {
							var deltaMax = pollerData.traffic_in.delta > pollerData.traffic_out.delta ? pollerData.traffic_in.delta : pollerData.traffic_out.delta;
							deltaMax = parseInt(deltaMax*8/1000/1000);  // Speed is in mbps
							var intSpeed = edges[1].value;
							var percUtilised = deltaMax / intSpeed * 100;
							var colorIndex = parseInt(percUtilised / colorArray.length);
							//console.log("i:",i,"deltaMax:",deltaMax,", percUtilised:",percUtilised,",colorIndex:",colorIndex,',color:',colorArray[colorIndex]);
							var color = "#"+ colorArray[colorIndex];
							edges[i].color = {
								color: color,
								highlight: color,
								hover: color,
								opacity:1.0
							};
							edges[i].label = '['+i+'] ' + edges[i].label;
							var delta_in = Number(pollerData.traffic_in.delta * 8 / 1000 / 1000).toFixed(2);
							var delta_out = Number(pollerData.traffic_out.delta * 8 / 1000 / 1000).toFixed(2);
							
							edges[i].title +="<br>Inbound: " + delta_in + "mpbs, Outbound: " + delta_out + 'mbps';
						}
					}
					
					var scalingOptions = { min: 1, max: 5, label: { enabled: false}};
					//scalingOptions = {};
					
					// Filter out nodes
					
					if (mapOptions.hostFilter || mapOptions.lastSeen) {
						console.warn("Filtering Map.");
						var keepEdges = filterEdges(nodes,edges);
						var keeping = keepEdges.keeping;
						edges = keepEdges.edges;
							
						for (var node in nodes) {
							if (nodes.hasOwnProperty(node)) {
								var label = nodes[node].label;
								var id = nodes[node].id
								if (!(id in keeping)) { 
									// console.log("Delete Node:",node,nodes[node]);
									delete nodes[node];
								}
								else {
									// console.log("Keep Node:",node,nodes[node]);
								}
							}
						}
						// VisJS breaks if the keys aren't sequential, so after deleting the nodes we're filtering, we need to reindex the objects again
						edges = reindexObject(edges);
						nodes = reindexObject(nodes);
					}
					
					console.log("Nodes:",nodes,"Edges",edges,"Keeping",keeping);
					nodesData = nodes;
					edgesData = edges;
					
					var data = {
					  nodes: nodesData,
					  edges: edgesData
					};
					
					var options = {
						//physics: { stabilization: true },
						physics: physics,
						layout: { improvedLayout: true},
						nodes:  { color: '#33cccc', font : {size: 7} },
						edges:  {
								scaling: scalingOptions,
								//smooth:  { enabled:true, type:'continuous',forceDirection: 'none' },
						}
					};
					
					if (seed) {
						options.layout.randomSeed = seed;
						console.log("Set random_seed to:",seed);
						console.log("Options now:",options);
						console.log("Nodes is:",nodesData);
					}
		
					// create a network
					console.log("Network Data:",data);
					console.log("Network Options:",options);
					network = new vis.Network(container, data, options);
					console.log("Created the new vis.Network");
					// doubleClick event handler
					network.on('doubleClick', function(e) {
						console.log("Doubleclick fired with e=",e);
						var edgeId = typeof(e.edges[0]) === 'undefined' ? [] : e.edges[0];
						var edge = edgesData.get(edgeId);
						console.log("Edge:",edge);
						var x = e.event.center.x;
						var y = e.event.center.y;
						if (edge.graph_id) {
							console.log("Starting on edge.");
							if (!$("div."+edgeId).length) {
								$("#cactiContent").append("<div class='"+edgeId+"' style='left:"+x+"px; top:"+y+"px; position:absolute'></div>");
								$("div."+edgeId).append("<div id='tooltip_" + edgeId + "' class='mydxtooltip tooltip_"+edgeId+"'></div>");
							}
							else {
								console.log("Moving Div to:",x,",",y);
								$("div."+edgeId).animate({left:x, top:y},0);
							}
							
							
							
							var graph_id = edge.graph_id;
							var graph_height = 150;
							var graph_width = 600;
							var rra_id = 1;
							var url = '../../graph_json.php?' + 'local_graph_id=' + graph_id + '&graph_height=' + graph_height +
									  '&graph_start=' + graph_start + '&graph_end=' + graph_end + '&rra_id=' + rra_id + '&graph_width=' + graph_width +'&disable_cache=true';
							var d = new Date();
							var graph_end = Math.round(d.getTime() / 1000);
							var graph_start = graph_end - 86400;
							
							 $.ajax({
								dataType: "json",
								url: url,
								data: {
									__csrf_magic: csrfMagicToken
								},
								success:  function(data) {
										console.log("Data from AJAX is:",data);
										
										var template = 
												"<img id='graph_"+data.local_graph_id+
												"' src='data:image/"+data.type+";base64,"+data.image+
												"' graph_start='"+data.graph_start+
												"' graph_end='"+data.graph_end+
												"' graph_left='"+data.graph_left+
												"' graph_top='"+data.graph_top+
												"' graph_width='"+data.graph_width+
												"' graph_height='"+data.graph_height+
												"' image_width='"+data.image_width+
												"' image_height='"+data.image_height+
												"' canvas_left='"+data.graph_left+
												"' canvas_top='"+data.graph_top+
												"' canvas_width='"+data.graph_width+
												"' canvas_height='"+data.graph_height+
												"' width='"+data.image_width+
												"' height='"+data.image_height+
												"' value_min='"+data.value_min+
												"' value_max='"+data.value_max+"'>";
										
										var tooltip = $("div.tooltip_"+edgeId).dxTooltip({
											target: "div."+edgeId,
											position: "right",
											closeOnOutsideClick: function(e) { console.log("Moo!"); tooltip.hide();},
											contentTemplate: function(data) {
												data.html(template);
											}
										}).dxTooltip("instance");
										tooltips[edgeId] = tooltip;
										tooltip.show();
										//responsiveResizeGraphs();
								}
							 });
							
							
						}
					});
					
					network.on("dragging", function() { hideTooltips();});
					network.on("zoom", function() { hideTooltips();});
					network.on("click", function() { hideTooltips();});
					
					
				}
			});
	}
	else if (network) {				// Just refresh the existing map
		
		var nodes = mapOptions.ajaxNodes.slice();
		var edges = mapOptions.ajaxEdges.slice();
		var keeping = [];
		console.log("Refreshing only. mapOptions:",mapOptions,",nodes:",nodes,",edges:",edges);
		if (mapOptions.hostFilter || mapOptions.lastSeen) {
			console.log("Filtering without ajax refresh, nodes:",nodes,",edges:",edges,"mapOptions:",mapOptions);
			var keepEdges = filterEdges(nodes,edges);
			console.log("After filterEdges():",nodes,",edges:",edges,"mapOptions:",mapOptions);
			keeping = keepEdges.keeping;
			edges = keepEdges.edges;
				
			for (var node in nodes) {
				if (nodes.hasOwnProperty(node)) {
					var label = nodes[node].label;
					var id = nodes[node].id
					if (!(id in keeping)) { 
						console.log("Delete Node:",node,nodes[node]);
						delete nodes[node];
					}
					else {
						console.log("Keep Node:",node,nodes[node]);
					}
				}
			}
			
		}
		// VisJS breaks if the keys aren't sequential, so after deleting the nodes we're filtering, we need to reindex the objects again
		edges = reindexObject(edges);
		nodes = reindexObject(nodes);
		
		console.log("Nodes:",nodes,"Edges",edges,"Keeping",keeping,"mapOptions:",mapOptions);
		nodesData = nodes;
		edgesData = edges;
		
		var data = {
		  nodes: nodesData,
		  edges: edgesData
		};
		network.setData(data);
		network.fit();
		
	}
}

function hideTooltips() {
	for(var index in tooltips) { 
		if (tooltips.hasOwnProperty(index)) {
			var tooltip = tooltips[index];
			console.log("Disposing of dxTooltip",index,":",tooltip);
			tooltip.dispose();
			delete tooltips[index]; // Remove this object
		}
	}
}

/* ---------------------*/
/* Coordinate functions */
/* ---------------------*/



function rotatePoint(cx, cy, x, y, angle) {
    var radians = (Math.PI / 180) * angle,
        cos = Math.cos(radians),
        sin = Math.sin(radians),
        nx = (cos * (x - cx)) + (sin * (y - cy)) + cx,
        ny = (cos * (y - cy)) - (sin * (x - cx)) + cy;
    return ({x : nx , y : ny});
}

// Credit: The weighted centre average code is from the following Stackoverflow answer
// Author: naomik (https://stackoverflow.com/users/633183/naomik)
// Answer: https://stackoverflow.com/a/42521032

// math
const pythag = (a,b) => Math.sqrt(a * a + b * b)
const rad2deg = rad => rad * 180 / Math.PI
const deg2rad = deg => deg * Math.PI / 180
const atan2 = (y,x) => rad2deg(Math.atan2(y,x))
const cos = x => Math.cos(deg2rad(x))
const sin = x => Math.sin(deg2rad(x))

// Point
const Point = (x,y) => ({
  x,
  y,
  add: ({x: x2, y: y2}) =>
    Point(x + x2, y + y2),
  sub: ({x: x2, y: y2}) =>
    Point(x - x2, y - y2),
  bind: f =>
    f(x,y),
  inspect: () =>
    `Point(${x}, ${y})`
})

Point.origin = Point(0,0)
Point.fromVector = ({a,m}) => Point(m * cos(a), m * sin(a))

// Vector
const Vector = (a,m) => ({
  a,
  m,
  scale: x =>
    Vector(a, m*x),
  add: v =>
    Vector.fromPoint(Point.fromVector(Vector(a,m)).add(Point.fromVector(v))),
  inspect: () =>
    `Vector(${a}, ${m})`
})

Vector.zero = Vector(0,0)
Vector.unitFromPoint = ({x,y}) => Vector(atan2(y,x), 1)
Vector.fromPoint = ({x,y}) => Vector(atan2(y,x), pythag(x,y))


// calc unweighted midpoint
const calcMidpoint = points => {
  let count = points.length;
  let midpoint = points.reduce((acc, [point, _]) => acc.add(point), Point.origin)
  return midpoint.bind((x,y) => Point(x/count, y/count))
}

// calc weighted point
const calcWeightedMidpoint = points => {
  let midpoint = calcMidpoint(points)
  let totalWeight = points.reduce((acc, [_, weight]) => acc + weight, 0)
  let vectorSum = points.reduce((acc, [point, weight]) =>
    acc.add(Vector.fromPoint(point.sub(midpoint)).scale(weight/totalWeight)), Vector.zero)
  return Point.fromVector(vectorSum).add(midpoint)
}



$(document).ready(function() {
	
	
	$("#positions").click(function() { storeCoords();});
	drawMap();
			
});