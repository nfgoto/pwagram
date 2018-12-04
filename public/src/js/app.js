var deferredPrompt;
const enableNotificationsButtons = document.querySelectorAll('.enable-notifications');

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
    .then(
      () => {
        console.log('Service worker registered!');
      }
    )
    .catch(
      error => {
        console.log('ERROR REGISTERING WHEN SERVICE WORKER', error);
      }
    );
}

// prevent browser from showing home screen add when arriving on app
window.addEventListener('beforeinstallprompt', event => {
  console.log('beforeinstallprompt was fired');

  // Prevent Chrome 67 and earlier from automatically showing the prompt
  event.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = event;
  return false;
});

// will display a real system notification, not an JS alert
const displayConfirmNotification = () => {
  // see the docs for more explanation
  const notificationOptions = {
    body: 'You Successfully Subscribed to Our Notification Service',
    icon: '/src/images/icons/app-icon-96x96.png',
    dir: 'ltr',
    lang: 'en-US',
    vibrate: [100, 50, 200],
    badge: '/src/images/icons/app-icon-96x96.png',
    // the below settings are less spammy
    tag: 'confirm-notification',
    renotify: true,
    // buttons next to notification
    // the response to the action buttons are handled in the SW BECAUSE these notif are related to the system not the browser
    actions: [
      { action: 'confirm', title: 'OK', icon: '/src/images/icons/app-icon-96x96.png' },
      { action: 'cancel', title: 'Cancel', icon: '/src/images/icons/app-icon-96x96.png' }
    ]
  };

  // notification in the SW context
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then(
        // swRegistration = current SW managing our page + extras (listening to events, etc)
        swRegistration => {
          swRegistration
            // sw interface to Motification
            .showNotification('Successfully Subscribed!', notificationOptions);
        }
      );
  }

  // notification in normal JS context
  //  new Notification('Successfully Subscribed from normal JS!', notificationOptions);
};

const configurePushNotification = () => {
  if (!'serviceWorker' in navigator) {
    return;
  }

  let registeredSW;

  // subscriptions are managed by the service worker, sends them and reacts to push events
  navigator.serviceWorker.ready
    .then(
      swRegistration => {
        registeredSW = swRegistration;

        // access push manager and check subscriptions (browser + device combination)
        return swRegistration.pushManager
          // returns existing subscriptions, returns a promise
          .getSubscription();
      }
    )
    .then(
      subscriptions => {
        const vapidPublickey = 'BESMv6ZoUpsxK7oDSVqCKrXj9gPE2cso88HoWGjF9ATr8OPJcpbTbUK20H0LpKySDPixsRGi7ot5kLziz9qUUfI';
        const vapidPublickeyAsUIntArray = urlBase64ToUint8Array(vapidPublickey);


        // subscriptions will be null if no subscriptions
        // pushManager checks subscriptions for this browser on this device
        if (!subscriptions) {
          // create a subscription for this brower on this device (another browser = another subscription)
          return registeredSW.pushManager
            // creates a new subscription and renders existing one useless
            .subscribe({
              // push notification send to our service are only visible to this user
              userVisibleOnly: true,
              // uint8Array value => exact identification of our backend server
              applicationServerKey: vapidPublickeyAsUIntArray
            })
            .then(
              newPushSubscription => {
                // store our new push subscription on our backend database in the "subscriptions" collection
                return fetch(
                  'https://pwagram-f2685.firebaseio.com/subscriptions.json',
                  {
                    method: 'POST',
                    headers: {
                      'Content-type': 'application/json',
                      'Accept': 'application/json'
                    },
                    body: JSON.stringify(newPushSubscription)
                  }
                );
              }
            )
            .then(
              res => {
                if (res.ok) {
                  displayConfirmNotification();
                }
              }
            )
            .catch(
              err => {
                console.log('ERROR', err);
              }

            );
        }
      }

    );
};



// allows us to controlhow to ask for user to allow notifications instead of leeting the browser handle it
const askForNotificationPermission = () => {
  // you also implicitly ask for push permissions when asking for notif permission
  Notification.requestPermission(
    result => {
      console.log('User choice', result);
      if (result !== 'granted') {
        console.log('No notification permission granted.');
      } else {
        configurePushNotification();
        // displayConfirmNotification();
      }


    }
  );
};


if ('serviceWorker' in navigator && 'Notification' in window) {
  console.log('notification permission is', Notification.permission);

  for (let notifButton of enableNotificationsButtons) {

    switch (Notification.permission) {
      case 'granted':
      default: notifButton.style.display = 'inline-block';
    }

    notifButton.addEventListener('click', askForNotificationPermission);
  }
}