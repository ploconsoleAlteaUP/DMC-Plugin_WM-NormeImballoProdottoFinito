sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/dm/dme/model/AjaxUtil",
    "./AjaxUtilAltea"
], function (JSONModel, AjaxUtil, AjaxUtilAltea) {
    "use strict";

    const DEST_ODATA_V2 = "/destination/S4H_ODATA_INTEGRATION",
        DEST_ODATA_V4_POST = "/destination4/S4H_ODATA_INTEGRATION_ODATA4",
        DEST_ODATA_V4 = "/destination/S4H_ODATA_INTEGRATION_ODATA4_GET",
        DEST_DMC = "/destination/S4H_DMC_API";

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
                        resolve(results[0].resource);
                        debugger;
                        oView.getModel("wmModel").getProperty("/selectedItem")["workcenter"] = results[0].resource === null ? results[0].plannedWorkCenter : results[0].resource;
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

        _getETAG: async function (sUrl) {
            // 1️⃣ Ottieni l’ETag via GET
            const oGetResponse = await new Promise((resolve, reject) => {
                AjaxUtil.get(
                    sUrl,
                    {},
                    (oData, _status, oXhr) => resolve({ data: oData, xhr: oXhr }),
                    (oError, sHttpErrorMessage) => {
                        console.error("Errore GET InboundDelivery:", sHttpErrorMessage);
                        reject(sHttpErrorMessage);
                    }
                );
            });

            const sEtag = oGetResponse.xhr.getResponseHeader("ETag");
            let sToken = null;

            // 2️⃣ HEAD per ottenere il token (con xhr accessibile)
            const sTokenUrl = sUrl.substring(0, sUrl.indexOf("0001/") + "0001/".length);
            sToken = await new Promise((resolve) => {
                $.ajax({
                    url: sTokenUrl,
                    type: "HEAD",
                    headers: { "X-CSRF-Token": "Fetch" },
                    complete: function (xhr) {
                        const token = xhr.getResponseHeader("X-CSRF-Token");
                        resolve(token || null);
                    },
                    error: function () {
                        console.warn("HEAD CSRF fetch fallita, provo fallback GET...");
                        resolve(null);
                    }
                });
            });

            // 3️⃣ fallback se il token non è arrivato
            if (!sToken) {
                try {
                    sToken = await AjaxUtil.fetchCsrfToken(sUrl);
                } catch (e) {
                    console.error("Errore fetchCsrfToken:", e);
                }
            }

            if (!sEtag && !sToken) {
                throw new Error("ETag o token CSRF non trovati nella risposta");
            }

            return { etag: sEtag, token: sToken };
        },


        postInboundDelivery: async function (oController, sInboundDelivery) {
            debugger;
            const oModel = oController.getView().getModel("inboundDelivery");
            const sPath = `/WhseInboundDeliveryHead('${sInboundDelivery}')/SAP__self.PostGoodsReceipt`;

            try {

                const oAction = oModel.bindContext(sPath, null, {
                    $$groupId: "myGroupId"
                });

                await oAction.execute();
                await oModel.submitBatch("myGroupId");

                sap.m.MessageToast.show("Post Goods Receipt eseguito con successo");
            } catch (oError) {
                console.error("Errore POST:", oError);
                sap.m.MessageToast.show("Errore nel POST: " + oError.message);
            }

            try {
                const oAction = oModel.bindContext(`/WhseInboundDeliveryHead('${sInboundDelivery}')/SAP__self.PostGoodsReceipt`);
                await oAction.execute();
                sap.m.MessageToast.show("Post Goods Receipt eseguito con successo 2");
            } catch (oError) {
                console.error("Errore POST 2:", oError);
                sap.m.MessageToast.show("Errore nel POST 2: " + oError.message);
            }
        },

        checkNesting: async function (oView, sMaterial, sWorkcenter, EWMWarehouse) {
            ///sap/opu/odata4/sap/api_whse_availablestock/srvd_a2x/sap/warehouseavailablestock/0001/WarehouseAvailableStock?$filter=EWMWarehouse eq '2350' and EWMStorageBin eq '750-111' and Product eq 'G10079A0IML0179'
            const sUrl = `${DEST_ODATA_V4}/api_whse_availablestock/srvd_a2x/sap/warehouseavailablestock/0001/WarehouseAvailableStock`;
            const oParameters = {
                EWMWarehouse: EWMWarehouse,
                EWMStorageBin: sWorkcenter,
                Product: sMaterial
            };

            //controllo il numero di scatole versate in base alle righe che restituisce il servizio
            const aScatole = await new Promise((resolve, reject) => {
                AjaxUtil.get(sUrl, oParameters, (oResponseData) => {
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

            //controllo se abbiamo raggiunto il numero scatola per pallet
            const sScatolaPerPallet = oView.getModel("wmModel").getProperty("/palletscatola");

            if (!!!!aScatole && aScatole > 0) {
                if (aScatole == sScatolaPerPallet) {
                    //eseguo annidamento
                    //eseguo creazione task
                }
            }

        },

        createNesting: async function (oView, sPlant) { },

        createTask: async function (oView, sPlant, sEWMDelivery, sEWMDeliveryItem) { },

    };
});