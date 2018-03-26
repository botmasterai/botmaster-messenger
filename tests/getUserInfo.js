import test from 'ava';
import config from './_config';

import MessengerBot from '../lib';

test.beforeEach((t) => {
  t.context.bot = new MessengerBot({
    credentials: config.messengerCredentials(),
    webhookEndpoint: 'webhook',
  });
  t.context.multiPageBot = new MessengerBot({
    id: 'multi_page_bot_id',
    credentials: config.messengerMultiPageCredentials(),
    webhookEndpoint: 'webhook',
  });
});

test('#getUserInfo', async (t) => {
  t.plan(2);

  const userId = config.messengerUserId();
  const bot = t.context.bot;

  const userInfo = await bot.getUserInfo(userId);
  t.is(userInfo.first_name, 'John-David', 'First name is incorrect');
  t.is(userInfo.gender, 'male', 'Gender is incorrect');
});

test('#getUserInfo fails for multi-page bot', async (t) => {
  t.plan(1);

  const userId = config.messengerUserId();
  const bot = t.context.multiPageBot;

  try {
    await bot.getUserInfo(userId);
  } catch (err) {
    t.snapshot(err);
  }
});

test('#_getUserInfoFromPage fails for multi-page without pageId outside of middleware', async (t) => {
  t.plan(1);

  const userId = config.messengerUserId();
  const bot = t.context.multiPageBot;

  try {
    await bot._getUserInfoFromPage(userId);
  } catch (err) {
    t.snapshot(err);
  }
});

test('#getUserInfo works for multi-page with pageId', async (t) => {
  t.plan(1);

  const userId = config.messengerUserId();
  const bot = t.context.multiPageBot;
  const pageId = Object.keys(config.messengerMultiPageCredentials().pages)[1];

  const userInfo = await bot._getUserInfoFromPage(userId, pageId);
  delete userInfo.profile_pic;
  t.snapshot(userInfo);
});
