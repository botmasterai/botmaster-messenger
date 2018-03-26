'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const request = require('request-promise');
const merge = require('lodash').merge;
const cloneDeep = require('lodash').cloneDeep;
const BaseBot = require('botmaster').BaseBot;
const debug = require('debug')('botmaster:messenger');

const apiVersion = '2.10';
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
    this.requiredCredentials = ['verifyToken', 'fbAppSecret'];
    this.optionalCredentials = ['pages', 'pageToken'];

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
    // this is now optional for backwards compatibility. But should be defined
    this.id = settings.id;

    this.__applySettings(settings);
    this.__checkOptionalCredentials(settings);
    this.__createMountPoints();
  }

  __checkOptionalCredentials(settings) {
    if ((settings.credentials.pages && settings.credentials.pageToken) ||
        (!settings.credentials.pages && !settings.credentials.pageToken)) {
      throw new Error(`bots of type '${this.type} must be defined with exactly one of pages or pageToken`);
    }

    if (settings.credentials.pages) {
      for (const pageId of Object.keys(settings.credentials.pages)) {
        if (!settings.credentials.pages[pageId].pageToken) {
          throw new Error(`All pages are expected wto have a pageToken. Page: '${pageId} is missing it'`);
        }
      }
    }
  }

  /**
   * @ignore
   * sets up the app. that will be mounted onto a botmaster object
   * Note how neither of the declared routes uses webhookEndpoint.
   * This is because I can now count on botmaster to make sure that requests
   * meant to go to this bot are indeed routed to this bot. Otherwise,
   * I can also use the full path: i.e. `${this.type}/${this.webhookEndpoint}`.
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
        update.raw = entry;
        this.__emitUpdate(update);
      }
    }
  }

  // doesn't actually do anything in messenger bot
  __formatOutgoingMessage(outgoingMessage) {
    return Promise.resolve(outgoingMessage);
  }

  __sendMessage(message) {
    let pageToken;
    if (this.credentials.pages) {
      if (!message.sender || !message.sender.id) {
        throw new Error('When using multi-page messenger bots, sendMessage needs to be used with sender.id in message object');
      }
      pageToken = this.credentials.pages[message.sender.id].pageToken;
    } else {
      pageToken = this.credentials.pageToken;
    }
    const options = {
      uri: baseMessageURL,
      qs: { access_token: pageToken },
      method: 'POST',
      json: message,
    };

    return request(options);
    // errors are thrown successfully and not returned in body
  }

  __createStandardBodyResponseComponents(sentOutgoingMessage, sentRawMessage, raw) {
    return Promise.resolve(raw);
  }

  _messengerProfileRequest(method, bodyOrQS, resolveWithFullResponse, pageId) {
    let pageToken;
    if (this.credentials.pages) {
      if (!pageId) {
        throw new Error(`can't perform the requested messengerProfileRequest: ${
          bodyOrQS
        } without a pageId option as you are using botmaster-messenger with multiple pages`);
      }
      pageToken = this.credentials.pages[pageId].pageToken;
    } else {
      pageToken = this.credentials.pageToken;
    }
    const buildOptionsObject = () => {
      let qs = { access_token: pageToken };
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
   *
   * @param {string} [pageId] specify the page you want to set the get started button
   * for. This iw valid only if you are using botmaster-messenger with multiple pages
   */
  _setGetStartedButton(getStartedButtonPayload, resolveWithFullResponse, pageId) {
    const requestBody = {
      get_started: {
        payload: getStartedButtonPayload,
      },
    };

    return this._messengerProfileRequest('POST', requestBody, resolveWithFullResponse, pageId);
  }

  /**
   * gets get started button payload from your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/get-started-button
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   *
   * @param {string} [pageId] specify the page you want to set the get started button
   * for. This iw valid only if you are using botmaster-messenger with multiple pages
   */
  _getGetStartedButton(resolveWithFullResponse, pageId) {
    const requestQS = {
      fields: 'get_started',
    };

    return this._messengerProfileRequest('GET',
      requestQS, resolveWithFullResponse, pageId);
  }

  /**
   * removes get started button from your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/get-started-button
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   *
   * @param {string} [pageId] specify the page you want to set the get started button
   * for. This iw valid only if you are using botmaster-messenger with multiple pages
   */
  _removeGetStartedButton(resolveWithFullResponse, pageId) {
    const requestBody = {
      fields: ['get_started'],
    };

    return this._messengerProfileRequest(
      'DELETE', requestBody, resolveWithFullResponse, pageId);
  }

  /**
   * Adds account Linking to your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/persistent-menu
   *
   * @param {string} persistentMenu persistent menu to use for your messenger
   * bot
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   *
   * @param {string} [pageId] specify the page you want to set the get started button
   * for. This iw valid only if you are using botmaster-messenger with multiple pages
   */
  _setPersistentMenu(persistentMenu, resolveWithFullResponse, pageId) {
    const requestBody = {
      persistent_menu: persistentMenu,
    };

    return this._messengerProfileRequest('POST',
      requestBody, resolveWithFullResponse, pageId);
  }

  /**
   * get persistent menu from your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/persistent-menu
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   *
   * @param {string} [pageId] specify the page you want to set the get started button
   * for. This iw valid only if you are using botmaster-messenger with multiple pages
   */
  _getPersistentMenu(resolveWithFullResponse, pageId) {
    const requestQS = {
      fields: 'persistent_menu',
    };

    return this._messengerProfileRequest('GET',
      requestQS, resolveWithFullResponse, pageId);
  }

  /**
   * removes persistent menu from your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/persistent-menu
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   *
   * @param {string} [pageId] specify the page you want to set the get started button
   * for. This iw valid only if you are using botmaster-messenger with multiple pages
   */
  _removePersistentMenu(resolveWithFullResponse, pageId) {
    const requestBody = {
      fields: ['persistent_menu'],
    };

    return this._messengerProfileRequest('DELETE',
      requestBody, resolveWithFullResponse, pageId);
  }

  /**
   * Adds greeting text to your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/greeting-text
   *
   * @param {string} greetingObject greeting objects. Can be localized.
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   *
   * @param {string} [pageId] specify the page you want to set the get started button
   * for. This iw valid only if you are using botmaster-messenger with multiple pages
   */
  _setGreetingText(greetingObject, resolveWithFullResponse, pageId) {
    const requestBody = {
      greeting: greetingObject,
    };

    return this._messengerProfileRequest('POST',
      requestBody, resolveWithFullResponse, pageId);
  }

  /**
   * get greeting text from your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/greeting-text
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   *
   * @param {string} [pageId] specify the page you want to set the get started button
   * for. This iw valid only if you are using botmaster-messenger with multiple pages
   */
  _getGreetingText(resolveWithFullResponse, pageId) {
    const requestQS = {
      fields: 'greeting',
    };

    return this._messengerProfileRequest('GET',
      requestQS, resolveWithFullResponse, pageId);
  }

  /**
   * removes greeting text from bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/greeting-text
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   *
   * @param {string} [pageId] specify the page you want to set the get started button
   * for. This iw valid only if you are using botmaster-messenger with multiple pages
   */
  _removeGreetingText(resolveWithFullResponse, pageId) {
    const requestBody = {
      fields: ['greeting'],
    };

    return this._messengerProfileRequest('DELETE',
      requestBody, resolveWithFullResponse, pageId);
  }


  /**
   * Adds white listed domains to your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/domain-whitelisting
   *
   * @param {string} domainNameLists List of domains to whitelist.
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   *
   * @param {string} [pageId] specify the page you want to set the get started button
   * for. This iw valid only if you are using botmaster-messenger with multiple pages
   */
  _setWhitelistedDomains(domainNameLists, resolveWithFullResponse, pageId) {
    const requestBody = {
      whitelisted_domains: domainNameLists,
    };

    return this._messengerProfileRequest('POST',
      requestBody, resolveWithFullResponse, pageId);
  }

  /**
   * get whitelisted domains from your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/greeting-text
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   *
   * @param {string} [pageId] specify the page you want to set the get started button
   * for. This iw valid only if you are using botmaster-messenger with multiple pages
   */
  _getWhitelistedDomains(resolveWithFullResponse, pageId) {
    const requestQS = {
      fields: 'whitelisted_domains',
    };

    return this._messengerProfileRequest('GET', requestQS, resolveWithFullResponse, pageId);
  }

  /**
   * removes whitelisted domains from bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/greeting-text
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   *
   * @param {string} [pageId] specify the page you want to set the get started button
   * for. This iw valid only if you are using botmaster-messenger with multiple pages
   */
  _removeWhitelistedDomains(domainNameLists, resolveWithFullResponse, pageId) {
    const requestBody = {
      fields: ['whitelisted_domains'],
    };

    return this._messengerProfileRequest('DELETE',
      requestBody, resolveWithFullResponse, pageId);
  }

  /**
   * Adds account Linking url to your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/account-linking-url
   *
   * @param {string} accountLinkingURL Authentication callback URL.
   * Must use https protocol.
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   *
   * @param {string} [pageId] specify the page you want to set the get started button
   * for. This iw valid only if you are using botmaster-messenger with multiple pages
   */
  _setAccountLinkingUrl(accountLinkingURL, resolveWithFullResponse, pageId) {
    const requestBody = {
      account_linking_url: accountLinkingURL,
    };

    return this._messengerProfileRequest('POST',
      requestBody, resolveWithFullResponse, pageId);
  }

  /**
   * get account linking url from your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/account-linking-url
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   *
   * @param {string} [pageId] specify the page you want to set the get started button
   * for. This iw valid only if you are using botmaster-messenger with multiple pages
   */
  _getAccountLinkingUrl(resolveWithFullResponse, pageId) {
    const requestQS = {
      fields: 'account_linking_url',
    };

    return this._messengerProfileRequest('GET',
      requestQS, resolveWithFullResponse, pageId);
  }

  /**
   * removes account Linking to your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/account-linking-url
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   */
  _removeAccountLinkingUrl(resolveWithFullResponse, pageId) {
    const requestBody = {
      fields: ['account_linking_url'],
    };

    return this._messengerProfileRequest('DELETE',
      requestBody, resolveWithFullResponse, pageId);
  }

  // TODO add payment settings support once it is in GA

  // /**
  //  * Sets the payment settings for your bot. Read more here:
  //  * https://developers.facebook.com/docs/messenger-platform/messenger-profile/payment-settings
  //  *
  //  * @param {string} paymentSettings
  //  * @param {boolean} [resolveWithFullResponse] specify wether request should
  //  * resolve with full response or not. By default, this is false
  //  *
  //  * @param {string} [pageId] specify the page you want to set the get started button
  //  * for. This iw valid only if you are using botmaster-messenger with multiple pages
  //  */
  // _setPaymentSettings(paymentSettings, resolveWithFullResponse, pageId) {
  //   const requestBody = {
  //     payment_settings: paymentSettings,
  //   };

  //   return this._messengerProfileRequest('POST',
  //     requestBody, resolveWithFullResponse, pageId);
  // }

  // /**
  //  * get payment settings from your bot. Read more here:
  //  * https://developers.facebook.com/docs/messenger-platform/messenger-profile/payment-settings
  //  *
  //  * @param {boolean} [resolveWithFullResponse] specify wether request should
  //  * resolve with full response or not. By default, this is false
  //  *
  //  * @param {string} [pageId] specify the page you want to set the get started button
  //  * for. This iw valid only if you are using botmaster-messenger with multiple pages
  //  */
  // getPaymentSettings(resolveWithFullResponse, pageId) {
  //   const requestQS = {
  //     fields: 'payment_settings',
  //   };

  //   return this._messengerProfileRequest('GET',
  //     requestQS, resolveWithFullResponse, pageId);
  // }

  // /**
  //  * removes payment settings to your bot. Read more here:
  //  * https://developers.facebook.com/docs/messenger-platform/messenger-profile/payment-settings
  //  *
  //  * @param {boolean} [resolveWithFullResponse] specify wether request should
  //  * resolve with full response or not. By default, this is false
  //  *
  //  * @param {string} [pageId] specify the page you want to set the get started button
  //  * for. This iw valid only if you are using botmaster-messenger with multiple pages
  //  */
  // _removePaymentSettings(resolveWithFullResponse, pageId) {
  //   const requestBody = {
  //     fields: ['payment_settings'],
  //   };

  //   return this._messengerProfileRequest('DELETE',
  //     requestBody, resolveWithFullResponse, pageId);
  // }

  /**
   * Adds target audience url to your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/target-audience
   *
   * @param {string} targetAudience
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   *
   * @param {string} [pageId] specify the page you want to set the get started button
   * for. This iw valid only if you are using botmaster-messenger with multiple pages
   */
  _setTargetAudience(targetAudience, resolveWithFullResponse, pageId) {
    const requestBody = {
      target_audience: targetAudience,
    };

    return this._messengerProfileRequest('POST',
      requestBody, resolveWithFullResponse, pageId);
  }

  /**
   * get target audience url from your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/target-audience
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   *
   * @param {string} [pageId] specify the page you want to set the get started button
   * for. This iw valid only if you are using botmaster-messenger with multiple pages
   */
  _getTargetAudience(resolveWithFullResponse, pageId) {
    const requestQS = {
      fields: 'target_audience',
    };

    return this._messengerProfileRequest('GET',
      requestQS, resolveWithFullResponse, pageId);
  }

  /**
   * removes target audience to your bot. Read more here:
   * https://developers.facebook.com/docs/messenger-platform/messenger-profile/target-audience
   *
   * @param {boolean} [resolveWithFullResponse] specify wether request should
   * resolve with full response or not. By default, this is false
   *
   * @param {string} [pageId] specify the page you want to set the get started button
   * for. This iw valid only if you are using botmaster-messenger with multiple pages
   */
  _removeTargetAudience(resolveWithFullResponse, pageId) {
    const requestBody = {
      fields: ['target_audience'],
    };

    return this._messengerProfileRequest('DELETE',
      requestBody, resolveWithFullResponse, pageId);
  }
  /**
   * @ignore
   * see botmaster's BaseBot #getUserInfo
   *
   * @param {string} userId id of the user whose information is requested
   */
  __getUserInfo(userId) {
    if (this.credentials.pages) {
      throw new Error('can\'t use getUserInfo when using botmaster-messenger with multiple pages. use _getUserInfoFromPage instead');
    }
    const options = {
      method: 'GET',
      uri: `${baseURL}/${userId}`,
      qs: { access_token: this.credentials.pageToken },
      json: true,
    };

    return request(options);
  }

  /**
   * get the info for a certain user from a certain page
   *
   * @param {string} userId id of the user whose information is requested
   * @param {string} pageId specify the page you want to get the user info from.
   * Different pages may have different rights.
   */
  _getUserInfoFromPage(userId, pageId) {
    if (this.credentials.pageToken) {
      throw new Error('can\'t use _getUserInfoFromPage when using botmaster-messenger with a single page. use __getUserInfo instead');
    } else if (!pageId) {
      throw new Error('_getUserInfoFromPage must be used with a pageId param');
    }
    const options = {
      method: 'GET',
      uri: `${baseURL}/${userId}`,
      qs: { access_token: this.credentials.pages[pageId].pageToken },
      json: true,
    };

    return request(options);
  }

}

module.exports = MessengerBot;
