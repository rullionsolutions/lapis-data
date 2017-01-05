"use strict";

var Data = require("lapis-data");
var Under = require("underscore");


module.exports = Data.Set.clone({
    id: "SetConditional",
});


Data.Manager.defbind("setupConditionalSet", "cloneInstance", function () {
    this.define("conditional_sets", []);
});


module.exports.defbind("setupManager", "cloneInstance", function () {
    this.criteria = [];
    if (!this.manager) {
        this.throwError("not associated with a DataManager");
    }
    this.manager.conditional_sets.push(this);
});


Data.Entity.defbind("checkForSetChange", "afterFieldChange", function () {
    this.manager.checkConditionalSetRecord(this);
});


Data.Manager.define("checkConditionalSet", function () {
    var that = this;
    function checkRecord(record) {
        that.checkConditionalSetRecord(record);
    }
    this.doFullKeyRecords(checkRecord);
    this.doPartialKeyRecords(checkRecord);
});


Data.Manager.define("checkConditionalSetRecord", function (record) {
    Under.each(this.conditional_sets, function (set) {
        set.checkRecord(record);
    });
});


module.exports.define("checkRecord", function (record) {
    var that = this;
    var incl = true;
    var currently_contained = this.containsRecord(record);

    this.criteria.each(function (criterion) {           // criteria currently ANDed together
        incl = incl && that.doesRecordMatchCriterion(record, criterion);
    });

    if (incl && !currently_contained) {
        this.addRecord(record);
    } else if (!incl && currently_contained) {
        this.removeRecord(record);
    }
    this.debug("checking whether record " + record + " is joining or leaving DataSet " + this +
        "; was contained? " + currently_contained + ", will be? " + incl);
});


module.exports.define("doesRecordMatchCriterion", function (record, criterion) {
    var incl = false;
    var value;

    if (typeof criterion.entity_id === "string") {
        incl = (criterion.entity_id === record.parent.id);
    } else if (Array.isArray(criterion.entity_id)) {
        incl = (criterion.entity_id.indexOf(record.parent.id) > -1);
    } else if (criterion.field_id && criterion.value) {
                                    // throws exception if field_id doesn't exist in record
        value = record.getField(criterion.field_id).get();
        if (!criterion.operator || criterion.operator === "=" || criterion.operator === "EQ") {
            incl = (value === criterion.value);
        } else {
            this.throwError("unsupported operator: " + criterion.operator);
        }
    }
    return incl;
});
