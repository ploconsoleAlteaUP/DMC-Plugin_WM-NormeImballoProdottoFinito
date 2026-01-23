sap.ui.define([
    'jquery.sap.global',
    "sap/dm/dme/podfoundation/controller/PluginViewController",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/m/MessageBox",
    "sap/m/Dialog",
    "../model/formatter",
    "sap/dm/dme/model/AjaxUtil",
    "../srv/Service",
    "../util/Utils"
], function (jQuery, PluginViewController, JSONModel, Fragment, MessageBox, Dialog, formatter, AjaxUtil, Service, Utils) {
    "use strict";

    let oController, EWMWarehouse, _TYPE = "", actualNumber = 0, isOnConfirmation = false, WarehouseProcessTypeA = "", WarehouseProcessTypeB = "", _RemainingStepQuantity = 0, PackagingMaterial = "",
        GOOD_RECEIPT_TYPE = "Production Order Goods Receipt", QUANTITY_CONFIRMATION_TYPE = "Production Order Quantity Confirmation", DATENOW_INTEGRATION_MESSAGE_DASHBOARD = undefined,
        IS_MANUAL_CONFIRMATION = false, UPDATE_QUANTITY_TO_CHECK = 0;
    return PluginViewController.extend("altea.dmc.plugin.testPlugin.testPlugin.controller.MainView", {
        formatter: formatter,

        onInit: function () {
            PluginViewController.prototype.onInit.apply(this, arguments);

            console.log(`URL: ${this.getPublicApiRestDataSourceUri()}`);
            oController = this;

            let jsonModel = new JSONModel({
                recordBtnEnabled: true,
                manualBtnEnabled: true
            });
            this.getView().setModel(jsonModel, "enableModel");

            let jsonVersionModel = new JSONModel({
                version: "1.0.14"
            });
            this.getView().setModel(jsonVersionModel, "versionModel");
        },

        onAfterRendering: function () {
            // assegno i valori passati dal componente (quello di configurazione)
            this.getView().byId("qtyPallet").setVisible(this.getConfiguration().addQtaPallet);
            this.getView().byId("qtyScatola").setVisible(this.getConfiguration().addQtaScatola);
            this.getView().byId("qtyPalletScatola").setVisible(this.getConfiguration().addQtaScatolaPerPallet);
            this.getView().byId("headerTitle").setText(this.getConfiguration().title);
            EWMWarehouse = this.getConfiguration().EWMWarehouse;
            WarehouseProcessTypeA = this.getConfiguration().WarehouseProcessTypeA;
            WarehouseProcessTypeB = this.getConfiguration().WarehouseProcessTypeB;

            // creo il modello di appoggio per il plugin
            let jsonModelWM = new JSONModel({ pallet: 0, scatola: 0, palletscatola: 0, palletBusy: true, scatolaBusy: true, palletscatolaBusy: true, lineItems: [] });
            this.getView().setModel(jsonModelWM, "wmModel");

            // leggo il badge
            // Service.getUserBadge(oController.getView(), sap.dm.dme.util.PlantSettings.getCurrentPlant(), oController.getUserId());

            // carico i dati del WM dopo il caricamento effettivo del plugin
            this.loadData();

            // richiamo la function per intercettare il dialog GoodsReceipt
            // this.interceptGoodsReceiptDialog();

            //Inizializzo i SERVICE
            Service = new Service(EWMWarehouse);

            //Service.test();
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

        loadData: async function (qtaCheck) {
            oController.setEnabledRecordAndManualClosing();

            const that = this;

            that.getView().getModel("wmModel").setProperty("/sfcStatus",);

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

                            try {
                                PackagingMaterial = aPacking[0].to_PackingInstructionComponent.results.filter(a => a.PackingInstructionItemCategory === "P")[0].Material
                            } catch (error) {

                            }

                            // assegno i valori ai rispettivi oggetti della view
                            that.getView().getModel("wmModel").setProperty("/pallet", qtaPallet);
                            that.getView().getModel("wmModel").setProperty("/scatola", qtaScatola);
                            that.getView().getModel("wmModel").setProperty("/palletscatola", qtaScatolePallet);
                            try {
                                that.getView().getModel("wmModel").setProperty("/packingMaterial", aData.filter(a => a.to_PackingInstructionComponent.results.some(b => b.PackingInstructionItemCategory === "P"))[0].to_PackingInstructionComponent?.results.filter(a => a.PackingInstructionItemCategory === "P")[0]?.Material || "");
                            } catch (error) {
                                that.getView().getModel("wmModel").setProperty("/packingMaterial", "");
                            }

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
                postedQuantityDisplay: Number(orderData.completedQty) + ' di ' + Number(orderData.plannedQty) + ' ' + orderData.baseCommercialUom,
                postedQuantityPercent: Number((100 * orderData.completedQty) / orderData.plannedQty)
            }];

            that.getView().getModel("wmModel").setProperty("/lineItems", items);

            // get storage location
            this.getPutawayStorageLocation();

            //Controllo se la quantità versata è aumentata rispetto all'ultimo refresh
            /*if(qtaCheck) {
                if(qtaCheck > orderData.completedQty) {
                    //effettuare un versamento
                    
                    await oController.postQtyConfirmation(IS_MANUAL_CONFIRMATION);
                }
            }*/
        },

        manageChangeNumberScatola: async function (iNewNumber) {
            // debugger;
            //
            if (iNewNumber === oController.actualNumber && oController.isOnConfirmation) {
                oController.getView().getModel("wmModel").setProperty("/scatoleVersateBusy", true);
                // oController.getView().byId("recordBtn").setEnabled(false);
                oController.getView().getModel("enableModel").setProperty("/recordBtnEnabled", false);

                try {
                    //oController.getView().byId("manualBtn").setEnabled(true);
                    oController.getView().byId("recordBtn").setEnabled(false);
                } catch (error) {

                }

                function sleep(ms) {
                    return new Promise(resolve => setTimeout(resolve, ms));
                }

                await sleep(3000);
                oController.isOnConfirmation = false;
                await oController.loadData();
                //await oController.manageChangeNumberScatola(iNewNumber);
            } else {
                oController.getView().getModel("wmModel").setProperty("/scatoleVersateBusy", false);
                // oController.getView().byId("recordBtn").setEnabled(true);
                // oController.getView().getModel("enableModel").setProperty("/recordBtnEnabled", true);
                oController.setEnabledRecordAndManualClosing();
                oController.isOnConfirmation = false;
            }
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

                oController.manageChangeNumberScatola(scatoleVersate);

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

                        if (oData && oData.erpPutawayStorageLocation && oData.erpPutawayStorageLocation.length > 0) {
                            if (!oController.getConfiguration().WarehouseVers.split(",").includes(oData.erpPutawayStorageLocation)) {
                                MessageBox.error("Magazzino Logico non configurato correttamente.\nContattare il responsabile.", {
                                    onClose: function (sAction) {
                                        // Torna indietro alla pagina precedente
                                        window.history.back();
                                    },
                                    dependentOn: oController.getView()
                                });
                            }
                        } else {
                            MessageBox.error("Magazzino Logico non configurato correttamente.\nContattare il responsabile.", {
                                onClose: function (sAction) {
                                    // Torna indietro alla pagina precedente
                                    window.history.back();
                                },
                                dependentOn: oController.getView()
                            });
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
            //await Service.getMetadata();

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

            // Gestione dello StepInput
            if (oModel.palletscatola !== undefined && oModel.palletscatola > 0) {
                oSelectedItem["stepMaxQuantity"] = oModel.palletscatola - oModel.scatoleVersate;
                oSelectedItem["stepQuantity"] = 1;
            }

            oSelectedItem["enabled"] = _TYPE === "B";

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

        // Gestione StepInput in modalità LiveChange
        onChangeStep: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            if (sValue !== undefined && sValue > 0) {
                if (sValue > (oController.getView().getModel("wmModel").getProperty("/palletscatola") - oController.getView().getModel("wmModel").getProperty("/scatoleVersate"))) {
                    MessageBox.show("Quantità inserita è superiore alla quantità consentita.\nVerrà automaticamente modificata in " + (oController.getView().getModel("wmModel").getProperty("/palletscatola") - oController.getView().getModel("wmModel").getProperty("/scatoleVersate")));
                    oEvent.getSource().setValue(oController.getView().getModel("wmModel").getProperty("/palletscatola") - oController.getView().getModel("wmModel").getProperty("/scatoleVersate"));
                }
            }
        },

        onChiusuraManuale: async function (oEvent) {
            // show confirm dialog
            if (!oController.oManualClosingConfirmDialog) {
                Fragment.load({
                    id: this.getView().getId(),
                    name: "altea.dmc.plugin.testPlugin.testPlugin.view.fragments.ManualClosingConfirmDialog",
                    controller: this
                }).then(function (oDialog) {
                    oController.oManualClosingConfirmDialog = oDialog;
                    oController.getView().addDependent(oDialog);
                    oDialog.open();
                }.bind(this));
            } else {
                oController.oManualClosingConfirmDialog.open();
            }
        },

        // OLD
        /*onConfermaChiusuraManuale: async function (oEvent) {
            try {
                if (oController.oManualClosingConfirmDialog) {
                    oController.oManualClosingConfirmDialog.close();
                }
            } catch (error) {

            }

            sap.ui.core.BusyIndicator.show(0);

            await Service.postInboundDelivery(oController, "B", async function (sType, sMessage, bProceede) {
                oController.getGoodsReceiptData();

                if (sType === "success") {
                    sap.m.MessageToast.show(`Chiusura pallet effettuata con successo`);
                } else {
                    sap.m.MessageBox.error(sMessage);
                }

                // chiamare POST Post_Quantity_Confirmation in base alla configurazione postQtyConfirmation
                //if (bProceede) {
                await oController.postQtyConfirmation(true);
                sap.ui.core.BusyIndicator.hide();
                //} else {
                //    sap.ui.core.BusyIndicator.hide();
                //}

            }, true, undefined, WarehouseProcessTypeB, PackagingMaterial);
        },
        */

        // NEW TO TEST
        onConfermaChiusuraManuale: async function (oEvent) {
            return new Promise(async (resolve, reject) => {
                if (oController.oManualClosingConfirmDialog) {
                    oController.oManualClosingConfirmDialog.close();
                }

                sap.ui.core.BusyIndicator.show(0);
                DATENOW_INTEGRATION_MESSAGE_DASHBOARD = new Date();
                IS_MANUAL_CONFIRMATION = true;
                await Service.postInboundDelivery(oController, "B", async function (sType, sMessage, bProceede) {
                    oController.getGoodsReceiptData();

                    if (sType === "success") {
                        sap.m.MessageToast.show(`Chiusura pallet effettuata con successo`);
                    } else {
                        sap.m.MessageBox.error(sMessage);
                    }

                    // chiamare POST Post_Quantity_Confirmation in base alla configurazione postQtyConfirmation
                    //if (bProceede) {
                    await oController.postQtyConfirmation(true);
                    sap.ui.core.BusyIndicator.hide();
                    //} else {
                    //    sap.ui.core.BusyIndicator.hide();
                    //}

                    //controllo per far aggiornare il counter delle scatole
                    if (_TYPE === "B" && actualNumber == oModel.getData().scatoleVersate) {
                        console.log("►►► Rifaccio la chiamata perché il counter delle scatole versate non si è aggiornato ◄◄◄");
                        await oController.onRefresh();
                    }

                    await oController.manageIntegrationMessage(DATENOW_INTEGRATION_MESSAGE_DASHBOARD, QUANTITY_CONFIRMATION_TYPE, false, 0, true);

                    // Resolve o reject in base all'esito
                    if (sType === "success") {
                        resolve();
                    } else {
                        reject(sMessage);
                    }

                }, true, undefined, WarehouseProcessTypeB, PackagingMaterial);
            });
        },

        wait: async function (ms) {
            return new Promise(resolve => setTimeout(resolve, ms));
        },

        /*  1- chiamare POST Post_Quantity_Confirmation in base alla configurazione postQtyConfirmation
            2- chiamare POST postErpGoodsReceiptsUsingPOST_2
            3- solo se se la postErpGoodsReceiptsUsingPOST_2 va a buon fine chiamare GET Warehouse_Inbound_Delivery_Item a polling per massimo 10 secondi
            4- quando la Warehouse_Inbound_Delivery_Item va a buon fine eseguire POST Warehouse_Inbound_Delivery_Item per il valore di EWMInboundDelivery appena ricavato 
               (o eseguirlo in loop se sono stati eccezionalmente trovati più valori) per registrare l’entrata merci su SAP.
         */
        onDialogConfirm: async function (evt) {
            oController.isOnConfirmation = true;
            oController.actualNumber = oController.getView().getModel("wmModel").getProperty("/scatoleVersate");
            // oController.getView().byId("recordBtn").setEnabled(false);
            oController.getView().getModel("enableModel").setProperty("/recordBtnEnabled", false);

            try {
                //oController.getView().byId("manualBtn").setEnabled(true);
                oController.getView().byId("recordBtn").setEnabled(false);
            } catch (error) {

            }

            // Close dialog
            if (this._oGoodsReceiptDialog) {
                this._oGoodsReceiptDialog.close();
            }

            // Show busy indicator
            sap.ui.core.BusyIndicator.show(0);

            try {

                // chiamare POST postErpGoodsReceiptsUsingPOST_2 e attenderne l'esito
                const oView = this.getView();
                const oModel = oView.getModel("wmModel");
                const oData = oModel.getProperty("/selectedItem");

                var res = await this.postErpGoodsReceipts();
                //_RemainingStepQuantity = oData.stepQuantity;
                //var res = await oController.executeGoodReceipt();
                //while(_RemainingStepQuantity > 0) {
                //    await oController.wait(1000);
                //}
                IS_MANUAL_CONFIRMATION = false;
                if (res) {
                    //Richiamare la 
                    // /sap/api_whse_inb_delivery_2/srvd_a2x/sap/warehouseinbounddelivery/0001/WhseInboundDeliveryItem?$filter=EWMWarehouse eq 'PLE1' and ManufacturingOrder eq '1000023' and GoodsReceiptStatus eq '1'&$count=true
                    // e prelevarsi il count e lo salviamo dentro una variabile (iCountOld)
                    const podSelectionModel = this.getPodSelectionModel();
                    const orderData = podSelectionModel.selectedOrderData;
                    var iCountOld = await Service.getCountInboundDelivery(oController, EWMWarehouse, orderData.order);
                    DATENOW_INTEGRATION_MESSAGE_DASHBOARD = new Date();
                    await Service.postInboundDelivery(oController, _TYPE, async function (sType, sMessage, bProceede) {

                        oController.getGoodsReceiptData();

                        if (sType === "success") {
                            sap.m.MessageToast.show(`Versamento avvenuto con successo`);
                        } else {
                            sap.m.MessageBox.error(sMessage);
                        }
                        // chiamare POST Post_Quantity_Confirmation in base alla configurazione postQtyConfirmation
                        if (bProceede) {
                            await oController.postQtyConfirmation(false);
                            sap.ui.core.BusyIndicator.hide();
                        } else {
                            sap.ui.core.BusyIndicator.hide();
                        }

                        //controllo per far aggiornare il counter delle scatole
                        if (_TYPE === "B" && actualNumber == oModel.getData().scatoleVersate) {
                            console.log("►►► Rifaccio la chiamata perché il counter delle scatole versate non si è aggiornato ◄◄◄");
                            await oController.onRefresh();
                        }

                        await oController.manageIntegrationMessage(DATENOW_INTEGRATION_MESSAGE_DASHBOARD, QUANTITY_CONFIRMATION_TYPE, true);

                    }, false, iCountOld, (_TYPE === "A" ? WarehouseProcessTypeA : WarehouseProcessTypeB), PackagingMaterial);




                } else {
                    oController.getGoodsReceiptData();
                }




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

        manageIntegrationMessage: async function (dateNow, sType, isAutomaticClosing, iTime = 0, bForce = false, onResolve) {

            //sType indica se è
            // Production Order Goods Receipt
            // Production Order Quantity Confirmation
            const podSelectionModel = oController.getPodSelectionModel();
            const orderData = podSelectionModel.selectedOrderData;
            const order = orderData.order;

            //La data di comunicazione deve essere in UTC (quindi non in CET)
            const dateNowPlusOneMinute = new Date(dateNow.getTime() + 60 * 1000),
                nowIso = dateNow.toISOString(),
                plusOneMinuteIso = dateNowPlusOneMinute.toISOString();

            let sUrl = `/destination/S4H_DMC_API/integration/v1/integrationMessages?plant=PLE1&createdOnFrom=${nowIso}&createdOnTo=${plusOneMinuteIso}`

            if (sType === QUANTITY_CONFIRMATION_TYPE) {
                sUrl += `&messageTypes=${QUANTITY_CONFIRMATION_TYPE}`;
            } else if (sType === GOOD_RECEIPT_TYPE) {
                sUrl += `&messageTypes=${GOOD_RECEIPT_TYPE}`;
            }

            await AjaxUtil.get(sUrl, undefined, async (oResponseData) => {
                /* 
                {
                "content": [
                        {
                        "id": "92c8d798-ed1a-4c12-b6f3-f48bd1724268",
                        "plant": "PLE1",
                        "messageNumber": "2026012213433383107200",
                        "messageType": "Production Order Quantity Confirmation",
                        "overallStatus": "COMPLETED"
                        }
                ]
                }*/
                if (oResponseData && oResponseData?.content && oResponseData.content.length > 0) {

                    for (let oItem of oResponseData.content) {
                        console.log("►►► Integration Message Dashboard  ◄◄◄", oItem);

                        if (oItem?.overallStatus == "FAILED") {
                            debugger;
                            //Controllo il messaggio d'errore
                            let sBaseUrl = oController.getView().getParent().getPodOwnerComponent().getManifestObject().resolveUri("dme/messagedashboard-ms/").replace("sapdmdmepod","sapdmdmeintegrationmessagemonitor");

                            await AjaxUtil.get(`${sBaseUrl}IntegrationMessageItems?$filter=(messageHeader/id eq '${oItem.id}')`, undefined, async (oResponseData_) => {
                                /* 
                                {
                                    "@odata.context": "$metadata#IntegrationMessageItems/$entity",
                                    "value": [
                                        {
                                            "id": "f616fb5d-e49f-42b1-b7d7-5c355b84f72d",
                                            "leadingMessage": true,
                                            "eventType": "sap.dsc.dm.ReportDIQuantityConfirmation.Requested.v1",
                                            "businessObjectIdentifier": "PLE1/1000003/0010/0.0/0/CNF",
                                            "eventPayload": null,
                                            "requestUrl": "/API_PROD_ORDER_CONFIRMATION_2_SRV/ProdnOrdConf2",
                                            "requestBody": null,
                                            "status": "FAILED",
                                            "responseBody": null,
                                            "errorDetails": "Collaboration execution failed due to the external error: External System S4HANA_CLOUD has Exception: Order 1000003 is already being processed by CB9980000010",
                                            "possibleSolution": null,
                                            "correlationId": "82869a82-c40a-4164-bcf8-e0e57c86a493",
                                            "requestId": "026ed7f1-0a90-45af-9528-48f7ec5f8fec",
                                            "sapPassport": "2A54482A0300E60000646D652D736663657865637574696F6E2D6D7300000000000000000000000000000064756D6D79000000000000000000000000000000000000000000000000000000504F53543A2F636F6D706C6574654F7065726174696F6E4163746976697479000000000000000000000B646D652D736663657865637574696F6E2D6D73000000000000000000000000003641414539423239323432463438354539414230423343363841304135444144200000002939454AB6985A474E8B7CD35E47094C4CBE02D716C2914C6493FE1091221F284100000002000000002A54482A",
                                            "processingType": "Q",
                                            "retryCount": 5,
                                            "producerRetryable": true,
                                            "consumerRetryable": true,
                                            "topicName": "production",
                                            "cpiCorrelationId": null,
                                            "version": 23,
                                            "createdOn": "2026-01-09T14:58:24.4599674Z",
                                            "modifiedOn": "2026-01-10T03:04:11.0701848Z",
                                            "startedAt": "2026-01-09T14:58:24.3511634Z",
                                            "lastUpdatedAt": "2026-01-09T15:03:29.5455629Z",
                                            "lastRetryTriggeredAt": "2026-01-09T15:03:29.0985931Z",
                                            "rawMessageFileId": "dme-messagedashboard-ms/fd681808-34fb-432d-ad45-e3e54492a722/message_item/f616fb5d-e49f-42b1-b7d7-5c355b84f72d/raw_message",
                                            "eventPayloadFileId": "dme-messagedashboard-ms/fd681808-34fb-432d-ad45-e3e54492a722/message_item/f616fb5d-e49f-42b1-b7d7-5c355b84f72d/event_payload",
                                            "requestBodyFileId": "dme-messagedashboard-ms/fd681808-34fb-432d-ad45-e3e54492a722/message_item/f616fb5d-e49f-42b1-b7d7-5c355b84f72d/request_body",
                                            "responseBodyFileId": "dme-messagedashboard-ms/fd681808-34fb-432d-ad45-e3e54492a722/message_item/f616fb5d-e49f-42b1-b7d7-5c355b84f72d/response_body",
                                            "duration": "PT5M5.1943995S"
                                        }
                                    ]
                                }*/
                                if (oResponseData_ && oResponseData_?.value && oResponseData_?.value.length > 0) {
                                    let sMessage = oResponseData_?.value[0].errorDetails;

                                    if (sType === GOOD_RECEIPT_TYPE) {
                                        Utils.onShowTextErrorWithAutomaticClose(oController, "Errore", "Si è scatenato un errore di comunicazione", sMessage, 10, function () { if (onResolve) onResolve(undefined) });
                                    } else {
                                        Utils.onShowTextErrorWithAutomaticClose(oController, "Errore", "Si è scatenato un errore di comunicazione", sMessage, 5, async function () {
                                            let sBaseUrl = oController.getView().getParent().getPodOwnerComponent().getManifestObject().resolveUri("dme/messagedashboard-ms/").replace("sapdmdmepod","sapdmdmeintegrationmessagemonitor"),
                                                payload = { "requests": [{ "messageId": oItem.id, "retryStatus": "FAILED" }], "retryMode": "SEQUENTIAL" };

                                            await AjaxUtil.post(
                                                `${sBaseUrl}integrationMessages/batchRetry`,
                                                payload,
                                                async function (oResponseData) {
                                                    console.log("RETRY - SUCCESS", oResponseData);
                                                    await oController.onRefresh();
                                                },
                                                function (oErrorJson, oErrorMessage, oErrorStatus) {
                                                    console.log("RETRY - ERROR", oErrorJson);
                                                }
                                            );
                                        });
                                    }

                                }
                            }, (oErrorJson, oErrorMessage, oErrorStatus) => {
                                console.log("INTEGRATION MESSAGE ITEMS - ERROR", oErrorJson);
                                if (sType === GOOD_RECEIPT_TYPE) {
                                    if (onResolve) onResolve("OK");
                                }
                            });

                        } else if(oItem?.overallStatus == "NEW" || oItem?.overallStatus == "QUEUED" || oItem?.overallStatus == "IN_PROCESS"){
                            await oController.manageIntegrationMessage(dateNow, sType, isAutomaticClosing, iTime, bForce, onResolve);
                            
                        } else {
                            if (sType === GOOD_RECEIPT_TYPE) {
                                if (onResolve) onResolve("OK");
                            }
                        }
                    }

                } else {
                    if (iTime < 3) {

                        // wait di 3 secondi in modo da far generare correttamente il messaggio nell'integration message dashboard
                        await new Promise(function (resolve) {
                            setTimeout(resolve, 3000);
                        });
                        iTime += 1;

                        oController.manageIntegrationMessage(dateNow, sType, isAutomaticClosing, iTime, bForce, onResolve);
                    } else if (sType == QUANTITY_CONFIRMATION_TYPE) {
                        iTime = 0;

                        //creo la quantity confirmation perché, per qualche motivo, non è andata a buon fine.
                        if (bForce) {
                            debugger;
                            //await oController.postQtyConfirmation(isAutomaticClosing);
                        }

                    } else {
                        if (onResolve) {
                            onResolve("OK");
                        }
                    }
                }

            }, (oErrorJson, oErrorMessage, oErrorStatus) => {
                console.log("INTEGRATION MESSAGE - ERROR", oErrorJson);
                if (sType === GOOD_RECEIPT_TYPE) {
                    if (onResolve) onResolve("OK");
                }
            });
        },

        //Chiamo la Good Receipt in modalità multipla per evitare l'erroe di  exceed quantity
        executeGoodReceipt: async function () {
            const oView = this.getView();
            const oModel = oView.getModel("wmModel");
            const oData = oModel.getProperty("/selectedItem");

            if (_RemainingStepQuantity > 1) {
                _RemainingStepQuantity -= 1;
                var res = await this.postErpGoodsReceipts();

                if (res) {
                    oController.executeGoodReceipt();
                }

            } else {
                _RemainingStepQuantity = 0;
                var res = await this.postErpGoodsReceipts();
                return res;
            }
        },

        // se switch 'postQtyConfirmation' è ON chiama https://api.sap.com/api/sapdme_quantityConfirmation/resource/Post_Quantity_Confirmation
        // la standard fa https://sap-dmc-test-n3lov8wp.execution.eu20-quality.web.dmc.cloud.sap/sapdmdmepod/~80d9e20e-6f47-44c7-9bcb-36549b837c9b~/dme/production-ms/quantityConfirmation/confirm
        postQtyConfirmation: async function (isManual = false) {
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


                //Getione postingDateTime - inizio
                const date = new Date(oData.postingDateTime);
                const postingDateTime = new Date(
                    date.toLocaleString("sv-SE", { timeZone: "Europe/Rome" }));
                //const postingDateTimeString = postingDateTime.toISOString();

                function toISOInTimeZone(dateLike, timeZone = "Europe/Rome") {
                    const date = new Date(dateLike);

                    // Prendo i componenti locali del fuso desiderato
                    const parts = new Intl.DateTimeFormat("sv-SE", {
                        timeZone,
                        year: "numeric",
                        month: "2-digit",
                        day: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: false,
                    }).format(date); // "YYYY-MM-DD HH:mm:ss"

                    // Millisecondi (se supportato)
                    const ms = date.getMilliseconds().toString().padStart(3, "0");

                    // Offset del fuso (es. "GMT+1" o "GMT+2")
                    const tzLabel = new Intl.DateTimeFormat("en-US", {
                        timeZone,
                        timeZoneName: "shortOffset", // -> "GMT+1" o "GMT+2"
                    }).formatToParts(date).find(p => p.type === "timeZoneName")?.value || "GMT+0";

                    // Converto "GMT+1" in "+01:00"
                    const match = tzLabel.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/i);
                    const sign = match ? match[1][0] : "+";
                    const hh = match ? Math.abs(parseInt(match[1], 10)).toString().padStart(2, "0") : "00";
                    const mm = match && match[2] ? match[2] : "00";
                    const offset = `${sign}${hh}:${mm}`;

                    // Assemblaggio ISO locale (senza Z, con offset)
                    const [ymd, hms] = parts.split(" ");
                    return `${ymd}T${hms}.${ms}${offset}`;
                }

                const isoRome = toISOInTimeZone(oData.postingDateTime, "Europe/Rome");
                const postingDateTimeString = isoRome;
                //Getione postingDateTime - fine


                // Post_Quantity_Confirmation payload
                const payload = {
                    plant: (sap.dm.dme.util.PlantSettings).getCurrentPlant(),
                    shopOrder: orderData.order,
                    sfc: orderData.sfc,
                    operationActivity: podSelectionModel.operations[0].operation,
                    workCenter: orderData.workcenter.includes(",") ? podSelectionModel.customData.workcenter : orderData.workcenter,//orderData.workcenter, 
                    yieldQuantity: oData.quantity * (isManual ? oController.getView().getModel("wmModel").getProperty("/scatoleVersate") : (oController.getView().getModel("wmModel").getProperty("/palletscatola") === 0 ? 1 : oController.getView().getModel("wmModel").getProperty("/palletscatola"))),//oData.quantity * (isManual ? oController.getView().getModel("wmModel").getProperty("/scatoleVersate") : (oController.getView().getModel("wmModel").getProperty("/palletscatola") === 0 ? 1 : (oData?.stepQuantity || 1) > 0 ? (oData?.stepQuantity || 1) : oController.getView().getModel("wmModel").getProperty("/palletscatola"))), //oData.quantity,
                    yieldQuantityUnit: orderData.baseInternalUom,
                    // scrapQuantity	[...]
                    // scrapQuantityUnit	[...]
                    // scrapQuantityIsoUnit	[...]
                    // reasonCodeKey	[...]
                    postedBy: oData.postedBy,
                    // batchNumber	[...]
                    storageLocation: oData.storageLocation,
                    postingDateTime: postingDateTimeString// ISO-8601 yyyy-MM-dd'T'HH:mm:ss.SSS'Z', example: 2022-08-31T23:53:34.123Z
                    // finalConfirmation	[...]
                    // checkSchedulingAndOeeRelevant
                };

                const that = this;
                DATENOW_INTEGRATION_MESSAGE_DASHBOARD = new Date();
                //for (var i = 0; i < Number(isManual ? oController.getView().getModel("wmModel").getProperty("/scatoleVersate") : (oController.getView().getModel("wmModel").getProperty("/palletscatola") === 0 ? 1 : oController.getView().getModel("wmModel").getProperty("/palletscatola"))); i++) {
                AjaxUtil.post(
                    sUrl,
                    payload,
                    function (oResponseData) {
                        console.log("POST Quantity Confirmation - Success");
                        that.setScatoleVersate(orderData.workcenter.includes(",") ? podSelectionModel.customData.workcenter : orderData.workcenter);
                    },
                    function (oError, sHttpErrorMessage) {
                        console.log("Errore nel POST Quantity Confirmation:", sHttpErrorMessage, oError);
                        // sap.m.MessageBox.error("Errore nel POST Goods Receipt: " + sHttpErrorMessage);
                    }
                );

                await oController.manageIntegrationMessage(DATENOW_INTEGRATION_MESSAGE_DASHBOARD, QUANTITY_CONFIRMATION_TYPE, !isManual, 0, true);
                //}

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
                    postingDateTime: new Date(oData.postingDateTime).toLocaleString("sv-SE", { timeZone: "Europe/Rome" }), //effettuare il versamento con data di ieri se siamo nel terzo turno?
                    quantity: {
                        value: oData.quantity * (oData.stepQuantity || 1),
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
                DATENOW_INTEGRATION_MESSAGE_DASHBOARD = new Date();

                AjaxUtil.post(
                    sUrl,
                    payload,
                    async function (oResponseData) {
                        console.log("POST Goods Receipt - Success:");
                        if(oResponseData && oResponseData?.lineItems?.[0]?.totalQuantity?.value) UPDATE_QUANTITY_TO_CHECK = oResponseData?.lineItems?.[0]?.totalQuantity?.value;
                        await oController.manageIntegrationMessage(DATENOW_INTEGRATION_MESSAGE_DASHBOARD, GOOD_RECEIPT_TYPE, true, 0, false, resolve);
                        // sap.m.MessageToast.show("Goods Receipt creato con successo!");
                        //resolve(oResponseData);
                    },
                    function (oErrorJson, oErrorMessage, oErrorStatus) {
                        console.log("Errore nel POST Goods Receipt:", oErrorJson);
                        try {
                            if (oErrorMessage && oErrorMessage.length > 0) {
                                sap.m.MessageBox.error(oErrorMessage);
                            }
                        } catch (error) {

                        }
                        // sap.m.MessageBox.error("Errore nel POST Goods Receipt: " + sHttpErrorMessage);
                        //reject(oError);
                        resolve(undefined);
                    }
                );
            });
        },

        onBeforeRenderingPlugin: function () {
            // intercettazione/sottoscrizione eventi
            this.subscribe("UpdateAssemblyStatusEvent", this.handleAssemblyStatusEvent, this);
            this.subscribe("WorklistSelectEvent", this.handleWorklistSelectEvent, this);
            this.subscribe("goodsReceiptSummaryEvent", this._SummaryData, this);
            this.subscribe("orderSelectionEvent", this._SummaryData, this);

            // eventi per start, hold e complete avvenuti con successo
            // successo di Complete o di Hold => disabilitare recordBtn e manualBtn
            // successo di Start => abilitare recordBtn e manualBtn
            this.subscribe("phaseStartEvent", this.handleRecordAndManualClosing, this);
            this.subscribe("phaseCompleteEvent", this.handleRecordAndManualClosing, this);
            this.subscribe("phaseHoldEvent", this.handleRecordAndManualClosing, this);

            // press su Complete
            this.subscribe("phasePressCompleteEvent", this.handlePhaseCompletePress, this);

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
        },

        handleWorklistSelectEvent: function (s, E, oData) {
            this.loadData();

            if (this.isEventFiredByThisPlugin(oData)) {
                return;
            }
            sap.m.MessageBox.information("Number of SFC selected - " + oData.selections.length);
        },

        handleRecordAndManualClosing: function (sChannelId, sEventId, oData) {
            console.log("handleRecordAndManualClosing per l'evento " + sEventId);
            this.setEnabledRecordAndManualClosing(sEventId);

            // hide busy indicator
            if (sEventId === "phaseCompleteEvent") {
                sap.ui.core.BusyIndicator.hide();
            }
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
            this.unsubscribe("phasePressCompleteEvent", this.handlePhaseCompletePress, this);
        },

        getGoodsReceiptData: function () {
            let oSelectedOrderData = oController.getPodSelectionModel().selectedOrderData;
            if (oSelectedOrderData) {
                oController.publish("goodsReceiptSummaryEvent", oSelectedOrderData);
            }
            sap.ui.core.BusyIndicator.hide();
            oController.loadData(UPDATE_QUANTITY_TO_CHECK);
        },

        // setEnabledRecordAndManualClosing: function(sEventId){
        //     try {
        //         let bEnable;
        //         if (sEventId) {
        //             // basandomi sull'evento e NON sullo status resto indipendente dalle tempistiche di refresh del modello del PhaseList plugin
        //             bEnable = (sEventId === "phaseStartEvent");
        //             oController.getView().byId("recordBtn").setEnabled(bEnable);
        //             oController.getView().byId("manualBtn").setEnabled(bEnable);
        //         } else {
        //             const sOrderStatus = oController.getPodSelectionModel().selectedOrderData?.orderExecutionStatus;
        //             const sPhaseStatus = oController.getPodSelectionModel().selectedPhaseData?.status;
        //             bEnable = (sOrderStatus !== 'HOLD') && 
        //                 (sPhaseStatus === 'ACTIVE' || sPhaseStatus === 'IN_WORK');

        //             oController.getView().byId("recordBtn").setEnabled(bEnable);
        //             oController.getView().byId("manualBtn").setEnabled(bEnable);
        //         }

        //     } catch (error) {
        //         oController.getView().byId("recordBtn").setEnabled(true);
        //     }
        // }

        setEnabledRecordAndManualClosing: function (sEventId) {
            try {
                let bEnable;
                if (sEventId) {
                    bEnable = (sEventId === "phaseStartEvent");
                } else {
                    const sOrderStatus = oController.getPodSelectionModel().selectedOrderData?.orderExecutionStatus;
                    const sPhaseStatus = oController.getPodSelectionModel().selectedPhaseData?.status;
                    bEnable = (sOrderStatus !== 'HOLD') &&
                        (sPhaseStatus === 'ACTIVE' || sPhaseStatus === 'IN_WORK');
                }

                // usare enableModel
                const oModel = oController.getView().getModel("enableModel");
                oModel.setProperty("/recordBtnEnabled", bEnable);
                oModel.setProperty("/manualBtnEnabled", bEnable);

                try {
                    oController.getView().byId("manualBtn").setEnabled(bEnable);
                    oController.getView().byId("recordBtn").setEnabled(bEnable);
                } catch (error) {

                }

            } catch (error) {
                console.error("setEnabledRecordAndManualClosing error:", error);
                oModel.setProperty("/recordBtnEnabled", true);
                oModel.setProperty("/manualBtnEnabled", true);

                try {
                    oController.getView().byId("manualBtn").setEnabled(true);
                    oController.getView().byId("recordBtn").setEnabled(true);
                } catch (error) {

                }

            }
        },

        handlePhaseCompletePress: function (sChannelId, sEventId, oData) {
            console.log("handlePhaseCompletePress per l'evento " + sEventId);
            if (_TYPE === "B" && oController.getView().getModel("wmModel").getProperty("/scatoleVersate") > 0) {
                oController.showConfirmBox(oController.getI18nText("boxNotRecorder"), function () { oController.closeAndComplete(oData); });
            } else {
                // mostrare message box di conferma e al click su Conferma avviare la funzione standard del press su Complete button
                oController.showConfirmBox(oController.getI18nText("completeConfirmation"), oData.complete);
            }
        },

        showConfirmBox: function (text, callback) {
            var sConfirm = oController.getI18nText("confirm");
            MessageBox.confirm(text, {
                actions: [sConfirm, oController.getI18nText("cancel")],
                onClose: function (oAction) {
                    if (oAction === sConfirm) {
                        callback();
                    }
                }.bind(oController),
                dependentOn: oController.getView()
            });
        },

        closeAndComplete: function (oData) {
            // richiamare la Chiusura HU manuale e attendere il lancio di tutti i postQtyConfirmation
            oController.onConfermaChiusuraManuale()
                .then(function (res) {
                    // Show busy indicator
                    sap.ui.core.BusyIndicator.show(0);

                    // solo in caso di chiusura con successo attendere 2 minuti e richiamare la funzione standard del press su Complete button
                    setTimeout(function () {
                        oData.complete();
                    }, 120000);
                })
                .catch(function (err) {
                    sap.ui.core.BusyIndicator.hide();
                    console.error("Errore in closeAndComplete:", err);
                })
        },

        onRefresh: async function (oEvent) {
            sap.ui.core.BusyIndicator.show(0);

            const podSelectionModel = this.getPodSelectionModel();
            const orderData = podSelectionModel.selectedOrderData;
            var iCountOld = await Service.getCountInboundDelivery(oController, EWMWarehouse, orderData.order);

            await Service.postInboundDelivery(oController, _TYPE, async function (sType, sMessage, bProceede) {

                oController.getGoodsReceiptData();

                if (sType === "success") {
                    sap.m.MessageToast.show(`Aggiornamento avvenuto con successo`);
                } else {
                    sap.m.MessageBox.error(sMessage);
                }
                // chiamare POST Post_Quantity_Confirmation in base alla configurazione postQtyConfirmation
                if (bProceede) {
                    debugger;
                    await oController.postQtyConfirmation(false);
                    sap.ui.core.BusyIndicator.hide();
                } else {
                    sap.ui.core.BusyIndicator.hide();
                }

            }, false, iCountOld, (_TYPE === "A" ? WarehouseProcessTypeA : WarehouseProcessTypeB), PackagingMaterial);
        },
        onInfo: function (oEvent) {
            var oButton = oEvent.getSource(),
                oView = oController.getView();

            // create popover
            if (!oController._pPopover) {
                oController._pPopover = Fragment.load({
                    id: oView.getId(),
                    name: "altea.dmc.plugin.testPlugin.testPlugin.view.fragments.VersionPopover",
                    controller: oController
                }).then(function (oPopover) {
                    oView.addDependent(oPopover);
                    oPopover.bindElement("/ProductCollection/0");
                    return oPopover;
                });
            }
            oController._pPopover.then(function (oPopover) {
                oPopover.openBy(oButton);
            });
        }
    });
});