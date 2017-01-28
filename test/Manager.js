"use strict";

var Data = require("lapis-data");


module.exports.main = function (test) {
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
