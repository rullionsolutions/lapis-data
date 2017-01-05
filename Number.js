"use strict";

var Core = require("lapis-core");
var Data = require("lapis-data");

/**
* To represent a decimal number field
*/
module.exports = Data.Text.clone({
    id: "Number",
    css_type: "number",
    css_align: "right",
    search_oper_list: "sy.search_oper_list_scalar",
    auto_search_oper: "EQ",
    search_filter: "ScalarFilter",
    decimal_digits: 0,
    data_length: 20,        // Has to be to pass Text.validate(),
                            // which must be called to set validated to true
//    tb_span: 2,
    tb_input: "input-mini",
    db_type: "I",
    db_int_type: "INT",
    min: 0,           // prevent negatives by default
    flexbox_size: 2,
//    update_length: 10
});


module.exports.define("obfuscateNumber", function () {
    return "FLOOR(RAND() * " + ((this.max || 100000) * Math.pow(10, this.decimal_digits)) + ")";
});


module.exports.override("set", function (new_val) {
    if (typeof new_val === "number") {
        new_val = String(new_val);
    }
    new_val = new_val.replace(/,/g, "");
    return Data.Text.set.call(this, new_val);
});


module.exports.define("setRounded", function (new_val) {
    return this.set(this.round(new_val));
});


module.exports.defbind("validateNumber", "validate", function () {
    var number_val;
    var decimals = 0;

    if (this.val) {
        try {
            number_val = Core.Format.parseStrict(this.val, 10);
            this.val = String(number_val);
            decimals = (this.val.indexOf(".") === -1) ? 0 : this.val.length - this.val.indexOf(".") - 1;
            if (decimals > this.decimal_digits) {
                this.messages.add({
                    type: "E",
                    text: this.val + " is more decimal places than the " + this.decimal_digits +
                        " allowed for this field",
                });
//            } else {
//                this.val = this.val + Lib.repeat("0", this.decimal_digits - decimals);
            }
        } catch (e) {
            this.messages.add({
                type: "E",
                text: e.toString(),
                cli_side_revalidate: true,
            });
        }

        this.trace("Validating " + this.toString() + ", val: " + this.val + ", decimal_digits: " +
            this.decimal_digits + ", number_val: " + number_val);
        if (this.isValid()) {
            if (typeof this.min === "number" && !isNaN(this.min) && number_val < this.min) {
                this.messages.add({
                    type: "E",
                    text: this.val + " is lower than minimum value: " + this.min,
                    cli_side_revalidate: true,
                });
            }
            if (typeof this.max === "number" && !isNaN(this.max) && number_val > this.max) {
                this.messages.add({
                    type: "E",
                    text: this.val + " is higher than maximum value: " + this.max,
                    cli_side_revalidate: true,
                });
            }
        }
    }
});


module.exports.override("getTextFromVal", function () {
    var val = this.get();
    var number_val;

    try {
        number_val = Core.Format.parseStrict(val);
        val = this.format(number_val);
    } catch (e) {
        this.trace(e.toString());
    }
    return val;
});


module.exports.define("format", function (number_val) {
    // if (this.display_format) {
    //     return String((new java.text.DecimalFormat(this.display_format)).format(number_val));
    // }
    return number_val.toFixed(this.decimal_digits);
});


module.exports.define("round", function (number) {
    if (typeof number !== "number") {
        number = this.getNumber(0);
    }
    return Core.Format.round(number, this.decimal_digits);
});
