/*
Copyright (C) 2013 Tony Mobily

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

/*
TODO:
  - See if the cycle in param can be the same in cast:
    if (options.onlyObjectValues) targetObject = object
    else targetObject = this.structure

  - Turn validate, _cast and _param into await/async code

  - Make sure _cast uses an object much like _param for consistency

  - Check if "required" can be treated like a normal parameter, no special treatment

*/

var CircularJSON = require('circular-json')

var SimpleSchema = class {
  constructor (structure, options) {
    this.structure = structure
    this.options = typeof (options) !== 'undefined' ? options : {}
  }

  // Built-in types

  noneType (definition, value, fieldName, options, failedCasts) {
    return value
  }

  stringType (definition, value, fieldName, options, failedCasts) {
    // Undefined: return '';
    if (typeof (value) === 'undefined') return ''
    if (value === null) return ''

    // No toString() available: failing to cast
    if (typeof (value.toString) === 'undefined') {
      failedCasts[ fieldName ] = true
      return
    }

    // Return cast value
    return value.toString()
  }

  blobType (definition, value, fieldName, options, failedCasts) {
    // Undefined: return '';
    if (typeof (value) === 'undefined') return ''
    if (value === null) return ''

    return value
  }

  numberType (definition, value, fieldName, options, failedCasts) {
    // Undefined: return 0;
    if (typeof (value) === 'undefined') return 0

    // If Number() returns NaN, fail
    var r = Number(value)
    if (isNaN(r)) {
      failedCasts[ fieldName ] = true
      return
    }

    // Return cast value
    return r
  }

  dateType (definition, value, fieldName, options, failedCasts) {
    // Undefined: return a new date object
    if (typeof (value) === 'undefined') {
      return new Date()
    }

    // If new Date() returns NaN, date was not corect, fail
    var r = new Date(value)
    if (isNaN(r)) {
      failedCasts[ fieldName ] = true
      return value
    }

    // return cast value
    return r
  }

  arrayType (definition, value, fieldName, options, failedCasts) {
    return Array.isArray(value) ? value : [ value ]
  }

  serializeType (definition, value, fieldName, options, failedCasts) {
    var r

    if (options.deserialize) {
      if (typeof (value) !== 'string') {
        failedCasts[ fieldName ] = true
        return value
      }

      try {
          // Attempt to stringify
        r = CircularJSON.parse(value)

          // It worked: return r
        return r
      } catch (e) {
        failedCasts[ fieldName ] = true
        return value
      }
    } else {
      try {
        r = CircularJSON.stringify(value)

          // It worked: return r
        return r
      } catch (e) {
        failedCasts[ fieldName ] = true
        return value
      }

    //
    }
  }

  // Cast an ID for this particular engine. If the object is in invalid format, it won't
  // get cast, and as a result check will fail
  booleanType (definition, value, fieldName, options, failedCasts) {
    if (typeof (value) === 'string') {
      if (value === (definition.stringFalseWhen || 'false')) return false
      else if ((value === (definition.stringTrueWhen || 'true')) || (value === (definition.stringTrueWhen || 'on'))) return true
      else return false
    } else {
      return !!value
    }
  }

  // Cast an ID for this particular engine. If the object is in invalid format, it won't
  // get cast, and as a result check will fail
  idType (definition, value, fieldName, options, failedCasts) {
    var n = parseInt(value)
    if (isNaN(n)) {
      failedCasts[ fieldName ] = true
      return value
    } else {
      return n
    }
  }

  // Built-in parameters

  minParam (p) {
    if (p.definition.type === 'number' && p.value && p.value < p.parameterValue) {
      p.errors.push({ field: p.fieldName, message: 'Field is too low: ' + p.fieldName })
    }
    if (p.definition.type === 'string' && p.value && p.value.length < p.parameterValue) {
      p.errors.push({ field: p.fieldName, message: 'Field is too short: ' + p.fieldName })
    }
  }

  maxParam (p) {
    if (p.definition.type === 'number' && p.value && p.value > p.parameterValue) {
      p.errors.push({ field: p.fieldName, message: 'Field is too high: ' + p.fieldName })
    }

    if (p.definition.type === 'string' && p.value && p.value.length > p.parameterValue) {
      p.errors.push({ field: p.fieldName, message: 'Field is too long: ' + p.fieldName })
    }
  }

  validatorParam (p) {
    if (typeof (p.parameterValue) !== 'function') {
      throw (new Error('Validator function needs to be a function, found: ' + typeof (p.parameterValue)))
    }

    var r = p.parameterValue.call(this, p.object, p.object[ p.fieldName ], p.fieldName)
    if (typeof (r) === 'string') p.errors.push({ field: p.fieldName, message: r })
  }

  uppercaseParam (p) {
    if (typeof (p.value) !== 'string') return
    return p.value.toUpperCase()
  }
  lowercaseParam (p) {
    if (typeof (p.value) !== 'string') return
    return p.value.toLowerCase()
  }

  trimParam (p) {
    if (typeof (p.value) !== 'string') return
    return p.value.substr(0, p.parameterValue)
  }

  defaultParam (p) {
    var v
    if (typeof (p.objectBeforeCast[ p.fieldName ]) === 'undefined') {
      if (typeof (p.parameterValue) === 'function') {
        v = p.parameterValue.call()
      } else {
        v = p.parameterValue
      }
      p.object[ p.fieldName ] = v
    }
  }

  requiredParam (p) {
    if (typeof (p.objectBeforeCast[ p.fieldName ]) === 'undefined' && p.parameterValue) {
      p.errors.push({ field: p.fieldName, message: 'Field required: ' + p.fieldName })
    }
  }

  notEmptyParam (p) {
    var bc = p.objectBeforeCast[ p.fieldName ]
    var bcs = typeof (bc) !== 'undefined' && bc !== null && bc.toString ? bc.toString() : ''
    if (!Array.isArray(p.value) && typeof (bc) !== 'undefined' && bcs === '' && p.parameterValue) {
      p.errors.push({ field: p.fieldName, message: 'Field cannot be empty: ' + p.fieldName })
    }
  }

  // Options and values used:
  //  * options.onlyObjectValues              -- Will apply cast for existing object's keys rather than the
  //                                             schema itself
  //  * options.skipCast                      -- To know what casts need to be skipped
  //
  //  * this.structure[ fieldName ].required  -- To skip cast if it's `undefined` and it's NOT required
  //  //* this.structure[ fieldName ].protected -- To skip cast if it's `undefined` and it's protected
  //
  _cast (object, options, cb) {
    var failedCasts = {}
    var failedRequired = {}
    options = typeof (options) === 'undefined' ? {} : options
    var targetObject
    var resultObject = {}

    // Set the targetObject. If the target is the object itself,
    // then missing fields won't be a problem
    if (options.onlyObjectValues) targetObject = object
    else targetObject = this.structure

    for (var fieldName in targetObject) {
      // Getting the definition
      var definition = this.structure[ fieldName ]

      // Copying the value over
      if (typeof (object[fieldName]) !== 'undefined') resultObject[ fieldName ] = object[ fieldName ]

      // If the definition is undefined, and it's an object-values only check,
      // then the missing definition mustn't be a problem.
      if (typeof (definition) === 'undefined' && options.onlyObjectValues) continue

      // Skip casting if so required by the skipCast array
      if (Array.isArray(options.skipCast) && options.skipCast.indexOf(fieldName) !== -1) {
        continue
      }

      // Skip casting if value is `undefined` AND it's not required
      if (!definition.required && typeof (object[ fieldName ]) === 'undefined') {
        continue
      }

      // Skip casting if value is `undefined` AND it IS required
      // Also, set failedRequired for that field, so that no param will be applied to it except `required`
      if (definition.required && typeof (object[ fieldName ]) === 'undefined') {
        failedRequired[ fieldName ] = true
        continue
      }

      // Run the xxxType function for a specific type
      if (typeof (this[ definition.type + 'Type' ]) === 'function') {
        var result = this[ definition.type + 'Type' ](definition, object[ fieldName ], fieldName, options, failedCasts)
        if (typeof (result) !== 'undefined') resultObject[ fieldName ] = result
      } else {
        throw (new Error('No casting function found, type probably wrong: ' + definition.type))
      }
    }

    // That's it -- return resulting Object
    cb(null, resultObject, failedCasts, failedRequired)
  }

  // Options and values used:
  //  * options.onlyObjectValues             -- Will skip appling parameters if undefined and
  //                                            options.onlyObjectValues is true
  //  * options.skipParams                   -- Won't apply specific params for specific fields

  _params (object, objectBeforeCast, options, failedCasts, failedRequired, cb) {
    options = typeof (options) === 'undefined' ? {} : options

    var errors = []
    var resultObject = {}

    for (var k in objectBeforeCast) {
      if (typeof (this.structure[ k ]) === 'undefined') {
        errors.push({ field: k, message: 'Field not allowed: ' + k })
      }
    }

    // Copying object into resultObject
    for (k in object) {
      if (typeof (object[ k ]) !== 'undefined') resultObject[ k ] = object[ k ]
    }

    // Scan schema
    for (var fieldName in this.structure) {
      var definition = this.structure[ fieldName ]

      // The `onlyObjectValues` option is on: skip anything that is not in the object
      if (options.onlyObjectValues && typeof (object[ fieldName ]) === 'undefined') continue

      // If cast failed, then don't bother with the parameters
      if (failedCasts[ fieldName ]) continue

      definition = this.structure[ fieldName ]

      // Run specific functions based on the passed options

      // If `required` failed during casting, then skip other parameters --
      // `required` is the ONLY parameter that will actually get called
      var def = failedRequired[fieldName] ? { required: true } : definition

      for (var parameterName in def) {
        // If it's to be skipped, we shall skip -- e.g. `options.skipParams == { tabId: 'required' }` to
        // skip `required` parameter for `tabId` field
        if (typeof (options.skipParams) === 'object' && options.skipParams !== null) {
          var skipParams = options.skipParams[ fieldName ]
          if (Array.isArray(skipParams) && skipParams.indexOf(parameterName) !== -1) continue
        }

        if (parameterName !== 'type' && typeof (this[ parameterName + 'Param' ]) === 'function') {
          // Store the length of errors; later, it will use this to check that it hasn't grown
          var errLength = errors.length

          var result = this[ parameterName + 'Param' ]({
            definition: definition,
            object: resultObject,
            fieldName: fieldName,
            options: options,
            value: resultObject[ fieldName ],
            valueBeforeParams: object[ fieldName ],
            objectBeforeCast: objectBeforeCast,
            objectBeforeParams: object,
            parameterName: parameterName,
            parameterValue: definition[ parameterName ],
            errors: errors
          })

          if (typeof (result) !== 'undefined') resultObject[ fieldName ] = result

          // If `errors` grew, the following parameters will not be applied
          if (errors.length !== errLength) break
        }
      }
    }
    cb(null, resultObject, errors)
  }

  // Options and values used (the ones used by _cast() and _params() together)
  //
  //  * options.onlyObjectValues             -- Will apply cast for existing object's keys rather than the schema itself
  //  * options.skipCast                     -- To know what casts need to be skipped
  //  * options.skipParams                   -- Won't apply specific params for specific fields
  //
  //  * this.structure[ fieldName ].required -- To skip cast if it's `undefined` and it's NOT required
  //
  // Note that the only special parameter is 'required' -- it's only special because _cast() won't cast
  // it if it's `undefined` and it's not required. Otherwise, casting will make validation fail for unrequired and absent values
  //
  // This will run _cast and _param
  validate (originalObject, options, cb) {
    var self = this

    if (typeof (cb) === 'undefined') {
      cb = options
      options = {}
    }

    options = typeof (options) === 'undefined' ? {} : options

    self._cast(originalObject, options, function (err, castObject, failedCasts, failedRequired) {
      if (err) return cb(err)

      self._params(castObject, originalObject, options, failedCasts, failedRequired, function (err, paramObject, errors) {
        if (err) return cb(err)

        Object.keys(failedCasts).forEach(function (fieldName) {
          errors.push({ field: fieldName, message: 'Error during casting' })
        })
        return cb(null, paramObject, errors)
      })
    })
  }

  cleanup (object, parameterName) {
    var newObject = {}
    for (var k in object) {
      if (!this.structure[ k ]) continue
      if (this.structure[ k ][parameterName]) {
        delete object[ k ]
        newObject[ k ] = object[ k ]
      }
    }
    return newObject
  }
}

exports = module.exports = SimpleSchema
