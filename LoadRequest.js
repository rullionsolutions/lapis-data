"use strict";

var Data = require("lapis-data");
var Under = require("underscore");


module.exports = Data.Request.clone({
    id: "LoadRequest",
});


module.exports.defbind("setupArray", "cloneInstance", function () {
    this.criteria = [];
});


Data.Manager.define("getLoadRequest", function (spec_or_array) {
    var request = module.exports.clone({
        id: "LoadRequest",
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


module.exports.define("addCriterion", function (spec) {
    var record;
    if (!spec.entity_id) {
        this.throwError("invalid criterion, 'entity_id' required: " + spec);
    }
    if (spec.key && typeof spec.key === "string") {
        record = this.manager.getRecordNullIfNotInCache(spec.entity_id, spec.key);
        if (record) {
            this.throwError("cannot request record already in cache: " + spec);
        }
        record = this.manager.getExistingRecordNotInCache(spec.entity_id, spec.key,
            spec.modifiable);
        record.define("request", this);
    } else if (!spec.field_id || !spec.value) {
        this.throwError("invalid criterion, 'field_id' and 'value' required: " + spec);
    }
    this.criteria.push(spec);
});


module.exports.define("getRequestData", function () {
    return JSON.stringify(this.criteria);
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
            that.manager.getRecord(item.entity_id, item.key)
                .load(item);
        });
        this.happen("successResponse");
    } catch (error) {
        this.throwError("invalid JSON received: " + error);
    }
});

