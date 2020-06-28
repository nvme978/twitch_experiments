/*
Copyright 2017 Amazon.com, Inc. or its affiliates. All Rights Reserved.

Licensed under the Apache License, Version 2.0 (the "License"). You may not use this file except in compliance with the License. A copy of the License is located at

    http://aws.amazon.com/apache2.0/

or in the "license" file accompanying this file. This file is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the License for the specific language governing permissions and limitations under the License.

*/

// Define our dependencies
require('dotenv').config();
var express        = require('express');
var session        = require('express-session');
var passport       = require('passport');
var OAuth2Strategy = require('passport-oauth').OAuth2Strategy;
var request        = require('request');
var path = require('path');
const socketIo = require("socket.io");
const http = require("http");
const bodyParser = require('body-parser');
var rp = require('request-promise');

let activeClients = {};

// Define our constants, you will change these with your own
const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_SECRET = process.env.TWITCH_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET;
const TWITCH_CALLBACK_URL = process.env.TWITCH_CALLBACK_URL;  // You can run locally with - http://localhost:3000/auth/twitch/callback

console.log(TWITCH_CALLBACK_URL);
// Initialize Express and middlewares
var app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(session({secret: SESSION_SECRET, resave: false, saveUninitialized: false}));
app.use(express.static(path.join(__dirname, 'client/build')));
app.use(passport.initialize());
app.use(passport.session());


// Override passport profile function to get user profile from Twitch API
OAuth2Strategy.prototype.userProfile = function(accessToken, done) {
  var options = {
    url: 'https://api.twitch.tv/helix/users',
    method: 'GET',
    headers: {
      'Client-ID': TWITCH_CLIENT_ID,
      'Accept': 'application/vnd.twitchtv.v5+json',
      'Authorization': 'Bearer ' + accessToken
    }
  };

  request(options, function (error, response, body) {
    if (response && response.statusCode == 200) {
      done(null, JSON.parse(body));
    } else {
      done(JSON.parse(body));
    }
  });
}

passport.serializeUser(function(user, done) {
    done(null, user);
});

passport.deserializeUser(function(user, done) {
    done(null, user);
});

passport.use('twitch', new OAuth2Strategy({
    authorizationURL: 'https://id.twitch.tv/oauth2/authorize',
    tokenURL: 'https://id.twitch.tv/oauth2/token',
    clientID: TWITCH_CLIENT_ID,
    clientSecret: TWITCH_SECRET,
    callbackURL: TWITCH_CALLBACK_URL,
    state: true
  },
  function(accessToken, refreshToken, profile, done) {
    profile.accessToken = accessToken;
    profile.refreshToken = refreshToken;

    // Securely store user profile in your DB
    //User.findOrCreate(..., function(err, user) {
    //  done(err, user);
    //});

    done(null, profile);
  }
));

// Set route to start OAuth link, this is where you define scopes to request
app.get('/auth/twitch', passport.authenticate('twitch', { scope: 'user_read' }));

// Set route for OAuth redirect
app.get('/auth/twitch/callback', passport.authenticate('twitch', { successRedirect: '/', failureRedirect: '/' }));


app.post('/auth/refresh_token', async function(req, res) {
  console.log(req.session);
  let options = {
    method: 'POST',
    uri: 'https://id.twitch.tv/oauth2/token',
    json: true,
    body: {
      grant_type: 'refresh_token',
      refresh_token: req.session.passport.user.refreshToken,
      client_id: TWITCH_CLIENT_ID,
      client_secret: TWITCH_SECRET
    }
  }

  let result = await rp(options);
  console.log(result);
  req.session.passport.user.accessToken = result.access_token;
  req.session.passport.user.refreshToken = result.refresh_token;
  res.status(200).send({ accessToken: result.access_token });
});


// If user has an authenticated session, display it, otherwise display link to authenticate
// app.get('/', function (req, res) {
//   if(req.session && req.session.passport && req.session.passport.user) {
//     res.redirect('http://localhost:3000/');
//   } else {
//     res.send('<html><head><title>Twitch Auth Sample</title></head><a href="/auth/twitch">Login to Twitch</a></html>');
//   }
// });

app.get('/auth/user', function(req, res) {
  if (req.session && req.session.passport && req.session.passport.user) {
    // Create jwt
    let jwt = require('jsonwebtoken');
    let token = jwt.sign({ 'userId': req.session.passport.user.data[0].id }, SESSION_SECRET);
    res.json({
      user: req.session.passport.user,
      token: token
    });
  } else {
    res.json({});
  }
});

// WEBHOOKS
app.get('/webhook/event/to_follow/:userId', function(req, res) {
  if(req.query['hub.challenge']) {
    res.status(200).send(req.query['hub.challenge']);
    return;
  }
});

app.post('/webhook/event/to_follow/:userId', function (req, res) {
  console.log(req.body);
  let userId = req.params.userId;
  if (userId && activeClients[userId]) {
    console.log('EMITTING...');
    activeClients[userId].emit("to_follow", req.body.data);
  }
});

app.get('/webhook/event/stream_change/:userId', function (req, res) {
  if (req.query['hub.challenge']) {
    res.status(200).send(req.query['hub.challenge']);
    return;
  }
});

app.post('/webhook/event/stream_change/:userId', function (req, res) {
  console.log(req.body);
  let userId = req.params.userId;
  if (userId && activeClients[userId]) {
    console.log('EMITTING...');
    activeClients[userId].emit("stream_change", req.body.data);
  }
});


// END WEBHOOKS




app.post('/api/:mode', async function(req, res) {
  console.log(req.params.mode + ' webhooks');
  if (req.session && req.session.passport && req.session.passport.user) {
      // Subscribe to webhooks for user follows
      let options = {
        method: 'POST',
        uri: 'https://api.twitch.tv/helix/webhooks/hub',
        json: true,
        body: {
          'hub.topic': 'https://api.twitch.tv/helix/users/follows?first=1&to_id=' + req.body.userId,
          'hub.mode': req.params.mode,
          'hub.lease_seconds': 864000,
          'hub.callback': process.env.TWITCH_WEBHOOK_BASE_URL + '/webhook/event/to_follow/' + req.session.passport.user.data[0].id
        },
        headers: {
          'Authorization': 'Bearer ' + req.session.passport.user.accessToken,
          'Client-ID': TWITCH_CLIENT_ID
        }
      }
      
      let result = await rp(options);

      // Subscribe to webhooks for stream changes
      options.body = {
        'hub.topic': 'https://api.twitch.tv/helix/streams?user_id=' + req.body.userId,
        'hub.mode': req.params.mode,
        'hub.lease_seconds': 864000,
        'hub.callback': process.env.TWITCH_WEBHOOK_BASE_URL + '/webhook/event/stream_change/' + req.session.passport.user.data[0].id
      };
      result = await rp(options);
      res.status(200).send();
  }
});


app.get('/heroku/test', function(req, res) {
  res.status(200).send('HELLO HEROKU');
});


// The "catchall" handler: for any request that doesn't
// match one above, send back React's index.html file.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname + '/client/build/index.html'));
});


const server = http.createServer(app);
const socketioJwt = require('socketio-jwt');
const io = socketIo(server);
io.use(socketioJwt.authorize({
  secret: SESSION_SECRET,
  handshake: true
}));

io.on("connection", (s) => {
  console.log("New client connected");
  let userId = s.decoded_token.userId;
  activeClients[userId] = s;
  s.on("disconnect", () => {
    console.log("Client disconnected");
    activeClients[userId] = null;
  });
});

const port = process.env.PORT || 4000;

server.listen(port, () => console.log(`Listening on port ${port}`));
