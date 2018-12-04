const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true }); // send right headers to access HTTP endpoint from a different domain
const webpush = require('web-push');

const serviceAccount = require('./pwagram-.json');
const webpushVapidKeys = require('./webpushVapidKeys.json')

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://pwagram-f2685.firebaseio.com"
});

exports.storePostData = functions.https.onRequest((request, response) => {
    const {
        body: {
            id,
            title,
            location,
            image
        }
    } = request;

    cors(request, response, () => {
        admin
            //   access the 'posts' object store
            .database().ref('posts')
            // push a new post
            .push({ id, title, location, image })
            .then(
                () => {
                    //  start sending your push notification
                    webpush.setVapidDetails(
                        // identification of self
                        'mailto:gotoflorian.pro@gmail.com',
                        // pubkey
                        webpushVapidKeys.pub,
                        // privkey
                        webpushVapidKeys.priv
                    );

                    // send a push request to all of our subscriptions:

                    // fetch the subscriptions from database
                    return admin.database().ref('subscriptions')
                        // fetch data once, to not set a permanent listener
                        // pass string value to get value of that node in the DB
                        .once('value');
                }
            )
            .then(
                subscriptions => {
                    // send out our push messages
                    subscriptions
                        // method provided by Firebase on the subscriptions object retrieved to loop through all props of that object
                        .forEach(
                            // subscription object holds "endpoint" and "keys"
                            subscription => {
                                const pushConfiguration = {
                                    //    need to use val() because it is a special kind of object provided by Firebase to retrieve underlying value
                                    endpoint: subscription.val().endpoint,
                                    keys: {
                                        auth: subscription.val().keys.auth,
                                        p256dh: subscription.val().keys.p256dh
                                    }
                                };

                                // send the notification
                                webpush.sendNotification(
                                    pushConfiguration,
                                    // any payload we want to pass along the push notification - sizr is limited
                                    JSON.stringify({ 
                                        title: 'New Post',
                                        content: 'New Post Added',
                                        openUrl: '/help'
                                    })
                                )
                                 .catch(
                                        err => {
                                            console.log(err);
                                        }
                                    )
                            }
                        )

                    return response
                        .status(201)
                        .json({
                            message: 'Data Stored',
                            id
                        });
                }

            )
            .catch(err => {
                response
                    .status(500)
                    .json({ error: err });
            });
    });
    response.send("Hello from Firebase!");
});
