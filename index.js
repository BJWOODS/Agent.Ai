//requirements
const express = require('express');
const request = require('request');
const bodyParser = require('body-parser');
// const MongoClient = require('mongodb').MongoClient;
// const mongoose = require('mongoose');
const Wit = require('node-wit').Wit;
const log = require('node-wit').log;
const Fiber = require('fibers');
const policyWrapper = require('./PolicyWrapper.js');
const polWrapper = new policyWrapper(process.env.MONGO_DB_URI);
// const polWrapper = new policyWrapper();
//---------------------------------------------------------------------------

//global variables
const fbConfirmationQuestion = 'Is there anything else I can help you with regarding your CIG policy(ies)?';
const fbPolicyQuestion = 'Which policy (Home or Auto) would you like to know the answer to this question for';
const autoIntents = ["autoPolicyDiscountIntent", "getCarsIntent", "easyPayIntent", "numCarsIntent","lineOfBusinessIntent",
"autoClaimIntent", "autoCoverageIntent", "vinNumIntent", "autoIntent", "vehicleDiscounts", "vehicleGenericCoverages","driverIntent",
"fullAutoCoverage", "glassClaim", "getLoanNumber"];
const homeIntents = ["lossOfUseIntent", "SpecialtyProgramsIntent", "dwellingIntent", "homeownersIntent", "personalLiabilityIntent",
"homeMedicalCovIntent", "personalPropertyIntent", "OptionalCoveragesIntent", "basicPremiumIntent", "OtherStructuresIntent"];
const bothTypeIntents = ["enhancedCoveragesIntent", "policyEndDateIntent", "policyDeductibleIntent", "totalPremiumIntent", "claimIntent", "agentIntent", "policyDiscountIntent", "effectiveDateIntent"];
const conversationalIntents = ['endConvoIntent','keepConvoIntent', 'greetingIntent'];
// console.log(autoIntents.length + homeIntents.length + bothTypeIntents.length);
//environment variables
// const uri = process.env.MONGO_DB_URI;
const wit_token = process.env.WIT_TOKEN;
const fb_ver_token = process.env.VERIFICATION_TOKEN;
const fb_page_token = process.env.FB_PAGE_TOKEN;
//---------------------------------------------------------------------------

//setting up wit bot
const wit = new Wit ({
  accessToken: wit_token,
  logger: new log.Logger(log.DEBUG)
});
//--------------------------------------------------------------------------


//setting up user sessions to create sessions and use fb id to uniquely identify them
//sessionID -> {fbid: facebookUserID, context: sessionState}
const sessions = {};

const findOrCreateSession = (fbid) => {
  let sessionID;
  Object.keys(sessions).forEach(k => {
    if(sessions[k].fbid === fbid){
      sessionID = k;
    }
  });
  if(!sessionID){
    sessionID = new Date().toISOString();
    sessions[sessionID] = {fbid: fbid, context: {}};
  }
  return sessionID;
};
//-------------------------------------------------------------------------

//FB Message Typing Action - Using Messenger API
const typingBubble = (id, text) => {
  const body = JSON.stringify({
      recipient: { id },
      "sender_action":"typing_on"
  });

  const qs = 'access_token=' + encodeURIComponent(fb_page_token);
  return fetch('https://graph.facebook.com/me/messages?' + qs, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body,
  })
  .then(rsp => rsp.json())
  .then(json => {
    if (json.error && json.error.message) {
      throw new Error(json.error.message);
    }
    return json;
  });
};


//FB Messenger Message - Using Messenger API
const fbMessage = (id, text) => {
    const body = JSON.stringify({
      messaging_type: 'RESPONSE',
      recipient: {id},
      message: {text},
    });
    const qs = 'access_token=' + encodeURIComponent(fb_page_token);
    return fetch('https://graph.facebook.com/v2.6/me/messages?' + qs, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body,
    })
    .then(rsp => rsp.json())
    .then(json=> {
      if(json.error && json.error.message){
        throw new Error(json.error.message);
      }
      return json;
    });
};
//-------------------------------------------------------------------------


//App Functionality
var app = express();
app.use(bodyParser.urlencoded({extended: false}));
app.use(bodyParser.json());
app.listen((process.env.PORT || 5000));

// Server index page
app.get("/", function (req, res) {
  res.send("Deployed!");
});

// Facebook Webhook
// Used for verification
app.get("/webhook", function (req, res) {
  if (req.query["hub.verify_token"] === fb_ver_token){
    console.log("Verified webhook");
    res.status(200).send(req.query["hub.challenge"]);
  } else {
    console.error("Verification failed. The tokens do not match.");
    res.sendStatus(403);
  }
});

// All callbacks for Messenger will be POST-ed here
app.post('/webhook', (req, res) => {
  // Parse the Messenger payload
  // See the Webhook reference
  const data = req.body;

  if (data.object === 'page') {
    data.entry.forEach(entry => {
      entry.messaging.forEach(event => {
        //Check if get started button is pressed for conversation starter
        if (event.postback) {
          processPostback(event);
        }
        //Check for message and process message
        if (event.message && !event.message.is_echo) {
          // We got a message
          // We retrieve the Facebook user ID of the sender
          const sender = event.sender.id;

          // We could retrieve the user's current session, or create one if it doesn't exist
          // This is useful if we want our bot to figure out the conversation history
          const sessionId = findOrCreateSession(sender);

          // We retrieve the message content
          const {text, attachments} = event.message;

          if (attachments) {
            // We received an attachment
            // Let's reply with an automatic message
            fbMessage(sender, 'Sorry I can only process text messages for now.')
            .catch(console.error);
          } else if (text) {
            // We received a text message
            // Let's run /message on the text to extract some entities
            // Create message issue object for chance of issuing customer
            wit.message(text).then(({entities}) => {
              // You can customize your response to these entities
              //process the entities with wit
              processEntities(sender, entities, text);
              // For now, let's reply with another automatic message
              // fbMessage(sender, `We've received your message: ${text}.`);
            })
            .catch((err) => {
              console.error('Oops! Got an error from Wit: ', err.stack || err);
            })
          }
        } else {
          console.log('received event', JSON.stringify(event));
        }
      });
    });
  }
  res.sendStatus(200);
});
//-----------------------------------------------------------------------

//User functions
//sleep function for setting timeout to send order of fb messages in node js
function sleep(ms) {
    var fiber = Fiber.current;
    setTimeout(function() {
        fiber.run();
    }, ms);
    Fiber.yield();
}

function contains(a1, a2){
    if (a1.length>a2.length) return false;
    for (var i=0; i<a1.length; i++){
        if (a2.indexOf(a1[i])<0) return false;
    }
    return true;
}

function getDualPolicyDuplicate(arr1, arr2){
    let indxNum;
    arr2.some(function(v){
      indxNum = arr1.indexOf(v)
    });
    return indxNum;
}

function processPostback(event) {
  var senderId = event.sender.id;
  var payload = event.postback.payload;

  if (payload === "Greeting") {
    // Get user's first name from the User Profile API
    // and include it in the greeting
    //addUsertoCollections(senderId);
    request({
      url: "https://graph.facebook.com/v2.6/" + senderId,
      qs: {
        access_token: process.env.VERIFICATION_TOKEN,
        fields: "first_name"
      },
      method: "GET"
    }, function(error, response, body) {
      var greeting = "";
      if (error) {
        console.log("Error getting user's name: " +  error);
      } else {
        var bodyObj = JSON.parse(body);
        name = bodyObj.first_name;
        greeting = "Hi " + name + ". ";
      }
      var message = greeting + "My name is AgentAI. I can tell you various details regarding your CIG policies. What questions about your policy can I help you with today?";
      fbMessage(senderId, message).catch(console.error);
    });
  }
}

function processEntities(sender,entities, text){
  var customerIssueObject = {};
  console.log(entities);
  var keys = Object.keys(entities), key = keys[0];
  customerIssueObject["issues"] = {};
  customerIssueObject.id = sender;
  customerIssueObject.previous = keys.toString();
  // customerIssueObject.policyType = "unknown";
  customerIssueObject.issues.text = text;
  customerIssueObject.issues.intents = keys.toString();
  console.log(customerIssueObject);
  if(keys.some(r => bothTypeIntents.includes(r)) || keys.some(r2 => homeIntents.includes(r2)) || keys.some(r3 => autoIntents.includes(r3)) || keys.some(r4 => conversationalIntents.includes(r4))){ //Believed to have understand user intents
    // let found = keys.some(r => bothTypeIntents.includes(r)));
    // console.log('found result: ' + found);
    //Check for entity mapping(bothTypes-withNoIdentifier, bothTypes-withAnotherIdentifier, normalMapping )
    //entities that are dual and home
    if(keys.some(r => bothTypeIntents.includes(r)) && keys.some(r2 => homeIntents.includes(r2)) && !keys.some(r3 => autoIntents.includes(r3))) {
      // found bothTypeIntents and home intent
      if(entities.hasOwnProperty('agentIntent') && entities.hasOwnProperty('homeownersIntent')){
        console.log('Agent Intent and Home Intent found');
        if(entities.agentIntent[0].confidence > .75 && entities.homeownersIntent[0].confidence > .75){
          console.log('High enough confidence to perform query.');
          polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
            if(err){
              throw err;
            }else{
              console.log('Set customer issue object');
            }
          });
          polWrapper.getHomeOwnerAgent(function(err, result){
            if(err){
              throw err;
            }else{
              console.log('getHomeAgent Result is ' + result);
              Fiber(function() {
                typingBubble(sender, text).catch(console.error);
                sleep(1000);
                fbMessage(sender, result).catch(console.error);
                sleep(1000);
                fbMessage(sender, fbConfirmationQuestion).catch(console.error);
              }).run();
            }
          });
        }
      }
      else if(entities.hasOwnProperty('policyEndDate') && enitities.hasOwnProperty('homeownersIntent')){
        console.log('End date and home intent found');
        if(entities.policyEndDate[0].confidence > .50 && entities.homeownersIntent[0].confidence > .50){
          console.log('High Enough confidence to perform query');
          polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
            if(err){
              throw err;
            }else{
              console.log('Set customer issue object');
            }
          });
          polWrapper.getHomePolicyEndDate(function(err, result){
            if(err){
              throw err;
            }
            Fiber(function() {
              typingBubble(sender, text).catch(console.error);
              sleep(1000);
              fbMessage(sender, result).catch(console.error);
              sleep(1000);
              fbMessage(sender, fbConfirmationQuestion).catch(console.error);
            }).run();
          });
        }
      }
      else if(entities.hasOwnProperty('policyDeductibleIntent') && entities.hasOwnProperty('homeownersIntent')){
        console.log('Deductible and Home Intent found');
        if(entities.policyDeductibleIntent[0].confidence > .50 && entities.homeownersIntent[0].confidence > .50){
          polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
            if(err){
              throw err;
            }else{
              console.log('Set customer issue object');
            }
          });
          polWrapper.getHomePolicyDeductible(function(err, result){
            if(err){
              throw err;
            }
            Fiber(function() {
              typingBubble(sender, text).catch(console.error);
              sleep(1000);
              fbMessage(sender, result).catch(console.error);
              sleep(1000);
              fbMessage(sender, fbConfirmationQuestion).catch(console.error);
            }).run();
          });
        }
      }
      else if(entities.hasOwnProperty('enhancedCoveragesIntent') && entities.hasOwnProperty('homeownersIntent')){
        console.log('Enhanced Coverages and Home Intent found');
        if(entities.enhancedCoveragesIntent[0].confidence > .50 && entities.homeownersIntent[0].confidence > .50){
          polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
            if(err){
              throw err;
            }else{
              console.log('Set customer issue object');
            }
          });
          polWrapper.homeOwnerEnhancedCoverages(function(err, result){
            if(err){
              throw err;
            }
            Fiber(function() {
              typingBubble(sender, text).catch(console.error);
              sleep(1000);
              fbMessage(sender, result).catch(console.error);
              sleep(1000);
              fbMessage(sender, fbConfirmationQuestion).catch(console.error);
            }).run();
          });
        }
      }
      else if(entities.hasOwnProperty('effectiveDateIntent') && entities.hasOwnProperty('homeownersIntent')){
        console.log('Effective Date and Home Intent found');
        if(entities.effectiveDateIntent[0].confidence > .50 && entities.homeownersIntent[0].confidence > .50){
          polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
            if(err){
              throw err;
            }else{
              console.log('Set customer issue object');
            }
          });
          polWrapper.homeownerEffectiveDate(function(err, result){
            if(err){
              throw err;
            }
            Fiber(function() {
              typingBubble(sender, text).catch(console.error);
              sleep(1000);
              fbMessage(sender, result).catch(console.error);
              sleep(1000);
              fbMessage(sender, fbConfirmationQuestion).catch(console.error);
            }).run();
          });
        }
      }
      else if(entities.hasOwnProperty('totalPremiumIntent') && entities.hasOwnProperty('homeownersIntent')){
        console.log('Total Premium and Home Intent found');
        if(entities.totalPremiumIntent[0].confidence > .50 && entities.homeownersIntent[0].confidence > .50){
          polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
            if(err){
              throw err;
            }else{
              console.log('Set customer issue object');
            }
          });
          polWrapper.getHomeTotalPremium(function(err, result){
            if(err){
              throw err;
            }
            Fiber(function() {
              typingBubble(sender, text).catch(console.error);
              sleep(1000);
              fbMessage(sender, result).catch(console.error);
              sleep(1000);
              fbMessage(sender, fbConfirmationQuestion).catch(console.error);
            }).run();
          });
        }
      }
      else if(entities.hasOwnProperty('claimIntent') && entities.hasOwnProperty('homeownersIntent')){
        console.log('Claim and Home Intent found');
        if(entities.claimIntent[0].confidence > .50 && entities.homeownersIntent[0].confidence > .50){
          polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
            if(err){
              throw err;
            }else{
              console.log('Set customer issue object');
            }
          });
          polWrapper.getHomeOwnerAgent(function(err, result){
            if(err){
              throw err;
            }else{
              console.log('getHomeAgent Result is ' + result);
              Fiber(function() {
                typingBubble(sender, text).catch(console.error);
                sleep(1000);
                fbMessage(sender, 'If you need help with a claim, you need to contact your agent. ' +result).catch(console.error);
                sleep(1000);
                fbMessage(sender, fbConfirmationQuestion).catch(console.error);
              }).run();
            }
          });
        }
      }
      else if(entities.hasOwnProperty('policyDiscountIntent') && entities.hasOwnProperty('homeownersIntent')){
        console.log('Policy Discount and Home Intent found');
        if(entities.policyDiscountIntent[0].confidence > .50 && entities.homeownersIntent[0].confidence > .50){
          polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
            if(err){
              throw err;
            }else{
              console.log('Set customer issue object');
            }
          });
          polWrapper.getHomeOwnerAgent(function(err, result){
            if(err){
              throw err;
            }
            Fiber(function() {
              typingBubble(sender, text).catch(console.error);
              sleep(1000);
              fbMessage(sender, 'For discounts concerning your homeowner\'s policy you need to contact your agent. ' +result).catch(console.error);
              sleep(1000);
              fbMessage(sender, fbConfirmationQuestion).catch(console.error);
            }).run();
          });
        }
      }
    }
    //entities that are dual and auto
    else if(keys.some(r => bothTypeIntents.includes(r)) && !keys.some(r2 => homeIntents.includes(r2)) && keys.some(r3 => autoIntents.includes(r3))){
      //found bothTypeIntents and autoIntents
      if(entities.hasOwnProperty('agentIntent') && entities.hasOwnProperty('autoIntent')){
        console.log('Agent Intent and Auto Intent found');
        if(entities.agentIntent[0].confidence > .75 && entities.autoIntent[0].confidence > .75){
          polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
            if(err){
              throw err;
            }else{
              console.log('Set customer issue object');
            }
          });
          console.log('High enough confidence to perform query.');
          polWrapper.getAutoAgent(function(err, result){
            if(err){
              throw err;
            }else{
              console.log('getAutoAgent Result is ' + result);
              Fiber(function() {
                typingBubble(sender, text).catch(console.error);
                sleep(1000);
                fbMessage(sender, result).catch(console.error);
                sleep(1000);
                fbMessage(sender, fbConfirmationQuestion).catch(console.error);
              }).run();
            }
          });
        }
      }
      else if(entities.hasOwnProperty('policyEndDate') && enitities.hasOwnProperty('autoIntent')){
        console.log('End date and auto intent found');
        if(entities.policyEndDate[0].confidence > .50 && entities.autoIntent[0].confidence > .50){
          console.log('High Enough confidence to perform query');
          polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
            if(err){
              throw err;
            }else{
              console.log('Set customer issue object');
            }
          });
          polWrapper.autoPolicyExpirationDate(function(err, result){
            if(err){
              throw err;
            }
            Fiber(function() {
              typingBubble(sender, text).catch(console.error);
              sleep(1000);
              fbMessage(sender, result).catch(console.error);
              sleep(1000);
              fbMessage(sender, fbConfirmationQuestion).catch(console.error);
            }).run();
          });
        }
      }
      else if(entities.hasOwnProperty('policyDeductibleIntent') && entities.hasOwnProperty('autoIntent')){
        console.log('Deductible and AutoIntent found');
        if(entities.policyDeductibleIntent[0].confidence > .50 && entities.autoIntent[0].confidence > .50){
          polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
            if(err){
              throw err;
            }else{
              console.log('Set customer issue object');
            }
          });
          polWrapper.vehicleGenericCoverages(function(err, result){
            if(err){
              throw err;
            }
            Fiber(function() {
              typingBubble(sender, text).catch(console.error);
              sleep(1000);
              fbMessage(sender, result).catch(console.error);
              sleep(1000);
              fbMessage(sender, fbConfirmationQuestion).catch(console.error);
            }).run();
          });
        }
      }
      else if(entities.hasOwnProperty('enhancedCoveragesIntent') && entities.hasOwnProperty('autoIntent')){
        console.log('Enhanced Coverages and Home Intent found');
        if(entities.enhancedCoveragesIntent[0].confidence > .50 && entities.autoIntent[0].confidence > .50){
          polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
            if(err){
              throw err;
            }else{
              console.log('Set customer issue object');
            }
          });
          polWrapper.autoEnhancedCoverages(function(err, result){
            if(err){
              throw err;
            }
            Fiber(function() {
              typingBubble(sender, text).catch(console.error);
              sleep(1000);
              fbMessage(sender, result).catch(console.error);
              sleep(1000);
              fbMessage(sender, fbConfirmationQuestion).catch(console.error);
            }).run();
          });
        }
      }
      else if(entities.hasOwnProperty('effectiveDateIntent') && entities.hasOwnProperty('autoIntent')){
        console.log('Effective Date and Home Intent found');
        if(entities.effectiveDateIntent[0].confidence > .50 && entities.autoIntent[0].confidence > .50){
          polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
            if(err){
              throw err;
            }else{
              console.log('Set customer issue object');
            }
          });
          polWrapper.autoEffectiveDate(function(err, result){
            if(err){
              throw err;
            }
            Fiber(function() {
              typingBubble(sender, text).catch(console.error);
              sleep(1000);
              fbMessage(sender, result).catch(console.error);
              sleep(1000);
              fbMessage(sender, fbConfirmationQuestion).catch(console.error);
            }).run();
          });
        }
      }
      else if(entities.hasOwnProperty('totalPremiumIntent') && entities.hasOwnProperty('autoIntent')){
        console.log('Total Premium and Home Intent found');
        if(entities.totalPremiumIntent[0].confidence > .50 && entities.autoIntent[0].confidence > .50){
          polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
            if(err){
              throw err;
            }else{
              console.log('Set customer issue object');
            }
          });
          polWrapper.getAutoPremium(function(err, result){
            if(err){
              throw err;
            }
            Fiber(function() {
              typingBubble(sender, text).catch(console.error);
              sleep(1000);
              fbMessage(sender, result).catch(console.error);
              sleep(1000);
              fbMessage(sender, fbConfirmationQuestion).catch(console.error);
            }).run();
          });
        }
      }
      else if(entities.hasOwnProperty('claimIntent') && entities.hasOwnProperty('autoIntent')){
        console.log('Claim and auto Intent found');
        if(entities.claimIntent[0].confidence > .50 && entities.autoIntent[0].confidence > .50){
          polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
            if(err){
              throw err;
            }else{
              console.log('Set customer issue object');
            }
          });
          polWrapper.getAutoAgent(function(err, result){
            if(err){
              throw err;
            }else{
              console.log('getAuto Result is ' + result);
              Fiber(function() {
                typingBubble(sender, text).catch(console.error);
                sleep(1000);
                fbMessage(sender, 'If you need help with a claim, you need to contact your agent. ' +result).catch(console.error);
                sleep(1000);
                fbMessage(sender, fbConfirmationQuestion).catch(console.error);
              }).run();
            }
          });
        }
      }
      else if(entities.hasOwnProperty('policyDiscountIntent') && entities.hasOwnProperty('autoIntent')){
        console.log('Policy Discount and Auto Intent found');
        if(entities.policyDiscountIntent[0].confidence > .50 && entities.autoIntent[0].confidence > .50){
          polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
            if(err){
              throw err;
            }else{
              console.log('Set customer issue object');
            }
          });
          polWrapper.getAutoDiscounts(function(err, result){
            if(err){
              throw err;
            }
            Fiber(function() {
              typingBubble(sender, text).catch(console.error);
              sleep(1000);
              fbMessage(sender, result).catch(console.error);
              sleep(1000);
              fbMessage(sender, fbConfirmationQuestion).catch(console.error);
            }).run();
          });
        }
      }
    }
    //entities that are dual
    else if(keys.some(r => bothTypeIntents.includes(r)) && !keys.some(r2 => homeIntents.includes(r2)) && !keys.some(r3 => autoIntents.includes(r3))) {
    // found bothTypeIntents but no intents for the others so we need to get clarification
    // customerIssueObject.policyType = 'dual';
    polWrapper.checkUserInDB(customerIssueObject, function(err, result){
      if(err){
        throw err;
      }else{
        console.log('CheckUserInDB:' + result);
        if(result === 0){
          customerIssueObject.previous = keys.toString();
          polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
            if(err){
              throw err;
            }else{
              console.log('Set customer issue object');
              //Perform relevant check to see if policy type is known, if its known perform query based on policy type, if not known ask the policy question
              if(result.matchedCount === 1 || result.upsertedCount === 1){
                polWrapper.getPolicyType(customerIssueObject, function(err, result){
                  if(err){
                    throw err;
                  }else{
                    if(result === 'unknown' || result === '' || result === null || result === ' '){
                      console.log('Unknown policy type for fresh user in db');
                      Fiber(function() {
                        typingBubble(sender, text).catch(console.error);
                        sleep(1000);
                        fbMessage(sender, fbPolicyQuestion).catch(console.error);
                        }).run();
                      }
                    }
                  });
                }
              }
            });
          }
        else if(result === 1){ //User exists
          polWrapper.userPrevSetter(customerIssueObject, function(err,result){
            if(err){
              throw err;
            }else{
              polWrapper.getPolicyType(customerIssueObject, function(err, result){
                if(err){
                  throw err;
                }else{
                  if(result === 'unknown' || result === '' || result === null || result === ' '){
                    console.log('Unknown policy type for found user in db');
                    Fiber(function() {
                      typingBubble(sender, text).catch(console.error);
                      sleep(1000);
                      fbMessage(sender, fbPolicyQuestion).catch(console.error);
                      }).run();
                    }
              else if(result === 'home'){
                console.log('Got home policy reference');
                polWrapper.userPrevSetter(customerIssueObject, function(err, result){
                  console.log('PrevSetter function being called in home check');
                  if(err){
                    throw err;
                  }else{
                    console.log('Getting Home previous result');
                    polWrapper.getPreviousIntent(customerIssueObject, function(err, result){
                      if(err){
                        throw err;
                      }else{
                        var intentArray = result.split(',');
                        console.log('intent Array:' + intentArray);
                        var intentIndx = getDualPolicyDuplicate(bothTypeIntents, intentArray);
                        console.log('getDualPolicyDuplicateResult: ' + intentIndx);
                        console.log('Intent to query: ' + bothTypeIntents[intentIndx]);
                        if(bothTypeIntents[intentIndx] === "enhancedCoveragesIntent"){
                          polWrapper.homeOwnerEnhancedCoverages(function(err, result){
                            if(err){
                              throw err;
                            }
                            Fiber(function() {
                              typingBubble(sender, text).catch(console.error);
                              sleep(1000);
                              fbMessage(sender, result).catch(console.error);
                              sleep(1000);
                              fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                              sleep(1000);
                              polWrapper.clearPolicyType(customerIssueObject, function(err, result){
                                if(err){
                                  throw err;
                                }else{
                                  console.log('Successfully cleared policy type');
                                }
                              });
                              sleep(1000);
                              polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                                if(err){
                                  throw err;
                                }
                                if(result.matchedCount === 1 && result.modifiedCount === 1){
                                  console.log('Successful reset of prevIntent');
                                }
                              });
                            }).run();
                          });
                        }
                        else if(bothTypeIntents[intentIndx] === "policyEndDateIntent"){
                          polWrapper.getHomePolicyEndDate(function(err, result){
                            if(err){
                              throw err;
                            }
                            Fiber(function() {
                              typingBubble(sender, text).catch(console.error);
                              sleep(1000);
                              fbMessage(sender, result).catch(console.error);
                              sleep(1000);
                              fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                              sleep(1000);
                              polWrapper.clearPolicyType(customerIssueObject, function(err, result){
                                if(err){
                                  throw err;
                                }else{
                                  console.log('Successfully cleared policy type');
                                }
                              });
                              sleep(1000);
                              polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                                if(err){
                                  throw err;
                                }
                                if(result.matchedCount === 1 && result.modifiedCount === 1){
                                  console.log('Successful reset of prevIntent');
                                }
                              });
                            }).run();
                          });
                        }
                        else if(bothTypeIntents[intentIndx] === "policyDeductibleIntent"){
                          polWrapper.getHomePolicyDeductible(function(err, result){
                            if(err){
                              throw err;
                            }
                            Fiber(function() {
                              typingBubble(sender, text).catch(console.error);
                              sleep(1000);
                              fbMessage(sender, result).catch(console.error);
                              sleep(1000);
                              fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                              sleep(1000);
                              polWrapper.clearPolicyType(customerIssueObject, function(err, result){
                                if(err){
                                  throw err;
                                }else{
                                  console.log('Successfully cleared policy type');
                                }
                              });
                              sleep(1000);
                              polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                                if(err){
                                  throw err;
                                }
                                if(result.matchedCount === 1 && result.modifiedCount === 1){
                                  console.log('Successful reset of prevIntent');
                                }
                              });
                            }).run();
                          });
                        }
                        else if(bothTypeIntents[intentIndx] === "totalPremiumIntent"){
                          polWrapper.getHomeTotalPremium(function(err, result){
                            if(err){
                              throw err;
                            }
                            Fiber(function() {
                              typingBubble(sender, text).catch(console.error);
                              sleep(1000);
                              fbMessage(sender, result).catch(console.error);
                              sleep(1000);
                              fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                              sleep(1000);
                              polWrapper.clearPolicyType(customerIssueObject, function(err, result){
                                if(err){
                                  throw err;
                                }else{
                                  console.log('Successfully cleared policy type');
                                }
                              });
                              sleep(1000);
                              polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                                if(err){
                                  throw err;
                                }
                                if(result.matchedCount === 1 && result.modifiedCount === 1){
                                  console.log('Successful reset of prevIntent');
                                }
                              });
                            }).run();
                          });
                        }
                        else if(bothTypeIntents[intentIndx] === "claimIntent"){
                          polWrapper.getHomeOwnerAgent(function(err, result){
                            if(err){
                              throw err;
                            }else{
                              console.log('getHomeAgent Result is ' + result);
                              Fiber(function() {
                                typingBubble(sender, text).catch(console.error);
                                sleep(1000);
                                fbMessage(sender, 'If you need help with a claim, you need to contact your agent. ' +result).catch(console.error);
                                sleep(1000);
                                fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                                sleep(1000);
                                polWrapper.clearPolicyType(customerIssueObject, function(err, result){
                                  if(err){
                                    throw err;
                                  }else{
                                    console.log('Successfully cleared policy type');
                                  }
                                });
                                sleep(1000);
                                polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                                  if(err){
                                    throw err;
                                  }
                                  if(result.matchedCount === 1 && result.modifiedCount === 1){
                                    console.log('Successful reset of prevIntent');
                                  }
                                });
                              }).run();
                            }
                          });
                        }
                        else if(bothTypeIntents[intentIndx] === "agentIntent"){
                          polWrapper.getHomeOwnerAgent(function(err, result){
                            if(err){
                              throw err;
                            }else{
                              console.log('getHomeAgent Result is ' + result);
                              Fiber(function() {
                                typingBubble(sender, text).catch(console.error);
                                sleep(1000);
                                fbMessage(sender, result).catch(console.error);
                                sleep(1000);
                                fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                                sleep(1000);
                                polWrapper.clearPolicyType(customerIssueObject, function(err, result){
                                  if(err){
                                    throw err;
                                  }else{
                                    console.log('Successfully cleared policy type');
                                  }
                                });
                                sleep(1000);
                                polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                                  if(err){
                                    throw err;
                                  }
                                  if(result.matchedCount === 1 && result.modifiedCount === 1){
                                    console.log('Successful reset of prevIntent');
                                  }
                                });
                              }).run();
                            }
                          });
                        }
                        else if(bothTypeIntents[intentIndx] === "policyDiscountIntent"){
                          polWrapper.getHomeOwnerAgent(function(err, result){
                            if(err){
                              throw err;
                            }
                            Fiber(function() {
                              typingBubble(sender, text).catch(console.error);
                              sleep(1000);
                              fbMessage(sender, 'For discounts concerning your homeowner\'s policy you need to contact your agent. ' +result).catch(console.error);
                              sleep(1000);
                              fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                              sleep(1000);
                              polWrapper.clearPolicyType(customerIssueObject, function(err, result){
                                if(err){
                                  throw err;
                                }else{
                                  console.log('Successfully cleared policy type');
                                }
                              });
                              sleep(1000);
                              polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                                if(err){
                                  throw err;
                                }
                                if(result.matchedCount === 1 && result.modifiedCount === 1){
                                  console.log('Successful reset of prevIntent');
                                }
                              });
                            }).run();
                          });
                        }
                        else if(bothTypeIntents[intentIndx] === "effectiveDateIntent"){
                          polWrapper.homeownerEffectiveDate(function(err, result){
                            if(err){
                              throw err;
                            }
                            Fiber(function() {
                              typingBubble(sender, text).catch(console.error);
                              sleep(1000);
                              fbMessage(sender, result).catch(console.error);
                              sleep(1000);
                              fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                              sleep(1000);
                              polWrapper.clearPolicyType(customerIssueObject, function(err, result){
                                if(err){
                                  throw err;
                                }else{
                                  console.log('Successfully cleared policy type');
                                }
                              });
                              sleep(1000);
                              polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                                if(err){
                                  throw err;
                                }
                                if(result.matchedCount === 1 && result.modifiedCount === 1){
                                  console.log('Successful reset of prevIntent');
                                }
                              });
                            }).run();
                          });
                        }
                      }
                    });
                  }
                });
              }
              else if(result === 'auto'){
                console.log('Got auto policy reference');
                      polWrapper.userPrevSetter(customerIssueObject, function(err, result){
                        console.log('PrevSetter being called in auto function');
                        if(err){
                          throw err;
                        }else{
                          polWrapper.getPreviousIntent(customerIssueObject, function(err, result){
                            if(err){
                              throw err;
                            }else{
                              var intentArray = result.split(',');
                              console.log('intent Array:' + intentArray);
                              var intentIndx = getDualPolicyDuplicate(bothTypeIntents, intentArray);
                              console.log('getDualPolicyDuplicateResult: ' + intentIndx);
                              console.log('Intent to query: ' + bothTypeIntents[intentIndx]);
                              //"enhancedCoveragesIntent", "policyEndDateIntent", "policyDeductibleIntent", "totalPremiumIntent", "claimIntent", "agentIntent", "policyDiscountIntent", "effectiveDateIntent"
                              if(bothTypeIntents[intentIndx] === "enhancedCoveragesIntent"){
                                polWrapper.autoEnhancedCoverages(function(err, result){
                                  if(err){
                                    throw err;
                                  }
                                  Fiber(function() {
                                    typingBubble(sender, text).catch(console.error);
                                    sleep(1000);
                                    fbMessage(sender, result).catch(console.error);
                                    sleep(1000);
                                    fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                                    sleep(1000);
                                    polWrapper.clearPolicyType(customerIssueObject, function(err, result){
                                      if(err){
                                        throw err;
                                      }else{
                                        console.log('Successfully cleared policy type');
                                      }
                                    });
                                    sleep(1000);
                                    polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                                      if(err){
                                        throw err;
                                      }
                                      if(result.matchedCount === 1 && result.modifiedCount === 1){
                                        console.log('Successful reset of prevIntent');
                                      }
                                    });
                                  }).run();
                                });
                              }
                              else if(bothTypeIntents[intentIndx] === "policyEndDateIntent"){
                                polWrapper.autoPolicyExpirationDate(function(err, result){
                                  if(err){
                                    throw err;
                                  }
                                  Fiber(function() {
                                    typingBubble(sender, text).catch(console.error);
                                    sleep(1000);
                                    fbMessage(sender, result).catch(console.error);
                                    sleep(1000);
                                    fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                                    sleep(1000);
                                    polWrapper.clearPolicyType(customerIssueObject, function(err, result){
                                      if(err){
                                        throw err;
                                      }else{
                                        console.log('Successfully cleared policy type');
                                      }
                                    });
                                    sleep(1000);
                                    polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                                      if(err){
                                        throw err;
                                      }
                                      if(result.matchedCount === 1 && result.modifiedCount === 1){
                                        console.log('Successful reset of prevIntent');
                                      }
                                    });
                                  }).run();
                                });
                              }
                              else if(bothTypeIntents[intentIndx] === "policyDeductibleIntent"){
                                polWrapper.vehicleGenericCoverages(function(err, result){
                                  if(err){
                                    throw err;
                                  }
                                  Fiber(function() {
                                    typingBubble(sender, text).catch(console.error);
                                    sleep(1000);
                                    fbMessage(sender, result).catch(console.error);
                                    sleep(1000);
                                    fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                                    sleep(1000);
                                    polWrapper.clearPolicyType(customerIssueObject, function(err, result){
                                      if(err){
                                        throw err;
                                      }else{
                                        console.log('Successfully cleared policy type');
                                      }
                                    });
                                    sleep(1000);
                                    polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                                      if(err){
                                        throw err;
                                      }
                                      if(result.matchedCount === 1 && result.modifiedCount === 1){
                                        console.log('Successful reset of prevIntent');
                                      }
                                    });
                                  }).run();
                                });
                              }
                              else if(bothTypeIntents[intentIndx] === "totalPremiumIntent"){
                                polWrapper.getAutoPremium(function(err, result){
                                  if(err){
                                    throw err;
                                  }
                                  Fiber(function() {
                                    typingBubble(sender, text).catch(console.error);
                                    sleep(1000);
                                    fbMessage(sender, result).catch(console.error);
                                    sleep(1000);
                                    fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                                    sleep(1000);
                                    polWrapper.clearPolicyType(customerIssueObject, function(err, result){
                                      if(err){
                                        throw err;
                                      }else{
                                        console.log('Successfully cleared policy type');
                                      }
                                    });
                                    sleep(1000);
                                    polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                                      if(err){
                                        throw err;
                                      }
                                      if(result.matchedCount === 1 && result.modifiedCount === 1){
                                        console.log('Successful reset of prevIntent');
                                      }
                                    });
                                  }).run();
                                });
                              }
                              else if(bothTypeIntents[intentIndx] === "claimIntent"){
                                polWrapper.getAutoAgent(function(err, result){
                                  if(err){
                                    throw err;
                                  }else{
                                    console.log('getAuto Result is ' + result);
                                    Fiber(function() {
                                      typingBubble(sender, text).catch(console.error);
                                      sleep(1000);
                                      fbMessage(sender, 'If you need help with a claim, you need to contact your agent. ' +result).catch(console.error);
                                      sleep(1000);
                                      fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                                      sleep(1000);
                                      polWrapper.clearPolicyType(customerIssueObject, function(err, result){
                                        if(err){
                                          throw err;
                                        }else{
                                          console.log('Successfully cleared policy type');
                                        }
                                      });
                                      sleep(1000);
                                      polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                                        if(err){
                                          throw err;
                                        }
                                        if(result.matchedCount === 1 && result.modifiedCount === 1){
                                          console.log('Successful reset of prevIntent');
                                        }
                                      });
                                    }).run();
                                  }
                                });
                              }
                              else if(bothTypeIntents[intentIndx] === "agentIntent"){
                                polWrapper.getAutoAgent(function(err, result){
                                  if(err){
                                    throw err;
                                  }else{
                                    console.log('getAutoAgent Result is ' + result);
                                    Fiber(function() {
                                      typingBubble(sender, text).catch(console.error);
                                      sleep(1000);
                                      fbMessage(sender, result).catch(console.error);
                                      sleep(1000);
                                      fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                                      sleep(1000);
                                      polWrapper.clearPolicyType(customerIssueObject, function(err, result){
                                        if(err){
                                          throw err;
                                        }else{
                                          console.log('Successfully cleared policy type');
                                        }
                                      });
                                      sleep(1000);
                                      polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                                        if(err){
                                          throw err;
                                        }
                                        if(result.matchedCount === 1 && result.modifiedCount === 1){
                                          console.log('Successful reset of prevIntent');
                                        }
                                      });
                                    }).run();
                                  }
                                });
                              }
                              else if(bothTypeIntents[intentIndx] === "policyDiscountIntent"){
                                polWrapper.getAutoDiscounts(function(err, result){
                                  if(err){
                                    throw err;
                                  }
                                  Fiber(function() {
                                    typingBubble(sender, text).catch(console.error);
                                    sleep(1000);
                                    fbMessage(sender, result).catch(console.error);
                                    sleep(1000);
                                    fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                                    sleep(1000);
                                    polWrapper.clearPolicyType(customerIssueObject, function(err, result){
                                      if(err){
                                        throw err;
                                      }else{
                                        console.log('Successfully cleared policy type');
                                      }
                                    });
                                    sleep(1000);
                                    polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                                      if(err){
                                        throw err;
                                      }
                                      if(result.matchedCount === 1 && result.modifiedCount === 1){
                                        console.log('Successful reset of prevIntent');
                                      }
                                    });
                                  }).run();
                                });
                              }
                              else if(bothTypeIntents[intentIndx] === "effectiveDateIntent"){
                                polWrapper.autoEffectiveDate(function(err, result){
                                  if(err){
                                    throw err;
                                  }
                                  Fiber(function() {
                                    typingBubble(sender, text).catch(console.error);
                                    sleep(1000);
                                    fbMessage(sender, result).catch(console.error);
                                    sleep(1000);
                                    fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                                    sleep(1000);
                                    polWrapper.clearPolicyType(customerIssueObject, function(err, result){
                                      if(err){
                                        throw err;
                                      }else{
                                        console.log('Successfully cleared policy type');
                                      }
                                    });
                                    sleep(1000);
                                    polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                                      if(err){
                                        throw err;
                                      }
                                      if(result.matchedCount === 1 && result.modifiedCount === 1){
                                        console.log('Successful reset of prevIntent');
                                      }
                                    });
                                  }).run();
                                });
                              }
                            }
                          });
                        }
                      });
                    }
                  }
                });
              }
            });
          }
        }
      });
    }
    else if(keys.length === 1 && key === 'endConvoIntent'){
      //okay to delete the issue
      fbMessage(sender, 'Glad we could help you with your questions today. Have a nice day.').catch(console.error);
      polWrapper.setIssueSolved(customerIssueObject, function(err, result){
        if(err){
          throw err;
        }
        if(result.matchedCount === 1 && result.modifiedCount === 1){
          console.log('Successful modification of issue for customer, can now delete issue from db as conversation is resolved.');
          polWrapper.deleteIssue(customerIssueObject, function(err, result){
            if(err){
              throw err;
            }
            if(result.deletedCount === 1){
              console.log('Successfully deleted issue');
            }else{
              console.log('Issue wasn\'t deleted successfully');
            }
          });
        }else{
          console.log('Issue not found or updated');
        }
      });
    }
    else if(keys.length === 1 && key === 'keepConvoIntent'){
      //keep issue, need to solve customer issue
      Fiber(function() {
        typingBubble(sender, text).catch(console.error);
        sleep(1000);
        fbMessage(sender, 'What else could I help you with today?').catch(console.error);
      }).run();
    }
    else if(keys.length === 1 && key === 'autoIntent'){
      //need to set autoPolicy as type
      console.log('Only detected auto Intent');
      customerIssueObject.policyType = 'auto';
      polWrapper.policyTypeSetter(customerIssueObject, function(err, result){
        if(err){
          throw err;
        }else{
          console.log('Set auto policy type');
          if(result.matchedCount === 1 || result.upsertedCount === 1){
            let intentArray = [];
            let intentIndx;
            polWrapper.getPreviousIntent(customerIssueObject, function(err, result){
              if(err){
                throw err;
              }else{
                console.log('Auto Previous Result:' + result);
                if(result === ' ' || result === '' || result === null || result === 'unknown'){//no prevIntent to try and query for
                  Fiber(function() {
                    typingBubble(sender, text).catch(console.error);
                    sleep(1000);
                    fbMessage(sender, 'What about your auto policy can I help you with?').catch(console.error);
                  }).run();
                }
                else{
                  intentArray = result.split(',');
                  console.log('intent Array:' + intentArray);
                  intentIndx = getDualPolicyDuplicate(bothTypeIntents, intentArray);
                  console.log('getDualPolicyDuplicateResult: ' + intentIndx);
                  console.log('Intent to query: ' + bothTypeIntents[intentIndx]);
                  if(bothTypeIntents[intentIndx] === 'policyDeductibleIntent'){
                    polWrapper.vehicleGenericCoverages(function(err, result){
                      if(err){
                        throw err;
                      }else{
                        Fiber(function() {
                          typingBubble(sender, text).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, result).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                          polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                            if(err){
                              throw err;
                            }
                            if(result.matchedCount === 1 && result.modifiedCount === 1){
                              console.log('Successful reset of prevIntent');
                            }
                          });
                        }).run();
                      }
                    });
                  }
                  else if (bothTypeIntents[intentIndx] === 'effectiveDateIntent') {
                    polWrapper.autoEffectiveDate(function(err, result){
                      if(err){
                        throw err;
                      }else{
                        Fiber(function() {
                          typingBubble(sender, text).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, result).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                          polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                            if(err){
                              throw err;
                            }
                            if(result.matchedCount === 1 && result.modifiedCount === 1){
                              console.log('Successful reset of prevIntent');
                            }
                          });
                        }).run();
                      }
                    });
                  }
                  else if (bothTypeIntents[intentIndx] === 'enhancedCoveragesIntent') {
                    polWrapper.autoEnhancedCoverages(function(err, result){
                      if(err){
                        throw err;
                      }else{
                        // console.log('Enhanced Coverages intent ' + result);
                        Fiber(function() {
                          typingBubble(sender, text).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, result).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                          polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                            if(err){
                              throw err;
                            }
                            if(result.matchedCount === 1 && result.modifiedCount === 1){
                              console.log('Successful reset of prevIntent');
                            }
                          });
                        }).run();
                      }
                    });
                  }
                  else if (bothTypeIntents[intentIndx] === 'agentIntent') {
                    polWrapper.getAutoAgent(function(err, result){
                      if(err){
                        throw err;
                      }else{
                        console.log('getAutoAgent Result is ' + result);
                        Fiber(function() {
                          typingBubble(sender, text).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, result).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                          polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                            if(err){
                              throw err;
                            }
                            if(result.matchedCount === 1 && result.modifiedCount === 1){
                              console.log('Successful reset of prevIntent');
                            }
                          });
                        }).run();
                      }
                    });
                  }
                  else if (bothTypeIntents[intentIndx] === 'policyEndDateIntent') {
                    polWrapper.autoPolicyExpirationDate(function(err, result){
                      if(err){
                        throw err;
                      }else{
                        Fiber(function() {
                          typingBubble(sender, text).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, result).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                          polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                            if(err){
                              throw err;
                            }
                            if(result.matchedCount === 1 && result.modifiedCount === 1){
                              console.log('Successful reset of prevIntent');
                            }
                          });
                        }).run();
                      }
                    });
                  }
                  else if (bothTypeIntents[intentIndx] === 'totalPremiumIntent') {
                    polWrapper.getAutoPremium(function(err, result){
                      if(err){
                        throw err;
                      }else{
                        Fiber(function() {
                          typingBubble(sender, text).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, result).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                          polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                            if(err){
                              throw err;
                            }
                            if(result.matchedCount === 1 && result.modifiedCount === 1){
                              console.log('Successful reset of prevIntent');
                            }
                          });
                        }).run();
                      }
                    });
                  }
                  else if (bothTypeIntents[intentIndx] === 'claimIntent') {
                    polWrapper.getAutoAgent(function(err, result){
                      if(err){
                        throw err;
                      }else{
                        Fiber(function() {
                          typingBubble(sender, text).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, 'If you need to file a claim you can do so through your agent. ' + result).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                          polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                            if(err){
                              throw err;
                            }
                            if(result.matchedCount === 1 && result.modifiedCount === 1){
                              console.log('Successful reset of prevIntent');
                            }
                          });
                        }).run();
                      }
                    });
                  }
                }
              }
            });
          }
        }
      });
    }
    else if(keys.length === 1 && key === 'homeownersIntent'){
      //need to set homepolicy as type
      console.log('Only detected home policy');
      customerIssueObject.policyType = 'home';
      polWrapper.policyTypeSetter(customerIssueObject, function(err, result){
        if(err){
          throw err;
        }else{
          console.log('Set home policy type');
          if(result.matchedCount === 1 || result.upsertedCount === 1){
            let intentArray = [];
            let intentIndx;
            polWrapper.getPreviousIntent(customerIssueObject, function(err, result){
              if(err){
                throw err;
              }else{
                console.log('Home Previous Result:' + result);
                if(result === ' ' || result === '' || result === null || result === 'unknown'){//no prevIntent to try and query for
                  Fiber(function() {
                    typingBubble(sender, text).catch(console.error);
                    sleep(1000);
                    fbMessage(sender, 'What about your home policy can I help you with?').catch(console.error);
                  }).run();
                }
                //"enhancedCoveragesIntent", "policyEndDateIntent", "policyDeductibleIntent", "totalPremiumIntent", "claimIntent", "agentIntent", "policyDiscountIntent"
                else{
                  intentArray = result.split(',');
                  console.log('intent Array:' + intentArray);
                  intentIndx = getDualPolicyDuplicate(bothTypeIntents, intentArray);
                  console.log('getDualPolicyDuplicateResult: ' + intentIndx);
                  console.log('Intent to query: ' + bothTypeIntents[intentIndx]);
                  if( bothTypeIntents[intentIndx] === 'policyDeductibleIntent'){
                    polWrapper.getHomePolicyDeductible(function(err, result){
                      if(err){
                        throw err;
                      }else{
                        Fiber(function() {
                          typingBubble(sender, text).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, result).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                          polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                            if(err){
                              throw err;
                            }
                            if(result.matchedCount === 1 && result.modifiedCount === 1){
                              console.log('Successful reset of prevIntent');
                            }
                          });
                        }).run();
                      }
                    });
                  }
                  else if (bothTypeIntents[intentIndx] === 'effectiveDateIntent') {
                    polWrapper.homeownerEffectiveDate(function(err, result){
                      if(err){
                        throw err;
                      }else{
                        Fiber(function() {
                          typingBubble(sender, text).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, result).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                          polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                            if(err){
                              throw err;
                            }
                            if(result.matchedCount === 1 && result.modifiedCount === 1){
                              console.log('Successful reset of prevIntent');
                            }
                          });
                        }).run();
                      }
                    });
                  }
                  else if (bothTypeIntents[intentIndx] === 'enhancedCoveragesIntent') {
                    polWrapper.homeOwnerEnhancedCoverages(function(err, result){
                      if(err){
                        throw err;
                      }else{
                        Fiber(function() {
                          typingBubble(sender, text).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, result).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                          polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                            if(err){
                              throw err;
                            }
                            if(result.matchedCount === 1 && result.modifiedCount === 1){
                              console.log('Successful reset of prevIntent');
                            }
                          });
                        }).run();
                      }
                    });
                  }
                  else if (bothTypeIntents[intentIndx] === 'agentIntent') {
                    polWrapper.getHomeOwnerAgent(function(err, result){
                      if(err){
                        throw err;
                      }else{
                        console.log('getHomeAgent Result is ' + result);
                        Fiber(function() {
                          typingBubble(sender, text).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, result).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                          polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                            if(err){
                              throw err;
                            }
                            if(result.matchedCount === 1 && result.modifiedCount === 1){
                              console.log('Successful reset of prevIntent');
                            }
                          });
                        }).run();
                      }
                    });
                  }
                  else if (bothTypeIntents[intentIndx] === 'policyEndDateIntent') {
                    polWrapper.getHomePolicyExpirationDate(function(err, result){
                      if(err){
                        throw err;
                      }else{
                        Fiber(function() {
                          typingBubble(sender, text).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, result).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                          polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                            if(err){
                              throw err;
                            }
                            if(result.matchedCount === 1 && result.modifiedCount === 1){
                              console.log('Successful reset of prevIntent');
                            }
                          });
                        }).run();
                      }
                    });
                  }
                  else if (bothTypeIntents[intentIndx] === 'totalPremiumIntent') {
                    polWrapper.getHomeTotalPremium(function(err, result){
                      if(err){
                        throw err;
                      }else{
                        Fiber(function() {
                          typingBubble(sender, text).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, result).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                          polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                            if(err){
                              throw err;
                            }
                            if(result.matchedCount === 1 && result.modifiedCount === 1){
                              console.log('Successful reset of prevIntent');
                            }
                          });
                        }).run();
                      }
                    });
                  }
                  else if (bothTypeIntents[intentIndx] === 'claimIntent') {
                    polWrapper.getHomeOwnerAgent(function(err, result){
                      if(err){
                        throw err;
                      }else{
                        Fiber(function() {
                          typingBubble(sender, text).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, 'If you need to file a claim you can do so through your agent. ' + result).catch(console.error);
                          sleep(1000);
                          fbMessage(sender, fbConfirmationQuestion).catch(console.error);
                          polWrapper.clearPreviousIntent(customerIssueObject, function(err, result){
                            if(err){
                              throw err;
                            }
                            if(result.matchedCount === 1 && result.modifiedCount === 1){
                              console.log('Successful reset of prevIntent');
                            }
                          });
                        }).run();
                      }
                    });
                  }
                }
              }
            });
          }
        }
      });
    }
    else if(entities.hasOwnProperty('lossOfUseIntent')){
      console.log('Loss of Use intent found');
      if(entities.lossOfUseIntent[0].confidence > .50){
        console.log('High enough confidence to perform query');
        polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
          if(err){
            throw err;
          }else{
            console.log('Set customer issue object');
          }
        });
        polWrapper.getLossOfUseInfo(function(err, result){
          if(err){
            throw err;
          }
          Fiber(function() {
            typingBubble(sender, text).catch(console.error);
            sleep(1000);
            fbMessage(sender, result).catch(console.error);
            sleep(1000);
            fbMessage(sender, fbConfirmationQuestion).catch(console.error);
          }).run();
        });
      }
    }
    else if(entities.hasOwnProperty('homeMedicalCovIntent')){
      console.log('Home Medical Coverage Intent found');
      if(entities.homeMedicalCovIntent[0].confidence > .50){
        console.log('High enough confidence to perform query');
        polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
          if(err){
            throw err;
          }else{
            console.log('Set customer issue object');
          }
        });
        polWrapper.checkHomeOwnerMedicalCoverage(function(err, result){
          if(err){
            throw err;
          }
          Fiber(function() {
            typingBubble(sender, text).catch(console.error);
            sleep(1000);
            fbMessage(sender, result).catch(console.error);
            sleep(1000);
            fbMessage(sender, fbConfirmationQuestion).catch(console.error);
          }).run();
        });
      }
    }
    else if(entities.hasOwnProperty('dwellingIntent')){
      console.log('Dwelling Intent found');
      if(entities.dwellingIntent[0].confidence > .50){
        console.log('High enough confidence to perform query');
        polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
          if(err){
            throw err;
          }else{
            console.log('Set customer issue object');
          }
        });
        polWrapper.getDwellingLimit(function(err, result){
          if(err){
            throw err;
          }
          Fiber(function() {
            typingBubble(sender, text).catch(console.error);
            sleep(1000);
            fbMessage(sender, result).catch(console.error);
            sleep(1000);
            fbMessage(sender, fbConfirmationQuestion).catch(console.error);
          }).run();
        });
      }
    }
    else if(entities.hasOwnProperty('numCarsIntent')){
      console.log('# of cars Intent found');
      if(entities.numCarsIntent[0].confidence > .50){
        console.log('High enough confidence to perform query');
        polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
          if(err){
            throw err;
          }else{
            console.log('Set customer issue object');
          }
        });
        polWrapper.getNumberOfCars(function(err, result){
          if(err){
            throw err;
          }
          Fiber(function() {
            typingBubble(sender, text).catch(console.error);
            sleep(1000);
            fbMessage(sender, result).catch(console.error);
            sleep(1000);
            fbMessage(sender, fbConfirmationQuestion).catch(console.error);
          }).run();
        });
      }
    }
    else if(entities.hasOwnProperty('autoDiscountIntent')){
      console.log('autoDiscount Intent found');
      if(entities.autoDiscountIntent[0].confidence > .50){
        console.log('High enough confidence to perform query');
        polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
          if(err){
            throw err;
          }else{
            console.log('Set customer issue object');
          }
        });
        polWrapper.getAutoDiscounts(function(err, result){
          if(err){
            throw err;
          }
          Fiber(function() {
            typingBubble(sender, text).catch(console.error);
            sleep(1000);
            fbMessage(sender, result).catch(console.error);
            sleep(1000);
            fbMessage(sender, fbConfirmationQuestion).catch(console.error);
          }).run();
        });
      }
    }
    else if(entities.hasOwnProperty('SpecialtyProgramsIntent')){
      console.log('Specialty Discount Intent found');
      if(entities.SpecialtyProgramsIntent[0].confidence > .50){
        console.log('High enough confidence to perform query');
        polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
          if(err){
            throw err;
          }else{
            console.log('Set customer issue object');
          }
        });
        polWrapper.checkHomeSpecialtyProgram(function(err, result){
          if(err){
            throw err;
          }
          Fiber(function() {
            typingBubble(sender, text).catch(console.error);
            sleep(1000);
            fbMessage(sender, result).catch(console.error);
            sleep(1000);
            fbMessage(sender, fbConfirmationQuestion).catch(console.error);
          }).run();
        });
      }
    }
    else if(entities.hasOwnProperty('personalLiabilityIntent')){
      console.log('Personal liability Intent found');
      if(entities.personalLiabilityIntent[0].confidence > .50){
        console.log('High enough confidence to perform query');
        polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
          if(err){
            throw err;
          }else{
            console.log('Set customer issue object');
          }
        });
        polWrapper.getPersonalLiabilityInfo(function(err, result){
          if(err){
            throw err;
          }
          Fiber(function() {
            typingBubble(sender, text).catch(console.error);
            sleep(1000);
            fbMessage(sender, result).catch(console.error);
            sleep(1000);
            fbMessage(sender, fbConfirmationQuestion).catch(console.error);
          }).run();
        });
      }
    }
    else if(entities.hasOwnProperty('personalPropertyIntent')){
      console.log('Personal Property Intent found');
      if(entities.personalPropertyIntent[0].confidence > .50){
        console.log('High enough confidence to perform query');
        polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
          if(err){
            throw err;
          }else{
            console.log('Set customer issue object');
          }
        });
        polWrapper.getPersonalPropertyInfo(function(err, result){
          if(err){
            throw err;
          }
          Fiber(function() {
            typingBubble(sender, text).catch(console.error);
            sleep(1000);
            fbMessage(sender, result).catch(console.error);
            sleep(1000);
            fbMessage(sender, fbConfirmationQuestion).catch(console.error);
          }).run();
        });
      }
    }
    else if(entities.hasOwnProperty('driverIntent')){
      console.log('Driver Intent found');
      if(entities.driverIntent[0].confidence > .50){
        console.log('High enough confidence to perform query');
        polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
          if(err){
            throw err;
          }else{
            console.log('Set customer issue object');
          }
        });
        polWrapper.getAutoDrivers(function(err, result){
          if(err){
            throw err;
          }
          Fiber(function() {
            typingBubble(sender, text).catch(console.error);
            sleep(1000);
            fbMessage(sender, result).catch(console.error);
            sleep(1000);
            fbMessage(sender, fbConfirmationQuestion).catch(console.error);
          }).run();
        });
      }
    }
    else if(entities.hasOwnProperty('getCarsIntent')){
      console.log('Get Cars Intent found');
      if(entities.getCarsIntent[0].confidence > .50){
        console.log('High enough confidence to perform query');
        polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
          if(err){
            throw err;
          }else{
            console.log('Set customer issue object');
          }
        });
        polWrapper.getCarsUnderPolicy(function(err, result){
          if(err){
            throw err;
          }
          Fiber(function() {
            typingBubble(sender, text).catch(console.error);
            sleep(1000);
            fbMessage(sender, result).catch(console.error);
            sleep(1000);
            fbMessage(sender, fbConfirmationQuestion).catch(console.error);
          }).run();
        });
      }
    }
    else if(entities.hasOwnProperty('vehicleDiscounts')){
      console.log('Vehicle discounts intent');
      if(entities.vehicleDiscounts[0].confidence > .50){
        console.log('High enough confidence to perform query.');
        polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
          if(err){
            throw err;
          }else{
            console.log('Set customer issue object');
          }
        });
        polWrapper.getVehicleDiscounts(function(err, result){
          if(err){
            throw err;
          }else{
            console.log('Vehicle discounts ' + result);
            Fiber(function() {
              typingBubble(sender, text).catch(console.error);
              sleep(1000);
              fbMessage(sender, result).catch(console.error);
              sleep(1000);
              fbMessage(sender, fbConfirmationQuestion).catch(console.error);
            }).run();
          }
        });
      }
    }
    else if(entities.hasOwnProperty('vehicleGenericCoverages')){
      console.log('Vehicle generic coverages ');
      if(entities.vehicleGenericCoverages[0].confidence > .50){
        console.log('High enough confidence to perform query.');
        polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
          if(err){
            throw err;
          }else{
            console.log('Set customer issue object');
          }
        });
        polWrapper.vehicleGenericCoverages(function(err, result){
          if(err){
            throw err;
          }else{
            console.log('Vehicle generic coverages ' + result);
            Fiber(function() {
              typingBubble(sender, text).catch(console.error);
              sleep(1000);
              fbMessage(sender, result).catch(console.error);
              sleep(1000);
              fbMessage(sender, fbConfirmationQuestion).catch(console.error);
            }).run();
          }
        });
      }
    }
    else if(entities.hasOwnProperty('lineOfBusinessIntent')){
      console.log('Line of Business Intent ');
      if(entities.lineOfBusinessIntent[0].confidence > .50){
        console.log('High enough confidence to perform query.');
        polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
          if(err){
            throw err;
          }else{
            console.log('Set customer issue object');
          }
        });
        polWrapper.lineOfBusiness(function(err, result){
          if(err){
            throw err;
          }else{
            console.log('Line of business ' + result);
            Fiber(function() {
              typingBubble(sender, text).catch(console.error);
              sleep(1000);
              fbMessage(sender, result).catch(console.error);
              sleep(1000);
              fbMessage(sender, fbConfirmationQuestion).catch(console.error);
            }).run();
          }
        });
      }
    }

    else if(entities.hasOwnProperty('vinNumIntent')){
      console.log('Vin number intent found ');
      if(entities.vinNumIntent[0].confidence > .50){
        console.log('High enough confidence to perform query.');
        polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
          if(err){
            throw err;
          }else{
            console.log('Set customer issue object');
          }
        });
        polWrapper.getVinNumber(function(err, result){
          if(err){
            throw err;
          }else{
            console.log('Vehicle vin number ' + result);
            Fiber(function() {
              typingBubble(sender, text).catch(console.error);
              sleep(1000);
              fbMessage(sender, result).catch(console.error);
              sleep(1000);
              fbMessage(sender, fbConfirmationQuestion).catch(console.error);
            }).run();
          }
        });
      }
    }
    else if(entities.hasOwnProperty('easyPayIntent')){
      console.log('Easy pay Intent found ');
      if(entities.easyPayIntent[0].confidence > .50){
        console.log('High enough confidence to perform query.');
        polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
          if(err){
            throw err;
          }else{
            console.log('Set customer issue object');
          }
        });
        polWrapper.easyPay(function(err, result){
          if(err){
            throw err;
          }else{
            console.log('Easy pay result ' + result);
            Fiber(function() {
              typingBubble(sender, text).catch(console.error);
              sleep(1000);
              fbMessage(sender, result).catch(console.error);
              sleep(1000);
              fbMessage(sender, fbConfirmationQuestion).catch(console.error);
            }).run();
          }
        });
      }
    }
    else if(entities.hasOwnProperty('fullAutoCoverage')){
        console.log('Full auto coverage found');
        if(entities.fullAutoCoverage[0].confidence > .75){
          polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
            if(err){
              throw err;
            }else{
              console.log('Set customer issue object');
            }
          });
          polWrapper.fullAutoCoverage(function(err, result){
            if(err){
              throw err;
            }
            Fiber(function() {
              typingBubble(sender, text).catch(console.error);
              sleep(1000);
              fbMessage(sender, result).catch(console.error);
              sleep(1000);
              fbMessage(sender, fbConfirmationQuestion).catch(console.error);
            }).run();
          });
        }
      }
      else if(entities.hasOwnProperty('glassClaim')){
        console.log('Glass claim coverages found');
        if(entities.glassClaim[0].confidence > .75){
          polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
            if(err){
              throw err;
            }else{
              console.log('Set customer issue object');
            }
          });
          polWrapper.glassClaim(function(err, result){
            if(err){
              throw err;
            }
            Fiber(function() {
              typingBubble(sender, text).catch(console.error);
              sleep(1000);
              fbMessage(sender, result).catch(console.error);
              sleep(1000);
              fbMessage(sender, fbConfirmationQuestion).catch(console.error);
            }).run();
          });
        }
      }

      else if(entities.hasOwnProperty('getLoanNumber')){
        console.log('Glass claim coverages found');
        if(entities.getLoanNumber[0].confidence > .75){
          polWrapper.setCustomerIssue(customerIssueObject, function(err, result){
            if(err){
              throw err;
            }else{
              console.log('Set customer issue object');
            }
          });
          polWrapper.getLoanNumber(function(err, result){
            if(err){
              throw err;
            }
            Fiber(function() {
              typingBubble(sender, text).catch(console.error);
              sleep(1000);
              fbMessage(sender, result).catch(console.error);
              sleep(1000);
              fbMessage(sender, fbConfirmationQuestion).catch(console.error);
            }).run();
          });
        }
      }
    //Greeting Intent
    else if(entities.hasOwnProperty('greetingIntent')){
      if(keys.length === 1){
        console.log('Believe to have gotten greeting intent');
        request({
          url: "https://graph.facebook.com/v2.6/" + sender,
          qs: {
            access_token: process.env.VERIFICATION_TOKEN,
            fields: "first_name"
          },
          method: "GET"
        }, function(error, response, body) {
          var greeting = "";
          if (error) {
            console.log("Error getting user's name: " +  error);
          } else {
            var bodyObj = JSON.parse(body);
            name = bodyObj.first_name;
            greeting = "Hi " + name + ". ";
          }
          var message = greeting + "My name is AgentAI. I can tell you various details regarding your CIG policies. What questions about your policy can I help you with today?";
          fbMessage(sender, message).catch(console.error);
        });
      }
      else if(!keys.some(r => bothTypeIntents.includes(r)) && !keys.some(r2 => homeIntents.includes(r2)) && !keys.some(r3 => autoIntents.includes(r3))){
        request({
          url: "https://graph.facebook.com/v2.6/" + sender,
          qs: {
            access_token: process.env.VERIFICATION_TOKEN,
            fields: "first_name"
          },
          method: "GET"
        }, function(error, response, body) {
          var greeting = "";
          if (error) {
            console.log("Error getting user's name: " +  error);
          } else {
            var bodyObj = JSON.parse(body);
            name = bodyObj.first_name;
            greeting = "Hi " + name + ". ";
          }
          var message = greeting + "My name is AgentAI. I can tell you various details regarding your CIG policies. What questions about your policy can I help you with today?";
          fbMessage(sender, message).catch(console.error);
        });
      }
    }
  }
  //Believed to not have fully understood
  else if(keys.includes('message_body') && keys.length === 1){//Believed to not have fully understood
    console.log('Intents are not clear enough, need to ask for clarification.');
    Fiber(function() {
      typingBubble(sender, text).catch(console.error);
      sleep(1000);
      fbMessage(sender, 'We couldn\'t quite understand what you asked. Could please rephrase the question you need help with.').catch(console.error);
      sleep(1000);
      // fbMessage(sender, 'This should be sent after the response.').catch(console.error);
    }).run();
  }
}
