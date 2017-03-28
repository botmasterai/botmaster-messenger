import test from 'ava';

import MessengerBot from '../lib';
import config from './_config';

test('verify that settings are correctly set after default instantiation', (t) => {
  t.plan(7);
  const credentials = config.messengerCredentials();
  const bot = new MessengerBot({
    credentials,
    webhookEndpoint: 'webhook',
  });

  t.is(bot.type, 'messenger');
  t.is(bot.requiresWebhook, true);
  t.is(bot.webhookEndpoint, 'webhook');
  t.deepEqual(bot.requiredCredentials, ['verifyToken', 'pageToken', 'fbAppSecret']);
  t.deepEqual(bot.receives, {
    text: true,
    attachment: {
      audio: true,
      file: true,
      image: true,
      video: true,
      location: true,
      fallback: true,
    },
    echo: true,
    read: true,
    delivery: true,
    postback: true,
    quickReply: true,
  });
  t.deepEqual(bot.sends, {
    text: true,
    quickReply: true,
    locationQuickReply: true,
    senderAction: {
      typingOn: true,
      typingOff: true,
      markSeen: true,
    },
    attachment: {
      audio: true,
      file: true,
      image: true,
      video: true,
    },
  });
  t.is(bot.retrievesUserInfo, true);
});
