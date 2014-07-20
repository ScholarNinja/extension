!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{var f;"undefined"!=typeof window?f=window:"undefined"!=typeof global?f=global:"undefined"!=typeof self&&(f=self),f.Chord=e()}}(function(){var define,module,exports;return (function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(_dereq_,module,exports){
function Cache(capacity, callbackOnCacheOut) {
  this._items = {};
  this._useHistory = [];
  this._capacity = capacity;
  this._callbackOnCacheOut = callbackOnCacheOut;
};

Cache.prototype = {
  get: function(key, silent) {
    if (!this._items[key]) {
      return undefined;
    }
    if (!silent) {
      this._updateUseHistory(key);
    }
    return this._items[key];
  },

  set: function(key, item) {
    this._items[key] = item;
    this._updateUseHistory(key);
    if (Object.keys(this._items).length > this._capacity) {
      var keysToRemove = this._useHistory.slice(this._capacity);
      this._useHistory = this._useHistory.slice(0, this._capacity);
      for (var i = 0; i < keysToRemove.length; i++) {
        var itemToRemove = this._items[keysToRemove[i]];
        delete this._items[keysToRemove[i]];
        this._callbackOnCacheOut(itemToRemove);
      };
    }
  },

  remove: function(key) {
    if (!this._items[key]) {
      return;
    }
    var newUseHistory = [];
    for (var i = 0; i < this._useHistory.length; i++) {
      if (this._useHistory[i] !== key) {
        newUseHistory.push(this._useHistory[i]);
      }
    }
    this._useHistory = newUseHistory;
    var itemToRemove = this._items[key];
    delete this._items[key];
    this._callbackOnCacheOut(itemToRemove);
  },

  clear: function() {
    var keys = Object.keys(this._items);
    for (var i = 0; i < keys.length; i++) {
      this._callbackOnCacheOut(this._items[keys[i]]);
    }
    this._items = {};
    this._useHistory = [];
  },

  touch: function(key) {
    if (this._items[key]) {
      this._updateUseHistory(key);
    }
  },

  has: function(key) {
    return !!this._items[key];
  },

  keys: function() {
    return Object.keys(this._items);
  },

  _updateUseHistory: function(key) {
    for (var i = 0; i < this._useHistory.length; i++) {
      if (this._useHistory[i] === key) {
        this._useHistory.splice(i, 1);
        break;
      }
    }
    this._useHistory.unshift(key);
  }
};

module.exports = Cache;

},{}],2:[function(_dereq_,module,exports){
var Packet = _dereq_('./Packet');
var Util = _dereq_('./Util');

function Connection(conn, connectionFactory, config) {
  var self = this;

  this.id = Util.generateRandomId(8);
  this._conn = conn;
  this._connectionFactory = connectionFactory;
  this._connectionCloseDelay = config.connectionCloseDelay >= 0 ?
    config.connectionCloseDelay : 30000;
  this._destroyed = false;
  this._finReceived = false;
  this.ondata = function() {};
  this.onerror = function() {};
  this._silentConnectionCloseTimer = setTimeout(function() {
    self.destroy();
  }, config.silentConnectionCloseTimeout >= 0 ? config.silentConnectionCloseTimeout : 180000);

  this._conn.on('data', function(data) {
    var packet;
    try {
      packet = Packet.fromJson(data);
    } catch (e) {
      console.error(e);
      return;
    }

    if (packet.flags.FIN) {
      self._finReceived = true;
      self.destroy();
      return;
    }

    if (self.isAvailable()) {
      if (self._silentConnectionCloseTimer) {
        clearTimeout(self._silentConnectionCloseTimer);
        self._silentConnectionCloseTimer = null;
      }
      self._connectionFactory.addConnection(self);
    } else {
      self.destroy();
    }

    self.ondata(packet.payload);
  });

  this._conn.on('close', function() {
    if (!self._destroyed) {
      self.destroy();
    }
  });

  this._conn.on('error', function(error) {
    self.onerror(error);
  });
};

Connection.prototype = {
  send: function(data, callback) {
    if (!callback) {
      callback = function() {};
    }

    var packet = Packet.create({}, data);

    if (!this.isAvailable()) {
      this.destroy();
      callback(new Error("Connection is not available."));
      return;
    }

    try {
      this._conn.send(packet.toJson());
    } catch (e) {
      this.destroy();
      callback(e);
      return;
    }

    if (self._silentConnectionCloseTimer) {
      clearTimeout(self._silentConnectionCloseTimer);
      self._silentConnectionCloseTimer = null;
    }
    this._connectionFactory.addConnection(this);

    callback();
  },

  destroy: function() {
    var self = this;

    if (!this._destroyed) {
      if (!this._finReceived && this._conn.open) {
        var packet = Packet.create({FIN: true}, {});
        this._conn.send(packet.toJson());
      }

      this._destroyed = true;

      setTimeout(function() {
        self._conn.close();
      }, this._connectionCloseDelay);
    }
  },

  getRemotePeerId: function() {
    return this._conn.peer;
  },

  isAvailable: function() {
    return !this._finReceived && !this._destroyed && this._conn.open;
  }
};

module.exports = Connection;

},{"./Packet":4,"./Util":7}],3:[function(_dereq_,module,exports){
var PeerAgent = _dereq_('./PeerAgent');
var Connection = _dereq_('./Connection');
var Cache = _dereq_('./Cache');
var Queue = _dereq_('./Queue');
var Util = _dereq_('./Util');

function ConnectionFactory(config) {
  Util.initializeDebugLog(config.debug);

  this._peerAgent = null;
  this._connectionPool = new Cache(
    config.connectionPoolSize >= 0 ? config.connectionPoolSize : 10, function(connection) {
      connection.destroy();
    });
  this._callbackQueue = new Queue();
  this.onopen = function() {};
  this.onerror = function() {};
  this.onconnection = function() {};
  this.version = Util.version.join('.');

  this._setupPeerAgent(config);
};

ConnectionFactory.prototype = {
  _setupPeerAgent: function(config) {
    var self = this;

    this._peerAgent = new PeerAgent(config);

    this._peerAgent.onopen = function(peerId) {
      self.onopen(peerId);
    };

    this._peerAgent.onconnectionopened = function(peerId, conn, error) {
      if (error) {
        self._invokeNextCallback(peerId, null, error);
        return;
      }

      if (self._connectionPool.has(peerId)) {
        self._connectionPool.remove(peerId);
      }

      var connection = new Connection(conn, self, config);
      self._invokeNextCallback(peerId, connection);
    };

    this._peerAgent.onconnection = function(peerId, conn) {
      if (self._connectionPool.has(peerId)) {
        self._connectionPool.remove(peerId);
      }

      var connection = new Connection(conn, self, config);
      self.onconnection(connection);
    };

    this._peerAgent.onclose = function() {
    };

    this._peerAgent.onerror = function(error) {
      self.onerror(error);
    };
  },

  create: function(remotePeerId, callback) {
    var self = this;

    if (!remotePeerId) {
      callback(null, new Error("Invalid peer id."));
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
    if (!callbackInfo) {
      return;
    }

    if (this._peerAgent.isWaitingForOpeningConnection()) {
      return;
    }

    if (this._connectionPool.has(callbackInfo.peerId)) {
      var connection = this._connectionPool.get(callbackInfo.peerId);
      if (connection.isAvailable()) {
        this._invokeNextCallback(connection.getRemotePeerId(), connection);
        return;
      }

      this._connectionPool.remove(connection.getRemotePeerId());
    }

    this._peerAgent.connect(callbackInfo.peerId);
  },

  _invokeNextCallback: function(peerId, connection, error) {
    var self = this;

    setTimeout(function() {
      self._createConnectionAndInvokeNextCallback();
    }, 0);

    var callbackInfo = this._callbackQueue.dequeue();
    if (!callbackInfo) {
      console.warn("Unknown situation.");
      return;
    }
    if (callbackInfo.peerId !== peerId) {
      callbackInfo.callback(null, new Error("Unknown situation."));
      return;
    }
    callbackInfo.callback(connection, error);
  },

  addConnection: function(connection) {
    var _connection = this._connectionPool.get(connection.getRemotePeerId(), true);
    if (_connection && _connection.id !== connection.id) {
      this._connectionPool.remove(_connection.getRemotePeerId());
    }
    this._connectionPool.set(connection.getRemotePeerId(), connection);
  },

  removeConnection: function(remotePeerId) {
    this._connectionPool.remove(remotePeerId);
  },

  destroy: function() {
    this._connectionPool.clear();
    this._peerAgent.destroy();
  },

  getPeerId: function() {
    return this._peerAgent.getPeerId();
  }
};

module.exports = ConnectionFactory;

},{"./Cache":1,"./Connection":2,"./PeerAgent":5,"./Queue":6,"./Util":7}],4:[function(_dereq_,module,exports){
var Util = _dereq_('./Util');

function Packet(id, version, flags, payload) {
  if (typeof id !== 'string' || typeof version !== 'object' || typeof flags !== 'object') {
    throw new Error("[Packet] Invalid argument.");
  }

  if (version[0] !== Util.version[0]) {
    throw new Error("[Packet] Incompatible version: " + version.join('.'));
  }

  this.id = id;
  this.version = version;
  this.flags = flags;
  this.payload = payload;
};

Packet.create = function(flags, payload) {
  return new Packet(Util.generateRandomId(8), Util.version, flags, payload);
};

Packet.fromJson = function(json) {
  if (typeof json !== 'object') {
    throw new Error("[Packet] Invalid argument.");
  }
  return new Packet(json.id, json.version, json.flags, json.payload);
};

Packet.prototype = {
  toJson: function() {
    return {
      id: this.id,
      version: this.version,
      flags: this.flags,
      payload: this.payload,
    };
  }
};

module.exports = Packet;

},{"./Util":7}],5:[function(_dereq_,module,exports){
(function (global){
var Peer = (typeof window !== "undefined" ? window.Peer : typeof global !== "undefined" ? global.Peer : null);

function PeerAgent(config) {
  var self = this;

  this._connectionOpenTimeout = config.connectionOpenTimeout >= 0 ?
    config.connectionOpenTimeout : 30000;
  this.onopen = function() {};
  this.onconnectionopened = function() {};
  this.onconnection = function() {};
  this.onclose = function() {};
  this.onerror = function() {};
  this._waitingTimer = null;

  var peerConfig = config.peer ? config.peer : {};
  if (!peerConfig.id) {
    this._peer = new Peer(peerConfig.options);
  } else {
    this._peer = new Peer(peerConfig.id, peerConfig.options);
  }

  this._peer.on('open', function(id) {
    self._peer.on('connection', function(conn) {
      conn.on('open', function() {
        self.onconnection(conn.peer, conn);
      });
    });

    self._peer.on('close', function() {
      self.onclose();
    });

    self.onopen(id);
  });

  this._peer.on('disconnected', function() {
    if (!self._peer.destroyed) {
      self._peer.reconnect();
    }
  });

  this._peer.on('error', function(error) {
    var match = error.message.match(/Could not connect to peer (\w+)/);
    if (match) {
      if (!self.isWaitingForOpeningConnection()) {
        return;
      }

      clearTimeout(self._waitingTimer);
      self._waitingTimer = null;

      var peerId = match[1];
      callbacks.onconnectionopened(peerId, null, error);
      return;
    }

    self.onerror(error);
  });
};

PeerAgent.prototype = {
  connect: function(peerId) {
    var self = this;

    if (this.isWaitingForOpeningConnection()) {
      this.onconnectionopened(peerId, null, new Error("Invalid state."));
    }

    var conn = this._peer.connect(peerId);
    if (!conn) {
      this.onconnectionopened(peerId, null, new Error("Failed to open connection to " + peerId + "."));
      return;
    }

    this._waitingTimer = setTimeout(function() {
      if (!self.isWaitingForOpeningConnection()) {
        return;
      }

      self._waitingTimer = null;

      self.onconnectionopened(peerId, null, new Error("Opening connection to " + peerId + " timed out."));
    }, this._connectionOpenTimeout);

    conn.on('open', function() {
      if (!self.isWaitingForOpeningConnection()) {
        conn.close();
        return;
      }

      clearTimeout(self._waitingTimer);
      self._waitingTimer = null;

      self.onconnectionopened(peerId, conn);
    });
  },

  isWaitingForOpeningConnection: function() {
    return this._waitingTimer !== null;
  },

  destroy: function() {
    this._peer.destroy();
  },

  getPeerId: function() {
    return this._peer.id;
  }
};

module.exports = PeerAgent;

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],6:[function(_dereq_,module,exports){
function Queue(items) {
  this._items = [];

  if (items) {
    for (var i = 0; i < items.length; i++) {
      this._items.push(items[i]);
    }
  }
};

Queue.prototype = {
  enqueue: function(item) {
    this._items.push(item);
  },

  dequeue: function() {
    if (this._items.length === 0) {
      return undefined;
    }
    return this._items.shift();
  },

  first: function() {
    if (this._items.length === 0) {
      return undefined;
    }
    return this._items[0];
  },

  last: function() {
    if (this._items.length === 0) {
      return undefined;
    }
    return this._items[this._items.length - 1];
  },

  size: function() {
    return this._items.length;
  },
};

module.exports = Queue;

},{}],7:[function(_dereq_,module,exports){
Util = {
  version: [1, 0, 0],

  generateRandomId: function(length) {
    var id = "";
    while (id.length < length) {
      id += Math.random().toString(36).substr(2);
    }
    return id.substr(0, length);
  },

  initializeDebugLog: function(enabled) {
    Util.debug = function() {
      if (enabled) {
        var args = Array.prototype.slice.call(arguments);
        var d = new Date()
        var timeStr = [d.getHours(), d.getMinutes(), d.getSeconds()].join(':') + ':';
        args.unshift(timeStr);
        console.log.apply(console, args);
      }
    };
  },
};

module.exports = Util;

},{}],8:[function(_dereq_,module,exports){
(function (global){
(function() {
  var _ = (typeof window !== "undefined" ? window._ : typeof global !== "undefined" ? global._ : null);
  var Utils = _dereq_('./Utils');

  var CheckPredecessorTask = function(localNode, references) {
    this._localNode = localNode;
    this._references = references;
    this._timer = null;
  };

  CheckPredecessorTask.create = function(localNode, references, config) {
    if (!Utils.isZeroOrPositiveNumber(config.checkPredecessorTaskInterval)) {
      config.checkPredecessorTaskInterval = 30000;
    }

    var task = new CheckPredecessorTask(localNode, references);
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

      predecessor.notifyAsSuccessor(this._localNode, function(successor, error) {
        if (error) {
          console.log(error);
          self._references.removeReference(predecessor);
          return;
        }

        if (!successor.equals(self._localNode)) {
          Utils.debug("[CheckPredecessorTask] Predecessor's successor is not self.");

          self._references.addReferenceAsPredecessor(successor);

          self.run();
          return;
        }

        predecessor = self._references.getPredecessor();
        Utils.debug("[CheckPredecessorTask] predecessor:", predecessor ? predecessor.getPeerId() : null);
      });
    },

    shutdown: function() {
      if (!_.isNull(this._timer)) {
        clearInterval(this._timer);
      }
    }
  };

  module.exports = CheckPredecessorTask;
})();

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./Utils":24}],9:[function(_dereq_,module,exports){
(function (global){
(function() {
  var _ = (typeof window !== "undefined" ? window._ : typeof global !== "undefined" ? global._ : null);
  var LocalNode = _dereq_('./LocalNode');
  var Utils = _dereq_('./Utils');

  var Chord = function(config) {
    if (!_.isObject(config)) {
      throw new Error("Invalid argument.");
    }
    Utils.enableDebugLog(config.debug);

    this.version = Utils.version.join('.');
    this._config = config;
    this._localNode = null;
    this.onentriesinserted = function(entries) { ; };
    this.onentriesremoved = function(entries) { ; };
  };

  Chord.prototype = {
    create: function(callback) {
      var self = this;

      if (this._localNode) {
        throw new Error("Local node is already created.");
      }
      if (!callback) {
        callback = function() {};
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
      if (this._localNode) {
        throw new Error("Local node is already created.");
      }
      if (!callback) {
        callback = function() {};
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

      if (!this._localNode) {
        return;
      }

      this._localNode.leave(function() {
        self._localNode = null;
      });
    },

    insert: function(key, value, callback) {
      if (!callback) {
        callback = function() {};
      }
      if (!this._localNode) {
        callback(null, new Error("Create or join network at first."));
        return;
      }
      if (!Utils.isNonemptyString(key) || _.isUndefined(value)) {
        callback(null, new Error("Invalid arguments."));
        return;
      }

      this._localNode.insert(key, value, callback);
    },

    retrieve: function(key, callback) {
      if (!callback) {
        callback = function() {};
      }
      if (!this._localNode) {
        callback(null, new Error("Create or join network at first."));
        return;
      }
      if (!Utils.isNonemptyString(key)) {
        callback(null, new Error("Invalid argument."));
        return;
      }

      this._localNode.retrieve(key, callback);
    },

    remove: function(key, value, callback) {
      if (!callback) {
        callback = function() {};
      }
      if (!this._localNode) {
        callback(new Error("Create or join network at first."));
        return;
      }
      if (!Utils.isNonemptyString(key) || _.isUndefined(value)) {
        callback(new Error("Invalid arguments."));
        return;
      }

      this._localNode.remove(key, value, callback);
    },

    getEntries: function() {
      if (!this._localNode) {
        throw new Error("Create or join network at first.");
      }
      return this._localNode.getEntries();
    },

    setEntries: function(entries) {
      if (!this._localNode) {
        throw new Error("Create or join network at first.");
      }
      return this._localNode.setEntries(entries);
    },

    getStatuses: function() {
      if (!this._localNode) {
        throw new Error("Create or join network at first.");
      }
      return this._localNode.getStatuses();
    },

    getPeerId: function() {
      if (!this._localNode) {
        throw new Error("Create or join network at first.");
      }
      return this._localNode.getPeerId();
    },

    getNodeId: function() {
      if (!this._localNode) {
        throw new Error("Create or join network at first.");
      }
      return this._localNode.nodeId.toHexString();
    },

    toString: function() {
      if (!this._localNode) {
        return "";
      }

      return this._localNode.toDisplayString();
    }
  };

  module.exports = Chord;
})();

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./LocalNode":15,"./Utils":24}],10:[function(_dereq_,module,exports){
(function (global){
(function() {
  var _ = (typeof window !== "undefined" ? window._ : typeof global !== "undefined" ? global._ : null);
  var ID = _dereq_('./ID');

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

  module.exports = Entry;
})();

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./ID":14}],11:[function(_dereq_,module,exports){
(function (global){
(function() {
  var _ = (typeof window !== "undefined" ? window._ : typeof global !== "undefined" ? global._ : null);
  var ID = _dereq_('./ID');
  var Utils = _dereq_('./Utils');

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

      Utils.debug("An entry added (key:", entry.id.toHexString(), ")");
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

      Utils.debug("An entry removed (key:", entry.id.toHexString(), ")");
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

    has: function(id) {
      return _.has(this._entries, id.toHexString());
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

    dump: function() {
      return _.chain(this._entries)
        .map(function(entries) {
          return _.invoke(entries.items(), 'toJson');
        })
        .flatten()
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

  module.exports = EntryList;
})();

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./ID":14,"./Utils":24}],12:[function(_dereq_,module,exports){
(function (global){
(function() {
  var _ = (typeof window !== "undefined" ? window._ : typeof global !== "undefined" ? global._ : null);

  var FingerTable = function(localId, references) {
    if (!localId || !references) {
      throw new Error("Invalid arguments.");
    }

    this._localId = localId;
    this._references = references;
    this._table = _(this._localId.getLength()).times(function() { return null; }).value();
    this._powerOfTwos = _(this._localId.getLength()).times(function(i) {
      return localId.addPowerOfTwo(i);
    }).value();
  };

  FingerTable.prototype = {
    addReference: function(node) {
      if (!node) {
        throw new Error("Invalid argument.");
      }

      if (node.nodeId.equals(this._localId)) {
        return;
      }

      var index = node.nodeId.getIntervalInPowerOfTwoFrom(this._localId);
      for (var i = index + 1; i < this._table.length; i++) {
        if (!this._table[i]) {
          this._table[i] = node;
        } else if (node.nodeId.isInInterval(this._table[i].nodeId, this._powerOfTwos[i])) {
          var oldEntry = this._table[i];
          this._table[i] = node;
          this._references.disconnectIfUnreferenced(oldEntry);
        } else {
          break;
        }
      }
    },

    getClosestPrecedingNode: function(key) {
      if (!key) {
        throw new Error("Invalid argument.");
      }

      if (key.equals(this._localId)) {
        return null;
      }

      var index = key.getIntervalInPowerOfTwoFrom(this._localId);
      return this._table[index];
    },

    removeReference: function(node) {
      var self = this;

      if (!node) {
        throw new Error("Invalid argument.");
      }

      if (node.nodeId.equals(this._localId)) {
        return;
      }

      var index = node.nodeId.getIntervalInPowerOfTwoFrom(this._localId);
      var replacingNode = this._table[index];
      for (var i = index + 1; i < this._table.length; i++) {
        if (!node.equals(this._table[i])) {
          break;
        }

        this._table[i] = replacingNode;
      }

      this._references.disconnectIfUnreferenced(node);
    },

    getFirstFingerTableEntries: function(count) {
      var result = [];
      for (var i = 0; i < this._table.length; i++) {
        if (this._table[i]) {
          if (result.length === 0 || !_.last(result).equals(this._table[i])) {
            result.push(this._table[i]);
          }
        }
        if (result.length >= count) {
          break;
        }
      }
      return result;
    },

    containsReference: function(reference) {
      if (!reference) {
        throw new Error("Invalid argument.");
      }

      if (reference.nodeId.equals(this._localId)) {
        return false;
      }

      var index = reference.nodeId.getIntervalInPowerOfTwoFrom(this._localId);
      if (index === this._table.length - 1) {
        return false;
      }
      return reference.equals(this._table[index + 1]);
    },

    getStatus: function() {
      var self = this;
      return _.map(this._table, function(node) {
        return !node ? null : node.toNodeInfo();
      });
    },

    toString: function() {
      var self = this;

      return "[FingerTable]\n" + _.chain(this._table)
        .map(function(node, i) {
          if (!node) {
            return "";
          }

          if (i === 0 || (i > 0 && !node.equals(self._table[i - 1]))) {
            return "[" + i + "] " + node.toString();
          }

          if (i === self._table.length - 1 ||
              !node.equals(self._table[i + 1])) {
            return "[" + i + "]";
          }

          if ((i > 1 &&
               node.equals(self._table[i - 1]) &&
               !node.equals(self._table[i - 2])) ||
              (i === 1 && node.equals(self._table[i - 1]))) {
            return "..."
          }

          if (i > 1 &&
              node.equals(self._table[i - 1]) &&
              node.equals(self._table[i - 2])) {
            return "";
          }

          throw new Error("Unknown situation.");
        })
        .reject(function(str) { return str === ""; })
        .value()
        .join("\n") + "\n";
    }
  };

  module.exports = FingerTable;
})();

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],13:[function(_dereq_,module,exports){
(function (global){
(function() {
  var _ = (typeof window !== "undefined" ? window._ : typeof global !== "undefined" ? global._ : null);
  var Utils = _dereq_('./Utils');

  var FixFingerTask = function(localNode, references) {
    this._localNode = localNode;
    this._references = references;
    this._timer = null;
  };

  FixFingerTask.create = function(localNode, references, config) {
    if (!Utils.isZeroOrPositiveNumber(config.fixFingerTaskInterval)) {
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
          return;
        }

        if (!_.isNull(successor) &&
            !self._references.containsReference(successor)) {
          self._references.addReference(successor);
        }

        Utils.debug("[FixFingerTask] finger:", nextFingerToFix, ", successor:", successor.getPeerId());
      });
    },

    shutdown: function() {
      if (!_.isNull(this._timer)) {
        clearInterval(this._timer);
      }
    }
  };

  module.exports = FixFingerTask;
})();

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./Utils":24}],14:[function(_dereq_,module,exports){
(function (global){
(function() {
  var _ = (typeof window !== "undefined" ? window._ : typeof global !== "undefined" ? global._ : null);
  var CryptoJS = (typeof window !== "undefined" ? window.CryptoJS : typeof global !== "undefined" ? global.CryptoJS : null);
  var Utils = _dereq_('./Utils');

  var ID = function(bytes) {
    _.each(bytes, function(b) {
      if (_.isNaN(b) || !_.isNumber(b) || b < 0x00 || 0xff < b) {
        throw new Error("Invalid argument.");
      }
    });
    if (bytes.length !== ID._BYTE_SIZE) {
      throw new Error("Invalid argument.");
    }

    this._bytes = _.last(bytes, ID._BYTE_SIZE);
    this._hexString = _.map(this._bytes, function(b) {
      var str = b.toString(16);
      return b < 0x10 ? "0" + str : str;
    }).join("");
  };

  ID._BYTE_SIZE = 32;
  ID._BIT_LENGTH = ID._BYTE_SIZE * 8;

  ID.create = function(str) {
    if (!Utils.isNonemptyString(str)) {
      throw new Error("Invalid argument.");
    }

    return new ID(ID._createBytes(str));
  };

  ID._createBytes = function(str) {
    var hash = CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex);
    return ID._createBytesFromHexString(hash);
  };

  ID._createBytesFromHexString = function(str) {
    if (!Utils.isNonemptyString(str) || str.length < ID._BYTE_SIZE * 2) {
      throw new Error("Invalid argument.");
    }

    return _(ID._BYTE_SIZE).times(function(i) {
      return parseInt(str.substr(i * 2, 2), 16);
    }).value();
  };

  ID.fromHexString = function(str) {
    return new ID(ID._createBytesFromHexString(str));
  };

  ID._addInBytes = function(bytes1, bytes2) {
    var copy = _.clone(bytes1);
    var carry = 0;
    for (var i = bytes1.length - 1; i >= 0; i--) {
      copy[i] += (bytes2[i] + carry);
      if (copy[i] < 0) {
        carry = -1;
        copy[i] += 0x100;
      } else {
        carry = copy[i] >> 8;
      }
      copy[i] &= 0xff;
    }
    return copy;
  };

  ID.prototype = {
    isInInterval: function(fromId, toId) {
      if (!fromId || !toId) {
        throw new Error("Invalid arguments.");
      }

      if (fromId.equals(toId)) {
        return !this.equals(fromId);
      }

      if (fromId.compareTo(toId) < 0) {
        return (this.compareTo(fromId) > 0 && this.compareTo(toId) < 0);
      } else {
        return (this.compareTo(fromId) > 0 || this.compareTo(toId) < 0);
      }
    },

    addPowerOfTwo: function(powerOfTwo) {
      if (powerOfTwo < 0 || powerOfTwo >= ID._BIT_LENGTH) {
        throw new Error("Power of two out of index.");
      }

      var copy = _.clone(this._bytes);
      var indexOfBytes = this._bytes.length - 1 - Math.floor(powerOfTwo / 8);
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

    add: function(id) {
      return new ID(ID._addInBytes(this._bytes, id._bytes));
    },

    sub: function(id) {
      return new ID(ID._addInBytes(this._bytes, _.map(id._bytes, function(b) { return -b; })));
    },

    getIntervalInPowerOfTwoFrom: function(id) {
      if (this.equals(id)) {
        return -Infinity;
      }

      var diff = this.sub(id);
      for (var i = 0; i < ID._BIT_LENGTH; i++) {
        if (ID._powerOfTwos[i].compareTo(diff) > 0) {
          if (i === 0) {
            return -Infinity;
          }
          break;
        }
      }
      return i - 1;
    },

    compareTo: function(id) {
      for (var i = 0; i < ID._BYTE_SIZE; i++) {
        if (this._bytes[i] < id._bytes[i]) {
          return -1;
        } else if (this._bytes[i] > id._bytes[i]) {
          return 1;
        }
      }
      return 0;
    },

    equals: function(id) {
      return this.compareTo(id) === 0;
    },

    getLength: function() {
      return ID._BIT_LENGTH;
    },

    toHexString: function() {
      return this._hexString;
    }
  };

  ID.minId = new ID(_(ID._BYTE_SIZE).times(function() {
    return 0x00;
  }).value());

  ID.maxId = new ID(_(ID._BYTE_SIZE).times(function() {
    return 0xff;
  }).value());

  ID._powerOfTwos = _(ID.minId.getLength()).times(function(i) {
    return ID.minId.addPowerOfTwo(i);
  }).value();

  module.exports = ID;
})();

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./Utils":24}],15:[function(_dereq_,module,exports){
(function (global){
(function() {
  var _ = (typeof window !== "undefined" ? window._ : typeof global !== "undefined" ? global._ : null);
  var NodeFactory = _dereq_('./NodeFactory');
  var EntryList = _dereq_('./EntryList');
  var Entry = _dereq_('./Entry');
  var ReferenceList = _dereq_('./ReferenceList');
  var ID = _dereq_('./ID');
  var StabilizeTask = _dereq_('./StabilizeTask');
  var FixFingerTask = _dereq_('./FixFingerTask');
  var CheckPredecessorTask = _dereq_('./CheckPredecessorTask');
  var Utils = _dereq_('./Utils');

  var LocalNode = function(chord, config) {
    if (!Utils.isPositiveNumber(config.maximumNumberOfAttemptsOfNotifyAndCopyOnJoin)) {
      config.maximumNumberOfAttemptsOfNotifyAndCopyOnJoin = 5;
    }

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
        checkPredecessorTask: CheckPredecessorTask.create(this, this._references, this._config)
      };

      Utils.debug("Created tasks.");
    },

    _shutdownTasks: function() {
      _.invoke(this._tasks, 'shutdown');

      Utils.debug("Shutdown tasks.");
    },

    create: function(callback) {
      this._createTasks();

      Utils.debug("Created network (peer ID:", this._peerId, ").");

      callback(this._peerId);
    },

    join: function(bootstrapId, callback) {
      var self = this;

      Utils.debug("Trying to join network.");

      this._nodeFactory.create({peerId: bootstrapId}, function(bootstrapNode, error) {
        if (error) {
          callback(null, error);
          return;
        }

        self._references.addReference(bootstrapNode);

        bootstrapNode.findSuccessor(self.nodeId.addPowerOfTwo(0), function(successor, error) {
          if (error) {
            Utils.debug("[join] Failed to find successor:", error);
            self._references.removeReference(bootstrapNode);
            callback(null, error);
            return;
          }

          Utils.debug("[join] Found successor:", successor.getPeerId());

          self._references.addReference(successor);

          var _notifyAndCopyEntries = function(node, attempts, callback) {
            Utils.debug("[join] Trying to notify and copy entries "+ 
                        "(remote peer ID:", node.getPeerId(), ", attempts:", attempts, ").");

            if (attempts === 0) {
              console.log("Reached maximum number of attempts of NOTIFY_AND_COPY.");
              callback([], []);
              return;
            }

            node.notifyAndCopyEntries(self, function(refs, entries, error) {
              if (error) {
                Utils.debug("[join] Failed to notify and copy entries (remote peer ID:", node.getPeerId(), ").");
                callback(null, null, error);
                return;
              }

              if (_.size(refs) === 1) {
                Utils.debug("[join]", successor.getPeerId(), "is successor and also predecessor.");
                self._references.addReferenceAsPredecessor(successor);
                callback(refs, entries);
                return;
              }

              if (refs[0].equals(self)) {
                Utils.debug("[join] Left predecessor as null.");
                callback(refs, entries);
                return;
              }

              if (self.nodeId.isInInterval(refs[0].nodeId, successor.nodeId)) {
                Utils.debug("[join]", refs[0].getPeerId(), "is predecessor.");
                self._references.addReferenceAsPredecessor(refs[0]);
                callback(refs, entries);
                return;
              }

              Utils.debug("[join] Failed to find predecessor. Retry to notify and copy entries.");

              self._references.addReference(refs[0]);
              _notifyAndCopyEntries(refs[0], attempts - 1, callback);
            });
          };
          var maximumNumberOfAttempts = self._config.maximumNumberOfAttemptsOfNotifyAndCopyOnJoin;
          _notifyAndCopyEntries(successor, maximumNumberOfAttempts, function(refs, entries, error) {
            if (error) {
              console.log("Failed to notify and copy entries:", error);
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
            self._tasks.checkPredecessorTask.run();

            Utils.debug("Joining network succeeded.");

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

      Utils.debug("Left network.");

      callback();
    },

    insert: function(key, value, callback) {
      var entry;
      try {
        entry = new Entry(ID.create(key), value);
      } catch (e) {
        callback(null, e);
        return;
      }

      this.findSuccessor(entry.id, function(successor, error) {
        if (error) {
          callback(null, error);
          return;
        }

        successor.insertEntry(entry, function(error) {
          if (error) {
            callback(null, error);
            return;
          }

          callback(entry.id.toHexString());
        });
      });
    },

    retrieve: function(key, callback) {
      var id;
      try {
        id = ID.create(key);
      } catch (e) {
        callback(null, e);
        return;
      }

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
      var entry;
      try {
        entry = new Entry(ID.create(key), value);
      } catch (e) {
        callback(e);
        return;
      }

      this.findSuccessor(entry.id, function(successor, error) {
        if (error) {
          callback(error);
          return;
        }

        successor.removeEntry(entry, callback);
      });
    },

    
    getEntries: function() {
      return this._entries.dump();
    },

    setEntries: function(entries) {
      this._entries.addAll(_.map(entries, function(entry) {
        return Entry.fromJson(entry);
      }));
    },

    findSuccessor: function(key, callback) {
      var self = this;

      this.findSuccessorIterative(key, function(status, successor, error) {
        if (status === 'SUCCESS') {
          callback(successor);
        } else if (status === 'REDIRECT') {
          successor.findSuccessor(key, function(_successor, error) {
            if (error) {
              console.log(error);
              self._references.removeReference(successor);
              self.findSuccessor(key, callback);
              return;
            }

            callback(_successor);
          });
        } else if (status === 'FAILED') {
          callback(null, error);
        } else {
          callback(null, new Error("Got unknown status:", status));
        }
      });
    },

    findSuccessorIterative: function(key, callback) {
      var self = this;

      if (_.isNull(key)) {
        callback('FAILED', null, new Error("Invalid argument."));
        return;
      }

      if (!this._references.getPredecessor() ||
          key.isInInterval(this._references.getPredecessor().nodeId, this.nodeId) ||
          key.equals(this.nodeId)) {
        callback('SUCCESS', this);
        return;
      }

      var nextNode = this._references.getClosestPrecedingNode(key);
      if (!nextNode) {
        var successor = this._references.getSuccessor();
        if (!successor) {
          callback('SUCCESS', this);
          return;
        }

        nextNode = successor;
      }

      callback('REDIRECT', nextNode);
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

    notifyAsSuccessor: function(potentialSuccessor, callback) {
      this._references.addReference(potentialSuccessor);
      callback(this._references.getSuccessor());
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
      this.insertEntryIterative(entry, function(status, node) {
        if (status === 'SUCCESS') {
          callback();
        } else if (status === 'REDIRECT') {
          node.insertEntry(entry, callback);
        } else {
          callback(new Error("Got unknown status:", status));
        }
      });
    },

    insertEntryIterative: function(entry, callback) {
      var self = this;

      if (this._references.getPredecessor() &&
          !entry.id.isInInterval(this._references.getPredecessor().nodeId, this.nodeId) &&
          !entry.id.equals(this.nodeId)) {
        callback('REDIRECT', this._references.getPredecessor());
        return;
      }

      this._entries.add(entry);

      _.defer(function() {
        self._chord.onentriesinserted([entry.toJson()]);
      });

      _.each(this._references.getSuccessors(), function(successor) {
        successor.insertReplicas([entry]);
      });

      callback('SUCCESS');
    },

    retrieveEntries: function(id, callback) {
      this.retrieveEntriesIterative(id, function(status, entries, node) {
        if (status === 'SUCCESS') {
          callback(entries);
        } else if (status === 'REDIRECT') {
          node.retrieveEntries(id, callback);
        } else {
          callback(null, new Error("Got unknown status:", status));
        }
      });
    },

    retrieveEntriesIterative: function(id, callback) {
      if (this._entries.has(id)) {
        callback('SUCCESS', this._entries.getEntries(id));
        return;
      }

      if (this._references.getPredecessor() &&
          !id.isInInterval(this._references.getPredecessor().nodeId, this.nodeId) &&
          !id.equals(this.nodeId)) {
        callback('REDIRECT', null, this._references.getPredecessor());
        return;
      }

      callback('SUCCESS', this._entries.getEntries(id));
    },

    removeEntry: function(entry, callback) {
       this.removeEntryIterative(entry, function(status, node) {
        if (status === 'SUCCESS') {
          callback();
        } else if (status === 'REDIRECT') {
          node.removeEntry(entry, callback);
        } else {
          callback(new Error("Got unknown status:", status));
        }
      });
    },

    removeEntryIterative: function(entry, callback) {
      var self = this;

      if (this._references.getPredecessor() &&
          !entry.id.isInInterval(this._references.getPredecessor().nodeId, this.nodeId) &&
          !entry.id.equals(this.nodeId)) {
        callback('REDIRECT', this._references.getPredecessor());
        return;
      }

      this._entries.remove(entry);

      _.defer(function() {
        self._chord.onentriesremoved([entry.toJson()]);
      });

      _.each(this._references.getSuccessors(), function(successor) {
        successor.removeReplicas(self.nodeId, [entry]);
      });

      callback('SUCCESS');
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

  module.exports = LocalNode;
})();

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./CheckPredecessorTask":8,"./Entry":10,"./EntryList":11,"./FixFingerTask":13,"./ID":14,"./NodeFactory":17,"./ReferenceList":18,"./StabilizeTask":22,"./Utils":24}],16:[function(_dereq_,module,exports){
(function (global){
(function() {
  var _ = (typeof window !== "undefined" ? window._ : typeof global !== "undefined" ? global._ : null);
  var ID = _dereq_('./ID');
  var Request = _dereq_('./Request');
  var Entry = _dereq_('./Entry');
  var Utils = _dereq_('./Utils');

  var Node = function(nodeInfo, localId, nodeFactory, connectionFactory, requestHandler, config) {
    if (!Node.isValidNodeInfo(nodeInfo)) {
      throw new Error("Invalid arguments.");
    }

    if (!Utils.isZeroOrPositiveNumber(config.requestTimeout)) {
      config.requestTimeout = 180000;
    }
    if (!Utils.isZeroOrPositiveNumber(config.maxRoundCount)) {
      config.maxRoundCount = 1;
    }

    this._peerId = nodeInfo.peerId;
    this.nodeId = ID.create(nodeInfo.peerId);
    this._localId = localId;
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

      var roundCount = 0;
      (function _findSuccessor(node) {
        node.findSuccessorIterative(key, function(status, successor, error) {
          if (status === 'SUCCESS') {
            callback(successor);
          } else if (status === 'REDIRECT') {
            if (self.nodeId.isInInterval(node.nodeId, successor.nodeId)) {
              roundCount++;
              if (roundCount > self._config.maxRoundCount) {
                callback(null, new Error("FIND_SUCCESSOR request circulates in the network."));
                return;
              }
            }

            Utils.debug("[findSuccessor] redirected to " + successor.getPeerId());

            _findSuccessor(successor);
          } else if (status === 'FAILED') {
            callback(null, error);
          } else {
            callback(null, new Error("Got unknown status:", status));
          }
        });
      })(this);
    },

    findSuccessorIterative: function(key, callback) {
      var self = this;

      this._sendRequest('FIND_SUCCESSOR', {
        key: key.toHexString()
      }, {
        success: function(result) {
          var nodeInfo = result.successorNodeInfo;
          self._nodeFactory.create(nodeInfo, function(successor, error) {
            if (error) {
              callback('FAILED', null, error);
              return;
            }
            callback('SUCCESS', successor);
          });
        },

        redirect: function(result) {
          self._nodeFactory.create(result.redirectNodeInfo, function(nextNode, error) {
            if (error) {
              callback('FAILED', null, error);
              return;
            }

            callback('REDIRECT', nextNode);
          });
        },

        error: function(error) {
          callback('FAILED', null, error);
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

    notifyAsSuccessor: function(potentialSuccessor, callback) {
      var self = this;

      this._sendRequest('NOTIFY_AS_SUCCESSOR', {
        potentialSuccessorNodeInfo: potentialSuccessor.toNodeInfo()
      }, {
        success: function(result) {
          self._nodeFactory.create(result.successorNodeInfo, function(successor, error) {
            if (error) {
              callback(null, error);
              return;
            }

            callback(successor);
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
          callback();
        },

        error: function(error) {
          callback(error);
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
      var self = this;

      this._sendRequest('INSERT_ENTRY', {
        entry: entry.toJson()
      }, {
        success: function(result) {
          callback();
        },

        redirect: function(result) {
          self._nodeFactory.create(result.redirectNodeInfo, function(node, error) {
            if (error) {
              callback(error);
              return;
            }

            Utils.debug("[insertEntry] redirected to " + node.getPeerId());

            node.insertEntry(entry, callback);
          });
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

        redirect: function(result) {
          self._nodeFactory.create(result.redirectNodeInfo, function(node, error) {
            if (error) {
              callback(null, error);
              return;
            }

            Utils.debug("[retrieveEntries] redirected to " + node.getPeerId());

            node.retrieveEntries(id, callback);
          });
        },

        error: function(error) {
          callback(null, error);
        }
      });
    },

    removeEntry: function(entry, callback) {
      var self = this;

      this._sendRequest('REMOVE_ENTRY', {
        entry: entry.toJson()
      }, {
        success: function(result) {
          callback();
        },

        redirect: function(result) {
          self._nodeFactory.create(result.redirectNodeInfo, function(node, error) {
            if (error) {
              callback(error);
              return;
            }

            Utils.debug("[removeEntry] redirected to " + node.getPeerId());

            node.removeEntry(entry, callback);
          });
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
          if (callbacks && callbacks.error) {
            callbacks.error(error);
          }
          return;
        }

        self._nodeFactory.setListenersToConnection(connection);

        var request = Request.create(method, params);

        if (callbacks) {
          callbacks = _.defaults(callbacks, {
            success: function() {}, redirect: function() {}, error: function() {}
          });

          var timer = setTimeout(function() {
            self._nodeFactory.deregisterCallback(request.requestId);
            callbacks.error(new Error(method + " request to " + self._peerId + " timed out."));
          }, self._config.requestTimeout);

          self._nodeFactory.registerCallback(request.requestId, _.once(function(response) {
            clearTimeout(timer);

            switch (response.status) {
            case 'SUCCESS': callbacks.success(response.result); break;
            case 'REDIRECT': callbacks.redirect(response.result); break;
            case 'FAILED':
              callbacks.error(new Error(
                "Request to " + self._peerId + " failed: " + response.result.message));
              break;

            default:
              callback.error(new Error("Received unknown status response:", response.status));
            }
          }));
        }

        Utils.debug("Sending request to", self._peerId, ":", request.method);

        connection.send(request);
      });
    },

    onRequestReceived: function(request) {
      var self = this;

      Utils.debug("Received request from", this._peerId, ":", request.method);

      this._requestHandler.handle(request, function(response) {
        self._connectionFactory.create(self._peerId, function(connection, error) {
          if (error) {
            console.log(error);
            return;
          }

          self._nodeFactory.setListenersToConnection(connection);

          Utils.debug("Sending response to", self._peerId, ":", response.method);

          connection.send(response);
        });
      });
    },

    onResponseReceived: function(response) {
      Utils.debug("Received response from", this._peerId, ":", response.method, "(", response.status, ")");

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

  module.exports = Node;
})();

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./Entry":10,"./ID":14,"./Request":19,"./Utils":24}],17:[function(_dereq_,module,exports){
(function (global){
(function() {
  var _ = (typeof window !== "undefined" ? window._ : typeof global !== "undefined" ? global._ : null);
  var ConnectionFactory = _dereq_('connectionpool');
  var Node = _dereq_('./Node');
  var Request = _dereq_('./Request');
  var Response = _dereq_('./Response');
  var RequestHandler = _dereq_('./RequestHandler');
  var ID = _dereq_('./ID');
  var Utils = _dereq_('./Utils');

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

    var callbackOnce = _.once(callback);
    var connectionFactory = new ConnectionFactory(config);

    connectionFactory.onopen = function(peerId) {
      nodeFactory._connectionFactory = connectionFactory;
      callbackOnce(peerId, nodeFactory);
    };

    connectionFactory.onconnection = function(connection) {
      nodeFactory.setListenersToConnection(connection);
    };

    connectionFactory.onerror = function(error) {
      console.log(error);
      callbackOnce(null, null, error);
    };
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

      var node = new Node(nodeInfo, this._localNode.nodeId, this, this._connectionFactory,
                          this._requestHandler, this._config);

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

    setListenersToConnection: function(connection) {
      var self = this;

      connection.ondata = function(data) {
        if (Response.isResponse(data)) {
          var response;
          try {
            response = Response.fromJson(data);
          } catch (e) {
            console.log(e);
            return;
          }
          self._responseReceived(connection.getRemotePeerId(), response);
        } else if (Request.isRequest(data)) {
          var request;
          try {
            request = Request.fromJson(data);
          } catch (e) {
            console.log(e);
            return;
          }
          self._requestReceived(connection.getRemotePeerId(), request);
        }
      };

      connection.onerror = function(error) {
        console.log(error);
      };
    },

    _requestReceived: function(peerId, request) {
      this.create({peerId: peerId}, function(node, error) {
        if (error) {
          console.log(error);
          return;
        }
        node.onRequestReceived(request);
      });
    },

    _responseReceived: function(peerId, response) {
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

  module.exports = NodeFactory;
})();

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./ID":14,"./Node":16,"./Request":19,"./RequestHandler":20,"./Response":21,"./Utils":24,"connectionpool":3}],18:[function(_dereq_,module,exports){
(function (global){
(function() {
  var _ = (typeof window !== "undefined" ? window._ : typeof global !== "undefined" ? global._ : null);
  var FingerTable = _dereq_('./FingerTable');
  var SuccessorList = _dereq_('./SuccessorList');

  var ReferenceList = function(localId, entries, config) {
    if (!localId || !entries) {
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
      if (!reference) {
        throw new Error("Invalid argument.");
      }

      if (reference.nodeId.equals(this._localId)) {
        return;
      }

      this._fingerTable.addReference(reference);
      this._successors.addSuccessor(reference);
    },

    removeReference: function(reference) {
      if (!reference) {
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
      if (!key) {
        throw new Error("Invalid argument.");
      }

      if (key.equals(this._localId)) {
        return null;
      }

      var foundNodes = [];

      var closestNodeFT = this._fingerTable.getClosestPrecedingNode(key);
      if (closestNodeFT) {
        foundNodes.push(closestNodeFT);
      }
      var closestNodeSL = this._successors.getClosestPrecedingNode(key);
      if (closestNodeSL) {
        foundNodes.push(closestNodeSL);
      }
      if (this._predecessor &&
          key.isInInterval(this._predecessor.nodeId, this._localId)) {
        foundNodes.push(this._predecessor);
      }

      if (foundNodes.length === 0) {
        return null;
      }

      return _.chain(foundNodes)
        .sort(function(a, b) { return key.sub(a.nodeId).compareTo(key.sub(b.nodeId)); })
        .first()
        .value();
    },

    getPredecessor: function() {
      return this._predecessor;
    },

    addReferenceAsPredecessor: function(potentialPredecessor) {
      if (!potentialPredecessor) {
        throw new Error("Invalid argument.");
      }

      if (potentialPredecessor.nodeId.equals(this._localId)) {
        return;
      }

      if (!this._predecessor ||
          potentialPredecessor.nodeId.isInInterval(this._predecessor.nodeId, this._localId)) {
        this._setPredecessor(potentialPredecessor);
      }

      this.addReference(potentialPredecessor);
    },

    _setPredecessor: function(potentialPredecessor) {
      if (!potentialPredecessor) {
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
      if (formerPredecessor) {
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
      if (!removedReference) {
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
      if (!reference) {
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
        predecessor: !this.getPredecessor() ? null : this.getPredecessor().toNodeInfo()
      };
    },

    toString: function() {
      return [
        this._successors.toString(),
        "[Predecessor]\n" + (!this.getPredecessor() ? "" : this.getPredecessor().toString()) + "\n",
        this._fingerTable.toString()
      ].join("\n") + "\n";
    }
  };

  module.exports = ReferenceList;
})();

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./FingerTable":12,"./SuccessorList":23}],19:[function(_dereq_,module,exports){
(function (global){
(function() {
  var _ = (typeof window !== "undefined" ? window._ : typeof global !== "undefined" ? global._ : null);
  var Response = _dereq_('./Response');
  var Utils = _dereq_('./Utils');

  var Request = function(version, method, params, requestId, timestamp) {
    if (version[0] !== Utils.version[0]) {
      throw new Error("Cannot communicate with version " + version.join('.') +
                      " (your version is " + Utils.version.join('.') +")");
    }

    if (!Utils.isNonemptyString(method) || !_.isObject(params) ||
        !Utils.isNonemptyString(requestId) || !_.isNumber(timestamp)) {
      throw new Error("Invalid argument.");
    }

    this.version = version;
    this.method = method;
    this.params = params;
    this.requestId = requestId;
    this.timestamp = timestamp;
  };

  Request.create = function(method, params) {
    return new Request(Utils.version, method, params, Utils.generateRandomId(8), _.now());
  };

  Request.isRequest = function(data) {
    return !Response.isResponse(data);
  };

  Request.fromJson = function(json) {
    if (!_.isObject(json)) {
      throw new Error("Invalid argument.");
    }
    return new Request(json.version, json.method, json.params, json.requestId, json.timestamp);
  };

  Request.prototype = {
    toJson: function() {
      return {
        version: this.version,
        method: this.method,
        params: this.params,
        requestId: this.requestId,
        timestamp: this.timestamp
      };
    }
  };

  module.exports = Request;
})();

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./Response":21,"./Utils":24}],20:[function(_dereq_,module,exports){
(function (global){
(function() {
  var _ = (typeof window !== "undefined" ? window._ : typeof global !== "undefined" ? global._ : null);
  var ID = _dereq_('./ID');
  var Response = _dereq_('./Response');
  var Entry = _dereq_('./Entry');
  var Utils = _dereq_('./Utils');

  var RequestHandler = function(localNode, nodeFactory) {
    this._localNode = localNode;
    this._nodeFactory = nodeFactory;
    this._handlers = {
      'FIND_SUCCESSOR': this._onFindSuccessor,
      'NOTIFY_AND_COPY': this._onNotifyAndCopy,
      'NOTIFY': this._onNotify,
      'NOTIFY_AS_SUCCESSOR': this._onNotifyAsSuccessor,
      'PING': this._onPing,
      'INSERT_REPLICAS': this._onInsertReplicas,
      'REMOVE_REPLICAS': this._onRemoveReplicas,
      'INSERT_ENTRY': this._onInsertEntry,
      'RETRIEVE_ENTRIES': this._onRetrieveEntries,
      'REMOVE_ENTRY': this._onRemoveEntry,
      'LEAVES_NETWORK': this._onLeavesNetwork,
    };
  }

  RequestHandler.prototype = {
    handle: function(request, callback) {
      var handler = this._handlers[request.method];
      if (!handler) {
        this._sendFailureResponse("Unknown request method type: " + request.method, request, callback);
        return;
      }

      handler.call(this, request, callback);
    },

    _onFindSuccessor: function(request, callback) {
      var self = this;

      if (!Utils.isNonemptyString(request.params.key)) {
        this._sendFailureResponse("Invalid params.", request, callback);
        return;
      }

      var key = ID.fromHexString(request.params.key);
      this._localNode.findSuccessorIterative(key, function(status, node, error) {
        if (error) {
          console.log(error);
          self._sendFailureResponse(e.message, request, callback);
          return;
        }

        if (status === 'SUCCESS') {
          self._sendSuccessResponse({
            successorNodeInfo: node.toNodeInfo()
          }, request, callback);
        } else if (status === 'REDIRECT') {
          self._sendRedirectResponse({
            redirectNodeInfo: node.toNodeInfo()
          }, request, callback);
        }
      });
    },

    _onNotifyAndCopy: function(request, callback) {
      var self = this;

      var potentialPredecessorNodeInfo = request.params.potentialPredecessorNodeInfo;
      this._nodeFactory.create(potentialPredecessorNodeInfo, function(node, error) {
        if (error) {
          console.log(error);
          this._sendFailureResponse(e.message, request, callback);
          return;
        }

        self._localNode.notifyAndCopyEntries(node, function(references, entries) {
          if (_.isNull(references) || _.isNull(entries)) {
            self._sendFailureResponse("Unknown error.", request, callback);
            return;
          }

          self._sendSuccessResponse({
            referencesNodeInfo: _.invoke(references, 'toNodeInfo'),
            entries: _.invoke(entries, 'toJson')
          }, request, callback);
        });
      });
    },

    _onNotify: function(request, callback) {
      var self = this;

      var potentialPredecessorNodeInfo = request.params.potentialPredecessorNodeInfo;
      this._nodeFactory.create(potentialPredecessorNodeInfo, function(node, error) {
        if (error) {
          console.log(error);
          self._sendFailureResponse(e.message, request, callback);
          return;
        }

        self._localNode.notify(node, function(references) {
          if (_.isNull(references)) {
            self._sendFailureResponse("Unknown error.", request, callback);
            return;
          }

          self._sendSuccessResponse({
            referencesNodeInfo: _.invoke(references, 'toNodeInfo')
          }, request, callback);
        });
      });
    },

    _onNotifyAsSuccessor: function(request, callback) {
      var self = this;

      var potentialSuccessorNodeInfo = request.params.potentialSuccessorNodeInfo;
      this._nodeFactory.create(potentialSuccessorNodeInfo, function(potentialSuccessor, error) {
        if (error) {
          console.log(error);
          self._sendFailureResponse(e.message, request, callback);
          return;
        }

        self._localNode.notifyAsSuccessor(potentialSuccessor, function(successor, error) {
          if (error) {
            self._sendFailureResponse(e.message, request, callback);
            return;
          }

          self._sendSuccessResponse({
            successorNodeInfo: successor.toNodeInfo()
          }, request, callback);
        });
      });
    },

    _onPing: function(request, callback) {
      this._sendSuccessResponse({}, request, callback);
    },

    _onInsertReplicas: function(request, callback) {
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
      this._localNode.insertReplicas(replicas);
    },

    _onRemoveReplicas: function(request, callback) {
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
      this._localNode.removeReplicas(sendingNodeId, replicas);
    },

    _onInsertEntry: function(request, callback) {
      var self = this;

      var entry;
      try {
        entry = Entry.fromJson(request.params.entry);
      } catch (e) {
        this._sendFailureResponse(e.message, request, callback);;
        return;
      }
      this._localNode.insertEntryIterative(entry, function(status, node, error) {
        if (error) {
          console.log("Failed to insert entry:", error);
          self._sendFailureResponse("Unknown error.", request, callback);
          return;
        }

        if (status === 'SUCCESS') {
          self._sendSuccessResponse({}, request, callback);
        } else if (status === 'REDIRECT') {
          self._sendRedirectResponse({
            redirectNodeInfo: node.toNodeInfo()
          }, request, callback);
        }
      });
    },

    _onRetrieveEntries: function(request, callback) {
      var self = this;

      var id;
      try {
        id = ID.fromHexString(request.params.id);
      } catch (e) {
        this._sendFailureResponse(e.message, request, callback);
        return;
      }
      this._localNode.retrieveEntriesIterative(id, function(status, entries, node, error) {
        if (error) {
          console.log("Failed to retrieve entries:", error);
          self._sendFailureResponse("Unknown error.", request, callback);
          return;
        }

        if (status === 'SUCCESS') {
          self._sendSuccessResponse({
            entries: _.invoke(entries, 'toJson')
          }, request, callback);
        } else if (status === 'REDIRECT') {
          self._sendRedirectResponse({
            redirectNodeInfo: node.toNodeInfo()
          }, request, callback);
        }
      });
    },

    _onRemoveEntry: function(request, callback) {
      var self = this;

      var entry;
      try {
        entry = Entry.fromJson(request.params.entry);
      } catch (e) {
        this._sendFailureResponse(e.message, request, callback);
        return;
      }
      this._localNode.removeEntryIterative(entry, function(status, node, error) {
        if (error) {
          console.log("Failed to remove entry:", error);
          self._sendFailureResponse("Unknown error.", request, callback);
          return;
        }

        if (status === 'SUCCESS') {
          self._sendSuccessResponse({}, request, callback);
        } else if (status === 'REDIRECT') {
          self._sendRedirectResponse({
            redirectNodeInfo: node.toNodeInfo()
          }, request, callback);
        }
      });
    },

    _onLeavesNetwork: function(request, callback) {
      var self = this;

      var predecessorNodeInfo = request.params.predecessorNodeInfo;
      this._nodeFactory.create(predecessorNodeInfo, function(predecessor, error) {
        if (error) {
          console.log(error);
          return;
        }

        self._localNode.leavesNetwork(predecessor);
      });
    },

    _sendSuccessResponse: function(result, request, callback) {
      this._sendResponse('SUCCESS', result, request, callback);
    },

    _sendRedirectResponse: function(result, request, callback) {
      this._sendResponse('REDIRECT', result, request, callback);
    },

    _sendResponse: function(status, result, request, callback) {
      var self = this;

      var response;
      try {
        response = Response.create(status, result, request);
      } catch (e) {
        this._sendFailureResponse(e.message, request, callback);
        return;
      }

      callback(response);
    },

    _sendFailureResponse: function(message, request, callback) {
      var response;
      try {
        response = Response.create('FAILED', {message: message}, request);
      } catch (e) {
        return;
      }

      callback(response);
    }
  };

  module.exports = RequestHandler;
})();

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./Entry":10,"./ID":14,"./Response":21,"./Utils":24}],21:[function(_dereq_,module,exports){
(function (global){
(function() {
  var _ = (typeof window !== "undefined" ? window._ : typeof global !== "undefined" ? global._ : null);
  var Utils = _dereq_('./Utils');

  var Response = function(version, status, method, result, requestId, timestamp) {
    if (version[0] !== Utils.version[0]) {
      throw new Error("Cannot communicate with version " + version.join('.') +
                      " (your version is " + Utils.version.join('.') +")");
    }

    if (!Utils.isNonemptyString(status) ||
        !Utils.isNonemptyString(method) ||
        !_.isObject(result) || !Utils.isNonemptyString(requestId) ||
        !_.isNumber(timestamp)) {
      throw new Error("Invalid argument.");
    }

    this.version = version;
    this.status = status;
    this.method = method;
    this.result = result;
    this.requestId = requestId;
    this.timestamp = timestamp;
  };

  Response.create = function(status, result, request) {
    return new Response(Utils.version, status, request.method, result, request.requestId, _.now());
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
    return new Response(json.version, json.status, json.method, json.result, json.requestId, json.timestamp);
  };

  Response.prototype = {
    toJson: function() {
      return {
        version: this.version,
        status: this.status,
        method: this.method,
        result: this.result,
        requestId: this.requestId,
        timestamp: this.timestamp
      };
    },
  };

  module.exports = Response;
})();

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./Utils":24}],22:[function(_dereq_,module,exports){
(function (global){
(function() {
  var _ = (typeof window !== "undefined" ? window._ : typeof global !== "undefined" ? global._ : null);
  var Utils = _dereq_('./Utils');

  var StabilizeTask = function(localNode, references, entries) {
    this._localNode = localNode;
    this._references = references;
    this._entries = entries;
    this._timer = null;
  };

  StabilizeTask.create = function(localNode, references, entries, config) {
    if (!Utils.isZeroOrPositiveNumber(config.stabilizeTaskInterval)) {
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
            currentSuccessor.ping(function(error) {
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

              Utils.debug("[StabilizeTask] successors:", _.map(self._references.getSuccessors(), function(s) {
                return s.getPeerId();
              }).toString());
            });
          }
        }

        RemoveUnreferencedSuccessorsAndAddReferences(references);

        Utils.debug("[StabilizeTask] successors:", _.map(self._references.getSuccessors(), function(s) {
          return s.getPeerId();
        }).toString());
      });
    },

    shutdown: function() {
      if (!_.isNull(this._timer)) {
        clearInterval(this._timer);
      }
    }
  };

  module.exports = StabilizeTask;
})();

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./Utils":24}],23:[function(_dereq_,module,exports){
(function (global){
(function() {
  var _ = (typeof window !== "undefined" ? window._ : typeof global !== "undefined" ? global._ : null);
  var Utils = _dereq_('./Utils');

  var SuccessorList = function(localId, entries, references, config) {
    if (!localId || !entries || !references) {
      throw new Error("Invalid argument.");
    }

    if (!Utils.isPositiveNumber(config.numberOfEntriesInSuccessorList)) {
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
      if (!node) {
        throw new Error("Invalid argument.");
      }

      if (this.containsReference(node)) {
        return;
      }

      if (this._successors.length >= this._capacity &&
          node.nodeId.isInInterval(_.last(this._successors).nodeId, this._localId)) {
        return;
      }

      var inserted = false;
      for (var i = 0; i < this._successors.length; i++) {
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
      if (predecessor) {
        fromId = predecessor.nodeId;
      } else {
        var precedingNode = this._references.getClosestPrecedingNode(this._localId);
        if (precedingNode) {
          fromId = precedingNode.nodeId;
        } else {
          fromId = this._localId;
        }
      }
      var toId = this._localId;
      var entriesToReplicate = this._entries.getEntriesInInterval(fromId, toId);
      node.insertReplicas(entriesToReplicate);

      if (this._successors.length > this._capacity) {
        var nodeToDelete = this._successors.pop();

        nodeToDelete.removeReplicas(this._localId, []);

        this._references.disconnectIfUnreferenced(nodeToDelete);
      }
    },

    getDirectSuccessor: function() {
      if (this._successors.length === 0) {
	return null;
      }
      return this._successors[0];
    },

    getClosestPrecedingNode: function(idToLookup) {
      if (!idToLookup) {
        throw new Error("Invalid argument.");
      }

      for (var i = this._successors.length - 1; i >= 0; i--) {
        if (this._successors[i].nodeId.isInInterval(this._localId, idToLookup)) {
          return this._successors[i];
        }
      }
      return null;
    },

    getReferences: function() {
      return _.clone(this._successors);
    },

    removeReference: function(node) {
      var self = this;

      if (!node) {
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
      return this._successors.length;
    },

    getCapacity: function() {
      return this._capacity;
    },

    containsReference: function(node) {
      if (!node) {
        throw new Error("Invalid argument.");
      }

      return _.some(this._successors, function(s) {
        return s.equals(node);
      });
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

  module.exports = SuccessorList;
})();

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./Utils":24}],24:[function(_dereq_,module,exports){
(function (global){
(function() {
  var _ = (typeof window !== "undefined" ? window._ : typeof global !== "undefined" ? global._ : null);

  var Utils = {
    version: [1, 0, 0],

    isNonemptyString: function(value) {
      return _.isString(value) && !_.isEmpty(value);
    },

    isValidNumber: function(number) {
      return !_.isNaN(number) && _.isNumber(number);
    },

    isPositiveNumber: function(number) {
      return Utils.isValidNumber(number) && number > 0;
    },

    isZeroOrPositiveNumber: function(number) {
      return number === 0 || Utils.isPositiveNumber(number);
    },

    insert: function(list, index, item) {
      list.splice(index, 0, item);
    },

    generateRandomId: function(length) {
      var id = "";
      while (id.length < length) {
        id += Math.random().toString(36).substr(2);
      }
      return id.substr(0, length);
    },

    enableDebugLog: function(enabled) {
      Utils.debug = function() {
        if (enabled) {
          var args = Array.prototype.slice.call(arguments);
          var d = new Date()
          var timeStr = [d.getHours(), d.getMinutes(), d.getSeconds()].join(':') + ':';
          args.unshift(timeStr);
          console.log.apply(console, args);
        }
      };
    },

    debug: function() {
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

  module.exports = Utils;
})();

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},[9])
(9)
});