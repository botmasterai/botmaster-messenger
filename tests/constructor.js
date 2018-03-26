import test from 'ava';

import MessengerBot from '../lib';
import config from './_config';

test('verify that settings are correctly set after default instantiation', (t) => {
  t.plan(8);
  const credentials = config.messengerCredentials();
  const bot = new MessengerBot({
    credentials,
    webhookEndpoint: 'webhook',
  });

  t.is(bot.type, 'messenger');
  t.is(bot.requiresWebhook, true);
  t.is(bot.webhookEndpoint, 'webhook');
  t.deepEqual(bot.requiredCredentials, ['verifyToken', 'fbAppSecret']);
  t.deepEqual(bot.optionalCredentials, ['pages', 'pageToken']);
  t.snapshot(bot.receives);
  t.snapshot(bot.sends);
  t.is(bot.retrievesUserInfo, true);
});
