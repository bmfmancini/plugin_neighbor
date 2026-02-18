// Called by neighbor.php

var mapList = [];
var mapToolbar;
var selectBox;
var rule_id = 1;
var	user_id;

// Get the list of maps from AJAX
var ruleDropdown = function() {
	
	$.ajax({
		method: "GET",
		url: "ajax.php?action=ajax_map_list&format=jsonp",
		dataType: "jsonp",
		success: function( response ) {
			mapList = typeof(response.Response[0]) === 'undefined' ? [] : response.Response[0];
			selectBox.option('items',mapList);
		}
	});
}


$(document).ready(function() {

	rule_id = $("#rule_id").val();
	user_id = $("#user_id").val();

	var tabs = [
		{     
		    id: 0,
		    text: "Maps", 
		    icon: "globe", 
		    content: "neighbor_map"
		},
		{ 
		    id: 1,
		    text: "Interface Neighbors", 
		    icon: "fa fa-link", 
		    content: "neighbor_interface" 
		},
		{ 
		    id: 2,
		    text: "Routing Neighbors", 
		    icon: "fa fa-cloud", 
		    content: "neighbor_routing" 
		},
	];
	
	// Main dxTabs row
	
	var tabSelected = $("#tab_selected").length > 0 ? $("#tab_selected") : 0;
	
	// Tabs
	$("#neighbor_tabs").dxTabs({
		items: tabs,
		width: "99%",
		selectedIndex: tabSelected,
		onItemClick: function(e) {
			var redirectUrl = 'neighbor.php?action=' + e.itemData.content;
			window.location.href = redirectUrl;
		}
	});

	// Map Toolbar
	if ($("#neighbor_map_toolbar").length) {

		function buildToolbarDataSource() {
			return [
				{
					location: 'before',
					locateInMenu: 'auto',
					locateInMenu: 'never',
					template: function() {
						return $("<div class='toolbar-label' style='padding-left: 10px;'><b>Select a Map :</b></div>");
					},
				},
				{
					location: 'before',
					locateInMenu: 'auto',
					widget: 'dxSelectBox',
					options: {
						items: [],
						displayExpr: "name",
						valueExpr: "id",
						itemTemplate: function(data) {
							var icon = data.neighbor_type == 'interface' ? 'fa fa-link' : 'fa fa-cloud';
							return "<div class='custom-item'><span class='"+icon+"' style='padding-right: 5px'></span>"+ data.name +"</div>";
						},
						onValueChanged: function(e){
							rule_id = e.value;
							drawMap();
						},
						onInitialized: function(e) {
							selectBox = e.component;
						}
					}
				},
				{
					location: 'before',
					locateInMenu: 'auto',
					widget: 'dxSelectBox',
					options: {
						items: [],
						displayExpr: 'name',
						valueExpr: 'id',
						placeholder: 'Select host(s)...',
						searchEnabled: true,
						showSelectionControls: true,
						value: [],
						multiple: true,
						onInitialized: function(e) {
							var comp = e.component;
							$.ajax({
								method: 'GET',
								url: 'ajax.php?action=ajax_neighbor_hosts&format=jsonp',
								dataType: 'jsonp',
								success: function(resp) {
									var items = resp.Response?.[0] || [];
									comp.option('items', items);
								}
							});
						},
						onValueChanged: function(e) {
							// normalize value to an array (DevExpress may provide single value or array)
							var raw = e.value;
							var vals = Array.isArray(raw) ? raw : (raw == null ? [] : [raw]);
							mapOptions.selectedHosts = vals.map(function(v){
								if (v && typeof v === 'object') {
									return (v.id !== undefined) ? v.id : (v.value !== undefined ? v.value : null);
								}
								return v;
							}).filter(function(x){ return x !== null && x !== undefined && x !== ''; });
							mapOptions.ajax = true;
							drawMap();
						}
					}
				},
				{
					location: 'before',
					locateInMenu: 'auto',
					//locateInMenu: 'never',
					template: function() {
						return $("<div class='toolbar-label' style='padding-left: 10px;'><b>Last Seen :</b></div>");
					},
				},
				{
					location: 'before',
					locateInMenu: 'auto',
					widget: 'dxSlider',
					options: {
						min: 1,
						max: 14,
						value: 3,
						width: 100,
						rtlEnabled: false,
						tooltip: {
							enabled: true,
							format: function (value) {
								return value + " days";
							},
							position: "bottom"
						},
						onValueChanged: function(e) { updateLastSeen(e);},
					}
				},
				{
					locateInMenu: 'always',
					text: 'Save',
					onClick: function() {
						storeCoords();
					}
				},
				{
					locateInMenu: 'always',
					text: 'Reset',
					onClick: function() {
						 var result = DevExpress.ui.dialog.confirm("Are you sure?", "Reset map to default");
						result.done(function (dialogResult) {
						if (dialogResult) {
							resetMap();
						}
						else {
							DevExpress.ui.notify("Reset cancelled","warning",3000);
						}
						});
					}
				},
				{
					locateInMenu: 'always',
					text: 'Seed',
					onClick: function() {
						var seed = network.getSeed();
						DevExpress.ui.notify("Seed is: " + seed);
					}
				}
			];
		}

		mapToolbar = $("#neighbor_map_toolbar").dxToolbar({
			width: "99%",
			onInitialized: function() {
				ruleDropdown(user_id,rule_id);
			},
			dataSource: buildToolbarDataSource()
		}).dxToolbar("instance");
	}
});