sap.ui.define([
    'jquery.sap.global',
    "sap/dm/dme/podfoundation/controller/PluginViewController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/m/MessageBox",
    "sap/m/Dialog",
    "../model/formatter",
    "sap/dm/dme/model/AjaxUtil",
    "../srv/Service"
], function (jQuery, PluginViewController, JSONModel, Fragment, MessageBox, Dialog, formatter, AjaxUtil, Service) {
    "use strict";

    let oController, EWMWarehouse;
    return PluginViewController.extend("altea.dmc.plugin.testPlugin.autocompleteConfirm.controller.MainView", {
        formatter: formatter,

        onInit: function () {
            PluginViewController.prototype.onInit.apply(this, arguments);

            //console.log(`URL: ${this.getPublicApiRestDataSourceUri()}`);
            oController = this;

            let jsonModel = new JSONModel({
                eseguiBtn: false
            });
            this.getView().setModel(jsonModel, "enableModel");

            let jsonModModel = new JSONModel({
            });
            this.getView().setModel(jsonModModel, "modModel");

            let jsonDaModModel = new JSONModel({
                daModificare: []
            });
            this.getView().setModel(jsonDaModModel, "toModModel");
        },

        onAfterRendering: function () {
            // assegno i valori passati dal componente (quello di configurazione)
            oController.getView().byId("headerTitle").setText(this.getConfiguration().title);
            EWMWarehouse = oController.getConfiguration().EWMWarehouse;

            // creo il modello di appoggio per il plugin
            let jsonModelWM = new JSONModel({ qtyTotale: 0, qtyDaModificare: 0, qtyModificata: 0, qtyTotaleBusy: false, qtyDaModificareBusy: false, qtyModificataBusy: false, lineItems: [] });
            oController.getView().setModel(jsonModelWM, "wmModel");

            //Inizializzo i SERVICE
            Service = new Service(EWMWarehouse);
        },

        onRefresh: async function () {
            oController._busyDialog ??= new sap.m.BusyDialog();
            oController._busyDialog.open();
            oController.getView().getModel("wmModel").setProperty("/qtyTotaleBusy", true);
            oController.getView().getModel("wmModel").setProperty("/qtyDaModificareBusy", true);
            oController.getView().getModel("wmModel").setProperty("/qtyModificataBusy", false);

            await Service.loadAllData(EWMWarehouse, function (oData) {
                if (oData.length > 0) {
                    var aManufactured = oData.filter(a => a.procurementType === "MANUFACTURED" && a.isAutocompleteAndConfirmed === true);
                    oController.getView().getModel("wmModel").setProperty("/qtyTotale", oData.length);
                    oController.getView().getModel("wmModel").setProperty("/qtyDaModificare", aManufactured.length);

                    oController.getView().getModel("toModModel").setProperty("/daModificare", aManufactured);
                }
                oController._busyDialog.close();
                oController.getView().getModel("wmModel").setProperty("/qtyTotaleBusy", false);
                oController.getView().getModel("wmModel").setProperty("/qtyDaModificareBusy", false);
                oController.getView().getModel("enableModel").setProperty("/eseguiBtn", true);
            }, this._busyDialog);
        },

        onEseguiAutocomplete: async function () {
            oController._busyDialog ??= new sap.m.BusyDialog();
            oController._busyDialog.open();

            oController.getView().getModel("wmModel").setProperty("/qtyModificataBusy", true);
            await Service.autocomplete(oController, function (isSuccess, oData) {

                if (isSuccess === "success") {
                    if (oData.length > 0) {
                        oController.getView().getModel("wmModel").setProperty("/lineItems", oData);
                        oController.getView().getModel("wmModel").setProperty("/qtyModificata", oData.length);
                    }
                } else {
                    sap.m.MessageBox.error("Si è scatenato un errore: \n" + oData);
                    console.error(oData);
                }
                oController._busyDialog.close();
                oController.getView().getModel("wmModel").setProperty("/qtyModificataBusy", false);
            }, this._busyDialog);
        },

        wait: async function (ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        onBeforeRenderingPlugin: function () {

            var oView = this.getView();
            if (!oView) {
                return;
            }
        },

        handleWorklistSelectEvent: function (s, E, oData) {
            this.loadData();

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
            this.unsubscribe("phaseStartEvent", this.handleRecordAndManualClosing, this);
            this.unsubscribe("phaseCompleteEvent", this.handleRecordAndManualClosing, this);
            this.unsubscribe("phaseHoldEvent", this.handleRecordAndManualClosing, this);
        },

        getGoodsReceiptData: function () {
            let oSelectedOrderData = oController.getPodSelectionModel().selectedOrderData;
            if (oSelectedOrderData) {
                oController.publish("goodsReceiptSummaryEvent", oSelectedOrderData);
            }
            oController.loadData();
        }
    });
});