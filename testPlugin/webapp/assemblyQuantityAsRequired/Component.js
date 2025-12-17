sap.ui.define([
	"sap/dm/dme/podfoundation/component/production/ProductionUIComponent",
	"sap/ui/Device"
], function (ProductionUIComponent, Device) {
	"use strict";

	return ProductionUIComponent.extend("altea.dmc.plugin.testPlugin.assemblyQuantityAsRequired.Component", {
		metadata: {
			manifest: "json"
		}
	});
});