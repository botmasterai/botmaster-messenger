import test from 'ava';
import config from './_config';

import MessengerBot from '../lib';

test.beforeEach((t) => {
  t.context.bot = new MessengerBot({
    credentials: config.messengerCredentials(),
    webhookEndpoint: 'webhook',
  });
});

test('#sendTextMessage works with correct user id', async (t) => {
  t.plan(2);

  const userId = config.messengerUserId();
  const bot = t.context.bot;

  const body = await bot.sendTextMessageTo('Hello', userId);
  t.is(body.sentOutgoingMessage.message.text, 'Hello');
  t.is(body.recipient_id, userId);
});
