const functions = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true }); // send right headers to access HTTP endpoint from a different domain

const serviceAccount = require("./pwagram-f2685-firebase-adminsdk-a275d-c1654b6a22.json");


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
            .then(() => {
                return response
                    .status(201)
                    .json({
                        message: 'Data Stored',
                        id
                    });
            })
            .catch(err => {
                response
                    .status(500)
                    .json({ error: err });
            });
    });
    response.send("Hello from Firebase!");
});
