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

include_once(__DIR__ . '/neighbor_functions.php');

/**
 * Get the edge RRA
 *
 * @return array The edge RRA
 */
function get_edge_rra() {
	$rrd_array = [];
	$rows      = db_fetch_assoc('SELECT rrd_file from plugin_neighbor_edge');

	if (!is_array($rows)) {
		return $rrd_array;
	}

	foreach ($rows as $row) {
		$rrd = isset($row['rrd_file']) ? $row['rrd_file'] : '';

		if ($rrd) {
			$rrd_array[$rrd] = $row;
		}
	}

	return $rrd_array;
}

/**
 * Process the poller output
 *
 * @param  array $rrd_update_array The RRD update array
 * @return array The updated RRD update array
 */
function neighbor_poller_output(&$rrd_update_array) {
	global $config, $debug;

	$edge_rra = get_edge_rra();
	$path_rra = $config['rra_path'];

	foreach ($rrd_update_array as $rrd => $rec) {
		$rra_subst = str_replace($path_rra,'<path_rra>',$rrd);

		if (!isset($edge_rra[$rra_subst])) {
			continue;
		}

		foreach ($rec['times'] as $time => $data) {
			foreach ($data as $key => $counter) {
				db_execute_prepared("INSERT INTO plugin_neighbor_poller_output
				     VALUES ('', ?, ?, ?, ?, NOW())
				     ON DUPLICATE KEY UPDATE
				     key_name = ?,
				     value = ?",
					[$rra_subst, $time, $key, $counter, $key, $counter]);
			}
		}
	}

	return $rrd_update_array;
}

/**
 * Process the deltas from the poller_output hook
 * Called from poller_bottom hook
 */
function process_poller_deltas() {
	cacti_log('process_poller_deltas() is running', true, 'NEIGHBOR POLLER');

	db_execute_prepared('INSERT INTO plugin_neighbor_log (logtime, message)
		VALUES (NOW(), ?)',
		['process_poller_deltas() is starting.']);

	$poller_interval = (int)read_config_option('poller_interval');
	if ($poller_interval <= 0) {
		$poller_interval = 300;
	}

	$cutoff = time() - max(900, $poller_interval * 5);

	// Temporarily disabled for troubleshooting deletion-related instability.
	// db_execute_prepared('DELETE FROM plugin_neighbor_poller_output WHERE timestamp < ? LIMIT 10000', [$cutoff]);

	$rrdFiles = db_fetch_assoc_prepared(
		'SELECT DISTINCT rrd_file
		FROM plugin_neighbor_poller_output
		WHERE timestamp >= ?',
		[$cutoff]
	);

	if (!is_array($rrdFiles) || !cacti_sizeof($rrdFiles)) {
		return;
	}

	foreach ($rrdFiles as $rrdRec) {
		$rrdFile = isset($rrdRec['rrd_file']) ? $rrdRec['rrd_file'] : '';

		if ($rrdFile === '') {
			continue;
		}

		$timestamps = db_fetch_assoc_prepared(
			'SELECT DISTINCT timestamp
			FROM plugin_neighbor_poller_output
			WHERE rrd_file = ?
			ORDER BY timestamp DESC
			LIMIT 2',
			[$rrdFile]
		);

		if (!is_array($timestamps) || cacti_sizeof($timestamps) < 2) {
			continue;
		}

		$now    = (int)$timestamps[0]['timestamp'];
		$before = (int)$timestamps[1]['timestamp'];

		if ($before <= 0 || $now <= $before) {
			continue;
		}

		$timeDelta = $now - $before;

		// Normalise these down to a poller cycle boundary to group them together.
		$timestamp_cycle = (int)(intval($now / $poller_interval) * $poller_interval);

		cacti_log("process_poller_deltas(): now:$now, before:$before, rrd:$rrdFile", true, 'NEIGHBOR POLLER');

		$nowRows = db_fetch_assoc_prepared(
			'SELECT key_name, value
			FROM plugin_neighbor_poller_output
			WHERE rrd_file = ? AND timestamp = ?',
			[$rrdFile, $now]
		);

		$beforeRows = db_fetch_assoc_prepared(
			'SELECT key_name, value
			FROM plugin_neighbor_poller_output
			WHERE rrd_file = ? AND timestamp = ?',
			[$rrdFile, $before]
		);

		if (!is_array($nowRows) || !is_array($beforeRows) || !cacti_sizeof($nowRows) || !cacti_sizeof($beforeRows)) {
			continue;
		}

		$beforeByKey = [];
		foreach ($beforeRows as $row) {
			$key = isset($row['key_name']) ? $row['key_name'] : '';

			if ($key !== '') {
				$beforeByKey[$key] = isset($row['value']) ? (float)$row['value'] : 0.0;
			}
		}

		foreach ($nowRows as $row) {
			$key = isset($row['key_name']) ? $row['key_name'] : '';

			if ($key === '' || !isset($beforeByKey[$key])) {
				continue;
			}

			$nowValue = isset($row['value']) ? (float)$row['value'] : 0.0;
			$delta    = sprintf('%.2f', ($nowValue - $beforeByKey[$key]) / $timeDelta);

			cacti_log("process_poller_deltas(): RRD: $rrdFile, Key: $key, Delta: $delta", true, 'NEIGHBOR POLLER');

			db_execute_prepared('INSERT INTO plugin_neighbor_poller_delta
				VALUES (\'\',?,?,?,?,?)',
				[$rrdFile, $now, $timestamp_cycle, $key, $delta]);
		}
	}

	// Temporarily disabled for troubleshooting deletion-related instability.
	// db_execute_prepared('DELETE FROM plugin_neighbor_poller_delta WHERE timestamp < ? LIMIT 10000', [time() - 900]);
}

/**
 * Get the SNMP OID table for neighbor discovery protocols
 *
 * Returns an associative array of OID definitions for CDP, LLDP, and IP MIBs
 * used during neighbor discovery polling.
 *
 * @return array The OID table keyed by protocol field name
 */
function get_neighbor_oid_table() {
	return [
		// CISCO-CDP-MIB
		'cdpMibWalk'        => ['1.3.6.1.4.1.9.9.23.1.2.1.1'],
		'cdpCacheIfIndex'   => '1.3.6.1.4.1.9.9.23.1.2.1.1.1',
		'cdpCacheVersion'   => '1.3.6.1.4.1.9.9.23.1.2.1.1.5',
		'cdpCacheDeviceId'  => '1.3.6.1.4.1.9.9.23.1.2.1.1.6',
		'cdpCacheDevicePort'=> '1.3.6.1.4.1.9.9.23.1.2.1.1.7',
		'cdpCachePlatform'  => '1.3.6.1.4.1.9.9.23.1.2.1.1.8',
		'cdpCacheDuplex'    => '1.3.6.1.4.1.9.9.23.1.2.1.1.12',
		'cdpCacheUptime'    => '1.3.6.1.4.1.9.9.23.1.2.1.1.24',

		// LLDP-MIB
		'lldpMibWalk'       => ['1.0.8802.1.1.2.1.3.7.1.4', '1.0.8802.1.1.2.1.4.1', '.1.0.8802.1.1.2.1.4.2'],
		'lldpLocPortDesc'   => '1.0.8802.1.1.2.1.3.7.1.4',
		'lldpRemPortId'     => '1.0.8802.1.1.2.1.4.1.1.7',
		'lldpRemPortDesc'   => '1.0.8802.1.1.2.1.4.1.1.8',
		'lldpRemSysName'    => '1.0.8802.1.1.2.1.4.1.1.9',
		'lldpRemSysDesc'    => '1.0.8802.1.1.2.1.4.1.1.10',
		'lldpRemManAddrIfId'=> '1.0.8802.1.1.2.1.4.2.1.4',

		// IP-MIB
		'ipMibWalk' => ['1.3.6.1.2.1.4.20.1', '1.3.6.1.3.118.1.2.1'],
		'ipIpAddr'  => '1.3.6.1.2.1.4.20.1.2',
		'ifNetmask' => '1.3.6.1.2.1.4.20.1.3',
		'ciscoVrf'  => '1.3.6.1.3.118.1.2.1.1',
	];
}

/**
 * Map CDP duplex numeric value to string
 */
function map_duplex_value($val) {
	if ($val == 1) {
		return 'unknown';
	} elseif ($val == 2) {
		return 'half';
	} else {
		return 'full';
	}
}

/**
 * Compute a record hash from an array of values
 */
function compute_record_hash($arr) {
	return md5(serialize($arr));
}

/**
 * Compute neighbor hash from host and interface name pairs
 */
function compute_neigh_hash($myHostname, $neighHostname, $myIntName, $neighIntName) {
	$hostArray = [$myHostname, $neighHostname];
	sort($hostArray);
	$intArray = [$myIntName, $neighIntName];
	sort($intArray);
	return md5(serialize(array_merge($hostArray, $intArray)));
}

/**
 * Upsert a plugin_neighbor_xdp record using a prepared REPLACE
 * Expects $hashArray to be ordered to match the column list used below
 */
function upsert_xdp_record($hashArray, $neighUptime, $neighHash, $recordHash) {
	return db_execute_prepared('REPLACE INTO `plugin_neighbor_xdp`
				   (`host_id`, `type`,`host_ip`, `hostname`, `snmp_id`,
					`interface_name`, `interface_alias`, `interface_speed`, `interface_status`, `interface_ip`, `interface_hwaddr`,
					`neighbor_host_id`, `neighbor_hostname`, `neighbor_snmp_id`,
					`neighbor_interface_name`, `neighbor_interface_alias`, `neighbor_interface_speed`,
					`neighbor_interface_status`, `neighbor_interface_ip`, `neighbor_interface_hwaddr`,
					`neighbor_platform`, `neighbor_software`, `neighbor_duplex`,
					`neighbor_last_changed`, `last_seen`,`neighbor_hash`, `record_hash`)
			VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,DATE_SUB(NOW(),INTERVAL ? SECOND),NOW(),?,?)',
			array_merge($hashArray, [$neighUptime, $neighHash, $recordHash]));
}

/**
 * Prepare fields array into ordered hashArray and upsert record
 * Returns boolean result of DB upsert
 */
function prepare_and_upsert_xdp($fields) {
	$required = ['host_id','type','host_ip','hostname','snmp_id','interface_name','interface_alias','interface_speed','interface_status','interface_ip','interface_hwaddr','neighbor_host_id','neighbor_hostname','neighbor_snmp_id','neighbor_interface_name','neighbor_interface_alias','neighbor_interface_speed','neighbor_interface_status','neighbor_interface_ip','neighbor_interface_hwaddr','neighbor_platform','neighbor_software','neighbor_duplex','neighbor_last_changed_seconds'];

	foreach ($required as $r) {
		if (!array_key_exists($r, $fields)) {
			return false;
		}
	}

	$hashArray = [
		$fields['host_id'], $fields['type'], $fields['host_ip'], $fields['hostname'], $fields['snmp_id'],
		$fields['interface_name'], $fields['interface_alias'], $fields['interface_speed'], $fields['interface_status'], $fields['interface_ip'], $fields['interface_hwaddr'],
		$fields['neighbor_host_id'], $fields['neighbor_hostname'], $fields['neighbor_snmp_id'],
		$fields['neighbor_interface_name'], $fields['neighbor_interface_alias'], $fields['neighbor_interface_speed'],
		$fields['neighbor_interface_status'], $fields['neighbor_interface_ip'], $fields['neighbor_interface_hwaddr'],
		$fields['neighbor_platform'], $fields['neighbor_software'], $fields['neighbor_duplex']
	];

	$recordHash = compute_record_hash($hashArray);
	$neighHash  = compute_neigh_hash($fields['hostname'], $fields['neighbor_hostname'], $fields['interface_name'], $fields['neighbor_interface_name']);
	$neighUptime = (isset($fields['neighbor_last_changed_seconds']) && is_numeric($fields['neighbor_last_changed_seconds']))
		? max(0, (int)$fields['neighbor_last_changed_seconds'])
		: 0;

	return upsert_xdp_record($hashArray, $neighUptime, $neighHash, $recordHash);
}

/**
 * Perform SNMP walks for given OIDs and flatten results into a keyed array
 *
 * Walks multiple OID trees on a host and returns a single associative array
 * keyed by full OID with the corresponding SNMP value.
 *
 * @param  array $host     Host array from database with SNMP credentials
 * @param  array $walkOids Array of base OIDs to walk
 * @return array Associative array of OID => value pairs
 */
function neighbor_snmp_walk_and_flatten($host, $walkOids) {
	$results = [];

	foreach ($walkOids as $oid) {
		$walked = plugin_cacti_snmp_walk(
			$host['hostname'], $host['snmp_community'],
			$oid, $host['snmp_version'], $host['snmp_username'],
			$host['snmp_password'], $host['snmp_auth_protocol'],
			$host['snmp_priv_passphrase'], $host['snmp_priv_protocol'],
			$host['snmp_context'], $host['snmp_port'], $host['snmp_timeout'],
			read_config_option('snmp_retries'), $host['max_oids']
		);

		// plugin_cacti_snmp_walk() may return FALSE or non-array on error.
		if (!is_array($walked)) {
			continue;
		}

		foreach ($walked as $rec) {
			if (!is_array($rec)) {
				continue;
			}

			$oidKey = isset($rec['oid']) ? $rec['oid'] : '';
			$value  = isset($rec['value']) ? $rec['value'] : '';

			if ($oidKey !== '') {
				$results[$oidKey] = $value;
			}
		}
	}

	return $results;
}

/**
 * Constants for IP neighbor discovery
 */
define('NEIGHBOR_LOOPBACK_MASK', '255.255.255.255');
define('NEIGHBOR_DEFAULT_DEADTIMER', 60);
define('NEIGHBOR_DEFAULT_SUBNET_CORRELATION', 30);

/**
 * Discovers CDP neighbors for a given host
 *
 * Performs SNMP walk of Cisco Discovery Protocol MIB to identify directly
 * connected network devices and their interface relationships.
 *
 * @param  array $host Host array from database with SNMP credentials
 * @return int   Number of neighbors discovered and stored
 */
function discoverCdpNeighbors($host) {
	debug('Processing CDP Neighbors: ' . $host['description']);
	$oidTable   = get_neighbor_oid_table();
	$cdpTable   = neighbor_snmp_walk_and_flatten($host, $oidTable['cdpMibWalk']);
	$neighCount = 0;

	$cdpParsed               = [];
	$missingLocalInterfaces  = [];

	foreach ($cdpTable as $oid => $val) {
		if (preg_match('/' . $oidTable['cdpCacheDeviceId'] . '\.(\d+\.\d+)/',$oid,$matches)) {
			$index                       = isset($matches[1]) ? $matches[1] : '';
			$cdpParsed[$index]['device'] = $val;
		} elseif (preg_match('/' . $oidTable['cdpCacheDevicePort'] . '\.(\d+\.\d+)/',$oid,$matches)) {
			$index                          = isset($matches[1]) ? $matches[1] : '';
			$cdpParsed[$index]['interface'] = $val;
		} elseif (preg_match('/' . $oidTable['cdpCacheVersion'] . '\.(\d+\.\d+)/',$oid,$matches)) {
			$index                        = isset($matches[1]) ? $matches[1] : '';
			$cdpParsed[$index]['version'] = $val;
		} elseif (preg_match('/' . $oidTable['cdpCachePlatform'] . '\.(\d+\.\d+)/',$oid,$matches)) {
			$index                         = isset($matches[1]) ? $matches[1] : '';
			$cdpParsed[$index]['platform'] = $val;
		} elseif (preg_match('/' . $oidTable['cdpCacheDuplex'] . '\.(\d+\.\d+)/',$oid,$matches)) {
			$index = isset($matches[1]) ? $matches[1] : '';

			if ($val == 1) {
				$duplex = 'unknown';
			} elseif ($val == 2) {
				$duplex = 'half';
			} else {
				$duplex = 'full';
			}
			$cdpParsed[$index]['duplex'] = $duplex;
		} elseif (preg_match('/' . $oidTable['cdpCacheUptime'] . '\.(\d+\.\d+)/',$oid,$matches)) {
			$index                       = isset($matches[1]) ? $matches[1] : '';
			$uptime                      = is_numeric($val) ? intval($val / 1000) : 0;
			$cdpParsed[$index]['uptime'] = $uptime;
		}
	}

	foreach ($cdpParsed as $index => $record) {
		// Create a unique hash of the neighbor based on the record
		[$snmpId,$idx] = explode('.',$index);
		$myHostId      = $host['id'];
		$myIntRecord   = findCactiInterface($host['id'],'',$snmpId);

		if (!$myIntRecord) {
			if (!isset($missingLocalInterfaces[$snmpId])) {
				debug("Warning: Could not find Cacti interface record for host=$myHostId, snmp_index=$snmpId. Using fallback interface values.");
				$missingLocalInterfaces[$snmpId] = true;
			}

			$myIntRecord = [
				'ifDescr' => 'ifIndex:' . $snmpId,
				'ifAlias' => '',
				'ifHighSpeed' => '',
				'ifOperStatus' => '',
				'ifIP' => '',
				'ifHwAddr' => '',
			];
		}

		$myIp			  = isset($host['hostname']) ? $host['hostname'] : '';
		$myHostname		  = isset($host['description']) ? $host['description'] : '';
		$myIntName 		  = isset($myIntRecord['ifDescr']) ? $myIntRecord['ifDescr'] : '';
		$myIntAlias 	  = isset($myIntRecord['ifAlias']) ? $myIntRecord['ifAlias'] : '';
		$myIntSpeed 	  = isset($myIntRecord['ifHighSpeed']) ? $myIntRecord['ifHighSpeed'] : inferIntSpeed($myIntName);
		$myIntStatus 	 = isset($myIntRecord['ifOperStatus']) ? $myIntRecord['ifOperStatus'] : '';
		$myIntIp 		    = isset($myIntRecord['ifIP']) ? $myIntRecord['ifIP'] : '';
		$myIntHwAddr 	 = isset($myIntRecord['ifHwAddr']) ? $myIntRecord['ifHwAddr'] : '';

		$neighHostname 	  = preg_replace('/\..+/','',$record['device']);				// This is a nasty way of stripping a domain
		$neighPlatform 	  = $record['platform'];
		$neighSoftware 	  = $record['version'];
		$neighDuplex 	    = $record['duplex'];
		$neighUptime 	    = (isset($record['uptime']) && is_numeric($record['uptime'])) ? (int)$record['uptime'] : 0;
		$neighInterface 	 = $record['interface'];
		$neighRecord      = findCactiHost($neighHostname);
		$neighHostId      = isset($neighRecord[$neighHostname]['id']) ? $neighRecord[$neighHostname]['id'] : '';
		$neighIntRecord   = findCactiInterface($neighHostId,$neighInterface);

		if ($neighHostId && $neighIntRecord) {
			$neighSnmpId	      = isset($neighIntRecord['snmp_index']) ? $neighIntRecord['snmp_index'] : '';
			$neighIntName      = isset($neighIntRecord['ifDescr']) ? $neighIntRecord['ifDescr'] : '';
			$neighIntAlias     = isset($neighIntRecord['ifAlias']) ? $neighIntRecord['ifAlias'] : '';
			$neighIntSpeed     = isset($neighIntRecord['ifHighSpeed']) ? $neighIntRecord['ifHighSpeed'] : inferIntSpeed($neighIntName);
			$neighIntStatus    = isset($neighIntRecord['ifOperStatus']) ? $neighIntRecord['ifOperStatus'] : '';
			$neighIntIp        = isset($neighIntRecord['ifIP']) ? $neighIntRecord['ifIP'] : '';
			$neighIntHwAddr    = isset($neighIntRecord['ifHwAddr']) ? $neighIntRecord['ifHwAddr'] : '';
		} else {
			$neighSnmpId       = 0;
			$neighIntName      = $neighInterface;
			$neighIntAlias     = '';
			$neighIntSpeed     = inferIntSpeed($neighInterface);
			$neighIntStatus    = '';
			$neighIntIp        = '';
			$neighIntHwAddr    = '';
		}

		$hashArray = [	$host['id'], 'cdp', $myIp, $myHostname, $snmpId,
					$myIntName, $myIntAlias, $myIntSpeed, $myIntStatus, $myIntIp, $myIntHwAddr,
					$neighHostId, $neighHostname, $neighSnmpId,
					$neighIntName, $neighIntAlias, $neighIntSpeed, $neighIntStatus, $neighIntIp, $neighIntHwAddr,
					$neighPlatform, $neighSoftware, $neighDuplex];

		$hostArray = [$myHostname, $neighHostname];
		sort($hostArray);
		$intArray = [$myIntName, $neighIntName];
		sort($intArray);
		$neighArray = array_merge($hostArray,$intArray);		// Sort the values to  make them even for each neighbor pair

		$fields = [
			'host_id' => $host['id'],
			'type' => 'cdp',
			'host_ip' => $myIp,
			'hostname' => $myHostname,
			'snmp_id' => $snmpId,
			'interface_name' => $myIntName,
			'interface_alias' => $myIntAlias,
			'interface_speed' => $myIntSpeed,
			'interface_status' => $myIntStatus,
			'interface_ip' => $myIntIp,
			'interface_hwaddr' => $myIntHwAddr,
			'neighbor_host_id' => $neighHostId,
			'neighbor_hostname' => $neighHostname,
			'neighbor_snmp_id' => $neighSnmpId,
			'neighbor_interface_name' => $neighIntName,
			'neighbor_interface_alias' => $neighIntAlias,
			'neighbor_interface_speed' => $neighIntSpeed,
			'neighbor_interface_status' => $neighIntStatus,
			'neighbor_interface_ip' => $neighIntIp,
			'neighbor_interface_hwaddr' => $neighIntHwAddr,
			'neighbor_platform' => $neighPlatform,
			'neighbor_software' => $neighSoftware,
			'neighbor_duplex' => $neighDuplex,
			'neighbor_last_changed_seconds' => $neighUptime,
		];

		if (prepare_and_upsert_xdp($fields)) {
			$neighCount++;
		}
	}

	return ($neighCount);
}

/**
 * Discovers LLDP neighbors for a given host
 *
 * Performs SNMP walk of Link Layer Discovery Protocol MIB to identify
 * vendor-neutral neighbor relationships.
 *
 * @param  array $host Host array from database with SNMP credentials
 * @return int   Number of neighbors discovered and stored
 */
function discoverLldpNeighbors($host) {
	$oidTable = get_neighbor_oid_table();
	debug('Processing LLDP Neighbors: ' . $host['description']);
	$neighCount             = 0;
	$hostId                 = $host['id'];
	$lldpTable              = neighbor_snmp_walk_and_flatten($host, $oidTable['lldpMibWalk']);

	$lldpParsed = [];
	$lldpToSnmp = [];
	$missingLocalInterfaces = [];

	foreach ($lldpTable as $oid => $val) {
		if (preg_match('/' . $oidTable['lldpLocPortDesc'] . '\.(\d+)/',$oid,$matches)) {
			$index              = isset($matches[1]) ? $matches[1] : '';
			$intRec             = findCactiInterface($hostId,$val);
			$snmpIndex          = isset($intRec['snmp_index']) ? $intRec['snmp_index'] : $index;
			$lldpToSnmp[$index] = $snmpIndex;
		} elseif (preg_match('/' . $oidTable['lldpRemPortDesc'] . '\.\d+\.(\d+\.\d+)/',$oid,$matches)) {
			[$portIndex,$lldpIndex] = isset($matches[1]) ? explode('.',$matches[1]) : ['', ''];
			$snmpIndex              = isset($lldpToSnmp[$portIndex]) ? $lldpToSnmp[$portIndex] : '';
			// debug("lldpRemPort: portIndex: $portIndex, lldpIndex: $lldpIndex, snmpIndex: $snmpIndex\n");
			$lldpParsed["$snmpIndex.$lldpIndex"]['interface'] = $val;
			$lldpParsed["$snmpIndex.$lldpIndex"]['duplex']    = 'unknown';				// No duplex in the MIB
			$lldpParsed["$snmpIndex.$lldpIndex"]['uptime']    = 0;					// No timeticks in the MIB
		} elseif (preg_match('/' . $oidTable['lldpRemSysName'] . '\.\d+\.(\d+\.\d+)/',$oid,$matches)) {
			[$portIndex,$lldpIndex]                        = isset($matches[1]) ? explode('.',$matches[1]) : ['', ''];
			$snmpIndex                                     = isset($lldpToSnmp[$portIndex]) ? $lldpToSnmp[$portIndex] : '';
			$lldpParsed["$snmpIndex.$lldpIndex"]['device'] = $val;
		} elseif (preg_match('/' . $oidTable['lldpRemSysDesc'] . '\.\d+\.(\d+\.\d+)/',$oid,$matches)) {
			[$portIndex,$lldpIndex]                          = isset($matches[1]) ? explode('.',$matches[1]) : ['', ''];
			$snmpIndex                                       = isset($lldpToSnmp[$portIndex]) ? $lldpToSnmp[$portIndex] : '';
			$lldpParsed["$snmpIndex.$lldpIndex"]['version']  = $val;
			$lldpParsed["$snmpIndex.$lldpIndex"]['platform'] = (is_string($val) ? strtok($val, "\n") : '');			// The first line of lldpRemSysDesc is closest to platform inc CDP
		}
	}

	// Update the Database

	foreach ($lldpParsed as $index => $record) {
		// Create a unique hash of the neighbor based on the record
		[$snmpId,$idx] = explode('.',$index);
		$myHostId      = $host['id'];
		$myIntRecord   = findCactiInterface($host['id'],'',$snmpId);

		if (!$myIntRecord) {
			if (!isset($missingLocalInterfaces[$snmpId])) {
				debug("Warning: Could not find Cacti interface record for host=$myHostId, snmp_index=$snmpId. Using fallback interface values.");
				$missingLocalInterfaces[$snmpId] = true;
			}

			$myIntRecord = [
				'ifDescr' => 'ifIndex:' . $snmpId,
				'ifAlias' => '',
				'ifHighSpeed' => '',
				'ifOperStatus' => '',
				'ifIP' => '',
				'ifHwAddr' => '',
			];
		}

		$myIp         = isset($host['hostname']) ? $host['hostname'] : '';
		$myHostname   = isset($host['description']) ? $host['description'] : '';
		$myIntName    = isset($myIntRecord['ifDescr']) ? $myIntRecord['ifDescr'] : '';
		$myIntAlias   = isset($myIntRecord['ifAlias']) ? $myIntRecord['ifAlias'] : '';
		$myIntSpeed   = isset($myIntRecord['ifHighSpeed']) ? $myIntRecord['ifHighSpeed'] : inferIntSpeed($myIntName);
		$myIntStatus  = isset($myIntRecord['ifOperStatus']) ? $myIntRecord['ifOperStatus'] : '';
		$myIntIp      = isset($myIntRecord['ifIP']) ? $myIntRecord['ifIP'] : '';
		$myIntHwAddr  = isset($myIntRecord['ifHwAddr']) ? $myIntRecord['ifHwAddr'] : '';

		$neighHostname    = preg_replace('/\..+/','',$record['device']);
		$neighPlatform    = $record['platform'];
		$neighSoftware    = $record['version'];
		$neighDuplex      = $record['duplex'] ?? '';
		$neighUptime      = (isset($record['uptime']) && is_numeric($record['uptime'])) ? (int)$record['uptime'] : 0;
		$neighInterface   = $record['interface'] ?? '';
		$neighRecord      = findCactiHost($neighHostname);
		$neighHostId      = isset($neighRecord[$neighHostname]['id']) ? $neighRecord[$neighHostname]['id'] : '';
		$neighIntRecord   = findCactiInterface($neighHostId,$neighInterface);

		// If neighbor is in Cacti, use cached interface details; otherwise use LLDP-reported values
		if ($neighHostId && $neighIntRecord) {
			$neighSnmpId       = isset($neighIntRecord['snmp_index']) ? $neighIntRecord['snmp_index'] : '';
			$neighIntName      = isset($neighIntRecord['ifDescr']) ? $neighIntRecord['ifDescr'] : '';
			$neighIntAlias     = isset($neighIntRecord['ifAlias']) ? $neighIntRecord['ifAlias'] : '';
			$neighIntSpeed     = isset($neighIntRecord['ifHighSpeed']) ? $neighIntRecord['ifHighSpeed'] : inferIntSpeed($neighIntName);
			$neighIntStatus    = isset($neighIntRecord['ifOperStatus']) ? $neighIntRecord['ifOperStatus'] : '';
			$neighIntIp        = isset($neighIntRecord['ifIP']) ? $neighIntRecord['ifIP'] : '';
			$neighIntHwAddr    = isset($neighIntRecord['ifHwAddr']) ? $neighIntRecord['ifHwAddr'] : '';
		} else {
			// Neighbor not in Cacti - use LLDP-reported interface name directly
			$neighSnmpId       = 0;
			$neighIntName      = $neighInterface;  // Use the LLDP-reported remote port
			$neighIntAlias     = '';
			$neighIntSpeed     = inferIntSpeed($neighInterface);
			$neighIntStatus    = '';
			$neighIntIp        = '';
			$neighIntHwAddr    = '';
		}

		$hashArray = [	$host['id'], 'lldp', $myIp, $myHostname, $snmpId,
					$myIntName, $myIntAlias, $myIntSpeed, $myIntStatus, $myIntIp, $myIntHwAddr,
					$neighHostId, $neighSnmpId,
					$neighIntName, $neighIntAlias, $neighIntSpeed, $neighIntStatus, $neighIntIp, $neighIntHwAddr,
					$neighHostname, $neighPlatform, $neighSoftware, $neighDuplex];

		$hostArray = [$myHostname, $neighHostname];
		sort($hostArray);
		$intArray = [$myIntName, $neighIntName];
		sort($intArray);
		$neighArray = array_merge($hostArray,$intArray);		// Sort the values to  make them even for each neighbor pair

		$fields = [
			'host_id' => $host['id'],
			'type' => 'lldp',
			'host_ip' => $myIp,
			'hostname' => $myHostname,
			'snmp_id' => $snmpId,
			'interface_name' => $myIntName,
			'interface_alias' => $myIntAlias,
			'interface_speed' => $myIntSpeed,
			'interface_status' => $myIntStatus,
			'interface_ip' => $myIntIp,
			'interface_hwaddr' => $myIntHwAddr,
			'neighbor_host_id' => $neighHostId,
			'neighbor_hostname' => $neighHostname,
			'neighbor_snmp_id' => $neighSnmpId,
			'neighbor_interface_name' => $neighIntName,
			'neighbor_interface_alias' => $neighIntAlias,
			'neighbor_interface_speed' => $neighIntSpeed,
			'neighbor_interface_status' => $neighIntStatus,
			'neighbor_interface_ip' => $neighIntIp,
			'neighbor_interface_hwaddr' => $neighIntHwAddr,
			'neighbor_platform' => $neighPlatform,
			'neighbor_software' => $neighSoftware,
			'neighbor_duplex' => $neighDuplex,
			'neighbor_last_changed_seconds' => $neighUptime,
		];

		if (prepare_and_upsert_xdp($fields)) {
			$neighCount++;
		}
	}

	return ($neighCount);
}

/**
 * Fetch IPv4 cache entries for neighbor correlation
 *
 * Retrieves IP address and subnet information that was collected via SNMP
 * for use in finding IP-based neighbor relationships.
 *
 * @param  int|null $hostId  Optional host ID to filter results
 * @param  array    $vrfList Optional VRF list to filter results
 * @return array    Nested array indexed by [vrf][ip_address]
 */
function getIpv4Cache($hostId = null, $vrfList = []) {
	$params = [];
	$where  = [];

	if ($hostId !== null && $hostId !== '') {
		$where[]  = 'host_id = ?';
		$params[] = $hostId;
	}

	if (is_array($vrfList) && cacti_sizeof($vrfList)) {
		$vrfList = array_values(array_unique(array_map('strval', $vrfList)));

		if (cacti_sizeof($vrfList)) {
			$placeholders = implode(',', array_fill(0, cacti_sizeof($vrfList), '?'));
			$where[]      = 'vrf IN (' . $placeholders . ')';
			$params       = array_merge($params, $vrfList);
		}
	}

	$sql = 'SELECT * from plugin_neighbor_ipv4_cache';

	if (cacti_sizeof($where)) {
		$sql .= ' WHERE ' . implode(' AND ', $where);
	}

	$query = cacti_sizeof($params)
		? db_fetch_assoc_prepared($sql, $params)
		: db_fetch_assoc($sql);

	return db_fetch_hash($query, ['vrf', 'ip_address']);
}
