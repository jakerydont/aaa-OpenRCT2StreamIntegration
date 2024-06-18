const TwitchCom = require("./TwitchCom");
const ActionManager = require("./ActionManager");
const TriggerManager = require("./TriggerManager");
const TikTokChatReaderServer = require("./TikTokReader/server.js");
const TitTokChatReader = require("./TikTokReader/public/app.js");
const YouTubeReader = require("./YouTubeReader/livechat.js");

class App {
    constructor(config) {
        this.twitchCom = new TwitchCom(config, this);

        this.actionManager = new ActionManager(this);
        this.triggerManager = new TriggerManager(this.actionManager, config);
        this.tikTokChatReaderServer = new TikTokChatReaderServer(this.actionManager,this.triggerManager,config,this);
        this.youTubeReader = new YouTubeReader(this.actionManager,this.triggerManager,config,this);
        this.readyFlag = 0;
    }


    connect() {
        this.twitchCom.connect();
        this.actionManager.connect();
        this.tikTokChatReaderServer.connect();
        this.youTubeReader.connect();
        //this.tikTokChatTriggerManager.connect();
    }

    addReadyFlag(mask) {
        this.readyFlag = this.readyFlag | mask;

        if (this.readyFlag == (1 | 2 | 4 | 8)) {
            console.log("All systems are up and running. Ready to stream!");
        }
        else if (this.readyFlag == (1 | 2 | 4)) {
            console.log("All systems are up and running. Waiting for OpenRCT2 plugin to connect...");
        }
    }

    removeReadyFlag(mask) {
        this.readyFlag = this.readyFlag & ~mask;

        if (this.readyFlag != 1 | 2 | 4 | 8) {
            console.warn("One or more systems failed. Please standby");
        }
    }
}

module.exports = App;