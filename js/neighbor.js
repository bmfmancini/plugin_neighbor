/* eslint-disable no-var */
/* exported mapToolbar, selectBox, rule_id, user_id, ruleDropdown, neighborNotify */

// Called by neighbor.php

var mapList = [];
var mapToolbar;
var selectBox;
var rule_id = 1;
var user_id;

function neighborNotify(message, level) {
	const prefix = level ? '[' + String(level).toUpperCase() + '] ' : '';
	if (level === 'error') {
		console.error(prefix + message);
	} else if (level === 'warning') {
		console.warn(prefix + message);
	} else {
		console.info(prefix + message);
	}

	window.setTimeout(function() {
		window.alert(String(message));
	}, 0);
}

function getCurrentAction() {
	const params = new URLSearchParams(window.location.search);
	return params.get('action') || 'neighbor_map';
}

function renderNeighborTabs() {
	const tabs = [
		{ text: 'Maps', icon: 'globe', content: 'neighbor_map' },
		{ text: 'Interface Neighbors', icon: 'fa fa-link', content: 'neighbor_interface' },
		{ text: 'Routing Neighbors', icon: 'fa fa-cloud', content: 'neighbor_routing' }
	];

	const holder = document.getElementById('neighbor_tabs');
	if (!holder) {
		return;
	}

	const currentAction = getCurrentAction();
	holder.innerHTML = [
		"<div style='display:flex;gap:8px;flex-wrap:wrap;padding:8px 0;'>",
		tabs.map(function(tab) {
			const active = tab.content === currentAction;
			const activeStyle = active ? 'background:#2d6cdf;color:#fff;border-color:#2d6cdf;' : 'background:#f4f4f4;color:#333;border-color:#ccc;';
			return "<button type='button' data-action='" + tab.content + "' style='border:1px solid;padding:6px 10px;border-radius:4px;cursor:pointer;" + activeStyle + "'>" +
				"<span class='" + tab.icon + "' style='padding-right:5px'></span>" + tab.text +
			"</button>";
		}).join(''),
		'</div>'
	].join('');

	Array.prototype.forEach.call(holder.querySelectorAll('button[data-action]'), function(btn) {
		btn.addEventListener('click', function() {
			window.location.href = 'neighbor.php?action=' + this.getAttribute('data-action');
		});
	});
}

function setMapOptionsFromHostSelect(select) {
	const values = Array.prototype.map.call(select.selectedOptions || [], function(opt) {
		return opt.value;
	}).filter(function(v) {
		return v !== null && v !== undefined && String(v) !== '';
	});

	mapOptions.selectedHosts = values;
	mapOptions.ajax = true;
	drawMap();
}

function normalizeResponseArray(response) {
	if (!response) {
		return [];
	}

	if (Array.isArray(response)) {
		return response;
	}

	if (Array.isArray(response.Response)) {
		if (Array.isArray(response.Response[0])) {
			return response.Response[0];
		}
		return response.Response;
	}

	return [];
}

function enableMapMultiselect(mapSelect) {
	// Keep map selector native for stable single-select rendering.
	void mapSelect;
}

function enableHostMultiselect(hostSelect) {
	if (!hostSelect || typeof $ !== 'function' || !$.fn || typeof $.fn.multiselect !== 'function') {
		return;
	}

	const $hostSelect = $(hostSelect);
	if ($hostSelect.data('multiselect')) {
		$hostSelect.multiselect('refresh');
		return;
	}

	$hostSelect.multiselect({
		selectedList: 3,
		noneSelectedText: 'Select host(s)...',
		selectedText: '# selected',
		checkAllText: 'Select all',
		uncheckAllText: 'Clear',
		close: function() {
			setMapOptionsFromHostSelect(hostSelect);
		},
		click: function() {
			setMapOptionsFromHostSelect(hostSelect);
		},
		checkAll: function() {
			setMapOptionsFromHostSelect(hostSelect);
		},
		uncheckAll: function() {
			setMapOptionsFromHostSelect(hostSelect);
		}
	});
}

function populateHostSelector(hostSelect) {
	$.ajax({
		method: 'GET',
		url: 'ajax.php?action=ajax_neighbor_hosts&format=jsonp',
		dataType: 'jsonp',
		success: function(resp) {
			const items = normalizeResponseArray(resp);
			hostSelect.innerHTML = items.map(function(item) {
				const id = item && item.id !== undefined ? item.id : '';
				const name = item && item.name !== undefined ? item.name : id;
				return "<option value='" + String(id) + "'>" + String(name) + "</option>";
			}).join('');
			enableHostMultiselect(hostSelect);
		}
	});
}

function updateRuleSelectorOptions() {
	if (!selectBox) {
		return;
	}

	if (!mapList.length) {
		if (rule_id !== null && rule_id !== undefined && String(rule_id) !== '') {
			selectBox.innerHTML = "<option value='" + String(rule_id) + "' selected>Map " + String(rule_id) + "</option>";
		} else {
			selectBox.innerHTML = "<option value=''>No maps found</option>";
		}
		enableMapMultiselect(selectBox);
		return;
	}

	selectBox.innerHTML = mapList.map(function(item) {
		const id = item && item.id !== undefined ? String(item.id) : '';
		let name = item && item.name !== undefined ? String(item.name) : '';
		if (name.trim() === '') {
			name = id ? ('Map ' + id) : 'Unnamed Map';
		}
		const selected = String(rule_id) === id ? ' selected' : '';
		return "<option value='" + id + "'" + selected + '>' + name + '</option>';
	}).join('');

	if (!selectBox.value && mapList.length > 0) {
		selectBox.value = String(mapList[0].id);
		rule_id = selectBox.value;
	}

	enableMapMultiselect(selectBox);
}

// Get the list of maps from AJAX
var ruleDropdown = function() {
	$.ajax({
		method: 'GET',
		url: 'ajax.php?action=ajax_map_list&format=jsonp',
		dataType: 'jsonp',
			success: function(response) {
				const rows = normalizeResponseArray(response);
				mapList = rows.map(function(row) {
					const id = row && row.id !== undefined ? row.id : (row && row.rule_id !== undefined ? row.rule_id : '');
					const rawName = row && row.name !== undefined ? row.name : '';
					const rawDesc = row && row.description !== undefined ? row.description : '';
					let name = String(rawName === null ? '' : rawName).trim();
					if (name === '') {
						name = String(rawDesc === null ? '' : rawDesc).trim();
					}
					if (name === '') {
						name = 'Map ' + id;
					}
					return { id: id, name: name };
				}).filter(function(item) {
					return String(item.id) !== '';
				});
			updateRuleSelectorOptions();
		},
		error: function(xhr, status, error) {
			console.error('[neighbor] failed to load map list', status, error);
			mapList = [];
			updateRuleSelectorOptions();
		}
	});
};

function renderMapToolbar() {
	const holder = document.getElementById('neighbor_map_toolbar');
	if (!holder) {
		return;
	}

	holder.innerHTML = [
		"<div class='neighbor-banner'>",
		"<div class='neighbor-banner-title'>Neighbor Map</div>",
		"<div class='neighbor-banner-controls'>",
		"<label for='neighbor_map_select'><b>Select a Map:</b></label>",
		"<select id='neighbor_map_select' style='min-width:220px;padding:4px;'></select>",
		"<label for='neighbor_host_select'><b>Hosts:</b></label>",
		"<select id='neighbor_host_select' multiple size='1' style='min-width:220px;padding:4px;'></select>",
		"<label for='neighbor_last_seen'><b>Last Seen:</b></label>",
		"<input id='neighbor_last_seen' type='range' min='1' max='14' value='3' style='width:110px;'>",
		"<span id='neighbor_last_seen_value'>3 days</span>",
		"<button type='button' class='neighbor-btn-primary' id='neighbor_btn_save'>Save</button>",
		"<button type='button' id='neighbor_btn_reset'>Reset</button>",
		"<button type='button' id='neighbor_btn_seed'>Seed</button>",
		"</div>",
		'</div>'
	].join('');

	mapToolbar = holder;
	selectBox = document.getElementById('neighbor_map_select');
	const hostSelect = document.getElementById('neighbor_host_select');
	const lastSeen = document.getElementById('neighbor_last_seen');
	const lastSeenValue = document.getElementById('neighbor_last_seen_value');

	ruleDropdown(user_id, rule_id);
	populateHostSelector(hostSelect);

	selectBox.addEventListener('change', function() {
		rule_id = this.value;
		mapOptions.ajax = true;
		drawMap();
	});

	hostSelect.addEventListener('change', function() {
		setMapOptionsFromHostSelect(this);
	});

	lastSeen.addEventListener('input', function() {
		const value = Number(this.value);
		lastSeenValue.textContent = value + ' days';
		updateLastSeen(value);
	});

	document.getElementById('neighbor_btn_save').addEventListener('click', function() {
		storeCoords();
	});

	document.getElementById('neighbor_btn_reset').addEventListener('click', function() {
		if (window.confirm('Reset map to default?')) {
			resetMap();
		} else {
			neighborNotify('Reset cancelled', 'warning');
		}
	});

	document.getElementById('neighbor_btn_seed').addEventListener('click', function() {
		let seed = null;
		if (typeof network !== 'undefined' && network && typeof network.getSeed === 'function') {
			seed = network.getSeed();
		} else if (typeof mapOptions !== 'undefined' && mapOptions && mapOptions.seed) {
			seed = mapOptions.seed;
		}
		neighborNotify('Seed is: ' + (seed !== null && seed !== undefined ? seed : 'n/a'), 'info');
	});
}

$(document).ready(function() {
	rule_id = $('#rule_id').val() || rule_id;
	user_id = $('#user_id').val() || user_id;

	renderNeighborTabs();
	renderMapToolbar();
});
