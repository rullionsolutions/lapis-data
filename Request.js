"use strict";

var Core = require("lapis-core");
var Http = require("http");
var Q = require("q");


module.exports = Core.Base.clone({
    id: "Request",
    status: null,       // "D"efining, "R"equesting, "C"ompleted, "E"rror
                        // D > R > C,   D > E,   D > R > E
});


module.exports.register("beforeRequest");
module.exports.register("successResponse");
module.exports.register("errorResponse");


module.exports.defbind("setupStatus", "cloneInstance", function () {
    this.status = "D";
    this.promise = null;
});


module.exports.define("getPromise", function () {
    return this.promise;
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
        var req;
        var post_data;
        try {
            req = Http.request(that.manager.getServerHttpOptions(), function (response) {
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
            });
            req.on("error", function (error) {
                that.errorResponse(error);
                reject(error);
            });
            post_data = that.getRequestData();
            that.debug("post data: " + post_data);
            req.end(post_data);
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


module.exports.define("errorResponse", function (error) {
    if (this.status !== "R") {
        this.throwError("invalid status: " + this.status);
    }
    this.status = "E";
    this.error(error);
    this.happen("errorResponse");
});

