require('dotenv').config();

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const { TikTokConnectionWrapper, getGlobalConnectionCount } = require('./connectionWrapper');
const { clientBlocked } = require('./limiter');
const { Module } = require('module');

const app = express();
const httpServer = createServer(app);

class TikTokChatReaderServer {
    constructor(actionManager, triggerManager, config, integrationApp) {
        this.actionManager = actionManager;
        this.triggerManager = triggerManager;
        this.uniqueId = config.tiktok.uniqueID;

        // Enable cross origin resource sharing
        this.io = new Server(httpServer, {
            cors: {
                origin: '*'
            }
        });



        app.use(express.static('public'));

        // Start http listener
        const port = process.env.PORT || 8082;
        httpServer.listen(port);
        console.info(`Server running! Please visit http://localhost:${port}`);

        }
    
    connect(options) {
    
        let tiktokConnectionWrapper;
    
        //console.log('New connection from origin', socket.handshake.headers['origin'] || socket.handshake.headers['referer']);
    

    
            // Prohibit the client from specifying these options (for security reasons)
            if (typeof options === 'object' && options) {
                delete options.requestOptions;
                delete options.websocketOptions;
            } else {
                options = {};
            }
    
            // Session ID in .env file is optional
            if (process.env.SESSIONID) {
                options.sessionId = process.env.SESSIONID;
                console.info('Using SessionId');
            }
    
            // Check if rate limit exceeded
            if (process.env.ENABLE_RATE_LIMIT && clientBlocked(io, socket)) {
                console.log('tiktokDisconnected', 'You have opened too many connections or made too many connection requests. Please reduce the number of connections/requests or host your own server instance. The connections are limited to avoid that the server IP gets blocked by TokTok.');
                return;
            }
    
            // Connect to the given username (uniqueId)
            try {
                tiktokConnectionWrapper = new TikTokConnectionWrapper(this.uniqueId, options, true);
                tiktokConnectionWrapper.connect();
            } catch (err) {
                console.log('tiktokDisconnected', err.toString());
                return;
            }
    
            // Redirect wrapper control events once
            tiktokConnectionWrapper.once('connected', state => console.log('tiktokConnected', state));
            tiktokConnectionWrapper.once('disconnected', reason => console.log('tiktokDisconnected', reason));
    
            // Notify client when stream ends
            tiktokConnectionWrapper.connection.on('streamEnd', () => console.log('streamEnd'));
    
            // Redirect message events
            //tiktokConnectionWrapper.connection.on('roomUser', msg => console.log('roomUser', msg));
            //tiktokConnectionWrapper.connection.on('member', msg => console.log('member', msg));
            tiktokConnectionWrapper.connection.on('chat', (msg) => { 
                console.log("TIKTOK: ", msg.uniqueId, msg.comment)
                this.triggerManager.trigger('COMMAND', {username: msg.uniqueId, subscriber:msg.isSubscriber,message: msg.comment});
            });
            
            tiktokConnectionWrapper.connection.on('gift', msg => {
                console.log('TT GIFT: ', msg.uniqueId, msg.giftName, msg.diamondCount);
                this.triggerManager.trigger('CHANNEL_POINTS_REWARD', {username: msg.uniqueId, subscriber:msg.isSubscriber,rewardTitle: "Thanos"});
            });
            //tiktokConnectionWrapper.connection.on('social', msg => console.log('social', msg.chat));
            //tiktokConnectionWrapper.connection.on('like', msg => console.log('like', msg));
            //tiktokConnectionWrapper.connection.on('questionNew', msg => console.log('questionNew', msg));
            //tiktokConnectionWrapper.connection.on('linkMicBattle', msg => console.log('linkMicBattle', msg));
            //tiktokConnectionWrapper.connection.on('linkMicArmies', msg => console.log('linkMicArmies', msg));
            //tiktokConnectionWrapper.connection.on('liveIntro', msg => console.log('liveIntro', msg));
           //tiktokConnectionWrapper.connection.on('emote', msg => console.log('emote', msg));
            //tiktokConnectionWrapper.connection.on('envelope', msg => console.log('envelope', msg));
           // tiktokConnectionWrapper.connection.on('subscribe', msg => console.log('subscribe', msg));



    
}

// io.on('connection', (socket) => {
//     let tiktokConnectionWrapper;

//     console.log('New connection from origin', socket.handshake.headers['origin'] || socket.handshake.headers['referer']);

//     socket.on('setUniqueId', (uniqueId, options) => {

//         // Prohibit the client from specifying these options (for security reasons)
//         if (typeof options === 'object' && options) {
//             delete options.requestOptions;
//             delete options.websocketOptions;
//         } else {
//             options = {};
//         }

//         // Session ID in .env file is optional
//         if (process.env.SESSIONID) {
//             options.sessionId = process.env.SESSIONID;
//             console.info('Using SessionId');
//         }

//         // Check if rate limit exceeded
//         if (process.env.ENABLE_RATE_LIMIT && clientBlocked(io, socket)) {
//             console.log('tiktokDisconnected', 'You have opened too many connections or made too many connection requests. Please reduce the number of connections/requests or host your own server instance. The connections are limited to avoid that the server IP gets blocked by TokTok.');
//             return;
//         }

//         // Connect to the given username (uniqueId)
//         try {
//             tiktokConnectionWrapper = new TikTokConnectionWrapper(uniqueId, options, true);
//             tiktokConnectionWrapper.connect();
//         } catch (err) {
//             console.log('tiktokDisconnected', err.toString());
//             return;
//         }

//         // Redirect wrapper control events once
//         tiktokConnectionWrapper.once('connected', state => console.log('tiktokConnected', state));
//         tiktokConnectionWrapper.once('disconnected', reason => console.log('tiktokDisconnected', reason));

//         // Notify client when stream ends
//         tiktokConnectionWrapper.connection.on('streamEnd', () => console.log('streamEnd'));

//         // Redirect message events
//         tiktokConnectionWrapper.connection.on('roomUser', msg => console.log('roomUser', msg));
//         tiktokConnectionWrapper.connection.on('member', msg => console.log('member', msg));
//         tiktokConnectionWrapper.connection.on('chat', msg => console.log('chat', msg));
//         tiktokConnectionWrapper.connection.on('gift', msg => console.log('gift', msg));
//         tiktokConnectionWrapper.connection.on('social', msg => console.log('social', msg));
//         tiktokConnectionWrapper.connection.on('like', msg => console.log('like', msg));
//         tiktokConnectionWrapper.connection.on('questionNew', msg => console.log('questionNew', msg));
//         tiktokConnectionWrapper.connection.on('linkMicBattle', msg => console.log('linkMicBattle', msg));
//         tiktokConnectionWrapper.connection.on('linkMicArmies', msg => console.log('linkMicArmies', msg));
//         tiktokConnectionWrapper.connection.on('liveIntro', msg => console.log('liveIntro', msg));
//         tiktokConnectionWrapper.connection.on('emote', msg => console.log('emote', msg));
//         tiktokConnectionWrapper.connection.on('envelope', msg => console.log('envelope', msg));
//         tiktokConnectionWrapper.connection.on('subscribe', msg => console.log('subscribe', msg));
//     });

//     socket.on('disconnect', () => {
//         if (tiktokConnectionWrapper) {
//             tiktokConnectionWrapper.disconnect();
//         }
//     });
// });

// Emit global connection statistics


// Serve frontend files

}

module.exports = TikTokChatReaderServer;