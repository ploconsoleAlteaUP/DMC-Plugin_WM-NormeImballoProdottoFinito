sap.ui.define([
    'jquery.sap.global',
    "sap/dm/dme/podfoundation/controller/PluginViewController",
    "sap/ui/model/json/JSONModel"
], function (jQuery, PluginViewController, JSONModel) {
    "use strict";

    return PluginViewController.extend("altea.dmc.plugin.testPlugin.testPlugin.controller.MainView", {
        onInit: function () {
            PluginViewController.prototype.onInit.apply(this, arguments);

            console.log(`URL: ${this.getPublicApiRestDataSourceUri()}`);

        },


        onAfterRendering: function () {

            // assegno i valori passato dal componente (quello di configurazione)
            this.getView().byId("qtyPallet").setVisible(this.getConfiguration().addQtaPallet);
            this.getView().byId("qtyScatola").setVisible(this.getConfiguration().addQtaScatola);
            this.getView().byId("qtyPalletScatola").setVisible(this.getConfiguration().addQtaScatolaPerPallet);
            this.getView().byId("headerTitle").setText(this.getConfiguration().title);

            // creo il modello di appoggio per il plugin
            let jsonModelWM = new JSONModel({ pallet: 0, scatola: 0, palletscatola: 0, palletBusy: true, scatolaBusy: true, palletscatolaBusy: true });
            this.getView().setModel(jsonModelWM, "wmModel");

            // carico i dati del WM dopo il caricamento effettivo del plugin
            this.loadData();

        },

        loadData: function () {
            const that = this;
            const sMaterial = this.getPodSelectionModel().selectedOrderData.material.material;

            const sFilter = encodeURIComponent(
                `Material eq '${sMaterial}' and PackingInstructionItemIsDel eq false`
            );

            const sExpand = encodeURIComponent(
                "to_PackingInstructionHeader,to_PackingInstructionHeader/to_PackingInstructionComponent"
            );

            const sUrl = "/destination/S4H_ODATA_INTEGRATION/API_PACKINGINSTRUCTION/" +
                "PackingInstructionComponent?$filter=" + sFilter + "&$expand=" + sExpand;

            jQuery.ajax({
                url: sUrl,
                method: "GET",
                headers: {
                    "Accept": "application/json"
                },
                success: function (oData) {
                    if (!!!!oData && !!!!oData.d && !!!!oData.d.results) {
                        let sTarget = oData.d.results[0].PackingInstructionItmTargetQty;
                        let sUUID = oData.d.results[0].PackingInstructionItemSystUUID;

                        debugger;

                        that.getView().getModel("wmModel").setProperty("pallet", sTarget);
                        that.getView().getModel("wmModel").setProperty("palletBusy", false);

                        // /destination/S4H_ODATA_INTEGRATION/API_PACKINGINSTRUCTION/PackingInstructionComponent(guid'fa163e8d-ac08-1fe0-9a80-f43214372824')/to_PackingInstructionHeader
                    } else {
                        // nascondo i campi
                        that.getView().byId("wm").setVisible(false);

                        // formo i busy
                        that.getView().getModel("wmModel").setProperty("palletBusy", false);
                        that.getView().getModel("wmModel").setProperty("scatolaBusy", false);
                        that.getView().getModel("wmModel").setProperty("palletscatolaBusy", false);
                    }
                    console.log("API result:", oData);
                    sap.m.MessageToast.show("Dati caricati correttamente");
                }.bind(this),
                error: function (oError) {
                    that.getView().getModel("wmModel").setProperty("palletBusy", false);
                    that.getView().getModel("wmModel").setProperty("scatolaBusy", false);
                    that.getView().getModel("wmModel").setProperty("palletscatolaBusy", false);

                    sap.m.MessageBox.error("Error encountered while fetching data from 'Warehouse Management'");
                }.bind(this)
            });
        },

        onBeforeRenderingPlugin: function () {
            this.subscribe("UpdateAssemblyStatusEvent", this.handleAssemblyStatusEvent, this);
            this.subscribe("WorklistSelectEvent", this.handleWorklistSelectEvent, this);
            var oView = this.getView();
            if (!oView) {
                return;
            }
        },

        handleAssemblyStatusEvent: function (s, E, oData) {
            console.log("oData in handleAssemblyStatusEvent", oData);
            /*this.getView().byId("componentValue").setText(oData.scanInput);
            this.getView().byId("statusButton").setText(oData.status);
            this.getView().byId("statusButton").setType(oData.type);
            this.getView().byId("messageValue").setText(oData.message);*/
        },

        handleWorklistSelectEvent: function (s, E, oData) {
            if (this.isEventFiredByThisPlugin(oData)) {
                return;
            }
            sap.m.MessageBox.information("Number of SFC selected - " + oData.selections.length);
        },

        isSubscribingToNotifications: function () {

            var bNotificationsEnabled = true;

            return bNotificationsEnabled;
        },


        getCustomNotificationEvents: function (sTopic) {
            //return ["template"];
        },


        getNotificationMessageHandler: function (sTopic) {

            //if (sTopic === "template") {
            //    return this._handleNotificationMessage;
            //}
            return null;
        },

        _handleNotificationMessage: function (oMsg) {

            var sMessage = "Message not found in payload 'message' property";
            if (oMsg && oMsg.parameters && oMsg.parameters.length > 0) {
                for (var i = 0; i < oMsg.parameters.length; i++) {

                    switch (oMsg.parameters[i].name) {
                        case "template":

                            break;
                        case "template2":


                    }



                }
            }

        },


        onExit: function () {
            PluginViewController.prototype.onExit.apply(this, arguments);

            this.unsubscribe("UpdateAssemblyStatusEvent", {}, this);
            this.unsubscribe("WorklistSelectEvent", {}, this);
        }
    });
});