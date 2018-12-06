const fs = require('fs');

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true }); // send right headers to access HTTP endpoint from a different domain
const webpush = require('web-push');
const formidable = require('formidable');   // to extract FormData
// const googleCloudStorage = require('@google-cloud/storage');
const UUID = require('uuid-v4');

const serviceAccount = require('./pwagram-.json');
const webpushVapid = require('./webpushVapid.json')

// // Create and Deploy Your First Cloud Functions
// // https://firebase.google.com/docs/functions/write-firebase-functions
//

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: "https://pwagram-f2685.firebaseio.com",
    storageBucket: "pwagram-f2685.appspot.com"
});

exports.storePostData = functions.https.onRequest((request, response) => {
    // CORS wrapper
    cors(request, response, () => {
        const uuid = UUID();
        // extract formdata from incoming request
        const formData = new formidable.IncomingForm();
        formData.parse(
            request,
            // callback executed when form data retrieved
            (error, fields, files) => {
                if (error) {
                    return console.log('IN FORMIDABLE CALLBACK\n', error, '\n===== FILES =====\n', files, '\n=====FIELDS=====\n', fields);
                }

                // change path where the picture file is temporarily stored on gc, to make sure that it is not cleaned out
                fs.rename(
                    // "file" refers to theidentifier in the form, set on the frontend
                    // files.file.path = where the file is stored auto when uploaded, /tmp/ is available on gc
                    files.file.path, `/tmp/${files.file.name}`
                )

                // put the file into a bucket

                // a default bucket is created on gcs (gs://...)
                // access that bucket, the identifier after gs://
                const bucket = admin.storage().bucket();

                // put the file into the bucket from the temp location where stored
                bucket.upload(
                    `/tmp/${files.file.name}`,
                    {
                        uploadType: 'media',
                        metadata: {
                            metadata: {
                                // files.file.type provided by formidable
                                contentType: files.file.type,
                                // firebase will generate a public download URL from the token passed to firebaseDownloadStorageToken
                                firebaseDownloadStorageToken: uuid
                            }
                        }
                    },
                    (err, file) => {
                        const { id, title, location } = fields;
                        const image = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(file.name)}?alt=media&token=${uuid}`

                        if (!err) {
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
                                            webpushVapid.mail,
                                            // pubkey
                                            webpushVapid.pub,
                                            // privkey
                                            webpushVapid.priv
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
                        } else
                            console.log(err);
                    }
                );
            }
        )
    });
});
