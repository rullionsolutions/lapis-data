"use strict";

var Core = require("lapis-core");


module.exports = Core.Base.clone({
    id: "Store",
    db_id: null,                    // string database name
});


module.exports.register("start");
// module.exports.register("deleteStore");
// module.exports.register("createStore");
// module.exports.register("saveDoc");
// module.exports.register("getDoc");
// module.exports.register("deleteDoc");


module.exports.define("start", function () {
    return this.happenAsync("start", this.getNullPromise());
});


module.exports.define("createDatabase", function () {
    this.throwError("not implemented");
});


module.exports.define("deleteDatabase", function () {
    this.throwError("not implemented");
});


module.exports.define("save", function (doc_obj) {
    this.throwError("not implemented");
});


module.exports.define("get", function (key) {
    this.throwError("not implemented");
});


module.exports.define("delete", function (key) {
    this.throwError("not implemented");
});


module.exports.define("copy", function (key) {
    this.throwError("not implemented");
});


module.exports.define("getAll", function () {
    this.throwError("not implemented");
});


module.exports.define("deleteAll", function () {
    this.throwError("not implemented");
});
