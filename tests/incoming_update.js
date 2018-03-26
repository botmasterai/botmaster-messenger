import test from 'ava';
import { incomingUpdateFixtures } from 'botmaster-test-fixtures';
import Botmaster from 'botmaster';
import request from 'request-promise';
import config from './_config';
import { getMessengerSignatureHeader } from './_tests_utils';

import MessengerBot from '../lib';

test.beforeEach((t) => {
  return new Promise((resolve) => {
    t.context.botmaster = new Botmaster();
    const bot = new MessengerBot({
      id: 'bot_id',
      credentials: config.messengerCredentials(),
      webhookEndpoint: 'webhook',
    });
    t.context.botmaster.addBot(bot);
    t.context.multiPageBotmaster = new Botmaster({ port: 3001 });
    const multiPageBot = new MessengerBot({
      id: 'multi_page_bot_id',
      credentials: config.messengerMultiPageCredentials(),
      webhookEndpoint: 'webhook',
    });
    t.context.multiPageBotmaster.addBot(multiPageBot);
    t.context.requestBody = {
      object: 'page',
      entry: [{
        id: 'PAGE_ID',
        messaging: [],
      }],
    };
    t.context.requestOptions = {
      method: 'POST',
      uri: 'http://localhost:3000/messenger/webhook',
      body: t.context.requestBody,
      json: true,
      resolveWithFullResponse: true,
    };
    t.context.multiPageRequestOptions = {
      method: 'POST',
      uri: 'http://localhost:3001/messenger/webhook',
      body: t.context.requestBody,
      json: true,
      resolveWithFullResponse: true,
    };
    // couldn't be bothered to do a function for that...
    let listeningServers = 0;
    t.context.botmaster.on('listening', () => {
      if (listeningServers === 1) resolve();
      else listeningServers += 1;
    });
    t.context.multiPageBotmaster.on('listening', () => {
      if (listeningServers === 1) resolve();
      else listeningServers += 1;
    });
  });
});

test.afterEach((t) => {
  return new Promise((resolve) => {
    let closedServers = 0;
    // yes, this could be a function called in both cases...
    t.context.botmaster.server.close(() => {
      if (closedServers === 1) resolve();
      else closedServers += 1;
    });
    t.context.multiPageBotmaster.server.close(() => {
      if (closedServers === 1) resolve();
      else closedServers += 1;
    });
  });
});

test('/webhook should respond with an error in the body if signature is absent', (t) => {
  t.plan(1);

  return request(t.context.requestOptions)
  .catch((err) => {
    t.is(err.statusCode, 403);
  });
});

test('/webhook should respond with an error in the body if signature is wrong', (t) => {
  t.plan(1);

  t.context.requestOptions.body.entry[0].messaging.push(
    incomingUpdateFixtures.textUpdate());
  t.context.requestOptions.headers = {
    'x-hub-signature': getMessengerSignatureHeader(
    t.context.requestOptions.body, 'someWrongAppSecret'),
  };

  return request(t.context.requestOptions)
  .catch((err) => {
    t.is(err.statusCode, 403);
  });
});

test('/webhook should call incoming middleware when update is well formatted', (t) => {
  t.plan(3);

  const textUpdate = incomingUpdateFixtures.textUpdate(null);
  // because fixtures set it to undefined if called without params and because
  // raw can't just be added easily as if includes itself really (although)
  // cloneDeep is used in code
  delete textUpdate.raw;

  t.context.requestOptions.body.entry[0].messaging.push(textUpdate);
  t.context.requestOptions.headers = {
    'x-hub-signature': getMessengerSignatureHeader(
    t.context.requestOptions.body, config.messengerCredentials().fbAppSecret),
  };

  return new Promise(async (resolve) => {
    t.context.botmaster.use({
      type: 'incoming',
      controller: async (bot, update) => {
        t.is(bot.id, 'bot_id');
        t.deepEqual(update.raw, t.context.requestOptions.body.entry[0]);
        delete update.raw;
        t.deepEqual(update, textUpdate);
        resolve();
      },
    });
    request(t.context.requestOptions);
  });
});

test('using sendMessage after receiving a message defaults to pageId that received update', (t) => {
  t.plan(4);

  const textUpdate = incomingUpdateFixtures.textUpdate(null);
  textUpdate.recipient.id = Object.keys(
    config.messengerMultiPageCredentials().pages)[1];
  textUpdate.sender.id = config.messengerUserId();
  delete textUpdate.raw;

  t.context.multiPageRequestOptions.body.entry[0].messaging.push(textUpdate);
  t.context.multiPageRequestOptions.headers = {
    'x-hub-signature': getMessengerSignatureHeader(
    t.context.multiPageRequestOptions.body, config.messengerCredentials().fbAppSecret),
  };

  return new Promise(async (resolve) => {
    t.context.multiPageBotmaster.use({
      type: 'incoming',
      controller: async (bot, update) => {
        const body = await bot.reply(update, 'Bye you');
        t.truthy(body.raw);
        delete body.raw;
        t.truthy(body.message_id);
        delete body.message_id;
        t.snapshot(body);
        // Also, using getUserInfo works...
        const userInfo = await bot.getUserInfo(update.sender.id);
        delete userInfo.profile_pic;
        t.snapshot(userInfo);
        resolve();
      },
    });

    request(t.context.multiPageRequestOptions);
  });
});

// TODO Look into returning promise only on send/read/delivered. Would probably
// need to be a middleware solution built on top of botmaster-storage (or something)
