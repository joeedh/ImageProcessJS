//handle to module.  never access in code; for debug console use only.
var _util = undefined;

define([
  "./polyfill"
], function(unused) {
  "use strict";

  var exports = _util = {};

  var cachering = exports.cachering = class cachering extends Array {
    constructor(func, size) {
      super()
      
      this.cur = 0;
      
      for (var i=0; i<size; i++) {
        this.push(func());
      }
    }
    
    static fromConstructor(cls, size) {
      var func = function() {
        return new cls();
      }
      
      return new exports.cachering(func, size);
    }
    
    next() {
      var ret = this[this.cur];
      this.cur = (this.cur+1)%this.length;
      
      return ret;
    }
  }
  var IDGen = exports.IDGen = class IDGen {
    constructor() {
      this._cur = 1;
    }
    
    next() {
      return this._cur++;
    }
    
    max_cur(id) {
      this._cur = Math.max(this._cur, id+1);
    }
    
    toJSON() {
      return {
        _cur : this._cur
      };
    }
    
    static fromJSON(obj) {
      var ret = new IDGen();
      ret._cur = obj._cur;
      return ret;
    }
  }


  function get_callstack(err) {
    var callstack = [];
    var isCallstackPopulated = false;

    var err_was_undefined = err == undefined;

    if (err == undefined) {
      try {
        _idontexist.idontexist+=0; //doesn't exist- that's the point
      } catch(err1) {
        err = err1;
      }
    }

    if (err != undefined) {
      if (err.stack) { //Firefox
        var lines = err.stack.split('\n');
        var len=lines.length;
        for (var i=0; i<len; i++) {
          if (1) {
            lines[i] = lines[i].replace(/@http\:\/\/.*\//, "|")
            var l = lines[i].split("|")
            lines[i] = l[1] + ": " + l[0]
            lines[i] = lines[i].trim()
            callstack.push(lines[i]);
          }
        }
        
        //Remove call to printStackTrace()
        if (err_was_undefined) {
          //callstack.shift();
        }
        isCallstackPopulated = true;
      }
      else if (window.opera && e.message) { //Opera
        var lines = err.message.split('\n');
        var len=lines.length;
        for (var i=0; i<len; i++) {
          if (lines[i].match(/^\s*[A-Za-z0-9\-_\$]+\(/)) {
            var entry = lines[i];
            //Append next line also since it has the file info
            if (lines[i+1]) {
              entry += ' at ' + lines[i+1];
              i++;
            }
            callstack.push(entry);
          }
        }
        //Remove call to printStackTrace()
        if (err_was_undefined) {
          callstack.shift();
        }
        isCallstackPopulated = true;
      }
     }

      var limit = 24;
      if (!isCallstackPopulated) { //IE and Safari
        var currentFunction = arguments.callee.caller;
        var i = 0;
        while (currentFunction && i < 24) {
          var fn = currentFunction.toString();
          var fname = fn.substring(fn.indexOf("function") + 8, fn.indexOf('')) || 'anonymous';
          callstack.push(fname);
          currentFunction = currentFunction.caller;
          
          i++;
        }
      }
    
    return callstack;
  }

  var print_stack = exports.print_stack = function print_stack(err) {
    try {
      var cs = get_callstack(err);
    } catch (err2) {
      console.log("Could not fetch call stack.");
      return;
    }
    
    console.log("Callstack:");
    for (var i=0; i<cs.length; i++) {
      console.log(cs[i]);
    }
  }

  var time_ms = exports.time_ms = function time_ms() {
    if (window.performance)
      return window.performance.now();
    else
      return new Date().getMilliseconds();
  }
  
  return exports;
  
});
