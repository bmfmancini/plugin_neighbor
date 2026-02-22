<?php

/*
 +-------------------------------------------------------------------------+
 | Copyright (C) 2004-2026 The Cacti Group                                 |
 |                                                                         |
 | This program is free software; you can redistribute it and/or           |
 | modify it under the terms of the GNU General Public License             |
 | as published by the Free Software Foundation; either version 2          |
 | of the License, or (at your option) any later version.                  |
 |                                                                         |
 | This program is distributed in the hope that it will be useful,         |
 | but WITHOUT ANY WARRANTY; without even the implied warranty of          |
 | MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the           |
 | GNU General Public License for more details.                            |
 +-------------------------------------------------------------------------+
 | Cacti: The Complete RRDTool-based Graphing Solution                     |
 +-------------------------------------------------------------------------+
 | This code is designed, written, and maintained by the Cacti Group. See  |
 | about.php and/or the AUTHORS file for specific developer information.   |
 +-------------------------------------------------------------------------+
 | http://www.cacti.net/                                                   |
 +-------------------------------------------------------------------------+
*/

$guest_account = true;

chdir('../../');
include_once('./include/auth.php');
include_once($config['base_path'] . '/plugins/neighbor/lib/neighbor_functions.php');

/**
 * Render a neighbor page with standard header/footer wrapper
 * 
 * @param  callable $callback Function to call for page content
 * @return void
 */
function render_neighbor_page($callback) {
	general_header();
	neighbor_tabs();
	call_user_func($callback);
	bottom_footer();
}

set_default_action('summary');

switch(get_request_var('action')) {
	case 'neighbor_map':
	case 'maps':
		render_neighbor_page('display_interface_map');

		break;
	case 'neighbor_interface':
		render_neighbor_page('display_neighbors');

		break;
	case 'xdp':
		render_neighbor_page('display_neighbors');

		break;
	case 'neighbor_routing':
		render_neighbor_page('display_routing_neighbors');

		break;
	case 'ajax_hosts':
	case 'ajax_hosts_noany':
		get_allowed_ajax_hosts(true, false, 'h.id IN (SELECT host_id FROM plugin_neighbor_xdp)');

		break;
	case 'hoststat':
		render_neighbor_page('hosts');

		break;
	default:
		render_neighbor_page('display_interface_map');

		break;
}

// Clear the Nav Cache, so that it doesn't know we came from Thold
$_SESSION['sess_nav_level_cache'] = '';

// //
// CDP & LLDP Neighbors
// //

/**
 * Display neighbor interface listing page
 * 
 * Renders the neighbor interface view with JavaScript data tables for displaying
 * CDP/LLDP, IPv4 subnet, or interface alias-based neighbor relationships.
 * 
 * @return void Outputs HTML and JavaScript includes
 */
function display_neighbors() {
	global $config;

	// ================= input validation =================
	$neighbor_type = 'xdp';

	if (isset_request_var('neighbor_type')) {
		$type          = get_filter_request_var('neighbor_type', FILTER_CALLBACK, ['options' => 'sanitize_search_string']);
		$allowed_types = ['xdp', 'ipv4', 'ifalias'];

		if (in_array($type, $allowed_types, true)) {
			$neighbor_type = $type;
		}
	}
	// ====================================================

	print "<div id='neighbor_toolbar'></div>\n";
	print "<div id='xdp_neighbors_holder'></div>\n";
	print "<form>\n";
	print "<input type='hidden' id='table' value='xdp'>\n";
	print "</form>\n";
	$css_rel_path = 'plugins/neighbor/css/ionicons.min.css';
	$js_common    = 'plugins/neighbor/js/tables_interface.js';
	$js_type      = 'plugins/neighbor/js/tables_' . $neighbor_type . '.js';

	$css_ver = file_exists($config['base_path'] . '/' . $css_rel_path) ? filemtime($config['base_path'] . '/' . $css_rel_path) : time();
	$js_common_ver = file_exists($config['base_path'] . '/' . $js_common) ? filemtime($config['base_path'] . '/' . $js_common) : time();
	$js_type_ver = file_exists($config['base_path'] . '/' . $js_type) ? filemtime($config['base_path'] . '/' . $js_type) : time();

	printf("<link rel='stylesheet' type='text/css' href='%s?v=%d'>\n", $config['url_path'] . $css_rel_path, $css_ver);
	printf("<script type='text/javascript' src='%s?v=%d'></script>\n", $config['url_path'] . $js_common, $js_common_ver);
	printf("<script type='text/javascript' src='%s?v=%d'></script>\n", $config['url_path'] . $js_type, $js_type_ver);
}

/**
 * Display routing protocol neighbors page
 * 
 * Renders the routing neighbors view showing OSPF, BGP, and IS-IS neighbor relationships.
 * 
 * @return void Outputs HTML placeholder content
 */
function display_routing_neighbors() {
	print '<div class="neighbor-banner">';
	print '<div class="neighbor-banner-title">' . __('Routing Neighbors', 'neighbor') . '</div>';
	print '<div class="neighbor-banner-controls">';
	print '<button type="button" class="neighbor-btn-primary" onclick="window.location.reload();">' . __('Refresh', 'neighbor') . '</button>';
	print '</div>';
	print '</div>';

	$rows = [];
	$has_link_table = db_fetch_cell("SHOW TABLES LIKE 'plugin_neighbor_link'");

	if ($has_link_table) {
		$rows = db_fetch_assoc("SELECT
				protocol,
				host_id,
				hostname,
				neighbor_host_id,
				neighbor_hostname,
				neighbor_interface_ip AS peer_ip,
				JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.peer_as')) AS peer_as,
				JSON_UNQUOTE(JSON_EXTRACT(metadata_json, '$.peer_state')) AS peer_state,
				last_seen
			FROM plugin_neighbor_link
			WHERE link_kind = 'logical'
			AND protocol IN ('bgp','ospf','isis')
			ORDER BY last_seen DESC, protocol, hostname, neighbor_hostname");
	} else {
		$has_routing_table = db_fetch_cell("SHOW TABLES LIKE 'plugin_neighbor_routing'");
		if ($has_routing_table) {
			$rows = db_fetch_assoc("SELECT
					type AS protocol,
					host_id,
					hostname,
					neighbor_host_id,
					neighbor_hostname,
					peer_ip,
					peer_as,
					peer_state,
					last_seen
				FROM plugin_neighbor_routing
				ORDER BY last_seen DESC, type, hostname, neighbor_hostname");
		}
	}

	html_start_box(__('Routing Protocol Neighbors', 'neighbor'), '100%', '', '3', 'center', '');

	$display_text = [
		['display' => __('Protocol', 'neighbor'), 'align' => 'left'],
		['display' => __('Host', 'neighbor'), 'align' => 'left'],
		['display' => __('Neighbor', 'neighbor'), 'align' => 'left'],
		['display' => __('Peer IP', 'neighbor'), 'align' => 'left'],
		['display' => __('Peer AS', 'neighbor'), 'align' => 'right'],
		['display' => __('State', 'neighbor'), 'align' => 'left'],
		['display' => __('Last Seen', 'neighbor'), 'align' => 'left'],
	];

	html_header($display_text, 2);

	if (is_array($rows) && cacti_sizeof($rows)) {
		foreach ($rows as $row) {
			form_alternate_row();
			print '<td>' . html_escape(strtoupper((string) $row['protocol'])) . '</td>';
			print '<td>' . html_escape($row['hostname']) . ' (' . (int) $row['host_id'] . ')</td>';
			print '<td>' . html_escape($row['neighbor_hostname']) . ' (' . (int) $row['neighbor_host_id'] . ')</td>';
			print '<td>' . html_escape($row['peer_ip']) . '</td>';
			print '<td class="right">' . html_escape((string) $row['peer_as']) . '</td>';
			print '<td>' . html_escape($row['peer_state']) . '</td>';
			print '<td>' . html_escape($row['last_seen']) . '</td>';
			form_end_row();
		}
	} else {
		print "<tr><td colspan='7'><em>" . __('No Routing Neighbors Found', 'neighbor') . '</em></td></tr>';
	}

	html_end_box(false);
}

// Summary Action

/**
 * Display neighbor discovery summary statistics
 * 
 * Shows aggregated counts of discovered neighbors by protocol type.
 * 
 * @return void Outputs HTML summary table
 */
function neighbor_summary() {
	// ================= input validation =================
	$filters = [
		'rows' => [
			'filter'  => FILTER_VALIDATE_INT,
			'default' => '-1'
		],
		'sort_column' => [
			'filter'  => FILTER_CALLBACK,
			'default' => 'method',
			'options' => ['options' => 'sanitize_search_string']
		],
		'sort_direction' => [
			'filter'  => FILTER_CALLBACK,
			'default' => 'ASC',
			'options' => ['options' => 'sanitize_search_string']
		]
	];
	validate_store_request_vars($filters, 'sess_neighbor');
	// ================= end input validation =================

	$total_rows       = 0;
	$xdpNeighborStats = getXdpNeighborStats($total_rows);

	// if the number of rows is -1, set it to the default
	if (get_request_var('rows') == -1) {
		$rows = read_config_option('num_rows_table');
	} else {
		$rows = get_request_var('rows');
	}

	html_start_box('Neighbor Summary', '50%', '', '4', 'left', '');

	$display_text = [
		'method'         => ['display' => __('Method', 'neighbor'),     	'sort' => '',	'align' => 'left'],
		'hosts'          => ['display' => __('Hosts', 'neighbor'),        	'sort' => '',  	'align' => 'center'],
		'interfaces'     => ['display' => __('Interfaces', 'neighbor'),    'sort' => '', 	'align' => 'center'],
		'last_polled'    => ['display' => __('Last Polled', 'neighbor'),   'sort' => '',  	'align' => 'center']];

	html_header_sort($display_text, get_request_var('sort_column'), get_request_var('sort_direction'), false, 'neighbor.php?action=summary');

	if ($xdpNeighborStats) {
		printf("<tr><td><a href='?action=xdp'>CPD/LLDP</a></td><td align='center'> %s </td><td align='center'> %s </td><td align='center'> %s </td>",$xdpNeighborStats['hosts'],$xdpNeighborStats['interfaces'],$xdpNeighborStats['last_polled']);
		form_end_row();
	}
	html_end_box();
}
