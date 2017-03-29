import test from 'ava';
import config from './_config';

import MessengerBot from '../lib';

test.beforeEach((t) => {
  t.context.bot = new MessengerBot({
    credentials: config.messengerCredentials(),
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
