// open a new DB
const dbPromise = idb.open(
    // name of DB to open in indexedDB
    'posts-store',
    // version of DB
    1,
    db => {
        console.log('objectStoreNames', db.objectStoreNames)
        // check if the store does not exist before creating it
        if (!db.objectStoreNames.contains('posts')) {
            db.createObjectStore(
                'posts',
                // set primary key
                {
                    // name used to retrieve data
                    keyPath: 'id'
                }
            );
        }
    });

const writeData = (st, data) => {
//   use st input parameter name to avoid namespace collision !!
    return dbPromise
        .then(db => {
            // create a transaction
            const tx = db.transaction(st, 'readwrite');

            // open the store
            const store = tx.objectStore(st);

            // store in database
            store.put(data);
            // close the transaction
            return tx.complete;
        });
};

const readAllData = st => {
     return dbPromise
        .then(db => {
            const tx = db.transaction(st, 'readonly');
            const store = tx.objectStore(st);
            return store.getAll();
            // don't need to complete the transactio here, done auto
        });
};



