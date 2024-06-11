

class TriggerManager {
    /**
     * Represents a TriggerManager object.
     * @constructor
     * @param {import("./ActionManager.js")} actionManager - The action manager.
     * @param {Object} config - The configuration object.
     * @param {boolean} [config.verbose=false] - Whether to enable verbose logging.
     * @param {Array} config.interactions - The interactions array.
     */
    constructor(actionManager, config) {
        /**
         * @type {import("./ActionManager.js")}
         */
        this.actionManager = actionManager;
		this.verbose = config.verbose || false;

        
        this.interactions = config.interactions;
    }

    trigger(type, params) {
        for (let i = 0; i < this.interactions.length; i++) {
            let interaction = this.interactions[i];

            let trigger = interaction.trigger;

            function appendActionParams(oldParams) {
                let newParams = {

                };
                for (let key in oldParams) {
                    newParams[key] = oldParams[key];
                }
                if (interaction.actionParams) {
                    for (let key in interaction.actionParams) {
                        newParams[key] = interaction.actionParams[key];
                    }
                }
                return newParams;
            }

            function isNumber(n) {
                return typeof n == 'number' && !isNaN(n) && isFinite(n);
            }

            function applyLimits() {
                let newParams = {

                };
                for (let key in params) {
                    newParams[key] = params[key];
                }
                if (interaction.trigger.limits) {
                    if (interaction.trigger.limits.default && newParams.message == "") {
                        newParams.message = interaction.trigger.limits.default;
                    }
                    if (isNumber(parseInt(newParams.message))) {
                        let val = parseInt(newParams.message);
                        if (interaction.trigger.limits.min && val < interaction.trigger.limits.min) {
                            val = interaction.trigger.limits.min;
                        }
                        if (interaction.trigger.limits.max && val > interaction.trigger.limits.max) {
                            val = interaction.trigger.limits.max;
                        }
                        newParams.message = val + "";
                    }
                }
                return newParams;
            }
            
            if (interaction.trigger.type == type) {
                if (type == "COMMAND") {
                    let firstPart = params.message.split(" ")[0];
                    if (firstPart.toLowerCase() == interaction.trigger.command.toLowerCase()) {
                        let strippedMessage = params.message.substring(interaction.trigger.command.length);
                        params.message = strippedMessage.trim();
                        let newParams = applyLimits();
                        newParams = appendActionParams(newParams);
                        this.actionManager.trigger(interaction.action, newParams);
                    }
                }
                else if (type == "CHANNEL_POINTS_REWARD") {
                    if (params.rewardTitle.toLowerCase().trim() == interaction.trigger.rewardTitle.toLowerCase()) {
                        let newParams = applyLimits();
                        newParams = appendActionParams(newParams);
                        this.actionManager.trigger(interaction.action, newParams);
                    }
                }
                else if (type == "SUBSCRIPTION") {
                    let newParams = applyLimits();
                    newParams = appendActionParams(newParams);
                    if (trigger.useGiverName) {
                        newParams.username = newParams.giver;
                    }
                    if (newParams.message == "") {
                        newParams.message = newParams.username;
                    }
                    this.actionManager.trigger(interaction.action, newParams);
                }
                else if (type == "VIEWER_JOINS") {
                    let newParams = applyLimits();
                    newParams = appendActionParams(newParams);
                    this.actionManager.trigger(interaction.action, newParams);
                }
            }
        }
    }
}

module.exports = TriggerManager;