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

	function renderNeighborTypeSelector(currentType) {
		const holder = document.getElementById('neighbor_toolbar');
		if (!holder) {
			return;
		}

		const selected = NEIGHBOR_TYPES.some(function(t) { return t.value === currentType; }) ? currentType : 'xdp';

		holder.innerHTML = [
			"<div style='display:flex;align-items:center;gap:10px;padding:8px 0;'>",
			"<label for='neighbor_type_select'><strong>Type:</strong></label>",
			"<select id='neighbor_type_select' style='min-width:260px;padding:4px;'>",
			NEIGHBOR_TYPES.map(function(type) {
				const selectedAttr = type.value === selected ? ' selected' : '';
				return "<option value='" + escapeHtml(type.value) + "'" + selectedAttr + ">" +
					escapeHtml(type.name) +
				"</option>";
			}).join(''),
			"</select>",
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
	}

	function renderNeighborTable(containerSelector, columns, data) {
		const holder = document.querySelector(containerSelector);
		if (!holder) {
			return;
		}

		const rows = Array.isArray(data) ? data.slice() : [];
		const state = {
			query: '',
			sortField: columns.length ? columns[0].dataField : null,
			sortDirection: 'asc'
		};

		holder.innerHTML = [
			"<div class='neighbor-table-controls' style='display:flex;justify-content:space-between;align-items:center;gap:12px;margin:8px 0 10px;'>",
			"<input id='neighbor_table_search' type='search' placeholder='Search...' style='width:280px;max-width:100%;padding:4px 8px;'>",
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
		const search = holder.querySelector('#neighbor_table_search');
		const headers = holder.querySelectorAll('#neighbor_table th[data-field]');

		function filterRows() {
			if (!state.query) {
				return rows.slice();
			}

			const q = state.query.toLowerCase();
			return rows.filter(function(row) {
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

		if (search) {
			search.addEventListener('input', function() {
				state.query = this.value.trim();
				renderRows();
			});
		}

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

		renderRows();
	}

	window.renderNeighborTypeSelector = renderNeighborTypeSelector;
	window.renderNeighborTable = renderNeighborTable;
	window.normalizeNeighborResponse = normalizeNeighborResponse;
	window.formatNeighborDateTime = formatNeighborDateTime;
})();
