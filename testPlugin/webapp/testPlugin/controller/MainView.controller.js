sap.ui.define([
    'jquery.sap.global',
    "sap/dm/dme/podfoundation/controller/PluginViewController",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageBox"
], function (jQuery, PluginViewController, JSONModel, MessageBox) {
    "use strict";

    let oController;
    return PluginViewController.extend("altea.dmc.plugin.testPlugin.testPlugin.controller.MainView", {
        onInit: function () {
            PluginViewController.prototype.onInit.apply(this, arguments);

            console.log(`URL: ${this.getPublicApiRestDataSourceUri()}`);
            oController = this;
        },


        onAfterRendering: function () {

            // assegno i valori passati dal componente (quello di configurazione)
            this.getView().byId("qtyPallet").setVisible(this.getConfiguration().addQtaPallet);
            this.getView().byId("qtyScatola").setVisible(this.getConfiguration().addQtaScatola);
            this.getView().byId("qtyPalletScatola").setVisible(this.getConfiguration().addQtaScatolaPerPallet);
            this.getView().byId("headerTitle").setText(this.getConfiguration().title);

            // creo il modello di appoggio per il plugin
            let jsonModelWM = new JSONModel({ pallet: 0, scatola: 0, palletscatola: 0, palletBusy: true, scatolaBusy: true, palletscatolaBusy: true });
            this.getView().setModel(jsonModelWM, "wmModel");

            // carico i dati del WM dopo il caricamento effettivo del plugin
            this.loadData();

            // richiamo la function per intercettare il dialog GoodsReceipt
            this.interceptGoodsReceiptDialog();

        },

        interceptGoodsReceiptDialog: function () {
            const originalInit = sap.dm.dme.inventoryplugins.goodsReceiptPlugin.controller.PluginView.prototype.GRPostController.onInitGoodsReceiptDialog;

            sap.dm.dme.inventoryplugins.goodsReceiptPlugin.controller.PluginView.prototype.GRPostController.onInitGoodsReceiptDialog = function () {

                // prima
                console.log("Prima del GR init");

                // originale
                originalInit.apply(this, arguments);

                let oModel = sap.dm.dme.inventoryplugins.goodsReceiptPlugin.controller.PluginView.prototype.GRPostController.oController.getView().getModel("postModel");

                // dopo
                oModel.setProperty("/quantity/value", oController.getView().getModel("wmModel").getProperty("/pallet"));
            };
        },

        loadData: function () {
            const that = this;
            const sMaterial = this.getPodSelectionModel().selectedOrderData.material.material;

            //avvio i loader
            that.getView().getModel("wmModel").setProperty("/palletBusy", true);
            that.getView().getModel("wmModel").setProperty("/scatolaBusy", true);
            that.getView().getModel("wmModel").setProperty("/palletscatolaBusy", true);

            const sFilter = encodeURIComponent(
                `substringof('${sMaterial}',PackingInstructionNumber)`
            );

            const sExpand = encodeURIComponent(
                "to_PackingInstructionComponent"
            );

            const sUrl = "/destination/S4H_ODATA_INTEGRATION/API_PACKINGINSTRUCTION/" +
                "PackingInstructionHeader?$filter=" + sFilter + "&$expand=" + sExpand;

            jQuery.ajax({
                url: sUrl,
                method: "GET",
                headers: {
                    "Accept": "application/json"
                },
                success: function (oData) {
                    if (!!!!oData && !!!!oData.d && !!!!oData.d.results) {

                        const aData = oData.d.results;

                        //Ricerco se tra i risultati abbiamo un to_PackingInstructionComponent/PackingInstructionItemCategory uguale a I
                        const aPacking = aData.filter(a => a.to_PackingInstructionComponent.results.some(b => b.PackingInstructionItemCategory === "I"));

                        if (!!!!aPacking && aPacking.length > 0) {
                            // devo prendere il PackingInstructionItmTargetQty del to_PackingInstructionComponent/PackingInstructionItemCategory uguale a I
                            // e moltiplicarlo per il to_PackingInstructionComponent/PackingInstructionItemCategory diverso da I
                            let qtaPallet = 0, qtaScatola = 0, qtaScatolePallet = 0;
                            for (let item of aData) {
                                for (let component of item.to_PackingInstructionComponent.results) {

                                    if (component.PackingInstructionItemCategory === "I") {
                                        qtaScatolePallet = component.PackingInstructionItmTargetQty;
                                    } else if (component.Material === sMaterial) {
                                        qtaScatola = component.PackingInstructionItmTargetQty;
                                    }

                                }
                            }
                            qtaPallet = qtaScatola * qtaScatolePallet;

                            // assegno i valori ai rispettivi oggetti della view
                            that.getView().getModel("wmModel").setProperty("/pallet", qtaPallet);
                            that.getView().getModel("wmModel").setProperty("/scatola", qtaScatola);
                            that.getView().getModel("wmModel").setProperty("/palletscatola", qtaScatolePallet);

                            // fermo i busy
                            that.getView().getModel("wmModel").setProperty("/palletBusy", false);
                            that.getView().getModel("wmModel").setProperty("/scatolaBusy", false);
                            that.getView().getModel("wmModel").setProperty("/palletscatolaBusy", false);

                        } else {

                            for (let item of aData) {
                                for (let component of item.to_PackingInstructionComponent.results) {

                                    if (component.Material === sMaterial) {
                                        that.getView().getModel("wmModel").setProperty("/pallet", component.PackingInstructionItmTargetQty);
                                    }

                                }
                            }

                            // fermo i busy
                            that.getView().getModel("wmModel").setProperty("/palletBusy", false);
                            that.getView().getModel("wmModel").setProperty("/scatolaBusy", false);
                            that.getView().getModel("wmModel").setProperty("/palletscatolaBusy", false);
                        }

                    } else {
                        // nascondo i campi
                        that.getView().byId("wm").setVisible(false);

                        // fermo i busy
                        that.getView().getModel("wmModel").setProperty("/palletBusy", false);
                        that.getView().getModel("wmModel").setProperty("/scatolaBusy", false);
                        that.getView().getModel("wmModel").setProperty("/palletscatolaBusy", false);

                        // Creo il messaggio
                        MessageBox.error("There are no packaging standards");
                    }
                    console.log("API result:", oData);
                    //sap.m.MessageToast.show("Dati caricati correttamente");
                }.bind(this),
                error: function (oError) {
                    that.getView().getModel("wmModel").setProperty("/palletBusy", false);
                    that.getView().getModel("wmModel").setProperty("/scatolaBusy", false);
                    that.getView().getModel("wmModel").setProperty("/palletscatolaBusy", false);

                    sap.m.MessageBox.error("Error encountered while fetching data from 'Warehouse Management'");
                }.bind(this)
            });
        },

        onBeforeRenderingPlugin: function () {
            this.subscribe("UpdateAssemblyStatusEvent", this.handleAssemblyStatusEvent, this);
            this.subscribe("WorklistSelectEvent", this.handleWorklistSelectEvent, this);

            this.subscribe("goodsReceiptSummaryEvent", this._SummaryData, this);
            this.subscribe("orderSelectionEvent", this._SummaryData, this);

            var oView = this.getView();
            if (!oView) {
                return;
            }
        },

        _SummaryData: function (sChannelId, sEventId, oData) {
            this.loadData();
        },

        handleAssemblyStatusEvent: function (s, E, oData) {
            console.log("oData in handleAssemblyStatusEvent", oData);

            this.loadData();
            /*this.getView().byId("componentValue").setText(oData.scanInput);
            this.getView().byId("statusButton").setText(oData.status);
            this.getView().byId("statusButton").setType(oData.type);
            this.getView().byId("messageValue").setText(oData.message);*/
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
        }
    });
});