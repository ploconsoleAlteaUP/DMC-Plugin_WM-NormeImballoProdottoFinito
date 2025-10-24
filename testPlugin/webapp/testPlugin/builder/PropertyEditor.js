sap.ui.define([
    "sap/ui/model/resource/ResourceModel",
    "sap/dm/dme/podfoundation/control/PropertyEditor"
], function (ResourceModel, PropertyEditor) {
    "use strict";
    
    var oFormContainer;

    return PropertyEditor.extend( "altea.dmc.plugin.testPlugin.testPlugin.builder.PropertyEditor" ,{

		constructor: function(sId, mSettings){
			PropertyEditor.apply(this, arguments);
			
			this.setI18nKeyPrefix("customComponentListConfig.");
			this.setResourceBundleName("altea.dmc.plugin.testPlugin.testPlugin.i18n.builder");
			this.setPluginResourceBundleName("altea.dmc.plugin.testPlugin.testPlugin.i18n.i18n");
		},
		
		addPropertyEditorContent: function(oPropertyFormContainer){
			var oData = this.getPropertyData();
									
			this.addInputField(oPropertyFormContainer, "title", oData);

			this.addSwitch(oPropertyFormContainer, "addQtaPallet", oData);
			this.addSwitch(oPropertyFormContainer, "addQtaScatola", oData);
			this.addSwitch(oPropertyFormContainer, "addQtaScatolaPerPallet", oData);
			this.addSwitch(oPropertyFormContainer, "postQtyConfirmation", oData);

            oFormContainer = oPropertyFormContainer;
		},
		
		getDefaultPropertyData: function(){
			return {
				
                "title": "Warehouse Management",
				"addQtaPallet": true,
				"addQtaScatola": true,
				"addQtaScatolaPerPallet": true,
                "postQtyConfirmation": true
			};
		}

	});
});