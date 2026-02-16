# GitHub Copilot Instructions

## Priority Guidelines

When generating code for this repository:

1. **Version Compatibility**: Always detect and respect the exact versions of PHP, JavaScript libraries, and Cacti framework used in this project
2. **Codebase Patterns**: Scan the codebase for established patterns before generating new code
3. **Architectural Consistency**: Maintain the plugin-based architecture and established integration patterns with Cacti
4. **Code Quality**: Prioritize maintainability, security, and consistency with existing code
5. **Database Operations**: Always use parameterized queries and follow existing database interaction patterns

## Technology Version Detection

Before generating code, adhere to these technology versions:

### PHP Environment
- **Target Cacti Version**: 1.1.4+ (as specified in INFO file)
- **PHP Version**: PHP 5.4+ minimum, but follow modern PHP 7.x patterns found in the codebase
- **Database**: MySQL/MariaDB with utf8mb4 charset
- **SNMP**: Native PHP SNMP functions for network device communication

### JavaScript Libraries
- **jQuery Versions Available**: 
  - jquery-1.12.3 (legacy support)
  - jquery-2.2.3 (IE9+ support)
  - jquery-3.1.0 (modern browsers)
- **DevExpress**: Full UI component library (dx.all.js)
- **Vis.js**: Network visualization (vis-network.min.js, vis-timeline-graph2d.min.js)
- **Moment.js**: Date/time manipulation (moment.min.js)
- **Globalize/CLDR**: Internationalization support

### Framework Integration
- **Cacti Plugin System**: Uses Cacti's plugin API hooks and architecture
- **Database Abstraction**: Uses Cacti's database wrapper functions
- **Authentication**: Integrates with Cacti's authentication system

## Project-Specific Architecture

### Plugin Structure
This is a Cacti plugin that follows specific architectural patterns:

#### File Organization
- **Root PHP files**: Main entry points and rule management (`neighbor.php`, `neighbor_rules.php`, etc.)
- **`setup.php`**: Plugin installation, hooks, and configuration
- **`lib/`**: Core functionality libraries
  - `neighbor_functions.php`: Display and data retrieval functions
  - `api_neighbor.php`: UI helper functions for rules
  - `neighbor_sql_tables.php`: Database schema and table management
  - `polling.php`: Poller integration and data processing
- **`js/`**: All JavaScript code and libraries
- **`cli/`**: Command-line utilities
- **`css/`**: Stylesheets
- **`fonts/`, `img/`**: Static assets

#### Plugin Hooks Pattern
All plugin hooks must follow this pattern:
```php
api_plugin_register_hook('neighbor', 'hook_name', 'callback_function', 'file.php');
```

Registered hooks in this plugin:
- `config_arrays`, `config_form`, `config_settings`
- `draw_navigation_text`, `top_header_tabs`, `top_graph_header_tabs`
- `poller_output`, `poller_bottom`
- `api_device_save`, `device_action_*`, `device_remove`

## Coding Standards

### PHP Coding Standards

#### Naming Conventions
- **Functions**: Use snake_case
  - Plugin hooks: `plugin_neighbor_*` prefix
  - Internal functions: `neighbor_*` prefix
  - Generic helpers: descriptive snake_case names
- **Variables**: Use snake_case (`$total_rows`, `$host_id`, `$sql_where`)
- **Constants**: Use UPPER_SNAKE_CASE
- **Database tables**: Prefix with `plugin_neighbor_`
- **Array keys**: Use snake_case

#### File Headers
Every PHP file must include the GPL v2 license header:
```php
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
```

#### Code Organization
- Use tabs or spaces consistently with the file (most files use tabs)
- Opening braces on same line for functions: `function name() {`
- Closing PHP tag (`?>`) typically omitted at end of PHP-only files
- Include statements at top of file after headers

#### Global Variable Access
Always declare globals explicitly when needed:
```php
global $config;
global $debug, $verbose;
```

Standard global variables:
- `$config`: Cacti configuration array
- `$config['base_path']`: Cacti installation directory
- `$config['library_path']`: Cacti library directory

### Database Interaction Patterns

#### Database Query Functions
Use Cacti's database wrapper functions exclusively:

**For SELECT queries returning multiple rows:**
```php
$results = db_fetch_assoc_prepared("SELECT * FROM table WHERE id = ?", array($id));
```

**For SELECT queries returning single value:**
```php
$count = db_fetch_cell_prepared("SELECT COUNT(*) FROM table WHERE status = ?", array($status));
```

**For INSERT/UPDATE/DELETE:**
```php
db_execute_prepared("UPDATE table SET field = ? WHERE id = ?", array($value, $id));
```

**Get affected rows after modification:**
```php
db_affected_rows();
```

**Get last insert ID:**
```php
db_fetch_insert_id();
```

#### SQL Security Requirements
- **NEVER** use string concatenation for SQL queries
- **ALWAYS** use prepared statements with parameter arrays
- **ALWAYS** use parameter placeholders (`?`) for user input
- Example of correct pattern:
```php
$conditions = array();
$params = array();
if ($host_id) {
    array_push($conditions, "`host_id` = ?");
    array_push($params, $host_id);
}
$where = count($conditions) ? "WHERE " . implode(" AND ", $conditions) : "";
$result = db_fetch_assoc_prepared("SELECT * FROM table $where", $params);
```

#### Table Naming
All tables use consistent prefixes:
- `plugin_neighbor_xdp`: CDP/LLDP neighbor data
- `plugin_neighbor_ipv4`: IPv4 routing neighbor data
- `plugin_neighbor_rules`: Neighbor rule definitions
- `plugin_neighbor_*_rule_items`: Rule item definitions
- Follow this pattern for any new tables

### JavaScript Coding Standards

#### jQuery Usage
- Use jQuery for DOM manipulation and AJAX
- Wrap code in `$(document).ready()` or equivalent
- Use `$.ajax()` for AJAX calls, not `$.get()` or `$.post()` directly

#### AJAX Patterns
All AJAX calls follow this pattern:
```javascript
$.ajax({
    method: "GET",  // or "POST"
    url: "ajax.php?action=ajax_action_name&format=jsonp",
    dataType: "jsonp",
    data: { param1: value1 },
    success: function(response) {
        // Handle response
    }
});
```

Server-side AJAX handlers return JSONP:
```php
function ajax_handler($format = 'jsonp', $ajax = true) {
    $format = $format ? $format : (isset_request_var('format') ? get_request_var('format') : '');
    $query_callback = get_request_var('callback', 'Callback');
    
    $results = array(/* data */);
    $json = json_encode($results);
    $jsonp = sprintf("%s({\"Response\":[%s]})", $query_callback, json_encode($results, JSON_PRETTY_PRINT));
    
    if ($ajax) {
        header('Content-Type: application/json');
        print $format == 'jsonp' ? $jsonp : $json;
    } else {
        return($json);
    }
}
```

#### DevExpress UI Components
- Use DevExpress components for rich UI elements (tabs, toolbars, grids)
- Initialize components on document ready
- Example pattern:
```javascript
$("#element_id").dxTabs({
    items: items_array,
    width: "99%",
    selectedIndex: initial_index,
    onItemClick: function(e) {
        // Handle click
    }
});
```

#### Vis.js Network Visualization
- Use vis.js for network topology maps
- Store network instance globally when needed for later manipulation
- Follow existing patterns in `js/map.js` for node/edge manipulation

### Error Handling and Logging

#### PHP Logging Patterns
Use `cacti_log()` for production logging:
```php
cacti_log('NEIGHBOR: ' . $message, TRUE, 'NEIGHBOR');
```

Use `error_log()` for debugging (should be removed or commented in production):
```php
error_log("Debug info: " . print_r($variable, 1));
```

#### JavaScript Console Logging
```javascript
console.log("Info message:", variable);
console.error("Error message:", error);
```

### Input Validation and Sanitization

#### Getting Request Variables
Always use Cacti's input validation functions:

```php
// Basic validation
get_request_var('var_name');

// With filter
get_filter_request_var('var_name', FILTER_VALIDATE_INT);

// With regex validation
get_filter_request_var('var_name', FILTER_VALIDATE_REGEXP, 
    array('options' => array('regexp' => '/^[a-zA-Z]+$/')));

// Check if variable is set
isset_request_var('var_name');

// Set default if not present
set_default_action('default_value');
load_current_session_value('var_name', 'session_var_name', 'default_value');
```

#### Common Validation Patterns
- **Integer IDs**: `get_filter_request_var('id', FILTER_VALIDATE_INT)`
- **Action strings**: `get_filter_request_var('action', FILTER_VALIDATE_REGEXP, array('options' => array('regexp' => '/^[a-z_]+$/')))`
- **Boolean flags**: Check with `isset_request_var()` or validate against expected values

### HTML Generation Patterns

#### Using Cacti HTML Functions
Use Cacti's HTML generation functions for consistency:

```php
// Start/end boxes
html_start_box($title, $width, $header, $colspan, $align, $add_text);
html_end_box($trailing_br);

// Headers
html_header($display_text, $sort_column, $sort_direction, $last_item_colspan);

// Alternating rows
form_alternate_row('row_id', true);
```

#### Navigation and Tabs
Follow the established pattern in `neighbor_tabs()`:
```php
function neighbor_tabs() {
    global $config;
    // Include required JS/CSS
    printf("<link href='%s' rel='stylesheet'>", "path/to/css");
    printf("<script type='text/javascript' src='%s'></script>", 'path/to/js');
    // Create tabs container
    print "<div id='neighbor_tabs'></div>";
}
```

### SNMP Operations

#### SNMP Query Pattern
Use custom SNMP wrapper functions or Cacti's native functions:

```php
// Walking an OID tree
$results = cacti_snmp_walk($hostname, $community, $oid, $version, 
    $username, $password, $auth_proto, $priv_pass, $priv_proto, 
    $context, $port, $timeout, $retries, $max_oids, $method);

// Getting single value
$value = cacti_snmp_get($hostname, $community, $oid, $version, 
    $username, $password, $auth_proto, $priv_pass, $priv_proto, 
    $context, $port, $timeout, $retries, $method);
```

#### SNMP OID Organization
Store OID definitions in associative arrays:
```php
$oidTable = array(
    'cdpMibWalk'        => array('1.3.6.1.4.1.9.9.23.1.2.1.1'),
    'cdpCacheIfIndex'   => '1.3.6.1.4.1.9.9.23.1.2.1.1.1',
    'cdpCacheDeviceId'  => '1.3.6.1.4.1.9.9.23.1.2.1.1.6',
    // ... more OIDs
);
```

### File Include Patterns

#### Include Order and Paths
Standard include pattern at file start:
```php
// For web-accessible files
chdir('../../');
include_once('./include/auth.php');
include_once($config['base_path'] . '/plugins/neighbor/lib/neighbor_functions.php');

// For CLI scripts
include_once(dirname(__FILE__) . '/../../include/global.php');
chdir('../../');
include_once('lib/snmp.php');
include_once('plugins/neighbor/lib/neighbor_functions.php');
```

### Command-Line Script Patterns

#### CLI Script Security
Always validate execution environment:
```php
if (!isset($_SERVER['argv'][0]) || isset($_SERVER['REQUEST_METHOD']) || isset($_SERVER['REMOTE_ADDR'])) {
    die('<br><strong>This script is only meant to run at the command line.</strong>');
}
```

#### CLI Argument Parsing
```php
$parms = $_SERVER['argv'];
array_shift($parms);  // Remove script name

// Parse arguments
foreach ($parms as $parameter) {
    if (strpos($parameter, '=')) {
        list($arg, $value) = explode('=', $parameter);
    } else {
        $arg = $parameter;
        $value = '';
    }
    
    switch ($arg) {
        case '--debug':
        case '-d':
            $debug = TRUE;
            break;
        // More cases...
    }
}
```

#### Signal Handling for Long-Running Processes
```php
declare(ticks = 1);

if (function_exists('pcntl_signal')) {
    pcntl_signal(SIGINT, "sigHandler");
    pcntl_signal(SIGTERM, "sigHandler");
}

function sigHandler($signo) {
    global $dieNow;
    $dieNow = $signo;
}
```

## Function Design Patterns

### Function Parameter Patterns

#### Reference Parameters for Output
Use reference parameters for returning count/total information:
```php
function getXdpNeighbors(&$total_rows = 0, $rowStart = 1, $rowEnd = 25, 
    $xdpType = '', $hostId = '', $filterVal = '', 
    $orderField = 'hostname', $orderDir = 'asc', 
    $cactiOnly = 'on', $output = 'array') {
    // ...
    $total_rows = db_fetch_cell_prepared("SELECT COUNT(*) ...", $params);
    // ...
}
```

#### Optional Parameters with Defaults
Provide sensible defaults for optional parameters:
```php
function ajax_map_list($format = 'jsonp', $ajax = true) {
    $format = $format ? $format : (isset_request_var('format') ? get_request_var('format') : '');
    // ...
}
```

### Return Value Patterns

#### Multiple Return Format Support
Support both array and JSON returns when appropriate:
```php
if ($output == 'array') {
    return($result);
} elseif ($output == 'json') {
    return(json_encode($result));
}
```

## Plugin-Specific Patterns

### Configuration Settings

#### Registering Settings
Add settings in `neighbor_config_settings()`:
```php
function neighbor_config_settings() {
    global $tabs, $settings;
    
    $tabs['neighbor'] = 'Neighbor';
    
    $settings['neighbor'] = array(
        'neighbor_header' => array(
            'friendly_name' => 'Neighbor Discovery Settings',
            'method' => 'spacer',
        ),
        'setting_name' => array(
            'friendly_name' => 'Setting Display Name',
            'description' => 'Setting description',
            'method' => 'checkbox',  // or 'textbox', 'dropdown', etc.
            'default' => 'on',
        ),
    );
}
```

### Device Actions

#### Adding Device Actions
Pattern for adding bulk device actions:
```php
function neighbor_device_action_array($device_action_array) {
    $device_action_array['plugin_neighbor_enable'] = 'Enable Neighbor Discovery';
    return $device_action_array;
}

function neighbor_device_action_execute($action) {
    if ($action == 'plugin_neighbor_enable') {
        // Execute action
        return true;  // Indicate action was handled
    }
    return $action;  // Pass through if not handled
}

function neighbor_device_action_prepare($save) {
    // Prepare/validate action
    return $save;
}
```

### Automated Rules System

#### Rule Definition Structure
Rules follow this database structure:
- `plugin_neighbor_rules`: Main rule definition
- `plugin_neighbor_*_rule_items`: Individual rule criteria
- Each rule has a `neighbor_type` (interface/routing)
- Rules use automation-style matching with operators

#### Rule Item Operators
Use these standard operators in rule items:
- Comparison: `=`, `!=`, `>`, `<`, `>=`, `<=`
- String matching: `LIKE`, `NOT LIKE`, `BEGINS WITH`, `ENDS WITH`, `CONTAINS`
- Special: `IS EMPTY`, `IS NOT EMPTY`, `MATCHES`, `DOES NOT MATCH` (regex)

### Polling and Data Collection

#### Poller Integration
Register poller hooks:
```php
api_plugin_register_hook('neighbor', 'poller_bottom', 'callback_function', 'file.php');
```

Follow the pattern in `poller_neighbor.php` for data collection:
1. Check if process should run based on frequency
2. Lock to prevent concurrent execution
3. Discover/collect data via SNMP
4. Update database tables
5. Clean up old data
6. Release lock

#### Data Hashing Pattern
Use MD5 hashes to detect changes:
```php
$neighbor_hash = md5($neighbor_hostname . $neighbor_interface);
$record_hash = md5(serialize($record_data));
```

## Data Visualization Patterns

### Map Generation
Maps use vis.js network library with these components:
- **Nodes**: Devices/hosts
- **Edges**: Connections between devices
- Store user positioning in `plugin_neighbor_user_map` table
- Support physics-based and manual layouts

### Table Display
Use DevExpress DataGrid for complex tables:
```javascript
$("#grid_container").dxDataGrid({
    dataSource: data,
    columns: columnDefs,
    paging: { pageSize: 25 },
    filterRow: { visible: true },
    // More options...
});
```

## Security Best Practices

### Authentication and Authorization
- Always include Cacti's auth system: `include_once('./include/auth.php');`
- For guest-accessible pages: `$guest_account = true;` before auth include
- Use realm registration for permission control:
```php
api_plugin_register_realm('neighbor', 'file.php', 'Description', 1);
```

### SQL Injection Prevention
- **NEVER** use direct variable substitution in SQL
- **ALWAYS** use prepared statements with parameter arrays
- Validate and sanitize all input before database operations

### XSS Prevention
- Use `htmlspecialchars()` or `html_escape()` for output
- Use `__esc()` for translatable strings that need escaping
- Cacti's form functions handle escaping automatically

### Input Validation
- Validate all `$_GET`, `$_POST`, `$_REQUEST` via Cacti's functions
- Never trust user input
- Validate data types, ranges, and formats

## Commenting and Documentation

### Inline Comments
- Use comments sparingly; prefer self-documenting code
- Comment complex logic, especially SNMP OID lookups and data transformations
- Use `//` for single-line comments
- Use `/* */` for multi-line comments

### Function Documentation
Minimal function documentation is used; function names should be descriptive:
```php
// Document complex functions with parameter descriptions
// args:
//   total_rows = pointer to cacti $total_rows for pagination
//   filterField = filter field (default = '')
//   filterVal = filter value (default = '')
function getXdpNeighbors(&$total_rows = 0, $filterField = '', ...) {
```

### Debug Comments
Debug code should use `error_log()` and can be commented out in production:
```php
// error_log("Debug: " . print_r($variable, 1));
```

## File Modification Guidelines

### Modifying Existing Files
1. Maintain existing code style and indentation
2. Preserve GPL license headers
3. Keep functions in logical groupings
4. Don't break existing function signatures
5. Update copyright year if making substantial changes

### Creating New Files
1. Always include GPL v2 license header
2. Include necessary dependencies at top
3. Follow existing file naming conventions
4. Place in appropriate directory based on purpose

## Database Schema Patterns

### Table Creation
Use this pattern for new tables:
```php
db_execute("CREATE TABLE IF NOT EXISTS `plugin_neighbor_tablename` (
    `id` int(11) NOT NULL AUTO_INCREMENT,
    `field1` varchar(64) NOT NULL,
    `field2` int(11) DEFAULT NULL,
    `created` datetime NOT NULL,
    `updated` datetime NOT NULL,
    PRIMARY KEY (`id`),
    KEY `field1` (`field1`),
    KEY `created` (`created`)
) DEFAULT CHARSET=utf8mb4");
```

### Common Field Patterns
- **ID fields**: `id int(11) NOT NULL AUTO_INCREMENT`
- **Host references**: `host_id int(11) NOT NULL`
- **SNMP IDs**: `snmp_id int(11) NOT NULL`
- **Hostnames**: `hostname varchar(64) NOT NULL`
- **IP addresses**: `ip_address varchar(45)` (supports IPv6)
- **Interface names**: `interface_name varchar(32)`
- **Descriptions/aliases**: `*_alias varchar(64)`
- **Timestamps**: `datetime NOT NULL` with meaningful names (`last_seen`, `created`, `updated`)
- **Hashes**: `char(32) NOT NULL` for MD5 hashes

## Testing and Debugging

### No Automated Testing
This project does not have automated tests. Testing is manual:
1. Install plugin in Cacti test environment
2. Verify plugin activation
3. Test data collection via poller
4. Verify UI functionality
5. Check logs for errors

### Debug Mode
Enable debug output through:
- Command-line flags (`--debug`, `-d`)
- Global debug variables
- `error_log()` statements (should be production-safe)
- Cacti's built-in debugging

### Logging for Troubleshooting
```php
cacti_log('NEIGHBOR: Processed ' . $count . ' hosts', TRUE, 'NEIGHBOR');
```

## Version Control

### Git Commit Messages
- Use descriptive commit messages
- Reference issue numbers when applicable
- Keep commits focused on single changes

## General Best Practices

1. **Consistency Over Convention**: When existing code does something in a particular way, follow that pattern even if other approaches exist
2. **Backward Compatibility**: Maintain compatibility with existing Cacti installations and database schemas
3. **Performance**: Consider query performance; use indexes on frequently queried fields
4. **Memory**: Be mindful of memory usage with large data sets
5. **Dependencies**: Minimize external dependencies; use Cacti's built-in functions when possible
6. **Error Handling**: Fail gracefully; log errors but don't crash
7. **Internationalization**: Use `__()` function for translatable strings: `__('String', 'neighbor')`
8. **Configuration**: Use Cacti's settings system rather than hardcoded values

## Common Pitfalls to Avoid

1. **Don't** use direct SQL queries without prepared statements
2. **Don't** trust user input without validation
3. **Don't** create PHP files without GPL headers
4. **Don't** use deprecated PHP or jQuery functions
5. **Don't** modify Cacti core files; use plugin hooks instead
6. **Don't** forget to update database schema version in upgrade functions
7. **Don't** leave debug `error_log()` statements that output sensitive data
8. **Don't** assume timezone; use datetime consistently
9. **Don't** hardcode paths; use `$config['base_path']` and relative paths
10. **Don't** break existing API contracts when modifying functions

## Plugin Lifecycle

### Installation
Handled in `plugin_neighbor_install()`:
- Register all hooks
- Register realms for permissions
- Create database tables
- Set initial configuration

### Uninstallation  
Handled in `plugin_neighbor_uninstall()`:
- Drop all database tables
- Clean up settings (handled by Cacti)

### Upgrades
Handled in `neighbor_check_upgrade()`:
- Check current version vs. installed version
- Apply schema changes incrementally
- Update version number

## Dependencies and Compatibility

### Cacti Framework
- Requires Cacti 1.1.4 or higher
- Uses Cacti's plugin architecture (PIA 3.0+)
- Integrates with Cacti's authentication and authorization
- Uses Cacti's database abstraction layer

### External Libraries (JavaScript)
All external libraries are vendored in the `js/` directory:
- DevExpress components for UI
- Vis.js for network diagrams
- Moment.js for date handling
- Multiple jQuery versions for compatibility

### PHP Extensions Required
- PDO/MySQLi (for database)
- SNMP extension (for device queries)
- PCNTL (optional, for signal handling in CLI)

## Internationalization

Use Cacti's translation system:
```php
// Simple string
__('String to translate', 'neighbor')

// String with escaping for HTML output  
__esc('String to translate', 'neighbor')

// Singular/plural
_n('Single item', 'Multiple items', $count, 'neighbor')
```

Translation domain is always `'neighbor'` for this plugin.

---

## Summary

This plugin extends Cacti's monitoring capabilities to discover and visualize network topology through neighbor relationships. When generating code:

1. **Always** follow existing patterns found in the codebase
2. **Always** use prepared statements for database queries
3. **Always** validate and sanitize user input
4. **Always** include proper GPL headers
5. **Never** hardcode values that should be configurable
6. **Never** trust user input
7. **Prefer** Cacti's built-in functions over custom implementations
8. **Maintain** consistency with existing code style and architecture

When in doubt, examine similar existing functionality in the codebase and replicate its patterns.
