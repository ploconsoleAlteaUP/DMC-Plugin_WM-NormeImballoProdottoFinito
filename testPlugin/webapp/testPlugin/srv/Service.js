sap.ui.define([
    "sap/ui/model/json/JSONModel",
    "sap/dm/dme/model/AjaxUtil"
], function (JSONModel, AjaxUtil) {
    "use strict";

    const DEST_ODATA_V2 = "/destination/S4H_ODATA_INTEGRATION",
        DEST_ODATA_V4 = "/destination/S4H_ODATA_INTEGRATION_ODATA4",
        DEST_DMC = "/destination/S4H_DMC_API";
    return {

        getWorkcenter: async function (sPlant, sSFC, sRouterID) {
            const sUrl = `${DEST_DMC}/sfc/v1/sfcdetail`;
            const oParameters = {
                plant: sPlant,
                sfc: sSFC
            };

            return await new Promise((resolve, reject) => {
                AjaxUtil.get(sUrl, oParameters, (oResponseData) => {
                    //const details = oResponseData?.details;
                    const results = oResponseData.steps.filter(a => a.stepRouting.routing === sRouterID);
                    if (!!!!results && results.length > 0) {
                        resolve(results[0].resource);
                    }

                }, (oError, sHttpErrorMessage) => {
                    console.error("getWorkcenter:", sHttpErrorMessage);
                    reject("");
                });
            });

        },

        //EWMWarehouse eq '2350' and ManufacturingOrder eq '1000221' 
        // and GoodsReceiptStatus eq '1' and GoodsMovementBin eq '750-111'
        getInboundDelivery: async function (sPlant, sOrder, sWorkCenter) {
            const sUrl = `${DEST_ODATA_V4}/api_whse_inb_delivery_2/srvd_a2x/sap/warehouseinbounddelivery/0001/WhseInboundDeliveryItem`;
            const oParameters = {
                EWMWarehouse: sPlant,
                ManufacturingOrder: sOrder,
                GoodsReceiptStatus: "1",
                GoodsMovementBin: sWorkCenter
            };

            return await new Promise((resolve, reject) => {
                AjaxUtil.get(sUrl, oParameters, (oResponseData) => {
                    //const details = oResponseData?.details;
                    const results = oResponseData.steps.filter(a => a.stepRouting.routing === sRouterID);
                    if (!!!!results && results.length > 0) {
                        resolve(results[0].resource);
                    }

                }, (oError, sHttpErrorMessage) => {
                    console.error("getWorkcenter:", sHttpErrorMessage);
                    reject("");
                });
            });
        }

    };
});