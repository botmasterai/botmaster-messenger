'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const request = require('request-promise');
const merge = require('lodash').merge;
const cloneDeep = require('lodash').cloneDeep;
const BaseBot = require('botmaster').BaseBot;
const debug = require('debug')('botmaster:messenger');

const apiVersion = '2.8';
const baseURL = `https://graph.facebook.com/v${apiVersion}`;
const baseMessageURL = `${baseURL}/me/messages`;
const baseMessengerProfileURL = `${baseURL}/me/messenger_profile`;

/**
 * The class to use if you want to add support for FB Messenger in your
 * Botmaster project.
 */

class MessengerBot extends BaseBot {

  /**
   * Constructor to the MessengerBot class
   *
   * @param {object} settings - MessengerBot take a settings
   * object as first param.
   * @example
   * const messengerBot = new MessengerBot({ // e.g. MessengerBot
   *   credentials:   credentials: {
   *     verifyToken: 'YOUR verifyToken',
   *     pageToken: 'YOUR pageToken',
   *     fbAppSecret: 'YOUR fbAppSecret',
   *   },
   *   webhookEnpoint: 'someEndpoint'
   * })
   */
  constructor(settings) {
    super(settings);
    this.type = 'messenger';
    this.requiresWebhook = true;
    this.requiredCredentials = ['verifyToken', 'pageToken', 'fbAppSecret'];

    this.receives = {
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
    };

    this.sends = {
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
    };

    this.retrievesUserInfo = true;
    // this is the id that will be set after the first message is sent to
    // this bot.
    this.id;

    this.__applySettings(settings);
    this.__createMountPoints();
  }

  /**
   * @ignore
   * sets up the app. that will be mounetd onto a botmaster object
   * Note how neither of the declared routes uses webhookEndpoint.
   * This is because I can now count on botmaster to make sure that requests
   * meant to go to this bot are indeed routed to this bot. Otherwise,
   * I can also use the full path: i.e. `${this.type}/${this.webhookEndpoing}`.
   */
  __createMountPoints() {
    this.app = express();
    // so that botmaster can mount this bot object onto its server
    this.requestListener = this.app;

    this.app.use(bodyParser.json({
      verify: this.__verifyRequestSignature.bind(this),
    }));
    this.app.use(bodyParser.urlencoded({ extended: true }));

    this.app.get('*', (req, res) => {
      if (req.query['hub.verify_token'] === this.credentials.verifyToken) {
        debug(`token verified with: ${req.query['hub.verify_token']}`);
        res.send(req.query['hub.challenge']);
      } else {
        res.status(401).send('Error, wrong validation token');
      }
    });

    this.app.post('*', (req, res) => {
      const entries = req.body.entry;
      this.__emitUpdatesFromEntries(entries);
      res.sendStatus(200);
    });
  }

/**
 * @ignore
 * Verify that the callback came from Facebook. Using the App Secret from
 * the App Dashboard, we can verify the signature that is sent with each
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
  __verifyRequestSignature(req, res, buf) {
    const signature = req.headers['x-hub-signature'];
    const signatureHash = signature ? signature.split('=')[1] : undefined;
    const expectedHash = crypto.createHmac('sha1', this.credentials.fbAppSecret)
                        .update(buf)
                        .digest('hex');
    if (signatureHash !== expectedHash) {
      throw new Error('wrong signature');
    }
  }

  __emitUpdatesFromEntries(entries) {
    for (const entry of entries) {
      const updates = cloneDeep(entry.messaging);

      for (const update of updates) {
        this.__setBotIdIfNotSet(update);
        update.raw = entry;
        this.__emitUpdate(update);
      }
    }
  }

  __setBotIdIfNotSet(update) {
    if (!this.id) {
      debug(`setting id: ${update.recipient.id} to ${this.type} bot`);
      this.id = update.recipient.id;
    }
  }

  // doesn't actually do anything in messenger bot
  __formatOutgoingMessage(outgoingMessage) {
    return Promise.resolve(outgoingMessage);
  }

  __sendMessage(message) {
    const options = {
      uri: baseMessageURL,
      qs: { access_token: this.credentials.pageToken },
      method: 'POST',
      json: message,
    };

    return request(options);
    // errors are thrown successfully and not returned in body
  }

  __createStandardBodyResponseComponents(sentOutgoingMessage, sentRawMessage, raw) {
    return Promise.resolve(raw);
  }

  _messengerProfileRequest(method, bodyOrQS, resolveWithFullResponse) {
    const buildOptionsObject = () => {
      let qs = { access_token: this.credentials.pageToken };
      const options = {
        method,
        uri: baseMessengerProfileURL,
        resolveWithFullResponse,
      };
      if (method === 'GET') {
        qs = merge(qs, bodyOrQS);
        options.json = true;
      } else {
        options.json = bodyOrQS;
      }

      options.qs = qs;

      return options;
    };

    const options = buildOptionsObject();

    return request(options);
  }

  /**
   * Adds get start button to your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/get-started-button
   *
   * @param {string} getStartedButtonPayload The payload of the postback
   * you will get when a user clicks on the get started button.
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   */
  _setGetStartedButton(getStartedButtonPayload, resolveWithFullResponse) {
    const requestBody = {
      get_started: {
        payload: getStartedButtonPayload,
      },
    };

    return this._messengerProfileRequest('POST', requestBody, resolveWithFullResponse);
  }

  /**
   * gets get started button payload from your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/get-started-button
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   */
  _getGetStartedButton(resolveWithFullResponse) {
    const requestQS = {
      fields: 'get_started',
    };

    return this._messengerProfileRequest('GET',
      requestQS, resolveWithFullResponse);
  }

  /**
   * removes get started button from your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/get-started-button
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   */
  _removeGetStartedButton(resolveWithFullResponse) {
    const requestBody = {
      fields: ['get_started'],
    };

    return this._messengerProfileRequest('DELETE', requestBody, resolveWithFullResponse);
  }

  /**
   * Adds account Linking to your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/persistent-menu
   *
   * @param {string} persistentMenu persistent menu to use for your messenger
   * bot
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   */
  _setPersistentMenu(persistentMenu, resolveWithFullResponse) {
    const requestBody = {
      persistent_menu: persistentMenu,
    };

    return this._messengerProfileRequest('POST',
      requestBody, resolveWithFullResponse);
  }

  /**
   * get persistent menu from your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/persistent-menu
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   */
  _getPersistentMenu(resolveWithFullResponse) {
    const requestQS = {
      fields: 'persistent_menu',
    };

    return this._messengerProfileRequest('GET',
      requestQS, resolveWithFullResponse);
  }

  /**
   * removes persistent menu from your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/persistent-menu
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   */
  _removePersistentMenu(resolveWithFullResponse) {
    const requestBody = {
      fields: ['persistent_menu'],
    };

    return this._messengerProfileRequest('DELETE',
      requestBody, resolveWithFullResponse);
  }

  /**
   * Adds greeting text to your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/greeting-text
   *
   * @param {string} greetingObject greeting objects. Can be localized.
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   */
  _setGreetingText(greetingObject, resolveWithFullResponse) {
    const requestBody = {
      greeting: greetingObject,
    };

    return this._messengerProfileRequest('POST',
      requestBody, resolveWithFullResponse);
  }

  /**
   * get greeting text from your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/greeting-text
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   */
  _getGreetingText(resolveWithFullResponse) {
    const requestQS = {
      fields: 'greeting',
    };

    return this._messengerProfileRequest('GET',
      requestQS, resolveWithFullResponse);
  }

  /**
   * removes greeting text from bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/greeting-text
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   */
  _removeGreetingText(resolveWithFullResponse) {
    const requestBody = {
      fields: ['greeting'],
    };

    return this._messengerProfileRequest('DELETE',
      requestBody, resolveWithFullResponse);
  }


  /**
   * Adds white listed domains to your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/domain-whitelisting
   *
   * @param {string} domainNameLists List of domains to whitelist.
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   */
  _setWhitelistedDomains(domainNameLists, resolveWithFullResponse) {
    const requestBody = {
      whitelisted_domains: domainNameLists,
    };

    return this._messengerProfileRequest('POST',
      requestBody, resolveWithFullResponse);
  }

  /**
   * get whitelisted domains from your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/greeting-text
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   */
  _getWhitelistedDomains(resolveWithFullResponse) {
    const requestQS = {
      fields: 'whitelisted_domains',
    };

    return this._messengerProfileRequest('GET', requestQS, resolveWithFullResponse);
  }

  /**
   * removes whitelisted domains from bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/greeting-text
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   */
  _removeWhitelistedDomains(domainNameLists, resolveWithFullResponse) {
    const requestBody = {
      fields: ['whitelisted_domains'],
    };

    return this._messengerProfileRequest('DELETE',
      requestBody, resolveWithFullResponse);
  }

  /**
   * Adds account Linking url to your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/account-linking-url
   *
   * @param {string} accountLinkingURL Authentication callback URL.
   * Must use https protocol.
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   */
  _setAccountLinkingUrl(accountLinkingURL, resolveWithFullResponse) {
    const requestBody = {
      account_linking_url: accountLinkingURL,
    };

    return this._messengerProfileRequest('POST',
      requestBody, resolveWithFullResponse);
  }

  /**
   * get account linking url from your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/account-linking-url
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   */
  _getAccountLinkingUrl(resolveWithFullResponse) {
    const requestQS = {
      fields: 'account_linking_url',
    };

    return this._messengerProfileRequest('GET',
      requestQS, resolveWithFullResponse);
  }

  /**
   * removes account Linking to your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/account-linking-url
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   */
  _removeAccountLinkingUrl(resolveWithFullResponse) {
    const requestBody = {
      fields: ['account_linking_url'],
    };

    return this._messengerProfileRequest('DELETE',
      requestBody, resolveWithFullResponse);
  }

  // TODO add payment settings support once it is in GA

  // /**
  //  * Sets the payment settings for your bot. Read more here:
  //  * https://developers.facebook.com/docs/messenger-platform/messenger-profile/payment-settings
  //  *
  //  * @param {string} paymentSettings
  //  * @param {boolean} [resolveWithFullResponse] specify wether request should
  //  * resolve with full response or not. By default, this is false
  //  */
  // _setPaymentSettings(paymentSettings, resolveWithFullResponse) {
  //   const requestBody = {
  //     payment_settings: paymentSettings,
  //   };

  //   return this._messengerProfileRequest('POST',
  //     requestBody, resolveWithFullResponse);
  // }

  // /**
  //  * get payment settings from your bot. Read more here:
  //  * https://developers.facebook.com/docs/messenger-platform/messenger-profile/payment-settings
  //  *
  //  * @param {boolean} [resolveWithFullResponse] specify wether request should
  //  * resolve with full response or not. By default, this is false
  //  */
  // getPaymentSettings(resolveWithFullResponse) {
  //   const requestQS = {
  //     fields: 'payment_settings',
  //   };

  //   return this._messengerProfileRequest('GET',
  //     requestQS, resolveWithFullResponse);
  // }

  // /**
  //  * removes payment settings to your bot. Read more here:
  //  * https://developers.facebook.com/docs/messenger-platform/messenger-profile/payment-settings
  //  *
  //  * @param {boolean} [resolveWithFullResponse] specify wether request should
  //  * resolve with full response or not. By default, this is false
  //  */
  // _removePaymentSettings(resolveWithFullResponse) {
  //   const requestBody = {
  //     fields: ['payment_settings'],
  //   };

  //   return this._messengerProfileRequest('DELETE',
  //     requestBody, resolveWithFullResponse);
  // }

  /**
   * Adds target audience url to your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/target-audience
   *
   * @param {string} targetAudience
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   */
  _setTargetAudience(targetAudience, resolveWithFullResponse) {
    const requestBody = {
      target_audience: targetAudience,
    };

    return this._messengerProfileRequest('POST',
      requestBody, resolveWithFullResponse);
  }

  /**
   * get target audience url from your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/target-audience
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   */
  _getTargetAudience(resolveWithFullResponse) {
    const requestQS = {
      fields: 'target_audience',
    };

    return this._messengerProfileRequest('GET',
      requestQS, resolveWithFullResponse);
  }

  /**
   * removes target audience to your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/target-audience
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   */
  _removeTargetAudience(resolveWithFullResponse) {
    const requestBody = {
      fields: ['target_audience'],
    };

    return this._messengerProfileRequest('DELETE',
      requestBody, resolveWithFullResponse);
  }
  /**
   * @ignore
   * see botmaster's BaseBot #getUserInfo
   *
   * @param {string} userId id of the user whose information is requested
   */
  __getUserInfo(userId) {
    const options = {
      method: 'GET',
      uri: `${baseURL}/${userId}`,
      qs: { access_token: this.credentials.pageToken },
      json: true,
    };

    return request(options);
  }

}

module.exports = MessengerBot;
