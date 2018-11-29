var shareImageButton = document.querySelector('#share-image-button');
var createPostArea = document.querySelector('#create-post');
var closeCreatePostModalButton = document.querySelector('#close-create-post-modal-btn');
var sharedMomentsArea = document.querySelector('#shared-moments');

function openCreatePostModal() {
  createPostArea.style.display = 'block';
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
  createPostArea.style.display = 'none';
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
}

function clearCart() {
  while (sharedMomentsArea.hasChildNodes()) {
    sharedMomentsArea.removeChild(sharedMomentsArea.lastChild)
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
  cardTitle.style.height = '180px';

  cardWrapper.appendChild(cardTitle);

  cardTitleTextElement.style.color = 'white'
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
const url = 'https://pwagram-f2685.firebaseio.com/posts.json';
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
}

const fromObjArr = obj => {
  const postData = [];

  for (let key in obj) {
    postData.push(obj[key])
  }

  return postData;
}


fetch(url)
  .then(res => res.json())
  .then((data) => {
    networkDataReceived = true;
    console.log('FROM WEB ', networkDataReceived, data);

    clearCart();
    updateUI(fromObjArr(data));
  });


if ('indexedDB' in window) {
  readAllData('posts')
    .then(data => {
      if (!networkDataReceived) {
        console.log('FROM INDEXEDDB', data);
        clearCart();
        updateUI(data);
      }
    });
}