"use strict";

var Data = require("lapis-data");

/**
* An OrderedMap of fields, whose ids are unique within this object
*/
module.exports = Data.Entity.clone({
    id: "List",
    legacy_id: "sy_list",
    title: "List of Values",
    legacy_area_id: "sy",
    display_page: true,
    autocompleter: true,
    transactional: true,
    full_text_search: true,
    title_field: "title",
    default_order: "area,title",
    primary_key: "area,id",
    plural_label: "Lists of Values",
    data_volume_oom: 2,
});


module.exports.addFields([
    {
        id: "area",
        label: "Area",
        type: Data.Text,
        data_length: 2,
        mandatory: true,
        search_criterion: true,
        list_column: true,
        config_item: "x.data.areas",
    },
    {
        id: "id",
        label: "Id",
        type: Data.Text,
        data_length: 40,
        mandatory: true,
        search_criterion: true,
        list_column: true,
    },
    {
        id: "title",
        label: "Title",
        type: Data.Text,
        data_length: 160,
        mandatory: true,
        search_criterion: true,
        list_column: true,
    },
]);


module.exports.define("indexes", []);
