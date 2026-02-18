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
				console.log(response);
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
	
		//	mapList = $.map(obj, function(value, index) { return [value]; });
		console.log("mapList:",mapList);
		console.log("Type of Response:",typeof(mapList));
				
		mapToolbar = $("#neighbor_map_toolbar").dxToolbar({
			width: "99%",
			onInitialized: function() {
				ruleDropdown(user_id,rule_id);
			},
			dataSource: [
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
							var value = e.value;
							console.log("Drawing graph with id:",value);
							rule_id = value;
							drawMap();
						},
						onInitialized: function(e) {                 
							selectBox = e.component; 				// Save the component to access later
						}
					}
				},
				{
					location: 'before',
					locateInMenu: 'auto',
					widget: 'dxTextBox',
					options: {
						placeholder: "Filter the hosts",
						onChange: function(e) { console.log("E is:",e); filterHosts(e);}
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
			]
				
		}).dxToolbar("instance");

	
	}
	
	
});
