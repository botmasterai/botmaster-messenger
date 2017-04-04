# Botmaster-messenger

[![Build Status](https://travis-ci.org/botmasterai/botmaster-messenger.svg?branch=master)](https://travis-ci.org/botmasterai/botmaster-messenger)
[![Coverage Status](https://coveralls.io/repos/github/botmasterai/botmaster-messenger/badge.svg?branch=master)](https://coveralls.io/github/botmasterai/botmaster-messenger?branch=master)
[![npm-version](https://img.shields.io/npm/v/botmaster-messenger.svg)](https://www.npmjs.com/package/botmaster-messenger)
[![license](https://img.shields.io/github/license/mashape/apistatus.svg?maxAge=2592000)](LICENSE)

This is the FB messenger integration for botmaster. It allows you to use your 
botmaster bot on FB Messenger

Botmaster is a lightweight chatbot framework. Its purpose is to integrate your existing chatbot into a variety of messaging channels - currently Facebook Messenger, Twitter DM and Telegram.

## Documentation

Find the whole documentation for the Botmaster framework on: http://botmasterai.com/documentation/latest

## Installing

```bash
yarn add botmaster-messenger
```

or

```bash
npm install --save botmaster-messenger
```

## Getting your Credentials

If you don't already have these, follow the steps **1-4** on the Facebook Messenger guide:
https://developers.facebook.com/docs/messenger-platform/guides/quick-start

In **step 2**, where you setup your webhook, no need to code anything. Just specify the webhook, enter any secure string you want as a verify token(`verifyToken`) and copy that value in the settings object. Also, click on whichever message [those are "update"s using botmaster semantics] type you want to receive from Messenger (`message_deliveries`, `messages`, `message_postbacks` etc...).

To find your Facebook App Secret (`fbAppSecret`), navigate to your apps dashboard and under `App Secret` click show, enter your password if prompted and then there it is.

## Code

```js
const Botmaster = require('botmaster');
const MessengerBot = require('botmaster-messenger');
const botmaster = new Botmaster();

const messengerSettings = {
  credentials: {
    verifyToken: 'YOUR verifyToken',
    pageToken: 'YOUR pageToken',
    fbAppSecret: 'YOUR fbAppSecret',
  },
  webhookEndpoint: 'webhook1234',
};

const messengerBot = new MessengerBot(messengerSettings);

botmaster.addBot(messengerBot);

botmaster.use({
  type: 'incoming',
  name: 'my-middleware',
  controller: (bot, update) => {
    return bot.reply(update, 'Hello world!');
  }
});
```

## Webhooks

If you are not too sure how webhooks work and/or how to get them to run locally, go to [webhooks](/getting-started/webhooks) to read some more.


## License

This library is licensed under the MIT [license](LICENSE)
