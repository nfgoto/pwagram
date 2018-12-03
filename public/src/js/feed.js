const shareImageButton = document.querySelector('#share-image-button');
const createPostArea = document.querySelector('#create-post');
const closeCreatePostModalButton = document.querySelector('#close-create-post-modal-btn');
const sharedMomentsArea = document.querySelector('#shared-moments');
const form = document.querySelector('form');
const titleInput = document.querySelector('#title');
const locationInput = document.querySelector('#location');


function openCreatePostModal() {
  createPostArea.style.display = 'block';
  // to not apply the style immediately
  setTimeout(() => {
    // position we want to end in
    createPostArea.style.transform = 'translateY(0)';

  }, 1);

  if (deferredPrompt) {
    deferredPrompt.prompt();

    deferredPrompt.userChoice.then(function (choiceResult) {
      console.log(choiceResult.outcome);

      if (choiceResult.outcome === 'dismissed') {
        console.log('User cancelled installation');
      } else {
        console.log('User added to home screen');
      }
    });

    deferredPrompt = null;
  }

  // get rid of service worker
  /* if ('serviceWorker' in navigator) {
    // get all active registrations
    navigator.serviceWorker.getRegistrations()
      .then(registrations => {
        registrations.forEach(registration => {
          // unregisters the service workers and cleans the entire cache
          registration.unregister();
        });
      });
  } */
}

function closeCreatePostModal() {
  setTimeout(
    () => {
      createPostArea.style.transform = 'translateY(100vh)';
    }
    , 3
  );
}

shareImageButton.addEventListener('click', openCreatePostModal);

closeCreatePostModalButton.addEventListener('click', closeCreatePostModal);

// NOT in use - add resources to cache on user gesture (click on button)
const onSaveButtonClick = event => {
  console.log('onSaveButtonClick clicked');
  // check if browser supports CacheAPI
  if ('caches' in window) {
    caches.open('user-requested')
      .then(cache => {
        // cache resource from network
        cache.add('https://httpbin.org/get');
        cache.add('/src/images/sf-boat.jpg');
      })
      .catch(err => {

      });
  }
};

function clearCart() {
  while (sharedMomentsArea.hasChildNodes()) {
    sharedMomentsArea.removeChild(sharedMomentsArea.lastChild);
  }
}

function createCard(data) {
  const cardWrapper = document.createElement('div');
  const cardTitleTextElement = document.createElement('h2');
  const cardSupportingText = document.createElement('div');
  const cardTitle = document.createElement('div');
  // const cardSaveButton = document.createElement('button');

  cardWrapper.className = 'shared-moment-card mdl-card mdl-shadow--2dp';

  cardTitle.className = 'mdl-card__title';
  cardTitle.style.backgroundImage = `url(${data.image})`;
  cardTitle.style.backgroundSize = 'cover';

  cardWrapper.appendChild(cardTitle);

  cardTitleTextElement.style.color = 'white';
  cardTitleTextElement.className = 'mdl-card__title-text';
  cardTitleTextElement.textContent = data.title;

  cardTitle.appendChild(cardTitleTextElement);

  cardSupportingText.className = 'mdl-card__supporting-text';
  cardSupportingText.textContent = data.location;
  cardSupportingText.style.textAlign = 'center';

  // cardSaveButton.textContent = 'Save';
  // cardSaveButton.addEventListener('click', onSaveButtonClick);
  // cardSupportingText.appendChild(cardSaveButton);

  cardWrapper.appendChild(cardSupportingText);
  componentHandler.upgradeElement(cardWrapper);
  sharedMomentsArea.appendChild(cardWrapper);
}

// ================= BEST STRATEGY = CACHE, THEN NETWORK =================
const dbUrl = 'https://pwagram-f2685.firebaseio.com/posts.json';

const storePostDataCloudFunctionUrl = 'https://us-central1-pwagram-f2685.cloudfunctions.net/storePostData';

// to make sure that the cache does not override network data
let networkDataReceived = false;

// access the cache storage directly from the page without going through the SW
// 1) access to cache 
// 1) simultaneously access the service worker
// 2) data from cache sent to page
// 2) SW tries to get response from network
// 3) data sent back from network
// 4) store fetched data in cache storage (OPTIONAL)
// 5) fetched data is sent to the page without necessarily caching it

const updateUI = postList => {
  postList.forEach(post => {
    createCard(post);
  });
};

const fromObjArr = obj => {
  const postData = [];

  for (let key in obj) {
    postData.push(obj[key]);
  }

  return postData;
};

// fetch posts
fetch(dbUrl)
  .then(res => res.json())
  .then(
    data => {
      networkDataReceived = true;
      console.log('FROM WEB ', networkDataReceived, data);

      clearCart();
      updateUI(fromObjArr(data));
    }
  );


if ('indexedDB' in window) {
  readAllData('posts')
    .then(
      data => {
        if (!networkDataReceived) {
          console.log('FROM INDEXEDDB', data);
          clearCart();
          updateUI(data);
        }
      }
    );
}

const sendData = () => {
  fetch(storePostDataCloudFunctionUrl, {
    method: 'POST',
    headers: {
      'Content-type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      id: new Date().toDateString(),
      title: titleInput.value,
      location: locationInput.value,
      image: 'https://firebasestorage.googleapis.com/v0/b/pwagram-f2685.appspot.com/o/ingenico-card-swipe-machine-500x500.jpg?alt=media&token=5f2cd33a-b302-433b-a868-d366575f67b3'
    })
  })
    .then(
      res => {
        console.log('Sent Data', res);
        // update the UI....
      }
    );
};


// listen to the submit event
form.addEventListener('submit', event => {
  // prevent page from sending to server and reloading
  event.preventDefault();

  // .value to access the user input text
  if (titleInput.value.trim() === '' || locationInput.value.trim() === '') {
    alert('Please Enter Valid Data.');

    // ignore the submit
    return;
  }

  closeCreatePostModal();

  // register background synchronization request
  if (
    'serviceWorker' in navigator &&
    // SyncManager API for background Sync - not production ready as of 12/2018
    'SyncManager' in window
  ) {
    // make sure that the SW is ready (installed and activated)
    navigator.serviceWorker.ready
      .then(
        sw => {
          // need to access the SW here because the SW cannot listen to the form events (remember no access to the DOM)

          const post = {
            // uid
            id: new Date().toISOString(),
            title: titleInput.value,
            location: locationInput.value
          };

          // store post in indexedDB
          writeData('sync-posts', post)
            .then(
              () => {
                // register sync event ONLY AFTER data to be posted has been stored
                // sw.sync = gives access to SyncManager  from SW POV
                // takes an id for the task
                return sw.sync.register('sync-new-posts');
              }
            )
            .then(
              () => {
                // getthe toaster element
                const snackbarContainer = document.querySelector('#confirmation-toast');

                const data = { message: 'Your Post is Saved for Synching' };
                snackbarContainer.MaterialSnackbar.showSnackbar(data);
              }
            )
            .catch(err => {
              console.log('SYNC ERROR', err);
            });
        });

  }
  // SyncManager not supported
  else {
    // send data directly to the server
    sendData();
  }





});


