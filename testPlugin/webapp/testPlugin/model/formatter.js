// webapp/formatter/Formatter.js
sap.ui.define([], function () {
    "use strict";
    return {
        formatQuantityWithUnit: function (quantity, unit) {
            debugger;
            if (!quantity) return "";
            const formattedQty = parseFloat(quantity).toLocaleString(undefined, {
                minimumFractionDigits: 3,
                maximumFractionDigits: 3
            });
            return unit ? `${formattedQty} ${unit}` : formattedQty;
        }
    };
  });