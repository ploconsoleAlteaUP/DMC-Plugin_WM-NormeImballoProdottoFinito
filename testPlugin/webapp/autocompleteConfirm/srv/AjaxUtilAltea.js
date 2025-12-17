sap.ui.define([
    "sap/dm/dme/util/PlantSettings",
    "sap/dm/dme/logging/Logging"
], function (PlantSettings, Logging) {
    "use strict";

    const X_CSRF_TOKEN = "X-CSRF-Token";
    const APPLICATION_JSON = "application/json";
    const _oLogger = Logging.getLogger("sap.dm.dme.model.AjaxUtil");
    const CSRF_RETRY_LIMIT = 1;

    /**
     * Returns request header parameter - which language is preferred on a client.
     * @returns {object} plain object with additional request header parameters.
     */
    function getHeaders (sToken) {
        let oHeaders = {
            "Accept-Language": sap.ui.getCore().getConfiguration().getLanguageTag(),
            "x-dme-plant": PlantSettings.getCurrentPlant(),
            "x-dme-industry-type" : PlantSettings.getIndustryType()
        };        
        if (sToken) {
            oHeaders[X_CSRF_TOKEN] = sToken;
        }

        return oHeaders;
    }

    /**
     * Returns request header parameter - which language is preferred on a client.
     * @returns {object} plain object with additional request header parameters.
     */
    function getHeadersETAG (sToken, sETAG) {
        let oHeaders = {
            "Accept-Language": sap.ui.getCore().getConfiguration().getLanguageTag(),
            "x-dme-plant": PlantSettings.getCurrentPlant(),
            "x-dme-industry-type" : PlantSettings.getIndustryType(),
            "If-Match": sETAG
        };        
        if (sToken) {
            oHeaders[X_CSRF_TOKEN] = sToken;
        }

        return oHeaders;
    }

    /**
     * Extracts a part of a backend call URL that will be used to fetch CSRF token.
     * For example /sapdmdmecertification/~280320223224+0000~/dme/plant.svc/Certifications
     * converted into /sapdmdmecertification/
     * @param {string} sUrl - URL of the backend call
     */
    function getTokenUrlFromRequestUrl (sUrl) {
        return sUrl.substring(0, sUrl.indexOf("0001/")+"0001/".length);
    }

    return {
        mTokenDeferred: null,
        _csrfRequestCount : 0, // use this to break out of an infinite loop for re-requesting CSRF tokens.
        /**
         * A method used to re-request CSRF tokens if the first request fails.
         * If more than or equal CSRF_RETRY_LIMIT requests failed then the error is reported to the caller.
         * Use this method to handle 403 and "CSRF required" errors.
         * @param oSettings {object} - request settings
         * @param fnSuccess {function} - success callback function
         * @param fnFailure {function} - failure callback function
         * @param oXhr {object} - XMLHttpRequest object
         * @param sErrorMessage {string} - error message
         * @private
         */
        _processTokenRequired: function (oSettings, fnSuccess, fnFailure, oXhr, sErrorMessage) {
            this.mTokenDeferred = null;
            // check if we have already tried to get the CSRF token once
            if (this._csrfRequestCount >= CSRF_RETRY_LIMIT) {
                // report 403 error to the caller and reset the count of csrf requests
                this._resetCsrfTokenCount();
                fnFailure(oXhr.responseJSON, sErrorMessage, oXhr.status);
            } else {
                // try to get the CSRF token again and increase the counter
                this._csrfRequestCount++;
                this._processModificationRequest(oSettings, fnSuccess, fnFailure);
            }
        },

        _logSettingsData: (oSettings) => {
            let sSettingsData = oSettings.data ? JSON.stringify(oSettings.data).replace(/"/g, "'") : null;
            _oLogger.debug(`processRequest - Method=${oSettings.method} URL=${oSettings.url} Data=${sSettingsData}`);
        },

        /**
         * Resets the CSRF token count to 0.
         * @private
         */
        _resetCsrfTokenCount: function() {
            this._csrfRequestCount = 0;
        },

        /**
         * Logs the error message to the console.
         * @param oXhr {object} - XMLHttpRequest object
         * @param sErrorMessage {string} - error message
         * @private
         */
        _logErrorMessage: (oXhr, sErrorMessage) => {
            const sStringifiedResponseJSON = oXhr.responseJSON ? JSON.stringify(oXhr.responseJSON).replace(/"/g, "'") : "";
            const sErrorResponse = oXhr.responseJSON ? `Response=${sStringifiedResponseJSON}` : "";
            const sHttpStatus = `HTTP Status=${oXhr.status}`;
            const sMessage = `Message=${sErrorMessage}`;
            _oLogger.error(`processRequest Error - ${sErrorResponse} ${sHttpStatus} ${sMessage}`);
        },

        /**
         * Processes the request failure and calls the appropriate callback function.
         * If CSRF token is required, it calls the _processTokenRequired method to fetch the token.
         * @param oXhr {object} - XMLHttpRequest object
         * @param fnSuccess {function} - success callback function
         * @param fnFailure {function} - failure callback function
         * @param oSettings {object} - request settings
         * @param sErrorMessage {string} - error message
         * @private
         */
        _processRequestFailure: function (oXhr, fnSuccess, fnFailure, oSettings, sErrorMessage) {
            const sCsrfToken = oXhr.getResponseHeader(X_CSRF_TOKEN)
            if (oXhr.status === 403 && sCsrfToken?.toLowerCase() === "required") {
                this._processTokenRequired(oSettings, fnSuccess, fnFailure, oXhr, sErrorMessage);
            } else {
                fnFailure(oXhr.responseJSON, sErrorMessage, oXhr.status);
            }

            // Log error message
            this._logErrorMessage(oXhr, sErrorMessage);
        },

        /**
         * Processes the request and calls the appropriate callback function.
         * If CSRF token is not set, then it calls the fnExtractTokenWrapper method to extract the token from the response.
         * @param oRequest {object} - jQuery.ajax object
         * @param fnSuccess {function} - success callback function
         * @param fnFailure {function} - failure callback function
         * @param oSettings {object} - request settings
         */
        processRequest: function (oRequest, fnSuccess, fnFailure, oSettings) {
            this._logSettingsData(oSettings);

            const proxyFnSuccess = this.mTokenDeferred ? fnSuccess : (oData, sStatus, oXhr) => {
                this.extractCsrfToken(oXhr)
                fnSuccess(oData, sStatus, oXhr);
            };
            oRequest
                // Success
                .done(proxyFnSuccess)
                .fail((oXhr, sStatus, sErrorMessage)=> {
                    this._processRequestFailure(oXhr, fnSuccess, fnFailure, oSettings, sErrorMessage);
                });
        },

        fetchCsrfToken: function (sRequestUrl) {
            if (!this.mTokenDeferred) {
                this.mTokenDeferred = jQuery.ajax({
                    url: getTokenUrlFromRequestUrl(sRequestUrl),
                    method: "head",
                    headers: { "X-CSRF-Token": "Fetch" }
                }).then(
                    (oData, sStatus, oXhr) => oXhr.getResponseHeader(X_CSRF_TOKEN),
                    (oXhr) => oXhr.getResponseHeader(X_CSRF_TOKEN)
                );
            }
            return this.mTokenDeferred;
        },

        /**
         * Extracts CSRF token from the response header and resolves the token deferred object.
         * @param oXhr {object} - XMLHttpRequest object
         */
        extractCsrfToken: function (oXhr) {
            const sToken = oXhr.getResponseHeader(X_CSRF_TOKEN);
            if (sToken) {
                this.mTokenDeferred = jQuery.Deferred().resolve(sToken);
            }
        },

        get: function (sRequestContext, vParameters, fnSuccess, fnFailure) {
            let oSettings = {
                method: "get",
                url: sRequestContext,
                contentType: APPLICATION_JSON,
                data: vParameters,
                headers: getHeaders(this.mTokenDeferred ? null : "Fetch")
            };

            this.processRequest(jQuery.ajax(oSettings), fnSuccess, fnFailure, oSettings);
        },

        post: function (sRequestContext, oPayload, fnSuccess, fnFailure, iTimeout) {
            let oSettings = {
                method: "post",
                url: sRequestContext,
                contentType: APPLICATION_JSON,
                data: JSON.stringify(oPayload),
                timeout: iTimeout
            };
            this._processModificationRequest(oSettings, fnSuccess, fnFailure);
        },
        postETAG: function (sEtag, sRequestContext, oPayload, fnSuccess, fnFailure, iTimeout) {
            let oSettings = {
                method: "post",
                url: sRequestContext,
                contentType: APPLICATION_JSON,
                data: JSON.stringify(oPayload),
                timeout: iTimeout
            };
            this._processModificationRequestETAG(oSettings, fnSuccess, fnFailure, sEtag);
        },

        patch: function (sRequestContext, oPayload, fnSuccess, fnFailure, iTimeout) {
            let oSettings = {
                method: "patch",
                url: sRequestContext,
                contentType: APPLICATION_JSON,
                data: JSON.stringify(oPayload),
                timeout: iTimeout
            };
            this._processModificationRequest(oSettings, fnSuccess, fnFailure);
        },

        put: function (sRequestContext, oPayload, fnSuccess, fnFailure) {
            let oSettings = {
                method: "put",
                url: sRequestContext,
                contentType: APPLICATION_JSON,
                data: JSON.stringify(oPayload)
            };
            this._processModificationRequest(oSettings, fnSuccess, fnFailure);
        },

        delete: function (sRequestContext, fnSuccess, fnFailure, oPayload) {
            let oSettings = {
                method: "delete",
                url: sRequestContext,
                contentType: APPLICATION_JSON
            };
            if (oPayload) {
                oSettings.data = JSON.stringify(oPayload);
            }
            this._processModificationRequest(oSettings, fnSuccess, fnFailure);
        },

        /*
         * CSV Upload - Post for Multipart form-data Input
         */
        postMultipart: function (sRequestContext, oFormData, fnSuccess, fnFailure) {
            let oSettings = {
                method: "post",
                url: sRequestContext,
                contentType: false,
                processData: false,
                data: oFormData
            };
            this._processModificationRequest(oSettings, fnSuccess, fnFailure);
        },

        /**
         * Fetches CSRF token, adds header parameters to the request settings and executes Ajax call
         * with given settings and success and failure callback methods.
         * @private
         */
        _processModificationRequest: function (oSettings, fnSuccess, fnFailure) {
            // reset the CSRF Token count when POST/PUT/DELETE/PATCH calls succeed
            const fnSuccessWrapper = (oData, sStatus, oXhr) => {
                this._resetCsrfTokenCount();
                fnSuccess(oData, sStatus, oXhr);
            };
            this.fetchCsrfToken(oSettings.url).always((sToken) => {
                oSettings.headers = getHeaders(sToken);
                this.processRequest(jQuery.ajax(oSettings), fnSuccessWrapper, fnFailure, oSettings);
            });
        },

        /**
         * Fetches CSRF token, adds header parameters to the request settings and executes Ajax call
         * with given settings and success and failure callback methods.
         * @private
         */
        _processModificationRequestETAG: function (oSettings, fnSuccess, fnFailure, sETAG) {
            // reset the CSRF Token count when POST/PUT/DELETE/PATCH calls succeed
            const fnSuccessWrapper = (oData, sStatus, oXhr) => {
                this._resetCsrfTokenCount();
                fnSuccess(oData, sStatus, oXhr);
            };
            debugger;
            this.fetchCsrfToken(oSettings.url).always((sToken) => {
                oSettings.headers = getHeadersETAG(sToken, sETAG);
                this.processRequest(jQuery.ajax(oSettings), fnSuccessWrapper, fnFailure, oSettings);
            });
        },
        
        /***
         * Helper method for qUnit testing.  Returns the header information.
         */
        _getHeaders: function(sToken) {
        	return getHeaders(sToken);
        },

        _getHeadersETAG: function(sToken, ETAG) {
        	return getHeadersETAG(sToken, ETAG);
        }
    };
});
