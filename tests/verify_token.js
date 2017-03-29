import test from 'ava';
import Botmaster from 'botmaster';
import request from 'request-promise';
import config from './_config';

import MessengerBot from '../lib';

test.beforeEach((t) => {
  return new Promise((resolve) => {
    t.context.botmaster = new Botmaster();
    const bot = new MessengerBot({
      credentials: config.messengerCredentials(),
      webhookEndpoint: 'webhook',
    });
    t.context.botmaster.addBot(bot);
    t.context.requestOptions = {
      method: 'GET',
      uri: 'http://localhost:3000/messenger/webhook',
      json: true,
    };
    t.context.botmaster.on('listening', resolve);
  });
});

test.afterEach((t) => {
  return new Promise((resolve) => {
    t.context.botmaster.server.close(resolve);
  });
});

test('GET on /webhook should throw error when trying to verify wrong token', async (t) => {
  t.plan(1);

  t.context.requestOptions.qs = {
    'hub.verify_token': 'wrong token',
  };

  try {
    await request(t.context.requestOptions);
  } catch (err) {
    t.is(err.message, '401 - "Error, wrong validation token"',
      'Error message different from what was expected');
  }
});

test('GET on /webhook should work with correct verify token', async (t) => {
  t.plan(1);

  t.context.requestOptions.qs = {
    'hub.verify_token': config.messengerCredentials().verifyToken,
    'hub.challenge': 1100012,
  };

  const body = await request(t.context.requestOptions);
  t.is(body, 1100012, 'hub.challenge is not correct');
});
