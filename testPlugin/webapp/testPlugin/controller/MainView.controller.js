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

    let oController, EWMWarehouse, _TYPE = "";
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
            EWMWarehouse = this.getConfiguration().EWMWarehouse;

            // creo il modello di appoggio per il plugin
            let jsonModelWM = new JSONModel({ pallet: 0, scatola: 0, palletscatola: 0, palletBusy: true, scatolaBusy: true, palletscatolaBusy: true, lineItems: [] });
            this.getView().setModel(jsonModelWM, "wmModel");

            // carico i dati del WM dopo il caricamento effettivo del plugin
            this.loadData();

            // richiamo la function per intercettare il dialog GoodsReceipt
            // this.interceptGoodsReceiptDialog();

            //Inizializzo i SERVICE
            Service = new Service(EWMWarehouse);

            Service.test();
        },

        // NO LONGER NEEDED
        /*interceptGoodsReceiptDialog: function () {
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
        */

        loadData: function () {
            const that = this;

            that.getView().getModel("wmModel").setProperty("/sfcStatus", this.getPodSelectionModel().selectedOrderData.sfcStatus);

            const sMaterial = this.getPodSelectionModel().selectedOrderData.material.material;

            //avvio i loader
            that.getView().getModel("wmModel").setProperty("/palletBusy", true);
            that.getView().getModel("wmModel").setProperty("/scatolaBusy", true);
            that.getView().getModel("wmModel").setProperty("/palletscatolaBusy", true);

            const sFilter = encodeURIComponent(
                // `substringof('${sMaterial}',PackingInstructionNumber)`
                `substringof('${sMaterial}',PackingInstructionNumber) and PackingInstructionIsDeleted eq false`
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
                    if (!!!!oData && !!!!oData.d && !!!!oData.d.results && !!!!oData.d.results.length > 0) {

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
                            try {
                                that.getView().getModel("wmModel").setProperty("/packingMaterial", aData.filter(a => a.to_PackingInstructionComponent.results.some(b => b.PackingInstructionItemCategory === "P"))[0].to_PackingInstructionComponent?.results.filter(a => a.PackingInstructionItemCategory === "P")[0]?.Material || "");
                            } catch (error) {
                                that.getView().getModel("wmModel").setProperty("/packingMaterial", "");
                            }


                            // TODO: quando sarà presente sfruttare il controllo di una variabile globare che screma i casi A e B
                            if (Number(qtaScatola) !== 0) {
                                // settare il counter delle scatole versate 
                                that.setScatoleVersate();
                                _TYPE = "B";
                            } else {
                                _TYPE = "A";
                                try {
                                    const oView = oController.getView().byId("qtyScatoleVersate").setVisible(false);
                                } catch (error) {

                                }

                            }

                            // fermo i busy
                            that.getView().getModel("wmModel").setProperty("/palletBusy", false);
                            that.getView().getModel("wmModel").setProperty("/scatolaBusy", false);
                            that.getView().getModel("wmModel").setProperty("/palletscatolaBusy", false);

                            that.getView().byId("wm").setVisible(true);

                        } else {

                            for (let item of aData) {
                                for (let component of item.to_PackingInstructionComponent.results) {

                                    if (component.Material === sMaterial) {
                                        that.getView().getModel("wmModel").setProperty("/pallet", component.PackingInstructionItmTargetQty);
                                        that.getView().getModel("wmModel").setProperty("/scatola", 0);
                                        that.getView().getModel("wmModel").setProperty("/palletscatola", 0);
                                    }

                                    try {
                                        that.getView().getModel("wmModel").setProperty("/packingMaterial", aData.filter(a => a.to_PackingInstructionComponent.results.some(b => b.PackingInstructionItemCategory === "P"))[0].to_PackingInstructionComponent?.results.filter(a => a.PackingInstructionItemCategory === "P")[0]?.Material || "");
                                    } catch (error) {
                                        that.getView().getModel("wmModel").setProperty("/packingMaterial", "");
                                    }

                                    _TYPE = "A";
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

                        //svuoto
                        that.getView().getModel("wmModel").setProperty("/pallet", 0);
                        that.getView().getModel("wmModel").setProperty("/scatola", 0);
                        that.getView().getModel("wmModel").setProperty("/palletscatola", 0);

                        try {
                            that.getView().getModel("wmModel").setProperty("/packingMaterial", "");
                        } catch (error) {
                            that.getView().getModel("wmModel").setProperty("/packingMaterial", "");
                        }

                        // Creo il messaggio
                        sap.m.MessageBox.error(
                            `Definire norme di imballo del materiale ${this.getPodSelectionModel().selectedOrderData.materialName}.\nVersamento impossibile!\nContattare il supervisore.`,
                            {
                                onClose: () => {
                                    // Torna indietro alla pagina precedente
                                    window.history.back();
                                    // oppure, se stai usando un router UI5:
                                    // this.getOwnerComponent().getRouter().navTo("nomeDellaRoutePrecedente");
                                }
                            }
                        );


                        // inibire la registrazione dei versamenti
                        that.getView().byId("recordBtn").setEnabled(false);
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
                postedQuantityPercent: Number((100 * orderData.completedQty) / orderData.plannedQty)
            }];

            that.getView().getModel("wmModel").setProperty("/lineItems", items);

            // get storage location
            this.getPutawayStorageLocation();
        },

        setScatoleVersate: async function (sWorkCenter) {
            const oView = this.getView();
            const oModel = oView.getModel("wmModel");

            oView.byId("qtyScatoleVersate").setVisible(_TYPE === "B");
            oModel.setProperty("/scatoleVersateBusy", true);

            const podSelectionModel = this.getPodSelectionModel();
            const orderData = podSelectionModel.selectedOrderData;
            const sMaterial = orderData.material.material;

            try {
                // Recupero Workcenter se non passato
                if (!sWorkCenter) {
                    sWorkCenter = await Service.getWorkcenter(
                        oView,
                        sap.dm.dme.util.PlantSettings.getCurrentPlant(),
                        orderData.sfc,
                        orderData.routingId
                    );
                }

                // Chiamata check nesting
                const scatoleVersate = await Service.checkNesting(
                    oView,
                    sMaterial,
                    sWorkCenter,
                    EWMWarehouse
                );

                oModel.setProperty("/scatoleVersate", scatoleVersate);

            } catch (err) {
                console.error("Errore in setScatoleVersate:", err);
                // eventualmente mostra messaggio utente
                // sap.m.MessageToast.show("Errore nel recupero scatole versate");
                oModel.setProperty("/scatoleVersate", 0); // default in caso di errore
            } finally {
                oModel.setProperty("/scatoleVersateBusy", false);
            }
        },

        getPutawayStorageLocation: async function () {
            const sBaseUrl = this.getView().getController().getDemandRestDataSourceUri(),
                sPlant = (sap.dm.dme.util.PlantSettings).getCurrentPlant(),
                sOrder = this.getPodSelectionModel().selectedOrderData.order,
                sUrl = `${sBaseUrl}shopOrders/search/findByPlantAndShopOrder?plant=${sPlant}&shopOrder=${sOrder}`;
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
                            lineItems[0].warehouseNumber = oData.warehouseNumber;
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

            //TEST
            await Service.getMetadata();

            return oData;
        },

        // show history table from fragment 
        onShowPostings: function () {
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

        loadPostingHistory: async function (iPage = 0) {

            const oWMModel = this.getView().getModel("wmModel");

            // Evita doppie chiamate se è già in corso un caricamento
            if (oWMModel.getProperty("/busyPostings")) {
                return;
            }

            oWMModel.setProperty("/busyPostings", true);

            try {
                const oData = await oController.getPutawayStorageLocation();
                const sUrl = oController.getInventoryDataSourceUri() + "ui/order/goodsReceipt/details";
                const oParameters = {
                    shopOrder: oData.shopOrder,
                    batchId: oController.getPodSelectionModel().selectedOrderData.sfc,
                    material: oData.material.ref,
                    dontShowPrint: false,
                    page: iPage,
                    size: 20,
                    bomComponentSequence: ''
                };

                AjaxUtil.get(sUrl, oParameters, (oResponseData) => {
                    const details = oResponseData?.details;
                    const aResults = details?.content || [];

                    const oDateFormat = sap.ui.core.format.DateFormat.getDateTimeInstance({
                        style: "medium",
                        UTC: true
                    });

                    const material = oResponseData.material;
                    const aFormatted = aResults.map(item => ({
                        ...item,
                        material,
                        postingDateTimeDisplay: item.dateTime
                            ? oDateFormat.format(new Date(item.dateTime))
                            : "",
                        createdDateTimeDisplay: item.createdDateTime
                            ? oDateFormat.format(new Date(item.createdDateTime))
                            : ""
                    }));

                    // Merge results (reset if first page)
                    const aExisting = iPage === 0 ? [] : (oWMModel.getProperty("/postingsHistory") || []);
                    oWMModel.setProperty("/postingsHistory", [...aExisting, ...aFormatted]);

                    // Save paging info
                    oWMModel.setProperty("/postingsPage", iPage);
                    oWMModel.setProperty("/postingsTotalPages", details?.totalPages ?? 1);
                }, (oError, sHttpErrorMessage) => {
                    console.error("Errore nel recupero posting history:", sHttpErrorMessage);
                });
            } catch (err) {
                console.error("Errore inatteso in loadPostingHistory:", err);
            } finally {
                oWMModel.setProperty("/busyPostings", false);
            }
        },

        onPostingsUpdateFinished: function (oEvent) {
            const oWMModel = this.getView().getModel("wmModel");
            const iPage = oWMModel.getProperty("/postingsPage") || 0;
            const iTotalPages = oWMModel.getProperty("/postingsTotalPages") || 1;
            const aItems = oWMModel.getProperty("/postingsHistory") || [];

            // Se siamo all’ultima pagina, non fare nulla
            if (iPage + 1 >= iTotalPages) {
                return;
            }

            // Se la tabella ha già caricato tutti gli elementi visibili (trigger naturale del growing)
            const oTable = oEvent.getSource();
            if (aItems.length >= (iPage + 1) * oTable.getGrowingThreshold()) {
                // Quando l’utente arriva in fondo, carico la pagina successiva
                this.loadPostingHistory(iPage + 1);
            }
        },

        onCloseDialog: function (evt) {
            evt.getSource().getParent().close();
        },

        // open the dialog
        onPostItem: function (oEvent) {
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
                quantity: oModel.getData().scatola > 0 ? oModel.getData().scatola : oModel.getData().pallet
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

        onChiusuraManuale: async function (oEvent) {
            // show confirm dialog
            if (!this.oManualClosingConfirmDialog) {
                Fragment.load({
                    id: this.getView().getId(),
                    name: "altea.dmc.plugin.testPlugin.testPlugin.view.fragments.ManualClosingConfirmDialog",
                    controller: this
                }).then(function (oDialog) {
                    this.oManualClosingConfirmDialog = oDialog;
                    this.getView().addDependent(oDialog);
                    oDialog.open();
                }.bind(this));
            } else {
                this.oManualClosingConfirmDialog.open();
            }
        },

        onConfermaChiusuraManuale: async function (oEvent) {
            this.oManualClosingConfirmDialog().close();

            sap.ui.core.BusyIndicator.show(0);

            await Service.postInboundDelivery(oController, "B", async function (sType, sMessage) {
                sap.ui.core.BusyIndicator.hide();
                oController.getGoodsReceiptData();

                if (sType === "success") {
                    sap.m.MessageToast.show(`Chiusura pallet effettuata con successo`);
                } else {
                    sap.m.MessageBox.error(sMessage);
                }

                // chiamare POST Post_Quantity_Confirmation in base alla configurazione postQtyConfirmation
                await oController.postQtyConfirmation();
            }, true);
        },

        // TO TEST
        /*  1- chiamare POST Post_Quantity_Confirmation in base alla configurazione postQtyConfirmation
            2- chiamare POST postErpGoodsReceiptsUsingPOST_2
            3- solo se se la postErpGoodsReceiptsUsingPOST_2 va a buon fine chiamare GET Warehouse_Inbound_Delivery_Item a polling per massimo 10 secondi
            4- quando la Warehouse_Inbound_Delivery_Item va a buon fine eseguire POST Warehouse_Inbound_Delivery_Item per il valore di EWMInboundDelivery appena ricavato 
               (o eseguirlo in loop se sono stati eccezionalmente trovati più valori) per registrare l’entrata merci su SAP.
         */
        onDialogConfirm: async function (evt) {
            // Close dialog
            if (this._oGoodsReceiptDialog) {
                this._oGoodsReceiptDialog.close();
            }

            // Show busy indicator
            sap.ui.core.BusyIndicator.show(0);

            try {

                //TODO: Richiamare la 
                // /sap/api_whse_inb_delivery_2/srvd_a2x/sap/warehouseinbounddelivery/0001/WhseInboundDeliveryItem?$filter=EWMWarehouse eq 'PLE1' and ManufacturingOrder eq '1000023' and GoodsReceiptStatus eq '1'&$count=true
                // e prelevarsi il count e lo salviamo dentro una variabile (iCountOld)
                const podSelectionModel = this.getPodSelectionModel();
                const orderData = podSelectionModel.selectedOrderData;
                var iCountOld = await Service.getCountInboundDelivery(oController, EWMWarehouse, orderData.order);



                const oView = this.getView();
                const oModel = oView.getModel("wmModel");
                const oData = oModel.getProperty("/selectedItem");

                await Service.postInboundDelivery(oController, _TYPE, async function (sType, sMessage) {
                    sap.ui.core.BusyIndicator.hide();
                    oController.getGoodsReceiptData();

                    if (sType === "success") {
                        sap.m.MessageToast.show(`Versamento avvenuto con successo`);
                    } else {
                        sap.m.MessageBox.error(sMessage);
                    }

                    // chiamare POST postErpGoodsReceiptsUsingPOST_2 e attenderne l'esito
                    var res = await this.postErpGoodsReceipts();
                    // chiamare POST Post_Quantity_Confirmation in base alla configurazione postQtyConfirmation
                    oController.postQtyConfirmation();
                }, false, iCountOld);


            } catch (err) {

                if (!!!!err && !!!!err?.lineItems) {
                    const sMessage = err?.lineItems
                        ?.map(a => a.errorMessage)
                        .filter(Boolean)
                        .join("\n");

                    sap.m.MessageBox.error(sMessage || "Errore sconosciuto nel POST Goods Receipt");
                }
                console.log("Error on dialog confirm", err);
                // sap.m.MessageBox.error(msg);
            } finally {

            }
        },

        // se switch 'postQtyConfirmation' è ON chiama https://api.sap.com/api/sapdme_quantityConfirmation/resource/Post_Quantity_Confirmation
        // la standard fa https://sap-dmc-test-n3lov8wp.execution.eu20-quality.web.dmc.cloud.sap/sapdmdmepod/~80d9e20e-6f47-44c7-9bcb-36549b837c9b~/dme/production-ms/quantityConfirmation/confirm
        postQtyConfirmation: async function () {
            try {
                // Get plugin configuration switch postQtyConfirmation value
                const bPostQtyConfirmation = this.getConfiguration().postQtyConfirmation;

                if (!bPostQtyConfirmation) {
                    sap.m.MessageToast.show("Goods Receipt posted. Quantity Confirmation disabled in Configuration.");
                    return;
                }

                const podSelectionModel = this.getPodSelectionModel();
                const orderData = podSelectionModel.selectedOrderData;
                const oView = this.getView();
                const oModel = oView.getModel("wmModel");
                const oData = oModel.getProperty("/selectedItem");

                // https://api.sap.com/api/sapdme_quantityConfirmation/resource/Post_Quantity_Confirmation
                const sUrl = `/destination/S4H_DMC_API/quantityConfirmation/v1/confirm`;

                // Post_Quantity_Confirmation payload
                const payload = {
                    plant: (sap.dm.dme.util.PlantSettings).getCurrentPlant(),
                    shopOrder: orderData.order,
                    sfc: orderData.sfc,
                    operationActivity: podSelectionModel.operations[0].operation,
                    workCenter: oData.workcenter || orderData.workcenter,//orderData.workcenter, 
                    yieldQuantity: oData.quantity,
                    yieldQuantityUnit: orderData.baseInternalUom,
                    // scrapQuantity	[...]
                    // scrapQuantityUnit	[...]
                    // scrapQuantityIsoUnit	[...]
                    // reasonCodeKey	[...]
                    postedBy: oData.postedBy,
                    // batchNumber	[...]
                    storageLocation: oData.storageLocation,
                    postingDateTime: oData.postingDateTime// ISO-8601 yyyy-MM-dd'T'HH:mm:ss.SSS'Z', example: 2022-08-31T23:53:34.123Z
                    // finalConfirmation	[...]
                    // checkSchedulingAndOeeRelevant
                };

                const that = this;

                AjaxUtil.post(
                    sUrl,
                    payload,
                    function (oResponseData) {
                        console.log("POST Quantity Confirmation - Success");


                        that.setScatoleVersate(oData.workcenter || orderData.workcenter);
                    },
                    function (oError, sHttpErrorMessage) {
                        console.log("Errore nel POST Quantity Confirmation:", sHttpErrorMessage, oError);
                        // sap.m.MessageBox.error("Errore nel POST Goods Receipt: " + sHttpErrorMessage);
                    }
                );

            } catch (err) {
                console.log("Error posting quantity confirmation", err);
                
            } finally {
                
            }
        },

        // TODO batchNumber is only to test, remove it using right data like FG129 material
        // The batchNumber field is required since material G10079A0IML0179 is batch managed, bisognerebbe usare il materiale FG129 che non è batch managed ma gli mancano altre cose per il flusso 
        // triggerPoint fisso a "ORD_POD_GR"?
        // chiama https://api.sap.com/api/sapdme_inventory/path/postErpGoodsReceiptsUsingPOST_2
        postErpGoodsReceipts: async function () {
            const oView = this.getView();
            const oModel = oView.getModel("wmModel");
            const oData = oModel.getProperty("/selectedItem");
            const podSelectionModel = this.getPodSelectionModel();
            const orderData = podSelectionModel.selectedOrderData;
            const order = orderData.order;

            const sUrl = oController.getInventoryDataSourceUri() + "order/goodsReceipt";
            
            // erpGoodsReceipts payload
            const payload = {
                orderNumber: order,
                triggerPoint: "ORD_POD_GR", // ?
                lineItems: [{
                    // batchNumber is ONLY TO TEST => TO DELETE WITH RIGHT MATERIAL FG129
                    //batchNumber: '000110',
                    // bomComponentSequence: oData.bomComponentSequence || null,
                    comments: oData.comments || "",
                    // customFieldData: oData.customFieldData || null,
                    // handlingUnitNumber: oData.handlingUnitNumber || null,
                    material: oData.material, // "G10079A0IML0179"
                    // materialVersion: oData.materialVersion || "ERP001",
                    postedBy: oData.postedBy,
                    postingDateTime: oData.postingDateTime,
                    quantity: {
                        value: oData.quantity,
                        unitOfMeasure: {
                            commercialUnitOfMeasure: oData.uom
                        }
                    },
                    // quantityToleranceCheck: oData.quantityToleranceCheck ?? true,
                    sfc: orderData.sfc,
                    storageLocation: oData.storageLocation
                }]
            };

            return await new Promise((resolve, reject) => {
                AjaxUtil.post(
                    sUrl,
                    payload,
                    function (oResponseData) {
                        console.log("POST Goods Receipt - Success:");
                        // sap.m.MessageToast.show("Goods Receipt creato con successo!");
                        resolve(oResponseData);
                    },
                    function (oError, sHttpErrorMessage) {
                        console.log("Errore nel POST Goods Receipt:", sHttpErrorMessage, oError);
                        // sap.m.MessageBox.error("Errore nel POST Goods Receipt: " + sHttpErrorMessage);
                        reject(oError);
                    }
                );
            });
        },

        // TO TEST 
        // chiama https://api.sap.com/api/WAREHOUSEINBOUNDDELIVERY_0001/path/get_WhseInboundDeliveryItem a polling per massimo 10 secondi per recuperare EWMInboundDelivery 
        /*getWmInboundDeliveryItem: function () {
            const MAX_DURATION = 10000; // 10 secondi
            const oView = this.getView();
            const oModel = oView.getModel("wmModel");
            const oData = oModel.getProperty("/lineItems");
            const podSelectionModel = this.getPodSelectionModel();
            const orderData = podSelectionModel.selectedOrderData;

            const sUrl = `/destination/S4H_ODATA_INTEGRATION_ODATA4/api_whse_inb_delivery_2/srvd_a2x/sap/warehouseinbounddelivery/0001/WhseInboundDeliveryItem`;
            const sParams = `?EWMWarehouse=${encodeURIComponent(oData[0].warehouseNumber)}`
                + `&ManufacturingOrder=${encodeURIComponent(orderData.order)}`
                + `&GoodsReceiptStatus=1`;

            return new Promise((resolve, reject) => {
                let stopped = false;

                // Timeout massimo
                const timeoutId = setTimeout(() => {
                    
                    stopped = true;
                    console.warn("Timeout: nessun EWMInboundDelivery trovato entro 10 secondi.");
                    reject();
                }, MAX_DURATION);

                const poll = () => {
                    if (stopped) return;

                    try {
                        console.log("Polling:", sUrl + sParams, new Date().toISOString());

                        AjaxUtil.get(
                            sUrl + sParams,
                            (response) => {
                                console.log("Polling response:", response);

                                if (response?.value?.length > 0) {
                                    stopped = true;
                                    clearTimeout(timeoutId);
                                    resolve(response.value);
                                } else if (!stopped) {
                                    // Attendi 300ms prima di ripetere altrimenti il polling entra in un loop troppo veloce e il browser, non avendo ancora rilasciato completamente le connessioni precedenti, finisce per saturare le risorse di rete
                                    setTimeout(poll, 300);
                                }
                            },
                            (error, msg) => {
                                console.warn("Errore nel polling:", msg, error);

                                // Se 404 o simile, continua comunque a pollare dopo 300 ms
                                if (!stopped) {
                                    // Attendi 300ms prima di ripetere altrimenti il polling entra in un loop troppo veloce e il browser, non avendo ancora rilasciato completamente le connessioni precedenti, finisce per saturare le risorse di rete
                                    setTimeout(poll, 300);
                                }
                            }
                        );
                    } catch (err) {
                        console.error("Eccezione durante il polling:", err);
                        if (!stopped) {
                            // Attendi 300ms prima di ripetere altrimenti il polling entra in un loop troppo veloce e il browser, non avendo ancora rilasciato completamente le connessioni precedenti, finisce per saturare le risorse di rete
                            setTimeout(poll, 300);
                        }
                    }
                };

                poll();
            });
        },*/

        // TO TEST
        // chiama https://api.sap.com/api/WAREHOUSEINBOUNDDELIVERY_0001/path/get_WhseInboundDeliveryItem per il valore di EWMInboundDelivery appena ricavato per registrare l’entrata merci su SAP per ogni EWMInboundDelivery trovata
        // N.B: eseguirlo in loop se sono stati eccezionalmente trovati più valori
        /*postWmInboundDeliveryItem: async function (EWMInboundDeliveryArray) {
            try {
                const podSelectionModel = this.getPodSelectionModel();
                const orderData = podSelectionModel.selectedOrderData;

                const sUrl = `/destination/S4H_ODATA_INTEGRATION_ODATA4/api_whse_inb_delivery_2/srvd_a2x/sap/warehouseinbounddelivery/0001/WhseInboundDeliveryItem`;

                // Crea un array di Promise (una per ogni chiamata POST)
                const aPromises = EWMInboundDeliveryArray.map((deliveryObj) => {

                    const sUrl = `/destination/S4H_ODATA_INTEGRATION/api_whse_inb_delivery_2/srvd_a2x/sap/warehouseinbounddelivery/0001/WhseInboundDeliveryItem/${deliveryObj.EWMInboundDelivery}/${deliveryObj.EWMInboundDeliveryItem}/SAP__self.AdjustDeliveryItemQuantity`;

                    return new Promise((resolve, reject) => {
                        AjaxUtil.post(
                            sUrl,
                            payload,
                            function (oResponseData) {
                                
                                console.log(
                                    `POST Warehouse Inbound Delivery Item per ${deliveryObj.EWMInboundDelivery}/${deliveryObj.EWMInboundDeliveryItem} - Success:`,
                                    oResponseData
                                );
                                resolve(oResponseData);
                            },
                            function (oError, sHttpErrorMessage) {
                                
                                console.log(
                                    `Errore nel POST Warehouse Inbound Delivery Item per ${deliveryObj.EWMInboundDelivery}/${deliveryObj.EWMInboundDeliveryItem}:`,
                                    sHttpErrorMessage,
                                    oError
                                );
                                reject(oError);
                            }
                        );
                    });
                });

                // Attendo che tutte le chiamate si completino in parallelo
                const results = await Promise.allSettled(aPromises);

                // Analisi risultati
                
                const success = results.filter(r => r.status === "fulfilled").length;
                const failed = results.filter(r => r.status === "rejected").length;

                console.log(`POST completate: ${success} OK, ${failed} fallite.`);
                sap.m.MessageToast.show(`POST completate: ${success} OK, ${failed} fallite.`);

            } catch (err) {
                console.log("Errore generale durante le POST Warehouse Inbound Delivery Item:", err);
                sap.m.MessageBox.error("Errore generale durante le POST Warehouse Inbound Delivery Item.");
            } finally {
                sap.ui.core.BusyIndicator.hide();
            }
        },*/

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
