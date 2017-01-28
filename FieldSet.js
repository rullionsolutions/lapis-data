"use strict";

var Core = require("lapis-core");
var Data = require("lapis-data");

/**
* An OrderedMap of fields, whose ids are unique within this object
*/
module.exports = Core.OrderedMap.clone({
    id: "FieldSet",
    modifiable: false,
    modified: false,                        // private - modified since original value, or not?
});


module.exports.register("beforeFieldChange");
module.exports.register("afterFieldChange");


module.exports.define("addFields", function (spec_array) {
    var i;
    for (i = 0; i < spec_array.length; i += 1) {
        this.addField(spec_array[i]);
    }
});


module.exports.define("addField", function (spec) {
    var field;
    if (!spec.id || typeof spec.id !== "string") {
        this.throwError("id must be nonblank string");
    }
    if (!Core.Base.isOrIsDescendant(spec.type, Data.Text)) {
        this.throwError("field type must be Text or a descendant of it");
    }
    spec.instance = this.instance;
    field = spec.type.clone(spec);
    this.add(field);
    if (this.page) {
        field.addToPage(this.page);
    }
    return field;
});


module.exports.define("getField", function (id) {
    return this.get(id);
});


module.exports.define("getFieldCount", function () {
    return this.length();
});


module.exports.define("removeField", function (id) {
    var field = this.get(id);
    if (field && this.page) {
        delete this.page.fields[field.getControl()];
    }
    Core.OrderedMap.remove.call(this, id);
});


module.exports.define("beforeFieldChange", function (field, new_val) {
    if (!this.modifiable) {
        this.throwError("fieldset not modifiable");
    }
    this.happen("beforeFieldChange", {
        field: field,
        new_val: new_val,
    });
});


module.exports.define("afterFieldChange", function (field, old_val) {
    if (field.isModified()) {
        this.touch();
    }
    this.happen("afterFieldChange", {
        field: field,
        old_val: old_val,
    });
});


module.exports.define("touch", function () {
    this.modified = true;
    if (this.document) {
        this.document.touch();
    }
});


module.exports.define("isInitializing", function () {
    return false;
});


// NOTE: this call will fail as field.setDefaultVal() throws an error if
//  its owner (i.e. this) is not initializing
module.exports.define("setDefaultVals", function () {
    this.each(function (field) {
        field.setDefaultVal();
    });
});


/**
* Add a property to the given spec object for each field in this FieldSet, with its string value
* @param spec: object to which the properties are added
* @param options.text_values: set property value to field.getText() instead of field.get()
*/
module.exports.define("addValuesToObject", function (spec, options) {
    this.each(function (field) {
        spec[((options && options.prefix) ? options.prefix : "") + field.id] = ((options && options.text_values) ? field.getText() : field.get());
    });
});


module.exports.override("replaceToken", function (token) {
    var field;
    this.trace("replaceToken(): " + token);
    token = token.split("|");
    if (token[0] === "key" && typeof this.getKey === "function") {
        return this.getFullKey();
    }
    field = this.getField(token[0]);
    if (!field) {
        return "(ERROR: unrecognized field: " + token[0] + ")";
    }
    return field.getTokenValue(token);
});


module.exports.define("isModified", function () {
    return this.modified;
});


module.exports.define("isModifiable", function () {
    return this.modifiable;
});


module.exports.define("setModifiable", function (bool) {
    if (typeof bool !== "boolean") {
        this.throwError("argument must be a boolean");
    }
    if (bool === false && this.isModified()) {
        this.throwError("already modified");
    }
    this.modifiable = bool;
});


module.exports.define("isValid", function (modified_only, field_group) {
    var valid = true;
    if (this.deleting) {
        return true;
    }
    this.each(function (field) {
        if (field_group && field_group !== field.field_group) {
            return;
        }
        valid = valid && field.isValid(modified_only);
    });
    return valid;
});


// copy values from fieldset's fields for each field whose id matches
module.exports.override("copyFrom", function (fieldset) {
    this.each(function (field) {
        if (fieldset.getField(field.id)) {
            field.set(fieldset.getField(field.id).get());
        }
    });
});


module.exports.define("update", function (params) {
    if (this.modifiable) {
        this.each(function (field) {
            field.update(params);
        });
    }
});

