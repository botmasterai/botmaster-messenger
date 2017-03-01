'use strict';

const app = require('express')();
const assert = require('chai').assert;
const expect = require('chai').expect;
const request = require('request-promise');
require('chai').should();
const _ = require('lodash');
const MessengerBot = require('../../lib').botTypes.MessengerBot;
const config = require('../config.js');
const getMessengerSignatureHeader = require('../tests_utils').getMessengerSignatureHeader;

const credentials = config.messengerCredentials;

describe('Messenger Bot tests', function() {
  const settings = {
    credentials,
    webhookEndpoint: '/messenger/webhook'
  };

  const baseIncommingMessage = {
    sender: {
      id: config.messengerUserId
    },
    recipient: {
      id: config.messengerBotId // will typically be the bot's id
    },
    timestamp: 1468325836000,
    message: {
      mid: '1234567890.sadfcersc34c',
      seq: 1,
      text: 'Party & Bullshit'
    }
  };

  const baseIncommingUpdate = {
    entry: [{
      messaging: [baseIncommingMessage]
    }]
  };

  const requestOptions = {
    method: 'POST',
    uri: 'http://localhost:3001/messenger/webhook',
    body: {},
    json: true,
    resolveWithFullResponse: true
  };

  /*
  * Before all tests, create an instance of the bot which is
  * accessible in the following tests.
  * And also set up the mountpoint to make the calls.
  * Also start a server listening on port 3001 locally
  * then close connection
  */
  let bot= null;
  let server = null;

  before(function(done){
    bot = new MessengerBot(settings);
    app.use('/', bot.app);
    server = app.listen(3001, function() { done(); });
  });

  describe('#constructor()', function() {
    it('should throw an error when webhookEndPoint is missing', function(done) {
      const badSettings = _.cloneDeep(settings);
      badSettings.webhookEndpoint = undefined;
      expect(() => new MessengerBot(badSettings)).to.throw(
        'ERROR: bots of type \'messenger\' must be defined with webhookEndpoint in their settings');
      done();
    });

    it('should throw an error when verifyToken credential is missing', function(done) {
      const badSettings = _.cloneDeep(settings);
      badSettings.credentials.verifyToken = undefined;
      expect(() => new MessengerBot(badSettings)).to.throw(
        'ERROR: bots of type \'messenger\' are expected to have \'verifyToken\' credentials');
      done();
    });
  });

  describe('/webhook endpoint works', function() {
    it('should return a 200 statusCode when doing a standard request', function() {
      return request(requestOptions)
      .then(function(res) {
        assert.equal(200, res.statusCode);
      });
    });

    it('should return an error in the response body if signature is absent', function() {
      return request(requestOptions)
      .then(function(res) {
        res.body.error.should.equal('Error, wrong signature');
      });
    });

    it('should return an error in the response body if signature is wrong', function() {
      const options = _.cloneDeep(requestOptions);
      options.body = baseIncommingUpdate;
      options.headers = {
        'x-hub-signature': getMessengerSignatureHeader(
        baseIncommingUpdate, 'someWrongAppSecret')
      };

      return request(options)
      .then(function(res) {
        res.body.error.should.equal('Error, wrong signature');
      });
    });

    it('should emit an update event to the bot object when ' +
       'update is well formatted. Also, bot.id should be set', function(done) {

      expect(bot.id).to.equal(undefined); // before the first request is done

      bot.once('update', function() {
        expect(bot.id).to.not.equal(undefined); // after the first request is done
        done();
      });

      const options = _.cloneDeep(requestOptions);
      options.body = baseIncommingUpdate;
      options.headers = {
        'x-hub-signature': getMessengerSignatureHeader(
        baseIncommingUpdate, credentials.fbAppSecret)
      };

      return request(options)
      .then(function(res) {
        assert.equal(undefined, res.body.error); // no error returned
      });
    });

    // TODO. Do messenger specific event for sent/read/echo/postbacks
    // Look into returning promise only on send/read like botpress

    it('should emit a standard error event to the bot object when ' +
       'developer codes error in .on("update") block', function(done) {

      bot.once('update', function() {
        bot.blob(); // this is not an actual funcion => error expected
      });

      bot.once('error', function(err) {
        err.message.should.equal(`"bot.blob is not a function". This is most probably on your end.`);
        done();
      });

      const options = _.cloneDeep(requestOptions);
      options.body = baseIncommingUpdate;
      options.headers = {
        'x-hub-signature': getMessengerSignatureHeader(
        baseIncommingUpdate, credentials.fbAppSecret)
      };

      request(options);
    });
  });

  describe('Messenger account linking URL', function() {
    describe('#_setAccountLinkingURL and #_removeAccountLinkingURL', function() {
      const accountLinkingURL = 'https://www.examplesad.com';

      it('should successfully set the account linking URL using promises', function() {
        return bot._setAccountLinkingURL(accountLinkingURL)
        
        .then((body) => {
          expect(body.result).to.equal('Account linking url added');
          // just clean up the account link
          return bot._removeAccountLinkingURL();
        })
        .then((statusCode) => {
          expect(statusCode).to.equal(200);
        });
      });

      it('should successfully set the account linking URL using callbacks', function(done) {
        bot._setAccountLinkingURL(accountLinkingURL, function(body) {
          expect(body.result).to.equal('Account linking url added');
          // just clean up the account link
          bot._removeAccountLinkingURL(function(statusCode) {
            expect(statusCode).to.equal(200);
            done();
          } );
        });
      });
    });
  });

  describe('Messenger domain whitelisting', function() {
    const domainNameLists = [
      'https://example.com',
      'https://example2.com',
      'https://example3.com',
      'https://example4.com',
      'https://example5.com',
      'https://example6.com',
      'https://example7.com',
      'https://example8.com',
      'https://example9.com',
      'https://example10.com',
    ];

    describe('#_addWhitelistedDomains', function() {
      it('should successfully add some specified whitelisted domains using promises', function() {
        return bot._addWhitelistedDomains(domainNameLists)

        .then((body) => {
          expect(body.result).to.equal('Successfully updated whitelisted domains');
        });
      });

      it('should successfully add some specified whitelisted domains using callbacks', function(done) {
        bot._addWhitelistedDomains(domainNameLists, (body) => {
          expect(body.result).to.equal('Successfully updated whitelisted domains');
          done();
        });
      });
    });

    describe('#_getWhitelistedDomains', function() {
      it('should successfully get whitelisted domains using promises', function() {
        return bot._getWhitelistedDomains()

        .then((body) => {
          console.log(body);
          expect(body.data[0].whitelisted_domains.length).to.equal(10);
        });
      });

      it('should successfully get whitelisted domains using callbacks', function(done) {
        return bot._getWhitelistedDomains((body) => {
          expect(body.data[0].whitelisted_domains.length).to.equal(10);
          done();
        });
      });
    });

    describe('#_removeWhitelistedDomains', function() {
      it('should successfully remove some specified whitelisted domains using promises', function() {
        return bot._removeWhitelistedDomains(domainNameLists)

        .then(() => bot._getWhitelistedDomains())
        .then((body) => {
          expect(body.data[0].whitelisted_domains).to.equal(undefined);
        });
      });

      it('should successfully remove some specified whitelisted domains using callbacks', function(done) {
        this.timeout(8000);

        bot._removeWhitelistedDomains(domainNameLists, function() {
          bot._getWhitelistedDomains(function(body) {
            expect(body.data[0].whitelisted_domains).to.equal(undefined);
            done();
          });
        });
      });
    });
  });

  describe.only('Messenger Get started Button', function() {
    const getStartedButtonPayload = 'User has clicked on the get started button';

    describe('#_setGetStartedButton and #_removeGetStartedButton', function() {
      it('should successfully set the get started button using promises', function() {
        return bot._setGetStartedButton(getStartedButtonPayload)
        
        .then((body) => {
          expect(body.result).to.equal('Successfully added new_thread\'s CTAs');
          // just clean up the account link
          return bot._removeGetStartedButton();
        })
        .then((statusCode) => {
          expect(statusCode).to.equal(200);
        });
      });

      it('should successfully set the get started button using callbacks', function(done) {
        bot._setGetStartedButton(getStartedButtonPayload, function(body) {
          expect(body.result).to.equal('Successfully added new_thread\'s CTAs');
          // just clean up the account link
          bot._removeGetStartedButton(function(statusCode) {
            expect(statusCode).to.equal(200);
            done();
          } );
        });
      });
    });
  });

  describe('#_setGreetingText', function() {
    it('should successfully set the greeting using promises', function() {

    });

    it('should successfully set the greeting using callbacks', function() {
      
    });
  });

  describe('#_removeGreetingText', function() {
    it('should successfully remove the greeting using promises', function() {

    });

    it('should successfully remove the greeting using callbacks', function() {
      
    });
  });

  describe('#_setPersistentMenu', function() {
    it('should fail to set a persistent menu with more than 5 call to actions ', function() {

    });

    it('should successfully set the greeting using promises', function() {

    });

    it('should successfully set the greeting using callbacks', function() {
      
    });
  });

  describe('#getUserInfo()', function() {
    it('should return the userInfo for the passed in userId', function() {
      return bot.getUserInfo(config.messengerUserId)

      .then((userInfo) => {
        expect(userInfo.last_name).to.equal('Wuarin');
        expect(userInfo.gender).to.equal('male');
      });
    });
  });

  after(function(done) {
    this.retries(4);
    server.close(() => done());
  });
});
