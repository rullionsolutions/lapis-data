# lapis-data
Field, Entity and Data Management



## DataManager

The purpose of the DataManager is:
* to organize a local, in-memory, synchronous cache of Record objects
* to isolate the rest of the application from the persistance of the Record objects - in terms of its API (IndexedDB Store, Ajax calls to remote database) and its format - JSON Documents or other.

Asynchronicity of existing data availability is handled WITHIN the Record object - i.e. the Record object representing a key is created immediately, but is not synchronously 'ready' if it needs to retrieve existing data from the store via the DataManager.

It can provide a Promise on its next being ready.

It become subsequently unready if:
* it is saving changes to the store via the DataManager
* it is processing logic that may update one or more of its values based on the data in other record(s).


### API

* DataManager.getRecord(entity_id, key) - main record retrieval method for an existing data Record object, returning a Record from the cache or creating it if it is not there

* DataManager.createNewRecord(entity_id) - creates a new Record object representing new data - the returned Record object will be "full key" if it can auto-generate its key, otherwise will be initially "partial key" until all its key fields are populated

* DataManager.doFullKeyRecords(funct) - iterate over the full-key Record objects in the cache

* DataManager.doPartialKeyRecords(funct) - iterate over the partial-key Record objects in the cache

* DataManager.isValid() - true if all the newly-created or modified Record objects that are not marked for deletion are valid (i.e. each such Record object's isValid() method returns true)

* DataManager.save() - save all newly-created, modified and deleting Record objects, if isValid() returns true

* Entity.createChildRecord(entity_id)

* Entity.getChildRecord(entity_id, relative_key)


### Internal Methods


* DataManager.getRecordNullIfNotInCache(entity_id, key), getRecordThrowIfNotInCache(entity_id, key) - local cache operation only, returning a Record from the cache or, if it is not there, returning null or throwing an error, respectively

* DataManager.getExistingRecordNotInCache(entity_id, key) - creates a new Record object representing existing data

* DataManager.addToCache(record, prev_key) - add the newly-created Record object to the cache or update the existing Record object's place in the cache (i.e. when its key changes)


### Loading

1. DataManager.getExistingRecordNotInCache():
  1. creates the new Record object by called getRecord() on the Entity
  2. adds it to the cache
  3. calls getReadyPromise() on the new Record object...

2. Record.getReadyPromise()
  1. as there shouldn't be a ready promise already defined on the object, set it to DataManager.getLoadingPromise()

3. DataManager.getLoadingPromise()
  * This is part of the interface onto the store
  * If using a Document store (DataManagerDocs), check if the Record object has a parent record, and if so (i.e. Entity.getChildRecord() called), use that
  * Otherwise, get the relevant Document from the store, using the store.get() method, and use the returned promise, binding populateFromObject() and then happen("initUpdate") to it

If loading records from a Document, the DataManager might want to create Record objects for all the returned data, even if not yet requested.



## DataSet

The purpose of the DataSet is:
* to manage a subset of the records in DataManager that is defined by some selection criteria
* to detect when:
  * newly-created records are added to the DataSet
  * records in the DataSet are deleted
  * existing records are changed such that they join or leave the DataSet

Sounds complicated!

How about, initially, it simply focuses on same-entity children of a single parent record, with their link fields locked to prevent leaves?


### API

* Happens: recordAdded, recordRemoved

* DataSet.criteria.add(spec) as defined below

#### Criteria Types

|Purpose                    |spec object  |
|---------------------------|-------------|
|One Specific Entity        |{ entity_id: <string> }|
|Set of Specific Entities   |{ entity_id: <array of string> }|
|Single Field Condition     |{ field_id: <string>, operator: <optional string>, value: <string> }|


