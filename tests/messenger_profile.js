import test from 'ava';
import config from './_config';

import MessengerBot from '../lib';

test.beforeEach((t) => {
  t.context.bot = new MessengerBot({
    credentials: config.messengerCredentials(),
    webhookEndpoint: 'webhook',
  });
});

test('get started button', async (t) => {
  t.plan(3);
  const bot = t.context.bot;

  const buttonPayload = 'Click here you ;)';

  const body = await bot._setGetStartedButton(buttonPayload);
  t.is(body.result, 'success', 'could not set the get started button');
  const response = await bot._getGetStartedButton(true);
  t.is(response.body.data[0].get_started.payload, buttonPayload);
  const removeBody = await bot._removeGetStartedButton();
  t.is(removeBody.result, 'success', 'could not remove get started button');
});

test('persistent menu', async (t) => {
  t.plan(3);

  const bot = t.context.bot;

  const persistentMenu = [
    {
      "locale": "default",
      "composer_input_disabled": true,
      "call_to_actions": [
        {
          "title": "My Account",
          "type": "nested",
          "call_to_actions": [
            {
              "title": "Pay Bill",
              "type": "postback",
              "payload": "PAYBILL_PAYLOAD"
            },
            {
              "title": "History",
              "type": "postback",
              "payload": "HISTORY_PAYLOAD"
            },
            {
              "title": "Contact Info",
              "type": "postback",
              "payload": "CONTACT_INFO_PAYLOAD"
            }
          ]
        },
        {
          "type": "web_url",
          "title": "Latest News",
          "url": "http://petershats.parseapp.com/hat-news",
          "webview_height_ratio": "full"
        }
      ]
    }
  ];

  // first need to quickly add a get Started button so this will work.
  const buttonPayload = 'Click here you ;)';
  await bot._setGetStartedButton(buttonPayload);

  const body = await bot._setPersistentMenu(persistentMenu);
  t.is(body.result, 'success', 'could not add persistent menu');
  const response = await bot._getPersistentMenu(true);
  t.deepEqual(response.body.data[0].persistent_menu, persistentMenu);
  const removeBody = await bot._removePersistentMenu();
  t.is(removeBody.result, 'success', 'could not remove persistent menu');

  // remove get started button too
  await bot._removeGetStartedButton();
});

test('greeting text', async (t) => {
  t.plan(3);

  const bot = t.context.bot;

  const greeting = [
    {
      locale: 'default',
      text: 'Hello there!',
    },
  ];

  const body = await bot._setGreetingText(greeting);
  t.is(body.result, 'success');
  const getBody = await bot._getGreetingText();
  t.deepEqual(getBody.data[0].greeting, greeting);
  const removeBody = await bot._removeGreetingText();
  t.is(removeBody.result, 'success');
});

test('domain whitelisting', async (t) => {
  t.plan(3);

  const bot = t.context.bot;

  const domainNameLists = [
    'https://example.com/',
    'https://example2.com/',
    'https://example3.com/',
    'https://example4.com/',
    'https://example5.com/',
    'https://example6.com/',
    'https://example7.com/',
    'https://example8.com/',
    'https://example9.com/',
    'https://example10.com/',
  ];

  const body = await bot._setWhitelistedDomains(domainNameLists);
  t.is(body.result, 'success');
  const getBody = await bot._getWhitelistedDomains();
  t.deepEqual(getBody.data[0].whitelisted_domains, domainNameLists);
  const removeBody = await bot._removeWhitelistedDomains();
  t.is(removeBody.result, 'success');
});

test('account linking', async (t) => {
  t.plan(4);

  const bot = t.context.bot;

  const accountLInkingUrl = 'https://www.examplesad.com/';

  const body = await bot._setAccountLinkingUrl(accountLInkingUrl);
  t.is(body.result, 'success');
  const response = await bot._setAccountLinkingUrl(accountLInkingUrl, true);
  t.is(response.body.result, 'success');
  const getBody = await bot._getAccountLinkingUrl();
  t.is(getBody.data[0].account_linking_url, accountLInkingUrl);
  const removeBody = await bot._removeAccountLinkingUrl();
  t.is(removeBody.result, 'success');
});

// TODO add once payment settings is in GA

// test.only('payment settings', async (t) => {
//   t.plan(4);

//   const bot = t.context.bot;

//   const paymentSettings = {
//     privacy_url: 'www.botmasterai.com',
//     public_key: 'SOME_PUBLIC_KEY',
//     test_users: [
//       12345678,
//     ],
//   };

//   const body = await bot._setPaymentSettings(paymentSettings);
//   t.is(body.result, 'success');
//   const getBody = await bot.getPaymentSettings();
//   console.log(getBody);
//   t.deepEqual(getBody.data[0].payment_settings, paymentSettings);
//   const removeBody = await bot._removePaymentSettings();
//   t.is(removeBody.result, 'success');
// });

test('target audience', async (t) => {
  t.plan(3);

  const bot = t.context.bot;

  const targetAudience = {
    audience_type: 'custom',
    countries: {
      whitelist: ['US', 'GB', 'CH', 'CA'],
    },
  };

  const body = await bot._setTargetAudience(targetAudience);
  t.is(body.result, 'success');
  const getBody = await bot._getTargetAudience();
  t.deepEqual(getBody.data[0].target_audience, targetAudience);
  const removeBody = await bot._removeTargetAudience();
  t.is(removeBody.result, 'success');
});
