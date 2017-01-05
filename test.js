"use strict";

var Data = require("lapis-data");


module.exports.FieldSet_main = function (test) {
    var fieldset;
    var field;

    test.expect(130);

    fieldset = Data.FieldSet.clone({ id: "test_1", });        // basic fieldset
    test.ok(!fieldset.isModifiable(), "FieldSet is by default unmodifiable");
    test.ok(!fieldset.isModified(), "FieldSet is by default initially unmodified");
    test.equal(fieldset.length(), 0, "FieldSet is by default initially empty");
    test.ok(fieldset.isValid(), "FieldSet is by default initially valid");
    field = fieldset.addField({
        id: "name",
        type: Data.Text,
        regex_pattern: "^[A-Z]['A-Za-z-]*, [A-Z]['A-Za-z- ]*$",
    });
    test.ok(!fieldset.isModified(), "FieldSet is still unmodified");
    test.equal(fieldset.length(), 1, "FieldSet now has 1 field");
    test.ok(fieldset.isValid(), "FieldSet is still valid");
    try {
        field.set("Bryson, Bill");
        test.ok(false, "Can't set a field in an unmodifiable FieldSet");
    } catch (e) {
        test.equal(e.toString(), "Error: fieldset not modifiable", "Unexpected exception: " + e);
    }
    test.equal(fieldset.getField("name"), field, "Field got by getField(name)");
    test.equal(fieldset.getField(0), field, "Field got by getField(0)");
    test.equal(typeof fieldset.getField("blah"), "undefined", "getField(blah) returns undefined");
    test.equal(typeof fieldset.getField(1), "undefined", "getField(1) returns undefined");
    try {
        fieldset.getField({});
        test.ok(false, "getField({}) throws exception");
    } catch (e) {
        test.equal(e.toString(), "Error: invalid argument: [object Object]", "getField({}) throws exception: " + e);
    }

    fieldset = Data.FieldSet.clone({
        id: "test_2",
        modifiable: true,
    });        // modifiable fieldset
    test.ok(fieldset.isModifiable(), "FieldSet is modifiable");
    test.ok(!fieldset.isModified(), "FieldSet is by default initially unmodified");
    test.equal(fieldset.length(), 0, "FieldSet is by default initially empty");
    test.ok(fieldset.isValid(), "FieldSet is by default initially valid");

    field = fieldset.addField({
        id: "name",
        type: Data.Text,
        regex_pattern: "^[A-Z]['A-Za-z-]*, [A-Z]['A-Za-z- ]*$",
    });
    test.ok(!fieldset.isModified(), "FieldSet is still unmodified");
    test.equal(fieldset.length(), 1, "FieldSet now has 1 field");
    test.ok(fieldset.isValid(), "FieldSet is still valid");

    field.set("Bryson, Bill");
    test.ok(true, "Can set a field in a modifiable FieldSet");
    test.ok(fieldset.isModified(), "FieldSet is modified");
    test.ok(fieldset.isValid(), "FieldSet is still valid");
    test.ok(field.isModified(), "Field is modified");
    test.ok(field.isValid(), "Field is still valid");
    test.equal(field.messages.count(), 0, "Field has no error messages");
    test.equal(field.get(), "Bryson, Bill", "Field returns same value");
    test.equal(field.getText(), "Bryson, Bill", "Field returns same value as text label");
    field.set("Bill Bryson");
    test.ok(!fieldset.isValid(), "FieldSet is now invalid (doesn't match regex)");
    test.ok(!field.isValid(), "Field is now invalid");
    test.equal(field.messages.count(), 1, "Field has 1 error message");
    test.equal(field.messages.messages[0].text, "match pattern", "Error is 'match pattern'");
    field.setProperty("regex_label", "Name must be of form 'Surname, Firstname'");
    field.validate();
    test.equal(field.messages.messages[0].text, "Name must be of form 'Surname, Firstname'", "Error is 'Name must be of form 'Surname, Firstname''");

    field.set("O'Leary, Michael");
    test.ok(fieldset.isValid(), "FieldSet is now valid again (set to new name including ')");
    field.set("Moggs, Mary");
    test.ok(fieldset.isValid(), "FieldSet is now valid again (set to new name)");
    test.ok(field.isValid(), "Field is now valid again");
    test.equal(field.messages.count(), 0, "Field has 0 error messages");
    field.setProperty("data_length", 10);
    test.ok(!fieldset.isValid(), "FieldSet is now made invalid by a property changes");
    test.ok(!field.isValid(), "Field is now now made invalid by a property changes");
    test.equal(field.messages.count(), 1, "Field has 1 error message");
    test.equal(field.messages.messages[0].text, "longer than 10 characters", "Error is 'longer than 10 characters'");

    field.set("");
    test.ok(field.isValid(), "Field is now valid again (set blank)");
    field.setProperty("mandatory", true);
    test.ok(!field.isValid(), "Field is now invalid (mandatory)");
    test.equal(field.messages.count(), 1, "Field has 1 error message");
    test.equal(field.messages.messages[0].text, "mandatory", "Error is 'mandatory'");
    field.setProperty("editable", false);

    field.set("Green, Sue");
    test.ok(field.isValid(), "Field is now valid (mandatory & non-blank, length = data_length)");

    field = fieldset.addField({
        id: "birthday",
        type: Data.Date,
        label: "Someone's Birthday",
        editable: true,
        mandatory: true,
    });
    // test.ok(field.isValid(), "Field reports being valid even though blank and mandatory -
    // does NOT automatically call validate() !!!");
    // field.validate();
    test.ok(!field.isValid(), "Field is now invalid (mandatory)");
    test.ok(!fieldset.isValid(), "FieldSet is now invalid (mandatory)");
    test.equal(field.messages.count(), 1, "Field has 1 error message");
    test.equal(field.messages.messages[0].text, "mandatory", "Error is 'mandatory'");
    field.set("28/02/09");
    test.ok(field.isValid(), "Field is now valid");
    test.ok(fieldset.isValid(), "FieldSet is now valid");
    test.equal(field.messages.count(), 0, "Field has 0 error message");
    test.equal(field.getText(), "28/02/09", "Text representation of date");
    test.equal(field.get(), "2009-02-28", "Internal representation of date");

    field.set("29/02/09");
    test.ok(!field.isValid(), "Field is now invalid (non-existent date)");
    test.ok(!fieldset.isValid(), "FieldSet is now invalid (non-existent date)");
    test.equal(field.messages.count(), 1, "Field has 1 error message");
    test.equal(field.messages.messages[0].text, "not a valid date", "Error is 'not a valid date'");
    test.equal(field.getText(), "29/02/09", "Text representation of invalid date");
    test.equal(field.get(), "29/02/09", "Internal representation of invalid date");

    field.set("bleurgh");
    test.ok(!field.isValid(), "Field is now invalid (not a date)");
    test.ok(!fieldset.isValid(), "FieldSet is now invalid (not a date)");
    test.equal(field.messages.count(), 1, "Field has 1 error message");
    test.equal(field.messages.messages[0].text, "not a valid date", "Error is 'not a valid date'");
    test.equal(field.getText(), "bleurgh", "Text representation of invalid date");
    test.equal(field.get(), "bleurgh", "Internal representation of invalid date");
    field.set("28/02/09");            // Make birthday field valid again

    field = fieldset.addField({
        id: "age",
        type: Data.Number,
        label: "Someone's Age",
        editable: true,
    });
    test.ok(field.isValid(), "Field is now valid (blank)");

    field.set("50");
    test.ok(field.isValid(), "Field is now valid (50)");
    test.ok(fieldset.isValid(), "FieldSet is now valid");
    test.equal(field.messages.count(), 0, "Field has 0 error message");
    test.equal(field.getText(), "50", "Text representation of number");
    test.equal(field.get(), "50", "Internal representation of number");

    field.set("20k");
    test.ok(!field.isValid(), "Field is now invalid (not a number)");
    test.ok(!fieldset.isValid(), "FieldSet is now invalid (not a number)");
    test.equal(field.messages.count(), 1, "Field has 1 error message");
    test.equal(field.messages.messages[0].text, "20k is not a number", "Error is '20k is not a number'");
    test.equal(field.getText(), "20k", "Text representation of invalid number");
    test.equal(field.get(), "20k", "Internal representation of invalid number");
    field.set("100");            // Make age field valid again

    field = fieldset.addField({
        id: "empl_type",
        type: Data.Option,
        label: "Employment Type",
        list: "rm.empl_type",
        editable: true,
    });
    test.ok(field.isValid(), "Field is now valid (blank)");
    field.set("P");
    test.ok(field.isValid(), "Field is valid with value P");
    test.ok(fieldset.isValid(), "FieldSet is now valid");
    test.equal(field.messages.count(), 0, "Field has 0 error message");
    test.equal(field.getText(), "permanent", "Text representation of value P");
    test.equal(field.get(), "P", "Internal representation of value P");
    field.set("Q");
    test.ok(!field.isValid(), "Field is now invalid (value Q)");
    test.ok(!fieldset.isValid(), "FieldSet is now invalid (value Q)");
    test.equal(field.messages.count(), 1, "Field has 1 error message");
    test.equal(field.messages.messages[0].text, "invalid option: Q", "Error is 'invalid option: Q'");
    test.equal(field.getText(), "[unknown]: Q", "Text representation of invalid option Q");
    test.equal(field.get(), "Q", "Internal representation of invalid option Q");
    // LoV.getListLoV("rm.empl_type").getItem("T").active = false;
    field.lov.getItem("T").active = false;
    field.set("T");
    field.validate();
    test.ok(!field.isValid(), "Field is invalid with value T");
    test.ok(!fieldset.isValid(), "FieldSet is now invalid (value T)");
    test.equal(field.messages.count(), 1, "Field has 1 error message" + field.messages.count());
    test.equal(field.messages.messages[0].text, "invalid option: T", "Error is 'invalid option: T'");
    field.lov.getItem("T").active = true;
    field.set("T");
    field.validate();
    test.equal(field.getText(), "temp", "Text representation of option T");
    test.equal(field.get(), "T", "Internal representation of option T");
    field.set("X");            // Make empl_type field valid again

    field = fieldset.addField({
        id: "empl_type2",
        type: Data.Attributes,
        label: "Employment Type",
        list: "rm.empl_type",
        editable: true,
    });
    test.ok(field.isValid(), "Field is now valid (blank)");
    field.setItem("P", true);
    test.ok(field.isValid(), "Field is valid with value P");
    test.ok(fieldset.isValid(), "FieldSet is now valid");
    test.equal(field.messages.count(), 0, "Field has 0 error message");
    test.equal(field.getText(), "permanent", "Text representation of value P");
    test.equal(field.get(), "|P|", "Internal representation of value |P|");
    field.setItem("Q", false);
    test.ok(field.isValid(), "Setting invalid item to false has no effect");
    field.setItem("Q", true);
    test.ok(!field.isValid(), "Field is invalid with value P & Q");
    test.equal(field.messages.count(), 1, "Field has 1 error message");
    test.equal(field.messages.messages[0].text, "invalid option: Q", "Error is 'invalid option: Q'");
    test.equal(field.getText(), "permanent, [unknown: Q]", "Text representation of value P & Q");
    test.equal(field.get(), "|P|Q|", "Internal representation of value |P|Q|");
    field.lov.getItem("T").active = false;
    field.setItem("T", true);
    field.validate();
    test.ok(!field.isValid(), "Field is invalid with value P, Q & T");
    test.equal(field.messages.count(), 2, "Field has 2 error message" + field.messages.count());
    test.equal(field.messages.messages[0].text, "invalid option: Q", "Error is 'invalid option: Q'");
    test.equal(field.messages.messages[1].text, "option is inactive: temp", "Error is 'option is inactive: Temp'");
    test.equal(field.getText(), "permanent, [unknown: Q], temp", "Text representation of value P, Q & T");
    test.equal(field.get(), "|P|Q|T|", "Internal representation of value |P|Q|T|");
    field.lov.getItem("T").active = true;
    field.setItem("Q", false);
    field.validate();
    test.ok(field.isValid(), "Field is valid with value P & T");
    test.equal(field.messages.count(), 0, "Field has 0 error message");
    test.equal(field.getText(), "permanent, temp", "Text representation of value P & T");
    test.equal(field.get(), "|P|T|", "Internal representation of value |P|T|");

    field = fieldset.addField({
        id: "user_id",
        type: Data.Reference,
        label: "User",
        ref_entity: "ac_user",
        editable: true,
    });
    test.ok(field.isValid(), "Field is now valid (blank)");
    field.set("batch");
    field.validate();
    test.ok(field.isValid(), "Field is valid with value 'batch'");
    test.ok(fieldset.isValid(), "FieldSet is now valid");
    test.equal(field.messages.count(), 0, "Field has 0 error message");
    test.equal(field.getText(), "Batch Run", "Text representation of value 'batch'");
    test.equal(field.get(), "batch", "Internal representation of value 'batch'");
    field.set("bleurgh");
    test.ok(!field.isValid(), "Field is now invalid (value 'bleurgh')");
    test.ok(!fieldset.isValid(), "FieldSet is now invalid (value 'bleurgh')");
    test.equal(field.messages.count(), 1, "Field has 1 error message");
    test.equal(field.messages.messages[0].text, "invalid reference: bleurgh", "Error is 'invalid reference: bleurgh'");
    test.equal(field.getText(), "[unknown: bleurgh]", "Text representation of invalid option bleurgh");
    test.equal(field.get(), "bleurgh", "Internal representation of invalid option bleurgh");
    field.set("batch");            // Make user_id field valid again

    field = fieldset.addField({
        id: "home_page",
        type: Data.URL,
        label: "Home Page",
        editable: true,
    });
    field.set("www.google.com");
    test.ok(field.isValid(), "URL is valid");
    test.equal(field.get(), "www.google.com", "Internal representation of URL is valid");
    test.equal(field.getText(), "www.google.com", "Text representation of URL is valid 3" + field.url);
    test.equal(field.getURL(), "www.google.com", "URL representation of URL is valid 3" + field.getURL());
    field.editable = true;
    field.setProperty("url_pattern", "../main/some_page?page_key={val}");
    field.set("14");
    test.equal(field.get(), "14", "Internal representation of URL is valid");
    // test.equal(field.getURL(), "../main/some_page?page_key=14",
    // "URL representation of URL is valid");

    test.done();
};



function isSorted(arr) {
    var len = arr.length - 1, i;
    for (i = 0; i < len; i += 1) {
        if (arr[i].getKey() > arr[i+1].getKey()) {
            return false;
        }
    }
    return true;
}

module.exports.Manager_main = function (test) {
    var manager = Data.Manager.clone({
        id: "Manager",
        instance: true,
    });
    var counters = manager.getRecordCount();

    test.expect(22);

    test.equal(counters.full_key_modified, 0, "initial count of full key modified is zero");
    test.equal(counters.full_key_unmodified, 0, "initial count of full key unmodified is zero");
    test.equal(counters.full_key_valid, 0, "initial count of full key valid is zero");
    test.equal(counters.full_key_invalid, 0, "initial count of full key invalid is zero");
    test.equal(counters.full_key_total, 0, "initial count of full key is zero");
    test.equal(counters.partial_key_modified, 0, "initial count of partial key modified is zero");
    test.equal(counters.partial_key_unmodified, 0, "initial count of partial key unmodified is zero");
    test.equal(counters.partial_key_total, 0, "initial count of partial key is zero");
    test.equal(counters.modified_total, 0, "initial count of modified is zero");
    test.equal(counters.unmodified_total, 0, "initial count of unmodified is zero");
    test.equal(counters.total, 0, "initial count of total is zero");

    // adding single type rows
    manager.createNewRecord("List");
    manager.createNewRecord("List");

    counters = manager.getRecordCount();
    test.equal(counters.full_key_modified, 0, "initial count of full key modified is zero");
    test.equal(counters.full_key_unmodified, 0, "initial count of full key unmodified is zero");
    test.equal(counters.full_key_valid, 0, "initial count of full key valid is zero");
    test.equal(counters.full_key_invalid, 0, "initial count of full key invalid is zero");
    test.equal(counters.full_key_total, 0, "initial count of full key is zero");
    test.equal(counters.partial_key_modified, 0, "initial count of partial key modified is zero");
    test.equal(counters.partial_key_unmodified, 2, "initial count of partial key unmodified is 2");
    test.equal(counters.partial_key_total, 2, "initial count of partial key is 2");
    test.equal(counters.modified_total, 0, "initial count of modified is zero");
    test.equal(counters.unmodified_total, 2, "initial count of unmodified is 2");
    test.equal(counters.total, 2, "initial count of total is 2");

    test.done();
};
