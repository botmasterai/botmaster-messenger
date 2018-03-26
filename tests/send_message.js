import test from 'ava';
import config from './_config';

import MessengerBot from '../lib';

test.beforeEach((t) => {
  t.context.bot = new MessengerBot({
    id: 'bot_id',
    credentials: config.messengerCredentials(),
    webhookEndpoint: 'webhook',
  });
  t.context.multiPageBot = new MessengerBot({
    id: 'multi_page_bot_id',
    credentials: config.messengerMultiPageCredentials(),
    webhookEndpoint: 'webhook',
  });
});

test('#sendTextMessage works with correct user id using single page', async (t) => {
  t.plan(2);

  const userId = config.messengerUserId();
  const bot = t.context.bot;

  const body = await bot.sendTextMessageTo('Hello', userId);
  t.is(body.sentOutgoingMessage.message.text, 'Hello');
  t.is(body.recipient_id, userId);
});

test('#sendTextMessage does not work for multi=page bot missing sender.id outside of middleware', async (t) => {
  t.plan(1);

  const userId = config.messengerUserId();
  const bot = t.context.multiPageBot;

  const messageToSend = bot.createOutgoingMessageFor(userId);
  messageToSend.addText('Hello');
  try {
    await bot.sendMessage(messageToSend);
    t.fail('should have thrown error');
  } catch (err) {
    t.snapshot(err);
  }
});

test('#sendTextMessage works for multi-page bot with sender.id outside of middleware', async (t) => {
  t.plan(1);

  const userId = config.messengerUserId();
  const bot = t.context.multiPageBot;

  const messageToSend = bot.createOutgoingMessageFor(userId);
  messageToSend.addText('Hello');
  messageToSend.sender = {
    id: Object.keys(config.messengerMultiPageCredentials().pages)[1],
  };

  const body = await bot.sendMessage(messageToSend);
  // just deleting unique identifiers so snapshot passes
  delete body.message_id;
  delete body.raw.message_id;

  t.snapshot(body);
});
