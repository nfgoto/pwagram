importScripts('/src/js/idb.js');
importScripts('/src/js/utility.js');

// latest cache version names
const CACHE_STATIC_NAME = 'static-v77';
const CACHE_DYNAMIC_NAME = 'dynamic-v15';
const STATIC_FILES = [
    '/', // request = mydomain/
    '/index.html', // request = mydomain/index.html
    '/offline.html',
    '/src/js/app.js',
    '/src/js/utility.js',
    '/src/js/feed.js',
    '/src/js/idb.js',
    '/src/js/promise.js',
    '/src/js/fetch.js',
    '/src/js/material.min.js',
    '/src/css/app.css',
    '/src/css/feed.css',
    '/src/images/pwa-logo.png',
    'https://fonts.googleapis.com/css?family=Roboto:400,700',
    'https://fonts.googleapis.com/icon?family=Material+Icons',
    'https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.indigo-pink.min.css'
];
const storePostDataCloudFunctionUrl = 'https://us-central1-pwagram-f2685.cloudfunctions.net/storePostData';

/* const trimCache = (cacheNane, maxItems) => {
    // open the cache
    caches.open(cacheNane)
        .then(cache => {
            return cache.keys()
                .then(keys => {
                    if (keys.length > maxItems) {
                        // remove oldest item from sub cache
                        cache.delete(keys[0])
                            // recursion to clean up the sub cache until less then maxItems
                            .then(trimCache(cacheNane, maxItems))
                    }
                });
        })

} */


// install event triggered by browser
self.addEventListener('install', event => {
    console.log('[SERVICE WORKER] Installing service worker', event);

    // access the Cache API and open a new domain, wait until promise returned from open()
    // to make sure that the cache preparation is done before conyinuing
    event.waitUntil(
        // choose a name for the cache to open, if not exists will create it
        // to cache updated files, you give new VERSIONED NAME = will cache all files again
        // you don't want to update old cache because could still be used, so you create a new sub cache to store updated files
        caches.open(CACHE_STATIC_NAME)
            .then(
                // reference to opened cache
                cache => {
                    // add files to the cache
                    console.log('[SERVICE WORKER] Precaching app shell (core features of app)');
                    // make a REQUEST to the resource from server, download it and and add it to the cache

                    cache.addAll(STATIC_FILES);
                }
            )
    );
});

// activate event triggered by browser
// service worker will not be auto activated if older SW already running (unless "update on reload" option is selected)
self.addEventListener('activate', event => {
    console.log('[SERVICE WORKER] Activating service worker', event);
    // to clean up older cache to avoid using outdated versions of files
    event.waitUntil(
        // returns an array of strings of keys of all the sub caches in the cache storage
        caches.keys()
            .then(
                keyList => {
                    // takes an array of promises and waits for them to finish
                    return Promise.all(
                        keyList.map(
                            key => {
                                if (key !== CACHE_STATIC_NAME && key !== CACHE_DYNAMIC_NAME) {
                                    console.log('[SERVICE WORKER] Removing old cache', key);
                                    //   return a promise that will be stored in array returned by map()
                                    return caches.delete(key);
                                }
                            }
                        )
                    );
                }
            )
    );
    // ensure that service worker is activated correctly
    return self.clients.claim();
});

// ================= BEST STRATEGY = CACHE, THEN NETWORK =================
// access the cache storage directly from the page without going through the SW
// 1) access to cache 
// 1) simultaneously access the service worker
// 2) data from cache sent to page
// 2) SW tries to get response from network
// 3) data sent back from network
// 4) store fetched data in cache storage (OPTIONAL)
// 5) fetched data is sent to the page without necessarily caching it


self.addEventListener('fetch', event => {
    // this is the only url for which we should the SW counterpart, not for others
    const url = 'https://pwagram-f2685.firebaseio.com/posts.json';


    if (event.request.url.indexOf(url) > -1) {
        event.respondWith(
            fetch(event.request)
                .then(
                    res => {
                        // store the formatted response into indexedDB
                        const copyResponse = res.clone();

                        // clear DB to avoid keeping data deleted on server
                        clearAllData('posts')
                            .then(() => copyResponse.json())
                            .then(
                                data => {
                                    // store every item in indexedDBk
                                    for (let key in data) {
                                        // store post in indexedDB
                                        writeData('posts', data[key]);
                                    }
                                }
                            );

                        // return the response so that the page can use it
                        return res;
                    }
                )
        );
    } else
        // check if request is about a static file
        if (STATIC_FILES.includes(event.request.url)) {
            // implement cache only - only updated when SW reinstalled
            event.respondWith(
                // we don't care about the netwrk, we only return assets from cache
                caches.match(event.request)
            );
        } else {
            // fallback on the cache and network strategy
            event.respondWith(
                caches.match(
                    event.request
                )
                    .then(
                        response => {
                            if (response) {
                                return response;
                            } else {
                                return fetch(event.request)
                                    .then(
                                        res => {
                                            return caches.open(CACHE_DYNAMIC_NAME)
                                                .then(
                                                    cache => {
                                                        // trim sub cache before puting more
                                                        // trimCache(CACHE_DYNAMIC_NAME, 3);
                                                        cache.put(
                                                            event.request.url,
                                                            res.clone()
                                                        );

                                                        return res;
                                                    }
                                                );
                                        }
                                    )
                                    .catch(
                                        err => {
                                            return caches.open(CACHE_STATIC_NAME)
                                                .then(
                                                    cache => {
                                                        // routing strategy
                                                        // only return the offline page if the request is to a page
                                                        if (event.request.headers.get('accept').includes('text/html')) {
                                                            return cache.match('/offline.html');
                                                        }
                                                        // you can return ant fallback resource that was cached (image...)
                                                    }
                                                );
                                        }
                                    );
                            }
                        }
                    )
            );
        }
});



// ================= CACHE WITH NETWORK FALLBACK STRATEGY ================= 

// non-lifecycle event (here, onetriggered by HTML), fetch = when browser loads smth
/*
self.addEventListener('fetch', event => {
    // override data sent back, setting to null makes site unreachable because nothing sent back
    // respondWith expects a promise a input argument
    event.respondWith(
        // allows to send HTTP requests
        //  returns a promise as soon as network request is done
        //fetch(event.request)

        // respond with cached asset
        // caches is the global cache and matches() to see if sub cache is found
        caches.match(
            // requests are keys in the cache, key is always a Requst object, never a string
            event.request
        )
            .then(response => {
                // if request not in cache, response == null, NOT an error
                if (response) {
                    // return the value from the cache corresponding to that request
                    // intercepting the request, no network request made
                    return response;
                } else {
                    // not found in cache so send request to network
                    return fetch(event.request)
                        // add to cache dynamically = cache the response
                        .then(res => {
                            //   open a new cache, don't forget to return the result of the promise to have sonething to display
                            return caches.open(CACHE_DYNAMIC_NAME)
                                .then(cache => {
                                    // #put does not send request, contrary to #add
                                    // only puts in cache based on url and value
                                    cache.put(
                                        res.url,
                                        // #CLONE = to be able to use the res later because only usable ONCE
                                        res.clone()
                                    );

                                    return res;
                                });
                        })
                        .catch(err => {
                            return caches.open(CACHE_STATIC_NAME)
                                .then(cache => {
                                    // return the fallback page if no network and not in cache
                                    return cache.match('/offline.html');
                                }
                                )
                        });
                }
            })
    )
});
*/

// ================= CACHE ONLY STRATEGY ================= 
/*self.addEventListener('fetch', event => {
    event.respondWith(
        // we don't care about the netwrk, we only return assets from cache
        caches.match(event.request)
    )
});*/


// ================= NETWORK ONLY STRATEGY =================
/* self.addEventListener('fetch', event => {
    event.respondWith(
        // we don't care about the netwrk, we only return assets from cache
        fetch(event.request)
    )
}); */

// ================= NETWORK WITH CACHE FALLBACK STRATEGY =================
// bad UX because user is shown cached version after timeout
// mostly for resources that you can fetch in the background
/* self.addEventListener('fetch', event => {
    // fetch first
    fetch(event.request)
        // dynamic caching of fetched resources
        .then(res => {
            return caches.open(CACHE_DYNAMIC_NAME)
                .then(cache => {
                    cache.put(
                        res.url,
                        res.clone()
                    );

                    return res;
                });
        })
        // network request fail
        .catch(err => {
            return caches.match(
                event.request
            );
        })
}); */

// register the sync event
// this event will be sent when connectivity is reestablished (or always when there is connection)
self.addEventListener('sync', event => {
    // send reauest to the server
    console.log('[SERVICE WORKER] BACKGROUND SYNCHING', event);

    // check the event tag
    if (event.tag === 'sync-new-posts') {
        console.log('[SERVICE WORKER] SYNCHING NEW POST');

        // waitt until data is sent
        event.waitUntil(
            readAllData('sync-posts')
                .then(
                    data => {
                        // loop through new posts to synch
                        for (let post of data) {
                            // FormData built-in JS constructor that allow to send mix of key/value pairs with files through AJAX
                            const postData = new FormData();
                            postData.append('id', post.id);
                            postData.append('title', post.title);
                            postData.append('location', post.location);
                            postData.append(
                                'file',
                                post.picture,
                                //  override name of the file
                                `${post.id}.png`
                            );

                            fetch(storePostDataCloudFunctionUrl, {
                                method: 'POST',
                                body: postData  // Content'type header is inferred
                            })
                                // clean the sync-new-posts store
                                .then(
                                    res => {
                                        // ONLY delete from indexedDB if data sent succesfully
                                        if (res.ok) {
                                            res
                                                .json()
                                                .then(
                                                    resData => {
                                                        console.log('[SERVICE WORKER] POST SENT');
                                                        deleteItemFromData('sync-posts', resData.id);
                                                    }
                                                );
                                        }
                                    }
                                )
                                .catch(
                                    err => {
                                        console.log('[SERVICE WORKER] ERROR WHILE SENDING DATA', err);
                                    }
                                );
                        }
                    }
                )
        );
    }
}
);

self.addEventListener('notificationclick', event => {
    // which notification
    const notification = event.notification;

    //   which action has been clicked
    const action = event.action;

    console.log('[SERVICE WORKER] NOTIFICATION CLICKED', notification);

    switch (action) {
        case 'confirm': {
            console.log('Confirm action was clicked');
            // automatic on some devices
            return notification.close();
        }
        default: {
            console.log('ACTION CLICKED: ', action);
            // open a page
            event.waitUntil(
                // clients = all browser tasks managed to this SW
                clients
                    // access all the clients
                    .matchAll()
                    .then(
                        allFoundClients => {
                            //   find windows managed by this SW which are visible
                            const openedCli = allFoundClients.find(
                                // returns the first opened browser window managed by this SW
                                cli => cli.visibilityState === 'visible'
                            );

                            if (openedCli) {
                                // navigate to a url
                                openedCli.navigate(notification.data.url);
                                openedCli.focus();
                            } else {
                                // open a new tab or window
                                clients.openWindow(notification.data.url);
                            }

                            return notification.close();
                        }

                    )
            );
        }
    }
});

self.addEventListener('notificationclose', event => {
    console.log('[SERVICE WORKER] NOTIFICATION CLOSED', event);
});

self.addEventListener('push', event => {
    console.log('PUSH NOTIFICATION RECEIVED !!', event);

    // set up a dummy data in case as a fallback if no payload
    // the properties must have the same identifiers as the ones in the payload that we pass when sending the push notification on our backend server to the browser vendor endpoint
    let data = {
        title: 'New !',
        content: 'Something New Happened',
        openUrl: '/'
    };

    // check if there is a payload/data attached to the received push notification
    if (event.data) {
        data = JSON.parse(
            // retrieve the the text from the data
            event.data.text()
        );

        // show a new notification
        const notificationOptions = {
            body: data.content,
            icon: '/src/images/icons/app-icon-96x96.png',
            badge: '/src/images/icons/app-icon-96x96.png',
            // pass extra metadata to the notification (anything you want)
            // data that can later be used upon interaction in the notification handlers
            // available via event.notification.data in the notification handlers
            data: {
                url: data.openUrl
            }
        };

        //wait to make sure the notification is displayed
        event.waitUntil(
            // have to access to the registration because the SW by itself cannot show the notification
            // the registration is the part of the SW working in the browser
            self.registration.showNotification(data.title, notificationOptions)
        );
    }
});