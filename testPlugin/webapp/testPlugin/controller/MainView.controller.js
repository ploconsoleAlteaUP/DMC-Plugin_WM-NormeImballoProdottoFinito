sap.ui.define([
    'jquery.sap.global',
    "sap/dm/dme/podfoundation/controller/PluginViewController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/m/MessageBox",
    "altea/dmc/plugin/testPlugin/testPlugin/model/formatter",
    "sap/dm/dme/model/AjaxUtil"
], function (jQuery, PluginViewController, JSONModel, Fragment, MessageBox, formatter, AjaxUtil) {
    "use strict";

    let oController;
    return PluginViewController.extend("altea.dmc.plugin.testPlugin.testPlugin.controller.MainView", {
        formatter: formatter,

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
            let jsonModelWM = new JSONModel({ pallet: 0, scatola: 0, palletscatola: 0, palletBusy: true, scatolaBusy: true, palletscatolaBusy: true, lineItems: [] });
            this.getView().setModel(jsonModelWM, "wmModel");

            // carico i dati del WM dopo il caricamento effettivo del plugin
            this.loadData();

            // richiamo la function per intercettare il dialog GoodsReceipt
            this.interceptGoodsReceiptDialog();
        },

        // TODO: TO REMOVE?
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
                                        that.getView().getModel("wmModel").setProperty("/scatola", 0);
                                        that.getView().getModel("wmModel").setProperty("/palletscatola", 0);
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

            // set table data
            const orderData = this.getPodSelectionModel().selectedOrderData;
            var items = [{
                material: orderData.material.material,
                description: orderData.material.description,
                postedQuantityDisplay: Number(orderData.completedQty) + ' of ' + Number(orderData.plannedQty) + ' ' + orderData.baseCommercialUom,
                postedQuantityPercent: Number(orderData.completedQty)
            }];
            that.getView().getModel("wmModel").setProperty("/lineItems", items);

            // get storage location
            this.getPutawayStorageLocation();
        },

        // TO FIX
        getPutawayStorageLocation: async function () {
            const sBaseUrl = this.getView().getController().getDemandRestDataSourceUri(),
                sPlant = (sap.dm.dme.util.PlantSettings).getCurrentPlant(),
                sOrder = this.getPodSelectionModel().selectedOrderData.order,
                sUrl = `${sBaseUrl}shopOrders/search/findByPlantAndShopOrder?plant=${sPlant}&shopOrder=${sOrder}`;
            /*const podSelectionModel = this.getPodSelectionModel();
            const orderData = podSelectionModel.selectedOrderData;
            const order = orderData.order;
            const plant = podSelectionModel.selectedPhaseData.resource.plant;

            // get putawayStorageLocation from https://api.sap.com/api/sapdme_order/path/get_v1_orders
            const sUrl = "/destination/SAP_DMC_DEFAULT_SERVICE_KEY/order/v1/orders" + 
                "?plant=" + encodeURIComponent(plant) +
                "&order=" + encodeURIComponent(order);*/

            const oData = await new Promise((resolve, reject) => {
                jQuery.ajax({
                    url: sUrl,
                    method: "GET",
                    headers: {
                        "Accept": "application/json"
                    },
                    success: function (oData) {
                        if (oData && oData.erpPutawayStorageLocation) {
                            console.log("Goods Receipt Summary data:", oData);

                            let wmModel = oController.getView().getModel("wmModel");

                            let lineItems = wmModel.getProperty("/lineItems") || [];
                            lineItems[0].storageLocation = oData.erpPutawayStorageLocation;
                            wmModel.setProperty("/lineItems", lineItems);
                        }

                        resolve(oData);
                    },
                    error: function (err) {
                        console.error("Errore nel recupero dati GR summary:", err);
                        // sap.m.MessageBox.error("Errore nel recupero dati Goods Receipt");
                        reject([]);
                    }
                });
            });

            return oData;

        },

        // show history table from fragment 
        onShowPostings: function () {
            debugger;
            const that = this;

            // Se il dialog non è ancora stato creato, lo carico
            if (!this._oPostingsDialog) {
                Fragment.load({
                    name: "altea.dmc.plugin.testPlugin.testPlugin.view.fragments.PostingHistoryDialog",
                    controller: this
                }).then(function (oDialog) {
                    that._oPostingsDialog = oDialog;
                    that.getView().addDependent(oDialog);
                    oDialog.open();

                    // Mostro subito il dialog e poi carico i dati
                    that.loadPostingHistory();
                });
            } else {
                this._oPostingsDialog.open();

                // Se già esiste, resetto e ricarico ogni volta che lo apro
                const oWMModel = this.getView().getModel("wmModel");
                oWMModel.setProperty("/postingsHistory", []); // reset
                this.loadPostingHistory();
            }
        },

        // TO FIX
        // get history data from https://api.sap.com/api/sapdme_quantityConfirmation/path/get_quantityConfirmation_v1_postingHistory
        loadPostingHistory: async function () {

            const oData = await oController.getPutawayStorageLocation();

            let inventoryUrl = oController.getInventoryDataSourceUri();
            let oParameters = {};
            debugger;
            oParameters.shopOrder = oData.shopOrder;
            oParameters.batchId = oController.getPodSelectionModel().selectedOrderData.sfc;
            oParameters.material = oData.material.ref;//this.getPodSelectionModel().selectedOrderData.material.material;
            oParameters.dontShowPrint = false;

            //TODO: Gestione il paging come da standard (fare debug dello standard)
            oParameters.page = 0;
            oParameters.size = 20;
            oParameters.bomComponentSequence = '';
            let sUrl = inventoryUrl + "ui/order/goodsReceipt/details";

            //let sUrl = `${inventoryUrl}ui/order/goodsReceipt/details?shopOrder=${oData.shopOrder}&batchId=${oController.getPodSelectionModel().selectedOrderData.sfc}&material=${oData.material.ref}&dontShowPrint=false&page=0&size=20&bomComponentSequence=`

            //let sUrl2 = `${inventoryUrl}ui/order/goodsReceipt/details?shopOrder=${oData.shopOrder}&batchId=${encodeURIComponent(oController.getPodSelectionModel().selectedOrderData.sfc)}&material=${oData.material.ref}&dontShowPrint=false&page=0&size=20&bomComponentSequence=`

            /*const that = this;
            const oWMModel = that.getView().getModel("wmModel");
            oWMModel.setProperty("/busyPostings", true); // per eventuale spinner in tabella

            const podSelectionModel = that.getPodSelectionModel();
            const order = podSelectionModel?.selectedOrderData?.order;
            const plant = podSelectionModel?.selectedPhaseData?.resource?.plant;

            if (!order || !plant) {
                sap.m.MessageBox.warning("Order o Plant non disponibili");
                oWMModel.setProperty("/busyPostings", false);
                return;
            }

            const sUrl = "/destination/SAP_DMC_DEFAULT_SERVICE_KEY/quantityConfirmation/v1/postingHistory" +
                "?plant=" + encodeURIComponent(plant) +
                "&order=" + encodeURIComponent(order);*/
            debugger;
            jQuery.ajax({
                url: sUrl,
                method: "GET",
                headers: {
                    "Accept": "application/json"
                },
                //data: oParameters,
                success: function (oData) {
                    debugger;
                    const aResults = Array.isArray(oData?.content) ? oData.content : [];

                    // date format
                    const oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
                        style: "medium",
                        UTC: true
                    });
                    const aFormatted = aResults.map(item => ({
                        ...item,
                        postingDateTimeDisplay: item.postingDateTime
                            ? oDateFormat.format(new Date(item.postingDateTime))
                            : "",
                        createdDateTimeDisplay: item.createdDateTime
                            ? oDateFormat.format(new Date(item.createdDateTime))
                            : ""
                    }));

                    oWMModel.setProperty("/postingsHistory", aFormatted);
                    oWMModel.setProperty("/busyPostings", false);
                },
                error: function (err) {
                    console.error("Errore nel recupero posting history:", err);
                    oWMModel.setProperty("/busyPostings", false);
                    // sap.m.MessageBox.error("Errore nel recupero dati di posting");
                }
            });

            AjaxUtil.get(sUrl, oParameters, function (oResponseData) {
                debugger;
                //TODO gestire qui dentro la risposta
                
                /*that.postingsList = oResponseData;
                that.postingsList.dontShowPrint = oParameters.dontShowPrint;
                let oTableModel = mainController.byId("postingsTable").getModel("postingsModel");
                if (!oTableModel) {
                    oTableModel = new JSONModel();
                }
                if (that.oPageable.page === 0) {
                    that._buidPostingCustomFieldColumns(oResponseData.details.content);
                    mainController.byId("postingsTable").setModel(that._updateGRPostingTableModel(oTableModel, that.postingsList), "postingsModel");
                } else {
                    that._updateGRPostingTableModel(oTableModel, that.postingsList);
                }
                that._updateGRPostingsTableGrowing(oTableModel.totalPages);
                that.oPostingsModel = new JSONModel();
                that.oPostingsModel.setSizeLimit(that.postingsList.details.length);
                that.oPostingsModel.setData(mainController.byId("postingsTable").getModel("postingsModel").getData());
                mainController.byId("postingsTable").setBusy(false);*/
            }, function (oError, sHttpErrorMessage) {
                /*let err = oError ? oError.error.message : sHttpErrorMessage;
                mainController.showErrorMessage(err, true, true);
                that.postingsList = {};
                mainController.byId("postingsTable").setBusy(false);*/
            });
        },

        onCloseDialog: function (evt) {
            evt.getSource().getParent().close();
        },

        // open the dialog
        onPostItem: function (oEvent) {
            debugger;
            const oView = this.getView();
            const oSource = oEvent.getSource();
            const oContext = oSource.getBindingContext("wmModel") || oSource.getParent().getBindingContext("wmModel");
            const oModel = oView.getModel("wmModel");

            // creo selected item come copia del context object 
            const oSelectedItem = {
                ...oContext.getObject(),
                postedBy: this.getUserId(),
                uom: this.getPodSelectionModel().selectedOrderData.baseCommercialUom,
                postingDateTime: new Date().toISOString(),
                comments: "",
                quantity: oModel.getData().pallet
            };

            oModel.setProperty("/selectedItem", oSelectedItem);

            if (!this._oGoodsReceiptDialog) {
                Fragment.load({
                    name: "altea.dmc.plugin.testPlugin.testPlugin.view.fragments.GoodsReceiptDialog",
                    controller: this
                }).then(oDialog => {
                    this._oGoodsReceiptDialog = oDialog;
                    oView.addDependent(oDialog);
                    oDialog.open();
                });
            } else {
                this._oGoodsReceiptDialog.open();
            }
        },

        onDialogConfirm: async function () {
            const oView = this.getView();
            const oModel = oView.getModel("wmModel");
            const oData = oModel.getProperty("/selectedItem");

            // Data validation ?
            if (!oData || !oData.quantity || oData.quantity <= 0) {
                sap.m.MessageBox.error("Please enter a valid quantity.");
                return;
            }

            // Close dialog
            if (this._oGoodsReceiptDialog) {
                this._oGoodsReceiptDialog.close();
            }

            // Show busy indicator
            sap.ui.core.BusyIndicator.show(0);

            try {
                // TO FIX (|| true is only to test)
                // Get plugin configuration button value
                const bPostQuantityConfirmation = this.getConfiguration().getParameter("postToERP") || true;

                const podSelectionModel = this.getPodSelectionModel();
                const orderData = podSelectionModel.selectedOrderData;
                const order = orderData.order;
                const plant = podSelectionModel.selectedPhaseData.resource.plant;
                debugger;

                // erpGoodsReceipts payload
                const erpPayload = {
                    order: order,
                    plant: plant,
                    postedBy: oData.postedBy,
                    lineItems: [
                        {
                            comments: oData.comments || "",
                            material: oData.material,
                            postingDateTime: oData.postingDateTime,// ISO-8601 yyyy-MM-dd'T'HH:mm:ss.SSS'Z', example: 2022-08-31T23:53:34.123Z
                            quantity: {
                                value: oData.quantity,
                                unitOfMeasure: oData.uom
                            },
                            sfc: orderData.sfc,
                            storageLocation: oData.storageLocation
                        }
                    ]
                };

                // https://api.sap.com/api/sapdme_inventory/path/postErpGoodsReceiptsUsingPOST_2
                const sErpUrl = "/destination/SAP_DMC_DEFAULT_SERVICE_KEY/v1/inventory/erpGoodsReceipts";

                debugger;
                const erpResponse = await $.ajax({
                    url: sErpUrl,
                    method: "POST",
                    contentType: "application/json",
                    data: JSON.stringify(erpPayload)
                });

                console.log("ERP Goods Receipt OK:", erpResponse);

                if (bPostQuantityConfirmation && erpResponse) {
                    // Quantity Confirmation enabled in Configuration => call https://api.sap.com/api/sapdme_quantityConfirmation/resource/Post_Quantity_Confirmation
                    const sQtyUrl = "/destination/SAP_DMC_DEFAULT_SERVICE_KEY/v1/quantityConfirmations";

                    // Post_Quantity_Confirmation payload
                    const qtyConfirmationPayload = {
                        plant: plant,
                        shopOrder: order,
                        sfc: orderData.sfc,
                        operationActivity: podSelectionModel.operations[0].operation,
                        workCenter: orderData.workcenter,
                        yieldQuantity: oData.quantity,
                        yieldQuantityIsoUnit: oData.uom,
                        postedBy: oData.postedBy,
                        storageLocation: oData.storageLocation,
                        postingDateTime: oData.postingDateTime// ISO-8601 yyyy-MM-dd'T'HH:mm:ss.SSS'Z', example: 2022-08-31T23:53:34.123Z
                    };

                    debugger;
                    const qtyResponse = await $.ajax({
                        url: sQtyUrl,
                        method: "POST",
                        contentType: "application/json",
                        data: JSON.stringify(qtyConfirmationPayload)
                    });

                    console.log("Quantity Confirmation OK:", qtyResponse);
                    sap.m.MessageBox.success("Goods Receipt and Quantity Confirmation posted successfully.");
                } else {
                    sap.m.MessageToast.show("Goods Receipt posted. Quantity Confirmation disabled in Configuration.");
                }

            } catch (err) {
                debugger;
                console.error("Error posting to ERP or Quantity Confirmation:", err);
                const msg = err.responseJSON?.error?.message || "Error during posting to ERP or Quantity Confirmation.";
                sap.m.MessageBox.error(msg);
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
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

            // this.configureGoodsReceiptTable();
        },

        _SummaryData: function (sChannelId, sEventId, oData) {
            debugger;
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