<?php

function neighbor_setup_table () {

	global $config, $database_default;
	include_once($config['library_path'] . '/database.php');

	// CDP and LLDP Neighbors table
	// Table: plugin_neighbor_xdp
    db_execute("
        CREATE TABLE IF NOT EXISTS `plugin_neighbor_xdp` (
            `id` int NOT NULL AUTO_INCREMENT,
            `type` enum('cdp','lldp') NOT NULL,
            `host_id` int NOT NULL,
            `host_ip` varchar(45) NOT NULL COMMENT 'Host IP address',
            `hostname` varchar(255) NOT NULL COMMENT 'Device Name from host',
            `snmp_id` int NOT NULL,
            `interface_name` varchar(128) NOT NULL,
            `interface_alias` varchar(255) DEFAULT NULL,
            `interface_speed` bigint DEFAULT NULL,
            `interface_status` varchar(32) DEFAULT NULL,
            `interface_ip` varchar(45) DEFAULT NULL,
            `interface_hwaddr` varchar(20) DEFAULT NULL,
            `neighbor_host_id` int NOT NULL,
            `neighbor_hostname` varchar(255) NOT NULL,
            `neighbor_snmp_id` int NOT NULL,
            `neighbor_interface_name` varchar(128) NOT NULL,
            `neighbor_interface_alias` varchar(255) DEFAULT NULL,
            `neighbor_interface_speed` bigint DEFAULT NULL,
            `neighbor_interface_status` varchar(32) DEFAULT NULL,
            `neighbor_interface_ip` varchar(45) DEFAULT NULL,
            `neighbor_interface_hwaddr` varchar(20) DEFAULT NULL,
            `neighbor_platform` varchar(255) NOT NULL,
            `neighbor_software` varchar(255) NOT NULL,
            `neighbor_duplex` enum('Full','Half') NOT NULL,    
            `neighbor_last_changed` datetime NOT NULL,
			`last_seen` datetime NOT NULL,
            `neighbor_hash` char(32) NOT NULL,
            `record_hash` char(32) NOT NULL,
        PRIMARY KEY (`id`),
        UNIQUE KEY `entry_hash` (`record_hash`),
            KEY `host_id` (`host_id`),
            KEY `type` (`type`),
            KEY `neighbor_host_id` (`neighbor_host_id`),
            KEY `snmp_id` (`snmp_id`),
            KEY `interface` (`interface_name`),
            KEY `neighbor_snmp_id` (`neighbor_snmp_id`),
            KEY `neighbor_interface` (`neighbor_interface_name`),
            KEY `neighbor_interface_2` (`neighbor_interface_name`),
            KEY `neighbor_hostname` (`neighbor_hostname`),
            KEY `neighbor_last_changed` (`neighbor_last_changed`),
			KEY `last_seen` (`last_seen`),
            KEY `neighbor_duplex` (`neighbor_duplex`),
            KEY `neighbor_hash` (`neighbor_hash`) USING BTREE
        ) AUTO_INCREMENT=45446 DEFAULT CHARSET=utf8mb4 
        ");

            // Table: plugin_neighbor_processes
            db_execute("CREATE TABLE IF NOT EXISTS `plugin_neighbor_processes` (
                `pid` int unsigned NOT NULL,
                `taskid` int unsigned NOT NULL,
                                                `host_id` int unsigned NOT NULL DEFAULT '0',
                `started` timestamp NOT NULL default CURRENT_TIMESTAMP,
                PRIMARY KEY  (`pid`))
                ENGINE=MEMORY
                COMMENT='Running collector processes';");

            // Legacy table alias for older plugin revisions
            db_execute("CREATE TABLE IF NOT EXISTS `plugin_neighbor_processes` (
                                                `pid` int unsigned NOT NULL,
                                                `taskid` int unsigned NOT NULL,
                                                `host_id` int unsigned NOT NULL DEFAULT '0',
                                                `started` timestamp NOT NULL default CURRENT_TIMESTAMP,
                                                PRIMARY KEY  (`pid`))
                                                ENGINE=MEMORY
                                                COMMENT='Running collector processes (legacy)';");

            // Table: plugin_neighbor_log
            db_execute("CREATE TABLE IF NOT EXISTS `plugin_neighbor_log` (
                                                `id` int NOT NULL AUTO_INCREMENT,
                                                `logtime` datetime NOT NULL,
                                                `message` mediumtext,
                                                PRIMARY KEY (`id`),
                                                KEY `logtime` (`logtime`)
                                          ) DEFAULT CHARSET=utf8mb4
            ");

            // Table: plugin_neighbor_edge
            db_execute("CREATE TABLE IF NOT EXISTS `plugin_neighbor_edge` (
                                                `id` int NOT NULL AUTO_INCREMENT,
                                                `rule_id` int NOT NULL,
                                                `from_id` int NOT NULL,
                                                `to_id` int NOT NULL,
                                                `rrd_file` varchar(255) NOT NULL,
                                                `edge_json` mediumtext,
                                                `edge_updated` datetime NOT NULL,
                                                PRIMARY KEY (`id`),
                                                UNIQUE KEY `rule_from_to_rrd` (`rule_id`,`from_id`,`to_id`,`rrd_file`),
                                                KEY `rule_id` (`rule_id`),
                                                KEY `rrd_file` (`rrd_file`),
                                                KEY `edge_updated` (`edge_updated`)
                                          ) DEFAULT CHARSET=utf8mb4
            ");

            // Table: plugin_neighbor_poller_output
            db_execute("CREATE TABLE IF NOT EXISTS `plugin_neighbor_poller_output` (
                                                `id` int NOT NULL AUTO_INCREMENT,
                                                `rrd_file` varchar(512) NOT NULL,
                                                `timestamp` int NOT NULL,
                                                `key_name` varchar(128) NOT NULL,
                                                `value` double DEFAULT NULL,
                                                `last_updated` datetime NOT NULL,
                                                PRIMARY KEY (`id`),
                                                UNIQUE KEY `rrd_ts_key` (`rrd_file`,`timestamp`,`key_name`),
                                                KEY `timestamp` (`timestamp`)
                                          ) DEFAULT CHARSET=utf8mb4
            ");

            // Table: plugin_neighbor_poller_delta
            db_execute("CREATE TABLE IF NOT EXISTS `plugin_neighbor_poller_delta` (
                                                `id` int NOT NULL AUTO_INCREMENT,
                                                `rrd_file` varchar(512) NOT NULL,
                                                `timestamp` int NOT NULL,
                                                `timestamp_cycle` int NOT NULL,
                                                `key_name` varchar(128) NOT NULL,
                                                `delta` double DEFAULT NULL,
                                                PRIMARY KEY (`id`),
                                                UNIQUE KEY `rrd_cycle_key` (`rrd_file`,`timestamp_cycle`,`key_name`),
                                                KEY `timestamp` (`timestamp`)
                                          ) DEFAULT CHARSET=utf8mb4
            ");

            // Table: plugin_neighbor_user_map
            db_execute("CREATE TABLE IF NOT EXISTS `plugin_neighbor_user_map` (
                                                `id` int NOT NULL AUTO_INCREMENT,
                                                `user_id` int NOT NULL,
                                                `rule_id` int NOT NULL,
                                                `item_id` varchar(128) NOT NULL,
                                                `item_x` double DEFAULT NULL,
                                                `item_y` double DEFAULT NULL,
                                                `item_mass` double DEFAULT NULL,
                                                `item_label` varchar(255) DEFAULT NULL,
                                                `random_seed` int DEFAULT '0',
                                                PRIMARY KEY (`id`),
                                                UNIQUE KEY `user_rule_item` (`user_id`,`rule_id`,`item_id`),
                                                KEY `rule_id` (`rule_id`)
                                          ) DEFAULT CHARSET=utf8mb4
            ");

    // Table: plugin_neighbor_ipv4_cache
    db_execute("CREATE TABLE IF NOT EXISTS `plugin_neighbor_ipv4_cache` (
                `id` int NOT NULL AUTO_INCREMENT,
                `host_id` int NOT NULL,
                `hostname` varchar(255) NOT NULL,
                `snmp_id` int NOT NULL,
                `ip_address` varchar(45) NOT NULL,
                `ip_netmask` varchar(45) NOT NULL,
                `vrf` varchar(255) NOT NULL,
                `last_seen` datetime NOT NULL COMMENT 'When did we last see this',
                PRIMARY KEY (`id`),
                UNIQUE KEY `host_id_2` (`host_id`,`ip_address`,`vrf`),
                KEY `snmp_id` (`snmp_id`),
                KEY `host_id` (`host_id`),
                KEY `ip_address` (`ip_address`),
                KEY `vrf` (`vrf`),
                KEY `last_seen` (`last_seen`)
              ) DEFAULT CHARSET=utf8mb4
    ");
    
    //Table: plugin_neighbor_ipv4
    db_execute("CREATE TABLE IF NOT EXISTS `plugin_neighbor_ipv4` (
                `id` int NOT NULL AUTO_INCREMENT,
                `vrf` varchar(255) NOT NULL,
                `host_id` int NOT NULL,
                `hostname` varchar(255) NOT NULL COMMENT 'Device Name from host',
                `snmp_id` int NOT NULL,
                `interface_name` varchar(128) NOT NULL,
                `interface_alias` varchar(255) DEFAULT NULL,
                `interface_ip` varchar(45) DEFAULT NULL,
                `interface_netmask` varchar(45) NOT NULL,
                `interface_hwaddr` varchar(20) DEFAULT NULL,
                `neighbor_host_id` int NOT NULL,
                `neighbor_hostname` varchar(255) NOT NULL,
                `neighbor_snmp_id` int NOT NULL,
                `neighbor_interface_name` varchar(128) NOT NULL,
                `neighbor_interface_alias` varchar(255) DEFAULT NULL,
                `neighbor_interface_ip` varchar(45) DEFAULT NULL,
                `neighbor_interface_netmask` varchar(45) NOT NULL,
                `neighbor_interface_hwaddr` varchar(20) DEFAULT NULL,
                `neighbor_hash` char(32) NOT NULL,
                `record_hash` char(32) NOT NULL,
                `last_seen` datetime NOT NULL,
               PRIMARY KEY (`id`),
               UNIQUE KEY `entry_hash` (`record_hash`),
               KEY `host_id` (`host_id`),
               KEY `neighbor_host_id` (`neighbor_host_id`),
               KEY `snmp_id` (`snmp_id`),
               KEY `interface` (`interface_name`),
               KEY `neighbor_snmp_id` (`neighbor_snmp_id`),
               KEY `neighbor_interface` (`neighbor_interface_name`),
               KEY `neighbor_interface_2` (`neighbor_interface_name`),
               KEY `neighbor_hostname` (`neighbor_hostname`),
               KEY `neighbor_hash` (`neighbor_hash`) USING BTREE,
               KEY `vrf` (`vrf`)
              ) DEFAULT CHARSET=utf8mb4
    ");

    	//Table: plugin_neighbor_graph_rules
    
      db_execute("CREATE TABLE IF NOT EXISTS `plugin_neighbor_graph_rules` (
		`id` mediumint UNSIGNED NOT NULL,
		`name` varchar(255) NOT NULL DEFAULT '',
		`snmp_query_id` smallint UNSIGNED NOT NULL DEFAULT '0',
		`graph_type_id` smallint UNSIGNED NOT NULL DEFAULT '0',
		`enabled` char(2) DEFAULT ''
	      ) DEFAULT CHARSET=utf8mb4 COMMENT='Automation Graph Rules';
	");
    
	//Table: plugin_neighbor_graph_rules

      db_execute("CREATE TABLE IF NOT EXISTS `plugin_neighbor_graph_rule_items` (
		`id` mediumint UNSIGNED NOT NULL,
		`rule_id` mediumint UNSIGNED NOT NULL DEFAULT '0',
		`sequence` smallint UNSIGNED NOT NULL DEFAULT '0',
		`operation` smallint UNSIGNED NOT NULL DEFAULT '0',
		`field` varchar(255) NOT NULL DEFAULT '',
		`operator` smallint UNSIGNED NOT NULL DEFAULT '0',
		`pattern` varchar(255) NOT NULL DEFAULT ''
	      )  COMMENT='Automation Graph Rule Items';
	");
    
	// Table: plugin_neighbor_match_rule_items
	
      db_execute("CREATE TABLE IF NOT EXISTS `plugin_neighbor_match_rule_items` (
		`id` mediumint UNSIGNED NOT NULL,
		`rule_id` mediumint UNSIGNED NOT NULL DEFAULT '0',
		`rule_type` smallint UNSIGNED NOT NULL DEFAULT '0',
		`sequence` smallint UNSIGNED NOT NULL DEFAULT '0',
		`operation` smallint UNSIGNED NOT NULL DEFAULT '0',
		`field` varchar(255) NOT NULL DEFAULT '',
		`operator` smallint UNSIGNED NOT NULL DEFAULT '0',
		`pattern` varchar(255) NOT NULL DEFAULT ''
	      )  COMMENT='Automation Match Rule Items';
	");
	

      // Table: plugin_neighbor_rules
	
      db_execute("CREATE TABLE IF NOT EXISTS `plugin_neighbor_rules` (
            `id` mediumint UNSIGNED NOT NULL,
            `name` varchar(255) NOT NULL DEFAULT '',
            `description` varchar(255) DEFAULT NULL,
            `neighbor_type` varchar(64) NOT NULL DEFAULT 'interface',
            `neighbor_options` varchar(255) DEFAULT '',
            `enabled` char(2) DEFAULT ''
            )  COMMENT='Automation Graph Rules';
      ");

                  // Table: plugin_neighbor_vrf_rules

                        db_execute("CREATE TABLE IF NOT EXISTS `plugin_neighbor_vrf_rules` (
            `id` mediumint UNSIGNED NOT NULL,
            `name` varchar(255) NOT NULL DEFAULT '',
            `description` varchar(255) DEFAULT NULL,
            `neighbor_type` varchar(64) NOT NULL DEFAULT 'interface',
            `neighbor_options` varchar(255) DEFAULT '',
            `vrf` varchar(255) NOT NULL DEFAULT '',
            `enabled` char(2) DEFAULT ''
            )  COMMENT='Automation VRF Rules';
      ");

                  // Table: plugin_neighbor_vrf_rule_items

                        db_execute("CREATE TABLE IF NOT EXISTS `plugin_neighbor_vrf_rule_items` (
            `id` mediumint UNSIGNED NOT NULL,
            `rule_id` mediumint UNSIGNED NOT NULL DEFAULT '0',
            `sequence` smallint UNSIGNED NOT NULL DEFAULT '0',
            `operation` smallint UNSIGNED NOT NULL DEFAULT '0',
            `field` varchar(255) NOT NULL DEFAULT '',
            `operator` smallint UNSIGNED NOT NULL DEFAULT '0',
            `pattern` varchar(255) NOT NULL DEFAULT ''
            )  COMMENT='Automation VRF Rule Items';
      ");

                  // Table: plugin_neighbor_vrf_match_rule_items

                        db_execute("CREATE TABLE IF NOT EXISTS `plugin_neighbor_vrf_match_rule_items` (
            `id` mediumint UNSIGNED NOT NULL,
            `rule_id` mediumint UNSIGNED NOT NULL DEFAULT '0',
            `rule_type` smallint UNSIGNED NOT NULL DEFAULT '0',
            `sequence` smallint UNSIGNED NOT NULL DEFAULT '0',
            `operation` smallint UNSIGNED NOT NULL DEFAULT '0',
            `field` varchar(255) NOT NULL DEFAULT '',
            `operator` smallint UNSIGNED NOT NULL DEFAULT '0',
            `pattern` varchar(255) NOT NULL DEFAULT ''
            )  COMMENT='Automation VRF Match Rule Items';
      ");
	
	// Table: plugin_neighbor_tree_rules
	
      db_execute("CREATE TABLE IF NOT EXISTS `plugin_neighbor_tree_rules` (
		`id` mediumint UNSIGNED NOT NULL,
		`name` varchar(255) NOT NULL DEFAULT '',
		`tree_id` smallint UNSIGNED NOT NULL DEFAULT '0',
		`tree_item_id` mediumint UNSIGNED NOT NULL DEFAULT '0',
		`leaf_type` smallint UNSIGNED NOT NULL DEFAULT '0',
		`host_grouping_type` smallint UNSIGNED NOT NULL DEFAULT '0',
		`enabled` char(2) DEFAULT ''
	      )  COMMENT='Automation Tree Rules';
	");
	
	// Table: plugin_neighbor_tree_rule_items
	
      db_execute("CREATE TABLE IF NOT EXISTS `plugin_neighbor_tree_rule_items` (
		`id` mediumint UNSIGNED NOT NULL,
		`rule_id` mediumint UNSIGNED NOT NULL DEFAULT '0',
		`sequence` smallint UNSIGNED NOT NULL DEFAULT '0',
		`field` varchar(255) NOT NULL DEFAULT '',
		`sort_type` smallint UNSIGNED NOT NULL DEFAULT '0',
		`propagate_changes` char(2) DEFAULT '',
		`search_pattern` varchar(255) NOT NULL DEFAULT '',
		`replace_pattern` varchar(255) NOT NULL DEFAULT ''
	      )  COMMENT='Automation Tree Rule Items';
	");
	
      api_plugin_db_add_column('neighbor', 'plugin_neighbor_rules', array('name' => 'neighbor_type', 'type' => 'varchar(64)', 'NULL' => false, 'default' => 'interface', 'after' => 'description'));
      api_plugin_db_add_column('neighbor', 'plugin_neighbor_rules', array('name' => 'neighbor_options', 'type' => 'varchar(255)', 'NULL' => true, 'default' => '', 'after' => 'neighbor_type'));

      /*
       * Older Cacti installs can have host table row-size limits; avoid hard-failing
       * plugin install/upgrade by not auto-altering host with many additional columns.
       */
      
      // Do not auto-alter the core host table during install/upgrade.
      // Large/extended Cacti installs can exceed InnoDB row-size limits.
      // To force legacy behavior manually, call add_fields_host() from a controlled migration step.

}

function add_fields_host() {

      if (!neighbor_allow_host_table_alter()) {
            neighbor_log_host_column_add_failure('all', "NEIGHBOR: Skipping automatic host table ALTERs to avoid row-size failures. Define NEIGHBOR_ALLOW_HOST_TABLE_ALTER=true to force adding host columns.");
            return;
      }

	$fields = array(
                        'neighbor_discover_enable',
                        'neighbor_discover_cdp',
                        'neighbor_discover_lldp',
                        'neighbor_discover_ip',
                        'neighbor_discover_switching',
                        'neighbor_discover_ifalias',
                        'neighbor_discover_ospf',
                        'neighbor_discover_bgp',
                        'neighbor_discover_isis',
       );

      $last = 'disabled';
      foreach ($fields as $field) {
            if (neighbor_host_column_exists($field)) {
                  $last = $field;
                  continue;
            }

            $params = array(
                  'name'    => $field,
                  'type'    => 'char(3)',
                  'NULL'    => false,
                  'default' => 'on'
            );

            if ($last !== '' && neighbor_host_column_exists($last)) {
                  $params['after'] = $last;
            }

            api_plugin_db_add_column('neighbor', 'host', $params);

            if (neighbor_host_column_exists($field)) {
                  $last = $field;
            } else {
                  neighbor_log_host_column_add_failure($field);
                  break;
            }
      }
}

function neighbor_allow_host_table_alter() {
      return defined('NEIGHBOR_ALLOW_HOST_TABLE_ALTER') && NEIGHBOR_ALLOW_HOST_TABLE_ALTER === true;
}

function neighbor_host_column_exists($column_name) {
      return (bool) db_fetch_cell_prepared('SHOW COLUMNS FROM host LIKE ?', array($column_name));
}

function neighbor_log_host_column_add_failure($column_name, $custom_message = '') {
      $message = $custom_message !== ''
            ? $custom_message
            : "NEIGHBOR: Unable to add host column '$column_name'. Skipping remaining host column adds (likely host row size limit).";

      if (function_exists('cacti_log')) {
            cacti_log($message, true, 'NEIGHBOR');
      } else {
            error_log($message);
      }
}





?>
