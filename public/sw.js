// self refers to the server worker
// listenable events to service workers, not DOM events

// the cache storage is not where you want to store files (json, etc)
// only store there the APP SHELL

// latest cache version names
const CACHE_STATIC_NAME = 'static-v15';
const CACHE_DYNAMIC_NAME = 'dynamic-v6';


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
            .then(cache /* reference to opened cache */ => {
                // add files to the cache
                console.log('[SERVICE WORKER] Precaching app shell (core features of app)');
                // make a REQUEST to the resource from server, download it and and add it to the cache

                cache.addAll([
                    '/', // request = mydomain/
                    '/index.html', // request = mydomain/index.html
                    '/offline.html',
                    '/src/js/app.js',
                    '/src/js/feed.js',
                    '/src/js/promise.js',
                    '/src/js/fetch.js',
                    '/src/js/material.min.js',
                    '/src/css/app.css',
                    '/src/css/feed.css',
                    '/src/images/pwa-logo.png',
                    'https://fonts.googleapis.com/css?family=Roboto:400,700',
                    'https://fonts.googleapis.com/icon?family=Material+Icons',
                    'https://cdnjs.cloudflare.com/ajax/libs/material-design-lite/1.3.0/material.indigo-pink.min.css'
                ]);
            })
    );
});

// activate event triggered by browser
// service worker will not be auto activated if older SW already running (unless "update on reload" option is selected)
self.addEventListener('activate', event => {
    console.log('[SERVICE WORKER] Activating service worker', event)
    // to clean up older cache to avoid using outdated versions of files
    event.waitUntil(
        // returns an array of strings of keys of all the sub caches in the cache storage
        caches.keys()
            .then(keyList => {
                // takes an array of promises and waits for them to finish
                return Promise.all(keyList.map(key => {
                    if (key !== CACHE_STATIC_NAME && key !== CACHE_DYNAMIC_NAME) {
                        console.log('[SERVICE WORKER] Removing old cache', key);
                        //   return a promise that will be stored in array returned by map()
                        return caches.delete(key);
                    }
                }
                ))
            })
    );
    // ensure that service worker is activated correctly
    return self.clients.claim();
});

// non-lifecycle event (here, onetriggered by HTML), fetch = when browser loads smth
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
                            caches.open(CACHE_STATIC_NAME)
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