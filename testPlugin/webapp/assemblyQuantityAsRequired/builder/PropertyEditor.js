sap.ui.define([
    "sap/ui/model/resource/ResourceModel",
    "sap/dm/dme/podfoundation/control/PropertyEditor"
], function (ResourceModel, PropertyEditor) {
    "use strict";
    
    var oFormContainer;

    return PropertyEditor.extend( "altea.dmc.plugin.testPlugin.assemblyQuantityAsRequired.builder.PropertyEditor" ,{

		constructor: function(sId, mSettings){
			PropertyEditor.apply(this, arguments);
			
			this.setI18nKeyPrefix("customComponentListConfig.");
			this.setResourceBundleName("altea.dmc.plugin.testPlugin.assemblyQuantityAsRequired.i18n.builder");
			this.setPluginResourceBundleName("altea.dmc.plugin.testPlugin.assemblyQuantityAsRequired.i18n.i18n");
		},
		
		addPropertyEditorContent: function(oPropertyFormContainer){
			var oData = this.getPropertyData();
									
			this.addInputField(oPropertyFormContainer, "title", oData);

			this.addInputField(oPropertyFormContainer, "EWMWarehouse", oData);

            oFormContainer = oPropertyFormContainer;
		},
		
		getDefaultPropertyData: function(){
			return {
				
                "title": "Autocomplete & Confirm",
				"EWMWarehouse": "PLE1",
			};
		}

	});
});