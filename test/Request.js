"use strict";

// var Core = require("lapis-core");
var Core = require("lapis-core")
var Data = require("lapis-data");
var Http = require("http");

var manager = Data.Manager.clone({
    id: "Manager",
    instance: true,
    server_http_options: {
        hostname: "127.0.0.1",
        port: 8080,
        request_index: 0,
        method: "POST",
    },
});

var request_data = [
    [
        {
            entity_id: "List",
            key: "sy.active",
            modifiable: true,
        },
    ],
    [
        {
            entity_id: "List",
            key: "rm.empl_type",
            modifiable: false,
        },
        {
            entity_id: "List",
            key: "rm.status",
            modifiable: true,
        },
    ],
    [
        {
            entity_id: "List",
            key: "qq.kjsjhk",      // not found
        },
    ],
];

var response_data = [
    [       // test 0
        {
            entity_id: "List",
            key: "sy.active",
            area: "sy",
            id: "active",
            title: "Active / Inactive",
        },
    ],
    [       // test 1
        {
            entity_id: "List",
            key: "rm.empl_type",
            area: "rm",
            id: "empl_type",
            title: "Engagement Type",
        },
        {
            entity_id: "List",
            key: "rm.status",
            area: "rm",
            id: "status",
            title: "Resource Status",
        },
    ],
    [
        {
            entity_id: "List",
            key: "qq.kjsjhk",      // not found
            error: "record not found",
        },
    ],
];

var server;
var record;

Core.Base.setLogLevel(2);


manager.override("getServerHttpOptions", function () {
    this.server_http_options.path = "/" + this.server_http_options.request_index;
    this.server_http_options.request_index += 1;
    return this.server_http_options;
});

function startHttpServer(test) {
    server = Http.createServer(function (req, resp) {
        var index = parseInt(req.url.substr(1), 10);
        var data = "";
        Core.Base.trace("request started, index: " + index);
        req.on("data", function (chunk) {
            data += chunk;
        });
        req.on("end", function () {
            Core.Base.trace("request received, index: " + index);
            test.deepEqual(JSON.parse(data), request_data[index]);
            resp.statusCode = 200;
            resp.setHeader("content-type", "application/json");
            resp.end(JSON.stringify(response_data[index]));
        });
    });
    server.listen(8080);
}


module.exports.main = function (test) {
    var request;
    var promise;

    try {
        Core.Base.debug("part A");
        test.expect(72);
        startHttpServer(test);

        test.equal(manager.new_records.length, 0, "manager object initialized okay - new_records array");
        test.equal(Object.keys(manager.curr_records).length, 0, "manager object initialized okay - curr_records array");
        test.equal(manager.isValid(), true, "manager object is initially valid");
        request = manager.getLoadRequest(request_data[0][0]);
        record = manager.getRecordThrowIfNotInCache("List", "sy.active");
        test.equal(record.status, "L", "requested record is at loading status");
        test.equal(record.isInitializing(), true, "requested record is initializing");
        test.equal(record.isModifiable(), false, "requested record is not modifiable");
        test.equal(record.instance, true, "requested record is an instance");
        test.equal(record.load_key, "sy.active", "requested record's load_key is 'sy.active'");
        test.equal(record.getKeyPieces(), 2, "requested record has 2 key pieces");
        test.equal(request.status, "D", "request status is initially 'D' (defining)");
        test.equal(request.criteria.length, 1, "request has one criterion");
        try {
            record.getField("title").set("blah");
            test.ok(false, "attempt to set field during load should throw, but doesn't");
        } catch (e) {
            test.ok(true, "attempt to set field during load should throw, and did");
        }
        promise = request.execute();
    } catch (e) {
        Core.Base.error("in part A: " + e);
        return;
    }
    promise.then(function () {
        var count;
        Core.Base.debug("part C");

        test.equal(request.status, "C", "request status is now 'C' (completed)");
        test.equal(record.status, "U", "loaded record is at unmodified status");
        test.equal(record.isInitializing(), false, "loaded record is not initializing");
        test.equal(record.getField("area").get(), "sy", "area field is set correctly");
        test.equal(record.getField("id").get(), "active", "id field is set correctly");
        test.equal(record.getField("title").get(), "Active / Inactive", "title field is set correctly");
        test.equal(record.isDelete(), false, "record is not being deleted");
        test.equal(record.isKeyComplete(), true, "loaded record has a complete key");
        test.equal(record.isValid(), true, "loaded record is valid");
        test.equal(record.isModified(), false, "loaded record is not modified");
        test.equal(record.isModifiable(), true, "loaded record is modifiable");
        test.equal(record.getFullKey(), "sy.active", "loaded record's full key is 'sy.active'");
        test.equal(record.getLabel(), "Active / Inactive", "loaded record's getLabel() returns 'Active / Inactive'");
        try {
            record.getField("title").set("blah");
            test.ok(true, "attempt to set field after load should be okay, and is");
        } catch (e) {
            test.ok(false, "attempt to set field after load should be okay, but it threw");
        }
        test.equal(record.isValid(), true, "altered record is valid");
        test.equal(record.isModified(), true, "altered record is modified");

        // two-part request
        test.equal(manager.isValid(), true, "manager object is initially valid");
        request = manager.getLoadRequest(request_data[1]);
        record = manager.getRecordThrowIfNotInCache("List", "rm.empl_type");
        test.equal(record.status, "L", "requested record is at loading status");
        test.equal(record.isInitializing(), true, "requested record is initializing");
        test.equal(record.isModifiable(), false, "requested record is not modifiable");
        test.equal(record.instance, true, "requested record is an instance");
        test.equal(record.load_key, "rm.empl_type", "requested record's load_key is 'rm.empl_type'");
        count = manager.getRecordCount();
        test.equal(count.full_key_modified, 1, "1 full-key modified record");
        test.equal(count.full_key_unmodified, 2, "2 full-key unmodified record");
        test.equal(count.partial_key_unmodified, 0, "0 partial-key unmodified records");
        test.equal(count.partial_key_modified, 0, "0 partial-key modified records");

        // test.ok(, "");
        return request.execute();
    })
    .then(function () {
        Core.Base.debug("part D");
        test.equal(request.status, "C", "request status is now 'C' (completed)");
        test.equal(record.status, "U", "loaded record is at unmodified status");
        test.equal(record.isInitializing(), false, "loaded record is not initializing");
        test.equal(record.getField("area").get(), "rm", "area field is set correctly");
        test.equal(record.getField("id").get(), "empl_type", "id field is set correctly");
        test.equal(record.getField("title").get(), "Engagement Type", "title field is set correctly");
        test.equal(record.isDelete(), false, "record is not being deleted");
        test.equal(record.isKeyComplete(), true, "loaded record has a complete key");
        test.equal(record.isValid(), true, "loaded record is valid");
        test.equal(record.isModified(), false, "loaded record is not modified");
        test.equal(record.isModifiable(), false, "loaded record is still not modifiable - was requested as unmodifiable");
        test.equal(record.getFullKey(), "rm.empl_type", "loaded record's full key is 'rm.empl_type'");
        test.equal(record.getLabel(), "Engagement Type", "loaded record's getLabel() returns 'Engagement Type'");

        // record not found
        test.equal(manager.isValid(), true, "manager object is initially valid");
        request = manager.getLoadRequest(request_data[2]);
        record = manager.getRecordThrowIfNotInCache("List", "qq.kjsjhk");
        test.equal(record.status, "L", "requested record is at loading status");
        return request.execute();
    })
    .then(function () {
        var count;
        Core.Base.debug("part E");
        test.equal(request.status, "C", "request status is now 'C' (completed)");
        test.equal(record.status, "E", "loaded record is at error status");
        test.equal(record.isInitializing(), false, "loaded record is not initializing");
        test.equal(record.isDelete(), false, "record is not being deleted");
        test.throws(function () { record.isKeyComplete(); }, "primary key field is blank: area", "attempt to get key throws an error");
        test.equal(record.isValid(), false, "loaded record is invalid");
        test.equal(record.isModified(), false, "loaded record is not modified");
        test.equal(record.isModifiable(), false, "loaded record is still not modifiable - was requested as unmodifiable");
        test.throws(function () { record.getFullKey(); }, "primary key field is blank: area", "attempt to get key throws an error");
        // test.equal(record.getLabel(), "Engagement Type", "loaded record's getLabel() returns 'Engagement Type'");
        test.equal(manager.isValid(), false, "manager is invalid");
        count = manager.getRecordCount();
        test.equal(count.full_key_modified, 1, "1 full-key modified record");
        test.equal(count.full_key_unmodified, 3, "3 full-key unmodified record");
        test.equal(count.full_key_valid, 3, "3 full-key valid record");
        test.equal(count.full_key_invalid, 1, "1 full-key invalid record");
        test.equal(count.full_key_total, 4, "4 full-key record in total");
    })
    .then(null, function (error) {
        Core.Base.error("part F: " + error);
        test.ok(false, error);
    })
    .then(function () {
        Core.Base.debug("part G");
        test.done();
        server.close();
    });

    Core.Base.debug("part B");
    test.equal(request.status, "R", "request status is now 'R' (requesting)");
};
