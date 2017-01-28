"use strict";

var Core = require("lapis-core");

/**
* To represent a basic unit of textual information, how it is captured, validated,
* stored in the database, and represented on screen
*/
module.exports = Core.Base.clone({
    id: "Text",
    visible: true,
    editable: true,
    data_length: 255,
    text_pattern: "{val}",
});


module.exports.register("beforeChange");
module.exports.register("validate");
module.exports.register("afterChange");


/**
* To initialise this field when cloned - sets query_column property based on table_alias,
* sql_function and id
*/
module.exports.defbind("resetVal", "cloneInstance", function () {
    this.val = "";
    this.text = null;
    this.url = null;
    this.validated = false;                    // private - validated since last significant change?
});


module.exports.defbind("resetModified", "cloneInstance", function () {
    this.orig_val = this.val;
    this.prev_val = this.val;
    this.modified = false;                    // private - modified since original value, or not?
});


/**
* Returns this field's val property - should always be used instead of accessing val directly
* @return Value of this field's val property - should be string
*/
module.exports.define("get", function () {
    if (typeof this.getComputed === "function") {
        this.val = this.getComputed();
    }
    return this.val;
});


/**
* To get a numerical representation of this field's value
* @param Default value to use if this field's value is not a number
* @return Number value of field (if the value can be interpreted as numeric), or the default
* value argument (if numeric) or undefined
*/
module.exports.define("getNumber", function (def_val) {
    var number_val = parseFloat(this.get());
    if (isNaN(number_val) && typeof def_val === "number") {
        number_val = def_val;
    }
    return number_val;
});


/**
* To indicate whether or not this field's value is blank
* @return True if this field's value is blank (i.e. empty string) otherwise false
*/
module.exports.define("isBlank", function (val) {
    if (typeof val !== "string") {
        val = this.get();
    }
    return !val;
});


module.exports.define("isInitializing", function () {
    return (this.owner && this.owner.isInitializing());
});


module.exports.define("setDefaultVal", function () {
    if (this.default_val) {
        this.setInitial(this.default_val);
    }
});


module.exports.define("setInitial", function (new_val) {
    if (!this.isInitializing()) {
        this.throwError("setDefaultVal() only allowed when initializing");
    }
    this.setPreChecks(new_val);
    this.setInternal(new_val, "<init>");
});


/**
* To set this field's value to the string argument specified, returning false if no change,
* otherwise calling owner.beforeFieldChange() and this.beforeChange() before making the change,
* then owner.afterFieldChange() and this.afterChange() then returning true
* @param String new value to set this field to
* @return True if this field's value is changed, and false otherwise
*/
module.exports.define("set", function (new_val) {
    var old_val = this.get();
    if (this.isInitializing()) {
        this.throwError("set() not allowed when initializing");
    }
    this.prev_val = old_val;            // to support isChangedSincePreviousUpdate()
    this.setPreChecks(new_val);
    if (new_val === this.val) {
        return false;
    }
    if (this.owner && typeof this.owner.beforeFieldChange === "function") {
        this.owner.beforeFieldChange(this, new_val);            // May throw an error
    }
    this.happen("beforeChange", new_val);
    this.setInternal(new_val, old_val);
    this.modified = true;
    if (this.owner && typeof this.owner.afterFieldChange === "function") {
        this.owner.afterFieldChange(this, old_val);
    }
    this.happen("afterChange", old_val);
    return true;
});


module.exports.define("setPreChecks", function (new_val) {
    if (typeof new_val !== "string") {
        this.throwError("argument not string: " + this.owner.id + "." + this.id);
    }
    if (this.fixed_key) {
        this.throwError("fixed key");
    }
});


module.exports.define("setInternal", function (new_val, old_val) {
    this.val = new_val;
    this.text = null;
    this.url = null;
    this.validated = false;
    this.trace("setting " + this.getId() + " from '" + old_val + "' to '" + new_val + "'");
});

/**
* Returns the value of this field's id property
* @return This field's id property as a string
*/
module.exports.define("getId", function () {
    return this.id;
});


/**
* To set a given property, and unset the validated property, prompting another call to
* validate() when next required
* @param String property name, and property value
*/
module.exports.define("setProperty", function (name, val) {
    if (name === "id") {
        this.throwError("can't change property 'id'");
    }
    if (name === "type") {
        this.throwError("can't change property 'type'");
    }
    this[name] = val;
    this.text = null;
    this.url = null;
    this.validated = false;                            // property change might affect validation
});


/**
* To indicate whether or not this field is editable, i.e. its 'editable' property is true,
* it is not a 'fixed_key' and the containing owner is not unmodifiable
* @return true if this field is editable, otherwise false
*/
module.exports.define("isEditable", function () {
    return this.editable && !this.fixed_key && (this.owner.modifiable !== false);
});


/**
* To indicate whether or not this field is visible, i.e. its 'visible' property is true,
* its 'accessible' property is not false
* @return true if this field is visible, otherwise false
*/
module.exports.define("isVisible", function (field_group, hide_blank_uneditable) {
    return this.visible && (this.accessible !== false) &&
        (!field_group || field_group === this.field_group) &&
        (!this.hide_if_no_link || this.getURL()) &&
        ((this.editable && this.owner && this.owner.modifiable) ||
            !this.isBlank() || !hide_blank_uneditable);
});


/**
* To set the visible and editable attributes combined, and mandatory as a separate arg,
* set the field blank is not visible, and validate
* @param whether visible/editable, whether mandatory (only if visible/editable)
*/
module.exports.define("setVisEdMand", function (visible, editable, mandatory) {
    if (visible && !this.visible && this.isBlank() && this.default_val) {
        this.set(this.default_val);
    }
    this.visible = visible;
    this.editable = editable;
    this.mandatory = visible && editable && mandatory;
    if (!visible) {
        this.set("");
    }
    this.validated = false;                            // property change might affect validation
});


module.exports.define("getMessageManager", function () {
    return Core.MessageManager.clone({
        id: "MessageManager.Field",
        field: this,
        prefix: this.label,
        instance: true,
    });
});


/**
* To validate the value this field is currently set to; this function (or its descendents)
* can report errors
*/
module.exports.define("validate", function () {
    this.messages = this.getMessageManager();
    this.messages.clear();
    if (this.mandatory && !this.val) {
        this.messages.add({
            type: "E",
            text: "mandatory",
        });
    }
    if (this.val && this.val.length > this.getDataLength() && this.getDataLength() > -1) {
        this.messages.add({
            type: "E",
            text: "longer than " + this.getDataLength() + " characters",
        });
    }
    if (this.val && this.regex_pattern && !(this.val.match(new RegExp(this.regex_pattern)))) {
        this.messages.add({
            type: "E",
            text: this.regex_label || "match pattern",
        });
    }
    this.validated = true;
    this.happen("validate");
});


/**
* To report whether or not this field is valid, based on the last call to validate()
* (validate() is called again if necessary)
* @return true if this field is valid, false otherwise
*/
module.exports.define("isValid", function (modified_only) {
    if ((!modified_only || this.isModified()) && !this.validated) {
        this.validate();
    }
    return !this.messages || !this.messages.error_recorded;
});


/**
* To obtain the field's data length, in most cases the character length of the database field
* @return The data length of this field, as an integer number of characters
*/
module.exports.define("getDataLength", function () {
    return (typeof this.data_length === "number") ? this.data_length : 255;
});


/**
* To obtain the number of pieces the value of this field represents as a key string
* @return The number 1
*/
module.exports.define("getKeyPieces", function () {
    return 1;
});


/**
* To report whether or not this field is a key of the entity to which it belongs
* @return True if this field is a key, otherwise false
*/
module.exports.define("isKey", function () {
    if (this.owner && this.owner.isKey) {
        return this.owner.isKey(this.getId());
    }
    return false;
});


/**
* To report whether or not this field has been modified (by a call to set()), since it was
* originally created and set
* @return true if this field has been modified, otherwise false
*/
module.exports.define("isModified", function () {
    return this.modified;
});


/**
* To convert the properties of this field (especially this.val) into the display text string
* for this field
* @return display text string appropriate to this field and its properties
*/
module.exports.define("getTextFromVal", function () {
    var out = this.detokenize(this.text_pattern);

    // val = this.get(),
/*
    if (this.config_item && !this.isBlank(val)) {
        try {
            out = "[" + val + "] " + this.getConfigItemText(this.config_item, val);
        } catch (e) {        // assume unrecognised config item
            out = e.toString();
            this.report(e);
        }
    }
*/
    return out;
});


/**
* To obtain the display text string for this field, which is set by the last call to validate()
* @return the value of this field's 'text' property - always a string
*/
module.exports.define("getText", function () {
    // set() sets this.text to null; only other
    // reason to recompute is if using getComputed() function
    if (typeof this.text !== "string" || this.getComputed) {
        this.text = this.getTextFromVal();
    }
    return this.text;
});


/**
* To obtain the text title of the config item which the value of this field represents -
* @return [config_item][this.get()].title as a string, otherwise '[unknown]'
*/
module.exports.define("getConfigItemText", function (config_item, val) {
    var obj = Core.OrderedMap.getCollection(config_item);
    var label_prop = this.label_prop || "title";

    obj = obj.get(val);
    if (typeof obj !== "object") {
        this.throwError(val + " not found in " + config_item);
    }
    if (typeof obj[label_prop] !== "string") {
        this.throwError(config_item + "[" + val + "]." + label_prop + " is not a string");
    }
    return obj[label_prop];
});


/**
* To obtain the string representation of the value of this field for use in an update control
* (i.e. input box)
* @return the value of the 'val' property of this field
*/
module.exports.define("getUpdateText", function () {
    return this.get();
});


/**
* To get a URL corresponding to the value of this field, if there is one; by default this
* @return url string if produced
*/
module.exports.define("getURLFromVal", function () {
    var url;
    var val = this.get();

    if (this.url_pattern) {
        url = val ? this.detokenize(this.url_pattern) : "";
    }
    if (url) {
        if (this.url_expected === "internal") {     // assumed to begin "index.html?page_id=" or similar
            try {
                if (!this.getSession().allowedURL(url)) {
                    url = "";
                }
            } catch (e) {        // Assume is page_not_found exception
                this.report(e);
                url = "";
            }
        } else if (this.url_expected === "external" && url.indexOf("http") !== 0) {
            url = "http://" + url;
        }
    }
    return url;
});


/**
* To obtain the url string for this field, which is set by the last call to validate()
* @return the value of this field's 'url' property - always a string
*/
module.exports.define("getURL", function () {
    if (typeof this.url !== "string") {
        this.url = this.getURLFromVal();
    }
    return this.url;
});
