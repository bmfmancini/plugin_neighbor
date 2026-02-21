// Neighbor map shared state
// Loaded before js/map.js.

var tooltips = (typeof tooltips !== "undefined" && Array.isArray(tooltips)) ? tooltips : [];

var mapOptions = (typeof mapOptions !== "undefined" && mapOptions) ? mapOptions : {
	ajax: true,
	refreshInterval: 30000,
	selectedHosts: []
};

var nodesData = (typeof nodesData !== "undefined" && Array.isArray(nodesData)) ? nodesData : [];
var edgesData = (typeof edgesData !== "undefined" && Array.isArray(edgesData)) ? edgesData : [];

var simulation = (typeof simulation !== "undefined") ? simulation : null;
var svg = (typeof svg !== "undefined") ? svg : null;
var zoom = (typeof zoom !== "undefined") ? zoom : null;
var refreshTimer = (typeof refreshTimer !== "undefined") ? refreshTimer : null;

var nodeSize = (typeof nodeSize !== "undefined") ? nodeSize : 48;
var labelSize = (typeof labelSize !== "undefined") ? labelSize : 12;

var network = (typeof network !== "undefined" && network) ? network : {
	getSeed: function() {
		return (typeof mapOptions.seed !== "undefined") ? mapOptions.seed : null;
	}
};

// Lightweight runtime smoke checks for browser console usage.
function runNeighborMapSmokeChecks() {
	const checks = [];
	checks.push({ name: "mapOptions exists", ok: typeof mapOptions === "object" && mapOptions !== null });
	checks.push({ name: "drawMap function exists", ok: typeof drawMap === "function" });
	checks.push({ name: "storeCoords function exists", ok: typeof storeCoords === "function" });
	checks.push({ name: "resetMap function exists", ok: typeof resetMap === "function" });
	checks.push({ name: "map container exists", ok: !!document.getElementById("map_container") });

	const failures = checks.filter(function(c) { return !c.ok; });
	if (failures.length) {
		console.warn("[neighbor map] smoke checks failed:", failures);
	} else {
		console.info("[neighbor map] smoke checks passed");
	}

	return checks;
}
