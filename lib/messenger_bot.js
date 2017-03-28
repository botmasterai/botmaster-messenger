'use strict';

const express = require('express');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const request = require('request-promise');
const merge = require('lodash').merge;
const cloneDeep = require('lodash').cloneDeep;
const BaseBot = require('botmaster').BaseBot;
const debug = require('debug')('botmaster:messenger');

const apiVersion = '2.7';
const baseURL = `https://graph.facebook.com/v${apiVersion}/me`;
const baseMessageURL = `${baseURL}/messages`;
const baseThreadSettingsURL = `${baseURL}/thread_settings`;

class MessengerBot extends BaseBot {

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
        res.send(req.query['hub.challenge']);
        debug(`token verified with: ${req.query['hub.verify_token']}`);
      } else {
        res.send('Error, wrong validation token');
      }
    });

    this.app.post('*', (req, res) => {
      const entries = req.body.entry;
      this.__emitUpdatesFromEntries(entries);
      res.sendStatus(200);
    });
  }

/*
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

  __sendMessage(message) {
    // TODO add request splitting when text is over 640 characters long.
    // log warning too... or not.
    const options = {
      uri: baseMessageURL,
      qs: { access_token: this.credentials.pageToken },
      method: 'POST',
      json: message,
    };

    return request(options)

    .then((body) => {
      if (body.error) {
        throw new Error(JSON.stringify(body.error));
      }
      return body;
    });
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
      this.id = update.recipient.id;
    }
  }

  __threadSettingsRequest(method, bodyOrQS, cb) {
    const buildOptionsObject = (method, bodyOrQS) => {
      let qs = { access_token: this.credentials.pageToken };
      const options = {
        method,
        uri: baseThreadSettingsURL,
        resolveWithFullResponse: true,
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

    const options = buildOptionsObject(method, bodyOrQS);

    return request(options)

    .then((response) => {
      const resolveWith = method === 'DELETE' ? response.statusCode : response.body;
      if (cb) {
        return cb(resolveWith);
      }

      return resolveWith;
    });
  }

  _setAccountLinkingURL(accountLinkingURL, cb) {
    const requestBody = {
      setting_type: 'account_linking',
      account_linking_url: accountLinkingURL,
    };

    return this.__threadSettingsRequest('POST', requestBody, cb);
  }

  _removeAccountLinkingURL(cb) {
    const requestBody = {
      setting_type: 'account_linking',
    };

    return this.__threadSettingsRequest('DELETE', requestBody, cb);
  }

  _addWhitelistedDomains(domainNameLists, cb) {
    const requestBody = {
      setting_type: 'domain_whitelisting',
      domain_action_type: 'add',
      whitelisted_domains: domainNameLists,
    };

    return this.__threadSettingsRequest('POST', requestBody, cb);
  }

  _getWhitelistedDomains(cb) {
    const requestQS = {
      fields: 'account_linking_url',
    };

    return this.__threadSettingsRequest('GET', requestQS, cb);
  }

  _removeWhitelistedDomains(domainNameLists, cb) {
    const requestBody = {
      setting_type: 'domain_whitelisting',
      domain_action_type: 'remove',
      whitelisted_domains: domainNameLists,
    };

    return this.__threadSettingsRequest('POST', requestBody, cb);
  }

  _setGetStartedButton(getStartedButtonPayload, cb) {
    const requestBody = {
      setting_type: 'call_to_actions',
      thread_state: 'new_thread',
      call_to_actions: [{
        payload: getStartedButtonPayload,
      }],
    };

    return this.__threadSettingsRequest('POST', requestBody, cb);
  }

  _removeGetStartedButton(cb) {
    const requestBody = {
      setting_type: 'call_to_actions',
      thread_state: 'new_thread',
    };

    return this.__threadSettingsRequest('DELETE', requestBody, cb);
  }

  getUserInfo(userId) {
    const options = {
      method: 'GET',
      uri: `${baseURL}/${userId}`,
      qs: { access_token: this.credentials.pageToken },
      json: true,
    };

    return request(options)

    .then((body) => {
      if (body.error) {
        throw new Error(JSON.stringify(body.error));
      }
      return body;
    });
  }

}

module.exports = MessengerBot;
