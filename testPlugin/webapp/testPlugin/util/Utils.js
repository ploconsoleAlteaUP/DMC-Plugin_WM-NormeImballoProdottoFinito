sap.ui.define([
    "sap/m/MessageBox"
], function (MessageBox) {
    "use strict";
    return {
        onShowTextErrorWithAutomaticClose: function (oContext, sTitle, sMessage, sMessageDetail, iSeconds = 5, fCloseFunction) {

            var sBoxId = "messageBoxId1";
            var oView = oContext.getView();

            var oInterval;
            var oTimeout;

            MessageBox.error(sMessage, {
                id: sBoxId,
                title: sTitle,
                details: sMessageDetail,
                contentWidth: "100px",
                styleClass: "sapUiResponsivePadding--header sapUiResponsivePadding--content sapUiResponsivePadding--footer",
                dependentOn: oView,

                actions: [MessageBox.Action.OK],

                onClose: function () {
                    clearInterval(oInterval);
                    clearTimeout(oTimeout);

                    if (fCloseFunction && fCloseFunction !== undefined) {
                        fCloseFunction();
                    }
                }
            });

            // Attendi che il MessageBox sia renderizzato
            setTimeout(function () {
                var oDialog = sap.ui.getCore().byId(sBoxId);
                if (!oDialog) {
                    return;
                }

                var oOkButton = oDialog.getButtons()[0];

                // Testo iniziale
                oOkButton.setText(MessageBox.Action.OK + " (" + iSeconds + ")");

                // Countdown visivo
                oInterval = setInterval(function () {
                    iSeconds--;
                    if (iSeconds > 0) {
                        oOkButton.setText(MessageBox.Action.OK + " (" + iSeconds + ")");
                    }
                }, 1000);

                // Autofire OK
                oTimeout = setTimeout(function () {
                    if (oDialog.isOpen()) {

                        if (fCloseFunction && fCloseFunction !== undefined) {
                            fCloseFunction();
                        }
                        oDialog.close();
                    }
                }, iSeconds * 1000);

            }, 0);
        }
    }


});