const Promise     = require('bluebird')
const assert      = require('assert');

let library = {};

// Expand this to include a context based on wether we're setting a permit
// or checking a permit!
let resolveIdentity = function(item){

  if(module.exports.sequelize) {
    if(module.exports.sequelize.Sequelize.Model.isPrototypeOf(item)) {
      return item.name
    } else if(item instanceof module.exports.sequelize.Sequelize.Model) {
      return item.constructor.name
    } else if(item instanceof hoochTuple) {
      return item.key
    }else {
      return item
    }
  } else {
    if(item instanceof hoochTuple) {
      return item.key
    } else {
      return item; 
    }
  }
}


let permit = ({activity = null, forItem = null, givenThat = null} = {}) => {
  if(!activity || !forItem || !givenThat){ throw new Error("hooch#permit is missing a parameter. This is a fatal error due to security concerns.") }
  if(!library[activity]){
    library[activity] = {}
  }

  let identity = resolveIdentity(forItem)

  if(!library[activity][identity]){
    library[activity][identity] = [];
  }

  library[activity][identity].push(givenThat)
}

function OptionsKeyError(){
  this.error = true
}
OptionsKeyError.prototype = Object.create(Error.prototype);


let allowed = ({user = user, isAllowedTo = null, forItem = null, options={}} = {}) => {
  if(!user || !isAllowedTo || !forItem){
    throw new Error("hooch#allowed is missing one or more parameters. This is a fatal error due to security concerns.")
  }

  const validOptionKeys = ['transaction'];
  // Only forward supported keys to permit
  Object.keys(options).forEach((key) => {
    if (!validOptionKeys.includes(key)) {
      throw new OptionsKeyError("Invalid options key");
    }
  })

  let _options = { transaction:options.transaction }

  return Promise.resolve(forItem).then(item => {
    let identity = resolveIdentity(item);
    if(library[isAllowedTo] && library[isAllowedTo][identity]){
      return Promise.all([item, library[isAllowedTo][identity]])
    }else{
      return Promise.all([item, []])
    }
  }).spread((item, permits) => {
    return Promise.reduce(permits, function(returnValue, permit){
      return Promise.resolve(permit(item, user, isAllowedTo, _options)).then(res => {
        assert(typeof(res) === "boolean"); 
        returnValue = res; 
        return returnValue;
      })
    }, false);
  }).then(res => {
    if(res){
      return Promise.resolve(forItem);
    }else{
      return Promise.reject(new AuthorizationError("Not allowed!"));
    }
  })
}

let _reset = () => {
  library = {}
}

function AuthorizationError() {
  this.error = true;
};
AuthorizationError.prototype = Object.create(Error.prototype);

function TupleIntegrityError(){
  this.error = true
}
TupleIntegrityError.prototype = Object.create(Error.prototype);

function tupleCreator(key, reference){
  if((!key || !reference) || (typeof(key) != 'string') || ['string', 'number'].indexOf(typeof(reference)) == -1){
    throw new TupleIntegrityError("Invalid hooch-tuple");
    return;
  }
  return new hoochTuple(key, reference)
}

let hoochTuple = function(key, reference){
  this.key = key
  this.reference = reference
}

module.exports = {
  permit: permit, 
  allow: allowed,
  reset: _reset,
  tuple: tupleCreator,
  AuthorizationError: AuthorizationError,
  TupleIntegrityError: TupleIntegrityError
}