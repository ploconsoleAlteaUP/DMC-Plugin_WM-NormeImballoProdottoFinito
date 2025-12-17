sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/dm/dme/model/AjaxUtil",
    "./AjaxUtilAltea"
], function (JSONModel, AjaxUtil, AjaxUtilAltea) {
    "use strict";

    const DEST_ODATA_V2 = "/destination/S4H_ODATA_INTEGRATION",
        DEST_ODATA_V4_POST = "/destination4/S4H_ODATA_INTEGRATION_ODATA4",
        DEST_ODATA_V4 = "/destination/S4H_ODATA_INTEGRATION_ODATA4_GET",
        DEST_DMC = "/destination/S4H_DMC_API",
        DEST_CAP = "/destination/S4H_CAP_SERVICES_EWM"; //

    return {

        getWorkcenter: async function (oView, sPlant, sSFC, sRouterID) {
            const sUrl = `${DEST_DMC}/sfc/v1/sfcdetail`;
            const oParameters = {
                plant: sPlant,
                sfc: sSFC
            };

            const returned = await new Promise((resolve, reject) => {
                AjaxUtil.get(sUrl, oParameters, (oResponseData) => {
                    //const details = oResponseData?.details;
                    const results = oResponseData.steps.filter(a => a.stepRouting.routing === sRouterID);
                    if (!!!!results && results.length > 0) {
                        resolve(results[0].resource || results[0].plannedWorkCenter);

                        oView.getModel("wmModel").getProperty("/lineItems")[0]["workcenter"] = results[0].resource === null ? results[0].plannedWorkCenter : results[0].resource;
                    } else {
                        resolve(null)
                    }

                }, (oError, sHttpErrorMessage) => {
                    console.error("getWorkcenter:", sHttpErrorMessage);
                    reject(null);
                });
            });

            return returned;

        },

        test() {
            const sUrlMetadata = `${DEST_CAP}/$metadata`;
            const sUrl = `${DEST_CAP}/test`;

            jQuery.ajax({
                url: sUrlMetadata,
                method: "GET",
                headers: {
                    "Accept": "application/json"
                },
                success: function (oData) {
                    //aggiornare view e mostrare il messaggio di success

                },
                error: function (oError) {
                    //Mostrare errore

                }
            });

            jQuery.ajax({
                url: sUrl,
                method: "GET",
                headers: {
                    "Accept": "application/json"
                },
                success: function (oData) {
                    //aggiornare view e mostrare il messaggio di success

                },
                error: function (oError) {
                    //Mostrare errore

                }
            });
        },
        //EWMWarehouse eq '2350' and ManufacturingOrder eq '1000221' 
        // and GoodsReceiptStatus eq '1' and GoodsMovementBin eq '750-111'
        getInboundDelivery: async function (oView, EWMWarehouse, sOrder, sWorkCenter) {
            //Conviene inserire un wait di 1s
            await new Promise(resolve => setTimeout(resolve, 1000));

            //Dopo aver atteso 1s faccio la chiamata
            const sUrl = `${DEST_ODATA_V4}/api_whse_inb_delivery_2/srvd_a2x/sap/warehouseinbounddelivery/0001/WhseInboundDeliveryItem`;
            /*const oParameters = {
                EWMWarehouse: EWMWarehouse,
                ManufacturingOrder: sOrder,
                GoodsReceiptStatus: "1",
                GoodsMovementBin: sWorkCenter
            };*/
            const sFilters = `?$filter=EWMWarehouse eq '${EWMWarehouse}' and ManufacturingOrder eq '${sOrder}' and GoodsReceiptStatus eq '1'  and GoodsMovementBin eq '${sWorkCenter}'&$orderby=EWMDelivLastChangeUTCDateTime desc`

            return await new Promise((resolve, reject) => {
                AjaxUtil.get(sUrl + sFilters, undefined, (oResponseData) => {

                    const details = oResponseData?.value;
                    /*const results = oResponseData.steps.filter(a => a.stepRouting.routing === sRouterID);*/
                    if (!!!!details && details.length > 0) {
                        resolve(details);
                    }

                }, (oError, sHttpErrorMessage) => {
                    //console.error("getWorkcenter:", sHttpErrorMessage);
                    reject("");
                });
            });
        },

        //EWMWarehouse eq '2350' and ManufacturingOrder eq '1000221' 
        // and GoodsReceiptStatus eq '1' and GoodsMovementBin eq '750-111'
        getCountInboundDelivery: async function (oView, EWMWarehouse, sOrder) {

            const sUrl = `${DEST_ODATA_V4}/api_whse_inb_delivery_2/srvd_a2x/sap/warehouseinbounddelivery/0001/WhseInboundDeliveryItem`;

            const sFilters = `$filter=EWMWarehouse eq '${EWMWarehouse}' and ManufacturingOrder eq '${sOrder}' and GoodsReceiptStatus eq '1'&$count=true`;
            return await new Promise((resolve, reject) => {
                AjaxUtil.get(`${sUrl}?${sFilters}`, undefined, (oResponseData) => {

                    const details = oResponseData?.value;
                    /*const results = oResponseData.steps.filter(a => a.stepRouting.routing === sRouterID);*/
                    if (!!!!details) {
                        resolve(details.length);
                    } else {
                        resolve(0);
                    }

                }, (oError, sHttpErrorMessage) => {
                    //console.error("getWorkcenter:", sHttpErrorMessage);
                    reject("");
                });
            });
        },

        getMetadata: function () {
            const sUrl = `${DEST_CAP}/$metadata`;
            AjaxUtil.get(sUrl, undefined, function (oData) {
                //aggiornare view e mostrare il messaggio di success

            },
                function (oError) {
                    //Mostrare errore

                });
        },

        postInboundDelivery: async function (oController, sType, sFunction, isManual = false, iCountOld, WarehouseProcessType) {
            const sUrl = `${DEST_CAP}/WMInboundDelivery`;
            if (sType === "A") {

                const podSelectionModel = oController.getPodSelectionModel();
                const orderData = podSelectionModel.selectedOrderData;

                const payload = {
                    "EWMWarehouse": oController.getConfiguration().EWMWarehouse,
                    "ManufacturingOrder": orderData.order,
                    "Type": "A",
                    "PackagingMaterial": oController.getView().getModel("wmModel").getProperty("/packingMaterial") || "",
                    "CountOld": `${iCountOld}`
                };

                AjaxUtil.post(sUrl, payload, async function (oData) {
                    //aggiornare view e mostrare il messaggio di success

                    if (!!!!sFunction) {
                        await sFunction("success", "", oData.proceed);
                    }
                },
                    async function (oError) {
                        //Mostrare errore

                        if (!!!!sFunction) {
                            await sFunction("error", "Si è verificato un errore nel versamento.\nContattare un responsabile");
                        }
                    });

            } else {

                //controllo se abbiamo raggiunto il numero scatola per pallet
                const sScatolaPerPallet = oController.oView.getModel("wmModel").getProperty("/palletscatola");
                //const sScatoleVersate = oController.getModel("wmModel").getProperty("/scatoleVersate");

                const stepQuantity = oController.oView.getModel("wmModel").getProperty("/selectedItem/stepQuantity");

                //if (!!!!sScatoleVersate && sScatoleVersate > 0) {
                //if (sScatoleVersate == sScatolaPerPallet) {
                const podSelectionModel = oController.getPodSelectionModel();
                const orderData = podSelectionModel.selectedOrderData;

                const payload = {
                    "EWMWarehouse": oController.getConfiguration().EWMWarehouse,
                    "ManufacturingOrder": orderData.order,
                    "Type": "B",
                    "Material": orderData?.material?.material,
                    "StorageBin": orderData?.workcenter,
                    "Pallet": sScatolaPerPallet,
                    "Manuale": isManual,
                    "PackagingMaterial": oController.getView().getModel("wmModel").getProperty("/packingMaterial") || "",
                    "CountOld": `${iCountOld}`,
                    //"StepQuantity": stepQuantity,
                    "WarehouseProcessType": WarehouseProcessType
                };


                AjaxUtil.post(sUrl, payload, function (oData) {
                    //aggiornare view e mostrare il messaggio di success

                    if (!!!!sFunction) {
                        if (oData.status === "success") {
                            sFunction("success", "", oData.proceed);
                        } else if (oData.status === "error") {
                            sFunction("error", oData.message);
                        }

                    }
                },
                    function (oError) {
                        //Mostrare errore

                        if (!!!!sFunction) {
                            sFunction("error", "Si è verificato un errore nel versamento.\nContattare un responsabile");
                        }
                    });

                //}
                //}

            }

        },

        checkNesting: async function (oView, sMaterial, sWorkcenter, EWMWarehouse) {
            ///sap/opu/odata4/sap/api_whse_availablestock/srvd_a2x/sap/warehouseavailablestock/0001/WarehouseAvailableStock?$filter=EWMWarehouse eq '2350' and EWMStorageBin eq '750-111' and Product eq 'G10079A0IML0179'
            const sUrl = `${DEST_ODATA_V4}/api_whse_availablestock/srvd_a2x/sap/warehouseavailablestock/0001/WarehouseAvailableStock`;
            /*const oParameters = {
                EWMWarehouse: EWMWarehouse,
                EWMStorageBin: sWorkcenter,
                Product: sMaterial
            };*/
            const oParameters = {};
            const sFilter = `$filter=EWMWarehouse eq '${EWMWarehouse}' and EWMStorageBin eq '${sWorkcenter}' and Product eq '${sMaterial}' and EWMHUHasOpenWarehouseTask eq false`;



            //controllo il numero di scatole versate in base alle righe che restituisce il servizio
            const aScatole = await new Promise((resolve, reject) => {
                AjaxUtil.get(`${sUrl}?${sFilter}`, oParameters, (oResponseData) => {
                    const aValues = oResponseData?.value;
                    if (!!!!aValues && aValues.length > 0) {
                        resolve(aValues.length);
                    } else {
                        resolve(0);
                    }

                }, (oError, sHttpErrorMessage) => {
                    //console.error("getWorkcenter:", sHttpErrorMessage);
                    resolve(0);
                });
            });

            return aScatole;
        },

        // {{api_test}}/user/v1/users?plant=PLE1&email=fcimatti@alteanet.it
        getUserBadge: async function (oView, sPlant, email) {
            const sUrl = `${DEST_DMC}/user/v1/users`;
            const oParameters = {
                plant: sPlant,
                email: email
            };

            return await new Promise((resolve, reject) => {
                AjaxUtil.get(sUrl, oParameters, (oResponseData) => {
                    const badgeNumber = oResponseData?.badgeNumber;
                    if (badgeNumber) {
                        resolve(badgeNumber || badgeNumber);
                        oView.getModel("wmModel").setProperty("/userBadge", badgeNumber);
                    } else {
                        resolve(email)
                    }
                }, (oError, sHttpErrorMessage) => {
                    console.error("getUserBadge:", sHttpErrorMessage);
                    reject(null);
                });
            });
        },

        loadAllData: async function (sPlant, fCompleted, oProgress) {
            let aAllResults = [];
            let iPage = 0;
            let bLast = false;

            oProgress.setText("0% - Caricamento...");

            while (!bLast) {
                const oResponse = await this._loadPage(iPage, sPlant);

                // qui dipende dal campo reale che contiene i dati
                // suppongo sia "content"
                if (Array.isArray(oResponse.content)) {
                    aAllResults = aAllResults.concat(oResponse.content);
                }

                let totPages = oResponse.totalPages;

                bLast = oResponse.last === true;
                iPage++;

                oProgress.setText(`${Math.floor((100 * iPage) / totPages)}% - Caricamento...`);
            }

            fCompleted(aAllResults);

            return aAllResults;
        },

        _loadPage: function (iPage, sPlant) {
            const sUrl = `${DEST_DMC}/material/v2/materials?plant=${sPlant}&page=${iPage}`;

            return new Promise((resolve, reject) => {
                AjaxUtil.get(
                    sUrl,
                    undefined,
                    (oResponseData) => {
                        resolve(oResponseData);
                    },
                    (oError, sHttpErrorMessage) => {
                        reject(sHttpErrorMessage || oError);
                    }
                );
            });
        },

        autocomplete: async function (oController, fCompleted, oProgress) {
            const sUrl = `${DEST_DMC}/material/v1/materials`;

            let aPayload = oController
                .getView()
                .getModel("toModModel")
                .getProperty("/daModificare");

            const iTotal = aPayload.length;
            let iProcessed = 0;

            oProgress.setText("0% - Modifica attributo isAutocompleteAndConfirmed..");

            for (const oItem of aPayload) {
                oItem.isAutocompleteAndConfirmed = false;

                await this._patchSingleItem(sUrl, oItem);

                iProcessed++;

                oProgress.setText(
                    `${Math.floor((100 * iProcessed) / iTotal)}% - Modifica attributo isAutocompleteAndConfirmed..`
                );
            }

            oProgress.setText("100% - Completato");

            if (typeof fCompleted === "function") {
                fCompleted("success", aPayload);
            }
        },

        _patchSingleItem: function (sUrl, oItem) {
            return new Promise((resolve, reject) => {
                AjaxUtil.patch(
                    sUrl,
                    [oItem],
                    function (oData) {
                        resolve(oData);
                    },
                    function (oError) {
                        reject(oError);
                    }
                );
            });
        },


    };
});