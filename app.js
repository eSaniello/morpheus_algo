const TelegramBot = require('node-telegram-bot-api');
const FTX = require('ftx-api-rest');
const FTXWs = require('ftx-api-ws');
const cron = require('node-cron');
const express = require("express");
const HELPER = require('./services/helper.service');
const sqlite3 = require('sqlite3');
const app = express();
// To parse the incoming requests with JSON payloads
app.use(express.urlencoded({ extended: true }));
app.use(express.text());
app.use(express.json());

const PORT = process.env.PORT || 80;

// open the database
let db = new sqlite3.Database('./db/morpheus.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error(err.message);
    }
    console.log('Connected to the morpheus database.');
});

app.use(express.urlencoded({ extended: true }));
app.use(express.json()); // To parse the incoming requests with JSON payloads

// Telegram stuff
const token = 'tg token';
// Create a bot that uses 'polling' to fetch new updates
const bot = new TelegramBot(token, { polling: true });
bot.on("polling_error", (msg) => console.log(msg));

bot.on('message', async (msg) => {
    // get ID from the one who chats
    const chatId = msg.chat.id;
    let text = msg.text ? msg.text : '';

    if (HELPER.checkText(text, 'alert')) {
        bot.sendMessage(chatId, `So, you want Tradingview alerts right? 👀 He's what you need to do:
- Set the condition of your indicator
- Options = Once per bar close
- Webhook URL = https://checkawsec2url/hook
- Give it any alert name
- Message should be = {"chatId":${chatId},"type":"BUY or SELL or CLOSE","exchange":"{{exchange}}","ticker":"{{ticker}}","timeframe":"{{interval}}","TP":"Your take profit price","SL":"Your stop loss price","reason":"Reason for this alert"}`);
    }
});

// FTX stuff
const ftx = new FTX({
    key: '',
    secret: '',
    subaccount: 'morpheus_algo'
});

// FTX WEBSOCKET
// only public channels:
// const ftxws = new FTXWs();

// const go = async () => {
//     await ftxws.connect();

//     ftxws.subscribe('trades', 'BTC-PERP');
//     ftxws.on('BTC-PERP::trades', (data) => {
//         data.forEach(d => {
//             if (d.liquidation == true)
//                 console.log(d);
//         });
//     });

//     // if you want to know when the status of underlying socket changes
//     ftxws.on('statusChange', console.log);
// }

// go();

app.get("/info", (req, res) => {
    res.status(200).send('meow').end();
});

// // Cron job
// // This function will be used for trade management
// cron.schedule('*/5 * * * * *', function () {
//     // TRADE MANAGEMENT
//     // Trade management procedure:
//     // TP 1:1 hit >>> close half position >>> move SL to BE >> TP 1:2 hit >>> Trailing stop from tp 1:1 with distance of 1:1 to 1:2

//     // Stages for positions:
//     // 0 => trade open and tp 1 is not hit yet
//     // 1 => tp 1 hit and sl moved to be
//     // 2 => tp 2 hit and trailing stop activated
//     // 3 => trade is closed in profit or sl hit

//     // Stages for targets:
//     // 0 => target is still active
//     // 1 => target has been hit and it now not used

//     // get all open positions
//     db.all("SELECT * FROM positions where stage < 3", (error, row) => {
//         // Loop over every single position
//         row.forEach(pos => {
//             // Logic for BUY orders
//             if (pos.side == 'BUY') {
//                 // Get current market bid price for this pos
//                 ftx.request({
//                     method: 'GET',
//                     path: `/futures/${pos.pair}`
//                 }).then((price) => {
//                     let currentPrice = price.result.ask;

//                     // get the SL and TP for this position 
//                     db.all("SELECT * FROM targets where pos_id = " + pos.id, (error, row) => {
//                         // Loop over every single target
//                         row.forEach(target => {
//                             // Check if TP 1 is hit
//                             if (target.type == "TP1" && target.stage == 0 && currentPrice >= target.price && pos.stage == 0) {
//                                 // Move FTX SL to BE
//                                 row.forEach(s => {
//                                     if (s.type == 'SL') {
//                                         ftx.request({
//                                             method: 'POST',
//                                             path: `/conditional_orders/${s.order_id}/modify`,
//                                             data: {
//                                                 'size': s.size / 2,
//                                                 'triggerPrice': pos.entryPrice,
//                                                 'orderPrice': pos.entryPrice,
//                                             }
//                                         }).then((d) => {
//                                             // change in db too
//                                             // Move SL to BE
//                                             db.run(`UPDATE targets SET price = ${pos.entryPrice} WHERE pos_id = ${pos.id} AND type = "SL"`);
//                                             // set TP1 stage to 1
//                                             db.run(`UPDATE targets SET stage = 1 WHERE pos_id = ${pos.id} AND type = "TP1"`);
//                                             // set position stage to 1
//                                             db.run(`UPDATE positions SET stage = 1 WHERE id = ${pos.id}`);

//                                             bot.sendMessage(-529666290, `Moved ${pos.pair} SL to Break-even`);
//                                         }).catch((err) => {
//                                             console.log(err);
//                                             bot.sendMessage(-529666290, `Error one line 122 fix yo shit man`);
//                                         });
//                                     }
//                                 });
//                             }
//                             // Check if TP 2 is hit
//                             else if (target.type == "TP2" && target.stage == 0 && currentPrice >= target.price && pos.stage == 1) {
//                                 // cancel all FTX open trigger orders
//                                 ftx.request({
//                                     method: 'DELETE',
//                                     path: `/orders`,
//                                     data: {
//                                         'market': pos.pair,
//                                         'conditionalOrdersOnly': true,
//                                     }
//                                 }).then((d) => {
//                                     // activate trailing stop
//                                     ftx.request({
//                                         method: 'POST',
//                                         path: `/conditional_orders`,
//                                         data: {
//                                             'market': pos.pair,
//                                             'side': 'sell',
//                                             'size': pos.size / 2,
//                                             'type': 'trailingStop',
//                                             'trailValue': pos.trailValue,
//                                         }
//                                     }).then((d) => {
//                                         // change in db
//                                         // set SL stage to 1
//                                         db.run(`UPDATE targets SET stage = 1 WHERE pos_id = ${pos.id} AND type = "SL"`);
//                                         // set tp2 stage to 1
//                                         db.run(`UPDATE targets SET stage = 1 WHERE pos_id = ${pos.id} AND type = "TP2"`);
//                                         // set position stage to 2
//                                         db.run(`UPDATE positions SET stage = 2 WHERE id = ${pos.id}`);

//                                         bot.sendMessage(-529666290, `${pos.pair} TP 1:2 hit`);
//                                         bot.sendMessage(-529666290, `Activated ${pos.pair} trailing stop`);
//                                     }).catch((err) => {
//                                         console.log(err);
//                                         bot.sendMessage(-529666290, `Error one line 165 fix yo shit man`);
//                                     });
//                                 }).catch((err) => {
//                                     console.log(err);
//                                     bot.sendMessage(-529666290, `Error one line 169 fix yo shit man`);
//                                 });
//                             }
//                             // Check if SL is hit
//                             else if (target.type == "SL" && target.stage == 0 && currentPrice <= target.price) {
//                                 // cancel all FTX open trigger orders
//                                 ftx.request({
//                                     method: 'DELETE',
//                                     path: `/orders`,
//                                     data: {
//                                         'market': pos.pair,
//                                         'conditionalOrdersOnly': true,
//                                     }
//                                 }).then((d) => {
//                                     // change in db
//                                     // set SL stage to 1
//                                     db.run(`UPDATE targets SET stage = 1 WHERE pos_id = ${pos.id} AND type = "SL"`);
//                                     // set tp1 stage to 1
//                                     db.run(`UPDATE targets SET stage = 1 WHERE pos_id = ${pos.id} AND type = "TP1"`);
//                                     // set tp2 stage to 1
//                                     db.run(`UPDATE targets SET stage = 1 WHERE pos_id = ${pos.id} AND type = "TP2"`);
//                                     // set position stage to 2
//                                     db.run(`UPDATE positions SET stage = 3 WHERE id = ${pos.id}`);

//                                     bot.sendMessage(-529666290, `${pos.pair} SL hit :(`);
//                                 }).catch((err) => {
//                                     console.log(err);
//                                     bot.sendMessage(-529666290, `Error one line 197 fix yo shit man`);
//                                 });
//                             }
//                         });
//                     });
//                 }).catch((err) => {
//                     console.log(err);
//                     bot.sendMessage(-529666290, `Error one line 204 fix yo shit man`);
//                 });
//             }
//             // Logic for SELL orders
//             else if (pos.side == 'SELL') {
//                 // Get current market bid price for this pos
//                 ftx.request({
//                     method: 'GET',
//                     path: `/futures/${pos.pair}`
//                 }).then((price) => {
//                     let currentPrice = price.result.bid;

//                     // get the SL and TP for this position 
//                     db.all("SELECT * FROM targets where pos_id = " + pos.id, (error, row) => {
//                         // Loop over every single target
//                         row.forEach(target => {
//                             // Check if TP 1 is hit
//                             if (target.type == "TP1" && target.stage == 0 && currentPrice <= target.price && pos.stage == 0) {
//                                 // Move FTX SL to BE
//                                 row.forEach(s => {
//                                     if (s.type == 'SL') {
//                                         ftx.request({
//                                             method: 'POST',
//                                             path: `/conditional_orders/${s.order_id}/modify`,
//                                             data: {
//                                                 'size': s.size / 2,
//                                                 'triggerPrice': pos.entryPrice,
//                                                 'orderPrice': pos.entryPrice,
//                                             }
//                                         }).then((d) => {
//                                             // change in db
//                                             // Move SL to BE
//                                             db.run(`UPDATE targets SET price = ${pos.entryPrice} WHERE pos_id = ${pos.id} AND type = "SL"`);
//                                             // set TP1 stage to 1
//                                             db.run(`UPDATE targets SET stage = 1 WHERE pos_id = ${pos.id} AND type = "TP1"`);
//                                             // set position stage to 1
//                                             db.run(`UPDATE positions SET stage = 1 WHERE id = ${pos.id}`);

//                                             bot.sendMessage(-529666290, `Moved ${pos.pair} SL to Break-even`);
//                                         }).catch((err) => {
//                                             console.log(err);
//                                             bot.sendMessage(-529666290, `Error one line 249 fix yo shit man`);
//                                         });
//                                     }
//                                 });
//                             }
//                             // Check if TP 2 is hit
//                             else if (target.type == "TP2" && target.stage == 0 && currentPrice <= target.price && pos.stage == 1) {
//                                 // cancel all FTX open trigger orders
//                                 ftx.request({
//                                     method: 'DELETE',
//                                     path: `/orders`,
//                                     data: {
//                                         'market': pos.pair,
//                                         'conditionalOrdersOnly': true,
//                                     }
//                                 }).then((d) => {
//                                     // activate trailing stop
//                                     ftx.request({
//                                         method: 'POST',
//                                         path: `/conditional_orders`,
//                                         data: {
//                                             'market': pos.pair,
//                                             'side': 'buy',
//                                             'size': pos.size / 2,
//                                             'type': 'trailingStop',
//                                             'trailValue': pos.trailValue,
//                                         }
//                                     }).then((d) => {
//                                         // change in db
//                                         // set SL stage to 1
//                                         db.run(`UPDATE targets SET stage = 1 WHERE pos_id = ${pos.id} AND type = "SL"`);
//                                         // set tp2 stage to 1
//                                         db.run(`UPDATE targets SET stage = 1 WHERE pos_id = ${pos.id} AND type = "TP2"`);
//                                         // set position stage to 2
//                                         db.run(`UPDATE positions SET stage = 2 WHERE id = ${pos.id}`);

//                                         bot.sendMessage(-529666290, `${pos.pair} TP 1:2 hit`);
//                                         bot.sendMessage(-529666290, `Activated ${pos.pair} trailing stop`);
//                                     }).catch((err) => {
//                                         console.log(err);
//                                         bot.sendMessage(-529666290, `Error one line 291 fix yo shit man`);
//                                     });
//                                 }).catch((err) => {
//                                     console.log(err);
//                                     bot.sendMessage(-529666290, `Error one line 295 fix yo shit man`);
//                                 });
//                             }
//                             // Check if SL is hit
//                             else if (target.type == "SL" && target.stage == 0 && currentPrice >= target.price) {
//                                 // cancel all FTX open trigger orders
//                                 ftx.request({
//                                     method: 'DELETE',
//                                     path: `/orders`,
//                                     data: {
//                                         'market': pos.pair,
//                                         'conditionalOrdersOnly': true,
//                                     }
//                                 }).then((d) => {
//                                     // change in db
//                                     // set SL stage to 1
//                                     db.run(`UPDATE targets SET stage = 1 WHERE pos_id = ${pos.id} AND type = "SL"`);
//                                     // set tp1 stage to 1
//                                     db.run(`UPDATE targets SET stage = 1 WHERE pos_id = ${pos.id} AND type = "TP1"`);
//                                     // set tp2 stage to 1
//                                     db.run(`UPDATE targets SET stage = 1 WHERE pos_id = ${pos.id} AND type = "TP2"`);
//                                     // set position stage to 2
//                                     db.run(`UPDATE positions SET stage = 3 WHERE id = ${pos.id}`);

//                                     bot.sendMessage(-529666290, `${pos.pair} SL hit :(`);
//                                 }).catch((err) => {
//                                     console.log(err);
//                                     bot.sendMessage(-529666290, `Error one line 323 fix yo shit man`);
//                                 });
//                             }
//                         });
//                     });
//                 }).catch((err) => {
//                     console.log(err);
//                     bot.sendMessage(-529666290, `Error one line 330 fix yo shit man`);
//                 });
//             }
//         });
//     });
// });

app.get("/", (req, res) => {
    res.status(200).send('Ga weg, ik heb geen geld!').end();
});

// this function will be used for trade opening
app.post("/hook", (req, res) => {
    console.log('Webhook received', req.body);
    if (req.body.chatId) {
        const order = req.body;
        //         bot.sendMessage(order.chatId, `✅ Morpheus Algo signal recieved:
        // ${order.type} signal for ${order.ticker} on ${order.exchange}\nTimeframe: ${order.timeframe || "Not specified"}\nTP: ${order.TP || "Not specified"}\nSL: ${order.SL || "Not specified"}\nReason: ${order.reason || "Not specified"}`);

        // trade execution for long signals
        if (order.type.toLowerCase() === 'buy') {
            // extract the correct pair from the string. 
            // THIS WILL ONLY WORK FOR PERPS!
            let pair = `${order.ticker.toLowerCase().slice(0, order.ticker.length - 4)}-perp`;

            let entry = 0;
            let sl = order.SL;
            let account_size = 0;
            let risk = 2;
            let pos_size = 0;
            // get account size
            ftx.request({
                method: 'GET',
                path: '/account'
            }).then((acc) => {
                // get ask price for perp
                ftx.request({
                    method: 'GET',
                    path: `/futures/${pair}`
                }).then((price) => {
                    entry = price.result.ask;
                    account_size = acc.result.totalAccountValue;
                    pos_size = (account_size * (risk * 0.01)) / (entry - sl);
                    console.log(`Account size: ${account_size}\nEntry: ${entry}\nSL: ${sl}\nRisk percentage: ${risk}%\nPosition size: ${pos_size}`);

                    // Place order
                    if (pos_size != 0) {
                        ftx.request({
                            method: 'POST',
                            path: '/orders',
                            data: {
                                'market': pair,
                                'side': 'buy',//sell
                                'type': 'market',//limit
                                'price': null,//null if market
                                'size': pos_size,
                            }
                        }).then((data) => {
                            console.log(data);
                            // Place SL
                            ftx.request({
                                method: 'POST',
                                path: '/conditional_orders',
                                data: {
                                    'market': pair,
                                    'side': 'sell',
                                    'type': 'stop',
                                    'size': pos_size,
                                    'triggerPrice': order.SL,
                                    'orderPrice': order.SL,
                                    "retryUntilFilled": true
                                }
                            }).then((sl) => {
                                console.log(sl);
                                // Place TP
                                ftx.request({
                                    method: 'POST',
                                    path: '/conditional_orders',
                                    data: {
                                        'market': pair,
                                        'side': 'sell',
                                        'type': 'takeProfit',
                                        'size': pos_size / 2, //close half on TP 1
                                        'triggerPrice': order.TP,
                                        'orderPrice': order.TP,
                                        "retryUntilFilled": true
                                    }
                                }).then((tp) => {
                                    console.log(tp);
                                    bot.sendMessage(order.chatId, `✅ Morpheus Algo order executed:
                                    ${order.type} signal for ${order.ticker} on ${order.exchange}\nTimeframe: ${order.timeframe || "Not specified"}\nTP: ${order.TP || "Not specified"}\nSL: ${order.SL || "Not specified"}\nReason: ${order.reason || "Not specified"}`);

                                    // // insert trade into database
                                    // db.run(`INSERT INTO positions(date, pair, size, entryPrice, exitPrice, side, pnl, stage, trailValue, closedHalf) VALUES("${new Date()}", "${pair}", ${pos_size}, ${entry}, ${0}, "BUY", ${0}, ${0}, ${order.SL - entry}, ${0})`, (err) => {
                                    //     if (err) {
                                    //         return console.log(err.message);
                                    //     }

                                    //     // get the last insert id
                                    //     console.log(`A position has been inserted with id ${this.lastID}`);

                                    //     // insert SL
                                    //     insertTarget(new Date(), this.lastID, sl.result.id, pair, pos_size, order.SL, 'SELL', 'SL', 0);
                                    //     // insert TP 1
                                    //     insertTarget(new Date(), this.lastID, tp.result.id, pair, pos_size / 2, order.TP, 'SELL', 'TP1', 0);
                                    //     // insert TP 2
                                    //     insertTarget(new Date(), this.lastID, tp.result.id, pair, pos_size / 2, (order.TP + (order.TP - entry)), 'SELL', 'TP2', 0);
                                    // });
                                }).catch((err) => {
                                    console.log(err);
                                    bot.sendMessage(-529666290, `Error one line 466 fix yo shit man`);
                                });
                            }).catch((err) => {
                                console.log(err);
                                bot.sendMessage(-529666290, `Error one line 470 fix yo shit man`);
                            });
                        }).catch((err) => {
                            console.log(err);
                            bot.sendMessage(-529666290, `Error one line 474 fix yo shit man`);
                        });
                    } else {
                        console.log('Error with calculation of position size');
                        bot.sendMessage(-529666290, `Error with calculation of pos size for buying`);
                    }
                }).catch((err) => {
                    console.log(err);
                    bot.sendMessage(-529666290, `Error one line 399 fix yo shit man`);
                });
            }).catch((err) => {
                console.log(err);
                bot.sendMessage(-529666290, `Error one line 403 fix yo shit man`);
            });
        }
        // trade execution for short signals
        else if (order.type.toLowerCase() === 'sell') {
            // extract the correct pair from the string. 
            // THIS WILL ONLY WORK FOR PERPS!
            let pair = `${order.ticker.toLowerCase().slice(0, order.ticker.length - 4)}-perp`;

            let entry = 0;
            let sl = order.SL;
            let account_size = 0;
            let risk = 2;
            let pos_size = 0;
            // get account size
            ftx.request({
                method: 'GET',
                path: '/account'
            }).then((acc) => {
                // get bid price for perp
                ftx.request({
                    method: 'GET',
                    path: `/futures/${pair}`
                }).then((price) => {
                    entry = price.result.bid;
                    account_size = acc.result.totalAccountValue;
                    pos_size = (account_size * (risk * 0.01)) / (sl - entry);
                    console.log(`Account size: ${account_size}\nEntry: ${entry}\nSL: ${sl}\nRisk percentage: ${risk}%\nPosition size: ${pos_size}`);

                    // Place order
                    if (pos_size != 0) {
                        ftx.request({
                            method: 'POST',
                            path: '/orders',
                            data: {
                                'market': pair,
                                'side': 'sell',
                                'type': 'market',//limit
                                'price': null,
                                'size': pos_size,
                            }
                        }).then((data) => {
                            console.log(data);
                            // Place SL
                            ftx.request({
                                method: 'POST',
                                path: '/conditional_orders',
                                data: {
                                    'market': pair,
                                    'side': 'buy',
                                    'type': 'stop',
                                    'size': pos_size,
                                    'triggerPrice': order.SL,
                                    'orderPrice': order.SL,
                                    "retryUntilFilled": true
                                }
                            }).then((sl) => {
                                console.log(sl);
                                // Place TP
                                ftx.request({
                                    method: 'POST',
                                    path: '/conditional_orders',
                                    data: {
                                        'market': pair,
                                        'side': 'buy',
                                        'type': 'takeProfit',
                                        'size': pos_size / 2,
                                        'triggerPrice': order.TP,
                                        'orderPrice': order.TP,
                                        "retryUntilFilled": true
                                    }
                                }).then((tp) => {
                                    console.log(tp);
                                    bot.sendMessage(order.chatId, `✅ Morpheus Algo order executed:
                                    ${order.type} signal for ${order.ticker} on ${order.exchange}\nTimeframe: ${order.timeframe || "Not specified"}\nTP: ${order.TP || "Not specified"}\nSL: ${order.SL || "Not specified"}\nReason: ${order.reason || "Not specified"}`);

                                    // // insert trade into database
                                    // db.run(`INSERT INTO positions(date, pair, size, entryPrice, exitPrice, side, pnl, stage, trailValue, closedHalf) VALUES("${new Date()}", "${pair}", ${pos_size}, ${entry}, ${0}, "SELL", ${0}, ${0}, ${order.SL - entry}, ${0})`, (err) => {
                                    //     if (err) {
                                    //         return console.log(err.message);
                                    //     }

                                    //     // get the last insert id
                                    //     console.log(`A position has been inserted with id ${this.lastID}`);

                                    //     // insert SL
                                    //     insertTarget(new Date(), this.lastID, sl.result.id, pair, pos_size, order.SL, 'BUY', 'SL', 0);
                                    //     // insert TP 1
                                    //     insertTarget(new Date(), this.lastID, tp.result.id, pair, pos_size / 2, order.TP, 'BUY', 'TP1', 0);
                                    //     // insert TP 2
                                    //     insertTarget(new Date(), this.lastID, tp.result.id, pair, pos_size / 2, (order.TP - (entry - order.TP)), 'BUY', 'TP2', 0);
                                    // });
                                }).catch((err) => {
                                    console.log(err);
                                    bot.sendMessage(-529666290, `Error one line 578 fix yo shit man`);
                                });
                            }).catch((err) => {
                                console.log(err);
                                bot.sendMessage(-529666290, `Error one line 582 fix yo shit man`);
                            });
                        }).catch((err) => {
                            console.log(err);
                            bot.sendMessage(-529666290, `Error one line 586 fix yo shit man`);
                        });
                    } else {
                        console.log('Error with calculation of position size');
                        bot.sendMessage(-529666290, `Error with calculation of position size for selling`);
                    }
                }).catch((err) => {
                    console.log(err);
                    bot.sendMessage(-529666290, `Error one line 511 fix yo shit man`);
                });
            }).catch((err) => {
                console.log(err);
                bot.sendMessage(-529666290, `Error one line 515 fix yo shit man`);
            });
        }
        // // trade execution for exit long half signals
        // else if (order.type.toLowerCase() === 'exit_long_half') {
        //     // extract the correct pair from the string. 
        //     // THIS WILL ONLY WORK FOR PERPS!
        //     let pair = `${order.ticker.toLowerCase().slice(0, order.ticker.length - 4)}-perp`;

        //     // check if already in long position for this pair
        //     ftx.request({
        //         method: 'GET',
        //         path: '/positions',
        //     }).then((positions) => {
        //         positions.result.forEach(pos => {
        //             if (pos.size > 0 && pos.future == pair && pos.side == 'buy') {
        //                 db.all("SELECT * FROM positions where stage = 0 and closedHalf = 0 and pair = " + pair, (error, row) => {
        //                     row.forEach(_pos => {
        //                         if (_pos.stage == 0 && _pos.closedHalf == 0) {
        //                             // close half of the long position
        //                             ftx.request({
        //                                 method: 'POST',
        //                                 path: '/orders',
        //                                 data: {
        //                                     'market': pair,
        //                                     'side': 'sell',
        //                                     'type': 'market',
        //                                     'price': null,
        //                                     'size': pos.size / 2,
        //                                 }
        //                             }).then((data) => {
        //                                 console.log(data)
        //                                 console.log('successfully closed half of long position');
        //                                 // update closedHalf to 1
        //                                 db.run(`UPDATE positions SET closedHalf = 1 WHERE id = ${_pos.id}`);

        //                                 // cancel FTX open TP1
        //                                 db.all("SELECT * FROM targets where type = 'TP1' AND pos_id = " + _pos.id, (error, row) => {
        //                                     // Loop over every single target
        //                                     row.forEach(target => {
        //                                         if (target.type == 'TP1' && target.stage == 0) {
        //                                             ftx.request({
        //                                                 method: 'DELETE',
        //                                                 path: `/conditional_orders/${target.order_id}`,
        //                                             }).then((d) => {
        //                                                 console.log(d.result);
        //                                                 bot.sendMessage(-529666290, `TP 1:1 hit, closing half of ${pair}`);

        //                                                 db.run(`UPDATE targets SET stage = 1 WHERE pos_id = ${_pos.id} AND type = "TP1"`);
        //                                             }).catch((err) => {
        //                                                 console.log(err);
        //                                                 bot.sendMessage(-529666290, `Error one line 644 fix yo shit man`);
        //                                             });
        //                                         }
        //                                     }).catch((err) => {
        //                                         console.log(err);
        //                                         bot.sendMessage(-529666290, `Error one line 649 fix yo shit man`);
        //                                     });
        //                                 });
        //                             });
        //                         }
        //                     });
        //                 });
        //             }
        //         });
        //     }).catch((err) => {
        //         console.log(err);
        //         bot.sendMessage(-529666290, `Error one line 660 fix yo shit man`);
        //     });
        // }
        // // trade execution for exit short half signals
        // else if (order.type.toLowerCase() === 'exit_short_half') {
        //     // extract the correct pair from the string. 
        //     // THIS WILL ONLY WORK FOR PERPS!
        //     let pair = `${order.ticker.toLowerCase().slice(0, order.ticker.length - 4)}-perp`;

        //     // check if already in short position for this pair
        //     ftx.request({
        //         method: 'GET',
        //         path: '/positions',
        //     }).then((positions) => {
        //         positions.result.forEach(pos => {
        //             if (pos.size > 0 && pos.future == pair && pos.side == 'sell') {
        //                 db.all("SELECT * FROM positions where stage = 0 and closedHalf = 0 and pair = " + pair, (error, row) => {
        //                     row.forEach(_pos => {
        //                         if (_pos.stage == 0 && _pos.closedHalf == 0) {
        //                             // close half of the long position
        //                             ftx.request({
        //                                 method: 'POST',
        //                                 path: '/orders',
        //                                 data: {
        //                                     'market': pair,
        //                                     'side': 'buy',
        //                                     'type': 'market',
        //                                     'price': null,
        //                                     'size': pos.size / 2,
        //                                 }
        //                             }).then((data) => {
        //                                 console.log(data)
        //                                 console.log('successfully closed half of long position');
        //                                 // update closedHalf to 1
        //                                 db.run(`UPDATE positions SET closedHalf = 1 WHERE id = ${_pos.id}`);

        //                                 // cancel FTX open TP1
        //                                 db.all("SELECT * FROM targets where type = 'TP1' AND pos_id = " + _pos.id, (error, row) => {
        //                                     // Loop over every single target
        //                                     row.forEach(target => {
        //                                         if (target.type == 'TP1' && target.stage == 0) {
        //                                             ftx.request({
        //                                                 method: 'DELETE',
        //                                                 path: `/conditional_orders/${target.order_id}`,
        //                                             }).then((d) => {
        //                                                 console.log(d.result);
        //                                                 bot.sendMessage(-529666290, `TP 1:1 hit, closing half of ${pair}`);

        //                                                 db.run(`UPDATE targets SET stage = 1 WHERE pos_id = ${_pos.id} AND type = "TP1"`);
        //                                             }).catch((err) => {
        //                                                 console.log(err);
        //                                                 bot.sendMessage(-529666290, `Error one line 714 fix yo shit man`);
        //                                             });
        //                                         }
        //                                     }).catch((err) => {
        //                                         console.log(err);
        //                                         bot.sendMessage(-529666290, `Error one line 719 fix yo shit man`);
        //                                     });
        //                                 });
        //                             }).catch((err) => {
        //                                 console.log(err);
        //                                 bot.sendMessage(-529666290, `Error one line 724 fix yo shit man`);
        //                             });
        //                         }
        //                     });
        //                 });
        //             }
        //         });
        //     }).catch((err) => {
        //         console.log(err);
        //         bot.sendMessage(-529666290, `Error one line 733 fix yo shit man`);
        //     });
        // }
        // trade execution for exit long signals
        else if (order.type.toLowerCase() === 'exit_long') {
            // extract the correct pair from the string. 
            // THIS WILL ONLY WORK FOR PERPS!
            let pair = `${order.ticker.toLowerCase().slice(0, order.ticker.length - 4)}-perp`;

            // check if already in long position for this pair
            ftx.request({
                method: 'GET',
                path: '/positions',
            }).then((positions) => {
                positions.result.forEach(pos => {
                    if (pos.size > 0 && pos.future == pair && pos.side == 'buy') {
                        // close the long position
                        ftx.request({
                            method: 'POST',
                            path: '/orders',
                            data: {
                                'market': pair,
                                'side': 'sell',
                                'type': 'market',
                                'price': null,
                                'size': pos.size,
                            }
                        }).then((data) => {
                            console.log(data)
                            bot.sendMessage(-529666290, `Exit signal, closing full position of ${pair}`);
                            console.log('successfully closed long position');
                        }).catch((err) => {
                            console.log(err);
                            bot.sendMessage(-529666290, `Error one line 777 fix yo shit man`);
                        });
                        // db.all("SELECT * FROM positions where stage < 3 and pair = " + pair, (error, row) => {
                        //     row.forEach(_pos => {
                        //         // close the long position
                        //         ftx.request({
                        //             method: 'POST',
                        //             path: '/orders',
                        //             data: {
                        //                 'market': pair,
                        //                 'side': 'sell',
                        //                 'type': 'market',
                        //                 'price': null,
                        //                 'size': pos.size,
                        //             }
                        //         }).then((data) => {
                        //             console.log(data)
                        //             bot.sendMessage(-529666290, `Exit signal, closing full position of ${pair}`);

                        //             console.log('successfully closed long position');
                        //             // update stages on position and it targets
                        //             db.run(`UPDATE positions SET stage = 3 WHERE id = ${_pos.id}`);
                        //             db.run(`UPDATE targets SET stage = 1 WHERE pos_id = ${_pos.id} AND type = "SL"`);
                        //             db.run(`UPDATE targets SET stage = 1 WHERE pos_id = ${_pos.id} AND type = "TP1"`);
                        //             db.run(`UPDATE targets SET stage = 1 WHERE pos_id = ${_pos.id} AND type = "TP2"`);
                        //         }).catch((err) => {
                        //             console.log(err);
                        //             bot.sendMessage(-529666290, `Error one line 777 fix yo shit man`);
                        //         });
                        //     });
                        // });
                    }
                });
            }).catch((err) => {
                console.log(err);
                bot.sendMessage(-529666290, `Error one line 785 fix yo shit man`);
            });
        }
        // trade execution for exit short signals
        else if (order.type.toLowerCase() === 'exit_short') {
            // extract the correct pair from the string. 
            // THIS WILL ONLY WORK FOR PERPS!
            let pair = `${order.ticker.toLowerCase().slice(0, order.ticker.length - 4)}-perp`;

            // check if already in short position for this pair
            ftx.request({
                method: 'GET',
                path: '/positions',
            }).then((positions) => {
                positions.result.forEach(pos => {
                    if (pos.size > 0 && pos.future == pair && pos.side == 'sell') {
                        // close the short position
                        ftx.request({
                            method: 'POST',
                            path: '/orders',
                            data: {
                                'market': pair,
                                'side': 'buy',
                                'type': 'market',
                                'price': null,
                                'size': pos.size,
                            }
                        }).then((data) => {
                            console.log(data)
                            bot.sendMessage(-529666290, `Exit signal, closing full position of ${pair}`);
                            console.log('successfully closed short position');
                        }).catch((err) => {
                            console.log(err);
                            bot.sendMessage(-529666290, `Error one line 829 fix yo shit man`);
                        });
                        // db.all("SELECT * FROM positions where stage < 3 and pair = " + pair, (error, row) => {
                        //     row.forEach(_pos => {
                        //         // close the short position
                        //         ftx.request({
                        //             method: 'POST',
                        //             path: '/orders',
                        //             data: {
                        //                 'market': pair,
                        //                 'side': 'buy',
                        //                 'type': 'market',
                        //                 'price': null,
                        //                 'size': pos.size,
                        //             }
                        //         }).then((data) => {
                        //             console.log(data)
                        //             bot.sendMessage(-529666290, `Exit signal, closing full position of ${pair}`);
                        //             console.log('successfully closed short position');
                        //             // update stages on position and it targets
                        //             db.run(`UPDATE positions SET stage = 3 WHERE id = ${_pos.id}`);
                        //             db.run(`UPDATE targets SET stage = 1 WHERE pos_id = ${_pos.id} AND type = "SL"`);
                        //             db.run(`UPDATE targets SET stage = 1 WHERE pos_id = ${_pos.id} AND type = "TP1"`);
                        //             db.run(`UPDATE targets SET stage = 1 WHERE pos_id = ${_pos.id} AND type = "TP2"`);
                        //         }).catch((err) => {
                        //             console.log(err);
                        //             bot.sendMessage(-529666290, `Error one line 829 fix yo shit man`);
                        //         });
                        //     });
                        // });
                    }
                });
            }).catch((err) => {
                console.log(err);
                bot.sendMessage(-529666290, `Error one line 837 fix yo shit man`);
            });
        }
    }

    res.status(200).end();
});

// Start express on the defined port
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));



// function createTable(name) {
//     db.run(`CREATE TABLE IF NOT EXISTS ${name}(id INTEGER PRIMARY KEY AUTOINCREMENT,date TEXT, pos_id INTEGER, pair TEXT, size REAL, price REAL, side TEXT, type TEXT)`);
//     db.close();
//     console.log('created table');
// }

function insertTarget(date, pos_id, order_id, pair, size, price, side, type, stage) {
    db.run(`INSERT INTO targets(date, pos_id, order_id, pair, size, price, side, type, stage) VALUES("${date}", ${pos_id}, ${order_id}, "${pair}", ${size}, ${price}, "${side}", "${type}", ${stage})`);
    console.log('Inserted New Target');
}