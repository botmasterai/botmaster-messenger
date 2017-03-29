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
      credentials: config.messengerCredentials(),
      webhookEndpoint: 'webhook',
    });
    t.context.botmaster.addBot(bot);
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
    t.context.botmaster.on('listening', resolve);
  });
});

test.afterEach((t) => {
  return new Promise((resolve) => {
    t.context.botmaster.server.close(resolve);
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
  t.plan(6);

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

  let pass = 0; // using this just to go through the "else" branch in __setBotIdIfNotSet
  return new Promise(async (resolve) => {
    t.context.botmaster.use({
      type: 'incoming',
      controller: async (bot, update) => {
        t.is(bot.id, 'bot_id');
        t.deepEqual(update.raw, t.context.requestOptions.body.entry[0]);
        delete update.raw;
        t.deepEqual(update, textUpdate);
        pass += 1;
        if (pass === 2) {
          resolve();
        }
      },
    });

    request(t.context.requestOptions);
    request(t.context.requestOptions);
  });
});

// TODO Look into returning promise only on send/read/delivered. Would probably
// need to be a middleware solution built on top of botmaster-storage (or something)



