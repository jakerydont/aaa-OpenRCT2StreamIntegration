const https   = require('https');
const opn     = require('opn');
const express = require('express');
const fs      = require('fs');
const path    = require('path');

// only EventSub here, PubSub is gone
const EventSub = require('./EventSub');
// if you need IRC still, uncomment this
const TwitchIRC = require('./TwitchIRC');

class TwitchCom {
  constructor(config, app) {
    this.app            = app;
    this.config         = config;
    this.appClientID    = config.appConfig.appClientID;
    this.redirectUri    = config.appConfig.redirectUri;
    this.webServerPort  = config.callbackPort;
    this.channelID      = '';
    this.channelName    = '';
    this.storedAccessToken = '';

    // load any previous token
    if (fs.existsSync('access_token.bin')) {
      this.storedAccessToken = fs.readFileSync('access_token.bin', 'utf8');
    }

    this._setupWebServer();
  }

  _setupWebServer() {
    this.loginResolve = null;
    this.webServer = express();
    this.webServer.use(express.json());

    this.webServer.get('/', (req, res) => {
      res.sendFile(path.resolve('public/index.html'));
    });

    this.webServer.post('/access_token', (req, res) => {
      if (!this.loginResolve) return;
      const token = req.body.access_token;
      this.setAccessToken(token);
      this.validate(token)
        .then(() => this.loginResolve())
        .catch((err) => {
          console.error('Token validation failed:', err);
        });
      res.sendStatus(200);
    });

    this.webServer.listen(this.webServerPort, () => {
      console.log(`Callback server listening on port ${this.webServerPort}`);
    });
  }

  setAccessToken(token) {
    this.storedAccessToken = token;
    fs.writeFileSync('access_token.bin', token, 'utf8');
  }

  validate(token) {
    return new Promise((resolve, reject) => {
      console.log('Validating token…');
      const opts = {
        hostname: 'id.twitch.tv',
        port: 443,
        path: '/oauth2/validate',
        method: 'GET',
        headers: { Authorization: `OAuth ${token}` },
      };

      const req = https.request(opts, (res) => {
        if (res.statusCode === 401) {
          // bad token → force login again
          this.storedAccessToken = '';
          this.login().then(resolve, reject);
          return;
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => {
            const meta = JSON.parse(body);
            this.channelID   = meta.user_id;
            this.channelName = meta.login;
            console.log('Token valid for', this.channelName, `(ID: ${this.channelID})`);
            resolve();
          });
        } else {
          reject(new Error(`Unexpected validate status ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      req.end();
    });
  }

  login() {
    return new Promise((resolve) => {
      this.loginResolve = resolve;
      const scopes = [
        'bits:read',
        'channel:read:subscriptions',
        'channel:read:redemptions',
        'channel_subscriptions',
        'chat:read',
      ];
      
      const authUrl = [
        `https://id.twitch.tv/oauth2/authorize`,
        `?client_id=${encodeURIComponent(this.appClientID)}`,
        `&redirect_uri=${encodeURIComponent(this.redirectUri + ':' + this.webServerPort)}`,
        `&response_type=token`,
        `&scope=${encodeURIComponent(scopes.join(' '))}`,
      ].join('');
      opn(authUrl);
    });
  }

  authenticate() {
    if (this.storedAccessToken) {
      return this.validate(this.storedAccessToken);
    }
    return this.login();
  }

  apiGetRequest(path) {
    return new Promise((resolve, reject) => {
      const opts = {
        hostname: 'api.twitch.tv',
        port: 443,
        path,
        method: 'GET',
        headers: {
          'Client-ID': this.appClientID,
          Authorization: `Bearer ${this.storedAccessToken}`,
        },
      };

      const req = https.request(opts, (res) => {
        if (res.statusCode === 401) {
          return reject(new Error('Unauthorized; token may be invalid'));
        }
        if (res.statusCode >= 200 && res.statusCode < 300) {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => resolve(JSON.parse(body)));
        } else {
          reject(new Error(`Unexpected API status ${res.statusCode}`));
        }
      });

      req.on('error', reject);
      req.end();
    });
  }

  tmiRequest(path) {
    return new Promise((resolve, reject) => {
      const opts = {
        hostname: 'tmi.twitch.tv',
        port: 443,
        path,
        method: 'GET',
      };
      const req = https.request(opts, (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          let body = '';
          res.on('data', (c) => (body += c));
          res.on('end', () => resolve(JSON.parse(body)));
        } else {
          reject(new Error(`TMI returned ${res.statusCode}`));
        }
      });
      req.on('error', reject);
      req.end();
    });
  }

  connect() {
    this.authenticate()
      .then(() => {
        console.log('✅ Twitch authentication complete');
        this.app.addReadyFlag(1);

        // ensure we have a default WS endpoint if not set
        if (!this.config.appConfig.EventSubHost) {
          this.config.appConfig.EventSubHost = 'wss://eventsub.wss.twitch.tv/ws';
        }

        // spin up your new EventSub listener
        const eventSub = new EventSub(
          this.config,
          this.storedAccessToken,
          this.channelID,
          this
        );
        eventSub.connect();

        // if you still need IRC for chat:
        const ircCom = new TwitchIRC(
          this.config,
          this.storedAccessToken,
          this.channelName,
          this
        );
        ircCom.connect();
      })
      .catch((err) => {
        console.error('❌ Failed Twitch authentication:', err);
      });
  }
}

module.exports = TwitchCom;