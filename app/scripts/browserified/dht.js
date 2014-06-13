require=(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
'use strict';

var Peer = require('peerjs');
var Chord = require('webrtc-chord');


var _ = require('underscore');

var updatePeerId = function(peerId) {
    console.log('My peer ID: ' + peerId);
};

var errorHandler = function(error) {
    if (error) {
        console.log('Failed: ' + error);
    }
};

var create = function(myPeerId, error) {
    if (error) {
        errorHandler(error);
    } else {
        updatePeerId(myPeerId);
    }
};

var join = function(myPeerId, error) {
    if (error) {
        errorHandler(error);
    } else {
        updatePeerId(myPeerId);
    }
};

var config = {
    peer: { // The object to pass to the Peer constructor.
        options: {
            host: 'localhost',
            port: 9000,
            debug: 3,
            config: {
                iceServers: [
                    {url: 'stun:54.187.230.130'},
                    {url: 'stun:stun.l.google.com:19302'},
                    {url: 'turn:gorst@54.187.230.130', credential: 'hero'}
                ]
            }
        }
    },
    numberOfEntriesInSuccessorList: 3,
    connectionPoolSize: 10,
    connectionOpenTimeout: 30000,
    requestTimeout: 180000,
    stabilizeTaskInterval: 30000,
    fixFingerTaskInterval: 30000,
    checkPredecessorTaskInterval: 30000
};



// Create a new chord instance
var chord = new Chord(config);

var peer = new Peer({
    host: 'localhost',
    port: 9000,
    debug: 3,
    config: {
        iceServers: [
            {url: 'stun:54.187.230.130'},
            {url: 'stun:stun.l.google.com:19302'},
            {url: 'turn:gorst@54.187.230.130', credential: 'hero'}
        ]
    }
});

peer.on('open', function(id) {
    var peers = [];
    peer.listAllPeers(function (keys) {
        keys.map(function(p) {
            if(p !== id && p !== chord.getPeerId()) {
                console.log('Peer ' + p);
                peers.push(p);
            }
        });

        // First peeer
        if(peers[0]) {
            // Join an existing chord network
            console.log('Joining ', peers[0]);
            chord.join(peers[0], join);
        } else {
            // Create a new chord network
            console.log('Creating new network');
            chord.create(create);
        }
    });
    peer.destroy();
});

function search(query) {
    // Split query by keyword
    var keywords = query.split(' ');

    // Retrieve entries
    var all = [];
    var results = [];
    _.each(keywords, function (key) {
        chord.retrieve(key, function(entries, error) {
            if (error) {
                console.log('Failed to retrieve entries: ' + error);
            }
            all.push(_.flatten(entries));
            if(key === _.last(keywords)) {
                results = _.intersection.apply(_, all);
                console.log(results);
            }
        });
    });
}

window.onunload = window.onbeforeunload = function() {
    if (!!peer && !peer.destroyed) {
        peer.destroy();
    }
    chord.leave();
};

module.exports.chord = chord;
module.exports.get = chord.retrieve;
module.exports.put = chord.put;
module.exports.remove = chord.remove;
module.exports.search = search;
},{"peerjs":"MVWM4L","underscore":6,"webrtc-chord":"rzYpuO"}],"MVWM4L":[function(require,module,exports){
(function (global){
;__browserify_shim_require__=require;(function browserifyShim(module, exports, require, define, browserify_shim__define__module__export__) {
/*! peerjs.js build:0.3.8, development. Copyright(c) 2013 Michelle Bu <michelle@michellebu.com> */
(function(exports){
var binaryFeatures = {};
binaryFeatures.useBlobBuilder = (function(){
  try {
    new Blob([]);
    return false;
  } catch (e) {
    return true;
  }
})();

binaryFeatures.useArrayBufferView = !binaryFeatures.useBlobBuilder && (function(){
  try {
    return (new Blob([new Uint8Array([])])).size === 0;
  } catch (e) {
    return true;
  }
})();

exports.binaryFeatures = binaryFeatures;
exports.BlobBuilder = window.WebKitBlobBuilder || window.MozBlobBuilder || window.MSBlobBuilder || window.BlobBuilder;

function BufferBuilder(){
  this._pieces = [];
  this._parts = [];
}

BufferBuilder.prototype.append = function(data) {
  if(typeof data === 'number') {
    this._pieces.push(data);
  } else {
    this.flush();
    this._parts.push(data);
  }
};

BufferBuilder.prototype.flush = function() {
  if (this._pieces.length > 0) {
    var buf = new Uint8Array(this._pieces);
    if(!binaryFeatures.useArrayBufferView) {
      buf = buf.buffer;
    }
    this._parts.push(buf);
    this._pieces = [];
  }
};

BufferBuilder.prototype.getBuffer = function() {
  this.flush();
  if(binaryFeatures.useBlobBuilder) {
    var builder = new BlobBuilder();
    for(var i = 0, ii = this._parts.length; i < ii; i++) {
      builder.append(this._parts[i]);
    }
    return builder.getBlob();
  } else {
    return new Blob(this._parts);
  }
};
exports.BinaryPack = {
  unpack: function(data){
    var unpacker = new Unpacker(data);
    return unpacker.unpack();
  },
  pack: function(data){
    var packer = new Packer();
    packer.pack(data);
    var buffer = packer.getBuffer();
    return buffer;
  }
};

function Unpacker (data){
  // Data is ArrayBuffer
  this.index = 0;
  this.dataBuffer = data;
  this.dataView = new Uint8Array(this.dataBuffer);
  this.length = this.dataBuffer.byteLength;
}


Unpacker.prototype.unpack = function(){
  var type = this.unpack_uint8();
  if (type < 0x80){
    var positive_fixnum = type;
    return positive_fixnum;
  } else if ((type ^ 0xe0) < 0x20){
    var negative_fixnum = (type ^ 0xe0) - 0x20;
    return negative_fixnum;
  }
  var size;
  if ((size = type ^ 0xa0) <= 0x0f){
    return this.unpack_raw(size);
  } else if ((size = type ^ 0xb0) <= 0x0f){
    return this.unpack_string(size);
  } else if ((size = type ^ 0x90) <= 0x0f){
    return this.unpack_array(size);
  } else if ((size = type ^ 0x80) <= 0x0f){
    return this.unpack_map(size);
  }
  switch(type){
    case 0xc0:
      return null;
    case 0xc1:
      return undefined;
    case 0xc2:
      return false;
    case 0xc3:
      return true;
    case 0xca:
      return this.unpack_float();
    case 0xcb:
      return this.unpack_double();
    case 0xcc:
      return this.unpack_uint8();
    case 0xcd:
      return this.unpack_uint16();
    case 0xce:
      return this.unpack_uint32();
    case 0xcf:
      return this.unpack_uint64();
    case 0xd0:
      return this.unpack_int8();
    case 0xd1:
      return this.unpack_int16();
    case 0xd2:
      return this.unpack_int32();
    case 0xd3:
      return this.unpack_int64();
    case 0xd4:
      return undefined;
    case 0xd5:
      return undefined;
    case 0xd6:
      return undefined;
    case 0xd7:
      return undefined;
    case 0xd8:
      size = this.unpack_uint16();
      return this.unpack_string(size);
    case 0xd9:
      size = this.unpack_uint32();
      return this.unpack_string(size);
    case 0xda:
      size = this.unpack_uint16();
      return this.unpack_raw(size);
    case 0xdb:
      size = this.unpack_uint32();
      return this.unpack_raw(size);
    case 0xdc:
      size = this.unpack_uint16();
      return this.unpack_array(size);
    case 0xdd:
      size = this.unpack_uint32();
      return this.unpack_array(size);
    case 0xde:
      size = this.unpack_uint16();
      return this.unpack_map(size);
    case 0xdf:
      size = this.unpack_uint32();
      return this.unpack_map(size);
  }
}

Unpacker.prototype.unpack_uint8 = function(){
  var byte = this.dataView[this.index] & 0xff;
  this.index++;
  return byte;
};

Unpacker.prototype.unpack_uint16 = function(){
  var bytes = this.read(2);
  var uint16 =
    ((bytes[0] & 0xff) * 256) + (bytes[1] & 0xff);
  this.index += 2;
  return uint16;
}

Unpacker.prototype.unpack_uint32 = function(){
  var bytes = this.read(4);
  var uint32 =
     ((bytes[0]  * 256 +
       bytes[1]) * 256 +
       bytes[2]) * 256 +
       bytes[3];
  this.index += 4;
  return uint32;
}

Unpacker.prototype.unpack_uint64 = function(){
  var bytes = this.read(8);
  var uint64 =
   ((((((bytes[0]  * 256 +
       bytes[1]) * 256 +
       bytes[2]) * 256 +
       bytes[3]) * 256 +
       bytes[4]) * 256 +
       bytes[5]) * 256 +
       bytes[6]) * 256 +
       bytes[7];
  this.index += 8;
  return uint64;
}


Unpacker.prototype.unpack_int8 = function(){
  var uint8 = this.unpack_uint8();
  return (uint8 < 0x80 ) ? uint8 : uint8 - (1 << 8);
};

Unpacker.prototype.unpack_int16 = function(){
  var uint16 = this.unpack_uint16();
  return (uint16 < 0x8000 ) ? uint16 : uint16 - (1 << 16);
}

Unpacker.prototype.unpack_int32 = function(){
  var uint32 = this.unpack_uint32();
  return (uint32 < Math.pow(2, 31) ) ? uint32 :
    uint32 - Math.pow(2, 32);
}

Unpacker.prototype.unpack_int64 = function(){
  var uint64 = this.unpack_uint64();
  return (uint64 < Math.pow(2, 63) ) ? uint64 :
    uint64 - Math.pow(2, 64);
}

Unpacker.prototype.unpack_raw = function(size){
  if ( this.length < this.index + size){
    throw new Error('BinaryPackFailure: index is out of range'
      + ' ' + this.index + ' ' + size + ' ' + this.length);
  }
  var buf = this.dataBuffer.slice(this.index, this.index + size);
  this.index += size;

    //buf = util.bufferToString(buf);

  return buf;
}

Unpacker.prototype.unpack_string = function(size){
  var bytes = this.read(size);
  var i = 0, str = '', c, code;
  while(i < size){
    c = bytes[i];
    if ( c < 128){
      str += String.fromCharCode(c);
      i++;
    } else if ((c ^ 0xc0) < 32){
      code = ((c ^ 0xc0) << 6) | (bytes[i+1] & 63);
      str += String.fromCharCode(code);
      i += 2;
    } else {
      code = ((c & 15) << 12) | ((bytes[i+1] & 63) << 6) |
        (bytes[i+2] & 63);
      str += String.fromCharCode(code);
      i += 3;
    }
  }
  this.index += size;
  return str;
}

Unpacker.prototype.unpack_array = function(size){
  var objects = new Array(size);
  for(var i = 0; i < size ; i++){
    objects[i] = this.unpack();
  }
  return objects;
}

Unpacker.prototype.unpack_map = function(size){
  var map = {};
  for(var i = 0; i < size ; i++){
    var key  = this.unpack();
    var value = this.unpack();
    map[key] = value;
  }
  return map;
}

Unpacker.prototype.unpack_float = function(){
  var uint32 = this.unpack_uint32();
  var sign = uint32 >> 31;
  var exp  = ((uint32 >> 23) & 0xff) - 127;
  var fraction = ( uint32 & 0x7fffff ) | 0x800000;
  return (sign == 0 ? 1 : -1) *
    fraction * Math.pow(2, exp - 23);
}

Unpacker.prototype.unpack_double = function(){
  var h32 = this.unpack_uint32();
  var l32 = this.unpack_uint32();
  var sign = h32 >> 31;
  var exp  = ((h32 >> 20) & 0x7ff) - 1023;
  var hfrac = ( h32 & 0xfffff ) | 0x100000;
  var frac = hfrac * Math.pow(2, exp - 20) +
    l32   * Math.pow(2, exp - 52);
  return (sign == 0 ? 1 : -1) * frac;
}

Unpacker.prototype.read = function(length){
  var j = this.index;
  if (j + length <= this.length) {
    return this.dataView.subarray(j, j + length);
  } else {
    throw new Error('BinaryPackFailure: read index out of range');
  }
}

function Packer(){
  this.bufferBuilder = new BufferBuilder();
}

Packer.prototype.getBuffer = function(){
  return this.bufferBuilder.getBuffer();
}

Packer.prototype.pack = function(value){
  var type = typeof(value);
  if (type == 'string'){
    this.pack_string(value);
  } else if (type == 'number'){
    if (Math.floor(value) === value){
      this.pack_integer(value);
    } else{
      this.pack_double(value);
    }
  } else if (type == 'boolean'){
    if (value === true){
      this.bufferBuilder.append(0xc3);
    } else if (value === false){
      this.bufferBuilder.append(0xc2);
    }
  } else if (type == 'undefined'){
    this.bufferBuilder.append(0xc0);
  } else if (type == 'object'){
    if (value === null){
      this.bufferBuilder.append(0xc0);
    } else {
      var constructor = value.constructor;
      if (constructor == Array){
        this.pack_array(value);
      } else if (constructor == Blob || constructor == File) {
        this.pack_bin(value);
      } else if (constructor == ArrayBuffer) {
        if(binaryFeatures.useArrayBufferView) {
          this.pack_bin(new Uint8Array(value));
        } else {
          this.pack_bin(value);
        }
      } else if ('BYTES_PER_ELEMENT' in value){
        if(binaryFeatures.useArrayBufferView) {
          this.pack_bin(new Uint8Array(value.buffer));
        } else {
          this.pack_bin(value.buffer);
        }
      } else if (constructor == Object){
        this.pack_object(value);
      } else if (constructor == Date){
        this.pack_string(value.toString());
      } else if (typeof value.toBinaryPack == 'function'){
        this.bufferBuilder.append(value.toBinaryPack());
      } else {
        throw new Error('Type "' + constructor.toString() + '" not yet supported');
      }
    }
  } else {
    throw new Error('Type "' + type + '" not yet supported');
  }
  this.bufferBuilder.flush();
}


Packer.prototype.pack_bin = function(blob){
  var length = blob.length || blob.byteLength || blob.size;
  if (length <= 0x0f){
    this.pack_uint8(0xa0 + length);
  } else if (length <= 0xffff){
    this.bufferBuilder.append(0xda) ;
    this.pack_uint16(length);
  } else if (length <= 0xffffffff){
    this.bufferBuilder.append(0xdb);
    this.pack_uint32(length);
  } else{
    throw new Error('Invalid length');
    return;
  }
  this.bufferBuilder.append(blob);
}

Packer.prototype.pack_string = function(str){
  var length = utf8Length(str);

  if (length <= 0x0f){
    this.pack_uint8(0xb0 + length);
  } else if (length <= 0xffff){
    this.bufferBuilder.append(0xd8) ;
    this.pack_uint16(length);
  } else if (length <= 0xffffffff){
    this.bufferBuilder.append(0xd9);
    this.pack_uint32(length);
  } else{
    throw new Error('Invalid length');
    return;
  }
  this.bufferBuilder.append(str);
}

Packer.prototype.pack_array = function(ary){
  var length = ary.length;
  if (length <= 0x0f){
    this.pack_uint8(0x90 + length);
  } else if (length <= 0xffff){
    this.bufferBuilder.append(0xdc)
    this.pack_uint16(length);
  } else if (length <= 0xffffffff){
    this.bufferBuilder.append(0xdd);
    this.pack_uint32(length);
  } else{
    throw new Error('Invalid length');
  }
  for(var i = 0; i < length ; i++){
    this.pack(ary[i]);
  }
}

Packer.prototype.pack_integer = function(num){
  if ( -0x20 <= num && num <= 0x7f){
    this.bufferBuilder.append(num & 0xff);
  } else if (0x00 <= num && num <= 0xff){
    this.bufferBuilder.append(0xcc);
    this.pack_uint8(num);
  } else if (-0x80 <= num && num <= 0x7f){
    this.bufferBuilder.append(0xd0);
    this.pack_int8(num);
  } else if ( 0x0000 <= num && num <= 0xffff){
    this.bufferBuilder.append(0xcd);
    this.pack_uint16(num);
  } else if (-0x8000 <= num && num <= 0x7fff){
    this.bufferBuilder.append(0xd1);
    this.pack_int16(num);
  } else if ( 0x00000000 <= num && num <= 0xffffffff){
    this.bufferBuilder.append(0xce);
    this.pack_uint32(num);
  } else if (-0x80000000 <= num && num <= 0x7fffffff){
    this.bufferBuilder.append(0xd2);
    this.pack_int32(num);
  } else if (-0x8000000000000000 <= num && num <= 0x7FFFFFFFFFFFFFFF){
    this.bufferBuilder.append(0xd3);
    this.pack_int64(num);
  } else if (0x0000000000000000 <= num && num <= 0xFFFFFFFFFFFFFFFF){
    this.bufferBuilder.append(0xcf);
    this.pack_uint64(num);
  } else{
    throw new Error('Invalid integer');
  }
}

Packer.prototype.pack_double = function(num){
  var sign = 0;
  if (num < 0){
    sign = 1;
    num = -num;
  }
  var exp  = Math.floor(Math.log(num) / Math.LN2);
  var frac0 = num / Math.pow(2, exp) - 1;
  var frac1 = Math.floor(frac0 * Math.pow(2, 52));
  var b32   = Math.pow(2, 32);
  var h32 = (sign << 31) | ((exp+1023) << 20) |
      (frac1 / b32) & 0x0fffff;
  var l32 = frac1 % b32;
  this.bufferBuilder.append(0xcb);
  this.pack_int32(h32);
  this.pack_int32(l32);
}

Packer.prototype.pack_object = function(obj){
  var keys = Object.keys(obj);
  var length = keys.length;
  if (length <= 0x0f){
    this.pack_uint8(0x80 + length);
  } else if (length <= 0xffff){
    this.bufferBuilder.append(0xde);
    this.pack_uint16(length);
  } else if (length <= 0xffffffff){
    this.bufferBuilder.append(0xdf);
    this.pack_uint32(length);
  } else{
    throw new Error('Invalid length');
  }
  for(var prop in obj){
    if (obj.hasOwnProperty(prop)){
      this.pack(prop);
      this.pack(obj[prop]);
    }
  }
}

Packer.prototype.pack_uint8 = function(num){
  this.bufferBuilder.append(num);
}

Packer.prototype.pack_uint16 = function(num){
  this.bufferBuilder.append(num >> 8);
  this.bufferBuilder.append(num & 0xff);
}

Packer.prototype.pack_uint32 = function(num){
  var n = num & 0xffffffff;
  this.bufferBuilder.append((n & 0xff000000) >>> 24);
  this.bufferBuilder.append((n & 0x00ff0000) >>> 16);
  this.bufferBuilder.append((n & 0x0000ff00) >>>  8);
  this.bufferBuilder.append((n & 0x000000ff));
}

Packer.prototype.pack_uint64 = function(num){
  var high = num / Math.pow(2, 32);
  var low  = num % Math.pow(2, 32);
  this.bufferBuilder.append((high & 0xff000000) >>> 24);
  this.bufferBuilder.append((high & 0x00ff0000) >>> 16);
  this.bufferBuilder.append((high & 0x0000ff00) >>>  8);
  this.bufferBuilder.append((high & 0x000000ff));
  this.bufferBuilder.append((low  & 0xff000000) >>> 24);
  this.bufferBuilder.append((low  & 0x00ff0000) >>> 16);
  this.bufferBuilder.append((low  & 0x0000ff00) >>>  8);
  this.bufferBuilder.append((low  & 0x000000ff));
}

Packer.prototype.pack_int8 = function(num){
  this.bufferBuilder.append(num & 0xff);
}

Packer.prototype.pack_int16 = function(num){
  this.bufferBuilder.append((num & 0xff00) >> 8);
  this.bufferBuilder.append(num & 0xff);
}

Packer.prototype.pack_int32 = function(num){
  this.bufferBuilder.append((num >>> 24) & 0xff);
  this.bufferBuilder.append((num & 0x00ff0000) >>> 16);
  this.bufferBuilder.append((num & 0x0000ff00) >>> 8);
  this.bufferBuilder.append((num & 0x000000ff));
}

Packer.prototype.pack_int64 = function(num){
  var high = Math.floor(num / Math.pow(2, 32));
  var low  = num % Math.pow(2, 32);
  this.bufferBuilder.append((high & 0xff000000) >>> 24);
  this.bufferBuilder.append((high & 0x00ff0000) >>> 16);
  this.bufferBuilder.append((high & 0x0000ff00) >>>  8);
  this.bufferBuilder.append((high & 0x000000ff));
  this.bufferBuilder.append((low  & 0xff000000) >>> 24);
  this.bufferBuilder.append((low  & 0x00ff0000) >>> 16);
  this.bufferBuilder.append((low  & 0x0000ff00) >>>  8);
  this.bufferBuilder.append((low  & 0x000000ff));
}

function _utf8Replace(m){
  var code = m.charCodeAt(0);

  if(code <= 0x7ff) return '00';
  if(code <= 0xffff) return '000';
  if(code <= 0x1fffff) return '0000';
  if(code <= 0x3ffffff) return '00000';
  return '000000';
}

function utf8Length(str){
  if (str.length > 600) {
    // Blob method faster for large strings
    return (new Blob([str])).size;
  } else {
    return str.replace(/[^\u0000-\u007F]/g, _utf8Replace).length;
  }
}
/**
 * Light EventEmitter. Ported from Node.js/events.js
 * Eric Zhang
 */

/**
 * EventEmitter class
 * Creates an object with event registering and firing methods
 */
function EventEmitter() {
  // Initialise required storage variables
  this._events = {};
}

var isArray = Array.isArray;


EventEmitter.prototype.addListener = function(type, listener, scope, once) {
  if ('function' !== typeof listener) {
    throw new Error('addListener only takes instances of Function');
  }
  
  // To avoid recursion in the case that type == "newListeners"! Before
  // adding it to the listeners, first emit "newListeners".
  this.emit('newListener', type, typeof listener.listener === 'function' ?
            listener.listener : listener);
            
  if (!this._events[type]) {
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  } else if (isArray(this._events[type])) {

    // If we've already got an array, just append.
    this._events[type].push(listener);

  } else {
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];
  }
  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener, scope) {
  if ('function' !== typeof listener) {
    throw new Error('.once only takes instances of Function');
  }

  var self = this;
  function g() {
    self.removeListener(type, g);
    listener.apply(this, arguments);
  };

  g.listener = listener;
  self.on(type, g);

  return this;
};

EventEmitter.prototype.removeListener = function(type, listener, scope) {
  if ('function' !== typeof listener) {
    throw new Error('removeListener only takes instances of Function');
  }

  // does not use listeners(), so no side effect of creating _events[type]
  if (!this._events[type]) return this;

  var list = this._events[type];

  if (isArray(list)) {
    var position = -1;
    for (var i = 0, length = list.length; i < length; i++) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener))
      {
        position = i;
        break;
      }
    }

    if (position < 0) return this;
    list.splice(position, 1);
    if (list.length == 0)
      delete this._events[type];
  } else if (list === listener ||
             (list.listener && list.listener === listener))
  {
    delete this._events[type];
  }

  return this;
};


EventEmitter.prototype.off = EventEmitter.prototype.removeListener;


EventEmitter.prototype.removeAllListeners = function(type) {
  if (arguments.length === 0) {
    this._events = {};
    return this;
  }

  // does not use listeners(), so no side effect of creating _events[type]
  if (type && this._events && this._events[type]) this._events[type] = null;
  return this;
};

EventEmitter.prototype.listeners = function(type) {
  if (!this._events[type]) this._events[type] = [];
  if (!isArray(this._events[type])) {
    this._events[type] = [this._events[type]];
  }
  return this._events[type];
};

EventEmitter.prototype.emit = function(type) {
  var type = arguments[0];
  var handler = this._events[type];
  if (!handler) return false;

  if (typeof handler == 'function') {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        var l = arguments.length;
        var args = new Array(l - 1);
        for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
    return true;

  } else if (isArray(handler)) {
    var l = arguments.length;
    var args = new Array(l - 1);
    for (var i = 1; i < l; i++) args[i - 1] = arguments[i];

    var listeners = handler.slice();
    for (var i = 0, l = listeners.length; i < l; i++) {
      listeners[i].apply(this, args);
    }
    return true;
  } else {
    return false;
  }
};



/**
 * Reliable transfer for Chrome Canary DataChannel impl.
 * Author: @michellebu
 */
function Reliable(dc, debug) {
  if (!(this instanceof Reliable)) return new Reliable(dc);
  this._dc = dc;

  util.debug = debug;

  // Messages sent/received so far.
  // id: { ack: n, chunks: [...] }
  this._outgoing = {};
  // id: { ack: ['ack', id, n], chunks: [...] }
  this._incoming = {};
  this._received = {};

  // Window size.
  this._window = 1000;
  // MTU.
  this._mtu = 500;
  // Interval for setInterval. In ms.
  this._interval = 0;

  // Messages sent.
  this._count = 0;

  // Outgoing message queue.
  this._queue = [];

  this._setupDC();
};

// Send a message reliably.
Reliable.prototype.send = function(msg) {
  // Determine if chunking is necessary.
  var bl = util.pack(msg);
  if (bl.size < this._mtu) {
    this._handleSend(['no', bl]);
    return;
  }

  this._outgoing[this._count] = {
    ack: 0,
    chunks: this._chunk(bl)
  };

  if (util.debug) {
    this._outgoing[this._count].timer = new Date();
  }

  // Send prelim window.
  this._sendWindowedChunks(this._count);
  this._count += 1;
};

// Set up interval for processing queue.
Reliable.prototype._setupInterval = function() {
  // TODO: fail gracefully.

  var self = this;
  this._timeout = setInterval(function() {
    // FIXME: String stuff makes things terribly async.
    var msg = self._queue.shift();
    if (msg._multiple) {
      for (var i = 0, ii = msg.length; i < ii; i += 1) {
        self._intervalSend(msg[i]);
      }
    } else {
      self._intervalSend(msg);
    }
  }, this._interval);
};

Reliable.prototype._intervalSend = function(msg) {
  var self = this;
  msg = util.pack(msg);
  util.blobToBinaryString(msg, function(str) {
    self._dc.send(str);
  });
  if (self._queue.length === 0) {
    clearTimeout(self._timeout);
    self._timeout = null;
    //self._processAcks();
  }
};

// Go through ACKs to send missing pieces.
Reliable.prototype._processAcks = function() {
  for (var id in this._outgoing) {
    if (this._outgoing.hasOwnProperty(id)) {
      this._sendWindowedChunks(id);
    }
  }
};

// Handle sending a message.
// FIXME: Don't wait for interval time for all messages...
Reliable.prototype._handleSend = function(msg) {
  var push = true;
  for (var i = 0, ii = this._queue.length; i < ii; i += 1) {
    var item = this._queue[i];
    if (item === msg) {
      push = false;
    } else if (item._multiple && item.indexOf(msg) !== -1) {
      push = false;
    }
  }
  if (push) {
    this._queue.push(msg);
    if (!this._timeout) {
      this._setupInterval();
    }
  }
};

// Set up DataChannel handlers.
Reliable.prototype._setupDC = function() {
  // Handle various message types.
  var self = this;
  this._dc.onmessage = function(e) {
    var msg = e.data;
    var datatype = msg.constructor;
    // FIXME: msg is String until binary is supported.
    // Once that happens, this will have to be smarter.
    if (datatype === String) {
      var ab = util.binaryStringToArrayBuffer(msg);
      msg = util.unpack(ab);
      self._handleMessage(msg);
    }
  };
};

// Handles an incoming message.
Reliable.prototype._handleMessage = function(msg) {
  var id = msg[1];
  var idata = this._incoming[id];
  var odata = this._outgoing[id];
  var data;
  switch (msg[0]) {
    // No chunking was done.
    case 'no':
      var message = id;
      if (!!message) {
        this.onmessage(util.unpack(message));
      }
      break;
    // Reached the end of the message.
    case 'end':
      data = idata;

      // In case end comes first.
      this._received[id] = msg[2];

      if (!data) {
        break;
      }

      this._ack(id);
      break;
    case 'ack':
      data = odata;
      if (!!data) {
        var ack = msg[2];
        // Take the larger ACK, for out of order messages.
        data.ack = Math.max(ack, data.ack);

        // Clean up when all chunks are ACKed.
        if (data.ack >= data.chunks.length) {
          util.log('Time: ', new Date() - data.timer);
          delete this._outgoing[id];
        } else {
          this._processAcks();
        }
      }
      // If !data, just ignore.
      break;
    // Received a chunk of data.
    case 'chunk':
      // Create a new entry if none exists.
      data = idata;
      if (!data) {
        var end = this._received[id];
        if (end === true) {
          break;
        }
        data = {
          ack: ['ack', id, 0],
          chunks: []
        };
        this._incoming[id] = data;
      }

      var n = msg[2];
      var chunk = msg[3];
      data.chunks[n] = new Uint8Array(chunk);

      // If we get the chunk we're looking for, ACK for next missing.
      // Otherwise, ACK the same N again.
      if (n === data.ack[2]) {
        this._calculateNextAck(id);
      }
      this._ack(id);
      break;
    default:
      // Shouldn't happen, but would make sense for message to just go
      // through as is.
      this._handleSend(msg);
      break;
  }
};

// Chunks BL into smaller messages.
Reliable.prototype._chunk = function(bl) {
  var chunks = [];
  var size = bl.size;
  var start = 0;
  while (start < size) {
    var end = Math.min(size, start + this._mtu);
    var b = bl.slice(start, end);
    var chunk = {
      payload: b
    }
    chunks.push(chunk);
    start = end;
  }
  util.log('Created', chunks.length, 'chunks.');
  return chunks;
};

// Sends ACK N, expecting Nth blob chunk for message ID.
Reliable.prototype._ack = function(id) {
  var ack = this._incoming[id].ack;

  // if ack is the end value, then call _complete.
  if (this._received[id] === ack[2]) {
    this._complete(id);
    this._received[id] = true;
  }

  this._handleSend(ack);
};

// Calculates the next ACK number, given chunks.
Reliable.prototype._calculateNextAck = function(id) {
  var data = this._incoming[id];
  var chunks = data.chunks;
  for (var i = 0, ii = chunks.length; i < ii; i += 1) {
    // This chunk is missing!!! Better ACK for it.
    if (chunks[i] === undefined) {
      data.ack[2] = i;
      return;
    }
  }
  data.ack[2] = chunks.length;
};

// Sends the next window of chunks.
Reliable.prototype._sendWindowedChunks = function(id) {
  util.log('sendWindowedChunks for: ', id);
  var data = this._outgoing[id];
  var ch = data.chunks;
  var chunks = [];
  var limit = Math.min(data.ack + this._window, ch.length);
  for (var i = data.ack; i < limit; i += 1) {
    if (!ch[i].sent || i === data.ack) {
      ch[i].sent = true;
      chunks.push(['chunk', id, i, ch[i].payload]);
    }
  }
  if (data.ack + this._window >= ch.length) {
    chunks.push(['end', id, ch.length])
  }
  chunks._multiple = true;
  this._handleSend(chunks);
};

// Puts together a message from chunks.
Reliable.prototype._complete = function(id) {
  util.log('Completed called for', id);
  var self = this;
  var chunks = this._incoming[id].chunks;
  var bl = new Blob(chunks);
  util.blobToArrayBuffer(bl, function(ab) {
    self.onmessage(util.unpack(ab));
  });
  delete this._incoming[id];
};

// Ups bandwidth limit on SDP. Meant to be called during offer/answer.
Reliable.higherBandwidthSDP = function(sdp) {
  // AS stands for Application-Specific Maximum.
  // Bandwidth number is in kilobits / sec.
  // See RFC for more info: http://www.ietf.org/rfc/rfc2327.txt

  // Chrome 31+ doesn't want us munging the SDP, so we'll let them have their
  // way.
  var version = navigator.appVersion.match(/Chrome\/(.*?) /);
  if (version) {
    version = parseInt(version[1].split('.').shift());
    if (version < 31) {
      var parts = sdp.split('b=AS:30');
      var replace = 'b=AS:102400'; // 100 Mbps
      if (parts.length > 1) {
        return parts[0] + replace + parts[1];
      }
    }
  }

  return sdp;
};

// Overwritten, typically.
Reliable.prototype.onmessage = function(msg) {};

exports.Reliable = Reliable;
exports.RTCSessionDescription = window.mozRTCSessionDescription || window.RTCSessionDescription;
exports.RTCPeerConnection = window.mozRTCPeerConnection || window.webkitRTCPeerConnection || window.RTCPeerConnection;
exports.RTCIceCandidate = window.mozRTCIceCandidate || window.RTCIceCandidate;
var defaultConfig = {'iceServers': [{ 'url': 'stun:stun.l.google.com:19302' }]};
var dataCount = 1;

var util = {
  noop: function() {},

  CLOUD_HOST: '0.peerjs.com',
  CLOUD_PORT: 9000,

  // Browsers that need chunking:
  chunkedBrowsers: {'Chrome': 1},
  chunkedMTU: 16300, // The original 60000 bytes setting does not work when sending data from Firefox to Chrome, which is "cut off" after 16384 bytes and delivered individually.

  // Logging logic
  logLevel: 0,
  setLogLevel: function(level) {
    var debugLevel = parseInt(level, 10);
    if (!isNaN(parseInt(level, 10))) {
      util.logLevel = debugLevel;
    } else {
      // If they are using truthy/falsy values for debug
      util.logLevel = level ? 3 : 0;
    }
    util.log = util.warn = util.error = util.noop;
    if (util.logLevel > 0) {
      util.error = util._printWith('ERROR');
    }
    if (util.logLevel > 1) {
      util.warn = util._printWith('WARNING');
    }
    if (util.logLevel > 2) {
      util.log = util._print;
    }
  },
  setLogFunction: function(fn) {
    if (fn.constructor !== Function) {
      util.warn('The log function you passed in is not a function. Defaulting to regular logs.');
    } else {
      util._print = fn;
    }
  },

  _printWith: function(prefix) {
    return function() {
      var copy = Array.prototype.slice.call(arguments);
      copy.unshift(prefix);
      util._print.apply(util, copy);
    };
  },
  _print: function () {
    var err = false;
    var copy = Array.prototype.slice.call(arguments);
    copy.unshift('PeerJS: ');
    for (var i = 0, l = copy.length; i < l; i++){
      if (copy[i] instanceof Error) {
        copy[i] = '(' + copy[i].name + ') ' + copy[i].message;
        err = true;
      }
    }
    err ? console.error.apply(console, copy) : console.log.apply(console, copy);  
  },
  //

  // Returns browser-agnostic default config
  defaultConfig: defaultConfig,
  //

  // Returns the current browser.
  browser: (function() {
    if (window.mozRTCPeerConnection) {
      return 'Firefox';
    } else if (window.webkitRTCPeerConnection) {
      return 'Chrome';
    } else if (window.RTCPeerConnection) {
      return 'Supported';
    } else {
      return 'Unsupported';
    }
  })(),
  //

  // Lists which features are supported
  supports: (function() {
    if (typeof RTCPeerConnection === 'undefined') {
      return {};
    }

    var data = true;
    var audioVideo = true;

    var binaryBlob = false;
    var sctp = false;
    var onnegotiationneeded = !!window.webkitRTCPeerConnection;

    var pc, dc;
    try {
      pc = new RTCPeerConnection(defaultConfig, {optional: [{RtpDataChannels: true}]});
    } catch (e) {
      data = false;
      audioVideo = false;
    }

    if (data) {
      try {
        dc = pc.createDataChannel('_PEERJSTEST');
      } catch (e) {
        data = false;
      }
    }

    if (data) {
      // Binary test
      try {
        dc.binaryType = 'blob';
        binaryBlob = true;
      } catch (e) {
      }

      // Reliable test.
      // Unfortunately Chrome is a bit unreliable about whether or not they
      // support reliable.
      var reliablePC = new RTCPeerConnection(defaultConfig, {});
      try {
        var reliableDC = reliablePC.createDataChannel('_PEERJSRELIABLETEST', {});
        sctp = reliableDC.reliable;
      } catch (e) {
      }
      reliablePC.close();
    }

    // FIXME: not really the best check...
    if (audioVideo) {
      audioVideo = !!pc.addStream;
    }

    // FIXME: this is not great because in theory it doesn't work for
    // av-only browsers (?).
    if (!onnegotiationneeded && data) {
      // sync default check.
      var negotiationPC = new RTCPeerConnection(defaultConfig, {optional: [{RtpDataChannels: true}]});
      negotiationPC.onnegotiationneeded = function() {
        onnegotiationneeded = true;
        // async check.
        if (util && util.supports) {
          util.supports.onnegotiationneeded = true;
        }
      };
      var negotiationDC = negotiationPC.createDataChannel('_PEERJSNEGOTIATIONTEST');

      setTimeout(function() {
        negotiationPC.close();
      }, 1000);
    }

    if (pc) {
      pc.close();
    }

    return {
      audioVideo: audioVideo,
      data: data,
      binaryBlob: binaryBlob,
      binary: sctp, // deprecated; sctp implies binary support.
      reliable: sctp, // deprecated; sctp implies reliable data.
      sctp: sctp,
      onnegotiationneeded: onnegotiationneeded
    };
  }()),
  //

  // Ensure alphanumeric ids
  validateId: function(id) {
    // Allow empty ids
    return !id || /^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/.exec(id);
  },

  validateKey: function(key) {
    // Allow empty keys
    return !key || /^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/.exec(key);
  },


  debug: false,

  inherits: function(ctor, superCtor) {
    ctor.super_ = superCtor;
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  },
  extend: function(dest, source) {
    for(var key in source) {
      if(source.hasOwnProperty(key)) {
        dest[key] = source[key];
      }
    }
    return dest;
  },
  pack: BinaryPack.pack,
  unpack: BinaryPack.unpack,

  log: function () {
    if (util.debug) {
      var err = false;
      var copy = Array.prototype.slice.call(arguments);
      copy.unshift('PeerJS: ');
      for (var i = 0, l = copy.length; i < l; i++){
        if (copy[i] instanceof Error) {
          copy[i] = '(' + copy[i].name + ') ' + copy[i].message;
          err = true;
        }
      }
      err ? console.error.apply(console, copy) : console.log.apply(console, copy);
    }
  },

  setZeroTimeout: (function(global) {
    var timeouts = [];
    var messageName = 'zero-timeout-message';

    // Like setTimeout, but only takes a function argument.	 There's
    // no time argument (always zero) and no arguments (you have to
    // use a closure).
    function setZeroTimeoutPostMessage(fn) {
      timeouts.push(fn);
      global.postMessage(messageName, '*');
    }

    function handleMessage(event) {
      if (event.source == global && event.data == messageName) {
        if (event.stopPropagation) {
          event.stopPropagation();
        }
        if (timeouts.length) {
          timeouts.shift()();
        }
      }
    }
    if (global.addEventListener) {
      global.addEventListener('message', handleMessage, true);
    } else if (global.attachEvent) {
      global.attachEvent('onmessage', handleMessage);
    }
    return setZeroTimeoutPostMessage;
  }(this)),

  // Binary stuff

  // chunks a blob.
  chunk: function(bl) {
    var chunks = [];
    var size = bl.size;
    var start = index = 0;
    var total = Math.ceil(size / util.chunkedMTU);
    while (start < size) {
      var end = Math.min(size, start + util.chunkedMTU);
      var b = bl.slice(start, end);

      var chunk = {
        __peerData: dataCount,
        n: index,
        data: b,
        total: total
      };

      chunks.push(chunk);

      start = end;
      index += 1;
    }
    dataCount += 1;
    return chunks;
  },

  blobToArrayBuffer: function(blob, cb){
    var fr = new FileReader();
    fr.onload = function(evt) {
      cb(evt.target.result);
    };
    fr.readAsArrayBuffer(blob);
  },
  blobToBinaryString: function(blob, cb){
    var fr = new FileReader();
    fr.onload = function(evt) {
      cb(evt.target.result);
    };
    fr.readAsBinaryString(blob);
  },
  binaryStringToArrayBuffer: function(binary) {
    var byteArray = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) {
      byteArray[i] = binary.charCodeAt(i) & 0xff;
    }
    return byteArray.buffer;
  },
  randomToken: function () {
    return Math.random().toString(36).substr(2);
  },
  //

  isSecure: function() {
    return location.protocol === 'https:';
  }
};

exports.util = util;
/**
 * A peer who can initiate connections with other peers.
 */
function Peer(id, options) {
  if (!(this instanceof Peer)) return new Peer(id, options);
  EventEmitter.call(this);

  // Deal with overloading
  if (id && id.constructor == Object) {
    options = id;
    id = undefined;
  } else if (id) {
    // Ensure id is a string
    id = id.toString();
  }
  //

  // Configurize options
  options = util.extend({
    debug: 0, // 1: Errors, 2: Warnings, 3: All logs
    host: util.CLOUD_HOST,
    port: util.CLOUD_PORT,
    key: 'peerjs',
    path: '/',
    config: util.defaultConfig
  }, options);
  this.options = options;
  // Detect relative URL host.
  if (options.host === '/') {
    options.host = window.location.hostname;
  }
  // Set path correctly.
  if (options.path[0] !== '/') {
    options.path = '/' + options.path;
  }
  if (options.path[options.path.length - 1] !== '/') {
    options.path += '/';
  }

  // Set whether we use SSL to same as current host
  if (options.secure === undefined && options.host !== util.CLOUD_HOST) {
    options.secure = util.isSecure();
  }
  // Set a custom log function if present
  if (options.logFunction) {
    util.setLogFunction(options.logFunction);
  }
  util.setLogLevel(options.debug);
  //

  // Sanity checks
  // Ensure WebRTC supported
  if (!util.supports.audioVideo && !util.supports.data ) {
    this._delayedAbort('browser-incompatible', 'The current browser does not support WebRTC');
    return;
  }
  // Ensure alphanumeric id
  if (!util.validateId(id)) {
    this._delayedAbort('invalid-id', 'ID "' + id + '" is invalid');
    return;
  }
  // Ensure valid key
  if (!util.validateKey(options.key)) {
    this._delayedAbort('invalid-key', 'API KEY "' + options.key + '" is invalid');
    return;
  }
  // Ensure not using unsecure cloud server on SSL page
  if (options.secure && options.host === '0.peerjs.com') {
    this._delayedAbort('ssl-unavailable',
      'The cloud server currently does not support HTTPS. Please run your own PeerServer to use HTTPS.');
    return;
  }
  //

  // States.
  this.destroyed = false; // Connections have been killed
  this.disconnected = false; // Connection to PeerServer killed manually but P2P connections still active
  this.open = false; // Sockets and such are not yet open.
  //

  // References
  this.connections = {}; // DataConnections for this peer.
  this._lostMessages = {}; // src => [list of messages]
  //

  // Initialize the 'socket' (which is actually a mix of XHR streaming and
  // websockets.)
  var self = this;
  this.socket = new Socket(this.options.secure, this.options.host, this.options.port, this.options.path, this.options.key);
  this.socket.on('message', function(data) {
    self._handleMessage(data);
  });
  this.socket.on('error', function(error) {
    self._abort('socket-error', error);
  });
  this.socket.on('close', function() {
    if (!self.disconnected) { // If we haven't explicitly disconnected, emit error.
      self._abort('socket-closed', 'Underlying socket is already closed.');
    }
  });
  //

  // Start the connections
  if (id) {
    this._initialize(id);
  } else {
    this._retrieveId();
  }
  //
};

util.inherits(Peer, EventEmitter);

/** Get a unique ID from the server via XHR. */
Peer.prototype._retrieveId = function(cb) {
  var self = this;
  var http = new XMLHttpRequest();
  var protocol = this.options.secure ? 'https://' : 'http://';
  var url = protocol + this.options.host + ':' + this.options.port
    + this.options.path + this.options.key + '/id';
  var queryString = '?ts=' + new Date().getTime() + '' + Math.random();
  url += queryString;

  // If there's no ID we need to wait for one before trying to init socket.
  http.open('get', url, true);
  http.onerror = function(e) {
    util.error('Error retrieving ID', e);
    var pathError = '';
    if (self.options.path === '/' && self.options.host !== util.CLOUD_HOST) {
      pathError = ' If you passed in a `path` to your self-hosted PeerServer, '
        + 'you\'ll also need to pass in that same path when creating a new'
        + ' Peer.';
    }
    self._abort('server-error', 'Could not get an ID from the server.' + pathError);
  }
  http.onreadystatechange = function() {
    if (http.readyState !== 4) {
      return;
    }
    if (http.status !== 200) {
      http.onerror();
      return;
    }
    self._initialize(http.responseText);
  };
  http.send(null);
};

/** Initialize a connection with the server. */
Peer.prototype._initialize = function(id) {
  var self = this;
  this.id = id;
  this.socket.start(this.id);
}

/** Handles messages from the server. */
Peer.prototype._handleMessage = function(message) {
  var type = message.type;
  var payload = message.payload;
  var peer = message.src;

  switch (type) {
    case 'OPEN': // The connection to the server is open.
      this.emit('open', this.id);
      this.open = true;
      break;
    case 'ERROR': // Server error.
      this._abort('server-error', payload.msg);
      break;
    case 'ID-TAKEN': // The selected ID is taken.
      this._abort('unavailable-id', 'ID `' + this.id + '` is taken');
      break;
    case 'INVALID-KEY': // The given API key cannot be found.
      this._abort('invalid-key', 'API KEY "' + this.options.key + '" is invalid');
      break;

    //
    case 'LEAVE': // Another peer has closed its connection to this peer.
      util.log('Received leave message from', peer);
      this._cleanupPeer(peer);
      break;

    case 'EXPIRE': // The offer sent to a peer has expired without response.
      this.emit('error', new Error('Could not connect to peer ' + peer));
      break;
    case 'OFFER': // we should consider switching this to CALL/CONNECT, but this is the least breaking option.
      var connectionId = payload.connectionId;
      var connection = this.getConnection(peer, connectionId);

      if (connection) {
        util.warn('Offer received for existing Connection ID:', connectionId);
        //connection.handleMessage(message);
      } else {
        // Create a new connection.
        if (payload.type === 'media') {
          var connection = new MediaConnection(peer, this, {
            connectionId: connectionId,
            _payload: payload,
            metadata: payload.metadata
          });
          this._addConnection(peer, connection);
          this.emit('call', connection);
        } else if (payload.type === 'data') {
          connection = new DataConnection(peer, this, {
            connectionId: connectionId,
            _payload: payload,
            metadata: payload.metadata,
            label: payload.label,
            serialization: payload.serialization,
            reliable: payload.reliable
          });
          this._addConnection(peer, connection);
          this.emit('connection', connection);
        } else {
          util.warn('Received malformed connection type:', payload.type);
          return;
        }
        // Find messages.
        var messages = this._getMessages(connectionId);
        for (var i = 0, ii = messages.length; i < ii; i += 1) {
          connection.handleMessage(messages[i]);
        }
      }
      break;
    default:
      if (!payload) {
        util.warn('You received a malformed message from ' + peer + ' of type ' + type);
        return;
      }

      var id = payload.connectionId;
      var connection = this.getConnection(peer, id);

      if (connection && connection.pc) {
        // Pass it on.
        connection.handleMessage(message);
      } else if (id) {
        // Store for possible later use
        this._storeMessage(id, message);
      } else {
        util.warn('You received an unrecognized message:', message);
      }
      break;
  }
}

/** Stores messages without a set up connection, to be claimed later. */
Peer.prototype._storeMessage = function(connectionId, message) {
  if (!this._lostMessages[connectionId]) {
    this._lostMessages[connectionId] = [];
  }
  this._lostMessages[connectionId].push(message);
}

/** Retrieve messages from lost message store */
Peer.prototype._getMessages = function(connectionId) {
  var messages = this._lostMessages[connectionId];
  if (messages) {
    delete this._lostMessages[connectionId];
    return messages;
  } else {
    return [];
  }
}

/**
 * Returns a DataConnection to the specified peer. See documentation for a
 * complete list of options.
 */
Peer.prototype.connect = function(peer, options) {
  if (this.disconnected) {
    util.warn('You cannot connect to a new Peer because you called '
        + '.disconnect() on this Peer and ended your connection with the'
        + ' server. You can create a new Peer to reconnect.');
    this.emit('error', new Error('Cannot connect to new Peer after disconnecting from server.'));
    return;
  }
  var connection = new DataConnection(peer, this, options);
  this._addConnection(peer, connection);
  return connection;
}

/**
 * Returns a MediaConnection to the specified peer. See documentation for a
 * complete list of options.
 */
Peer.prototype.call = function(peer, stream, options) {
  if (this.disconnected) {
    util.warn('You cannot connect to a new Peer because you called '
        + '.disconnect() on this Peer and ended your connection with the'
        + ' server. You can create a new Peer to reconnect.');
    this.emit('error', new Error('Cannot connect to new Peer after disconnecting from server.'));
    return;
  }
  if (!stream) {
    util.error('To call a peer, you must provide a stream from your browser\'s `getUserMedia`.');
    return;
  }
  options = options || {};
  options._stream = stream;
  var call = new MediaConnection(peer, this, options);
  this._addConnection(peer, call);
  return call;
}

/** Add a data/media connection to this peer. */
Peer.prototype._addConnection = function(peer, connection) {
  if (!this.connections[peer]) {
    this.connections[peer] = [];
  }
  this.connections[peer].push(connection);
}

/** Retrieve a data/media connection for this peer. */
Peer.prototype.getConnection = function(peer, id) {
  var connections = this.connections[peer];
  if (!connections) {
    return null;
  }
  for (var i = 0, ii = connections.length; i < ii; i++) {
    if (connections[i].id === id) {
      return connections[i];
    }
  }
  return null;
}

Peer.prototype._delayedAbort = function(type, message) {
  var self = this;
  util.setZeroTimeout(function(){
    self._abort(type, message);
  });
}

/** Destroys the Peer and emits an error message. */
Peer.prototype._abort = function(type, message) {
  util.error('Aborting. Error:', message);
  var err = new Error(message);
  err.type = type;
  this.destroy();
  this.emit('error', err);
};

/**
 * Destroys the Peer: closes all active connections as well as the connection
 *  to the server.
 * Warning: The peer can no longer create or accept connections after being
 *  destroyed.
 */
Peer.prototype.destroy = function() {
  if (!this.destroyed) {
    this._cleanup();
    this.disconnect();
    this.destroyed = true;
  }
}


/** Disconnects every connection on this peer. */
Peer.prototype._cleanup = function() {
  if (this.connections) {
    var peers = Object.keys(this.connections);
    for (var i = 0, ii = peers.length; i < ii; i++) {
      this._cleanupPeer(peers[i]);
    }
  }
  this.emit('close');
}

/** Closes all connections to this peer. */
Peer.prototype._cleanupPeer = function(peer) {
  var connections = this.connections[peer];
  for (var j = 0, jj = connections.length; j < jj; j += 1) {
    connections[j].close();
  }
}

/**
 * Disconnects the Peer's connection to the PeerServer. Does not close any
 *  active connections.
 * Warning: The peer can no longer create or accept connections after being
 *  disconnected. It also cannot reconnect to the server.
 */
Peer.prototype.disconnect = function() {
  var self = this;
  util.setZeroTimeout(function(){
    if (!self.disconnected) {
      self.disconnected = true;
      self.open = false;
      if (self.socket) {
        self.socket.close();
      }
      self.id = null;
    }
  });
}

/**
 * Get a list of available peer IDs. If you're running your own server, you'll
 * want to set allow_discovery: true in the PeerServer options. If you're using
 * the cloud server, email team@peerjs.com to get the functionality enabled for
 * your key.
 */
Peer.prototype.listAllPeers = function(cb) {
  cb = cb || function() {};
  var self = this;
  var http = new XMLHttpRequest();
  var protocol = this.options.secure ? 'https://' : 'http://';
  var url = protocol + this.options.host + ':' + this.options.port
    + this.options.path + this.options.key + '/peers';
  var queryString = '?ts=' + new Date().getTime() + '' + Math.random();
  url += queryString;

  // If there's no ID we need to wait for one before trying to init socket.
  http.open('get', url, true);
  http.onerror = function(e) {
    self._abort('server-error', 'Could not get peers from the server.');
    cb([]);
  }
  http.onreadystatechange = function() {
    if (http.readyState !== 4) {
      return;
    }
    if (http.status === 401) {
      var helpfulError = '';
      if (self.options.host !== util.CLOUD_HOST) {
        helpfulError = 'It looks like you\'re using the cloud server. You can email '
          + 'team@peerjs.com to enable peer listing for your API key.';
      } else {
        helpfulError = 'You need to enable `allow_discovery` on your self-hosted'
          + ' PeerServer to use this feature.';
      }
      throw new Error('It doesn\'t look like you have permission to list peers IDs. ' + helpfulError);
      cb([]);
    } else if (http.status !== 200) {
      cb([]);
    } else {
      cb(JSON.parse(http.responseText));
    }
  };
  http.send(null);
}

exports.Peer = Peer;
/**
 * Wraps a DataChannel between two Peers.
 */
function DataConnection(peer, provider, options) {
  if (!(this instanceof DataConnection)) return new DataConnection(peer, provider, options);
  EventEmitter.call(this);

  this.options = util.extend({
    serialization: 'binary',
    reliable: false
  }, options);

  // Connection is not open yet.
  this.open = false;
  this.type = 'data';
  this.peer = peer;
  this.provider = provider;

  this.id = this.options.connectionId || DataConnection._idPrefix + util.randomToken();

  this.label = this.options.label || this.id;
  this.metadata = this.options.metadata;
  this.serialization = this.options.serialization;
  this.reliable = this.options.reliable;

  // Data channel buffering.
  this._buffer = [];
  this._buffering = false;
  this.bufferSize = 0;

  // For storing large data.
  this._chunkedData = {};

  if (this.options._payload) {
    this._peerBrowser = this.options._payload.browser;
  }

  Negotiator.startConnection(
    this,
    this.options._payload || {
      originator: true
    }
  );
}

util.inherits(DataConnection, EventEmitter);

DataConnection._idPrefix = 'dc_';

/** Called by the Negotiator when the DataChannel is ready. */
DataConnection.prototype.initialize = function(dc) {
  this._dc = this.dataChannel = dc;
  this._configureDataChannel();
}

DataConnection.prototype._configureDataChannel = function() {
  var self = this;
  if (util.supports.sctp) {
    this._dc.binaryType = 'arraybuffer';
  }
  this._dc.onopen = function() {
    util.log('Data channel connection success');
    self.open = true;
    self.emit('open');
  }

  // Use the Reliable shim for non Firefox browsers
  if (!util.supports.sctp && this.reliable) {
    this._reliable = new Reliable(this._dc, util.debug);
  }

  if (this._reliable) {
    this._reliable.onmessage = function(msg) {
      self.emit('data', msg);
    };
  } else {
    this._dc.onmessage = function(e) {
      self._handleDataMessage(e);
    };
  }
  this._dc.onclose = function(e) {
    util.log('DataChannel closed for:', self.peer);
    self.close();
  };
}

// Handles a DataChannel message.
DataConnection.prototype._handleDataMessage = function(e) {
  var self = this;
  var data = e.data;
  var datatype = data.constructor;
  if (this.serialization === 'binary' || this.serialization === 'binary-utf8') {
    if (datatype === Blob) {
      // Datatype should never be blob
      util.blobToArrayBuffer(data, function(ab) {
        data = util.unpack(ab);
        self.emit('data', data);
      });
      return;
    } else if (datatype === ArrayBuffer) {
      data = util.unpack(data);
    } else if (datatype === String) {
      // String fallback for binary data for browsers that don't support binary yet
      var ab = util.binaryStringToArrayBuffer(data);
      data = util.unpack(ab);
    }
  } else if (this.serialization === 'json') {
    data = JSON.parse(data);
  }

  // Check if we've chunked--if so, piece things back together.
  // We're guaranteed that this isn't 0.
  if (data.__peerData) {
    var id = data.__peerData;
    var chunkInfo = this._chunkedData[id] || {data: [], count: 0, total: data.total};

    chunkInfo.data[data.n] = data.data;
    chunkInfo.count += 1;

    if (chunkInfo.total === chunkInfo.count) {
      // We've received all the chunks--time to construct the complete data.
      data = new Blob(chunkInfo.data);
      this._handleDataMessage({data: data});

      // We can also just delete the chunks now.
      delete this._chunkedData[id];
    }

    this._chunkedData[id] = chunkInfo;
    return;
  }

  this.emit('data', data);
}

/**
 * Exposed functionality for users.
 */

/** Allows user to close connection. */
DataConnection.prototype.close = function() {
  if (!this.open) {
    return;
  }
  this.open = false;
  Negotiator.cleanup(this);
  this.emit('close');
}

/** Allows user to send data. */
DataConnection.prototype.send = function(data, chunked) {
  if (!this.open) {
    this.emit('error', new Error('Connection is not open. You should listen for the `open` event before sending messages.'));
    return;
  }
  if (this._reliable) {
    // Note: reliable shim sending will make it so that you cannot customize
    // serialization.
    this._reliable.send(data);
    return;
  }
  var self = this;
  if (this.serialization === 'json') {
    this._bufferedSend(JSON.stringify(data));
  } else if (this.serialization === 'binary' || this.serialization === 'binary-utf8') {
    var blob = util.pack(data);

    // For Chrome-Firefox interoperability, we need to make Firefox "chunk"
    // the data it sends out.
    var needsChunking = util.chunkedBrowsers[this._peerBrowser] || util.chunkedBrowsers[util.browser];
    if (needsChunking && !chunked && blob.size > util.chunkedMTU) {
      this._sendChunks(blob);
      return;
    }

    // DataChannel currently only supports strings.
    if (!util.supports.sctp) {
      util.blobToBinaryString(blob, function(str) {
        self._bufferedSend(str);
      });
    } else if (!util.supports.binaryBlob) {
      // We only do this if we really need to (e.g. blobs are not supported),
      // because this conversion is costly.
      util.blobToArrayBuffer(blob, function(ab) {
        self._bufferedSend(ab);
      });
    } else {
      this._bufferedSend(blob);
    }
  } else {
    this._bufferedSend(data);
  }
}

DataConnection.prototype._bufferedSend = function(msg) {
  if (this._buffering || !this._trySend(msg)) {
    this._buffer.push(msg);
    this.bufferSize = this._buffer.length;
  }
}

// Returns true if the send succeeds.
DataConnection.prototype._trySend = function(msg) {
  try {
    this._dc.send(msg);
  } catch (e) {
    this._buffering = true;

    var self = this;
    setTimeout(function() {
      // Try again.
      self._buffering = false;
      self._tryBuffer();
    }, 100);
    return false;
  }
  return true;
}

// Try to send the first message in the buffer.
DataConnection.prototype._tryBuffer = function() {
  if (this._buffer.length === 0) {
    return;
  }

  var msg = this._buffer[0];

  if (this._trySend(msg)) {
    this._buffer.shift();
    this.bufferSize = this._buffer.length;
    this._tryBuffer();
  }
}

DataConnection.prototype._sendChunks = function(blob) {
  var blobs = util.chunk(blob);
  for (var i = 0, ii = blobs.length; i < ii; i += 1) {
    var blob = blobs[i];
    this.send(blob, true);
  }
}

DataConnection.prototype.handleMessage = function(message) {
  var payload = message.payload;

  switch (message.type) {
    case 'ANSWER':
      this._peerBrowser = payload.browser;

      // Forward to negotiator
      Negotiator.handleSDP(message.type, this, payload.sdp);
      break;
    case 'CANDIDATE':
      Negotiator.handleCandidate(this, payload.candidate);
      break;
    default:
      util.warn('Unrecognized message type:', message.type, 'from peer:', this.peer);
      break;
  }
}
/**
 * Wraps the streaming interface between two Peers.
 */
function MediaConnection(peer, provider, options) {
  if (!(this instanceof MediaConnection)) return new MediaConnection(peer, provider, options);
  EventEmitter.call(this);

  this.options = util.extend({}, options);

  this.open = false;
  this.type = 'media';
  this.peer = peer;
  this.provider = provider;
  this.metadata = this.options.metadata;
  this.localStream = this.options._stream;

  this.id = this.options.connectionId || MediaConnection._idPrefix + util.randomToken();
  if (this.localStream) {
    Negotiator.startConnection(
      this,
      {_stream: this.localStream, originator: true}
    );
  }
};

util.inherits(MediaConnection, EventEmitter);

MediaConnection._idPrefix = 'mc_';

MediaConnection.prototype.addStream = function(remoteStream) {
  util.log('Receiving stream', remoteStream);

  this.remoteStream = remoteStream;
  this.emit('stream', remoteStream); // Should we call this `open`?

};

MediaConnection.prototype.handleMessage = function(message) {
  var payload = message.payload;

  switch (message.type) {
    case 'ANSWER':
      // Forward to negotiator
      Negotiator.handleSDP(message.type, this, payload.sdp);
      this.open = true;
      break;
    case 'CANDIDATE':
      Negotiator.handleCandidate(this, payload.candidate);
      break;
    default:
      util.warn('Unrecognized message type:', message.type, 'from peer:', this.peer);
      break;
  }
}

MediaConnection.prototype.answer = function(stream) {
  if (this.localStream) {
    util.warn('Local stream already exists on this MediaConnection. Are you answering a call twice?');
    return;
  }

  this.options._payload._stream = stream;

  this.localStream = stream;
  Negotiator.startConnection(
    this,
    this.options._payload
  )
  // Retrieve lost messages stored because PeerConnection not set up.
  var messages = this.provider._getMessages(this.id);
  for (var i = 0, ii = messages.length; i < ii; i += 1) {
    this.handleMessage(messages[i]);
  }
  this.open = true;
};

/**
 * Exposed functionality for users.
 */

/** Allows user to close connection. */
MediaConnection.prototype.close = function() {
  if (!this.open) {
    return;
  }
  this.open = false;
  Negotiator.cleanup(this);
  this.emit('close')
};
/**
 * Manages all negotiations between Peers.
 */
var Negotiator = {
  pcs: {
    data: {},
    media: {}
  }, // type => {peerId: {pc_id: pc}}.
  //providers: {}, // provider's id => providers (there may be multiple providers/client.
  queue: [] // connections that are delayed due to a PC being in use.
}

Negotiator._idPrefix = 'pc_';

/** Returns a PeerConnection object set up correctly (for data, media). */
Negotiator.startConnection = function(connection, options) {
  var pc = Negotiator._getPeerConnection(connection, options);

  if (connection.type === 'media' && options._stream) {
    // Add the stream.
    pc.addStream(options._stream);
  }

  // Set the connection's PC.
  connection.pc = connection.peerConnection = pc;
  // What do we need to do now?
  if (options.originator) {
    if (connection.type === 'data') {
      // Create the datachannel.
      var config = {};
      // Dropping reliable:false support, since it seems to be crashing
      // Chrome.
      /*if (util.supports.sctp && !options.reliable) {
        // If we have canonical reliable support...
        config = {maxRetransmits: 0};
      }*/
      // Fallback to ensure older browsers don't crash.
      if (!util.supports.sctp) {
        config = {reliable: options.reliable};
      }
      var dc = pc.createDataChannel(connection.label, config);
      connection.initialize(dc);
    }

    if (!util.supports.onnegotiationneeded) {
      Negotiator._makeOffer(connection);
    }
  } else {
    Negotiator.handleSDP('OFFER', connection, options.sdp);
  }
}

Negotiator._getPeerConnection = function(connection, options) {
  if (!Negotiator.pcs[connection.type]) {
    util.error(connection.type + ' is not a valid connection type. Maybe you overrode the `type` property somewhere.');
  }

  if (!Negotiator.pcs[connection.type][connection.peer]) {
    Negotiator.pcs[connection.type][connection.peer] = {};
  }
  var peerConnections = Negotiator.pcs[connection.type][connection.peer];

  var pc;
  // Not multiplexing while FF and Chrome have not-great support for it.
  /*if (options.multiplex) {
    ids = Object.keys(peerConnections);
    for (var i = 0, ii = ids.length; i < ii; i += 1) {
      pc = peerConnections[ids[i]];
      if (pc.signalingState === 'stable') {
        break; // We can go ahead and use this PC.
      }
    }
  } else */
  if (options.pc) { // Simplest case: PC id already provided for us.
    pc = Negotiator.pcs[connection.type][connection.peer][options.pc];
  }

  if (!pc || pc.signalingState !== 'stable') {
    pc = Negotiator._startPeerConnection(connection);
  }
  return pc;
}

/*
Negotiator._addProvider = function(provider) {
  if ((!provider.id && !provider.disconnected) || !provider.socket.open) {
    // Wait for provider to obtain an ID.
    provider.on('open', function(id) {
      Negotiator._addProvider(provider);
    });
  } else {
    Negotiator.providers[provider.id] = provider;
  }
}*/


/** Start a PC. */
Negotiator._startPeerConnection = function(connection) {
  util.log('Creating RTCPeerConnection.');

  var id = Negotiator._idPrefix + util.randomToken();
  var optional = {};

  if (connection.type === 'data' && !util.supports.sctp) {
    optional = {optional: [{RtpDataChannels: true}]};
  } else if (connection.type === 'media') {
    // Interop req for chrome.
    optional = {optional: [{DtlsSrtpKeyAgreement: true}]};
  }

  var pc = new RTCPeerConnection(connection.provider.options.config, optional);
  Negotiator.pcs[connection.type][connection.peer][id] = pc;

  Negotiator._setupListeners(connection, pc, id);

  return pc;
}

/** Set up various WebRTC listeners. */
Negotiator._setupListeners = function(connection, pc, pc_id) {
  var peerId = connection.peer;
  var connectionId = connection.id;
  var provider = connection.provider;

  // ICE CANDIDATES.
  util.log('Listening for ICE candidates.');
  pc.onicecandidate = function(evt) {
    if (evt.candidate) {
      util.log('Received ICE candidates for:', connection.peer);
      provider.socket.send({
        type: 'CANDIDATE',
        payload: {
          candidate: evt.candidate,
          type: connection.type,
          connectionId: connection.id
        },
        dst: peerId
      });
    }
  };

  pc.oniceconnectionstatechange = function() {
    switch (pc.iceConnectionState) {
      case 'disconnected':
      case 'failed':
        util.log('iceConnectionState is disconnected, closing connections to ' + peerId);
        connection.close();
        break;
      case 'completed':
        pc.onicecandidate = util.noop;
        break;
    }
  };

  // Fallback for older Chrome impls.
  pc.onicechange = pc.oniceconnectionstatechange;

  // ONNEGOTIATIONNEEDED (Chrome)
  util.log('Listening for `negotiationneeded`');
  pc.onnegotiationneeded = function() {
    util.log('`negotiationneeded` triggered');
    if (pc.signalingState == 'stable') {
      Negotiator._makeOffer(connection);
    } else {
      util.log('onnegotiationneeded triggered when not stable. Is another connection being established?');
    }
  };

  // DATACONNECTION.
  util.log('Listening for data channel');
  // Fired between offer and answer, so options should already be saved
  // in the options hash.
  pc.ondatachannel = function(evt) {
    util.log('Received data channel');
    var dc = evt.channel;
    var connection = provider.getConnection(peerId, connectionId);
    connection.initialize(dc);
  };

  // MEDIACONNECTION.
  util.log('Listening for remote stream');
  pc.onaddstream = function(evt) {
    util.log('Received remote stream');
    var stream = evt.stream;
    provider.getConnection(peerId, connectionId).addStream(stream);
  };
}

Negotiator.cleanup = function(connection) {
  util.log('Cleaning up PeerConnection to ' + connection.peer);

  var pc = connection.pc;

  if (!!pc && (pc.readyState !== 'closed' || pc.signalingState !== 'closed')) {
    pc.close();
    connection.pc = null;
  }
}

Negotiator._makeOffer = function(connection) {
  var pc = connection.pc;
  pc.createOffer(function(offer) {
    util.log('Created offer.');

    if (!util.supports.sctp && connection.type === 'data' && connection.reliable) {
      offer.sdp = Reliable.higherBandwidthSDP(offer.sdp);
    }

    pc.setLocalDescription(offer, function() {
      util.log('Set localDescription: offer', 'for:', connection.peer);
      connection.provider.socket.send({
        type: 'OFFER',
        payload: {
          sdp: offer,
          type: connection.type,
          label: connection.label,
          connectionId: connection.id,
          reliable: connection.reliable,
          serialization: connection.serialization,
          metadata: connection.metadata,
          browser: util.browser
        },
        dst: connection.peer
      });
    }, function(err) {
      connection.provider.emit('error', err);
      util.log('Failed to setLocalDescription, ', err);
    });
  }, function(err) {
    connection.provider.emit('error', err);
    util.log('Failed to createOffer, ', err);
  }, connection.options.constraints);
}

Negotiator._makeAnswer = function(connection) {
  var pc = connection.pc;

  pc.createAnswer(function(answer) {
    util.log('Created answer.');

    if (!util.supports.sctp && connection.type === 'data' && connection.reliable) {
      answer.sdp = Reliable.higherBandwidthSDP(answer.sdp);
    }

    pc.setLocalDescription(answer, function() {
      util.log('Set localDescription: answer', 'for:', connection.peer);
      connection.provider.socket.send({
        type: 'ANSWER',
        payload: {
          sdp: answer,
          type: connection.type,
          connectionId: connection.id,
          browser: util.browser
        },
        dst: connection.peer
      });
    }, function(err) {
      connection.provider.emit('error', err);
      util.log('Failed to setLocalDescription, ', err);
    });
  }, function(err) {
    connection.provider.emit('error', err);
    util.log('Failed to create answer, ', err);
  });
}

/** Handle an SDP. */
Negotiator.handleSDP = function(type, connection, sdp) {
  sdp = new RTCSessionDescription(sdp);
  var pc = connection.pc;

  util.log('Setting remote description', sdp);
  pc.setRemoteDescription(sdp, function() {
    util.log('Set remoteDescription:', type, 'for:', connection.peer);

    if (type === 'OFFER') {
      Negotiator._makeAnswer(connection);
    }
  }, function(err) {
    connection.provider.emit('error', err);
    util.log('Failed to setRemoteDescription, ', err);
  });
}

/** Handle a candidate. */
Negotiator.handleCandidate = function(connection, ice) {
  var candidate = ice.candidate;
  var sdpMLineIndex = ice.sdpMLineIndex;
  connection.pc.addIceCandidate(new RTCIceCandidate({
    sdpMLineIndex: sdpMLineIndex,
    candidate: candidate
  }));
  util.log('Added ICE candidate for:', connection.peer);
}
/**
 * An abstraction on top of WebSockets and XHR streaming to provide fastest
 * possible connection for peers.
 */
function Socket(secure, host, port, path, key) {
  if (!(this instanceof Socket)) return new Socket(secure, host, port, path, key);

  EventEmitter.call(this);

  // Disconnected manually.
  this.disconnected = false;
  this._queue = [];

  var httpProtocol = secure ? 'https://' : 'http://';
  var wsProtocol = secure ? 'wss://' : 'ws://';
  this._httpUrl = httpProtocol + host + ':' + port + path + key;
  this._wsUrl = wsProtocol + host + ':' + port + path + 'peerjs?key=' + key;
}

util.inherits(Socket, EventEmitter);


/** Check in with ID or get one from server. */
Socket.prototype.start = function(id) {  
  this.id = id;

  var token = util.randomToken();
  this._httpUrl += '/' + id + '/' + token;
  this._wsUrl += '&id='+id+'&token='+token;

  this._startXhrStream();
  this._startWebSocket();
}


/** Start up websocket communications. */
Socket.prototype._startWebSocket = function(id) {
  var self = this;

  if (this._socket) {
    return;
  }

  this._socket = new WebSocket(this._wsUrl);

  this._socket.onmessage = function(event) {
    var data;
    try {
      data = JSON.parse(event.data);
    } catch(e) {
      util.log('Invalid server message', event.data);
      return;
    }
    self.emit('message', data);
  };

  // Take care of the queue of connections if necessary and make sure Peer knows
  // socket is open.
  this._socket.onopen = function() {
    if (self._timeout) {
      clearTimeout(self._timeout);
      setTimeout(function(){
        self._http.abort();
        self._http = null;
      }, 5000);
    }
    self._sendQueuedMessages();
    util.log('Socket open');
  };
}

/** Start XHR streaming. */
Socket.prototype._startXhrStream = function(n) {
  try {
    var self = this;
    this._http = new XMLHttpRequest();
    this._http._index = 1;
    this._http._streamIndex = n || 0;
    this._http.open('post', this._httpUrl + '/id?i=' + this._http._streamIndex, true);
    this._http.onreadystatechange = function() {
      if (this.readyState == 2 && this.old) {
        this.old.abort();
        delete this.old;
      }
      if (this.readyState > 2 && this.status == 200 && this.responseText) {
        self._handleStream(this);
      }
    };
    this._http.send(null);
    this._setHTTPTimeout();
  } catch(e) {
    util.log('XMLHttpRequest not available; defaulting to WebSockets');
  }
}


/** Handles onreadystatechange response as a stream. */
Socket.prototype._handleStream = function(http) {
  // 3 and 4 are loading/done state. All others are not relevant.
  var messages = http.responseText.split('\n');

  // Check to see if anything needs to be processed on buffer.
  if (http._buffer) {
    while (http._buffer.length > 0) {
      var index = http._buffer.shift();
      var bufferedMessage = messages[index];
      try {
        bufferedMessage = JSON.parse(bufferedMessage);
      } catch(e) {
        http._buffer.shift(index);
        break;
      }
      this.emit('message', bufferedMessage);
    }
  }

  var message = messages[http._index];
  if (message) {
    http._index += 1;
    // Buffering--this message is incomplete and we'll get to it next time.
    // This checks if the httpResponse ended in a `\n`, in which case the last
    // element of messages should be the empty string.
    if (http._index === messages.length) {
      if (!http._buffer) {
        http._buffer = [];
      }
      http._buffer.push(http._index - 1);
    } else {
      try {
        message = JSON.parse(message);
      } catch(e) {
        util.log('Invalid server message', message);
        return;
      }
      this.emit('message', message);
    }
  }
}

Socket.prototype._setHTTPTimeout = function() {
  var self = this;
  this._timeout = setTimeout(function() {
    var old = self._http;
    if (!self._wsOpen()) {
      self._startXhrStream(old._streamIndex + 1);
      self._http.old = old;
    } else {
      old.abort();
    }
  }, 25000);
}

/** Is the websocket currently open? */
Socket.prototype._wsOpen = function() {
  return this._socket && this._socket.readyState == 1;
}

/** Send queued messages. */
Socket.prototype._sendQueuedMessages = function() {
  for (var i = 0, ii = this._queue.length; i < ii; i += 1) {
    this.send(this._queue[i]);
  }
}

/** Exposed send for DC & Peer. */
Socket.prototype.send = function(data) {
  if (this.disconnected) {
    return;
  }

  // If we didn't get an ID yet, we can't yet send anything so we should queue
  // up these messages.
  if (!this.id) {
    this._queue.push(data);
    return;
  }

  if (!data.type) {
    this.emit('error', 'Invalid message');
    return;
  }

  var message = JSON.stringify(data);
  if (this._wsOpen()) {
    this._socket.send(message);
  } else {
    var http = new XMLHttpRequest();
    var url = this._httpUrl + '/' + data.type.toLowerCase();
    http.open('post', url, true);
    http.setRequestHeader('Content-Type', 'application/json');
    http.send(message);
  }
}

Socket.prototype.close = function() {
  if (!this.disconnected && this._wsOpen()) {
    this._socket.close();
    this.disconnected = true;
  }
}

})(this);

; browserify_shim__define__module__export__(typeof Peer != "undefined" ? Peer : window.Peer);

}).call(global, undefined, undefined, undefined, undefined, function defineExport(ex) { module.exports = ex; });

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],"peerjs":[function(require,module,exports){
module.exports=require('MVWM4L');
},{}],"rzYpuO":[function(require,module,exports){
(function (global){
;__browserify_shim_require__=require;(function browserifyShim(module, exports, require, define, browserify_shim__define__module__export__) {
(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        //Allow using this built library as an AMD module
        //in another project. That other project will only
        //see this AMD call, not the internal modules in
        //the closure below.
        define([], factory);
    } else {
        //Browser globals case. Just assign the
        //result to a property on the global.
        root.Chord = factory();
    }
}(this, function () {
    //almond, and your modules will be inlined here
/**
* @license almond 0.2.9 Copyright (c) 2011-2014, The Dojo Foundation All Rights Reserved.
* Available via the MIT or new BSD license.
* see: http://github.com/jrburke/almond for details
*/
//Going sloppy to avoid 'use strict' string cost, but strict practices should
//be followed.
/*jslint sloppy: true */
/*global setTimeout: false */

var requirejs, require, define;
(function (undef) {
    var main, req, makeMap, handlers,
        defined = {},
        waiting = {},
        config = {},
        defining = {},
        hasOwn = Object.prototype.hasOwnProperty,
        aps = [].slice,
        jsSuffixRegExp = /\.js$/;

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    /**
* Given a relative module name, like ./something, normalize it to
* a real name that can be mapped to a path.
* @param {String} name the relative name
* @param {String} baseName a real name that the name arg is relative
* to.
* @returns {String} normalized name
*/
    function normalize(name, baseName) {
        var nameParts, nameSegment, mapValue, foundMap, lastIndex,
            foundI, foundStarMap, starI, i, j, part,
            baseParts = baseName && baseName.split("/"),
            map = config.map,
            starMap = (map && map['*']) || {};

        //Adjust any relative paths.
        if (name && name.charAt(0) === ".") {
            //If have a base name, try to normalize against it,
            //otherwise, assume it is a top-level require that will
            //be relative to baseUrl in the end.
            if (baseName) {
                //Convert baseName to array, and lop off the last part,
                //so that . matches that "directory" and not name of the baseName's
                //module. For instance, baseName of "one/two/three", maps to
                //"one/two/three.js", but we want the directory, "one/two" for
                //this normalization.
                baseParts = baseParts.slice(0, baseParts.length - 1);
                name = name.split('/');
                lastIndex = name.length - 1;

                // Node .js allowance:
                if (config.nodeIdCompat && jsSuffixRegExp.test(name[lastIndex])) {
                    name[lastIndex] = name[lastIndex].replace(jsSuffixRegExp, '');
                }

                name = baseParts.concat(name);

                //start trimDots
                for (i = 0; i < name.length; i += 1) {
                    part = name[i];
                    if (part === ".") {
                        name.splice(i, 1);
                        i -= 1;
                    } else if (part === "..") {
                        if (i === 1 && (name[2] === '..' || name[0] === '..')) {
                            //End of the line. Keep at least one non-dot
                            //path segment at the front so it can be mapped
                            //correctly to disk. Otherwise, there is likely
                            //no path mapping for a path starting with '..'.
                            //This can still fail, but catches the most reasonable
                            //uses of ..
                            break;
                        } else if (i > 0) {
                            name.splice(i - 1, 2);
                            i -= 2;
                        }
                    }
                }
                //end trimDots

                name = name.join("/");
            } else if (name.indexOf('./') === 0) {
                // No baseName, so this is ID is resolved relative
                // to baseUrl, pull off the leading dot.
                name = name.substring(2);
            }
        }

        //Apply map config if available.
        if ((baseParts || starMap) && map) {
            nameParts = name.split('/');

            for (i = nameParts.length; i > 0; i -= 1) {
                nameSegment = nameParts.slice(0, i).join("/");

                if (baseParts) {
                    //Find the longest baseName segment match in the config.
                    //So, do joins on the biggest to smallest lengths of baseParts.
                    for (j = baseParts.length; j > 0; j -= 1) {
                        mapValue = map[baseParts.slice(0, j).join('/')];

                        //baseName segment has config, find if it has one for
                        //this name.
                        if (mapValue) {
                            mapValue = mapValue[nameSegment];
                            if (mapValue) {
                                //Match, update name to the new value.
                                foundMap = mapValue;
                                foundI = i;
                                break;
                            }
                        }
                    }
                }

                if (foundMap) {
                    break;
                }

                //Check for a star map match, but just hold on to it,
                //if there is a shorter segment match later in a matching
                //config, then favor over this star map.
                if (!foundStarMap && starMap && starMap[nameSegment]) {
                    foundStarMap = starMap[nameSegment];
                    starI = i;
                }
            }

            if (!foundMap && foundStarMap) {
                foundMap = foundStarMap;
                foundI = starI;
            }

            if (foundMap) {
                nameParts.splice(0, foundI, foundMap);
                name = nameParts.join('/');
            }
        }

        return name;
    }

    function makeRequire(relName, forceSync) {
        return function () {
            //A version of a require function that passes a moduleName
            //value for items that may need to
            //look up paths relative to the moduleName
            return req.apply(undef, aps.call(arguments, 0).concat([relName, forceSync]));
        };
    }

    function makeNormalize(relName) {
        return function (name) {
            return normalize(name, relName);
        };
    }

    function makeLoad(depName) {
        return function (value) {
            defined[depName] = value;
        };
    }

    function callDep(name) {
        if (hasProp(waiting, name)) {
            var args = waiting[name];
            delete waiting[name];
            defining[name] = true;
            main.apply(undef, args);
        }

        if (!hasProp(defined, name) && !hasProp(defining, name)) {
            throw new Error('No ' + name);
        }
        return defined[name];
    }

    //Turns a plugin!resource to [plugin, resource]
    //with the plugin being undefined if the name
    //did not have a plugin prefix.
    function splitPrefix(name) {
        var prefix,
            index = name ? name.indexOf('!') : -1;
        if (index > -1) {
            prefix = name.substring(0, index);
            name = name.substring(index + 1, name.length);
        }
        return [prefix, name];
    }

    /**
* Makes a name map, normalizing the name, and using a plugin
* for normalization if necessary. Grabs a ref to plugin
* too, as an optimization.
*/
    makeMap = function (name, relName) {
        var plugin,
            parts = splitPrefix(name),
            prefix = parts[0];

        name = parts[1];

        if (prefix) {
            prefix = normalize(prefix, relName);
            plugin = callDep(prefix);
        }

        //Normalize according
        if (prefix) {
            if (plugin && plugin.normalize) {
                name = plugin.normalize(name, makeNormalize(relName));
            } else {
                name = normalize(name, relName);
            }
        } else {
            name = normalize(name, relName);
            parts = splitPrefix(name);
            prefix = parts[0];
            name = parts[1];
            if (prefix) {
                plugin = callDep(prefix);
            }
        }

        //Using ridiculous property names for space reasons
        return {
            f: prefix ? prefix + '!' + name : name, //fullName
            n: name,
            pr: prefix,
            p: plugin
        };
    };

    function makeConfig(name) {
        return function () {
            return (config && config.config && config.config[name]) || {};
        };
    }

    handlers = {
        require: function (name) {
            return makeRequire(name);
        },
        exports: function (name) {
            var e = defined[name];
            if (typeof e !== 'undefined') {
                return e;
            } else {
                return (defined[name] = {});
            }
        },
        module: function (name) {
            return {
                id: name,
                uri: '',
                exports: defined[name],
                config: makeConfig(name)
            };
        }
    };

    main = function (name, deps, callback, relName) {
        var cjsModule, depName, ret, map, i,
            args = [],
            callbackType = typeof callback,
            usingExports;

        //Use name if no relName
        relName = relName || name;

        //Call the callback to define the module, if necessary.
        if (callbackType === 'undefined' || callbackType === 'function') {
            //Pull out the defined dependencies and pass the ordered
            //values to the callback.
            //Default to [require, exports, module] if no deps
            deps = !deps.length && callback.length ? ['require', 'exports', 'module'] : deps;
            for (i = 0; i < deps.length; i += 1) {
                map = makeMap(deps[i], relName);
                depName = map.f;

                //Fast path CommonJS standard dependencies.
                if (depName === "require") {
                    args[i] = handlers.require(name);
                } else if (depName === "exports") {
                    //CommonJS module spec 1.1
                    args[i] = handlers.exports(name);
                    usingExports = true;
                } else if (depName === "module") {
                    //CommonJS module spec 1.1
                    cjsModule = args[i] = handlers.module(name);
                } else if (hasProp(defined, depName) ||
                           hasProp(waiting, depName) ||
                           hasProp(defining, depName)) {
                    args[i] = callDep(depName);
                } else if (map.p) {
                    map.p.load(map.n, makeRequire(relName, true), makeLoad(depName), {});
                    args[i] = defined[depName];
                } else {
                    throw new Error(name + ' missing ' + depName);
                }
            }

            ret = callback ? callback.apply(defined[name], args) : undefined;

            if (name) {
                //If setting exports via "module" is in play,
                //favor that over return value and exports. After that,
                //favor a non-undefined return value over exports use.
                if (cjsModule && cjsModule.exports !== undef &&
                        cjsModule.exports !== defined[name]) {
                    defined[name] = cjsModule.exports;
                } else if (ret !== undef || !usingExports) {
                    //Use the return value from the function.
                    defined[name] = ret;
                }
            }
        } else if (name) {
            //May just be an object definition for the module. Only
            //worry about defining if have a module name.
            defined[name] = callback;
        }
    };

    requirejs = require = req = function (deps, callback, relName, forceSync, alt) {
        if (typeof deps === "string") {
            if (handlers[deps]) {
                //callback in this case is really relName
                return handlers[deps](callback);
            }
            //Just return the module wanted. In this scenario, the
            //deps arg is the module name, and second arg (if passed)
            //is just the relName.
            //Normalize module name, if it contains . or ..
            return callDep(makeMap(deps, callback).f);
        } else if (!deps.splice) {
            //deps is a config object, not an array.
            config = deps;
            if (config.deps) {
                req(config.deps, config.callback);
            }
            if (!callback) {
                return;
            }

            if (callback.splice) {
                //callback is an array, which means it is a dependency list.
                //Adjust args if there are dependencies
                deps = callback;
                callback = relName;
                relName = null;
            } else {
                deps = undef;
            }
        }

        //Support require(['a'])
        callback = callback || function () {};

        //If relName is a function, it is an errback handler,
        //so remove it.
        if (typeof relName === 'function') {
            relName = forceSync;
            forceSync = alt;
        }

        //Simulate async callback;
        if (forceSync) {
            main(undef, deps, callback, relName);
        } else {
            //Using a non-zero value because of concern for what old browsers
            //do, and latest browsers "upgrade" to 4 if lower value is used:
            //http://www.whatwg.org/specs/web-apps/current-work/multipage/timers.html#dom-windowtimers-settimeout:
            //If want a value immediately, use require('id') instead -- something
            //that works in almond on the global level, but not guaranteed and
            //unlikely to work in other AMD implementations.
            setTimeout(function () {
                main(undef, deps, callback, relName);
            }, 4);
        }

        return req;
    };

    /**
* Just drops the config on the floor, but returns req in case
* the config return value is used.
*/
    req.config = function (cfg) {
        return req(cfg);
    };

    /**
* Expose module registry for debugging and tooling
*/
    requirejs._defined = defined;

    define = function (name, deps, callback) {

        //This module may not have dependencies
        if (!deps.splice) {
            //deps is not an array, so probably means
            //an object literal or factory function for
            //the value. Adjust args.
            callback = deps;
            deps = [];
        }

        if (!hasProp(defined, name) && !hasProp(waiting, name)) {
            waiting[name] = [name, deps, callback];
        }
    };

    define.amd = {
        jQuery: true
    };
}());

define("lib/almond", function(){});

define('underscore',[], function() {
  return _;
});

define('cryptojs',[], function() {
  return CryptoJS;
});

define('Utils',['underscore'], function(_) {
  var Utils = {
    isNonemptyString: function(value) {
      return _.isString(value) && !_.isEmpty(value);
    },

    isValidNumber: function(number) {
      return !_.isNaN(number) && _.isNumber(number);
    },

    insert: function(list, index, item) {
      list.splice(index, 0, item);
    }
  };

  var Set = function(items, comparator) {
    var self = this;

    this._items = [];
    this._comparator = comparator;

    _.each(items, function(item) {
      self.put(item);
    });
  };

  Set.prototype = {
    put: function(item) {
      if (this.size() === 0 || !this.has(item)) {
        this._items.push(item);
      }
    },

    remove: function(item) {
      var self = this;
      this._items = _.reject(this._items, function(_item) {
        return self._comparator(_item, item);
      });
    },

    size: function() {
      return _.size(this._items);
    },

    has: function(item) {
      var self = this;
      return _.some(this._items, function(_item) {
        return self._comparator(_item, item);
      });
    },

    items: function() {
      return this._items;
    }
  };

  Utils.Set = Set;

  var Queue = function() {
    this._items = [];
  };

  Queue.prototype = {
    enqueue: function(item) {
      this._items.push(item);
    },

    dequeue: function() {
      if (_.isEmpty(this._items)) {
        return null;
      }
      return this._items.shift();
    },

    first: function() {
      if (_.isEmpty(this._items)) {
        return null;
      }
      return _.first(this._items);
    },

    last: function() {
      if (_.isEmpty(this._items)) {
        return null;
      }
      return _.last(this._items);
    },

    size: function() {
      return _.size(this._items);
    },
  };

  Utils.Queue = Queue;

  var Cache = function(capacity, cacheOutCallback) {
    this._cache = {};
    this._useHistory = [];
    this._capacity = capacity;
    this._cacheOutCallback = cacheOutCallback;
  };

  Cache.prototype = {
    get: function(key) {
      if (!_.has(this._cache, key)) {
        return null;
      }
      this._updateUseHistory(key);
      return this._cache[key];
    },

    set: function(key, item) {
      var self = this;

      this._cache[key] = item;
      this._updateUseHistory(key);
      if (_.size(this._cache) > this._capacity) {
        var keysToRemove = _.rest(this._useHistory, this._capacity);
        this._useHistory = _.first(this._useHistory, this._capacity);
        _.each(keysToRemove, function(key) {
          var item = self._cache[key];
          delete self._cache[key];
          self._cacheOutCallback(item);
        });
      }
    },

    remove: function(key) {
      if (!this.has(key)) {
        return;
      }
      this._useHistory = _.reject(this._useHistory, function(k) {
        return k === key;
      });
      delete this._cache[key];
    },

    has: function(key) {
      return _.has(this._cache, key);
    },

    keys: function() {
      return _.keys(this._cache);
    },

    _updateUseHistory: function(key) {
      this._useHistory = _.reject(this._useHistory, function(k) {
        return k === key;
      });
      this._useHistory.unshift(key);
    }
  };

  Utils.Cache = Cache;

  return Utils;
});

define('ID',['underscore', 'cryptojs', 'Utils'], function(_, CryptoJS, Utils) {
  var ID = function(bytes) {
    _.each(bytes, function(b) {
      if (_.isNaN(b) || !_.isNumber(b) || b < 0x00 || 0xff < b) {
        throw new Error("Invalid argument.");
      }
    });
    if (_.size(bytes) !== ID._BYTE_SIZE) {
      throw new Error("Invalid argument.");
    }

    this._bytes = _.last(bytes, ID._BYTE_SIZE);
  };

  ID._BYTE_SIZE = 32;

  ID.create = function(str) {
    if (!Utils.isNonemptyString(str)) {
      throw new Error("Invalid argument.");
    }

    return new ID(ID._createBytes(str));
  };

  ID._createBytes = function(str) {
    var hash = CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex);
    return ID._createBytesfromHexString(hash);
  };

  ID._createBytesfromHexString = function(str) {
    if (!Utils.isNonemptyString(str)) {
      throw new Error("Invalid argument.");
    }

    return _(Math.floor(_.size(str) / 2)).times(function(i) {
      return parseInt(str.substr(i * 2, 2), 16);
    });
  };

  ID.fromHexString = function(str) {
    return new ID(ID._createBytesfromHexString(str));
  };

  ID.prototype = {
    isInInterval: function(fromId, toId) {
      if (_.isNull(fromId) || _.isNull(toId)) {
        throw new Error("Invalid arguments.");
      }

      if (fromId.equals(toId)) {
        return !this.equals(fromId);
      }

      if (fromId.compareTo(toId) < 0) {
        return (this.compareTo(fromId) > 0 && this.compareTo(toId) < 0);
      }

      var minId = new ID(_(_.size(this._bytes)).times(function() {
        return 0x00;
      }));
      var maxId = new ID(_(_.size(this._bytes)).times(function() {
        return 0xff;
      }));
      return ((!fromId.equals(maxId) && this.compareTo(fromId) > 0 && this.compareTo(maxId) <= 0) ||
              (!minId.equals(toId) && this.compareTo(minId) >= 0 && this.compareTo(toId) < 0));
    },

    addPowerOfTwo: function(powerOfTwo) {
      if (!_.isNumber(powerOfTwo)) {
        throw new Error("Invalid argument.");
      }
      if (powerOfTwo < 0 || powerOfTwo >= this.getLength()) {
        throw new Error("Power of two out of index.");
      }

      var copy = _.clone(this._bytes);
      var indexOfBytes = _.size(this._bytes) - 1 - Math.floor(powerOfTwo / 8);
      var valueToAdd = [1, 2, 4, 8, 16, 32, 64, 128][powerOfTwo % 8];
      for (var i = indexOfBytes; i >= 0; i--) {
        copy[i] += valueToAdd;
        valueToAdd = copy[i] >> 8;
        copy[i] &= 0xff;
        if (valueToAdd === 0) {
          break;
        }
      }

      return new ID(copy);
    },

    compareTo: function(id) {
      if (this.getLength() !== id.getLength()) {
        throw new Error("Invalid argument.");
      }

      var bytes = _.zip(this._bytes, id._bytes);
      for (var i = 0; i < bytes.length; i++) {
        if (bytes[i][0] < bytes[i][1]) {
          return -1;
        } else if (bytes[i][0] > bytes[i][1]) {
          return 1;
        }
      }
      return 0;
    },

    equals: function(id) {
      return this.compareTo(id) === 0;
    },

    getLength: function() {
      return _.size(this._bytes) * 8;
    },

    toHexString: function() {
      return _.map(this._bytes, function(b) {
        var str = b.toString(16);
        return b < 0x10 ? "0" + str : str;
      }).join("");
    }
  };

  return ID;
});

define('Response',['underscore', 'Utils'], function(_, Utils) {
  var Response = function(status, method, result, requestId, timestamp) {
    if (!Utils.isNonemptyString(status) ||
        !Utils.isNonemptyString(method) ||
        !_.isObject(result) || !Utils.isNonemptyString(requestId) ||
        !_.isNumber(timestamp)) {
      throw new Error("Invalid argument.");
    }

    this.status = status;
    this.method = method;
    this.result = result;
    this.requestId = requestId;
    this.timestamp = timestamp;
  };

  Response.create = function(status, result, request) {
    return new Response(status, request.method, result, request.requestId, _.now());
  };

  Response.isResponse = function(data) {
    if (!_.isObject(data)) {
      return false;
    }
    if (!Utils.isNonemptyString(data.status)) {
      return false;
    }
    return true;
  };

  Response.fromJson = function(json) {
    if (!_.isObject(json)) {
      throw new Error("Invalid argument.");
    }
    return new Response(json.status, json.method, json.result, json.requestId, json.timestamp);
  };

  Response.prototype = {
    toJson: function() {
      return {
        status: this.status,
        method: this.method,
        result: this.result,
        requestId: this.requestId,
        timestamp: this.timestamp
      };
    },
  };

  return Response;
});

define('Request',['underscore', 'cryptojs', 'Response', 'Utils'], function(_, CryptoJS, Response, Utils) {
  var Request = function(method, params, requestId, timestamp) {
    if (!Utils.isNonemptyString(method) || !_.isObject(params) ||
        !Utils.isNonemptyString(requestId) || !_.isNumber(timestamp)) {
      throw new Error("Invalid argument.");
    }

    this.method = method;
    this.params = params;
    this.requestId = requestId;
    this.timestamp = timestamp;
  };

  Request.create = function(method, params) {
    return new Request(method, params, Request._createId(), _.now());
  };

  Request._createId = function() {
    return CryptoJS.SHA256(Math.random().toString()).toString();
  };

  Request.isRequest = function(data) {
    return !Response.isResponse(data);
  };

  Request.fromJson = function(json) {
    if (!_.isObject(json)) {
      throw new Error("Invalid argument.");
    }
    return new Request(json.method, json.params, json.requestId, json.timestamp);
  };

  Request.prototype = {
    toJson: function() {
      return {
        method: this.method,
        params: this.params,
        requestId: this.requestId,
        timestamp: this.timestamp
      };
    }
  };

  return Request;
});

define('Entry',['underscore', 'ID'], function(_, ID) {
  var Entry = function(id, value) {
    if (_.isNull(id) || _.isUndefined(value)) {
      throw new Error("Invalid argument.");
    }

    this.id = id;
    this.value = value;
  };

  Entry.fromJson = function(json) {
    if (!_.isObject(json)) {
      throw new Error("invalid argument.");
    }
    return new Entry(ID.fromHexString(json.id), json.value);
  };

  Entry.prototype = {
    equals: function(entry) {
      if (!(entry instanceof Entry)) {
        return false;
      }

      return this.id.equals(entry.id) && _.isEqual(this.value, entry.value);
    },

    toJson: function() {
      return {
        id: this.id.toHexString(),
        value: this.value
      };
    }
  };

  return Entry;
});

define('Node',['underscore', 'ID', 'Request', 'Entry', 'Utils'], function(_, ID, Request, Entry, Utils) {
  var Node = function(nodeInfo, nodeFactory, connectionFactory, requestHandler, config) {
    if (!Node.isValidNodeInfo(nodeInfo)) {
      throw new Error("Invalid arguments.");
    }

    if (!Utils.isValidNumber(config.requestTimeout) ||
        config.requestTimeout < 0) {
      config.requestTimeout = 180000;
    }

    this._peerId = nodeInfo.peerId;
    this.nodeId = ID.create(nodeInfo.peerId);
    this._nodeFactory = nodeFactory;
    this._connectionFactory = connectionFactory;
    this._requestHandler = requestHandler;
    this._config = config;
  };

  Node.isValidNodeInfo = function(nodeInfo) {
    if (!_.isObject(nodeInfo)) {
      return false;
    }
    if (!Utils.isNonemptyString(nodeInfo.peerId)) {
      return false;
    }
    return true;
  };

  Node.prototype = {
    findSuccessor: function(key, callback) {
      var self = this;

      if (!(key instanceof ID)) {
        callback(null);
        return;
      }

      this._sendRequest('FIND_SUCCESSOR', {
        key: key.toHexString()
      }, {
        success: function(result) {
          var nodeInfo = result.successorNodeInfo;
          self._nodeFactory.create(nodeInfo, callback);
        },

        error: function(error) {
          callback(null, error);
        }
      });
    },

    notifyAndCopyEntries: function(potentialPredecessor, callback) {
      var self = this;

      this._sendRequest('NOTIFY_AND_COPY', {
        potentialPredecessorNodeInfo: potentialPredecessor.toNodeInfo()
      }, {
        success: function(result) {
          if (!_.isArray(result.referencesNodeInfo) || !_.isArray(result.entries)) {
            callback(null, null);
            return;
          }

          self._nodeFactory.createAll(result.referencesNodeInfo, function(references) {
            var entries = _.chain(result.entries)
              .map(function(entry) {
                try {
                  return Entry.fromJson(entry);
                } catch (e) {
                  return null;
                }
              })
              .reject(function(entry) { return _.isNull(entry); })
              .value();

            callback(references, entries);
          });
        },

        error: function(error) {
          callback(null, null, error);
        }
      });
    },

    notify: function(potentialPredecessor, callback) {
      var self = this;

      this._sendRequest('NOTIFY', {
        potentialPredecessorNodeInfo: potentialPredecessor.toNodeInfo()
      }, {
        success: function(result) {
          if (!_.isArray(result.referencesNodeInfo)) {
            callback(null);
            return;
          }

          self._nodeFactory.createAll(result.referencesNodeInfo, function(references) {
            callback(references);
          });
        },

        error: function(error) {
          callback(null, error);
        }
      });
    },

    leavesNetwork: function(predecessor) {
      var self = this;

      if (_.isNull(predecessor)) {
        throw new Error("Invalid argument.");
      }

      this._sendRequest('LEAVES_NETWORK', {
        predecessorNodeInfo: predecessor.toNodeInfo()
      });
    },

    ping: function(callback) {
      this._sendRequest('PING', {}, {
        success: function(result) {
          callback(true);
        },

        error: function(error) {
          callback(false, error);
        }
      });
    },

    insertReplicas: function(replicas) {
      this._sendRequest('INSERT_REPLICAS', {replicas: _.invoke(replicas, 'toJson')});
    },

    removeReplicas: function(sendingNodeId, replicas) {
      this._sendRequest('REMOVE_REPLICAS', {
        sendingNodeId: sendingNodeId.toHexString(),
        replicas: _.invoke(replicas, 'toJson')
      });
    },

    insertEntry: function(entry, callback) {
      this._sendRequest('INSERT_ENTRY', {
        entry: entry.toJson()
      }, {
        success: function(result) {
          callback();
        },

        error: function(error) {
          callback(error);
        }
      });
    },

    retrieveEntries: function(id, callback) {
      var self = this;

      this._sendRequest('RETRIEVE_ENTRIES', {
        id: id.toHexString()
      }, {
        success: function(result) {
          if (!_.isArray(result.entries)) {
            callback(null, new Error("Received invalid data from " + self._peerId));
            return;
          }

          var entries = _.chain(result.entries)
            .map(function(entry) {
              try {
                return Entry.fromJson(entry);
              } catch (e) {
                return null;
              }
            })
            .reject(function(entry) { return _.isNull(entry); })
            .value();
          callback(entries);
        },

        error: function(error) {
          callback(null, error);
        }
      });
    },

    removeEntry: function(entry, callback) {
      this._sendRequest('REMOVE_ENTRY', {
        entry: entry.toJson()
      }, {
        success: function(result) {
          callback();
        },

        error: function(error) {
          callback(error);
        }
      });
    },

    _sendRequest: function(method, params, callbacks) {
      var self = this;

      this._connectionFactory.create(this._peerId, function(connection, error) {
        if (error) {
          if (!_.isUndefined(callbacks)) {
            callbacks.error(error);
          }
          return;
        }

        var request = Request.create(method, params);

        if (!_.isUndefined(callbacks)) {
          var timer = setTimeout(function() {
            var callback = self._nodeFactory.deregisterCallback(request.requestId);
            if (!_.isNull(callback)) {
              callbacks.error(new Error(method + " request to " + self._peerId + " timed out."));
            }
          }, self._config.requestTimeout);

          self._nodeFactory.registerCallback(request.requestId, _.once(function(response) {
            clearTimeout(timer);

            if (response.status !== 'SUCCESS') {
              callbacks.error(new Error(response.result.message));
              return;
            }

            callbacks.success(response.result);
          }));
        }

        try {
          connection.send(request);
        } finally {
          connection.close();
        }
      });
    },

    onRequestReceived: function(request) {
      var self = this;

      this._requestHandler.handle(request, function(response) {
        self._connectionFactory.create(self._peerId, function(connection, error) {
          if (error) {
            return;
          }

          try {
            connection.send(response);
          } finally {
            connection.close();
          }
        });
      });
    },

    onResponseReceived: function(response) {
      var callback = this._nodeFactory.deregisterCallback(response.requestId);
      if (!_.isNull(callback)) {
        callback(response);
      }
    },

    disconnect: function() {
      this._connectionFactory.removeConnection(this._peerId);
    },

    getPeerId: function() {
      return this._peerId;
    },

    toNodeInfo: function() {
      return {
        nodeId: this.nodeId.toHexString(),
        peerId: this._peerId
      };
    },

    equals: function(node) {
      if (_.isNull(node)) {
        return false;
      }
      return this.nodeId.equals(node.nodeId);
    },

    toString: function() {
      return this.nodeId.toHexString() + " (" + this._peerId + ")";
    }
  };

  return Node;
});

define('peerjs',[], function() {
  return Peer;
});

define('PeerAgent',['underscore', 'peerjs', 'Utils'], function(_, Peer, Utils) {
  var PeerAgent = function(config, callbacks) {
    var self = this;

    if (!_.isObject(config.peer)) {
      config.peer = {id: undefined, options: {}};
    }
    if (!_.isObject(config.peer.options)) {
      config.peer.options = {};
    }
    if (!Utils.isValidNumber(config.connectRateLimit) ||
        config.connectRateLimit < 0) {
      config.connectRateLimit = 3000;
    }
    if (!Utils.isValidNumber(config.connectionOpenTimeout) ||
        config.connectionOpenTimeout < 0) {
      config.connectionOpenTimeout = 30000;
    }

    if (!_.isString(config.peer.id)) {
      this._peer = new Peer(config.peer.options);
    } else {
      this._peer = new Peer(config.peer.id, config.peer.options);
    }
    this._config = config;
    this._callbacks = callbacks;
    this._waitingTimer = null;
    this.connect = _.throttle(this.connect, config.connectRateLimit);

    var onPeerSetup = _.once(callbacks.onPeerSetup);

    this._peer.on('open', function(id) {
      self._peer.on('connection', function(conn) {
        callbacks.onConnection(conn.peer, conn);
      });

      self._peer.on('close', function() {
        callbacks.onPeerClosed();
      });

      onPeerSetup(id);
    });

    this._peer.on('error', function(error) {
      var match = error.message.match(/Could not connect to peer (\w+)/);
      if (match) {
        if (!self.isWaitingOpeningConnection()) {
          return;
        }

        clearTimeout(self._waitingTimer);
        self._waitingTimer = null;

        var peerId = match[1];
        callbacks.onConnectionOpened(peerId, null, error);
        return;
      }

      console.log(error);
      onPeerSetup(null, error);
    });
  };

  PeerAgent.prototype = {
    connect: function(peerId) {
      var self = this;

      var conn = this._peer.connect(peerId);
      if (!conn) {
        var error = new Error("Failed to open connection to " + peerId + ".");
        this._callbacks.onConnectionOpened(peerId, null, error);
        return;
      }

      this._waitingTimer = setTimeout(function() {
        if (!self.isWaitingOpeningConnection()) {
          return;
        }

        self._waitingTimer = null;

        var error = new Error("Opening connection to " + peerId + " timed out.");
        self._callbacks.onConnectionOpened(peerId, null, error);
      }, this._config.connectionOpenTimeout);

      conn.on('open', function() {
        if (!self.isWaitingOpeningConnection()) {
          conn.close();
          return;
        }

        clearTimeout(self._waitingTimer);
        self._waitingTimer = null;

        self._callbacks.onConnectionOpened(peerId, conn);
      });
    },

    isWaitingOpeningConnection: function() {
      return !_.isNull(this._waitingTimer);
    },

    destroy: function() {
      this._peer.destroy();
    },

    getPeerId: function() {
      return this._peer.id;
    }
  };

  return PeerAgent;
});

define('Connection',['underscore', 'Request', 'Response'], function(_, Request, Response) {
  var Connection = function(conn, callbacks) {
    var self = this;

    this._conn = conn;
    this._callbacks = callbacks;

    this._conn.on('data', function(data) {
      self._onDataReceived(data);
    });

    this._conn.on('close', function() {
      callbacks.closedByRemote(self);
    });

    this._conn.on('error', function(error) {
      console.log(error);
    });
  };

  Connection.prototype = {
    send: function(requestOrResponse, callback) {
      this._conn.send(requestOrResponse.toJson());
    },

    _onDataReceived: function(data) {
      var self = this;

      if (Response.isResponse(data)) {
        var response;
        try {
          response = Response.fromJson(data);
        } catch (e) {
          return;
        }
        this._callbacks.responseReceived(this, response);
      } else if (Request.isRequest(data)) {
        var request;
        try {
          request = Request.fromJson(data);
        } catch (e) {
          return;
        }
        this._callbacks.requestReceived(this, request);
      }
    },

    close: function() {
      this._callbacks.closedByLocal(this);
    },

    destroy: function() {
      this._conn.close();
    },

    getPeerId: function() {
      return this._conn.peer;
    },

    isAvailable: function() {
      return this._conn.open;
    }
  };

  return Connection;
});

define('ConnectionFactory',['underscore', 'PeerAgent', 'Connection', 'Utils'], function(_, PeerAgent, Connection, Utils) {
  var ConnectionFactory = function(config, nodeFactory, callback) {
    var self = this;

    var requestReceived = function(connection, request) {
      connection.close();
      nodeFactory.onRequestReceived(connection.getPeerId(), request);
    };
    var responseReceived = function(connection, response) {
      connection.close();
      nodeFactory.onResponseReceived(connection.getPeerId(), response);
    };
    var closedByRemote = function(connection) {
      self.removeConnection(connection.getPeerId());
    };
    var closedByLocal = function(connection) {
      self._connectionPool.set(connection.getPeerId(), connection);
    };
    this._peerAgent = new PeerAgent(config, {
      onPeerSetup: function(peerId, error) {
        if (error) {
          callback(null, error);
          return;
        }
        callback(self);
      },

      onConnectionOpened: function(peerId, conn, error) {
        if (error) {
          self._invokeNextCallback(peerId, null, error);
          return;
        }

        var connection = new Connection(conn, {
          requestReceived: requestReceived,
          responseReceived: responseReceived,
          closedByRemote: closedByRemote,
          closedByLocal: closedByLocal
        });

        self._invokeNextCallback(peerId, connection);
      },

      onConnection: function(peerId, conn) {
        if (self._connectionPool.has(peerId)) {
          self.removeConnection(peerId);
        }

        var connection;
        var timer = setTimeout(function() {
          connection.close();
        }, config.silentConnectionCloseTimeout);

        var clearTimerOnce = _.once(function() { clearTimeout(timer); });

        connection = new Connection(conn, {
          requestReceived: function(connection, request) {
            clearTimerOnce();
            requestReceived(connection, request);
          },
          responseReceived: function(connection, response) {
            clearTimerOnce();
            responseReceived(connection, response);
          },
          closedByRemote: closedByRemote,
          closedByLocal: closedByLocal
        });
      },

      onPeerClosed: function() {
        _.each(self._connectionPool.keys(), function(peerId) {
          self.removeConnection(peerId);
        });
      }
    });

    if (!Utils.isValidNumber(config.connectionPoolSize) ||
        config.connectionPoolSize < 0) {
      config.connectionPoolSize = 10;
    }
    if (!Utils.isValidNumber(config.connectionCloseDelay) ||
        config.connectionCloseDelay < 0) {
      config.connectionCloseDelay = 5000;
    }
    if (!Utils.isValidNumber(config.silentConnectionCloseTimeout) ||
        config.silentConnectionCloseTimeout < 0) {
      config.silentConnectionCloseTimeout = 30000;
    }
    this._connectionPool = new Utils.Cache(config.connectionPoolSize, function(connection) {
      _.delay(function() { connection.destroy(); }, config.connectionCloseDelay);
    });
    this._callbackQueue = new Utils.Queue();
  };

  ConnectionFactory.create = function(config, nodeFactory, callback) {
    var factory = new ConnectionFactory(config, nodeFactory, callback);
  };

  ConnectionFactory.prototype = {
    create: function(remotePeerId, callback) {
      var self = this;

      if (!Utils.isNonemptyString(remotePeerId)) {
        callback(null);
        return;
      }

      this._callbackQueue.enqueue({
        peerId: remotePeerId,
        callback: callback
      });

      this._createConnectionAndInvokeNextCallback();
    },

    _createConnectionAndInvokeNextCallback: function() {
      var self = this;

      var callbackInfo = this._callbackQueue.first();
      if (_.isNull(callbackInfo)) {
        return;
      }

      if (this._peerAgent.isWaitingOpeningConnection()) {
        return;
      }

      if (this._connectionPool.has(callbackInfo.peerId)) {
        var connection = this._connectionPool.get(callbackInfo.peerId);
        if (connection.isAvailable()) {
          this._invokeNextCallback(connection.getPeerId(), connection);
          return;
        }

        this.removeConnection(connection.getPeerId());
      }

      this._peerAgent.connect(callbackInfo.peerId);
    },

    _invokeNextCallback: function(peerId, connection, error) {
      var self = this;

      _.defer(function() {
        self._createConnectionAndInvokeNextCallback();
      });

      var callbackInfo = this._callbackQueue.dequeue();
      if (_.isNull(callbackInfo)) {
        console.log("Unknown situation.");
        return;
      }
      if (callbackInfo.peerId !== peerId) {
        callbackInfo.callback(null, new Error("Unknown situation."));
        return;
      }
      callbackInfo.callback(connection, error);
    },

    removeConnection: function(remotePeerId) {
      var connection = this._connectionPool.get(remotePeerId);
      if (_.isNull(connection)) {
        return;
      }
      connection.destroy();
      this._connectionPool.remove(remotePeerId);
    },

    destroy: function() {
      this._peerAgent.destroy();
    },

    getPeerId: function() {
      return this._peerAgent.getPeerId();
    }
  };

  return ConnectionFactory;
});

define('RequestHandler',['underscore', 'ID', 'Response', 'Entry', 'Utils'], function(_, ID, Response, Entry, Utils) {
  var RequestHandler = function(localNode, nodeFactory) {
    this._localNode = localNode;
    this._nodeFactory = nodeFactory;
  }

  RequestHandler.prototype = {
    handle: function(request, callback) {
      var self = this;

      switch (request.method) {
      case 'FIND_SUCCESSOR':
        if (!Utils.isNonemptyString(request.params.key)) {
          this._sendFailureResponse(request, callback);
          return;
        }

        var key = ID.fromHexString(request.params.key);
        this._localNode.findSuccessor(key, function(successor, error) {
          if (error) {
            console.log(error);
            self._sendFailureResponse(request, callback);
            return;
          }

          self._sendSuccessResponse({
            successorNodeInfo: successor.toNodeInfo()
          }, request, callback);
        });
        break;

      case 'NOTIFY_AND_COPY':
        var potentialPredecessorNodeInfo = request.params.potentialPredecessorNodeInfo;
        this._nodeFactory.create(potentialPredecessorNodeInfo, function(node, error) {
          if (error) {
            console.log(error);
            this._sendFailureResponse(request, callback);
            return;
          }

          self._localNode.notifyAndCopyEntries(node, function(references, entries) {
            if (_.isNull(references) || _.isNull(entries)) {
              self._sendFailureResponse(request, callback);
              return;
            }

            self._sendSuccessResponse({
              referencesNodeInfo: _.invoke(references, 'toNodeInfo'),
              entries: _.invoke(entries, 'toJson')
            }, request, callback);
          });
        });
        break;

      case 'NOTIFY':
        var potentialPredecessorNodeInfo = request.params.potentialPredecessorNodeInfo;
        this._nodeFactory.create(potentialPredecessorNodeInfo, function(node, error) {
          if (error) {
            console.log(error);
            self._sendFailureResponse(request, callback);
            return;
          }

          self._localNode.notify(node, function(references) {
            if (_.isNull(references)) {
              self._sendFailureResponse(request, callback);
              return;
            }

            self._sendSuccessResponse({
              referencesNodeInfo: _.invoke(references, 'toNodeInfo')
            }, request, callback);
          });
        });
        break;

      case 'PING':
        self._sendSuccessResponse({}, request, callback);
        break;

      case 'INSERT_REPLICAS':
        if (!_.isArray(request.params.replicas)) {
          return;
        }
        var replicas = _.chain(request.params.replicas)
          .map(function(replica) {
            try {
              return Entry.fromJson(replica);
            } catch (e) {
              return null;
            }
          })
          .reject(function(replica) { return _.isNull(replica); })
          .value();
        self._localNode.insertReplicas(replicas);
        break;

      case 'REMOVE_REPLICAS':
        var sendingNodeId;
        try {
            sendingNodeId = ID.fromHexString(request.params.sendingNodeId);
        } catch (e) {
          return;
        }
        if (!_.isArray(request.params.replicas)) {
          return;
        }
        var replicas = _.chain(request.params.replicas)
          .map(function(replica) {
            try {
              return Entry.fromJson(replica);
            } catch (e) {
              return null;
            }
          })
          .reject(function(replica) { return _.isNull(replica); })
          .value();
        self._localNode.removeReplicas(sendingNodeId, replicas);
        break;

      case 'INSERT_ENTRY':
        var entry;
        try {
          entry = Entry.fromJson(request.params.entry);
        } catch (e) {
          self._sendFailureResponse(request, callback);;
          return;
        }
        self._localNode.insertEntry(entry, function(inserted) {
          if (!inserted) {
            self._sendFailureResponse(request, callback);
          } else {
            self._sendSuccessResponse({}, request, callback);
          }
        });
        break;

      case 'RETRIEVE_ENTRIES':
        var id;
        try {
          id = ID.fromHexString(request.params.id);
        } catch (e) {
          self._sendFailureResponse(request, callback);
          return;
        }
        self._localNode.retrieveEntries(id, function(entries) {
          if (_.isNull(entries)) {
            self._sendFailureResponse(request, callback);
          } else {
            self._sendSuccessResponse({
              entries: _.invoke(entries, 'toJson')
            }, request, callback);
          }
        });
        break;

      case 'REMOVE_ENTRY':
        var entry;
        try {
          entry = Entry.fromJson(request.params.entry);
        } catch (e) {
          self._sendFailureResponse(request, callback);
          return;
        }
        self._localNode.removeEntry(entry, function(removed) {
          if (!removed) {
            self._sendFailureResponse(request, callback);
          } else {
            self._sendSuccessResponse({}, request, callback);
          }
        });
        break;

      case 'SHUTDOWN':
        break;

      case 'LEAVES_NETWORK':
        var predecessorNodeInfo = request.params.predecessorNodeInfo;
        this._nodeFactory.create(predecessorNodeInfo, function(predecessor, error) {
          if (error) {
            console.log(error);
            return;
          }

          self._localNode.leavesNetwork(predecessor);
        });
        break;

      default:
        this._sendFailureResponse(request, callback);
        break;
      }
    },

    _sendSuccessResponse: function(result, request, callback) {
      var self = this;

      var response;
      try {
        response = Response.create('SUCCESS', result, request);
      } catch (e){
        this._sendFailureResponse(request, callback);
        return;
      }

      callback(response);
    },

    _sendFailureResponse: function(request, callback) {
      var response;
      try {
        response = Response.create('FAILED', {}, request);
      } catch (e) {
        callback(null);
        return;
      }

      callback(response);
    }
  };

  return RequestHandler;
});

define('NodeFactory',[
  'underscore', 'Node', 'ConnectionFactory', 'RequestHandler', 'ID', 'Utils'
], function(_, Node, ConnectionFactory, RequestHandler, ID, Utils) {
  var NodeFactory = function(localNode, config) {
    var self = this;

    if (_.isNull(localNode)) {
      throw new Error("Invalid arguments.");
    }

    this._localNode = localNode;
    this._config = config;
    this._connectionFactory = null;
    this._requestHandler = new RequestHandler(localNode, this);
    this._callbacks = {};
  };

  NodeFactory.create = function(localNode, config, callback) {
    if (_.isNull(localNode)) {
      callback(null, null);
    }

    var nodeFactory = new NodeFactory(localNode, config);
    ConnectionFactory.create(config, nodeFactory, function(connectionFactory, error) {
      if (error) {
        callback(null, null, error);
        return;
      }

      nodeFactory._connectionFactory = connectionFactory;

      callback(connectionFactory.getPeerId(), nodeFactory);
    });
  };

  NodeFactory.prototype = {
    create: function(nodeInfo, callback) {
      var self = this;

      if (!Node.isValidNodeInfo(nodeInfo)) {
        callback(null, new Error("Invalid node info."));
        return;
      }

      if (this._localNode.nodeId.equals(ID.create(nodeInfo.peerId))) {
        callback(this._localNode);
        return;
      }

      var node = new Node(nodeInfo, this, this._connectionFactory, this._requestHandler, this._config);

      callback(node);
    },

    createAll: function(nodesInfo, callback) {
      var self = this;

      if (_.isEmpty(nodesInfo)) {
        callback([]);
        return;
      }
      this.create(_.first(nodesInfo), function(node, error) {
        self.createAll(_.rest(nodesInfo), function(nodes) {
          if (!error) {
            callback([node].concat(nodes));
          } else {
            console.log(error);
            callback(nodes);
          }
        });
      });
    },

    onRequestReceived: function(peerId, request) {
      this.create({peerId: peerId}, function(node, error) {
        if (error) {
          console.log(error);
          return;
        }
        node.onRequestReceived(request);
      });
    },

    onResponseReceived: function(peerId, response) {
      this.create({peerId: peerId}, function(node, error) {
        if (error) {
          console.log(error);
          return;
        }
        node.onResponseReceived(response);
      });
    },

    registerCallback: function(key, callback) {
      this._callbacks[key] = callback;
    },

    deregisterCallback: function(key) {
      if (!_.has(this._callbacks, key)) {
        return null;
      }
      var callback = this._callbacks[key];
      delete this._callbacks[key];
      return callback;
    },

    destroy: function() {
      this._connectionFactory.destroy();
    }
  };

  return NodeFactory;
});

define('EntryList',['underscore', 'ID', 'Utils'], function(_, ID, Utils) {
  var EntryList = function() {
    this._entries = {};
  };

  EntryList.prototype = {
    addAll: function(entries) {
      var self = this;

      if (_.isNull(entries)) {
        throw new Error("Invalid argument.");
      }

      _.each(entries, function(entry) {
        self.add(entry);
      });
    },

    add: function(entry) {
      if (_.isNull(entry)) {
        throw new Error("Invalid argument.");
      }

      if (_.has(this._entries, entry.id.toHexString())) {
        this._entries[entry.id.toHexString()].put(entry);
      } else {
        this._entries[entry.id.toHexString()] = new Utils.Set([entry], function(a, b) {
          return a.equals(b);
        });
      }
    },

    remove: function(entry) {
      if (_.isNull(entry)) {
        throw new Error("Invalid argument.");
      }

      if (!_.has(this._entries, entry.id.toHexString())) {
        return;
      }

      this._entries[entry.id.toHexString()].remove(entry);
      if (this._entries[entry.id.toHexString()].size() === 0) {
        delete this._entries[entry.id.toHexString()];
      }
    },

    getEntries: function(id) {
      if (_.isNull(id)) {
        throw new Error("Invalid argument.");
      }

      if (_.isUndefined(id)) {
        return this._entries;
      }

      if (_.has(this._entries, id.toHexString())) {
        return this._entries[id.toHexString()].items();
      } else {
        return [];
      }
    },

    getEntriesInInterval: function(fromId, toId) {
      if (_.isNull(fromId) || _.isNull(toId)) {
        throw new Error("Invalid argument.");
      }

      var result = [];
      _.each(this._entries, function(entries, key) {
        if (ID.fromHexString(key).isInInterval(fromId, toId)) {
          result = result.concat(entries.items());
        }
      });

      result = result.concat(this.getEntries(toId));

      return result;
    },

    removeAll: function(entries) {
      var self = this;

      if (_.isNull(entries)) {
        throw new Error("Invalid argument.");
      }

      _.each(entries, function(entry) {
        self.remove(entry);
      });
    },

    getNumberOfStoredEntries: function() {
      return _.size(this._entries);
    },

    getStatus: function() {
      return _.chain(this._entries)
        .map(function(entries, key) {
          return [
            key,
            _.map(entries, function(entry) {
              return entry.value;
            })
          ];
        })
        .object()
        .value();
    },

    toString: function() {
      var self = this;

      return "[Entries]\n" + _.chain(this._entries)
        .keys()
        .map(function(key) { return ID.fromHexString(key); })
        .sort(function(a, b) { return a.compareTo(b); })
        .map(function(id) {
          return "[" + id.toHexString() + "]\n" +
            _.map(self.getEntries(id), function(entry) {
              return JSON.stringify(entry.value);
            }).join("\n") + "\n";
        })
        .value()
        .join("\n") + "\n";
    }
  };

  return EntryList;
});

define('FingerTable',['underscore'], function(_) {
  var FingerTable = function(localId, references) {
    if (_.isNull(localId) || _.isNull(references)) {
      throw new Error("Invalid arguments.");
    }

    this._localId = localId;
    this._references = references;
    this._remoteNodes = {};
  };

  FingerTable.prototype = {
    _setEntry: function(index, node) {
      if (!_.isNumber(index) || _.isNull(node)) {
        throw new Error("Invalid arguments.");
      }
      if (index < 0 || index >= this._localId.getLength()) {
        throw new Error("Invalid index.");
      }

      this._remoteNodes[index] = node;
    },

    _getEntry: function(index) {
      if (!_.isNumber(index)) {
        throw new Error("Invalid argument.");
      }
      if (index < 0 || index >= this._localId.getLength()) {
        throw new Error("Invalid index.");
      }

      if (!_.has(this._remoteNodes, index)) {
        return null;
      }
      return this._remoteNodes[index];
    },

    _unsetEntry: function(index) {
      if (!_.isNumber(index)) {
        throw new Error("Invalid argument.");
      }
      if (index < 0 || index >= this._localId.getLength()) {
        throw new Error("Invalid index.");
      }

      var overwrittenNode = this._getEntry(index);

      delete this._remoteNodes[index];

      if (!_.isNull(overwrittenNode)) {
        this._references.disconnectIfUnreferenced(overwrittenNode);
      }
    },

    addReference: function(node) {
      if (_.isNull(node)) {
        throw new Error("Invalid argument.");
      }

      for (var i = 0; i < this._localId.getLength(); i++) {
        var startOfInterval = this._localId.addPowerOfTwo(i);
        if (!startOfInterval.isInInterval(this._localId, node.nodeId)) {
          break;
        }

        if (_.isNull(this._getEntry(i))) {
          this._setEntry(i, node);
        } else if (node.nodeId.isInInterval(this._localId, this._getEntry(i).nodeId)) {
          var oldEntry = this._getEntry(i);
          this._setEntry(i, node);
          this._references.disconnectIfUnreferenced(oldEntry);
        }
      }
    },

    getClosestPrecedingNode: function(key) {
      if (_.isNull(key)) {
        throw new Error("Invalid argument.");
      }

      var sortedKeys = _.chain(this._remoteNodes)
        .keys()
        .map(function(key) { return parseInt(key); })
        .sortBy()
        .value();
      for (var i = _.size(sortedKeys) - 1; i >= 0; i--) {
        var k = sortedKeys[i]
        if (!_.isNull(this._getEntry(k)) &&
            this._getEntry(k).nodeId.isInInterval(this._localId, key)) {
          return this._getEntry(k);
        }
      }
      return null;
    },

    removeReference: function(node) {
      var self = this;

      if (_.isNull(node)) {
        throw new Error("Invalid argument.");
      }

      var referenceForReplacement = null;
      var sortedKeys = _.chain(this._remoteNodes)
        .keys()
        .map(function (key) { return parseInt(key); })
        .sortBy()
        .value();
      for (var i = _.size(sortedKeys) - 1; i >= 0; i--) {
        var k = sortedKeys[i];
        var n = this._getEntry(k);
        if (node.equals(n)) {
          break;
        }
        if (!_.isNull(n)) {
          referenceForReplacement = n;
        }
      }

      _.each(sortedKeys, function(key) {
        if (node.equals(self._getEntry(key))) {
          if (_.isNull(referenceForReplacement)) {
            self._unsetEntry(key);
          } else {
            self._setEntry(key, referenceForReplacement);
          }
        }
      });

      _.chain(this._references.getSuccessors())
        .reject(function(s) { return s.equals(node); })
        .each(function(s) { self.addReference(s); });
    },

    getFirstFingerTableEntries: function(count) {
      var result = [];
      var sortedKeys = _.chain(this._remoteNodes)
        .keys()
        .map(function (key) { return parseInt(key); })
        .sortBy()
        .value();
      for (var i = 0; i < _.size(sortedKeys); i++) {
        var k = sortedKeys[i];
        if (!_.isNull(this._getEntry(k))) {
          if (_.isEmpty(result) || !_.last(result).equals(this._getEntry(k))) {
            result.push(this._getEntry(k));
          }
        }
        if (_.size(result) >= count) {
          break;
        }
      }
      return result;
    },

    containsReference: function(reference) {
      if (_.isNull(reference)) {
        throw new Error("Invalid argument.");
      }

      return _.some(this._remoteNodes, function(node) {
        return node.equals(reference);
      });
    },

    getStatus: function() {
      var self = this;
      return _(this._localId.getLength()).times(function(i) {
        return _.isNull(self._getEntry(i)) ? null : self._getEntry(i).toNodeInfo();
      });
    },

    toString: function() {
      var self = this;

      return "[FingerTable]\n" + _.chain(this._remoteNodes)
        .keys()
        .map(function(key) { return parseInt(key); })
        .sortBy()
        .map(function(key, i, keys) {
          if (i === 0 || (i > 0 && !self._getEntry(keys[i]).equals(self._getEntry(keys[i - 1])))) {
            return "[" + key + "] " + self._getEntry(key).toString();
          }

          if (i === _.size(keys) - 1 ||
              (i < _.size(keys) - 1 && !self._getEntry(keys[i]).equals(self._getEntry(keys[i + 1])))) {
            return "[" + key + "]";
          }

          if ((i > 1 &&
               self._getEntry(keys[i]).equals(self._getEntry(keys[i - 1])) &&
               !self._getEntry(keys[i]).equals(self._getEntry(keys[i - 2]))) ||
              (i === 1 && self._getEntry(keys[i]).equals(self._getEntry(keys[i - 1])))) {
            return "..."
          }

          if (i > 1 &&
              self._getEntry(keys[i]).equals(self._getEntry(keys[i - 1])) &&
              self._getEntry(keys[i]).equals(self._getEntry(keys[i - 2]))) {
            return "";
          }

          throw new Error("Unknown situation.");
        })
        .reject(function(str) { return str === ""; })
        .value()
        .join("\n") + "\n";
    }
  };

  return FingerTable;
});

define('SuccessorList',['underscore', 'Utils'], function(_, Utils) {
  var SuccessorList = function(localId, entries, references, config) {
    if (_.isNull(localId) || _.isNull(entries) || _.isNull(references)) {
      throw new Error("Invalid argument.");
    }

    if (!Utils.isValidNumber(config.numberOfEntriesInSuccessorList) ||
        config.numberOfEntriesInSuccessorList < 1) {
      config.numberOfEntriesInSuccessorList = 3;
    }

    this._localId = localId;
    this._capacity = config.numberOfEntriesInSuccessorList;
    this._entries = entries;
    this._references = references;
    this._successors = [];
  };

  SuccessorList.prototype = {
    addSuccessor: function(node) {
      if (_.isNull(node)) {
        throw new Error("Invalid argument.");
      }

      if (this.containsReference(node)) {
        return;
      }

      if (_.size(this._successors) >= this._capacity &&
          node.nodeId.isInInterval(_.last(this._successors).nodeId, this._localId)) {
        return;
      }

      var inserted = false;
      for (var i = 0; i < _.size(this._successors); i++) {
        if (node.nodeId.isInInterval(this._localId, this._successors[i].nodeId)) {
          Utils.insert(this._successors, i, node);
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        this._successors.push(node);
        inserted = true;
      }

      var fromId;
      var predecessor = this._references.getPredecessor();
      if (!_.isNull(predecessor)) {
        fromId = predecessor.nodeId;
      } else {
        var precedingNode = this._references.getClosestPrecedingNode(this._localId);
        if (!_.isNull(precedingNode)) {
          fromId = precedingNode.nodeId;
        } else {
          fromId = this._localId;
        }
      }
      var toId = this._localId;
      var entriesToReplicate = this._entries.getEntriesInInterval(fromId, toId);
      node.insertReplicas(entriesToReplicate);

      if (_.size(this._successors) > this._capacity) {
        var nodeToDelete = this._successors.pop();

        nodeToDelete.removeReplicas(this._localId, []);

        this._references.disconnectIfUnreferenced(nodeToDelete);
      }
    },

    getDirectSuccessor: function() {
      if (_.isEmpty(this._successors)) {
	return null;
      }
      return this._successors[0];
    },

    getClosestPrecedingNode: function(idToLookup) {
      if (_.isNull(idToLookup)) {
        throw new Error("Invalid argument.");
      }

      for (var i = _.size(this._successors) - 1; i >= 0; i--) {
        if (this._successors[i].nodeId.isInInterval(this._localId, idToLookup)) {
          return this._successors[i];
        }
      }
      return null;
    },

    getReferences: function() {
      return this._successors;
    },

    removeReference: function(node) {
      var self = this;

      if (_.isNull(node)) {
        throw new Error("Invalid argument.");
      }

      this._successors = _.reject(this._successors, function(s) {
        return s.equals(node);
      });

      var referencesOfFingerTable = this._references.getFirstFingerTableEntries(this._capacity);
      referencesOfFingerTable = _.reject(referencesOfFingerTable, function(r) {
        return r.equals(node);
      });
      _.each(referencesOfFingerTable, function(reference) {
        self.addSuccessor(reference);
      });
    },

    getSize: function() {
      return _.size(this._successors);
    },

    getCapacity: function() {
      return this._capacity;
    },

    containsReference: function(node) {
      if (_.isNull(node)) {
        throw new Error("Invalid argument.");
      }

      return !_.isUndefined(_.find(this._successors, function(n) {
        return n.equals(node);
      }));
    },

    getStatus: function() {
      return _.invoke(this._successors, 'toNodeInfo');
    },

    toString: function() {
      return "[Successors]\n" + _.map(this._successors, function(node, index) {
        return "[" + index + "] " + node.toString();
      }).join("\n") + "\n";
    }
  };

  return SuccessorList;
});

define('ReferenceList',['underscore', 'FingerTable', 'SuccessorList'], function(_, FingerTable, SuccessorList) {
  var ReferenceList = function(localId, entries, config) {
    if (_.isNull(localId) || _.isNull(entries)) {
      throw new Error("Invalid arguments.");
    }

    this._localId = localId;
    this._fingerTable = new FingerTable(localId, this);
    this._successors = new SuccessorList(localId, entries, this, config);
    this._predecessor = null;
    this._entries = entries;
  };

  ReferenceList.prototype = {
    addReference: function(reference) {
      if (_.isNull(reference)) {
        throw new Error("Invalid argument.");
      }

      if (reference.nodeId.equals(this._localId)) {
        return;
      }

      this._fingerTable.addReference(reference);
      this._successors.addSuccessor(reference);
    },

    removeReference: function(reference) {
      if (_.isNull(reference)) {
        throw new Error("Invalid argument.");
      }

      this._fingerTable.removeReference(reference);
      this._successors.removeReference(reference);

      if (reference.equals(this.getPredecessor())) {
        this._predecessor = null;
      }

      this.disconnectIfUnreferenced(reference);
    },

    getSuccessor: function() {
      return this._successors.getDirectSuccessor();
    },

    getSuccessors: function() {
      return this._successors.getReferences();
    },

    getClosestPrecedingNode: function(key) {
      if (_.isNull(key)) {
        throw new Error("Invalid argument.");
      }

      var foundNodes = [];

      var closestNodeFT = this._fingerTable.getClosestPrecedingNode(key);
      if (!_.isNull(closestNodeFT)) {
        foundNodes.push(closestNodeFT);
      }
      var closestNodeSL = this._successors.getClosestPrecedingNode(key);
      if (!_.isNull(closestNodeSL)) {
        foundNodes.push(closestNodeSL);
      }
      if (!_.isNull(this._predecessor) &&
          key.isInInterval(this._predecessor.nodeId, this._localId)) {
        foundNodes.push(this._predecessor);
      }

      foundNodes.sort(function(a, b) {
          return a.nodeId.compareTo(b.nodeId);
      });
      var keyIndex = _.chain(foundNodes)
        .map(function(node) { return node.nodeId; })
        .sortedIndex(function(id) { return id.equals(key); })
        .value();
      var index = (_.size(foundNodes) + (keyIndex - 1)) % _.size(foundNodes);
      var closestNode = foundNodes[index];
      if (_.isNull(closestNode)) {
        throw new Error("Closest node must not be null.");
      }
      return closestNode;
    },

    getPredecessor: function() {
      return this._predecessor;
    },

    addReferenceAsPredecessor: function(potentialPredecessor) {
      if (_.isNull(potentialPredecessor)) {
        throw new Error("Invalid argument.");
      }

      if (potentialPredecessor.nodeId.equals(this._localId)) {
        return;
      }

      if (_.isNull(this._predecessor) ||
          potentialPredecessor.nodeId.isInInterval(this._predecessor.nodeId, this._localId)) {
        this.setPredecessor(potentialPredecessor);
      }

      this.addReference(potentialPredecessor);
    },

    setPredecessor: function(potentialPredecessor) {
      if (_.isNull(potentialPredecessor)) {
        throw new Error("Invalid argument.");
      }

      if (potentialPredecessor.nodeId.equals(this._localId)) {
        return;
      }

      if (potentialPredecessor.equals(this._predecessor)) {
        return;
      }

      var formerPredecessor = this._predecessor;
      this._predecessor = potentialPredecessor;
      if (!_.isNull(formerPredecessor)) {
        this.disconnectIfUnreferenced(formerPredecessor);

        var size = this._successors.getSize();
        if (this._successors.getCapacity() === size) {
          var lastSuccessor = _.last(this._successors.getReferences());
          lastSuccessor.removeReplicas(this._predecessor.nodeId, []);
        }
      } else {
        var entriesToRep = this._entries.getEntriesInInterval(this._predecessor.nodeId, this._localId);
        var successors = this._successors.getReferences();
        _.each(successors, function(successor) {
          successor.insertReplicas(entriesToRep);
        });
      }
    },

    disconnectIfUnreferenced: function(removedReference) {
      if (_.isNull(removedReference)) {
        throw new Error("Invalid argument.");
      }

      if (!this.containsReference(removedReference)) {
        removedReference.disconnect();
      }
    },

    getFirstFingerTableEntries: function(count) {
      return this._fingerTable.getFirstFingerTableEntries(count);
    },

    containsReference: function(reference) {
      if (_.isNull(reference)) {
        throw new Error("Invalid argurment.");
      }

      return (this._fingerTable.containsReference(reference) ||
              this._successors.containsReference(reference) ||
              reference.equals(this._predecessor));
    },

    getStatuses: function() {
      return {
        successors: this._successors.getStatus(),
        fingerTable: this._fingerTable.getStatus(),
        predecessor: _.isNull(this.getPredecessor()) ? null : this.getPredecessor().toNodeInfo()
      };
    },

    toString: function() {
      return [
        this._successors.toString(),
        "[Predecessor]\n" + (_.isNull(this.getPredecessor()) ? "" : this.getPredecessor().toString()) + "\n",
        this._fingerTable.toString()
      ].join("\n") + "\n";
    }
  };

  return ReferenceList;
});

define('StabilizeTask',['underscore', 'Utils'], function(_, Utils) {
  var StabilizeTask = function(localNode, references, entries) {
    this._localNode = localNode;
    this._references = references;
    this._entries = entries;
    this._timer = null;
  };

  StabilizeTask.create = function(localNode, references, entries, config) {
    if (!Utils.isValidNumber(config.stabilizeTaskInterval) ||
        config.stabilizeTaskInterval < 0) {
      config.stabilizeTaskInterval = 30000;
    }

    var task = new StabilizeTask(localNode, references, entries);
    var timer = setInterval(function() {
      task.run();
    }, config.stabilizeTaskInterval);
    task._timer = timer;
    return task;
  };

  StabilizeTask.prototype = {
    run: function() {
      var self = this;

      var successors = this._references.getSuccessors();
      if (_.isEmpty(successors)) {
        return;
      }
      var successor = _.first(successors);

      successor.notify(this._localNode, function(references, error) {
        if (error) {
          console.log(error);
          self._references.removeReference(successor);
          return;
        }

        var RemoveUnreferencedSuccessorsAndAddReferences = function(references) {
          _.chain(successors)
            .reject(function(s) {
              return (s.equals(successor) ||
                      (!_.isNull(self._references.getPredecessor()) &&
                       s.equals(self._references.getPredecessor())) ||
                      _.some(references, function(r) { return r.equals(s); }));
            })
            .each(function(s) {
              self._references.removeReference(s);
            });

          _.each(references, function(ref) {
            self._references.addReference(ref);
          });

          var currentSuccessor = self._references.getSuccessor();
          if (!currentSuccessor.equals(successor)) {
            currentSuccessor.ping(function(isAlive, error) {
              if (error) {
                console.log(error);
                self._references.removeReference(currentSuccessor);
              }
            });
          }
        };

        if (_.size(references) > 0 && !_.isNull(references[0])) {
          if (!self._localNode.equals(references[0])) {
            successor.notifyAndCopyEntries(self._localNode, function(references, entries, error) {
              if (error) {
                console.log(error);
                return;
              }

              self._entries.addAll(entries);

              RemoveUnreferencedSuccessorsAndAddReferences(references);
            });
          }
        }

        RemoveUnreferencedSuccessorsAndAddReferences(references);
      });
    },

    shutdown: function() {
      if (!_.isNull(this._timer)) {
        clearInterval(this._timer);
      }
    }
  };

  return StabilizeTask;
});

define('FixFingerTask',['underscore', 'Utils'], function(_, Utils) {
  var FixFingerTask = function(localNode, references) {
    this._localNode = localNode;
    this._references = references;
    this._timer = null;
  };

  FixFingerTask.create = function(localNode, references, config) {
    if (!Utils.isValidNumber(config.fixFingerTaskInterval) ||
        config.fixFingerTaskInterval < 0) {
      config.fixFingerTaskInterval = 30000;
    }

    var task = new FixFingerTask(localNode, references);
    var timer = setInterval(function() {
      task.run();
    }, config.fixFingerTaskInterval);
    task._timer = timer;
    return task;
  };

  FixFingerTask.prototype = {
    run: function() {
      var self = this;

      var nextFingerToFix = _.random(this._localNode.nodeId.getLength() - 1);
      var lookForID = this._localNode.nodeId.addPowerOfTwo(nextFingerToFix);
      this._localNode.findSuccessor(lookForID, function(successor, error) {
        if (error) {
          console.log(error);
        }

        if (!_.isNull(successor) &&
            !self._references.containsReference(successor)) {
          self._references.addReference(successor);
        }
      });
    },

    shutdown: function() {
      if (!_.isNull(this._timer)) {
        clearInterval(this._timer);
      }
    }
  };

  return FixFingerTask;
});

define('CheckPredecessorTask',['underscore', 'Utils'], function(_, Utils) {
  var CheckPredecessorTask = function(references) {
    this._references = references;
    this._timer = null;
  };

  CheckPredecessorTask.create = function(references, config) {
    if (!Utils.isValidNumber(config.checkPredecessorTaskInterval) ||
        config.checkPredecessorTaskInterval < 0) {
      config.checkPredecessorTaskInterval = 30000;
    }

    var task = new CheckPredecessorTask(references);
    var timer = setInterval(function() {
      task.run();
    }, config.checkPredecessorTaskInterval);
    task._timer = timer;
    return task;
  };

  CheckPredecessorTask.prototype = {
    run: function() {
      var self = this;

      var predecessor = this._references.getPredecessor();
      if (_.isNull(predecessor)) {
        return;
      }

      predecessor.ping(function(isAlive, error) {
        if (error) {
          console.log(error);
          self._references.removeReference(predecessor);
        }
      });
    },

    shutdown: function() {
      if (!_.isNull(this._timer)) {
        clearInterval(this._timer);
      }
    }
  };

  return CheckPredecessorTask;
});

define('LocalNode',[
  'underscore', 'NodeFactory', 'EntryList', 'Entry', 'ReferenceList', 'ID', 'StabilizeTask',
  'FixFingerTask', 'CheckPredecessorTask', 'Utils'
], function(
  _, NodeFactory, EntryList, Entry, ReferenceList, ID, StabilizeTask, FixFingerTask, CheckPredecessorTask, Utils
) {
  var LocalNode = function(chord, config) {
    this._chord = chord;
    this._config = config;
    this.nodeId = null;
    this._peerId = null;
    this._nodeFactory = null;
    this._tasks = {};
    this._entries = null;
    this._references = null;
  };

  LocalNode.create = function(chord, config, callback) {
    var localNode = new LocalNode(chord, config);
    NodeFactory.create(localNode, config, function(peerId, factory, error) {
      if (error) {
        callback(null, error);
        return;
      }

      localNode.setup(peerId, factory);

      callback(localNode);
    });
  };

  LocalNode.prototype = {
    setup: function(peerId, nodeFactory) {
      this._peerId = peerId;
      this.nodeId = ID.create(peerId);
      this._nodeFactory = nodeFactory;
      this._entries = new EntryList();
      this._references = new ReferenceList(this.nodeId, this._entries, this._config);
    },

    _createTasks: function() {
      this._tasks = {
        stabilizeTask: StabilizeTask.create(this, this._references, this._entries, this._config),
        fixFingerTask: FixFingerTask.create(this, this._references, this._config),
        checkPredecessorTask: CheckPredecessorTask.create(this._references, this._config)
      };
    },

    _shutdownTasks: function() {
      _.invoke(this._tasks, 'shutdown');
    },

    create: function(callback) {
      this._createTasks();

      callback(this._peerId);
    },

    join: function(bootstrapId, callback) {
      var self = this;

      this._nodeFactory.create({peerId: bootstrapId}, function(bootstrapNode, error) {
        if (error) {
          callback(null, error);
          return;
        }

        self._references.addReference(bootstrapNode);

        bootstrapNode.findSuccessor(self.nodeId, function(successor, error) {
          if (error) {
            self._references.removeReference(bootstrapNode);
            callback(null, error);
            return;
          }

          self._references.addReference(successor);

          var _notifyAndCopyEntries = function(node, callback) {
            node.notifyAndCopyEntries(self, function(refs, entries, error) {
              if (error) {
                callback(null, null, error);
                return;
              }

              if (_.size(refs) === 1) {
                self._references.addReferenceAsPredecessor(successor);
                callback(refs, entries);
                return;
              }

              if (self.nodeId.isInInterval(refs[0].nodeId, successor.nodeId)) {
                self._references.addReferenceAsPredecessor(refs[0]);
                callback(refs, entries);
                return;
              }

              self._references.addReference(refs[0]);
              _notifyAndCopyEntries(refs[0], callback);
            });
          };
          _notifyAndCopyEntries(successor, function(refs, entries, error) {
            if (error) {
              console.log(error);
              self._createTasks();
              callback(self._peerId);
              return;
            }

            _.each(refs, function(ref) {
              if (!_.isNull(ref) && !ref.equals(self) &&
                  !self._references.containsReference(ref)) {
                self._references.addReference(ref);
              }
            });

            self._entries.addAll(entries);

            _.defer(function() {
              self._chord.onentriesinserted(_.invoke(entries, 'toJson'));
            });

            self._createTasks();

            callback(self._peerId);
          });
        });
      });
    },

    leave: function(callback) {
      var self = this;

      this._shutdownTasks();

      var successor = this._references.getSuccessor();
      if (!_.isNull(successor) && !_.isNull(this._references.getPredecessor())) {
        successor.leavesNetwork(this._references.getPredecessor());
      }

      this._nodeFactory.destroy();

      callback();
    },

    insert: function(key, value, callback) {
      var id = ID.create(key);
      var entry;
      try {
        entry = new Entry(id, value);
      } catch (e) {
        callback(e);
        return;
      }
      this.findSuccessor(id, function(successor, error) {
        if (error) {
          callback(error);
          return;
        }

        successor.insertEntry(entry, callback);
      });
    },

    retrieve: function(key, callback) {
      var id = ID.create(key);
      this.findSuccessor(id, function(successor, error) {
        if (error) {
          callback(null, error);
          return;
        }

        successor.retrieveEntries(id, function(entries, error) {
          if (error) {
            callback(null, error);
            return;
          }

          callback(_.map(entries, function(entry) { return entry.value; }));
        });
      });
    },

    remove: function(key, value, callback) {
      var id = ID.create(key);
      var entry;
      try {
        entry = new Entry(id, value);
      } catch (e) {
        callback(e);
        return;
      }
      this.findSuccessor(id, function(successor, error) {
        if (error) {
          callback(error);
          return;
        }

        successor.removeEntry(entry, callback);
      });
    },

    findSuccessor: function(key, callback) {
      var self = this;

      if (_.isNull(key)) {
        callback(null, new Error("Invalid argument."));
      }

      var successor = this._references.getSuccessor();
      if (_.isNull(successor)) {
        callback(this);
        return;
      }

      if (key.isInInterval(this.nodeId, successor.nodeId) ||
          key.equals(successor.nodeId)) {
        callback(successor);
        return;
      }

      var closestPrecedingNode = this._references.getClosestPrecedingNode(key);
      closestPrecedingNode.findSuccessor(key, function(successor, error) {
        if (error) {
          console.log(error);
          self._references.removeReference(closestPrecedingNode);
          self.findSuccessor(key, callback);
          return;
        }

        callback(successor);
      });
    },

    notifyAndCopyEntries: function(potentialPredecessor, callback) {
      var self = this;

      var references = this.notify(potentialPredecessor, function(references) {
        var entries = self._entries.getEntriesInInterval(self.nodeId, potentialPredecessor.nodeId);

        callback(references, entries);
      });
    },

    notify: function(potentialPredecessor, callback) {
      var references = [];
      if (!_.isNull(this._references.getPredecessor())) {
        references.push(this._references.getPredecessor());
      } else {
        references.push(potentialPredecessor);
      }
      references = references.concat(this._references.getSuccessors());

      this._references.addReferenceAsPredecessor(potentialPredecessor);

      callback(references);
    },

    leavesNetwork: function(predecessor) {
      this._references.removeReference(this._references.getPredecessor());
      this._references.addReferenceAsPredecessor(predecessor);
    },

    insertReplicas: function(replicas) {
      var self = this;

      this._entries.addAll(replicas);

      _.defer(function() {
        self._chord.onentriesinserted(_.invoke(replicas, 'toJson'));
      });
    },

    removeReplicas: function(sendingNodeId, replicas) {
      var self = this;

      if (_.size(replicas) !== 0) {
        this._entries.removeAll(replicas);

        _.defer(function() {
          self._chord.onentriesremoved(_.invoke(replicas, 'toJson'));
        });

        return;
      }

      var allReplicasToRemove = this._entries.getEntriesInInterval(this.nodeId, sendingNodeId);
      this._entries.removeAll(allReplicasToRemove);

      _.defer(function() {
        self._chord.onentriesremoved(_.invoke(allReplicasToRemove, 'toJson'));
      });
    },

    insertEntry: function(entry, callback) {
      var self = this;

      if (!_.isNull(this._references.getPredecessor()) &&
          !entry.id.isInInterval(this._references.getPredecessor().nodeId, this.nodeId)) {
        this._references.getPredecessor().insertEntry(entry, callback); 
        return;
      }

      this._entries.add(entry);

      _.defer(function() {
        self._chord.onentriesinserted([entry.toJson()]);
      });

      _.each(this._references.getSuccessors(), function(successor) {
        successor.insertReplicas([entry]);
      });

      callback(true);
    },

    retrieveEntries: function(id, callback) {
      if (!_.isNull(this._references.getPredecessor()) &&
          !id.isInInterval(this._references.getPredecessor().nodeId, this.nodeId)) {
        this._references.getPredecessor().retrieveEntries(id, callback);
        return;
      }

      callback(this._entries.getEntries(id));
    },

    removeEntry: function(entry, callback) {
      var self = this;

      if (!_.isNull(this._references.getPredecessor()) &&
          !entry.id.isInInterval(this._references.getPredecessor().nodeId, this.nodeId)) {
        this._references.getPredecessor().removeEntry(entry, callback);
        return;
      }

      this._entries.remove(entry);

      _.defer(function() {
        self._chord.onentriesremoved([entry.toJson()]);
      });

      _.each(this._references.getSuccessors(), function(successor) {
        successor.removeReplicas(self.nodeId, [entry]);
      });

      callback(true);
    },

    getStatuses: function() {
      var ret = this._references.getStatuses();
      ret['entries'] = this._entries.getStatus();
      return ret;
    },

    getPeerId: function() {
      return this._peerId;
    },

    toNodeInfo: function() {
      return {
        nodeId: this.nodeId.toHexString(),
        peerId: this._peerId
      };
    },

    equals: function(node) {
      if (_.isNull(node)) {
        return false;
      }
      return this.nodeId.equals(node.nodeId);
    },

    toString: function() {
      return this.nodeId.toHexString() + " (" + this._peerId + ")";
    },

    toDisplayString: function() {
      return [
        this._references.toString(),
        this._entries.toString()
      ].join("\n") + "\n";
    }
  };

  return LocalNode;
});

define('Chord',['underscore', 'LocalNode', 'Utils'], function(_, LocalNode, Utils) {
  var Chord = function(config) {
    if (!_.isObject(config)) {
      throw new Error("Invalid argument.");
    }

    this._config = config;
    this._localNode = null;
    this.onentriesinserted = function(entries) { ; };
    this.onentriesremoved = function(entries) { ; };
  };

  Chord.prototype = {
    create: function(callback) {
      var self = this;

      if (!_.isNull(this._localNode)) {
        throw new Error("Local node is already created.");
      }
      if (_.isUndefined(callback)) {
        callback = function() { ; };
      }

      LocalNode.create(this, this._config, function(localNode, error) {
        if (error) {
          callback(null, error);
          return;
        }

        self._localNode = localNode;
        self._localNode.create(function(peerId, error) {
          if (error) {
            self.leave();
            self._localNode = null;
          }

          callback(peerId, error);
        });
      });
    },

    join: function(bootstrapId, callback) {
      var self = this;

      if (!Utils.isNonemptyString(bootstrapId)) {
        throw new Error("Invalid argument.");
      }
      if (!_.isNull(this._localNode)) {
        throw new Error("Local node is already created.");
      }
      if (_.isUndefined(callback)) {
        callback = function() { ; };
      }

      LocalNode.create(this, this._config, function(localNode, error) {
        if (error) {
          callback(null, error);
          return;
        }

        self._localNode = localNode;
        self._localNode.join(bootstrapId, function(peerId, error) {
          if (error) {
            self.leave();
            self._localNode = null;
          }

          callback(peerId, error);
        });
      });
    },

    leave: function() {
      var self = this;

      if (_.isNull(this._localNode)) {
        return;
      }

      this._localNode.leave(function() {
        self._localNode = null;
      });
    },

    insert: function(key, value, callback) {
      if (_.isUndefined(callback)) {
        callback = function() { ; };
      }
      if (!Utils.isNonemptyString(key) || _.isUndefined(value)) {
        callback(new Error("Invalid arguments."));
        return;
      }

      this._localNode.insert(key, value, callback);
    },

    retrieve: function(key, callback) {
      if (_.isUndefined(callback)) {
        callback = function() { ; };
      }
      if (!Utils.isNonemptyString(key)) {
        callback(new Error("Invalid argument."));
        return;
      }

      this._localNode.retrieve(key, callback);
    },

    remove: function(key, value, callback) {
      if (_.isUndefined(callback)) {
        callback = function() { ; };
      }
      if (!Utils.isNonemptyString(key) || _.isUndefined(value)) {
        callback(new Error("Invalid arguments."));
        return;
      }

      this._localNode.remove(key, value, callback);
    },

    getStatuses: function() {
      return this._localNode.getStatuses();
    },

    getPeerId: function() {
      if (_.isNull(this._localNode)) {
        return null;
      }

      return this._localNode.getPeerId();
    },

    getNodeId: function() {
      if (_.isNull(this._localNode)) {
        return null;
      }

      return this._localNode.nodeId.toHexString();
    },

    toString: function() {
      if (_.isNull(this._localNode)) {
        return "";
      }

      return this._localNode.toDisplayString();
    }
  };

  return Chord;
});


    //The modules for your project will be inlined above
    //this snippet. Ask almond to synchronously require the
    //module value for 'main' here and return it as the
    //value to use for the public API for the built file.
    return __browserify_shim_require__('Chord');
}));

; browserify_shim__define__module__export__(typeof Chord != "undefined" ? Chord : window.Chord);

}).call(global, undefined, undefined, undefined, undefined, function defineExport(ex) { module.exports = ex; });

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],"webrtc-chord":[function(require,module,exports){
module.exports=require('rzYpuO');
},{}],6:[function(require,module,exports){
//     Underscore.js 1.6.0
//     http://underscorejs.org
//     (c) 2009-2014 Jeremy Ashkenas, DocumentCloud and Investigative Reporters & Editors
//     Underscore may be freely distributed under the MIT license.

(function() {

  // Baseline setup
  // --------------

  // Establish the root object, `window` in the browser, or `exports` on the server.
  var root = this;

  // Save the previous value of the `_` variable.
  var previousUnderscore = root._;

  // Establish the object that gets returned to break out of a loop iteration.
  var breaker = {};

  // Save bytes in the minified (but not gzipped) version:
  var ArrayProto = Array.prototype, ObjProto = Object.prototype, FuncProto = Function.prototype;

  // Create quick reference variables for speed access to core prototypes.
  var
    push             = ArrayProto.push,
    slice            = ArrayProto.slice,
    concat           = ArrayProto.concat,
    toString         = ObjProto.toString,
    hasOwnProperty   = ObjProto.hasOwnProperty;

  // All **ECMAScript 5** native function implementations that we hope to use
  // are declared here.
  var
    nativeForEach      = ArrayProto.forEach,
    nativeMap          = ArrayProto.map,
    nativeReduce       = ArrayProto.reduce,
    nativeReduceRight  = ArrayProto.reduceRight,
    nativeFilter       = ArrayProto.filter,
    nativeEvery        = ArrayProto.every,
    nativeSome         = ArrayProto.some,
    nativeIndexOf      = ArrayProto.indexOf,
    nativeLastIndexOf  = ArrayProto.lastIndexOf,
    nativeIsArray      = Array.isArray,
    nativeKeys         = Object.keys,
    nativeBind         = FuncProto.bind;

  // Create a safe reference to the Underscore object for use below.
  var _ = function(obj) {
    if (obj instanceof _) return obj;
    if (!(this instanceof _)) return new _(obj);
    this._wrapped = obj;
  };

  // Export the Underscore object for **Node.js**, with
  // backwards-compatibility for the old `require()` API. If we're in
  // the browser, add `_` as a global object via a string identifier,
  // for Closure Compiler "advanced" mode.
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = _;
    }
    exports._ = _;
  } else {
    root._ = _;
  }

  // Current version.
  _.VERSION = '1.6.0';

  // Collection Functions
  // --------------------

  // The cornerstone, an `each` implementation, aka `forEach`.
  // Handles objects with the built-in `forEach`, arrays, and raw objects.
  // Delegates to **ECMAScript 5**'s native `forEach` if available.
  var each = _.each = _.forEach = function(obj, iterator, context) {
    if (obj == null) return obj;
    if (nativeForEach && obj.forEach === nativeForEach) {
      obj.forEach(iterator, context);
    } else if (obj.length === +obj.length) {
      for (var i = 0, length = obj.length; i < length; i++) {
        if (iterator.call(context, obj[i], i, obj) === breaker) return;
      }
    } else {
      var keys = _.keys(obj);
      for (var i = 0, length = keys.length; i < length; i++) {
        if (iterator.call(context, obj[keys[i]], keys[i], obj) === breaker) return;
      }
    }
    return obj;
  };

  // Return the results of applying the iterator to each element.
  // Delegates to **ECMAScript 5**'s native `map` if available.
  _.map = _.collect = function(obj, iterator, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeMap && obj.map === nativeMap) return obj.map(iterator, context);
    each(obj, function(value, index, list) {
      results.push(iterator.call(context, value, index, list));
    });
    return results;
  };

  var reduceError = 'Reduce of empty array with no initial value';

  // **Reduce** builds up a single result from a list of values, aka `inject`,
  // or `foldl`. Delegates to **ECMAScript 5**'s native `reduce` if available.
  _.reduce = _.foldl = _.inject = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduce && obj.reduce === nativeReduce) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduce(iterator, memo) : obj.reduce(iterator);
    }
    each(obj, function(value, index, list) {
      if (!initial) {
        memo = value;
        initial = true;
      } else {
        memo = iterator.call(context, memo, value, index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // The right-associative version of reduce, also known as `foldr`.
  // Delegates to **ECMAScript 5**'s native `reduceRight` if available.
  _.reduceRight = _.foldr = function(obj, iterator, memo, context) {
    var initial = arguments.length > 2;
    if (obj == null) obj = [];
    if (nativeReduceRight && obj.reduceRight === nativeReduceRight) {
      if (context) iterator = _.bind(iterator, context);
      return initial ? obj.reduceRight(iterator, memo) : obj.reduceRight(iterator);
    }
    var length = obj.length;
    if (length !== +length) {
      var keys = _.keys(obj);
      length = keys.length;
    }
    each(obj, function(value, index, list) {
      index = keys ? keys[--length] : --length;
      if (!initial) {
        memo = obj[index];
        initial = true;
      } else {
        memo = iterator.call(context, memo, obj[index], index, list);
      }
    });
    if (!initial) throw new TypeError(reduceError);
    return memo;
  };

  // Return the first value which passes a truth test. Aliased as `detect`.
  _.find = _.detect = function(obj, predicate, context) {
    var result;
    any(obj, function(value, index, list) {
      if (predicate.call(context, value, index, list)) {
        result = value;
        return true;
      }
    });
    return result;
  };

  // Return all the elements that pass a truth test.
  // Delegates to **ECMAScript 5**'s native `filter` if available.
  // Aliased as `select`.
  _.filter = _.select = function(obj, predicate, context) {
    var results = [];
    if (obj == null) return results;
    if (nativeFilter && obj.filter === nativeFilter) return obj.filter(predicate, context);
    each(obj, function(value, index, list) {
      if (predicate.call(context, value, index, list)) results.push(value);
    });
    return results;
  };

  // Return all the elements for which a truth test fails.
  _.reject = function(obj, predicate, context) {
    return _.filter(obj, function(value, index, list) {
      return !predicate.call(context, value, index, list);
    }, context);
  };

  // Determine whether all of the elements match a truth test.
  // Delegates to **ECMAScript 5**'s native `every` if available.
  // Aliased as `all`.
  _.every = _.all = function(obj, predicate, context) {
    predicate || (predicate = _.identity);
    var result = true;
    if (obj == null) return result;
    if (nativeEvery && obj.every === nativeEvery) return obj.every(predicate, context);
    each(obj, function(value, index, list) {
      if (!(result = result && predicate.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if at least one element in the object matches a truth test.
  // Delegates to **ECMAScript 5**'s native `some` if available.
  // Aliased as `any`.
  var any = _.some = _.any = function(obj, predicate, context) {
    predicate || (predicate = _.identity);
    var result = false;
    if (obj == null) return result;
    if (nativeSome && obj.some === nativeSome) return obj.some(predicate, context);
    each(obj, function(value, index, list) {
      if (result || (result = predicate.call(context, value, index, list))) return breaker;
    });
    return !!result;
  };

  // Determine if the array or object contains a given value (using `===`).
  // Aliased as `include`.
  _.contains = _.include = function(obj, target) {
    if (obj == null) return false;
    if (nativeIndexOf && obj.indexOf === nativeIndexOf) return obj.indexOf(target) != -1;
    return any(obj, function(value) {
      return value === target;
    });
  };

  // Invoke a method (with arguments) on every item in a collection.
  _.invoke = function(obj, method) {
    var args = slice.call(arguments, 2);
    var isFunc = _.isFunction(method);
    return _.map(obj, function(value) {
      return (isFunc ? method : value[method]).apply(value, args);
    });
  };

  // Convenience version of a common use case of `map`: fetching a property.
  _.pluck = function(obj, key) {
    return _.map(obj, _.property(key));
  };

  // Convenience version of a common use case of `filter`: selecting only objects
  // containing specific `key:value` pairs.
  _.where = function(obj, attrs) {
    return _.filter(obj, _.matches(attrs));
  };

  // Convenience version of a common use case of `find`: getting the first object
  // containing specific `key:value` pairs.
  _.findWhere = function(obj, attrs) {
    return _.find(obj, _.matches(attrs));
  };

  // Return the maximum element or (element-based computation).
  // Can't optimize arrays of integers longer than 65,535 elements.
  // See [WebKit Bug 80797](https://bugs.webkit.org/show_bug.cgi?id=80797)
  _.max = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.max.apply(Math, obj);
    }
    var result = -Infinity, lastComputed = -Infinity;
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      if (computed > lastComputed) {
        result = value;
        lastComputed = computed;
      }
    });
    return result;
  };

  // Return the minimum element (or element-based computation).
  _.min = function(obj, iterator, context) {
    if (!iterator && _.isArray(obj) && obj[0] === +obj[0] && obj.length < 65535) {
      return Math.min.apply(Math, obj);
    }
    var result = Infinity, lastComputed = Infinity;
    each(obj, function(value, index, list) {
      var computed = iterator ? iterator.call(context, value, index, list) : value;
      if (computed < lastComputed) {
        result = value;
        lastComputed = computed;
      }
    });
    return result;
  };

  // Shuffle an array, using the modern version of the
  // [Fisher-Yates shuffle](http://en.wikipedia.org/wiki/Fisher–Yates_shuffle).
  _.shuffle = function(obj) {
    var rand;
    var index = 0;
    var shuffled = [];
    each(obj, function(value) {
      rand = _.random(index++);
      shuffled[index - 1] = shuffled[rand];
      shuffled[rand] = value;
    });
    return shuffled;
  };

  // Sample **n** random values from a collection.
  // If **n** is not specified, returns a single random element.
  // The internal `guard` argument allows it to work with `map`.
  _.sample = function(obj, n, guard) {
    if (n == null || guard) {
      if (obj.length !== +obj.length) obj = _.values(obj);
      return obj[_.random(obj.length - 1)];
    }
    return _.shuffle(obj).slice(0, Math.max(0, n));
  };

  // An internal function to generate lookup iterators.
  var lookupIterator = function(value) {
    if (value == null) return _.identity;
    if (_.isFunction(value)) return value;
    return _.property(value);
  };

  // Sort the object's values by a criterion produced by an iterator.
  _.sortBy = function(obj, iterator, context) {
    iterator = lookupIterator(iterator);
    return _.pluck(_.map(obj, function(value, index, list) {
      return {
        value: value,
        index: index,
        criteria: iterator.call(context, value, index, list)
      };
    }).sort(function(left, right) {
      var a = left.criteria;
      var b = right.criteria;
      if (a !== b) {
        if (a > b || a === void 0) return 1;
        if (a < b || b === void 0) return -1;
      }
      return left.index - right.index;
    }), 'value');
  };

  // An internal function used for aggregate "group by" operations.
  var group = function(behavior) {
    return function(obj, iterator, context) {
      var result = {};
      iterator = lookupIterator(iterator);
      each(obj, function(value, index) {
        var key = iterator.call(context, value, index, obj);
        behavior(result, key, value);
      });
      return result;
    };
  };

  // Groups the object's values by a criterion. Pass either a string attribute
  // to group by, or a function that returns the criterion.
  _.groupBy = group(function(result, key, value) {
    _.has(result, key) ? result[key].push(value) : result[key] = [value];
  });

  // Indexes the object's values by a criterion, similar to `groupBy`, but for
  // when you know that your index values will be unique.
  _.indexBy = group(function(result, key, value) {
    result[key] = value;
  });

  // Counts instances of an object that group by a certain criterion. Pass
  // either a string attribute to count by, or a function that returns the
  // criterion.
  _.countBy = group(function(result, key) {
    _.has(result, key) ? result[key]++ : result[key] = 1;
  });

  // Use a comparator function to figure out the smallest index at which
  // an object should be inserted so as to maintain order. Uses binary search.
  _.sortedIndex = function(array, obj, iterator, context) {
    iterator = lookupIterator(iterator);
    var value = iterator.call(context, obj);
    var low = 0, high = array.length;
    while (low < high) {
      var mid = (low + high) >>> 1;
      iterator.call(context, array[mid]) < value ? low = mid + 1 : high = mid;
    }
    return low;
  };

  // Safely create a real, live array from anything iterable.
  _.toArray = function(obj) {
    if (!obj) return [];
    if (_.isArray(obj)) return slice.call(obj);
    if (obj.length === +obj.length) return _.map(obj, _.identity);
    return _.values(obj);
  };

  // Return the number of elements in an object.
  _.size = function(obj) {
    if (obj == null) return 0;
    return (obj.length === +obj.length) ? obj.length : _.keys(obj).length;
  };

  // Array Functions
  // ---------------

  // Get the first element of an array. Passing **n** will return the first N
  // values in the array. Aliased as `head` and `take`. The **guard** check
  // allows it to work with `_.map`.
  _.first = _.head = _.take = function(array, n, guard) {
    if (array == null) return void 0;
    if ((n == null) || guard) return array[0];
    if (n < 0) return [];
    return slice.call(array, 0, n);
  };

  // Returns everything but the last entry of the array. Especially useful on
  // the arguments object. Passing **n** will return all the values in
  // the array, excluding the last N. The **guard** check allows it to work with
  // `_.map`.
  _.initial = function(array, n, guard) {
    return slice.call(array, 0, array.length - ((n == null) || guard ? 1 : n));
  };

  // Get the last element of an array. Passing **n** will return the last N
  // values in the array. The **guard** check allows it to work with `_.map`.
  _.last = function(array, n, guard) {
    if (array == null) return void 0;
    if ((n == null) || guard) return array[array.length - 1];
    return slice.call(array, Math.max(array.length - n, 0));
  };

  // Returns everything but the first entry of the array. Aliased as `tail` and `drop`.
  // Especially useful on the arguments object. Passing an **n** will return
  // the rest N values in the array. The **guard**
  // check allows it to work with `_.map`.
  _.rest = _.tail = _.drop = function(array, n, guard) {
    return slice.call(array, (n == null) || guard ? 1 : n);
  };

  // Trim out all falsy values from an array.
  _.compact = function(array) {
    return _.filter(array, _.identity);
  };

  // Internal implementation of a recursive `flatten` function.
  var flatten = function(input, shallow, output) {
    if (shallow && _.every(input, _.isArray)) {
      return concat.apply(output, input);
    }
    each(input, function(value) {
      if (_.isArray(value) || _.isArguments(value)) {
        shallow ? push.apply(output, value) : flatten(value, shallow, output);
      } else {
        output.push(value);
      }
    });
    return output;
  };

  // Flatten out an array, either recursively (by default), or just one level.
  _.flatten = function(array, shallow) {
    return flatten(array, shallow, []);
  };

  // Return a version of the array that does not contain the specified value(s).
  _.without = function(array) {
    return _.difference(array, slice.call(arguments, 1));
  };

  // Split an array into two arrays: one whose elements all satisfy the given
  // predicate, and one whose elements all do not satisfy the predicate.
  _.partition = function(array, predicate) {
    var pass = [], fail = [];
    each(array, function(elem) {
      (predicate(elem) ? pass : fail).push(elem);
    });
    return [pass, fail];
  };

  // Produce a duplicate-free version of the array. If the array has already
  // been sorted, you have the option of using a faster algorithm.
  // Aliased as `unique`.
  _.uniq = _.unique = function(array, isSorted, iterator, context) {
    if (_.isFunction(isSorted)) {
      context = iterator;
      iterator = isSorted;
      isSorted = false;
    }
    var initial = iterator ? _.map(array, iterator, context) : array;
    var results = [];
    var seen = [];
    each(initial, function(value, index) {
      if (isSorted ? (!index || seen[seen.length - 1] !== value) : !_.contains(seen, value)) {
        seen.push(value);
        results.push(array[index]);
      }
    });
    return results;
  };

  // Produce an array that contains the union: each distinct element from all of
  // the passed-in arrays.
  _.union = function() {
    return _.uniq(_.flatten(arguments, true));
  };

  // Produce an array that contains every item shared between all the
  // passed-in arrays.
  _.intersection = function(array) {
    var rest = slice.call(arguments, 1);
    return _.filter(_.uniq(array), function(item) {
      return _.every(rest, function(other) {
        return _.contains(other, item);
      });
    });
  };

  // Take the difference between one array and a number of other arrays.
  // Only the elements present in just the first array will remain.
  _.difference = function(array) {
    var rest = concat.apply(ArrayProto, slice.call(arguments, 1));
    return _.filter(array, function(value){ return !_.contains(rest, value); });
  };

  // Zip together multiple lists into a single array -- elements that share
  // an index go together.
  _.zip = function() {
    var length = _.max(_.pluck(arguments, 'length').concat(0));
    var results = new Array(length);
    for (var i = 0; i < length; i++) {
      results[i] = _.pluck(arguments, '' + i);
    }
    return results;
  };

  // Converts lists into objects. Pass either a single array of `[key, value]`
  // pairs, or two parallel arrays of the same length -- one of keys, and one of
  // the corresponding values.
  _.object = function(list, values) {
    if (list == null) return {};
    var result = {};
    for (var i = 0, length = list.length; i < length; i++) {
      if (values) {
        result[list[i]] = values[i];
      } else {
        result[list[i][0]] = list[i][1];
      }
    }
    return result;
  };

  // If the browser doesn't supply us with indexOf (I'm looking at you, **MSIE**),
  // we need this function. Return the position of the first occurrence of an
  // item in an array, or -1 if the item is not included in the array.
  // Delegates to **ECMAScript 5**'s native `indexOf` if available.
  // If the array is large and already in sort order, pass `true`
  // for **isSorted** to use binary search.
  _.indexOf = function(array, item, isSorted) {
    if (array == null) return -1;
    var i = 0, length = array.length;
    if (isSorted) {
      if (typeof isSorted == 'number') {
        i = (isSorted < 0 ? Math.max(0, length + isSorted) : isSorted);
      } else {
        i = _.sortedIndex(array, item);
        return array[i] === item ? i : -1;
      }
    }
    if (nativeIndexOf && array.indexOf === nativeIndexOf) return array.indexOf(item, isSorted);
    for (; i < length; i++) if (array[i] === item) return i;
    return -1;
  };

  // Delegates to **ECMAScript 5**'s native `lastIndexOf` if available.
  _.lastIndexOf = function(array, item, from) {
    if (array == null) return -1;
    var hasIndex = from != null;
    if (nativeLastIndexOf && array.lastIndexOf === nativeLastIndexOf) {
      return hasIndex ? array.lastIndexOf(item, from) : array.lastIndexOf(item);
    }
    var i = (hasIndex ? from : array.length);
    while (i--) if (array[i] === item) return i;
    return -1;
  };

  // Generate an integer Array containing an arithmetic progression. A port of
  // the native Python `range()` function. See
  // [the Python documentation](http://docs.python.org/library/functions.html#range).
  _.range = function(start, stop, step) {
    if (arguments.length <= 1) {
      stop = start || 0;
      start = 0;
    }
    step = arguments[2] || 1;

    var length = Math.max(Math.ceil((stop - start) / step), 0);
    var idx = 0;
    var range = new Array(length);

    while(idx < length) {
      range[idx++] = start;
      start += step;
    }

    return range;
  };

  // Function (ahem) Functions
  // ------------------

  // Reusable constructor function for prototype setting.
  var ctor = function(){};

  // Create a function bound to a given object (assigning `this`, and arguments,
  // optionally). Delegates to **ECMAScript 5**'s native `Function.bind` if
  // available.
  _.bind = function(func, context) {
    var args, bound;
    if (nativeBind && func.bind === nativeBind) return nativeBind.apply(func, slice.call(arguments, 1));
    if (!_.isFunction(func)) throw new TypeError;
    args = slice.call(arguments, 2);
    return bound = function() {
      if (!(this instanceof bound)) return func.apply(context, args.concat(slice.call(arguments)));
      ctor.prototype = func.prototype;
      var self = new ctor;
      ctor.prototype = null;
      var result = func.apply(self, args.concat(slice.call(arguments)));
      if (Object(result) === result) return result;
      return self;
    };
  };

  // Partially apply a function by creating a version that has had some of its
  // arguments pre-filled, without changing its dynamic `this` context. _ acts
  // as a placeholder, allowing any combination of arguments to be pre-filled.
  _.partial = function(func) {
    var boundArgs = slice.call(arguments, 1);
    return function() {
      var position = 0;
      var args = boundArgs.slice();
      for (var i = 0, length = args.length; i < length; i++) {
        if (args[i] === _) args[i] = arguments[position++];
      }
      while (position < arguments.length) args.push(arguments[position++]);
      return func.apply(this, args);
    };
  };

  // Bind a number of an object's methods to that object. Remaining arguments
  // are the method names to be bound. Useful for ensuring that all callbacks
  // defined on an object belong to it.
  _.bindAll = function(obj) {
    var funcs = slice.call(arguments, 1);
    if (funcs.length === 0) throw new Error('bindAll must be passed function names');
    each(funcs, function(f) { obj[f] = _.bind(obj[f], obj); });
    return obj;
  };

  // Memoize an expensive function by storing its results.
  _.memoize = function(func, hasher) {
    var memo = {};
    hasher || (hasher = _.identity);
    return function() {
      var key = hasher.apply(this, arguments);
      return _.has(memo, key) ? memo[key] : (memo[key] = func.apply(this, arguments));
    };
  };

  // Delays a function for the given number of milliseconds, and then calls
  // it with the arguments supplied.
  _.delay = function(func, wait) {
    var args = slice.call(arguments, 2);
    return setTimeout(function(){ return func.apply(null, args); }, wait);
  };

  // Defers a function, scheduling it to run after the current call stack has
  // cleared.
  _.defer = function(func) {
    return _.delay.apply(_, [func, 1].concat(slice.call(arguments, 1)));
  };

  // Returns a function, that, when invoked, will only be triggered at most once
  // during a given window of time. Normally, the throttled function will run
  // as much as it can, without ever going more than once per `wait` duration;
  // but if you'd like to disable the execution on the leading edge, pass
  // `{leading: false}`. To disable execution on the trailing edge, ditto.
  _.throttle = function(func, wait, options) {
    var context, args, result;
    var timeout = null;
    var previous = 0;
    options || (options = {});
    var later = function() {
      previous = options.leading === false ? 0 : _.now();
      timeout = null;
      result = func.apply(context, args);
      context = args = null;
    };
    return function() {
      var now = _.now();
      if (!previous && options.leading === false) previous = now;
      var remaining = wait - (now - previous);
      context = this;
      args = arguments;
      if (remaining <= 0) {
        clearTimeout(timeout);
        timeout = null;
        previous = now;
        result = func.apply(context, args);
        context = args = null;
      } else if (!timeout && options.trailing !== false) {
        timeout = setTimeout(later, remaining);
      }
      return result;
    };
  };

  // Returns a function, that, as long as it continues to be invoked, will not
  // be triggered. The function will be called after it stops being called for
  // N milliseconds. If `immediate` is passed, trigger the function on the
  // leading edge, instead of the trailing.
  _.debounce = function(func, wait, immediate) {
    var timeout, args, context, timestamp, result;

    var later = function() {
      var last = _.now() - timestamp;
      if (last < wait) {
        timeout = setTimeout(later, wait - last);
      } else {
        timeout = null;
        if (!immediate) {
          result = func.apply(context, args);
          context = args = null;
        }
      }
    };

    return function() {
      context = this;
      args = arguments;
      timestamp = _.now();
      var callNow = immediate && !timeout;
      if (!timeout) {
        timeout = setTimeout(later, wait);
      }
      if (callNow) {
        result = func.apply(context, args);
        context = args = null;
      }

      return result;
    };
  };

  // Returns a function that will be executed at most one time, no matter how
  // often you call it. Useful for lazy initialization.
  _.once = function(func) {
    var ran = false, memo;
    return function() {
      if (ran) return memo;
      ran = true;
      memo = func.apply(this, arguments);
      func = null;
      return memo;
    };
  };

  // Returns the first function passed as an argument to the second,
  // allowing you to adjust arguments, run code before and after, and
  // conditionally execute the original function.
  _.wrap = function(func, wrapper) {
    return _.partial(wrapper, func);
  };

  // Returns a function that is the composition of a list of functions, each
  // consuming the return value of the function that follows.
  _.compose = function() {
    var funcs = arguments;
    return function() {
      var args = arguments;
      for (var i = funcs.length - 1; i >= 0; i--) {
        args = [funcs[i].apply(this, args)];
      }
      return args[0];
    };
  };

  // Returns a function that will only be executed after being called N times.
  _.after = function(times, func) {
    return function() {
      if (--times < 1) {
        return func.apply(this, arguments);
      }
    };
  };

  // Object Functions
  // ----------------

  // Retrieve the names of an object's properties.
  // Delegates to **ECMAScript 5**'s native `Object.keys`
  _.keys = function(obj) {
    if (!_.isObject(obj)) return [];
    if (nativeKeys) return nativeKeys(obj);
    var keys = [];
    for (var key in obj) if (_.has(obj, key)) keys.push(key);
    return keys;
  };

  // Retrieve the values of an object's properties.
  _.values = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var values = new Array(length);
    for (var i = 0; i < length; i++) {
      values[i] = obj[keys[i]];
    }
    return values;
  };

  // Convert an object into a list of `[key, value]` pairs.
  _.pairs = function(obj) {
    var keys = _.keys(obj);
    var length = keys.length;
    var pairs = new Array(length);
    for (var i = 0; i < length; i++) {
      pairs[i] = [keys[i], obj[keys[i]]];
    }
    return pairs;
  };

  // Invert the keys and values of an object. The values must be serializable.
  _.invert = function(obj) {
    var result = {};
    var keys = _.keys(obj);
    for (var i = 0, length = keys.length; i < length; i++) {
      result[obj[keys[i]]] = keys[i];
    }
    return result;
  };

  // Return a sorted list of the function names available on the object.
  // Aliased as `methods`
  _.functions = _.methods = function(obj) {
    var names = [];
    for (var key in obj) {
      if (_.isFunction(obj[key])) names.push(key);
    }
    return names.sort();
  };

  // Extend a given object with all the properties in passed-in object(s).
  _.extend = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Return a copy of the object only containing the whitelisted properties.
  _.pick = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    each(keys, function(key) {
      if (key in obj) copy[key] = obj[key];
    });
    return copy;
  };

   // Return a copy of the object without the blacklisted properties.
  _.omit = function(obj) {
    var copy = {};
    var keys = concat.apply(ArrayProto, slice.call(arguments, 1));
    for (var key in obj) {
      if (!_.contains(keys, key)) copy[key] = obj[key];
    }
    return copy;
  };

  // Fill in a given object with default properties.
  _.defaults = function(obj) {
    each(slice.call(arguments, 1), function(source) {
      if (source) {
        for (var prop in source) {
          if (obj[prop] === void 0) obj[prop] = source[prop];
        }
      }
    });
    return obj;
  };

  // Create a (shallow-cloned) duplicate of an object.
  _.clone = function(obj) {
    if (!_.isObject(obj)) return obj;
    return _.isArray(obj) ? obj.slice() : _.extend({}, obj);
  };

  // Invokes interceptor with the obj, and then returns obj.
  // The primary purpose of this method is to "tap into" a method chain, in
  // order to perform operations on intermediate results within the chain.
  _.tap = function(obj, interceptor) {
    interceptor(obj);
    return obj;
  };

  // Internal recursive comparison function for `isEqual`.
  var eq = function(a, b, aStack, bStack) {
    // Identical objects are equal. `0 === -0`, but they aren't identical.
    // See the [Harmony `egal` proposal](http://wiki.ecmascript.org/doku.php?id=harmony:egal).
    if (a === b) return a !== 0 || 1 / a == 1 / b;
    // A strict comparison is necessary because `null == undefined`.
    if (a == null || b == null) return a === b;
    // Unwrap any wrapped objects.
    if (a instanceof _) a = a._wrapped;
    if (b instanceof _) b = b._wrapped;
    // Compare `[[Class]]` names.
    var className = toString.call(a);
    if (className != toString.call(b)) return false;
    switch (className) {
      // Strings, numbers, dates, and booleans are compared by value.
      case '[object String]':
        // Primitives and their corresponding object wrappers are equivalent; thus, `"5"` is
        // equivalent to `new String("5")`.
        return a == String(b);
      case '[object Number]':
        // `NaN`s are equivalent, but non-reflexive. An `egal` comparison is performed for
        // other numeric values.
        return a != +a ? b != +b : (a == 0 ? 1 / a == 1 / b : a == +b);
      case '[object Date]':
      case '[object Boolean]':
        // Coerce dates and booleans to numeric primitive values. Dates are compared by their
        // millisecond representations. Note that invalid dates with millisecond representations
        // of `NaN` are not equivalent.
        return +a == +b;
      // RegExps are compared by their source patterns and flags.
      case '[object RegExp]':
        return a.source == b.source &&
               a.global == b.global &&
               a.multiline == b.multiline &&
               a.ignoreCase == b.ignoreCase;
    }
    if (typeof a != 'object' || typeof b != 'object') return false;
    // Assume equality for cyclic structures. The algorithm for detecting cyclic
    // structures is adapted from ES 5.1 section 15.12.3, abstract operation `JO`.
    var length = aStack.length;
    while (length--) {
      // Linear search. Performance is inversely proportional to the number of
      // unique nested structures.
      if (aStack[length] == a) return bStack[length] == b;
    }
    // Objects with different constructors are not equivalent, but `Object`s
    // from different frames are.
    var aCtor = a.constructor, bCtor = b.constructor;
    if (aCtor !== bCtor && !(_.isFunction(aCtor) && (aCtor instanceof aCtor) &&
                             _.isFunction(bCtor) && (bCtor instanceof bCtor))
                        && ('constructor' in a && 'constructor' in b)) {
      return false;
    }
    // Add the first object to the stack of traversed objects.
    aStack.push(a);
    bStack.push(b);
    var size = 0, result = true;
    // Recursively compare objects and arrays.
    if (className == '[object Array]') {
      // Compare array lengths to determine if a deep comparison is necessary.
      size = a.length;
      result = size == b.length;
      if (result) {
        // Deep compare the contents, ignoring non-numeric properties.
        while (size--) {
          if (!(result = eq(a[size], b[size], aStack, bStack))) break;
        }
      }
    } else {
      // Deep compare objects.
      for (var key in a) {
        if (_.has(a, key)) {
          // Count the expected number of properties.
          size++;
          // Deep compare each member.
          if (!(result = _.has(b, key) && eq(a[key], b[key], aStack, bStack))) break;
        }
      }
      // Ensure that both objects contain the same number of properties.
      if (result) {
        for (key in b) {
          if (_.has(b, key) && !(size--)) break;
        }
        result = !size;
      }
    }
    // Remove the first object from the stack of traversed objects.
    aStack.pop();
    bStack.pop();
    return result;
  };

  // Perform a deep comparison to check if two objects are equal.
  _.isEqual = function(a, b) {
    return eq(a, b, [], []);
  };

  // Is a given array, string, or object empty?
  // An "empty" object has no enumerable own-properties.
  _.isEmpty = function(obj) {
    if (obj == null) return true;
    if (_.isArray(obj) || _.isString(obj)) return obj.length === 0;
    for (var key in obj) if (_.has(obj, key)) return false;
    return true;
  };

  // Is a given value a DOM element?
  _.isElement = function(obj) {
    return !!(obj && obj.nodeType === 1);
  };

  // Is a given value an array?
  // Delegates to ECMA5's native Array.isArray
  _.isArray = nativeIsArray || function(obj) {
    return toString.call(obj) == '[object Array]';
  };

  // Is a given variable an object?
  _.isObject = function(obj) {
    return obj === Object(obj);
  };

  // Add some isType methods: isArguments, isFunction, isString, isNumber, isDate, isRegExp.
  each(['Arguments', 'Function', 'String', 'Number', 'Date', 'RegExp'], function(name) {
    _['is' + name] = function(obj) {
      return toString.call(obj) == '[object ' + name + ']';
    };
  });

  // Define a fallback version of the method in browsers (ahem, IE), where
  // there isn't any inspectable "Arguments" type.
  if (!_.isArguments(arguments)) {
    _.isArguments = function(obj) {
      return !!(obj && _.has(obj, 'callee'));
    };
  }

  // Optimize `isFunction` if appropriate.
  if (typeof (/./) !== 'function') {
    _.isFunction = function(obj) {
      return typeof obj === 'function';
    };
  }

  // Is a given object a finite number?
  _.isFinite = function(obj) {
    return isFinite(obj) && !isNaN(parseFloat(obj));
  };

  // Is the given value `NaN`? (NaN is the only number which does not equal itself).
  _.isNaN = function(obj) {
    return _.isNumber(obj) && obj != +obj;
  };

  // Is a given value a boolean?
  _.isBoolean = function(obj) {
    return obj === true || obj === false || toString.call(obj) == '[object Boolean]';
  };

  // Is a given value equal to null?
  _.isNull = function(obj) {
    return obj === null;
  };

  // Is a given variable undefined?
  _.isUndefined = function(obj) {
    return obj === void 0;
  };

  // Shortcut function for checking if an object has a given property directly
  // on itself (in other words, not on a prototype).
  _.has = function(obj, key) {
    return hasOwnProperty.call(obj, key);
  };

  // Utility Functions
  // -----------------

  // Run Underscore.js in *noConflict* mode, returning the `_` variable to its
  // previous owner. Returns a reference to the Underscore object.
  _.noConflict = function() {
    root._ = previousUnderscore;
    return this;
  };

  // Keep the identity function around for default iterators.
  _.identity = function(value) {
    return value;
  };

  _.constant = function(value) {
    return function () {
      return value;
    };
  };

  _.property = function(key) {
    return function(obj) {
      return obj[key];
    };
  };

  // Returns a predicate for checking whether an object has a given set of `key:value` pairs.
  _.matches = function(attrs) {
    return function(obj) {
      if (obj === attrs) return true; //avoid comparing an object to itself.
      for (var key in attrs) {
        if (attrs[key] !== obj[key])
          return false;
      }
      return true;
    }
  };

  // Run a function **n** times.
  _.times = function(n, iterator, context) {
    var accum = Array(Math.max(0, n));
    for (var i = 0; i < n; i++) accum[i] = iterator.call(context, i);
    return accum;
  };

  // Return a random integer between min and max (inclusive).
  _.random = function(min, max) {
    if (max == null) {
      max = min;
      min = 0;
    }
    return min + Math.floor(Math.random() * (max - min + 1));
  };

  // A (possibly faster) way to get the current timestamp as an integer.
  _.now = Date.now || function() { return new Date().getTime(); };

  // List of HTML entities for escaping.
  var entityMap = {
    escape: {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;'
    }
  };
  entityMap.unescape = _.invert(entityMap.escape);

  // Regexes containing the keys and values listed immediately above.
  var entityRegexes = {
    escape:   new RegExp('[' + _.keys(entityMap.escape).join('') + ']', 'g'),
    unescape: new RegExp('(' + _.keys(entityMap.unescape).join('|') + ')', 'g')
  };

  // Functions for escaping and unescaping strings to/from HTML interpolation.
  _.each(['escape', 'unescape'], function(method) {
    _[method] = function(string) {
      if (string == null) return '';
      return ('' + string).replace(entityRegexes[method], function(match) {
        return entityMap[method][match];
      });
    };
  });

  // If the value of the named `property` is a function then invoke it with the
  // `object` as context; otherwise, return it.
  _.result = function(object, property) {
    if (object == null) return void 0;
    var value = object[property];
    return _.isFunction(value) ? value.call(object) : value;
  };

  // Add your own custom functions to the Underscore object.
  _.mixin = function(obj) {
    each(_.functions(obj), function(name) {
      var func = _[name] = obj[name];
      _.prototype[name] = function() {
        var args = [this._wrapped];
        push.apply(args, arguments);
        return result.call(this, func.apply(_, args));
      };
    });
  };

  // Generate a unique integer id (unique within the entire client session).
  // Useful for temporary DOM ids.
  var idCounter = 0;
  _.uniqueId = function(prefix) {
    var id = ++idCounter + '';
    return prefix ? prefix + id : id;
  };

  // By default, Underscore uses ERB-style template delimiters, change the
  // following template settings to use alternative delimiters.
  _.templateSettings = {
    evaluate    : /<%([\s\S]+?)%>/g,
    interpolate : /<%=([\s\S]+?)%>/g,
    escape      : /<%-([\s\S]+?)%>/g
  };

  // When customizing `templateSettings`, if you don't want to define an
  // interpolation, evaluation or escaping regex, we need one that is
  // guaranteed not to match.
  var noMatch = /(.)^/;

  // Certain characters need to be escaped so that they can be put into a
  // string literal.
  var escapes = {
    "'":      "'",
    '\\':     '\\',
    '\r':     'r',
    '\n':     'n',
    '\t':     't',
    '\u2028': 'u2028',
    '\u2029': 'u2029'
  };

  var escaper = /\\|'|\r|\n|\t|\u2028|\u2029/g;

  // JavaScript micro-templating, similar to John Resig's implementation.
  // Underscore templating handles arbitrary delimiters, preserves whitespace,
  // and correctly escapes quotes within interpolated code.
  _.template = function(text, data, settings) {
    var render;
    settings = _.defaults({}, settings, _.templateSettings);

    // Combine delimiters into one regular expression via alternation.
    var matcher = new RegExp([
      (settings.escape || noMatch).source,
      (settings.interpolate || noMatch).source,
      (settings.evaluate || noMatch).source
    ].join('|') + '|$', 'g');

    // Compile the template source, escaping string literals appropriately.
    var index = 0;
    var source = "__p+='";
    text.replace(matcher, function(match, escape, interpolate, evaluate, offset) {
      source += text.slice(index, offset)
        .replace(escaper, function(match) { return '\\' + escapes[match]; });

      if (escape) {
        source += "'+\n((__t=(" + escape + "))==null?'':_.escape(__t))+\n'";
      }
      if (interpolate) {
        source += "'+\n((__t=(" + interpolate + "))==null?'':__t)+\n'";
      }
      if (evaluate) {
        source += "';\n" + evaluate + "\n__p+='";
      }
      index = offset + match.length;
      return match;
    });
    source += "';\n";

    // If a variable is not specified, place data values in local scope.
    if (!settings.variable) source = 'with(obj||{}){\n' + source + '}\n';

    source = "var __t,__p='',__j=Array.prototype.join," +
      "print=function(){__p+=__j.call(arguments,'');};\n" +
      source + "return __p;\n";

    try {
      render = new Function(settings.variable || 'obj', '_', source);
    } catch (e) {
      e.source = source;
      throw e;
    }

    if (data) return render(data, _);
    var template = function(data) {
      return render.call(this, data, _);
    };

    // Provide the compiled function source as a convenience for precompilation.
    template.source = 'function(' + (settings.variable || 'obj') + '){\n' + source + '}';

    return template;
  };

  // Add a "chain" function, which will delegate to the wrapper.
  _.chain = function(obj) {
    return _(obj).chain();
  };

  // OOP
  // ---------------
  // If Underscore is called as a function, it returns a wrapped object that
  // can be used OO-style. This wrapper holds altered versions of all the
  // underscore functions. Wrapped objects may be chained.

  // Helper function to continue chaining intermediate results.
  var result = function(obj) {
    return this._chain ? _(obj).chain() : obj;
  };

  // Add all of the Underscore functions to the wrapper object.
  _.mixin(_);

  // Add all mutator Array functions to the wrapper.
  each(['pop', 'push', 'reverse', 'shift', 'sort', 'splice', 'unshift'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      var obj = this._wrapped;
      method.apply(obj, arguments);
      if ((name == 'shift' || name == 'splice') && obj.length === 0) delete obj[0];
      return result.call(this, obj);
    };
  });

  // Add all accessor Array functions to the wrapper.
  each(['concat', 'join', 'slice'], function(name) {
    var method = ArrayProto[name];
    _.prototype[name] = function() {
      return result.call(this, method.apply(this._wrapped, arguments));
    };
  });

  _.extend(_.prototype, {

    // Start chaining a wrapped Underscore object.
    chain: function() {
      this._chain = true;
      return this;
    },

    // Extracts the result from a wrapped and chained object.
    value: function() {
      return this._wrapped;
    }

  });

  // AMD registration happens at the end for compatibility with AMD loaders
  // that may not enforce next-turn semantics on modules. Even though general
  // practice for AMD registration is to be anonymous, underscore registers
  // as a named module because, like jQuery, it is a base library that is
  // popular enough to be bundled in a third party lib, but not be part of
  // an AMD load request. Those cases could generate an error when an
  // anonymous define() is called outside of a loader request.
  if (typeof define === 'function' && define.amd) {
    define('underscore', [], function() {
      return _;
    });
  }
}).call(this);

},{}]},{},[1])