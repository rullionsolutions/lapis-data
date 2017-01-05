"use strict";

var Data = require("lapis-data");

/**
* To represent a date field
*/
module.exports = Data.Text.clone({
    id: "Date",
    css_type: "date",
    search_oper_list: "sy.search_oper_list_scalar",
    auto_search_oper: "EQ",
    search_filter: "ScalarFilter",
    internal_format: "yyyy-MM-dd",
    update_format: "dd/MM/yy",
    display_format: "dd/MM/yy",
    input_mask: "99/99/99",
    regex_label: "Not a valid date",
    data_length: 10,
//    update_length: 8,
//    tb_span: 2,
    tb_input: "input-mini",
    week_start_day: 0,            // 0 = Sun, 1 = Mon, etc
    error_message: "not a valid date",
});


module.exports.override("getUpdateText", function () {
    return this.getText();
});


module.exports.define("getDBDateFormat", function (format) {
    return format
        .replace("HH", "%H")
        .replace("mm", "%i")
        .replace("ss", "%s")
        .replace("dd", "%z")      // %z - not used by MySQL - holding char
        .replace("MM", "%m")
        .replace("yyyy", "%Y")
        .replace("d", "%e")
        .replace("M", "%c")
        .replace("yy", "%y")
        .replace("%z", "%d");
});


/*
module.exports.override("getDBTextExpr", function (alias) {
    return "DATE_FORMAT(" + (alias ? alias + ".": "") + this.id + ", '" +
        this.getDBDateFormat(this.display_format) + "')";
});
*/

/**
* To attempt to parse a given date (or date/time) string, using given in/out formats if supplied,
* and applying any 'adjusters'
* @param A date string, with optional 'adjusters', separated by '+' chars, e.g. 'week-start',
* 'month-end', '2months', '-3minutes', numbers interpreted as days; 2nd arg is optional string
* input format, 3rd arg is optional string out format
* @return Converted date string (if conversion could be performed), otherwise returns the input
* string
*/
module.exports.define("parse", function (val, in_format, out_format) {
    var parts;
    var date = new Date();

    if (typeof val !== "string") {
        return val;
    }
    parts = val.split("+");
    in_format = in_format || this.internal_format;
    out_format = out_format || this.internal_format;
    parts.forEach(function (part) {
        if (part === "today") {
            return;
        }
        if (part === "now") {
            return;
        }
        if (part === "day-start") {
            date.clearTime();
        } else if (part === "day-end") {
            date.setHours(23);
            date.setMinutes(59);
            date.setSeconds(59);
            date.setMilliseconds(999);
        } else if (part === "week-start") {
            date.add("d", -((date.getDay() + this.week_start_day) % 7));            // getDay() returns 0 for Sun to 6 for Sat
        } else if (part === "week-end") {
            date.add("d", 6 - ((date.getDay() + this.week_start_day) % 7));
        } else if (part === "month-start") {
            date.setDate(1);
        } else if (part === "month-end") {
            date.add("M", 1);
            date.setDate(1);
            date.add("d", -1);
        } else if (part.indexOf("minutes") > -1) {
            date.add("m", parseInt(part, 10));
        } else if (part.indexOf("hours") > -1) {
            date.add("h", parseInt(part, 10));
        } else if (part.indexOf("days") > -1) {
            date.add("d", parseInt(part, 10));
        } else if (part.indexOf("weeks") > -1) {
            date.add("d", parseInt(part, 10) * 7);
        } else if (part.indexOf("months") > -1) {
            date.add("M", parseInt(part, 10));
        } else if (part.indexOf("years") > -1) {
            date.add("y", parseInt(part, 10));
        } else if (parseInt(part, 10).toFixed(0) === part) {
            date.add("d", parseInt(part, 10));
        } else {
            date = new Date(Date.parse(part));      // TODO - inadequate parsing
        }
    });
    return (date ? date.toUTCString() : val);
});


/**
* Syntactic sugar - equivalent to this.parse(val, this.internal_format, this.display_format)
* @param A date string, with optional 'adjusters', separated by '+' chars, e.g. 'week-start',
* 'month-end', '2months', '-3minutes', numbers interpreted as days; 2nd arg is optional string
* input format, 3rd arg is optional string out format
* @return Converted date string (if conversion could be performed) in usual display format,
* otherwise returns the input string
*/
module.exports.define("parseDisplay", function (val) {
    return this.parse(val, this.internal_format, this.display_format);
});


/**
* To obtain a JavaScript date object representing the value of this field
* @return A JavaScript date object corresponding to this field's value - note that changes to it
* do NOT update the value of the field
*/
module.exports.define("getDate", function () {
    if (!this.isBlank()) {
        return Date.parse(this.get());
    }
    return null;
});


/**
* To indicate whether or not the date (or date/time) argument is before this field's value
* @param Date string
* @return True if this field's value represents a point in time before the date argument
*/
module.exports.define("isBefore", function (date) {
    var nThisDay;
    var nOtherDay;

    if (!this.get() || !date) {
        return false;
    }
    nThisDay = Math.floor(Date.parse(this.get()).getTime() / (1000 * 60 * 60 * 24));
    nOtherDay = Math.floor(Date.parse(this.parse(date)).getTime() / (1000 * 60 * 60 * 24));
    return (nThisDay < nOtherDay);
});


/**
* To indicate whether or not the date (or date/time) argument is after this field's value
* @param Date string
* @return True if this field's value represents a point in time after the date argument
*/
module.exports.define("isAfter", function (date) {
    var nThisDay;
    var nOtherDay;

    if (!this.get() || !date) {
        return false;
    }
    nThisDay = Math.floor(Date.parse(this.get()).getTime() / (1000 * 60 * 60 * 24));
    nOtherDay = Math.floor(Date.parse(this.parse(date)).getTime() / (1000 * 60 * 60 * 24));
    return (nThisDay > nOtherDay);
});


module.exports.override("set", function (new_val) {
    if (typeof new_val === "object" && typeof new_val.getFullYear === "function") {
        new_val = new_val.internal();
    } else if (typeof new_val === "string") {
        new_val = this.parse(new_val);
        // if (!Date.isValid(new_val, this.internal_format)
        //         && Date.isValid(new_val, this.update_format)) {
        //     new_val = Date.parseString(new_val, this.update_format).format(this.internal_format);
        // }
    } else if (!new_val) {
        new_val = "";
    }
    Data.Text.set.call(this, new_val);
});


module.exports.defbind("validateDate", "validate", function () {
    var date;
    if (this.val) {                // Only do special validation if non-blank
        date = Date.parse(this.val);
        if (date && date.format(this.internal_format) === this.val) {
            if (this.min && this.val < this.parse(this.min)) {
                this.messages.add({
                    type: "E",
                    text: "earlier than minimum value: " + this.parseDisplay(this.min),
                });
            }
            if (this.max && this.val > this.parse(this.max)) {
                this.messages.add({
                    type: "E",
                    text: "later than maximum value: " + this.parseDisplay(this.max),
                });
            }
        } else {            // not a valid date
            this.messages.add({
                type: "E",
                text: this.error_message,
            });
        }
    }
});


module.exports.override("getTextFromVal", function () {
    var val = this.get();
    if (val) {
        try {
            val = Date.parse(val).format(this.display_format);
        } catch (e) {
            this.trace(e.toString());
        }          // leave val as-is if date is invalid
    }
    return val;
});

/*
module.exports.override("generateTestValue", function (min, max) {
    var i;
    min = Date.parse(min || this.min || "2000-01-01");
    max = Date.parse(max || this.max || "2019-12-31");
    i = Math.floor(Math.random() * min.daysBetween(max));
//    return Lib.formatDate(Lib.addDays(min, i));
    return min.add('d', i).format(this.internal_format);
});
*/
