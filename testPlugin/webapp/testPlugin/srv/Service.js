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
                        debugger;
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
                    debugger;
                },
                error: function (oError) {
                    //Mostrare errore
                    debugger;
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
                    debugger;
                },
                error: function (oError) {
                    //Mostrare errore
                    debugger;
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
                    debugger;
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

        getMetadata: function () {
            const sUrl = `${DEST_CAP}/$metadata`;
            AjaxUtil.get(sUrl, undefined, function (oData) {
                //aggiornare view e mostrare il messaggio di success
                debugger;
            },
            function (oError) {
                //Mostrare errore
                debugger;
            });
        },

        postInboundDelivery: async function (oController, sType, sFunction, isManual=false) {
            const sUrl = `${DEST_CAP}/WMInboundDelivery`;
            if (sType === "A") {

                const podSelectionModel = oController.getPodSelectionModel();
                const orderData = podSelectionModel.selectedOrderData;

                const payload = {
                    "EWMWarehouse": oController.getConfiguration().EWMWarehouse,
                    "ManufacturingOrder": orderData.order,
                    "Type": "A",
                    "PackagingMaterial": oController.getView().getModel("wmModel").getProperty("/packingMaterial") || ""
                };

                AjaxUtil.post(sUrl, payload, function (oData) {
                    //aggiornare view e mostrare il messaggio di success
                    debugger;
                    if (!!!!sFunction) {
                        sFunction("success", "");
                    }
                },
                    function (oError) {
                        //Mostrare errore
                        debugger;
                        if (!!!!sFunction) {
                            sFunction("error", "Si è verificato un errore nel versamento.\nContattare un responsabile");
                        }
                    });

            } else {

                //controllo se abbiamo raggiunto il numero scatola per pallet
                const sScatolaPerPallet = oController.oView.getModel("wmModel").getProperty("/palletscatola");
                //const sScatoleVersate = oController.getModel("wmModel").getProperty("/scatoleVersate");

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
                    "PackagingMaterial": oController.getView().getModel("wmModel").getProperty("/packingMaterial") || ""
                };


                AjaxUtil.post(sUrl, payload, function (oData) {
                    //aggiornare view e mostrare il messaggio di success
                    debugger;
                    if (!!!!sFunction) {
                        if (oData.status === "success") {
                            sFunction("success", "");
                        } else if (oData.status === "error") {
                            sFunction("error", oData.message);
                        }

                    }
                },
                    function (oError) {
                        //Mostrare errore
                        debugger;
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
        }

    };
});