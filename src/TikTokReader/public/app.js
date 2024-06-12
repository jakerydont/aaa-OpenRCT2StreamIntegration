const TikTokIOConnection = require('./connection.js');

class TiktokChatReader {

    constructor() {
        // This will use the demo backend if you open index.html locally via file://, otherwise your server will be used
        this.backendUrl = undefined;
        this.connection = new TikTokIOConnection("http://localhost:8082");

        this.username = "jakerydont";
        
        // Counter
        this.viewerCount = 0;
        this.likeCount = 0;
        this.diamondsCount = 0;
        
        connect();

        // New chat comment received
        connection.on('chat', (msg) => {
            if (window.settings.showChats === "0") return;

            addChatItem('', msg, msg.comment);
        })

        


        // New gift received
        connection.on('gift', (data) => {
            if (!isPendingStreak(data) && data.diamondCount > 0) {
                diamondsCount += (data.diamondCount * data.repeatCount);
                updateRoomStats();
            }

            if (window.settings.showGifts === "0") return;

            addGiftItem(data);
        })

        

        connection.on('streamEnd', () => {
            $('#stateText').text('Stream ended.');

            // schedule next try if obs username set
            if (window.settings.username) {
                setTimeout(() => {
                    connect(window.settings.username);
                }, 30000);
            }
        })

    }

    connect() {
    let uniqueId = this.username;
    if (uniqueId !== '') {

        console.log('Connecting to tiktok live stream with username', uniqueId);

        connection.connect(uniqueId, {
            enableExtendedGiftInfo: true
        }).then(state => {
            console.log(`Connected to roomId ${state.roomId}`);

            // reset stats
            viewerCount = 0;
            likeCount = 0;
            diamondsCount = 0;
            updateRoomStats();

        }).catch(errorMessage => {
            console.error(errorMessage);

            // schedule next try if obs username set
            if (window.settings.username) {
                setTimeout(() => {
                    connect(window.settings.username);
                }, 30000);
            }
        })

    } else {
        console.error('no username entered');
    }
}

// Prevent Cross site scripting (XSS)
 sanitize(text) {
    return text.replace(/</g, '&lt;')
}

 updateRoomStats() {
   console.log(`Viewers: <b>${viewerCount.toLocaleString()}</b> Likes: <b>${likeCount.toLocaleString()}</b> Earned Diamonds: <b>${diamondsCount.toLocaleString()}</b>`)
}

 generateUsernameLink(data) {
    return `<a class="usernamelink" href="https://www.tiktok.com/@${data.uniqueId}" target="_blank">${data.uniqueId}</a>`;
}

 isPendingStreak(data) {
    return data.giftType === 1 && !data.repeatEnd;
}

/**
 * Add a new message to the chat container
 */
 addChatItem(color, data, text, summarize) {
    let container = location.href.includes('obs.html') ? $('.eventcontainer') : $('.chatcontainer');

    if (container.find('div').length > 500) {
        container.find('div').slice(0, 200).remove();
    }

    container.find('.temporary').remove();;

    container.append(`
        <div class=${summarize ? 'temporary' : 'static'}>
            <img class="miniprofilepicture" src="${data.profilePictureUrl}">
            <span>
                <b>${generateUsernameLink(data)}:</b> 
                <span style="color:${color}">${sanitize(text)}</span>
            </span>
        </div>
    `);

    container.stop();
    container.animate({
        scrollTop: container[0].scrollHeight
    }, 400);
}

/**
 * Add a new gift to the gift container
 */
 addGiftItem(data) {
    let container = location.href.includes('obs.html') ? $('.eventcontainer') : $('.giftcontainer');

    if (container.find('div').length > 200) {
        container.find('div').slice(0, 100).remove();
    }

    let streakId = data.userId.toString() + '_' + data.giftId;

    let html = `
        <div data-streakid=${isPendingStreak(data) ? streakId : ''}>
            <img class="miniprofilepicture" src="${data.profilePictureUrl}">
            <span>
                <b>${generateUsernameLink(data)}:</b> <span>${data.describe}</span><br>
                <div>
                    <table>
                        <tr>
                            <td><img class="gifticon" src="${data.giftPictureUrl}"></td>
                            <td>
                                <span>Name: <b>${data.giftName}</b> (ID:${data.giftId})<span><br>
                                <span>Repeat: <b style="${isPendingStreak(data) ? 'color:red' : ''}">x${data.repeatCount.toLocaleString()}</b><span><br>
                                <span>Cost: <b>${(data.diamondCount * data.repeatCount).toLocaleString()} Diamonds</b><span>
                            </td>
                        </tr>
                    </tabl>
                </div>
            </span>
        </div>
    `;

    let existingStreakItem = container.find(`[data-streakid='${streakId}']`);

    if (existingStreakItem.length) {
        existingStreakItem.replaceWith(html);
    } else {
        container.append(html);
    }

    container.stop();
    container.animate({
        scrollTop: container[0].scrollHeight
    }, 800);
}





}

module.exports = TiktokChatReader;