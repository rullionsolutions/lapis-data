"use strict";

var Core = require("lapis-core");
var Data = require("lapis-data");
var Under = require("underscore");

/**
* To manage a set of records, ensuring ACID compliance
*/
module.exports = Core.Base.clone({
    id: "Manager",
    curr_records: null,            // full key records
    new_records: null,            // partial key records
});


module.exports.defbind("setupInstance", "cloneInstance", function () {
    this.curr_records = {};            // full key records
    this.new_records = [];            // partial key records
});


module.exports.define("getRecordNullIfNotInCache", function (entity_id, key) {
    Data.Entity.getEntityThrowIfNotFound(entity_id);
    if (!this.curr_records[entity_id]) {
        return null;
    }
    return this.curr_records[entity_id][key];
});


module.exports.define("getRecordThrowIfNotInCache", function (entity_id, key) {
    var record = this.getRecordNullIfNotInCache(entity_id, key);
    if (!record) {
        this.throwError("record not found with entity id: " + entity_id + " and key: " + key);
    }
    return record;
});


module.exports.define("getRecord", function (entity_id, key) {
    var record = this.getRecordNullIfNotInCache(entity_id, key);
    if (!record) {
        record = this.getExistingRecordNotInCache(entity_id, key);
    }
    return record;
});


module.exports.define("getExistingRecordNotInCache", function (entity_id, key, modifiable_once_loaded) {
    var record;
    if (this.getRecordNullIfNotInCache(entity_id, key)) {
        this.throwError("record already exists with entity id: " + entity_id + " and key: " + key);
    }
    record = Data.Entity.getEntityThrowIfNotFound(entity_id).getRecord({
        manager: this,
        status: "L",
        modifiable_once_loaded: modifiable_once_loaded,
        load_key: key,
    });
    // record.populateFromObject(values);
    this.addToCache(record);
    // record.getReadyPromise();
    return record;
});

/*
module.exports.define("getLoadingPromise", function (record) {
    this.throwError("not implemented");
});


module.exports.define("getSavingPromise", function (record) {
    this.throwError("not implemented");
});
*/

module.exports.define("createNewRecord", function (entity_id) {
    return Data.Entity.getEntityThrowIfNotFound(entity_id).createNewRecord(this);
});


module.exports.define("doFullKeyRecords", function (funct) {
    Under.each(this.curr_records, function (curr_records) {
        Under.each(curr_records, function (curr_record) {
            funct(curr_record);
        });
    });
});


module.exports.define("doPartialKeyRecords", function (funct) {
                    // avoid mutations in new_records during execution
    var temp_records = this.new_records.slice(0);
    temp_records.forEach(funct);
});


module.exports.define("addToCache", function (record, prev_key) {
    var entity_id = record.id;
    var key = record.load_key || record.getFullKey();
    var index;

    if (this.curr_records[entity_id] && this.curr_records[entity_id][key]) {
        if (this.curr_records[entity_id][key] === record) {
            this.throwError("record is already present in cache with correct entity_id and key: " + entity_id + ":" + key);
        }
        this.throwError("id already present in cache: " + entity_id + ":" + key);
    }
    index = this.new_records.indexOf(record);
    if (index > -1) {
        this.new_records.splice(index, 1);      // Remove record from new_records
        this.debug("Removing record from new_records cache: " + entity_id + ":" + key);
    }
    if (prev_key && this.curr_records[entity_id]
            && this.curr_records[entity_id][prev_key] === record) {
        this.debug("Removing record from curr_records cache: " + entity_id + ":" + prev_key);
        delete this.curr_records[entity_id][prev_key];
    }

    this.debug("Adding record to curr_records cache: " + entity_id + ":" + key);
    if (!this.curr_records[entity_id]) {
        this.curr_records[entity_id] = {};
    }
    this.curr_records[entity_id][key] = record;

    this.debug("Checking for parent_record updates: " + entity_id + ":" + key);
});


module.exports.define("isValid", function () {
    var valid = true;
    this.doFullKeyRecords(function (record) {
        if (!record.deleting) {
            valid = valid && record.isValid();
        }
    });
    this.doPartialKeyRecords(function (record) {
        if (!record.deleting) {
            valid = valid && record.isValid();
        }
    });
    return valid;
});


module.exports.define("getRecordCount", function () {
    var count_obj = this.getRecordCountFullKey();
    this.getRecordCountPartialKey(count_obj);
    count_obj.total = count_obj.full_key_total + count_obj.partial_key_total;
    count_obj.modified_total = count_obj.full_key_modified + count_obj.partial_key_modified;
    count_obj.unmodified_total = count_obj.full_key_unmodified + count_obj.partial_key_unmodified;
    return count_obj;
});


module.exports.define("getRecordCountFullKey", function (count_obj) {
    count_obj = count_obj || {};
    count_obj.full_key_modified = 0;
    count_obj.full_key_unmodified = 0;
    count_obj.full_key_valid = 0;
    count_obj.full_key_invalid = 0;
    count_obj.full_key_total = 0;
    this.doFullKeyRecords(function (record) {
        count_obj.full_key_total += 1;
        if (record.isModified()) {
            count_obj.full_key_modified += 1;
        } else {
            count_obj.full_key_unmodified += 1;
        }
        if (record.isValid()) {
            count_obj.full_key_valid += 1;
        } else {
            count_obj.full_key_invalid += 1;
        }
    });
    return count_obj;
});


module.exports.define("getRecordCountPartialKey", function (count_obj) {
    count_obj = count_obj || {};
    count_obj.partial_key_modified = 0;
    count_obj.partial_key_unmodified = 0;
    count_obj.partial_key_total = 0;
    this.doPartialKeyRecords(function (record) {
        count_obj.partial_key_total += 1;
        if (record.isModified()) {
            count_obj.partial_key_modified += 1;
        } else {
            count_obj.partial_key_unmodified += 1;
        }
    });
    return count_obj;
});


module.exports.define("save", function () {
    this.presaveValidation();
    this.saveInternal();
});


module.exports.define("presaveValidation", function () {
    var count_obj = this.getRecordCount();
    if (count_obj.partial_key_total > 0) {
        this.throwError(count_obj.partial_key_total + " partial-key record(s) still present");
    }
    if (count_obj.modified_total === 0) {
        this.throwError("no modified record(s) to save");
    }
    if (count_obj.full_key_invalid > 0) {
        this.throwError("contains invalid record(s)");
    }
});


module.exports.define("saveInternal", function () {
    this.doFullKeyRecords(function (record) {
        if (record.deleting || record.isModified()) {
            record.saveInternal();
        }
    });
});


module.exports.define("afterSaveUpdate", function (record) {
    record.status = "U";
    record.modified = false;
});


module.exports.define("afterSaveDelete", function (record) {
    record.status = "E";
    record.modified = false;
    delete this.curr_records[record.id][record.getFullKey()];
});


module.exports.define("getServerHttpOptions", function () {
    return this.server_http_options;
});

