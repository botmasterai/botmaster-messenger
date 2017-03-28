// 'use strict';

// const app = require('express')();
// const assert = require('chai').assert;
// const expect = require('chai').expect;
// const request = require('request-promise');
// require('chai').should();
// const _ = require('lodash');
// const MessengerBot = require('../../lib').botTypes.MessengerBot;
// const config = require('../config.js');
// const getMessengerSignatureHeader = require('../tests_utils').getMessengerSignatureHeader;

// const credentials = config.messengerCredentials;

// describe('Messenger Bot tests', function() {
//   const settings = {
//     credentials,
//     webhookEndpoint: '/messenger/webhook'
//   };


//   describe('Messenger account linking URL', function() {
//     describe('#_setAccountLinkingURL and #_removeAccountLinkingURL', function() {
//       const accountLinkingURL = 'https://www.examplesad.com';

//       it('should successfully set the account linking URL using promises', function() {
//         return bot._setAccountLinkingURL(accountLinkingURL)
        
//         .then((body) => {
//           expect(body.result).to.equal('Account linking url added');
//           // just clean up the account link
//           return bot._removeAccountLinkingURL();
//         })
//         .then((statusCode) => {
//           expect(statusCode).to.equal(200);
//         });
//       });

//       it('should successfully set the account linking URL using callbacks', function(done) {
//         bot._setAccountLinkingURL(accountLinkingURL, function(body) {
//           expect(body.result).to.equal('Account linking url added');
//           // just clean up the account link
//           bot._removeAccountLinkingURL(function(statusCode) {
//             expect(statusCode).to.equal(200);
//             done();
//           } );
//         });
//       });
//     });
//   });

//   describe('Messenger domain whitelisting', function() {
//     const domainNameLists = [
//       'https://example.com',
//       'https://example2.com',
//       'https://example3.com',
//       'https://example4.com',
//       'https://example5.com',
//       'https://example6.com',
//       'https://example7.com',
//       'https://example8.com',
//       'https://example9.com',
//       'https://example10.com',
//     ];

//     describe('#_addWhitelistedDomains', function() {
//       it('should successfully add some specified whitelisted domains using promises', function() {
//         return bot._addWhitelistedDomains(domainNameLists)

//         .then((body) => {
//           expect(body.result).to.equal('Successfully updated whitelisted domains');
//         });
//       });

//       it('should successfully add some specified whitelisted domains using callbacks', function(done) {
//         bot._addWhitelistedDomains(domainNameLists, (body) => {
//           expect(body.result).to.equal('Successfully updated whitelisted domains');
//           done();
//         });
//       });
//     });

//     describe('#_getWhitelistedDomains', function() {
//       it('should successfully get whitelisted domains using promises', function() {
//         return bot._getWhitelistedDomains()

//         .then((body) => {
//           console.log(body);
//           expect(body.data[0].whitelisted_domains.length).to.equal(10);
//         });
//       });

//       it('should successfully get whitelisted domains using callbacks', function(done) {
//         return bot._getWhitelistedDomains((body) => {
//           expect(body.data[0].whitelisted_domains.length).to.equal(10);
//           done();
//         });
//       });
//     });

//     describe('#_removeWhitelistedDomains', function() {
//       it('should successfully remove some specified whitelisted domains using promises', function() {
//         return bot._removeWhitelistedDomains(domainNameLists)

//         .then(() => bot._getWhitelistedDomains())
//         .then((body) => {
//           expect(body.data[0].whitelisted_domains).to.equal(undefined);
//         });
//       });

//       it('should successfully remove some specified whitelisted domains using callbacks', function(done) {
//         this.timeout(8000);

//         bot._removeWhitelistedDomains(domainNameLists, function() {
//           bot._getWhitelistedDomains(function(body) {
//             expect(body.data[0].whitelisted_domains).to.equal(undefined);
//             done();
//           });
//         });
//       });
//     });
//   });

//   describe.only('Messenger Get started Button', function() {
//     const getStartedButtonPayload = 'User has clicked on the get started button';

//     describe('#_setGetStartedButton and #_removeGetStartedButton', function() {
//       it('should successfully set the get started button using promises', function() {
//         return bot._setGetStartedButton(getStartedButtonPayload)
        
//         .then((body) => {
//           expect(body.result).to.equal('Successfully added new_thread\'s CTAs');
//           // just clean up the account link
//           return bot._removeGetStartedButton();
//         })
//         .then((statusCode) => {
//           expect(statusCode).to.equal(200);
//         });
//       });

//       it('should successfully set the get started button using callbacks', function(done) {
//         bot._setGetStartedButton(getStartedButtonPayload, function(body) {
//           expect(body.result).to.equal('Successfully added new_thread\'s CTAs');
//           // just clean up the account link
//           bot._removeGetStartedButton(function(statusCode) {
//             expect(statusCode).to.equal(200);
//             done();
//           } );
//         });
//       });
//     });
//   });

//   describe('#_setGreetingText', function() {
//     it('should successfully set the greeting using promises', function() {

//     });

//     it('should successfully set the greeting using callbacks', function() {
      
//     });
//   });

//   describe('#_removeGreetingText', function() {
//     it('should successfully remove the greeting using promises', function() {

//     });

//     it('should successfully remove the greeting using callbacks', function() {
      
//     });
//   });

//   describe('#_setPersistentMenu', function() {
//     it('should fail to set a persistent menu with more than 5 call to actions ', function() {

//     });

//     it('should successfully set the greeting using promises', function() {

//     });

//     it('should successfully set the greeting using callbacks', function() {
      
//     });
//   });

//   describe('#getUserInfo()', function() {
//     it('should return the userInfo for the passed in userId', function() {
//       return bot.getUserInfo(config.messengerUserId)

//       .then((userInfo) => {
//         expect(userInfo.last_name).to.equal('Wuarin');
//         expect(userInfo.gender).to.equal('male');
//       });
//     });
//   });

//   after(function(done) {
//     this.retries(4);
//     server.close(() => done());
//   });
// });
