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
        // store for backgeound sync
        if (!db.objectStoreNames.contains('sync-posts')) {
            db.createObjectStore(
                'sync-posts',
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

// good practice to clear the DB before updating it because can keep copy of data deleted on the server
const clearAllData = (st) => {
    return dbPromise
        .then(db => {
            const tx = db.transaction(st, 'readwrite');
            const store = tx.objectStore(st);
            // remove all elements from the store
            store.clear();
            // return complete on every write operation to maintain DB ontegrity
            return tx.complete;
        });
}

const deleteItemFromData = (st, id) => {
    // don't need to return because the promise is handled
    return dbPromise
        .then(db => {
            const tx = db.transaction(st, 'readwrite');
            const store = tx.objectStore(st);
            // remove elements from the store
            store.delete(id);
            return tx.complete;
        })
        // here
        .then(() => {
            console.log('item deleted');
        });
}

const urlBase64ToUint8Array = base64String => {
    var padding = '='.repeat((4 - base64String.length % 4) % 4);
    var base64 = (base64String + padding)
        .replace(/\-/g, '+')
        .replace(/_/g, '/');

    var rawData = window.atob(base64);
    var outputArray = new Uint8Array(rawData.length);

    for (var i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

const dataURItoBlob = dataURI => {
    var byteString = atob(dataURI.split(',')[1]);
    var mimeString = dataURI.split(',')[0].split(':')[1].split(';')[0]
    var ab = new ArrayBuffer(byteString.length);
    var ia = new Uint8Array(ab);
    for (var i = 0; i < byteString.length; i++) {
      ia[i] = byteString.charCodeAt(i);
    }
    var blob = new Blob([ab], {type: mimeString});
    return blob;
  };