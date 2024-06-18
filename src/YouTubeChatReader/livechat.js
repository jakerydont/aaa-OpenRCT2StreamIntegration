const secret = require('../../youtube-secret.json');
const fetch = require('node-fetch');

class YouTubeLiveChatReader {
    constructor(actionManager, triggerManager, config, integrationApp) {
      this.config = config;
      this.cachedUsernameLookup = {};
        this.actionManager = actionManager;
        this.triggerManager = triggerManager;
        
      
        this.integrationApp = integrationApp;
        this.previousMessageIDs = [];
        this.pollInterval = config.youtube.pollInterval || 5000;
    

        if (secret.apiKey == 'YourAPIKey') {
          console.error('YouTube: Seems you haven\'t supplied your API Key yet!');
          return;
        }
    }

    async connect() {
      this.chatId = await this.getChatId(this.config.youtube.videoID);
        setInterval(() => {
          this.getChatMessages();
        }, this.pollInterval);
    }
 async getUserName(userId) {
 
  let error;
  try {
    var res = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${userId}&key=${secret.apiKey}`
    );

    var data = await res.json();

    if (!data.error) {
      if (!data.items.length == 0) {
       
          this.cachedUsernameLookup[data.items[0].id] = data.items[0].snippet.title;
       
        return data.items[0].snippet.title;
      } else {
        error = 'No users found.';
        throw error;
      }
    } else {
      error = data.error.code + ': ' + data.error.errors[0].reason;
      throw error;
    }
  } catch {
    console.log('Oops! ' + error);
  }
}


 async getChatId(id) {
  let error;
  try {
    var res = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?part=liveStreamingDetails&key=${secret.apiKey}&id=${id}`
    );

    var data = await res.json();

    if (!data.error) {
      if (!data.items.length == 0) {
        let livechatid = data.items[0].liveStreamingDetails.activeLiveChatId;
        console.log(livechatid);
        return livechatid;
      } else {
        error = 'LiveStream not found.';
        throw error;
      }
    } else {
      error = data.error.code + ': ' + data.error.errors[0].reason;
      throw error;
    }
  } catch {
    console.log('Oops! ' + error);
  }
}

async  getChatMessages() {
  let error;
  try {
    var res = await fetch(
      `https://www.googleapis.com/youtube/v3/liveChat/messages?part=id%2C%20snippet&key=${secret.apiKey}&liveChatId=${this.chatId}`
    );

    var data = await res.json();

    if (!data.error) {
      if (!data.items.length == 0) {
        let printedMessages = 0;
        for (var i = 0; i < data.items.length; i++) {
          if (!this.previousMessageIDs.includes(data.items[i].id)) {
            this.previousMessageIDs.push(data.items[i].id);
            if (data.items[i].snippet.type == 'textMessageEvent') {

              let authorChannelId = data.items[i].snippet.authorChannelId;
              let authorChannelName = this.cachedUsernameLookup[authorChannelId];
              if (!authorChannelName) {
                authorChannelName = await this.getUserName(authorChannelId);
              }

              printedMessages++;
              console.log("YOUTUBE: ", printedMessages, authorChannelName, data.items[i].snippet.displayMessage);

              this.triggerManager.trigger('COMMAND', {username: authorChannelName, subscriber:false,message: data.items[i].snippet.displayMessage});
              
            }
            //console.log(data.items[i]);
          }

          
        } 
        while (this.previousMessageIDs.length > data.items.length * 2) {
          this.previousMessageIDs.shift();
        }
        //console.log(` -- ${i} checking for more messages in ${pollInterval / 1000} seconds --`);
      } else {
        error = 'No messages.';
        throw error;
      }
    } else {
      error = data.error.code + ': ' + data.error.errors[0].reason;
      throw error;
    }
  } catch (error) {
    console.log('Oops! ' + error);
  }
}

}

module.exports = YouTubeLiveChatReader;