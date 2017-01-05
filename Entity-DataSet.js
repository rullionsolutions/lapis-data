/*global x, _ */
"use strict";


/**
* Create a new transactional record object inherited from this entity object, or a descendant of this one
* @param transaction object, action code string ('C', 'U' or ''), key string (if action <> 'C') or addl_data passed into createNewRow() (if action = 'C')
* @return Newly cloned record object
*/
x.data.Entity.define("getTransRow", function (dataset, action /*, key, addl_data*/) {
    var row_number = dataset.row_number,
        row;

    dataset.row_number += 1;
    row = this.clone({
        id        : this.id,
        modifiable: true,
        instance  : true,
        row_number: row_number,
        action    : action
    });
    return row;
});

