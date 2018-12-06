const shareImageButton = document.querySelector('#share-image-button');
const createPostArea = document.querySelector('#create-post');
const closeCreatePostModalButton = document.querySelector('#close-create-post-modal-btn');
const sharedMomentsArea = document.querySelector('#shared-moments');
const form = document.querySelector('form');
const titleInput = document.querySelector('#title');
const locationInput = document.querySelector('#location');
const videoPlayer = document.querySelector('#player');
const canvasElement = document.querySelector('#canvas');
const captureButton = document.querySelector('#capture-btn');
const imagePicker = document.querySelector('#image-picker');
const imagePickerArea = document.querySelector('#pick-image');
let picture;

// initialize the camera or image picker based on device
const initializeMedia = () => {
  // access to camera on as many devices as possible, in a progressive way

  // mediaDevices gives access to the camera and audio
  if (!('mediaDevices' in navigator)) {
    // create a polyfill
    navigator.mediaDevices = {};
  }

  // map the older media access APIs to the new syntax = polyfill
  if (!('getUserMedia' in navigator.mediaDevices)) {
    navigator.mediaDevices.getUserMedia =
      // constraints = is it audio or video o capture ?
      constraints => {
        const getUserMedia = navigator.webkitGetUserMedia || navigator.mozFetUserMedia;

        // for very old browsers like IE
        if (!getUserMedia) {
          return Promise.reject('Please update to a modern browser.');
        }

        // if you get so far you have a getUserMedia available
        return new Promise(
          (resolve, reject) => {
            getUserMedia.call(
              navigator, // = this pointer
              // arguments passed when calling
              constraints,
              resolve,
              reject
            );
          }
        );

      };
  }

  // safe to use because of the above polyfills
  navigator.mediaDevices.getUserMedia({
    video: true,
    audio: false // or just don't put this property if false
  })
    .then(
      stream => {
        // the video element can display a stream
        // will autoplay (set on the element)
        videoPlayer.srcObject = stream;
        // show the videoplayer
        videoPlayer.style.display = 'block';
      }
    )
    .catch(
      err => {
        console.log('Media access failed. Fallback on image picker', err);

        // show image picker instead
        imagePickerArea.style.display = 'block';
      }

    );
};

captureButton.addEventListener('click', event => {
  // get the image off the stream of the camera and send it to the canvas (latest snapshot)

  // show the canvas
  canvasElement.style.display = 'block';
  // hide the videoplayer, even if hidden the stream is still going on...
  videoPlayer.style.display = 'none';
  // show that the capture is taken by hiding the button
  captureButton.style.display = 'none';

  // get the stream on the canvas

  // context for the canvas
  const context = canvasElement
    // how we want to draw on this image
    .getContext(
      // 2d image
      '2d'
    );
  context.drawImage(
    // use the videoplayer as an image element, will auto give the stream
    videoPlayer,
    // define the boundaries
    0, 0,
    canvasElement.width,
    videoPlayer.videoHeight / (videoPlayer.videoWidth / canvasElement.width)
  );

  // stop the stream of the camera
  videoPlayer.srcObject
    // give us access to all video streams on this element 
    .getVideoTracks()
    // stop all tracks
    .forEach(
      track => {
        track.stop();
      }
    );

  // get base64 representation of the image captured and convert it to a file
  picture = dataURItoBlob(canvasElement.toDataURL());
});

function openCreatePostModal() {
  createPostArea.style.display = 'block';

  // to not apply the style immediately (transition defay effect)
  setTimeout(() => {
    // position we want to end in
    createPostArea.style.transform = 'translateY(0)';
    initializeMedia();

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
  // to not apply the style immediately (transition defay effect)
  setTimeout(
    () => {
      createPostArea.style.transform = 'translateY(100vh)';
      // cleanup the media
      imagePickerArea.style.display = 'none';
      videoPlayer.style.display = 'none';
      canvasElement.style.display = 'none';
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
  const id = new Date().toDateString();
  // use built'in FormData constructor to send ky/value pairs as well as files
  const postData = new FormData();

  postData.append('id', id);
  postData.append('title', titleInput.value);
  postData.append('location', locationInput.value);
  postData.append(
    'file',
    picture,
    //  override name of the file
    `${id}.png`
  );

  fetch(storePostDataCloudFunctionUrl, {
    method: 'POST',
    body: postData
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
            location: locationInput.value,
            picture
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


