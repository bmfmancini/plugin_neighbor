// Neighbor map API helpers
// Loaded before js/map.js.

function neighborMapSaveOptions(payload, onSuccess, onError) {
	$.ajax({
		method: "POST",
		url: "ajax.php",
		dataType: "jsonp",
		data: payload,
		success: function(response) {
			if (typeof onSuccess === "function") {
				onSuccess(response);
			}
		},
		error: function(xhr, status, error) {
			if (typeof onError === "function") {
				onError(xhr, status, error);
			}
		}
	});
}

function neighborMapResetOptions(payload, onSuccess, onError) {
	$.ajax({
		method: "POST",
		url: "ajax.php",
		dataType: "jsonp",
		data: payload,
		success: function(response) {
			if (typeof onSuccess === "function") {
				onSuccess(response);
			}
		},
		error: function(xhr, status, error) {
			if (typeof onError === "function") {
				onError(xhr, status, error);
			}
		}
	});
}

function neighborMapFetchTopology(payload, onSuccess, onError) {
	$.ajax({
		method: "POST",
		url: "ajax.php",
		dataType: "jsonp",
		data: payload,
		success: function(response) {
			if (typeof onSuccess === "function") {
				onSuccess(response);
			}
		},
		error: function(xhr, status, error) {
			if (typeof onError === "function") {
				onError(xhr, status, error);
			}
		}
	});
}
