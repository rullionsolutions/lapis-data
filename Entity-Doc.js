/*jslint node: true */
"use strict";

var Log     = require("../base/Log"),
    Parent  = require("./Entity"),
    Promise = require("q");

module.exports = Parent.clone({
    id                      : "DocumentEntity",
    database_url            : "http://other_apps:5984/stevief/",
    promise_cache           : null,             // map created per Entity
});

// status: 'N'ew, 'B'efore Load, 'L'oading, 'U'nmodified, 'M'odified, 'S'aving;    N > S > U,   B > L > U,   U > M > S > U,   S > E,   L > E

module.exports.override("clone", function (spec) {
    var new_obj;
    new_obj = Parent.clone.call(this, spec);
    if (!new_obj.instance) {
        new_obj.promise_cache = {};
    }
    return new_obj;
});

// if the document is loaded from the server then
//      doc_id is either a uuid (if primary_key.auto_generate), or else {module}.{entity}:{primary key}
// otherwise, it is null
module.exports.define("getDocId", function (key) {
    var doc_id = "";
    if (this.primary_key_field.auto_generate) {
        if (this.primary_key_field.isBlank()) {
            this.primary_key_field.autoGenerate();
        }
    } else {
        doc_id = this.url_prefix || (this.path() + ":");
    }
    doc_id += (key || this.primary_key_field.get());
    return doc_id;
});

module.exports.define("getDocPromise", function (key) {
    var doc,
        promise;

    key = key || "";
    if (key) {
        promise = this.promise_cache[this.path() + ":" + key];
        if (promise) {
            return promise;
        }
    }
//    doc_id = key && ((!this.primary_key.auto_generate ? this.id + ":" : "") + key);
    doc = this.clone({
        id: key || this.id,
        status: key ? 'B' : 'N',            // 'B'efore Load or 'N'ew
        instance: true,
        modifiable: true
    });
    if (key) {
        promise = new Promise(function (resolve, reject) {
            doc.load(resolve, reject);
        });
        this.promise_cache[this.path() + ":" + key] = promise;
    } else {
        promise = new Promise(doc);
    }
    return promise;
});

module.exports.define("isWaiting", function () {
    return (this.status === 'L' || this.status === 'S');
});


module.exports.define("addChild", function (entity_id) {
    var new_row;
//    if (!this.parent.children || !this.parent.children[entity_id]) {
//        throw new Error("Not a child of this entity: " + entity_id);
//    }
//    new_row = this.parent.children[entity_id].clone({
    if (!this.child_rows[entity_id]) {
        this.child_rows[entity_id] = [];
    }
    new_row = this.getEntity(entity_id).clone({
        id: this.id + "/" + entity_id + "[" + this.child_rows[entity_id].length + "]",
        instance: true, modifiable: true, owner: this
    });
    this.child_rows[entity_id].push(new_row);
    return new_row;
});

module.exports.define("eachChildRow", function (funct, specific_entity_id) {
    this.child_rows.forOwn(function (entity_id, row_array) {
        if (!specific_entity_id || specific_entity_id === entity_id) {
            row_array.forOwn(function (i, row) {
                funct(row);
            });
        }
    });
});

module.exports.define("getLoadURL", function (key) {
    return this.database_url + encodeURIComponent(this.getDocId(key));
});

module.exports.define("load", function (resolve, reject) {
    var that = this;
    if (this.status !== 'B') {
        reject("invalid document status: " + this.status);
    }
    Log.debug("load() doc_id: " + this.getDocId());
    this.status = 'L';    // Loading
    Http.exchange({ url: this.getLoadURL(this.id), cache: false, async: false, type: "GET",
        success: function (data_back) {
            that.loadSuccess(resolve, reject, data_back);
        },
        error: function (code, msg) {
            that.loadError(resolve, reject, code, msg);
        }
    });
});

module.exports.define("loadSuccess", function (resolve, reject, data_back) {
    if (this.status !== 'L') {
        reject("invalid document status - " + this.status);
    }
    this.populate(data_back);
//            this.primary_key.setInitial(this.doc_id);
    this.primary_key_field.fixed_key = true;
    this.rev    = data_back._rev;
    this.status = 'U';
    resolve(this);
});

module.exports.define("loadError", function (resolve, reject, code, msg) {
    this.status = 'E';
    this.error = code.status;
    reject(this.error);
});

module.exports.define("getSaveURL", function () {
    var url = this.database_url + encodeURIComponent(this.doc_id);
    if (this.rev) {
        url += "?rev=" + this.rev;
    }
    return url;
});

module.exports.define("save", function (resolve, reject) {
    var that = this;
    if (this.status !== 'N' && this.status !== 'M') {
        reject("invalid document status - " + this.status);
    }
    if (!this.isValid()) {
        reject("document is not valid");
    }
    Log.debug("save() doc_id: " + this.doc_id + ", rev: " + this.rev);
    this.status = 'S';    // Saving
    Http.exchange({ url: this.getSaveURL(), cache: false, async: false, type: (this.doc_id ? "PUT" : "POST"), data: JSON.stringify(this.getData()),
        success: function (data_back) {
            that.saveSuccess(resolve, reject, data_back);
        },
        error: function (code, msg) {
            that.saveError(resolve, reject, code, msg);
        }
    });
});

module.exports.define("saveSuccess", function (resolve, reject, data_back) {
    if (this.status !== 'S') {
        reject("invalid document status: " + this.status);
    }
    if (data_back.ok) {
        this.status = 'U';
        this.doc_id = data_back.id;
        this.rev    = data_back.rev;
        // trigger loaded
        resolve(this);
    } else {
        this.status = 'E';
        this.error  = "unknown: " + data_back.ok;
        reject(this.error);
    }
});

module.exports.define("saveError", function (resolve, reject, code, msg) {
    this.status = 'E';
    this.error  = "[" + code + "] " + msg;
    reject(this.error);
});

module.exports.define("populate", function (data_back) {
    var that = this;
    this.each(function (field) {
        if (typeof data_back[field.id] === "string") {
            field.setInitial(data_back[field.id]);
        }
    });
    if (data_back.child_rows) {
        data_back.child_rows.forOwn(function (entity_id, row_array) {
            row_array.forOwn(function (i, row) {
                that.addChild(entity_id).populate(row);
            });
        });
    }
});

module.exports.define("getData", function () {
    var out = {};
    if (!this.owner) {
        out.entity_id = this.parent.id;
    }
    this.each(function (field) {
        field.getData(out);
    });
    this.eachChildRow(function (row) {
        if (!out.child_rows) {
            out.child_rows = {};
        }
        if (!out.child_rows[row.parent.id]) {
            out.child_rows[row.parent.id] = [];
        }
        if (!row.deleting) {
            out.child_rows[row.parent.id].push(row.getData());
        }
    });
    return out;
});

module.exports.define("isValid", function () {
    var valid;
    valid = (Entity.isValid.call(this) && this.status !== 'E');
    this.eachChildRow(function (row) {
        valid = valid && (row.deleting || row.isValid());
    });
    return valid;
});

module.exports.define("beforeFieldChange", function (field, new_val) {
    Parent.beforeFieldChange.call(this, field, new_val);
    if (!this.owner && this.status !== 'N' && this.status !== 'U' && this.status !== 'M') {
        throw new Error("invalid document status - " + this.status);
    }
});

module.exports.define("setModified", function () {
    this.status = "M";
});


//To show up in Chrome debugger...
//@ sourceURL=data/DocumentEntity.js