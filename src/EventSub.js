// src/EventSub.js

const WebSocket  = require('ws');
const fetch      = require('node-fetch');
const fs         = require('fs');

class EventSub {
  /**
   * @param config      Your config object; expects appConfig.EventSubHost & appClientID
   * @param authToken   A valid Twitch OAuth token with EventSub scopes
   * @param channelID   The broadcaster’s user ID
   * @param twitchCom   Your outer TwitchCom instance (for triggering events)
   */
  constructor(config, authToken, channelID, twitchCom) {
    this.host         = config.appConfig.EventSubHost
                       || 'wss://eventsub.wss.twitch.tv/ws';
    this.authToken    = authToken;
    //this.clientID     = config.appConfig.ClientID;
    this.clientID = config.appConfig.appClientID;
    this.channelID    = channelID;
    this.twitchCom    = twitchCom;

    this.sessionId        = null;
    this.reconnectUrl     = null;
    this.keepaliveSeconds = null;

    // Will hold our active WebSocket
    this.socket = null;
  }

  /** Opens (or re-opens) the EventSub WebSocket connection */
  connect() {
    const url = this.reconnectUrl || this.host;


    const options = {
         headers: {
           'Sec-WebSocket-Protocol': 'websocket'
         }
        };
        this.socket = new WebSocket(url, options);
    


    // Event: connection established
    this.socket.on('open', () => {
      console.log('✅ Connected to EventSub WebSocket');
      this.twitchCom.app.addReadyFlag(4);
    });

this.socket.on('message', (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      console.error('Malformed JSON:', raw);
      return;
    }
    fs.appendFileSync('eventsub.log', JSON.stringify(msg, null, 2) + '\n\n');
  
    const type = msg.metadata?.message_type;
    const data = msg.payload;
  
    switch (type) {
      // ────────────────────────────────────────────────────────────────
      case 'session_welcome':
        console.log('➡️ Received session_welcome');
        // data.session has your session info
        return this._onWelcome({ session: data.session });
  
      case 'session_keepalive':
        // Twitch keepalive—no action needed
        return;
  
      case 'session_reconnect':
        console.log('🔄 Received session_reconnect');
        // payload.session_reconnect_url (if present) or data.session.reconnect_url
        return this._onReconnect({
          session: {
            session_reconnect_url: data.session.reconnect_url
          }
        });
  
      case 'notification':
        // payload.subscription + payload.event
        return this._onNotification({
          subscription: data.subscription,
          event:        data.event
        });
  
      case 'revocation':
        console.warn('❌ Subscription revoked:', data.subscription);
        return;
  
      case 'PING':
        return this.socket.send(JSON.stringify({ type: 'PONG' }));
  
      default:
        console.debug('Unhandled EventSub message:', msg);
    }
  });
    // Event: socket closed
    this.socket.on('close', (code, reason) => {
      console.warn(
        `⚠️ EventSub WS closed (code ${code}). Reconnecting in 10s…`
      );
      this.twitchCom.app.removeReadyFlag(4);
      setTimeout(() => this.connect(), 10_000);
    });

    // Event: error
    this.socket.on('error', (err) => {
      console.error('❌ EventSub WS error:', err);
    });
  }

  /** Handle the initial welcome, extract session ID and subscribe */
  async _onWelcome(data) {
    const { session } = data;
    this.sessionId        = session.id;
    this.keepaliveSeconds = session.keepalive_timeout_seconds;
    this.reconnectUrl     = session.session_reconnect_url;



    console.log(
      `🔑 Session ready. ID=${this.sessionId}, keepalive=${this.keepaliveSeconds}s`
    );

    try {
      await this._subscribeAll();
      console.log('🎉 EventSub subscriptions created');
    } catch (err) {
      console.error('❌ Failed to subscribe to EventSub topics:', err);
    }
  }

  /** Register your two subscriptions via the Helix API */
  async _subscribeAll() {
    await this._createSubscription(
      'channel.channel_points_custom_reward_redemption.add',
      '1',
      { broadcaster_user_id: this.channelID }
    );
    await this._createSubscription(
      'channel.subscribe',
      '1',
      { broadcaster_user_id: this.channelID }
    );
  }

  /** Helper to POST a single subscription */
  async _createSubscription(type, version, condition) {
    const url  = 'https://api.twitch.tv/helix/eventsub/subscriptions';
    const body = {
      type,
      version,
      condition,
      transport: {
        method:     'websocket',
        session_id: this.sessionId
      }
    };

    const resp = await fetch(url, {
      method:  'POST',
      headers: {
        'Client-ID':       this.clientID,
        'Authorization':   `Bearer ${this.authToken}`,
        'Content-Type':    'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Subscribe ${type} failed: ${resp.status} ${text}`);
    }
  }

  /** Dispatch incoming notifications into your triggerManager */
  _onNotification(data) {
    console.log(data);
    const { subscription, event } = data;

    if (subscription.type === 'channel.channel_points_custom_reward_redemption.add') {
      const { title, is_sub_only } = event.reward;
      this.twitchCom.app.triggerManager.trigger('CHANNEL_POINTS_REWARD', {
        rewardTitle: title,
        message:     event.user_input,
        username:    event.user_name,
        subscriber:  is_sub_only
      });
    }

    if (subscription.type === 'channel.subscribe') {
      let giver    = event.user_name;
      let username = event.user_name;

      if (event.is_gift) {
        giver    = event.gifter_user_name || 'anonymous';
        username = event.recipient_user_name;
      }

      this.twitchCom.app.triggerManager.trigger('SUBSCRIPTION', {
        giver,
        message:    event.user_input,
        username,
        subscriber: true
      });
    }
  }

  /** Twitch asked us to reconnect on a new URL */
  _onReconnect(data) {
    console.warn('🔄 Received session_reconnect; switching URL…');
    this.reconnectUrl = data.session.session_reconnect_url;

    // tear down old socket, then re‐connect immediately
    if (this.socket) {
      this.socket.terminate();
    }
    this.connect();
  }
}

module.exports = EventSub;