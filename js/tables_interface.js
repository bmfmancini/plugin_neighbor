/* exported renderNeighborTypeSelector, renderNeighborTable, normalizeNeighborResponse, formatNeighborDateTime */

(function() {
	const NEIGHBOR_TYPES = [
		{ name: 'CDP/LLDP', value: 'xdp', icon: 'ion-link' },
		{ name: 'IP Subnet', value: 'ipv4', icon: 'ion-code-working' },
		{ name: 'Interface Descriptions', value: 'ifalias', icon: 'ion-ios-color-wand-outline' }
	];

	function escapeHtml(value) {
		return String(value)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/\"/g, '&quot;')
			.replace(/'/g, '&#39;');
	}

	function normalizeNeighborResponse(response) {
		if (!response || !response.Response || !Array.isArray(response.Response)) {
			return [];
		}

		return Array.isArray(response.Response[0]) ? response.Response[0] : [];
	}

	function formatNeighborDateTime(value) {
		if (!value) {
			return '';
		}

		const source = String(value).trim();
		if (source === '') {
			return '';
		}

		const parts = source.split(' ');
		if (parts.length !== 2) {
			return source;
		}

		const dateParts = parts[0].split('-');
		if (dateParts.length !== 3) {
			return source;
		}

		return dateParts[2] + '/' + dateParts[1] + '/' + dateParts[0] + ' ' + parts[1];
	}

	function normalizeSortValue(value, dataType) {
		if (value === null || value === undefined) {
			return '';
		}

		if (dataType === 'datetime') {
			const ts = Date.parse(String(value).replace(' ', 'T'));
			return Number.isNaN(ts) ? String(value).toLowerCase() : ts;
		}

		if (typeof value === 'number') {
			return value;
		}

		const numeric = Number(value);
		if (!Number.isNaN(numeric) && String(value).trim() !== '') {
			return numeric;
		}

		return String(value).toLowerCase();
	}

	function normalizeHostFilterValues(value) {
		if (Array.isArray(value)) {
			return value.map(function(v) { return String(v || '').trim(); }).filter(function(v) { return v !== ''; });
		}

		if (value === null || value === undefined || value === '') {
			return [];
		}

		return [String(value).trim()].filter(function(v) { return v !== ''; });
	}

	function enableHostMultiselectFilter(selectEl, onChange) {
		if (!selectEl || typeof $ !== 'function' || !$.fn || typeof $.fn.multiselect !== 'function') {
			return;
		}

		const $select = $(selectEl);

		if ($select.data('multiselect')) {
			$select.multiselect('destroy');
		}

		function emitSelection() {
			const raw = $select.val();
			onChange(normalizeHostFilterValues(raw));
		}

		$select.multiselect({
			selectedList: 2,
			header: true,
			minWidth: 260,
			noneSelectedText: 'All Hosts',
			selectedText: '# selected',
			checkAllText: 'Select all',
			uncheckAllText: 'Clear',
			click: emitSelection,
			checkAll: emitSelection,
			uncheckAll: emitSelection,
			close: emitSelection
		});

		if (typeof $.fn.multiselectfilter === 'function') {
			$select.multiselectfilter({
				label: 'Search',
				placeholder: 'Type to filter'
			});
		}
	}

	function renderNeighborTypeSelector(currentType) {
		const holder = document.getElementById('neighbor_toolbar');
		if (!holder) {
			return;
		}

		const selected = NEIGHBOR_TYPES.some(function(t) { return t.value === currentType; }) ? currentType : 'xdp';

		holder.innerHTML = [
			"<div class='neighbor-banner'>",
			"<div class='neighbor-banner-title'>Interface Neighbors</div>",
			"<div class='neighbor-banner-controls'>",
			"<label for='neighbor_table_search'><strong>Search</strong></label>",
			"<input id='neighbor_table_search' type='search' placeholder='Enter a regular expression' style='min-width:260px;'>",
			"<label for='neighbor_type_select'><strong>Type</strong></label>",
			"<select id='neighbor_type_select' style='min-width:260px;padding:4px;'>",
			NEIGHBOR_TYPES.map(function(type) {
				const selectedAttr = type.value === selected ? ' selected' : '';
				return "<option value='" + escapeHtml(type.value) + "'" + selectedAttr + ">" +
					escapeHtml(type.name) +
				"</option>";
			}).join(''),
			"</select>",
			"<label for='neighbor_host_filter'><strong>Host</strong></label>",
			"<select id='neighbor_host_filter' multiple='multiple' style='min-width:260px;padding:4px;'>",
			"</select>",
			"<button type='button' class='neighbor-btn-primary' id='neighbor_toolbar_go'>Go</button>",
			"<button type='button' id='neighbor_toolbar_clear'>Clear</button>",
			"</div>",
			"</div>"
		].join('');

		const select = document.getElementById('neighbor_type_select');
		if (!select) {
			return;
		}

		select.addEventListener('change', function() {
			const value = this.value;
			window.location.replace('neighbor.php?action=neighbor_interface&neighbor_type=' + encodeURIComponent(value));
		});

		const search = document.getElementById('neighbor_table_search');
		const hostFilter = document.getElementById('neighbor_host_filter');
		const goButton = document.getElementById('neighbor_toolbar_go');
		const clearButton = document.getElementById('neighbor_toolbar_clear');

		if (hostFilter) {
			hostFilter.addEventListener('change', function() {
				if (typeof window.neighborApplyHostFilter === 'function') {
					window.neighborApplyHostFilter(Array.prototype.map.call(this.selectedOptions || [], function(opt) {
						return String(opt.value || '').trim();
					}).filter(function(v) {
						return v !== '';
					}));
				}
			});
		}

		if (goButton) {
			goButton.addEventListener('click', function() {
				if (typeof window.neighborApplyTableSearch === 'function') {
					window.neighborApplyTableSearch(search ? search.value : '');
				}
				if (typeof window.neighborApplyHostFilter === 'function') {
					window.neighborApplyHostFilter(hostFilter ? hostFilter.value : '');
				}
			});
		}

		if (clearButton) {
			clearButton.addEventListener('click', function() {
				if (search) {
					search.value = '';
				}
				if (hostFilter) {
					Array.prototype.forEach.call(hostFilter.options || [], function(option) {
						option.selected = false;
					});
				}
				if (typeof window.neighborApplyTableSearch === 'function') {
					window.neighborApplyTableSearch('');
				}
				if (typeof window.neighborApplyHostFilter === 'function') {
					window.neighborApplyHostFilter('');
				}
			});
		}
	}

	function renderNeighborTable(containerSelector, columns, data) {
		const holder = document.querySelector(containerSelector);
		if (!holder) {
			return;
		}

		const rows = Array.isArray(data) ? data.slice() : [];
		const state = {
			query: '',
			hosts: [],
			sortField: columns.length ? columns[0].dataField : null,
			sortDirection: 'asc'
		};

		holder.innerHTML = [
			"<div class='neighbor-table-controls' style='display:flex;justify-content:flex-end;align-items:center;gap:12px;margin:8px 0 10px;'>",
			"<span id='neighbor_table_count' style='color:#666;'></span>",
			"</div>",
			"<div style='overflow:auto;border:1px solid #ddd;'>",
			"<table id='neighbor_table' class='cactiTable' style='width:100%;border-collapse:collapse;'>",
			"<thead><tr>",
			columns.map(function(column) {
				return "<th data-field='" + escapeHtml(column.dataField) + "' style='cursor:pointer;white-space:nowrap;padding:6px 8px;border-bottom:1px solid #ddd;text-align:left;background:#f5f5f5;'>" +
					escapeHtml(column.caption) +
				"</th>";
			}).join(''),
			"</tr></thead>",
			"<tbody></tbody>",
			"</table>",
			"</div>"
		].join('');

		const tbody = holder.querySelector('#neighbor_table tbody');
		const count = holder.querySelector('#neighbor_table_count');
		const headers = holder.querySelectorAll('#neighbor_table th[data-field]');
		const hostFilter = document.getElementById('neighbor_host_filter');

		function getRowHostnames(row) {
			const hosts = [];
			if (!row || typeof row !== 'object') {
				return hosts;
			}
			if (row.hostname !== null && row.hostname !== undefined && String(row.hostname).trim() !== '') {
				hosts.push(String(row.hostname).trim());
			}
			if (row.neighbor_hostname !== null && row.neighbor_hostname !== undefined && String(row.neighbor_hostname).trim() !== '') {
				hosts.push(String(row.neighbor_hostname).trim());
			}
			return hosts;
		}

		function populateHostFilter() {
			if (!hostFilter) {
				return;
			}

			const hostMap = {};
			rows.forEach(function(row) {
				getRowHostnames(row).forEach(function(hostname) {
					hostMap[hostname] = true;
				});
			});

			const hosts = Object.keys(hostMap).sort(function(a, b) {
				return a.localeCompare(b);
			});

			hostFilter.innerHTML = hosts.map(function(host) {
				return "<option value='" + escapeHtml(host) + "'>" + escapeHtml(host) + "</option>";
			}).join('');

			state.hosts = state.hosts.filter(function(hostname) {
				return hostMap[hostname];
			});

			Array.prototype.forEach.call(hostFilter.options || [], function(option) {
				option.selected = state.hosts.indexOf(option.value) !== -1;
			});

			enableHostMultiselectFilter(hostFilter, function(selectedHosts) {
				state.hosts = selectedHosts;
				renderRows();
			});
		}

		function filterRows() {
			return rows.filter(function(row) {
				if (state.hosts.length > 0) {
					const hostMatch = getRowHostnames(row).some(function(hostname) {
						return state.hosts.indexOf(hostname) !== -1;
					});

					if (!hostMatch) {
						return false;
					}
				}

				if (!state.query) {
					return true;
				}

				const q = state.query.toLowerCase();
				return columns.some(function(column) {
					const value = row ? row[column.dataField] : '';
					return String(value === null || value === undefined ? '' : value).toLowerCase().indexOf(q) !== -1;
				});
			});
		}

		function sortRows(filtered) {
			if (!state.sortField) {
				return filtered;
			}

			const field = state.sortField;
			const column = columns.find(function(c) { return c.dataField === field; }) || {};
			const direction = state.sortDirection === 'asc' ? 1 : -1;

			return filtered.sort(function(a, b) {
				const av = normalizeSortValue(a ? a[field] : '', column.dataType);
				const bv = normalizeSortValue(b ? b[field] : '', column.dataType);
				if (av < bv) {
					return -1 * direction;
				}
				if (av > bv) {
					return 1 * direction;
				}
				return 0;
			});
		}

		function renderRows() {
			const filtered = sortRows(filterRows());
			if (count) {
				count.textContent = filtered.length + ' row(s)';
			}

			if (!filtered.length) {
				tbody.innerHTML = "<tr><td colspan='" + columns.length + "' style='padding:10px;color:#666;text-align:center;'>No rows found</td></tr>";
				return;
			}

			tbody.innerHTML = filtered.map(function(row) {
				return '<tr>' + columns.map(function(column) {
					const raw = row ? row[column.dataField] : '';
					const value = (typeof column.formatter === 'function') ? column.formatter(raw, row) : raw;
					return "<td style='padding:6px 8px;border-top:1px solid #eee;white-space:nowrap;'>" +
						escapeHtml(value === null || value === undefined ? '' : value) +
					"</td>";
				}).join('') + '</tr>';
			}).join('');
		}

		window.neighborApplyTableSearch = function(value) {
			state.query = String(value || '').trim();
			renderRows();
		};

		window.neighborApplyHostFilter = function(value) {
			state.hosts = normalizeHostFilterValues(value);
			if (hostFilter) {
				Array.prototype.forEach.call(hostFilter.options || [], function(option) {
					option.selected = state.hosts.indexOf(option.value) !== -1;
				});
				if (typeof $ === 'function' && $.fn && typeof $.fn.multiselect === 'function') {
					$(hostFilter).multiselect('refresh');
				}
			}
			renderRows();
		};

		headers.forEach(function(header) {
			header.addEventListener('click', function() {
				const field = this.getAttribute('data-field');
				if (!field) {
					return;
				}

				if (state.sortField === field) {
					state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
				} else {
					state.sortField = field;
					state.sortDirection = 'asc';
				}

				headers.forEach(function(h) {
					const title = h.textContent.replace(/\s+[▲▼]$/, '');
					h.textContent = title;
				});

				const marker = state.sortDirection === 'asc' ? ' ▲' : ' ▼';
				this.textContent = this.textContent.replace(/\s+[▲▼]$/, '') + marker;
				renderRows();
			});
		});

		populateHostFilter();
		renderRows();
	}

	window.renderNeighborTypeSelector = renderNeighborTypeSelector;
	window.renderNeighborTable = renderNeighborTable;
	window.normalizeNeighborResponse = normalizeNeighborResponse;
	window.formatNeighborDateTime = formatNeighborDateTime;
})();
