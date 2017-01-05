/*jslint node: true */
"use strict";


var Parent = require("./LoV"),
    Entity = require("./Entity");

module.exports = Parent.clone({
    id              : "DocumentLoV"
});

module.exports.define("clone", function (spec) {
    var new_obj;
    new_obj = Parent.clone.call(this, spec);
    if (spec.entity_id && spec.key) {
        new_obj.startDocumentLoad(spec.entity_id, spec.key);
    }
    return new_obj;
});

module.exports.define("startDocumentLoad", function (entity_id, key) {
    this.document = Entity.getEntity(entity_id).getDocument(key);
});

module.exports.define("loadRow", function (row) {
    this.addItem(row.getField(this.id_field).get(), row.getField(this.label_field).get(), true);
});

module.exports.define("loadDocument", function () {
    var that = this;
//    if (!this.document || this.document.isWaiting()) {
//        throw new Error("this.document doesn't exist or is loading");
//    }
    if (!this.list_sub_entity || !this.document.child_rows[this.list_sub_entity]) {
        throw new Error("this.list_sub_entity not defined or not present");
    }
    this.document.eachChildRow(function (row) {
        that.loadRow(row);
    }, this.list_sub_entity);
});


//To show up in Chrome debugger...
//@ sourceURL=data/DocumentLoV.js