"use strict";

var Core = require("lapis-core");
var Data = require("lapis-data");
var Under = require("underscore");
var Https = require("https");
var Q = require("q");


module.exports = Core.Base.clone({
    id: "Request",
    status: null,       // "D"efining, "R"equesting, "C"ompleted, "E"rror
                        // D > R > C,   D > E,   D > R > E
});


module.exports.register("beforeRequest");
module.exports.register("successResponse");
module.exports.register("errorResponse");


module.exports.defbind("setupArray", "cloneInstance", function () {
    this.criteria = [];
    this.status = "D";
    this.promise = null;
});


Data.Manager.define("getRequest", function (spec_or_array) {
    var request = module.exports.clone({
        id: "Request",
        instance: true,
        manager: this,
    });
    if (Under.isArray(spec_or_array)) {
        Under.each(spec_or_array, function (item) {
            request.addCriterion(item);
        });
    } else {
        request.addCriterion(spec_or_array);
    }
    return request;
});


module.exports.define("getLoadingPromise", function (record) {
    return this.promise;
});


module.exports.define("addCriterion", function (spec) {
    if (!spec.entity_id) {
        this.throwError("invalid criterion, 'entity_id' required: " + spec);
    }
    if (spec.key && typeof spec.key === "string") {
        spec.record = this.manager.getExistingRecordNotInCache(spec.entity_id, spec.key);
    } else if (!spec.field_id || !spec.value) {
        this.throwError("invalid criterion, 'field_id' and 'value' required: " + spec);
    }
    this.criteria.push(spec);
});


module.exports.define("execute", function () {
    var that = this;
    if (this.status !== "D") {
        this.throwError("invalid status: " + this.status);
    }
    this.debug("before request...");
    this.happen("beforeRequest");
    this.status = "R";
    this.promise = Q.Promise(function (resolve, reject) {
        try {
            Https.get(that.manager.getServerHttpOptions(), function (response) {
                try {
                    that.processResponse(resolve, reject, response);
                    // resolve();
                } catch (error) {
                    that.debug("response seems bad, rejecting...");
                    that.errorResponse(error);
                    reject(error);
                } finally {
                    response.resume();      // consume response data to free up memory
                }
            }).on("error", function (error) {
                that.errorResponse(error);
                reject(error);
            });
        } catch (error) {
            that.errorResponse(error);
            reject(error);
        }
    });
    this.debug("after promise made...");
    return this.promise;
});


module.exports.define("processResponse", function (resolve, reject, response) {
    var that = this;
    var raw_data = "";

    if (this.status !== "R") {
        this.throwError("invalid status: " + this.status);
    }
    if (response.statusCode !== 200) {
        this.throwError("Request Failed. Status Code: " + response.statusCode);
    } else if (!/^application\/json/.test(response.headers["content-type"])) {
        this.throwError("Invalid content-type. Expected application/json but received: " + response.headers["content-type"]);
    }
    this.debug("response seems good, processing...");

    response.setEncoding("utf8");
    response.on("data", function (chunk) {
        raw_data += chunk;
    });
    response.on("end", function () {
        try {
            that.successResponse(raw_data);
            resolve();
        } catch (error) {
            reject(error);
        }
    });
});


module.exports.define("successResponse", function (raw_data) {
    var that = this;
    var parsed_data;
    if (this.status !== "R") {
        this.throwError("invalid status: " + this.status);
    }
    this.status = "C";
    try {
        parsed_data = JSON.parse(raw_data);
        Under.each(parsed_data, function (item) {
            that.manager.getExistingRecordNotInCache(item.entity_id, item.key)
                .populateFromObject(item);
        });
        this.happen("successResponse");
    } catch (error) {
        this.throwError("invalid JSON received: " + error);
    }
});


module.exports.define("errorResponse", function (error) {
    if (this.status !== "R") {
        this.throwError("invalid status: " + this.status);
    }
    this.status = "E";
    this.error(error);
    this.happen("errorResponse");
});

