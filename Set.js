"use strict";

var Core = require("lapis-core");
var Under = require("underscore");


module.exports = Core.Base.clone({
    id: "Set",
});


module.exports.register("recordAdded");
module.exports.register("recordRemoved");


module.exports.defbind("setupArray", "cloneInstance", function () {
    this.records = [];
});


module.exports.define("containsRecord", function (record) {
    this.throwIfNotActive();
    return (this.records.indexOf(record) > -1);
});


module.exports.define("eachRecord", function (funct) {
    this.throwIfNotActive();
    Under.each(this.records, funct);
});


module.exports.define("addRecord", function (record) {
    this.throwIfNotActive();
    if (this.containsRecord(record)) {
        this.throwError("record already exists in this Set: " + record);
    }
    this.records.push(record);
    this.happen("recordAdded", {
        record: record,
    });
});


module.exports.define("removeRecord", function (record) {
    this.throwIfNotActive();
    if (!this.containsRecord(record)) {
        this.throwError("record doesn't exists in this Set: " + record);
    }
    this.records.splice(this.records.indexOf(record), 1);
    this.happen("recordRemoved", {
        record: record,
    });
});
