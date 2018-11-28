// prevent browser from showing home screen add when arriving on app
let deferredPrompt;

if (!window.Promise) {
  window.Promise = Promise;
}

// service workers are independent from the manifest

// availability of service workers
if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    // register the service worker file
    // can take a second argument object to define options like the scope to restrict it programmatically
    .register('/sw.js')
    .then(function () {
      console.log('Service worker registered!');
    })
    .catch(error => {
      console.log(error)
    });
}

window.addEventListener('beforeinstallprompt', event => {
  console.log('beforeinstallprompt was fired');

  // Prevent Chrome 67 and earlier from automatically showing the prompt
  event.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = event;
  return false;
});
