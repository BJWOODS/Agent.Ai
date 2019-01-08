//requirements
const MongoClient = require('mongodb').MongoClient;
//-------------------------------------------------

//environment variables
const uri = process.env.MONGO_DB_URI;
//-------------------------------------------------

//variables
const db_name = 'aiTestData';
//-------------------------------------------------

function PolicyWrapper(uri){
  this.db_uri = uri;
}
PolicyWrapper.prototype.getUserProfileInformation = function(callback){
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection');
    }

    var db = client.db(db_name);
    db.collection('aiData', function (err, collection){
      collection.find({}).project({'profile': 1}).toArray(function(err, docs){
        if(err){
          throw err;
        }else{
          console.log(docs);
          console.log(docs.length);
          for(var i = 0; i < docs.length; i++){
            var docObject = docs[i];
            var response = 'Thank you for checking in on your profile information. ';
            response += 'The name we have for your profile is ' + docObject.profile.firstName + ' ' + docObject.profile.lastName;
            response += ', and the email address on file is ' + docObject.profile.emailAddress;
            console.log(response);
            // return response;
            callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}

PolicyWrapper.prototype.getHomeOwnerAgent = function(callback){
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection')
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection) {
      collection.find({}).project({'policies': 1}).toArray(function (err, docs){
        if(err){
          throw err;
        }else{
          var agentObject = {};
          for(var i  = 0; i < docs.length; i++){
            var docObject = docs[i];
            agentObject = docObject.policies['1-HOC-1-1394462794'].agent;
            var response = 'The agent that covers your policy is ' + agentObject.name + '.';
            response += ' They can be reached at ' + agentObject.phone + ' .';
            console.log(response);
            callback(err, response);
            // return response;
          }
        }
      });
      client.close();
    });
  });
}

PolicyWrapper.prototype.getHomePolicyExpirationDate = function(callback) {
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection')
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection) {
      collection.find({}).project({'policies': 1}).toArray(function (err, docs){
        if(err){
          throw err;
        }else{
          for(var i  = 0; i < docs.length; i++){
            var docObject = docs[i];
            var expDate = docObject.policies['1-HOC-1-1394462794'].expirationDate;
            var response = 'The end date for your policy is ' + expDate;
            console.log(response);
            // return response;
            callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}

PolicyWrapper.prototype.getHomePolicyNameInsured = function(callback) {
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection')
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection) {
      collection.find({}).project({'policies': 1}).toArray(function (err, docs){
        if(err){
          throw err;
        }else{
          for(var i  = 0; i < docs.length; i++){
            var docObject = docs[i];
            var insuredName = docObject.policies['1-HOC-1-1394462794'].namedInsured;
            var response = 'The name of the person on the policy is ' + insuredName +'.';
            console.log(response);
            // return response;
            callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}

PolicyWrapper.prototype.checkHomeOptionalCoverages = function(callback) {
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection')
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection) {
      collection.find({}).project({'policies': 1}).toArray(function (err, docs){
        if(err){
          throw err;
        }else{
          for(var i  = 0; i < docs.length; i++){
            var docObject = docs[i];
            var basicCoverageObject = docObject.policies['1-HOC-1-1394462794']['basic coverage'];
            // console.log(basicCoverageObject);
            var optionalCoverages = basicCoverageObject.basicCoverage.optionalCoverages;
            // console.log(optionalCoverages);
            // console.log(optionalCoverages === '$0.00');
            if(optionalCoverages === '$0.00'){
              var response = 'There are no optional coverages under this policy';
              console.log(response);
              // return response;
              callback(err, response);
            }else{
              var response = 'There are optional coverages under this policy.';
              console.log(response);
              // return response;
              callback(err, response);
            }
          }
        }
      });
      client.close();
    });
  });
}

PolicyWrapper.prototype.checkHomeSpecialtyProgram = function(callback) {
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection')
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection) {
      collection.find({}).project({'policies': 1}).toArray(function (err, docs){
        if(err){
          throw err;
        }else{
          for(var i  = 0; i < docs.length; i++){
            var docObject = docs[i];
            var specialtyProgramObject = docObject.policies['1-HOC-1-1394462794'].specialtyProgram;
            // console.log(specialtyProgramObject);
            if(specialtyProgramObject.programName === 'Not Applicable'){
              var response = 'Sorry. We have found no specialty programs under this policy. ';
              console.log(response);
              // return response;
              callback(err, response);
            }else{
              var response = 'We have you under our ' + specialtyProgramObject.programName;
              response += '. The premium under that plan is ' + specialtyProgramObject.premium;
              console.log(response);
              // return response;
              callback(err, response);
            }
          }
        }
      });
      client.close();
    });
  });
}

PolicyWrapper.prototype.checkHomeOwnerMedicalCoverage = function(callback) {
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection')
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection) {
      collection.find({}).project({'policies': 1}).toArray(function (err, docs){
        if(err){
          throw err;
        }else{
          for(var i  = 0; i < docs.length; i++){
            var docObject = docs[i];
            var medicalPaymentsObject = docObject.policies['1-HOC-1-1394462794']['basic coverage'].basicCoverage.medicalPayments;
            console.log(medicalPaymentsObject);
            if(medicalPaymentsObject.limit === '$0.00'){
              var response = 'Sorry this policy does not seem to have medical coverage. ';
              console.log(response);
              // return response;
              callback(err, response);
            }else{
              var response = 'This policy does have medical coverage. The limit that the medical payment will cover is ' + medicalPaymentsObject.limit + '.';
              console.log(response);
              // return response;
              callback(err, response);
            }
          }
        }
      });
      client.close();
    });
  });
}

//Deductible function
PolicyWrapper.prototype.getHomePolicyDeductible = function(callback){
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection');
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection){
      collection.find({}).project({'policies': 1}).toArray(function(err,docs){
        if(err){
          throw err;
        }else{
          for(var i = 0; i < docs.length; i++){
            var docObject = docs[i];
            var policyDeductible = docObject.policies['1-HOC-1-1394462794']['basic coverage'].basicCoverage.policyDeductible;
            var response = 'The deductible for this policy is ' + policyDeductible + '.';
            console.log(response);
            // return response;
            callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}
//------------------------------------------------------------------------------

//Premium functions

//total Premium
PolicyWrapper.prototype.getHomeTotalPremium = function(callback){
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection');
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection){
      collection.find({}).project({'policies': 1}).toArray(function(err,docs){
        if(err){
          throw err;
        }else{
          for(var i = 0; i < docs.length; i++){
            var docObject = docs[i];
            var totPremium = docObject.policies['1-HOC-1-1394462794']['basic coverage'].basicCoverage.totalPremium;
            var response = 'The total Premium for this policy is ' + totPremium + '.';
            console.log(response);
            // return response;
            callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}
//basic premium
PolicyWrapper.prototype.getHomeBasicPremium = function(callback){
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection');
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection){
      collection.find({}).project({'policies': 1}).toArray(function(err,docs){
        if(err){
          throw err;
        }else{
          for(var i = 0; i < docs.length; i++){
            var docObject = docs[i];
            var basicPremium = docObject.policies['1-HOC-1-1394462794']['basic coverage'].basicCoverage.basicPremium;
            var response = 'The basic Premium for this policy is ' + basicPremium + '.';
            console.log(response);
            // return response;
            callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}
//------------------------------------------------------------------------------

//basicCoverage functions, dwelling/otherStructures/personalProperty/lossOfUse/personalLiability
//get DwellingInformation
PolicyWrapper.prototype.getDwellingLimit = function(callback){
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection');
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection){
      collection.find({}).project({'policies': 1}).toArray(function(err,docs){
        if(err){
          throw err;
        }else{
          for(var i = 0; i < docs.length; i++){
            var docObject = docs[i];
            var dwellingObject = docObject.policies['1-HOC-1-1394462794']['basic coverage'].basicCoverage.dwelling;
            var response = 'The value of the home on this policy is ' + dwellingObject.limit + '.';
            console.log(response);
            // return response;
            callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}
//get otherPropertyInformation
PolicyWrapper.prototype.getOtherStructuresInfo = function(callback){
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection');
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection){
      collection.find({}).project({'policies': 1}).toArray(function(err,docs){
        if(err){
          throw err;
        }else{
          for(var i = 0; i < docs.length; i++){
            var docObject = docs[i];
            var otherStructuresObject = docObject.policies['1-HOC-1-1394462794']['basic coverage'].basicCoverage.otherStructures;
            var response = 'The value of all the other structures on this policy are valued at ' + otherStructuresObject.limit + '.';
            console.log(response);
            // return response;
            callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}
//get personalPropInfo
PolicyWrapper.prototype.getPersonalPropertyInfo = function(callback){
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection');
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection){
      collection.find({}).project({'policies': 1}).toArray(function(err,docs){
        if(err){
          throw err;
        }else{
          for(var i = 0; i < docs.length; i++){
            var docObject = docs[i];
            var personalPropertyObject = docObject.policies['1-HOC-1-1394462794']['basic coverage'].basicCoverage.personalProperty;
            var response = 'The coverage provided by CIG for the personal property on this policy amounts to ' + personalPropertyObject.limit + '.';
            console.log(response);
            // return response;
            callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}
//get lossOfUse Info
PolicyWrapper.prototype.getLossOfUseInfo = function(callback){
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection');
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection){
      collection.find({}).project({'policies': 1}).toArray(function(err,docs){
        if(err){
          throw err;
        }else{
          for(var i = 0; i < docs.length; i++){
            var docObject = docs[i];
            var lossOfUseObject = docObject.policies['1-HOC-1-1394462794']['basic coverage'].basicCoverage.lossOfUse;
            // var response = 'The loss of use on this policy amounts to ' + lossOfUseObject.limit + '.';
            // console.log(response);
            // // return response;
            // callback(null, response);
            if(lossOfUseObject.limit === ""){
              var response = 'Sorry you are not covered for loss of use on this policy.';
              console.log(response);
              callback(err, response);
            }else{
              var response = 'You are covered for loss of use on this policy. ';
              response += 'The loss of use on this policy amounts to ' + lossOfUseObject.limit + '.';
              console.log(response);
              // return response;
              callback(err, response);
            }
          }
        }
      });
      client.close();
    });
  });
}
//get personalLiability Info
PolicyWrapper.prototype.getPersonalLiabilityInfo = function(callback){
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection');
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection){
      collection.find({}).project({'policies': 1}).toArray(function(err,docs){
        if(err){
          throw err;
        }else{
          for(var i = 0; i < docs.length; i++){
            var docObject = docs[i];
            var personalLiabilityObject = docObject.policies['1-HOC-1-1394462794']['basic coverage'].basicCoverage.personalLiability;
            var response = 'The amount you are covered for in regards to personal liability is ' + personalLiabilityObject.limit + '.';
            console.log(response);
            // return response;
            callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}
//Homeowner Enhanced Coverages
PolicyWrapper.prototype.homeOwnerEnhancedCoverages = function(callback) {
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection')
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection) {
      collection.find({}).project({'policies': 1}).toArray(function (err, docs){
        if(err){
          throw err;
        }else{
          for(var i = 0; i < docs.length; i++){
            var eCoverages = docs[i].policies['1-HOC-1-1394462794'].enhancedCoverages;
            if(eCoverages == "")
            {
              var response = 'You do not have enhanced coverages ';
              callback(err, response);
            }
            else {
              var response = 'You have enhanced coverages. Dollar amount: ' + eCoverages;
              callback(err, response);
            }
            console.log(response);
            // return response;

          }
        }
      });
      client.close();
    });
  });
}
PolicyWrapper.prototype.homeownerEffectiveDate = function(callback) {
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection')
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection) {
      collection.find({}).project({'policies': 1}).toArray(function (err, docs){
        if(err){
          throw err;
        }else{
          for(var i = 0; i < docs.length; i++){
            var date = docs[i].policies['1-HOC-1-1394462794'].effectiveDate;
            var response = 'You have been insured since ' + date + '.';
            console.log(response);
            // return response;
            callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}
//------------------------------------------------------------------------------
//AUTO Intents

//get cars on policy
PolicyWrapper.prototype.getCarsUnderPolicy = function(callback) {
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection')
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection) {
      collection.find({}).project({'policies': 1}).toArray(function (err, docs){
        if(err){
          throw err;
        }else{
          for(var i  = 0; i < docs.length; i++){
            var vehicles = docs[i].policies['1-PAC-1-200711458641'].vehicles;
            var response = '';
            if(vehicles.length > 0){
              response += 'The ' + vehicles[0].year + ' ' + vehicles[0].make + ' ' + vehicles[0].model;
              for(var j = 1; j < vehicles.length; j++) response += ', ' + vehicles[j].year + ' ' + vehicles[j].make + ' ' + vehicles[j].model + ' ';
              response += ' are under this policy';
            }
            else{
              response += 'There are no vehicles under this polcicy';
            }
            response += '.'
            console.log(response);
            callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}

//get drivers under policy
PolicyWrapper.prototype.getAutoDrivers = function(callback) {
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection')
  }
  var db = client.db(db_name);
  db.collection('aiData', function(err, collection) {
    collection.find({}).project({'policies': 1}).toArray(function (err, docs){
      if(err){
        throw err;
      }else{
        var response = 'The names of the drivers on this policy are ';
        for(var i = 0; i < docs.length; i++){
          var drivers = docs[i].policies['1-PAC-1-200711458641'].drivers;
          for(var j = 0; j < drivers.length; j++){
            if(j === drivers.length-1){
              response += drivers[j].name + '.';
            }else{
              response += drivers[j].name + ', ';
            }
          }
          callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}

//get autoAgent
PolicyWrapper.prototype.getAutoAgent = function(callback){
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection')
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection) {
      collection.find({}).project({'policies': 1}).toArray(function (err, docs){
        if(err){
          throw err;
        }else{
          var agentObject = {};
          for(var i  = 0; i < docs.length; i++){
            var docObject = docs[i];
            agentObject = docObject.policies['1-PAC-1-200711458641'].agent;
            var response = 'The agent that covers your policy is ' + agentObject.name + '.';
            response += ' They can be reached at ' + agentObject.phone + ' .';
            console.log(response);
            callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}

//Auto policy Premium function
PolicyWrapper.prototype.getAutoPremium = function(callback) {
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection')
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection) {
      collection.find({}).project({'policies': 1}).toArray(function (err, docs){
        if(err){
          throw err;
        }else{
          for(var i  = 0; i < docs.length; i++){
            var premium = docs[i].policies['1-PAC-1-200711458641'].totalTermPremium;
            var response = 'The premium on this policy is ' + premium + '.'
            console.log(response);
            // return response;
            callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}

//get AutoCoverageTypes
PolicyWrapper.prototype.getAutoCoverageTypes = function(callback) {
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection')
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection) {
      collection.find({}).project({'policies': 1}).toArray(function (err, docs){
        if(err){
          throw err;
        }else{
          var response = 'The general coverages on this policy are ';
          for(var i  = 0; i < docs.length; i++){
            var coverages = docs[i].policies['1-PAC-1-200711458641'].policyGenericCoverages;
            for(var j = 0; j < coverages.length; j++){
              if(j === coverages.length-1){
                response += coverages[j].label + ', and the limit for this coverage is ' +coverages[j].limitsDed+ '. ';
              }else{
                response += coverages[j].label + ', and the limit for this coverage is ' +coverages[j].limitsDed+ ', ';
              }
            }
          }
          console.log(response);
          callback(err, response);
        }
      });
      client.close();
    });
  });
}

//autoPolicyDiscounts
PolicyWrapper.prototype.getAutoDiscounts = function(callback) {
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection')
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection) {
      collection.find({}).project({'policies': 1}).toArray(function (err, docs){
        if(err){
          throw err;
        }else{
          var response = '';
          for(var i  = 0; i < docs.length; i++){
            var discounts = docs[i].policies['1-PAC-1-200711458641'].policyDiscounts;
            if(discounts == ""){
              response = 'There are no discounts on this policy';
            }
            else{
              response = 'The discount on this policy is ' + discounts;
            }
            response += '.';
            console.log(response);
            // return response;
            callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}

// # Of Cars on my policy
PolicyWrapper.prototype.getNumberOfCars = function(callback) {
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection')
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection) {
      collection.find({}).project({'policies': 1}).toArray(function (err, docs){
        if(err){
          throw err;
        }else{
          for(var i  = 0; i < docs.length; i++){
            var num = docs[i].policies['1-PAC-1-200711458641'].vehicles.length;
            var response = 'The are ' + num + ' cars on this policy.'
            console.log(response);
            // return response;
            callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}


//AutoPolicy Expiration date
PolicyWrapper.prototype.autoPolicyExpirationDate = function(callback) {
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection')
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection) {
      collection.find({}).project({'policies': 1}).toArray(function (err, docs){
        if(err){
          throw err;
        }else{
          for(var i  = 0; i < docs.length; i++){
            var expirationDate = docs[i].policies['1-PAC-1-200711458641'].expirationDate;
            var response = 'Your auto policy is valid until ' + expirationDate + '.'
            console.log(response);
            // return response;
            callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}

//AutoPolicy Claims List
PolicyWrapper.prototype.getAutoClaimsList = function(callback){
  MongoClient.connect(this.db_uri, function(err,client){
    if(err){
      throw err;
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection){
      collection.find({}).project({'policies': 1}).toArray(function(err, docs){
        if(err){
          throw err;
        }
        var response = 'The list of claims and their statuses are ';
        for(var i = 0; i < docs.length; i++){
          var claimsList = docs[i].policies['1-PAC-1-200711458641'].claimsList;
          for(var j = 0; j < claimsList.length; j++){
            if(j === claimsList.length - 1){
              response += 'claim number ' + claimsList[j].claimNumber + ' and the status of this claim is ' + claimsList[j].claimStatus + '.';
            }else{
              response += 'claim number ' + claimsList[j].claimNumber + ' and the status of this claim is ' + claimsList[j].claimStatus + ', ';
            }
          }
        }
        callback(err, response);
      });
    });
  });
}

PolicyWrapper.prototype.getVehicleDiscounts = function(callback) {
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection')
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection) {
      collection.find({}).project({'policies': 1}).toArray(function (err, docs){
        if(err){
          throw err;
        }else{
          for(var i = 0; i < docs.length; i++){
            var discount = docs[i].policies['1-PAC-1-200711458641'].vehicles[i].discounts;
            var response = "Your vehicle discount includes ";
            for(var j = 0; j < discount.length; j++)
            {
              if(j === discount.length - 1)
                response += discount[j].discount + ". ";
              else {
                response += discount[j].discount + ", ";
              }
            }
            console.log(response);
            // return response;
            callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}
PolicyWrapper.prototype.vehicleGenericCoverages = function(callback) {
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection')
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection) {
      collection.find({}).project({'policies': 1}).toArray(function (err, docs){
        if(err){
          throw err;
        }else{
          var response = '';
          for(var i = 0; i < docs.length; i++){
            var coverages = docs[i].policies['1-PAC-1-200711458641'].vehicles[0].vehicleGenericCoverages;
            for(var j =0; j < coverages.length; j++)
            {
            response += 'Your covered in case of ' + coverages[j].label + '.' + 'With a deductible of ' + coverages[j].limitsDed;
            }
            console.log(response);
            // return response;
            callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}
PolicyWrapper.prototype.getVinNumber = function(callback) {
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection')
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection) {
      collection.find({}).project({'policies': 1}).toArray(function (err, docs){
        if(err){
          throw err;
        }else{
          for(var i = 0; i < docs.length; i++){
            var vehicles = docs[i].policies['1-PAC-1-200711458641'].vehicles;
            var response = 'The vin numbers on file are ';
            for(var j = 0; j < vehicles.length; j++)
            {
              if(j === vehicles.length - 1)
              {
                response += vehicles[j].vin + ". ";
              }
              else {
                response += vehicles[j].vin + ", ";
              }
            }

            console.log(response);
            // return response;
            callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}
PolicyWrapper.prototype.lineOfBusiness = function(callback) {
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection')
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection) {
      collection.find({}).project({'policies': 1}).toArray(function (err, docs){
        if(err){
          throw err;
        }else{
          for(var i = 0; i < docs.length; i++){
            var business = docs[i].policies['1-PAC-1-200711458641'].lineOfBusiness;
            var response = 'Your account currently shows your vehicle as a ' + business +'.';
            console.log(response);
            // return response;
            callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}
PolicyWrapper.prototype.autoEffectiveDate = function(callback) {
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection')
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection) {
      collection.find({}).project({'policies': 1}).toArray(function (err, docs){
        if(err){
          throw err;
        }else{
          for(var i = 0; i < docs.length; i++){
            var date = docs[i].policies['1-PAC-1-200711458641'].effectiveDate;
            var response = 'You have been insured since ' + date + '.';
            console.log(response);
            // return response;
            callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}
PolicyWrapper.prototype.easyPay = function(callback) {
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection')
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection) {
      collection.find({}).project({'policies': 1}).toArray(function (err, docs){
        if(err){
          throw err;
        }else{
          for(var i = 0; i < docs.length; i++){
            var ePay = docs[i].policies['1-PAC-1-200711458641'].isEnrolledInEasyPay;
            if(ePay == 'false')
            {
              var response = 'You are not enrolled in easy pay. Sign up here: https://webapp.ciginsurance.com/PolicyInquiry/Login/Login.aspx?ReturnUrl=%2fpolicyinquiry%2fpolicyholder%2fdefault.aspx';
            }
            else {
              var response = 'You are already enrolled in easy pay. '
            }
            console.log(response);
            // return response;
            callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}

PolicyWrapper.prototype.autoEnhancedCoverages = function(callback) {
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection')
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection) {
      collection.find({}).project({'policies': 1}).toArray(function (err, docs){
        if(err){
          throw err;
        }else{
          for(var i = 0; i < docs.length; i++){
            var eCoverages = docs[i].policies['1-PAC-1-200711458641'].enhancedCoverages;
            if(eCoverages == "")
            {
              var response = 'You do not have enhanced coverages ';
              callback(err, response);
            }
            else {
              var response = 'You have enhanced coverages. Dollar amount: ' + eCoverages;
              callback(err, response);
            }
            console.log(response);
            // return response;

          }
        }
      });
      client.close();
    });
  });
}

PolicyWrapper.prototype.glassClaim = function(callback) {
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection')
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection) {
      collection.find({}).project({'policies': 1}).toArray(function (err, docs){
        if(err){
          throw err;
        }else{
          for(var i = 0; i < docs.length; i++){
            var qualify = docs[i].policies['1-PAC-1-200711458641'].isQualifyGlassClaimUnlisted;
            if(qualify == 'false')
            {
              var response = 'You are not covered under glass claims.';
            }
            else {
              var response = 'You are covered for glass claims. ';
            }
            console.log(response);
            // return response;
            callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}
//auto loan number
PolicyWrapper.prototype.getLoanNumber = function(callback) {
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection')
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection) {
      collection.find({}).project({'policies': 1}).toArray(function (err, docs){
        if(err){
          throw err;
        }else{
          for(var i  = 0; i < docs.length; i++){
            var vehicles = docs[i].policies['1-PAC-1-200711458641'].vehicles;
            var response = '';
            if(vehicles.length > 0){
              response += 'The respective loan number(s): ' + vehicles[0].loanNumber;
              for(var j = 1; j < vehicles.length; j++) response += ', ' + vehicles[j].loanNumber;
              response += ' are under this policy';
            }
            else{
              response += 'You have no vehicle loan numbers available';
            }
            response += '.'
            console.log(response);
            callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}
PolicyWrapper.prototype.fullAutoCoverage = function(callback) {
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }else{
      console.log('Successful database connection')
    }
    var db = client.db(db_name);
    db.collection('aiData', function(err, collection) {
      collection.find({}).project({'policies': 1}).toArray(function (err, docs){
        if(err){
          throw err;
        }else{
          for(var i = 0; i < docs.length; i++){
            var qualify = docs[i].policies['1-PAC-1-200711458641'].isQualifyFullAutoUnlisted;
            if(qualify == 'false')
            {
              var response = 'You are not covered under glass claims.';
            }
            else {
              var response = 'You are covered for glass claims. ';
            }
            console.log(response);
            // return response;
            callback(err, response);
          }
        }
      });
      client.close();
    });
  });
}
//------------------------------------------------------------------------------

//MESSAGES COLLECTION FUNCTIONS

// set Issues for conversation flow, updateOne Test
PolicyWrapper.prototype.setCustomerIssue = function(senderInfo, callback){
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }
    var db = client.db(db_name);
    db.collection('messages', function(err, collection){
      collection.updateOne({_id: senderInfo.id},
        {$set: {_id: senderInfo.id, prev: senderInfo.previous, policyType: senderInfo.policyType, 'issue.text': senderInfo.issues.text, 'issue.context': senderInfo.issues.intents, 'issue.solveFlag': false}},
        {upsert: true}, function(err, result){
          if(err){
            throw err;
          }else{
            console.log(result);
            callback(null, result);
          }
        });
    });
  });
}

PolicyWrapper.prototype.setIssueSolved = function(senderInfo, callback){
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }
    var db = client.db(db_name);
    db.collection('messages', function(err, collection){
      collection.updateOne({_id: senderInfo.id},
        {$set: {'issue.solveFlag': true}},
        {upsert: true}, function(err, result){
          if(err){
            throw err;
          }
          console.log('Matched Count: ' + result.matchedCount);
          console.log('Modified Count: ' + result.modifiedCount);
          callback(err, result);
      });
    });
  });
}

PolicyWrapper.prototype.deleteIssue = function(senderInfo, callback){
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }
    var db = client.db(db_name);
    db.collection('messages', function(err, collection){
      collection.deleteOne({_id: senderInfo.id, 'issue.solveFlag': true}, function(err, result){
        if(err){
          throw err;
        }
        console.log(result);
        callback(err, result);
      });
    });
  });
}

PolicyWrapper.prototype.policyTypeSetter = function(senderInfo, callback){
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }
    var db = client.db(db_name);
    db.collection('messages', function(err, collection){
      collection.updateOne({_id: senderInfo.id},
        {$set: {policyType: senderInfo.policyType}},
        {upsert: false}, function(err, result){
          if(err){
            throw err;
          }
          console.log('Matched Count: ' + result.matchedCount);
          console.log('Modified Count: ' + result.modifiedCount);
          callback(err, result);
      });
    });
  });
}

PolicyWrapper.prototype.userPrevSetter = function(senderInfo, callback){
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }
    var db = client.db(db_name);
    db.collection('messages', function(err, collection){
      collection.updateOne({_id: senderInfo.id},
        {$set: {prev: senderInfo.previous}},
        {upsert: false}, function(err, result){
          if(err){
            throw err;
          }
          console.log('Matched Count: ' + result.matchedCount);
          console.log('Modified Count: ' + result.modifiedCount);
          callback(err, result);
      });
    });
  });
}
PolicyWrapper.prototype.getPreviousIntent = function(senderInfo, callback){
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }
    var db = client.db(db_name);
    db.collection('messages', function(err,collection){
      collection.find({_id: senderInfo.id}).toArray(function(err, docs){
        if(err){
          throw(err);
        }
        console.log(docs);
        var docObject = {};
        for(var i = 0; i < 1; i++){
          docObject = docs[i];
          // callback(err, prevIntent);
          if(docObject.hasOwnProperty('prev')){
            console.log('Prev Intent Value: ' +docObject.prev)
            callback(err, docObject.prev);
          }else{
            console.log('No previous intent property found for customer');
            callback(err, 'unknown');
          }
        }
      });
    });
  });
}

PolicyWrapper.prototype.getPreviousContext = function(senderInfo, callback){
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }
    var db = client.db(db_name);
    db.collection('messages', function(err,collection){
      collection.find({_id: senderInfo.id}).toArray(function(err, docs){
        if(err){
          throw(err);
        }
        console.log(docs);
        var docObject = {};
        for(var i = 0; i < 1; i++){
          docObject = docs[i];
          // callback(err, prevIntent);
          if(docObject.hasOwnProperty('issue')){
            console.log('Prev Context Value: ' +docObject.issue.context);
            callback(err, docObject.issue.context);
          }else{
            console.log('No previous context property found for customer');
            callback(err, 'unknown');
          }
        }
      });
    });
  });
}

PolicyWrapper.prototype.getPolicyType = function(senderInfo, callback){
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }
    var db = client.db(db_name);
    db.collection('messages', function(err,collection){
      collection.find({_id: senderInfo.id}).toArray(function(err, docs){
        if(err){
          throw(err);
        }
        console.log(docs);
        for(var i = 0; i < docs.length; i++){
          var policyType = docs[i].policyType;
          callback(err, policyType);
        }
      });
    });
  });
}

PolicyWrapper.prototype.clearPreviousIntent = function(senderInfo, callback){
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }
    var db = client.db(db_name);
    db.collection('messages', function(err, collection){
      collection.updateOne({_id: senderInfo.id},
        {$set: {prev: ''}},
        {upsert: true}, function(err, result){
          if(err){
            throw err;
          }
          console.log('Matched Count: ' + result.matchedCount);
          console.log('Modified Count: ' + result.modifiedCount);
          console.log('Clearing Prev Intent');
          callback(err, result);
      });
    });
  });
}

PolicyWrapper.prototype.clearPolicyType = function(senderInfo, callback){
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }
    var db = client.db(db_name);
    db.collection('messages', function(err, collection){
      collection.updateOne({_id: senderInfo.id},
        {$set: {policyType: ""}},
        {upsert: true}, function(err, result){
          if(err){
            throw err;
          }
          console.log('Matched Count: ' + result.matchedCount);
          console.log('Modified Count: ' + result.modifiedCount);
          console.log('Clearing Policy Type');
          callback(err, result);
      });
    });
  });
}
//
PolicyWrapper.prototype.checkUserInDB = function(senderInfo, callback){
  MongoClient.connect(this.db_uri, function(err, client){
    if(err){
      throw err;
    }
    var db = client.db(db_name);
    db.collection('messages', function(err, collection){
      collection.count({_id: senderInfo.id}, function(err, result){
        if(err){
          throw err;
        }else{
          console.log(result);
          callback(err, result);
        }
      });
    });
  });
}
//-------------------------
module.exports = PolicyWrapper;
