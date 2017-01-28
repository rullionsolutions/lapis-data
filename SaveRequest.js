"use strict";

var Data = require("lapis-data");
var Under = require("underscore");


module.exports = Data.Request.clone({
    id: "SaveRequest",
});


module.exports.defbind("setupArray", "cloneInstance", function () {
    this.records = [];
});


Data.Manager.define("getSaveRequest", function (record_or_array) {
    var request = module.exports.clone({
        id: "SaveRequest",
        instance: true,
        manager: this,
    });
    if (Under.isArray(record_or_array)) {
        Under.each(record_or_array, function (item) {
            request.addRecord(item);
        });
    } else {
        request.addRecord(record_or_array);
    }
    return request;
});


module.exports.define("addRecord", function (record) {
    if (!record.isValid() || !record.isModified()) {
        this.throwError("record not valid or not modified: " + record);
    }
    this.records.push(record);
});


module.exports.define("getRequestData", function () {
    return JSON.stringify(this.records);
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
            that.manager.getRecord(item.entity_id, item.key).load(item);
        });
        this.happen("successResponse");
    } catch (error) {
        this.throwError("invalid JSON received: " + error);
    }
});
