"use strict";

var Data = require("lapis-data");
var Under = require("underscore");


var entities = {};

/**
* To represent a record in a database table
*/
module.exports = Data.FieldSet.clone({
    id: "Entity",
    status: null,       // "N"ew, "C"reating, "L"oading, "U"nmodified, "M"odified, "S"aving, "E"rror
                        // N > C > U > M > S > U,   N > L > U > M > S > U,   S > E,   L > E
    deleting: null,
    modifiable: false,  // set true immediately by this.createNewRecord(),
                        // or to modifiable_once_loaded in this.load()
    data_volume_oom: null,                      // expected data size as a power of 10
});


module.exports.register("create");
module.exports.register("load");
module.exports.register("afterTransChange");
module.exports.register("presave");


module.exports.defbind("setupEntity", "cloneType", function () {
    this.children = {};                     // map of Entity objects
    if (entities[this.id]) {
        this.throwError("entity already registered with this id: " + this.id);
    }
    entities[this.id] = this;
    if (this.parent_entity) {               // parent_entity MUST be loaded first
        this.trace("Linking " + this.id + " to its parent " + this.parent_entity);
        // parent entities will have to be loaded before their children!
        this.getEntityThrowIfUnrecognized(this.parent_entity).children[this.id] = this;
    }
});


module.exports.defbind("setupRecord", "cloneInstance", function () {
    var that = this;
    var key_fields;

    if (!this.children) {
        return;
    }
    this.status = this.status || "N";
    this.deleting = false;
    this.children = {};                     // map of arrays of record objects
    Under.each(this.parent.children, function (entity, entity_id) {
        that.children[entity_id] = [];
    });
    if (this.primary_key) {
        key_fields = this.primary_key.split(",");
        this.primary_key = [];
        Under.each(key_fields, function (key_field) {
            var field = that.getField(key_field);
            if (field) {
                that.primary_key.push(field);
                if (!field.mandatory) {
                    that.throwError("key field must be mandatory: " + key_field);
                }
            } else {
                that.throwError("invalid field id in primary_key: " + key_field);
            }
        });
    }
});


// --------------------------------------------------------------------------------- type methods
module.exports.define("getEntity", function (entity_id) {
    return entities[entity_id];
});


module.exports.define("getEntityThrowIfNotFound", function (entity_id) {
    var entity = this.getEntity(entity_id);
    if (!entity) {
        this.throwError("no entity found with id: " + entity_id);
    }
    return entity;
});


module.exports.define("getRecord", function (spec) {
    spec = spec || {};
    spec.id = spec.id || this.id;
    spec.instance = true;
    delete spec.key;
    return this.clone(spec);
});


// ----------------------------------------------------------------------------- instance methods
module.exports.override("isInitializing", function () {
    if (this.status === "N") {
        this.throwError("status should not be N");
    }
    return (this.status === "C" || this.status === "L");
});


module.exports.define("createNewRecord", function (manager) {
    var record = this.getRecord({
        manager: manager,
        status: "C",
    });
    record.setDefaultVals();
    record.status = "U";
    record.modifiable = true;
    manager.new_records.push(record);
    record.happen("create");
    return record;
});


module.exports.define("load", function (obj) {
    if (this.status !== 'L') {
        this.throwError("status should be L");
    }
    if (obj.error) {
        this.setToErrorState(obj.error);
        return;
    }
    this.each(function (field) {
        if (typeof obj[field.id] === "string") {
            field.setInitial(obj[field.id]);
        }
    });
    if (this.load_key !== this.getFullKey()) {
        this.throwError("key from loaded fields does not match load_key");
    }
    delete this.load_key;
    this.status = "U";        // unmodified
    this.modifiable = !!this.modifiable_once_loaded;
    this.happen("load");

    if (this.children) {
        this.populateFromObjectRecursive(obj);
    }
});


module.exports.define("populateFromObjectRecursive", function (obj) {
    var that = this;
    Under.each(this.parent.children, function (entity, entity_id) {
        if (obj[entity_id] && obj[entity_id].length > 0) {
            that.children[entity_id] = [];
            Under.each(obj[entity_id], function (obj_sub) {
                var record = that.manager.getExistingRecordNotInCache(entity_id);
                // that.manager.getExistingRecordNotInCache(entity_id, key)
                if (entity.link_field) {
                    record.getField(entity.link_field).set(that.getFullKey());
                }
                record.load(obj_sub);
                that.children[entity_id].push(record);
            });
        }
    });
});


module.exports.define("populateToObject", function () {
    var new_obj = {};
    this.each(function (field) {
        if (!field.isBlank()) {
            new_obj[field.id] = field.get();
        }
    });
    // new_obj.uuid = this.getUUID();
    // if (!new_obj.uuid || typeof new_obj.uuid !== "string") {
    //     this.throwError("invalid uuid: " + new_obj.uuid);
    // }
    Under.each(this.children, function (record_array) {
        Under.each(record_array, function (record) {
            if (record.deleting) {
                return;
            }
            if (!new_obj[record.parent.id]) {
                new_obj[record.parent.id] = [];
            }
            new_obj[record.parent.id].push(record.populateToDocument());
        });
    });
    return new_obj;
});


module.exports.define("createChildRecord", function (entity_id) {
    var record;
    if (!this.parent.children || !this.parent.children[entity_id]) {
        this.throwError("invalid entity_id: " + entity_id);
    }
    record = this.parent.children[entity_id].createNewRecord(this.manager);
    this.children[entity_id] = this.children[entity_id] || [];
    this.children[entity_id].push(record);
    record.parent_record = this;         // support key change linkage
    try {
        record.getField(record.link_field).set(this.getFullKey());
    } catch (e) {
        this.report(e);         // should only be 'primary key field is blank...'
    }
    return record;
});


module.exports.defbind("setKeyFieldsFixed", "load", function () {
    this.checkKey(this.getFullKey());
    Under.each(this.primary_key, function (key_field) {
        key_field.fixed_key = true;
    });
});


module.exports.defbind("checkForPrimaryKeyChange", "afterFieldChange", function (spec) {
    var new_key;
    if (this.status === "U") {
        this.status = "M";
    }
    if (this.primary_key.indexOf(spec.field) > -1) {
        try {
            new_key = this.getFullKey();              // throws Error if key not complete
            if (this.manager) {
                this.manager.addToCache(this, this.full_key);
            }
            this.full_key = new_key;
            this.eachChildRecord(function (record) {
                record.getField(record.link_field).set(spec.field.get());
            });
        } catch (e) {
            this.debug(e);
        }
    }
});


/*
module.exports.define("linkToParent", function (parent_record, link_field) {
    // if (!this.db_record_exists && parent_record && link_field) {
    this.parent_record = parent_record;         // support key change linkage
    this.trans_link_field = link_field;         // invoked when keyChange() calls trans.addToCache()
    // }
});
*/

module.exports.define("getChildRecord", function (entity_id, relative_key) {
    var found_record;
    this.eachChildRecord(function (record) {
        if (record.getRelativeKey() === relative_key) {
            found_record = record;
        }
    }, entity_id);
    return found_record;
});


module.exports.define("eachChildRecord", function (funct, entity_id) {
    var that = this;
    if (entity_id) {
        Under.each(this.children[entity_id], function (record) {
            funct(record);
        });
    } else {
        Under.each(this.children, function (record_array, temp_entity_id) {
            that.eachChildRecord(funct, temp_entity_id);
        });
    }
});


module.exports.define("checkKey", function (key) {
    var pieces;
    var pieces_required;
    var val;
    var i;

    if (typeof key !== "string" || key === "") {
        this.throwError("key must be a non-blank string");
    }
    pieces = key.split(".");            // Argument is NOT a regex
    pieces_required = this.getKeyPieces();
    if (pieces_required !== pieces.length) {
        this.throwError(pieces_required + " key pieces required, " + pieces.length + " found in " + key);
    }
    for (i = 0; i < pieces.length; i += 1) {
        val = pieces[i];
        if (!val) {
            this.throwError(i + "th key piece is blank in " + key);
        }
        if (val && !val.match(/^[a-zA-Z0-9_-]+$/)) {
            this.throwError("invalid character in key piece: " + val);
        }
    }
});


module.exports.define("isKeyComplete", function (key) {
    if (typeof key !== "string") {
        key = this.getFullKey();
    }
    try {
        this.checkKey(key);
        return true;
    } catch (ignore) {
        return false;
    }
});


module.exports.define("getKeyPieces", function () {
    var that = this;
    var count = 0;

    if (this.instance) {
        Under.each(this.primary_key, function (key_field) {
            count += key_field.getKeyPieces();
        });
    } else {
        Under.each(this.primary_key.split(","), function (key_field_id) {
            count += that.getField(key_field_id).getKeyPieces();
        });
    }
    return count;
});


module.exports.define("getKeyLength", function () {
    var that = this;
    var delim = 0;

    if (typeof this.key_length !== "number") {
        this.key_length = 0;
        if (this.instance) {
            Under.each(this.primary_key, function (key_field) {
                that.key_length += delim + key_field.getDataLength();
                delim = 1;
            });
        } else {
            Under.each(this.primary_key.split(","), function (key_field_id) {
                that.key_length += delim + that.getField(key_field_id).getDataLength();
                delim = 1;
            });
        }
    }
    return this.key_length;
});


module.exports.define("getRelativeKey", function () {
    var that = this;
    var out = "";
    var delim = "";

    if (!this.primary_key || this.primary_key.length === 0) {
        this.throwError("primary key has no fields");
    }
    Under.each(this.primary_key, function (key_field) {
        if (key_field.isBlank()) {
            that.throwError("primary key field is blank: " + key_field.id);
        }
        if (key_field.id === that.link_field) {
            return;
        }
        out += delim + key_field.get();
        delim = ".";
    });
    return out;
});


module.exports.define("getFullKey", function () {
    var out = "";
    if (this.parent_record) {
        out = this.parent_record.getFullKey() + ".";
    }
    out += this.getRelativeKey();
    return out;
});


module.exports.define("getUUID", function () {
    return this.id + ":" + this.getFullKey();
});


module.exports.define("getLabel", function (pattern_type) {
    var pattern = this["label_pattern_" + pattern_type] || this.label_pattern;
    var out;

    if (pattern) {
        out = this.detokenize(pattern);
    } else if (this.title_field) {
        out = this.getField(this.title_field).getText();
    }
    return out || "(ERROR: no label defined for " + this.id + ")";
});


module.exports.define("getPluralLabel", function () {
    return this.plural_label || this.title + "s";
});


module.exports.override("isValid", function () {
    return Data.FieldSet.isValid.call(this) && (this.status !== "E") && (!this.messages || !this.messages.error_recorded);
});


module.exports.define("setDelete", function (bool) {
    if (!this.isModifiable()) {
        this.throwError("fieldset not modifiable");
    }
    if (this.deleting !== bool) {
        this.trace("set modified");
        this.modified = true;
        if (this.trans) {
            this.trans.setModified();
        }
    }
    this.deleting = bool;
});


module.exports.define("isDelete", function () {
    return this.deleting;
});


module.exports.define("setToErrorState", function (error) {
    this.status = "E";
    this.error = error;
    this.modifiable = false;
});


// this can be called on an unmodified parent record containing modified children
module.exports.define("saveInternal", function () {
    // if (this.status === "M" || this.status === "C" || this.deleting) {
    this.status = "S";
    // this.ready_promise = null;
    // this.getReadyPromise();
    // } else {
    //     this.throwError("invalid status: " + this.status + ", and deleting: " + this.deleting);
    // }
});


module.exports.define("setupDateRangeValidation", function (start_dt_field_id, end_dt_field_id) {
    var start_dt_field = this.getField(start_dt_field_id);
    var end_dt_field = this.getField(end_dt_field_id);

    start_dt_field.css_reload = true;
    end_dt_field.css_reload = true;

// could perhaps use update event instead of these two...
    start_dt_field.defbind("setMinDateInitial_" + end_dt_field_id, "setInitialTrans", function () {
        var end_dt_field2 = this.owner.getField(end_dt_field_id);
        end_dt_field2.min = this.get();
        this.max = end_dt_field2.get();
    });

    start_dt_field.defbind("setMinDateChange_" + end_dt_field_id, "afterTransChange", function () {
        var end_dt_field2 = this.owner.getField(end_dt_field_id);
        end_dt_field2.min = this.get();
        this.max = end_dt_field2.get();
    });

    end_dt_field.defbind("setMinDateChange_" + start_dt_field_id, "afterTransChange", function () {
        var start_dt_field2 = this.owner.getField(start_dt_field_id);
        start_dt_field2.max = this.get();
        this.min = start_dt_field2.get();
    });
});


module.exports.define("setupOneWayLinkedFields", function (parent_field_id, child_field_id, interlink_field_id) {
    this.getField(parent_field_id).css_reload = true;
    this.getField(child_field_id).render_autocompleter = false;
    this.getField(child_field_id).editable = false;


    this.defbind("initOneWayLink_" + child_field_id, "initUpdate", function () {
        this.updateLinkedFields(parent_field_id, child_field_id, interlink_field_id);
    });

    this.defbind("updateOneWayLink_" + child_field_id, "update", function () {
        this.updateLinkedFields(parent_field_id, child_field_id, interlink_field_id);
    });
});


module.exports.define("updateLinkedFields", function (parent_field_id, child_field_id, interlink_field_id) {
    var parent_field = this.getField(parent_field_id);
    var child_field = this.getField(child_field_id);

    if (!parent_field.isBlank()) {
        child_field.editable = true;
        if (!child_field.lov || parent_field.isChangedSincePreviousUpdate()) {
            child_field.getOwnLoV({ condition: "A." + interlink_field_id + " = " + parent_field.getSQL(), });
        }
        if (parent_field.isChangedSincePreviousUpdate()) {
            child_field.set("");
        }
    }
});
