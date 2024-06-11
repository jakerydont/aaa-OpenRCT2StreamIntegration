
class Action {
    constructor(actionManager) {
        /**
         * @type {import("../ActionManager.js")}
         */
        this.actionManager = actionManager;
        this.identifier = "NONE";
    }

    trigger(params) {
        this.actionManager.send({
            type: this.identifier,
            username: params.username,
            message: params.message
        });
    }
}

module.exports = Action;