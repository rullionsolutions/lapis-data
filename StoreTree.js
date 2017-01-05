"use strict";

var Store = require("./Store.js");


module.exports = Store.clone({
    id: "StoreTree",
    root_doc_id: "root",
    root_doc_title: "Everything",
    create_properties: { keyPath: "uuid", },
    indexes: [
        {
            id: "by_title",
            key_path: "payload.title",
            additional: { unique: true, },
        },
        {
            id: "by_parent",
            key_path: ["payload.parent_id", "payload.sequence_nbr",
            ],
            additional: { unique: false, },
        },
    ],
});


module.exports.defbind("getOrCreateRootDoc", "start", function () {
    var that = this;

    that.getDoc(that.root_doc_id)
        .then(function (doc_obj) {
            that.root_doc = doc_obj;
            that.info("StoreTree.getOrCreateRootDoc() root doc found");
        })
        .then(null, /* catch */ function (reason) {
            that.info("StoreTree.getOrCreateRootDoc() creating new root doc...");
            that.root_doc = {
                uuid: that.root_doc_id,
                payload: {
                    title: that.root_doc_title,
                    type: "folder",
                },
            };
            return that.saveDoc(that.root_doc);
        });
});


module.exports.define("setParent", function (node_id, parent_id, position) {
    var that = this;
    var old_parent_id;

    that.debug("StoreTree.setParent(): setting node: " + node_id + " parent to: " + parent_id);
    that.getDoc(node_id)
        .then(function (doc_obj) {
            that.debug("StoreTree.setParent().then(1): update doc");
            old_parent_id = doc_obj.payload.parent_id;
            doc_obj.payload.parent_id = parent_id;
            return that.saveDoc(doc_obj);
        })
        .then(function () {
            that.debug("StoreTree.setParent().then(2): get new parent document: " + parent_id);
            if (!parent_id) {
                throw new Error("no new parent_id");
            }
            return that.getDoc(parent_id);
        })
        .then(function (doc_obj) {
            that.debug("StoreTree.setParent().then(3): update new parent doc: " + doc_obj.uuid);
            if (!doc_obj.payload.children) {
                doc_obj.payload.children = [];
            }
            if (doc_obj.payload.children.indexOf(node_id) > -1) {
                doc_obj.payload.children.splice(doc_obj.payload.children.indexOf(node_id), 1);
            }
            if (typeof position !== "number" || position < 0 || position > doc_obj.payload.children.length) {
                position = doc_obj.payload.children.length;
            }
        //     if (typeof position !== "number" || position < 0) {
        //         position = 0;
        //     }

            that.debug("StoreTree.setParent(): about to splice, to position: " + position + ", array initial length: " + doc_obj.payload.children.length + ", node_id: " + node_id);
            doc_obj.payload.children.splice(position, 0, node_id);
            return that.saveDoc(doc_obj);
        })
        .then(null, /* catch */ function (reason) {
            that.info("StoreTree.setParent().then(4): catch reason: " + reason);
        })
        .then(function () {
            that.debug("StoreTree.setParent().then(5): get old parent doc");
            if (!old_parent_id || old_parent_id === parent_id) {
                throw new Error("no old_parent_id");
            }
            return that.getDoc(old_parent_id);
        })
        .then(function (doc_obj) {
            that.debug("StoreTree.setParent().then(6): update old parent doc: " + doc_obj.uuid);
            if (doc_obj.payload.children.indexOf(node_id) > -1) {
                doc_obj.payload.children.splice(doc_obj.payload.children.indexOf(node_id), 1);
            }
            return that.saveDoc(doc_obj);
        })
        .then(function () {
            that.debug("StoreTree.setParent().then(7): all done!");
        })
        .then(null, /* catch */ function (reason) {
            that.info("StoreTree.setParent().then(8) failed: " + reason);
        });
});


module.exports.define("reset", function () {
    var that = this;
    this.debug("beginning parentReset()");
    return that.getAll()
        .then(function (results) {
            var i;
            var docs = {};
            var doc;
            var parent;

            for (i = 0; i < results.length; i += 1) {
                doc = results[i];
                docs[doc.uuid] = doc;
            }
            for (i = 0; i < results.length; i += 1) {
                doc = results[i];
                if (doc.payload.parent_id) {
                    parent = docs[doc.payload.parent_id];
                    if (!parent.payload.children) {
                        parent.payload.children = [];
                    }
                    parent.payload.children.push(doc.uuid);
                }
                if (doc.payload.type === "document") {
                    if (!doc.payload.parent_id) {
                        that.warn("StoreTree.reset() ERROR: doc has no parent: " + doc.uuid);
                    }
                } else {        // folder
                    delete doc.payload.content;
                }
                delete doc.payload.sequence_nbr;
                delete doc["repl status"];
            }
            for (i = 0; i < results.length; i += 1) {
                doc = results[i];
                that.info("StoreTree.reset() saving: " + doc.uuid + ", children: " + doc.payload.children);
                that.save(doc);
            }
        })
        .then(null, /* catch */ function (reason) {
            that.error("StoreTree.reset() failed: " + reason);
        });
});
