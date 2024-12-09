(function ($) {
  $.FSRTC = function (options) {
    this.options = $.extend(
      {
        useVideo: null,
        useStereo: false,
        userData: null,
        localVideo: null,
        screenShare: false,
        useCamera: "any",
        iceServers: false,
        videoParams: {},
        audioParams: {},
        callbacks: {},
        useStream: null,
      },
      options
    );
    this.audioEnabled = true;
    this.videoEnabled = true;
    this.mediaData = { SDP: null, profile: {}, candidateList: [] };
    this.constraints = { offerToReceiveAudio: this.options.useSpeak === "none" ? false : true, offerToReceiveVideo: this.options.useVideo ? true : false };
    if (self.options.useVideo) {
      self.options.useVideo.style.display = "none";
    }

  };
  $.FSRTC.validRes = [];
  function onStreamError(self, e) {

  }
  function onStreamSuccess(self, stream) {

  }
  function onRemoteStreamSuccess(self, stream) {

  }
  function doCallback(self, func, arg) {
    if (func in self.options.callbacks) {
      self.options.callbacks[func](self, arg);
    }
  }
  function onChannelError(self, e) {

  }
  function onICESDP(self, sdp) {
    //TODO: aca se agrega el SDP al mediaData
    self.mediaData.SDP = sdp.sdp
    console.log("ICE SDP");
    doCallback(self, "onICESDP");
  }
  FSRTCattachMediaStream = function (element, stream) {
    if (typeof element.srcObject !== "undefined") {
      //TODO: aca se agrega el stream al elemento
      element.srcObject = stream;
    } else {
      console.error("Error attaching stream to element.");
    }
  };
  function onRemoteStream(self, stream) {
    if (self.options.useVideo) {
      self.options.useVideo.style.display = "block";
      var iOS = ["iPad", "iPhone", "iPod"].indexOf(navigator.platform) >= 0;
      if (iOS) {
        self.options.useVideo.setAttribute("playsinline", true);
      }
    }
    var element = self.options.useAudio;
    console.log("REMOTE STREAM", stream, element);
    FSRTCattachMediaStream(element, stream);
    var iOS = ["iPad", "iPhone", "iPod"].indexOf(navigator.platform) >= 0;
    if (iOS) {
      self.options.useAudio.setAttribute("playsinline", true);
      self.options.useAudio.setAttribute("controls", true);
    }
    self.remoteStream = stream;
    onRemoteStreamSuccess(self, stream);
  }

  $.FSRTC.prototype.answer = function (sdp, onSuccess, onError) {
    this.peer.addAnswerSDP({ type: "answer", sdp: sdp }, onSuccess, onError);
  };
  $.FSRTC.prototype.stopPeer = function () {

  };
  $.FSRTC.prototype.stop = function () {

  };
  function getMediaParams(obj) {
    var audio;
    if (obj.options.useMic && obj.options.useMic === "none") {
      console.log("Microphone Disabled");
      audio = false;
    } else if (obj.options.videoParams && obj.options.screenShare) {
      console.error("SCREEN SHARE", obj.options.videoParams);
      audio = false;
    } else {
      audio = {};
      if (obj.options.audioParams) {
        audio = obj.options.audioParams;
      }
      if (obj.options.useMic !== "any") {
        audio.deviceId = { exact: obj.options.useMic };
      }
    }
    if (obj.options.useVideo && obj.options.localVideo && !obj.options.useStream) {
      getUserMedia({
        constraints: { audio: false, video: { deviceId: obj.options.useCamera } },
        localVideo: obj.options.localVideo,
        onsuccess: function (e) {
          obj.options.localVideoStream = e;
          console.log("local video ready");
        },
        onerror: function (e) {
          console.error("local video error!");
        },
      });
    }
    var video = {};
    var bestFrameRate = obj.options.videoParams.vertoBestFrameRate;
    var minFrameRate = obj.options.videoParams.minFrameRate || 15;
    delete obj.options.videoParams.vertoBestFrameRate;
    if (obj.options.screenShare) {
      if (!obj.options.useCamera && !!navigator.mozGetUserMedia) {
        var dowin = window.confirm("Do you want to share an application window?  If not you can share an entire screen.");
        video = {
          width: { min: obj.options.videoParams.minWidth, max: obj.options.videoParams.maxWidth },
          height: { min: obj.options.videoParams.minHeight, max: obj.options.videoParams.maxHeight },
          mediaSource: dowin ? "window" : "screen",
        };
      } else {
        var opt = [];
        if (obj.options.useCamera) {
          opt.push({ sourceId: obj.options.useCamera });
        }
        if (bestFrameRate) {
          opt.push({ minFrameRate: bestFrameRate });
          opt.push({ maxFrameRate: bestFrameRate });
        }
        video = { mandatory: obj.options.videoParams, optional: opt };
        if (!!navigator.userAgent.match(/Android/i)) {
          delete video.frameRate.min;
        }
      }
    } else {
      video = { width: { min: obj.options.videoParams.minWidth, max: obj.options.videoParams.maxWidth }, height: { min: obj.options.videoParams.minHeight, max: obj.options.videoParams.maxHeight } };
      var useVideo = obj.options.useVideo;
      if (useVideo && obj.options.useCamera && obj.options.useCamera !== "none") {
        if (obj.options.useCamera !== "any") {
          video.deviceId = { exact: obj.options.useCamera };
        }
        if (bestFrameRate) {
          video.frameRate = { ideal: bestFrameRate, min: minFrameRate, max: 30 };
        }
      } else {
        console.log("Camera Disabled");
        video = false;
        useVideo = false;
      }
    }
    return { audio: audio, video: false, useVideo: false };
  }
  $.FSRTC.prototype.call = function (profile) {

    var self = this;
    var screen = false;
    self.type = "offer";
    if (self.options.videoParams && self.options.screenShare) {
      screen = true;
    }

    function onSuccess(stream) {
      self.localStream = stream;
      if (screen) {
        self.constraints.offerToReceiveVideo = false;
        self.constraints.offerToReceiveAudio = false;
        self.constraints.offerToSendAudio = false;
      }
      self.peer = FSRTCPeerConnection({
        type: self.type,
        attachStream: self.localStream,
        //TODO: aca se agrega el stream al elemento
        onRemoteStream: (stream) => onRemoteStream(self, stream),
        onICESDP: function (sdp) {
          return onICESDP(self, sdp);
        },
        onChannelError: function (e) {
          return onChannelError(self, e);
        },
        constraints: self.constraints,
        iceServers: self.options.iceServers,
        turnServer: self.options.turnServer,
      });
      onStreamSuccess(self, stream);
    }
    function onError(e) {
      onStreamError(self, e);
    }
    var mediaParams = getMediaParams(self);
    console.log("Audio constraints", mediaParams.audio);
    console.log("Video constraints", mediaParams.video);
    if (self.options.useStream) {
      if (self.options.useVideo) {
        self.options.localVideoStream = self.options.useStream;

      }
      onSuccess(self.options.useStream);
    } else if (mediaParams.audio || mediaParams.video) {
      getUserMedia({ constraints: { audio: mediaParams.audio, video: mediaParams.video }, video: mediaParams.useVideo, onsuccess: onSuccess, onerror: onError });
    } else {
      onSuccess(null);
    }
  };
  function FSRTCPeerConnection(options) {
    var gathering = false,
      done = false;
    var config = {};
    var default_ice = [{ urls: [""] }];
    if (self.options.turnServer) {
      default_ice.push(self.options.turnServer);
    }
    if (options.iceServers) {
      if (typeof options.iceServers === "boolean") {
        config.iceServers = default_ice;
      } else {
        config.iceServers = options.iceServers;
      }
    }
    config.bundlePolicy = "max-compat";
    var peer = new window.RTCPeerConnection(config);

    var x = 0;
    function ice_handler() {
      done = true;
      gathering = null;

      if (options.type == "offer") {
        options.onICESDP(peer.localDescription);
      } else {
        if (!x && options.onICESDP) {
          options.onICESDP(peer.localDescription);
        }
      }
    }
    peer.onicecandidate = function (event) {
      console.log("onicecandidate", event.candidate);
      if (done) {
        return;
      }
      if (!gathering) {
        gathering = setTimeout(ice_handler, 1000);
      }
      if (event) {
      } else {
        done = true;
        if (gathering) {
          clearTimeout(gathering);
          gathering = null;
        }
        ice_handler();
      }
    };
    if (options.attachStream) peer.addStream(options.attachStream);
    if (options.attachStreams && options.attachStream.length) {
      var streams = options.attachStreams;
      for (var i = 0; i < streams.length; i++) {
        peer.addStream(streams[i]);
      }
    }
    peer.onaddstream = function (event) {
      var remoteMediaStream = event.stream;
      remoteMediaStream.oninactive = function () {
        if (options.onRemoteStreamEnded) options.onRemoteStreamEnded(remoteMediaStream);
      };
      if (options.onRemoteStream) options.onRemoteStream(remoteMediaStream);
    };

    if (options.onChannelMessage || !options.onChannelMessage) {
      const offer = peer.createOffer();
      peer.setLocalDescription(offer);
    }
    var channel;

    return {
      addAnswerSDP: function (sdp, cbSuccess, cbError) {
        const answer = new window.RTCSessionDescription(sdp)
        peer.setRemoteDescription(answer)
      },
      peer: peer,
      channel: channel,
      stop: function () {
        peer.close();
        if (options.attachStream) {
          if (typeof options.attachStream.stop == "function") {
            options.attachStream.stop();
          } else {
            options.attachStream.active = false;
          }
        }
      },
    };
  }
  var video_constraints = {};
  function getUserMedia(options) {
    var n = navigator,
      media;
    n.getMedia = n.getUserMedia;
    n.getMedia(
      options.constraints || { audio: true, video: video_constraints },
      streaming,
      options.onerror ||
      function (e) {
        console.error(e);
      }
    );
    function streaming(stream) {

      if (options.onsuccess) {
        options.onsuccess(stream);
      }
      media = stream;
    }
    return media;
  }
  $.FSRTC.bestResSupported = function () {
    var w = 0,
      h = 0;
    for (var i in $.FSRTC.validRes) {
      if ($.FSRTC.validRes[i][0] >= w && $.FSRTC.validRes[i][1] >= h) {
        w = $.FSRTC.validRes[i][0];
        h = $.FSRTC.validRes[i][1];
      }
    }
    return [w, h];
  };
  var resList = [
    [160, 120],
    [320, 180],
    [320, 240],
    [640, 360],
    [640, 480],
    [1280, 720],
    [1920, 1080],
  ];
  var resI = 0;
  var ttl = 0;
  var checkRes = function (cam, func) {
    if (resI >= resList.length) {
      var res = { validRes: $.FSRTC.validRes, bestResSupported: $.FSRTC.bestResSupported() };
      localStorage.setItem("res_" + cam, $.toJSON(res));
      if (func) return func(res);
      return;
    }
    w = resList[resI][0];
    h = resList[resI][1];
    resI++;
    var video = { width: { exact: w }, height: { exact: h } };
    if (cam !== "any") {
      video.deviceId = { exact: cam };
    }
    getUserMedia({
      constraints: { audio: ttl++ == 0, video: video },
      onsuccess: function (e) {
        e.getTracks().forEach(function (track) {
          track.stop();
        });
        console.info(w + "x" + h + " supported.");
        $.FSRTC.validRes.push([w, h]);
        checkRes(cam, func);
      },
      onerror: function (e) {
        console.warn(w + "x" + h + " not supported.");
        checkRes(cam, func);
      },
    });
  };
  $.FSRTC.getValidRes = function (cam, func) {
    var used = [];
    var cached = localStorage.getItem("res_" + cam);
    if (cached) {
      var cache = $.parseJSON(cached);
      if (cache) {
        $.FSRTC.validRes = cache.validRes;
        console.log("CACHED RES FOR CAM " + cam, cache);
      } else {
        console.error("INVALID CACHE");
      }
      return func ? func(cache) : null;
    }
    $.FSRTC.validRes = [];
    resI = 0;
    checkRes(cam, func);
  };
  $.FSRTC.checkPerms = function (runtime, check_audio, check_video) {
    getUserMedia({
      constraints: { audio: check_audio, video: check_video },
      onsuccess: function (e) {
        e.getTracks().forEach(function (track) {
          track.stop();
        });
        console.info("media perm init complete");
        if (runtime) {
          setTimeout(runtime, 100, true);
        }
      },
      onerror: function (e) {
        if (check_video && check_audio) {
          console.error("error, retesting with audio params only");
          return $.FSRTC.checkPerms(runtime, check_audio, false);
        }
        console.error("media perm init error");
        if (runtime) {
          runtime(false);
        }
      },
    });
  };
})(jQuery);
(function ($) {
  $.JsonRpcClient = function (options) {
    var self = this;
    this.options = $.extend(
      {
        ajaxUrl: null,
        socketUrl: null,
        onmessage: null,
        login: null,
        passwd: null,
        sessid: null,
        loginParams: null,
        userVariables: null,
        getSocket: function (onmessage_cb) {
          return self._getSocket(onmessage_cb);
        },
      },
      options
    );
    self.ws_cnt = 0;
    this.wsOnMessage = function (event) {
      self._wsOnMessage(event);
    };
  };
  $.JsonRpcClient.prototype._ws_socket = null;
  $.JsonRpcClient.prototype._ws_callbacks = {};
  $.JsonRpcClient.prototype._current_id = 1;

  $.JsonRpcClient.prototype.call = function (method, params, success_cb, error_cb) {
    if (!params) {
      params = {};
    }
    if (this.options.sessid) {
      params.sessid = this.options.sessid;
    }
    var request = { jsonrpc: "2.0", method: method, params: params, id: this._current_id++ };
    if (!success_cb) {
      success_cb = function (e) {
        console.log("Success: ", e);
      };
    }
    if (!error_cb) {
      error_cb = function (e) {
        console.log("Error: ", e);
      };
    }
    var socket = this.options.getSocket(this.wsOnMessage);
    if (socket !== null) {
      this._wsCall(socket, request, success_cb, error_cb);
      return;
    }
    if (this.options.ajaxUrl === null) {
      throw "$.JsonRpcClient.call used with no websocket and no http endpoint.";
    }

  };
  $.JsonRpcClient.prototype.socketReady = function () {
    if (this._ws_socket === null || this._ws_socket.readyState > 1) {
      return false;
    }
    return true;
  };
  $.JsonRpcClient.prototype.closeSocket = function () {
    var self = this;
    if (self.socketReady()) {
      self._ws_socket.onclose = function (w) {
        console.log("Closing Socket");
      };
      self._ws_socket.close();
    }
  };
  $.JsonRpcClient.prototype.loginData = function (params) {
    var self = this;
    self.options.login = params.login;
    self.options.passwd = params.passwd;
    self.options.loginParams = params.loginParams;
    self.options.userVariables = params.userVariables;
  };
  $.JsonRpcClient.prototype.connectSocket = function (onmessage_cb) {
    var self = this;
    if (self.to) {
      clearTimeout(self.to);
    }
    if (!self.socketReady()) {
      self.authing = false;
      if (self._ws_socket) {
        delete self._ws_socket;
      }
      self._ws_socket = new WebSocket(self.options.socketUrl);
      if (self._ws_socket) {
        self._ws_socket.onmessage = onmessage_cb;
        self._ws_socket.onclose = function (w) {
          if (!self.ws_sleep) {
            self.ws_sleep = 1000;
          }
          if (self.options.onWSClose) {
            self.options.onWSClose(self);
          }
          if (self.ws_cnt > 10 && self.options.wsFallbackURL) {
            self.options.socketUrl = self.options.wsFallbackURL;
          }
          console.error("Websocket Lost " + self.ws_cnt + " sleep: " + self.ws_sleep + "msec");
          self.to = setTimeout(function () {
            console.log("Attempting Reconnection....");
            self.connectSocket(onmessage_cb);
          }, self.ws_sleep);
          self.ws_cnt++;
          if (self.ws_sleep < 3000 && self.ws_cnt % 10 === 0) {
            self.ws_sleep += 1000;
          }
        };
        self._ws_socket.onopen = function () {
          if (self.to) {
            clearTimeout(self.to);
          }
          self.ws_sleep = 1000;
          self.ws_cnt = 0;
          if (self.options.onWSConnect) {
            self.options.onWSConnect(self);
          }
          var req;
          while ((req = $.JsonRpcClient.q.pop())) {
            self._ws_socket.send(req);
          }
        };
      }
    }
    return self._ws_socket ? true : false;
  };

  $.JsonRpcClient.prototype._getSocket = function (onmessage_cb) {
    if (this.options.socketUrl === null || !("WebSocket" in window)) return null;
    this.connectSocket(onmessage_cb);
    return this._ws_socket;
  };
  $.JsonRpcClient.q = [];
  $.JsonRpcClient.prototype._wsCall = function (socket, request, success_cb, error_cb) {
    var request_json = $.toJSON(request);
    if (socket.readyState < 1) {
      self = this;
      $.JsonRpcClient.q.push(request_json);
    } else {
      socket.send(request_json);
    }
    if ("id" in request && typeof success_cb !== "undefined") {
      this._ws_callbacks[request.id] = { request: request_json, request_obj: request, success_cb: success_cb, error_cb: error_cb };
    }
  };
  $.JsonRpcClient.prototype._wsOnMessage = function (event) {
    var response;
    if (event.data[0] == "#" && event.data[1] == "S" && event.data[2] == "P") {
      if (event.data[3] == "U") {
        this.up_dur = parseInt(event.data.substring(4));
      } else if (this.speedCB && event.data[3] == "D") {
        this.down_dur = parseInt(event.data.substring(4));
        var up_kps = ((this.speedBytes * 8) / (this.up_dur / 1000) / 1024).toFixed(0);
        var down_kps = ((this.speedBytes * 8) / (this.down_dur / 1000) / 1024).toFixed(0);
        console.info("Speed Test: Up: " + up_kps + " Down: " + down_kps);
        var cb = this.speedCB;
        this.speedCB = null;
        cb(event, { upDur: this.up_dur, downDur: this.down_dur, upKPS: up_kps, downKPS: down_kps });
      }
      return;
    }
    try {
      response = $.parseJSON(event.data);
      if (typeof response === "object" && "jsonrpc" in response && response.jsonrpc === "2.0") {
        if ("result" in response && this._ws_callbacks[response.id]) {
          var success_cb = this._ws_callbacks[response.id].success_cb;
          delete this._ws_callbacks[response.id];
          success_cb(response.result, this);
          return;
        } else if ("error" in response && this._ws_callbacks[response.id]) {
          var error_cb = this._ws_callbacks[response.id].error_cb;
          var orig_req = this._ws_callbacks[response.id].request;
          if (!self.authing && response.error.code == -32000 && self.options.login && self.options.passwd) {
            self.authing = true;
            this.call(
              "login",
              { login: self.options.login, passwd: self.options.passwd, loginParams: self.options.loginParams, userVariables: self.options.userVariables },
              this._ws_callbacks[response.id].request_obj.method == "login"
                ? function (e) {
                  self.authing = false;
                  console.log("logged in");
                  delete self._ws_callbacks[response.id];
                  if (self.options.onWSLogin) {
                    self.options.onWSLogin(true, self);
                  }
                }
                : function (e) {
                  self.authing = false;
                  console.log("logged in, resending request id: " + response.id);
                  var socket = self.options.getSocket(self.wsOnMessage);
                  if (socket !== null) {
                    socket.send(orig_req);
                  }
                  if (self.options.onWSLogin) {
                    self.options.onWSLogin(true, self);
                  }
                },
              function (e) {
                console.log("error logging in, request id:", response.id);
                delete self._ws_callbacks[response.id];
                error_cb(response.error, this);
                if (self.options.onWSLogin) {
                  self.options.onWSLogin(false, self);
                }
              }
            );
            return;
          }
          delete this._ws_callbacks[response.id];
          error_cb(response.error, this);
          return;
        }
      }
    } catch (err) {
      console.log("ERROR: " + err);
      return;
    }
    if (typeof this.options.onmessage === "function") {
      event.eventData = response;
      if (!event.eventData) {
        event.eventData = {};
      }
      var reply = this.options.onmessage(event);
      if (reply && typeof reply === "object" && event.eventData.id) {
        var msg = { jsonrpc: "2.0", id: event.eventData.id, result: reply };
        var socket = self.options.getSocket(self.wsOnMessage);
        if (socket !== null) {
          socket.send($.toJSON(msg));
        }
      }
    }
  };
  $.JsonRpcClient._batchObject = function (jsonrpcclient, all_done_cb, error_cb) {
    this._requests = [];
    this.jsonrpcclient = jsonrpcclient;
    this.all_done_cb = all_done_cb;
    this.error_cb = typeof error_cb === "function" ? error_cb : function () { };
  };
  $.JsonRpcClient._batchObject.prototype.call = function (method, params, success_cb, error_cb) {
    if (!params) {
      params = {};
    }
    if (this.options.sessid) {
      params.sessid = this.options.sessid;
    }
    if (!success_cb) {
      success_cb = function (e) {
        console.log("Success: ", e);
      };
    }
    if (!error_cb) {
      error_cb = function (e) {
        console.log("Error: ", e);
      };
    }
    this._requests.push({ request: { jsonrpc: "2.0", method: method, params: params, id: this.jsonrpcclient._current_id++ }, success_cb: success_cb, error_cb: error_cb });
  };



})(jQuery);
(function ($) {
  var generateGUID =
    typeof window.crypto !== "undefined" && typeof window.crypto.getRandomValues !== "undefined"
      ? function () {
        var buf = new Uint16Array(8);
        window.crypto.getRandomValues(buf);
        var S4 = function (num) {
          var ret = num.toString(16);
          while (ret.length < 4) {
            ret = "0" + ret;
          }
          return ret;
        };
        return S4(buf[0]) + S4(buf[1]) + "-" + S4(buf[2]) + "-" + S4(buf[3]) + "-" + S4(buf[4]) + "-" + S4(buf[5]) + S4(buf[6]) + S4(buf[7]);
      }
      : function () {
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
          var r = (Math.random() * 16) | 0,
            v = c == "x" ? r : (r & 0x3) | 0x8;
          return v.toString(16);
        });
      };
  $.verto = function (options, callbacks) {
    var verto = this;
    $.verto.saved.push(verto);
    verto.options = $.extend(
      {
        login: null,
        passwd: null,
        socketUrl: null,
        tag: null,
        localTag: null,
        videoParams: {},
        audioParams: {},
        loginParams: {},
        deviceParams: { onResCheck: null },
        userVariables: {},
        iceServers: false,
        ringSleep: 6000,
        sessid: null,
        useStream: null,
      },
      options
    );
    if (verto.options.deviceParams.useCamera) {
      $.FSRTC.getValidRes(verto.options.deviceParams.useCamera, verto.options.deviceParams.onResCheck);
    }
    if (!verto.options.deviceParams.useMic) {
      verto.options.deviceParams.useMic = "any";
    }
    if (!verto.options.deviceParams.useSpeak) {
      verto.options.deviceParams.useSpeak = "any";
    }
    if (verto.options.sessid) {
      verto.sessid = verto.options.sessid;
    } else {
      verto.sessid = localStorage.getItem("verto_session_uuid") || generateGUID();
      localStorage.setItem("verto_session_uuid", verto.sessid);
    }
    verto.dialogs = {};
    verto.callbacks = callbacks || {};
    verto.eventSUBS = {};
    verto.rpcClient = new $.JsonRpcClient({
      login: verto.options.login,
      passwd: verto.options.passwd,
      socketUrl: verto.options.socketUrl,
      wsFallbackURL: verto.options.wsFallbackURL,
      turnServer: verto.options.turnServer,
      loginParams: verto.options.loginParams,
      userVariables: verto.options.userVariables,
      sessid: verto.sessid,
      onmessage: function (e) {
        return verto.handleMessage(e.eventData);
      },
      onWSConnect: function (o) {
        o.call("login", {});
      },
      onWSLogin: function (success) {
        if (verto.callbacks.onWSLogin) {
          verto.callbacks.onWSLogin(verto, success);
        }
      },
      onWSClose: function (success) {
        if (verto.callbacks.onWSClose) {
          verto.callbacks.onWSClose(verto, success);
        }
        verto.purge();
      },
    });
    var tag = verto.options.tag;
    if (typeof tag === "function") {
      tag = tag();
    }
    if (verto.options.ringFile && verto.options.tag) {
      verto.ringer = $("#" + tag);
    }
    verto.rpcClient.call("login", {});
  };
  $.verto.prototype.loginData = function (params) {
    var verto = this;
    verto.options.login = params.login;
    verto.options.passwd = params.passwd;
    verto.rpcClient.loginData(params);
  };
  $.verto.prototype.logout = function (msg) {
    var verto = this;
    verto.rpcClient.closeSocket();
    if (verto.callbacks.onWSClose) {
      verto.callbacks.onWSClose(verto, false);
    }
    verto.purge();
  };
  $.verto.prototype.login = function (msg) {
    var verto = this;
    verto.logout();
    verto.rpcClient.call("login", {});
  };
  $.verto.prototype.message = function (msg) {
    var verto = this;
    var err = 0;
    if (!msg.to) {
      console.error("Missing To");
      err++;
    }
    if (!msg.body) {
      console.error("Missing Body");
      err++;
    }
    if (err) {
      return false;
    }
    verto.sendMethod("verto.info", { msg: msg });
    return true;
  };
  $.verto.prototype.processReply = function (method, success, e) {
    var verto = this;
    var i;

  };
  $.verto.prototype.sendMethod = function (method, params) {
    var verto = this;
    verto.rpcClient.call(
      method,
      params,
      function (e) {
        verto.processReply(method, true, e);
      },
      function (e) {
        verto.processReply(method, false, e);
      }
    );
  };

  $.verto.prototype.broadcast = function (channel, params) {
    var verto = this;
    var msg = { eventChannel: channel, data: {} };
    for (var i in params) {
      msg.data[i] = params[i];
    }
    verto.sendMethod("verto.broadcast", msg);
  };
  $.verto.prototype.purge = function (callID) {
    var verto = this;
    var x = 0;
    var i;
    for (i in verto.dialogs) {
      if (!x) {
        console.log("purging dialogs");
      }
      x++;
      verto.dialogs[i].setState($.verto.enum.state.purge);
    }
    for (i in verto.eventSUBS) {
      if (verto.eventSUBS[i]) {
        console.log("purging subscription: " + i);
        delete verto.eventSUBS[i];
      }
    }
  };
  $.verto.prototype.hangup = function (callID) {
    var verto = this;
    if (callID) {
      var dialog = verto.dialogs[callID];
      if (dialog) {
        dialog.hangup();
      }
    } else {
      for (var i in verto.dialogs) {
        verto.dialogs[i].hangup();
      }
    }
  };
  $.verto.prototype.newCall = function (args, callbacks) {
    var verto = this;
    if (!verto.rpcClient.socketReady()) {
      console.error("Not Connected...");
      return;
    }
    if (args["useCamera"]) {
      verto.options.deviceParams["useCamera"] = args["useCamera"];
    }
    var dialog = new $.verto.dialog($.verto.enum.direction.outbound, this, args);
    if (callbacks) {
      dialog.callbacks = callbacks;
    }
    dialog.invite();
    return dialog;
  };
  $.verto.prototype.handleMessage = function (data) {
    var verto = this;
    if (!(data && data.method)) {
      console.error("Invalid Data", data);
      return;
    }
    if (data.params.callID) {
      var dialog = verto.dialogs[data.params.callID];
      if (data.method === "verto.attach" && dialog) {
        delete dialog.verto.dialogs[dialog.callID];
        dialog.rtc.stop();
        dialog = null;
      }
      if (dialog) {
        switch (data.method) {
          case "verto.bye":
            dialog.hangup(data.params);
            break;

          case "verto.media":
            dialog.handleMedia(data.params);
            break;


          default:
            console.debug("INVALID METHOD OR NON-EXISTANT CALL REFERENCE IGNORED", dialog, data.method);
            break;
        }
      } else {
        switch (data.method) {
          case "verto.attach":
            data.params.attach = true;
            if (data.params.sdp && data.params.sdp.indexOf("m=video") > 0) {
              data.params.useVideo = true;
            }
            if (data.params.sdp && data.params.sdp.indexOf("stereo=1") > 0) {
              data.params.useStereo = true;
            }
            dialog = new $.verto.dialog($.verto.enum.direction.inbound, verto, data.params);
            dialog.setState($.verto.enum.state.recovering);
            break;
          case "verto.invite":
            if (data.params.sdp && data.params.sdp.indexOf("m=video") > 0) {
              data.params.wantVideo = true;
            }
            if (data.params.sdp && data.params.sdp.indexOf("stereo=1") > 0) {
              data.params.useStereo = true;
            }
            dialog = new $.verto.dialog($.verto.enum.direction.inbound, verto, data.params);
            break;
          default:
            console.debug("INVALID METHOD OR NON-EXISTANT CALL REFERENCE IGNORED");
            break;
        }
      }
      return { method: data.method };
    } else {
      switch (data.method) {
        case "verto.punt":
          verto.purge();
          verto.logout();
          break;
        case "verto.event":
          var list = null;
          var key = null;
          if (data.params) {
            key = data.params.eventChannel;
          }
          if (key) {
            list = verto.eventSUBS[key];
            if (!list) {
              list = verto.eventSUBS[key.split(".")[0]];
            }
          }
          if (!list && key && key === verto.sessid) {
            if (verto.callbacks.onMessage) {
              verto.callbacks.onMessage(verto, null, $.verto.enum.message.pvtEvent, data.params);
            }
          } else if (!list) {
            if (!key) {
              key = "UNDEFINED";
            }
            console.error("UNSUBBED or invalid EVENT " + key + " IGNORED");
          } else {
            for (var i in list) {
              var sub = list[i];
              if (!sub || !sub.ready) {
                console.error("invalid EVENT for " + key + " IGNORED");
              } else if (sub.handler) {
                sub.handler(verto, data.params, sub.userData);
              } else if (verto.callbacks.onEvent) {
                verto.callbacks.onEvent(verto, data.params, sub.userData);
              } else {
                console.log("EVENT:", data.params);
              }
            }
          }
          break;
        case "verto.info":
          if (verto.callbacks.onMessage) {
            verto.callbacks.onMessage(verto, null, $.verto.enum.message.info, data.params.msg);
          }
          console.debug("MESSAGE from: " + data.params.msg.from, data.params.msg.body);
          break;
        case "verto.clientReady":
          if (verto.callbacks.onMessage) {
            verto.callbacks.onMessage(verto, null, $.verto.enum.message.clientReady, data.params);
          }
          console.debug("CLIENT READY", data.params);
          break;
        default:
          console.error("INVALID METHOD OR NON-EXISTANT CALL REFERENCE IGNORED", data.method);
          break;
      }
    }
  };
  var CONFMAN_SERNO = 1;
  $.verto.conf = function (verto, params) {
    var conf = this;
    conf.params = $.extend({ dialog: null, hasVid: false, laData: null, onBroadcast: null, onLaChange: null, onLaRow: null }, params);
    conf.verto = verto;
    conf.serno = CONFMAN_SERNO++;
    createMainModeratorMethods();


  };
  $.verto.conf.prototype.modCommand = function (cmd, id, value) {
    var conf = this;
    conf.verto.rpcClient.call("verto.broadcast", { eventChannel: conf.params.laData.modChannel, data: { application: "conf-control", command: cmd, id: id, value: value } });
  };
  $.verto.conf.prototype.destroy = function () {
    var conf = this;
    conf.destroyed = true;
    conf.params.onBroadcast(conf.verto, conf, "destroy");
    if (conf.params.laData.modChannel) {
    }
    if (conf.params.laData.chatChannel) {
    }
    if (conf.params.laData.infoChannel) {
    }
  };
  function createMainModeratorMethods() {
    $.verto.conf.prototype.listVideoLayouts = function () {
      this.modCommand("list-videoLayouts", null, null);
    };
    $.verto.conf.prototype.play = function (file) {
      this.modCommand("play", null, file);
    };
    $.verto.conf.prototype.stop = function () {
      this.modCommand("stop", null, "all");
    };
    $.verto.conf.prototype.deaf = function (memberID) {
      this.modCommand("deaf", parseInt(memberID));
    };
    $.verto.conf.prototype.undeaf = function (memberID) {
      this.modCommand("undeaf", parseInt(memberID));
    };
    $.verto.conf.prototype.record = function (file) {
      this.modCommand("recording", null, ["start", file]);
    };
    $.verto.conf.prototype.stopRecord = function () {
      this.modCommand("recording", null, ["stop", "all"]);
    };
    $.verto.conf.prototype.snapshot = function (file) {
      if (!this.params.hasVid) {
        throw "Conference has no video";
      }
      this.modCommand("vid-write-png", null, file);
    };
    $.verto.conf.prototype.setVideoLayout = function (layout, canvasID) {
      if (!this.params.hasVid) {
        throw "Conference has no video";
      }
      if (canvasID) {
        this.modCommand("vid-layout", null, [layout, canvasID]);
      } else {
        this.modCommand("vid-layout", null, layout);
      }
    };
    $.verto.conf.prototype.kick = function (memberID) {
      this.modCommand("kick", parseInt(memberID));
    };
    $.verto.conf.prototype.muteMic = function (memberID) {
      this.modCommand("tmute", parseInt(memberID));
    };
    $.verto.conf.prototype.muteVideo = function (memberID) {
      if (!this.params.hasVid) {
        throw "Conference has no video";
      }
      this.modCommand("tvmute", parseInt(memberID));
    };
    $.verto.conf.prototype.presenter = function (memberID) {
      if (!this.params.hasVid) {
        throw "Conference has no video";
      }
      this.modCommand("vid-res-id", parseInt(memberID), "presenter");
    };
    $.verto.conf.prototype.videoFloor = function (memberID) {
      if (!this.params.hasVid) {
        throw "Conference has no video";
      }
      this.modCommand("vid-floor", parseInt(memberID), "force");
    };
    $.verto.conf.prototype.banner = function (memberID, text) {
      if (!this.params.hasVid) {
        throw "Conference has no video";
      }
      this.modCommand("vid-banner", parseInt(memberID), escape(text));
    };
    $.verto.conf.prototype.volumeDown = function (memberID) {
      this.modCommand("volume_out", parseInt(memberID), "down");
    };
    $.verto.conf.prototype.volumeUp = function (memberID) {
      this.modCommand("volume_out", parseInt(memberID), "up");
    };
    $.verto.conf.prototype.gainDown = function (memberID) {
      this.modCommand("volume_in", parseInt(memberID), "down");
    };
    $.verto.conf.prototype.gainUp = function (memberID) {
      this.modCommand("volume_in", parseInt(memberID), "up");
    };
    $.verto.conf.prototype.transfer = function (memberID, exten) {
      this.modCommand("transfer", parseInt(memberID), exten);
    };
    $.verto.conf.prototype.sendChat = function (message, type) {
      var conf = this;
      conf.verto.rpcClient.call("verto.broadcast", { eventChannel: conf.params.laData.chatChannel, data: { action: "send", message: message, type: type } });
    };
  }
  $.verto.modfuncs = {};
  $.verto.confMan = function (verto, params) { };
  $.verto.confMan.prototype.modCommand = function (cmd, id, value) {
  };
  $.verto.confMan.prototype.sendChat = function (message, type) {
  };
  $.verto.confMan.prototype.destroy = function () {
    var confMan = this;
    confMan.destroyed = true;
    if (confMan.lt) {
      confMan.lt.destroy();
    }
    if (confMan.params.laData.chatChannel) {
    }
    if (confMan.params.laData.modChannel) {
    }
    if (confMan.params.mainModID) {
      $(confMan.params.mainModID).html("");
    }
  };
  $.verto.dialog = function (direction, verto, params) {
    var dialog = this;
    dialog.params = $.extend(
      {
        useVideo: verto.options.useVideo,
        useStereo: verto.options.useStereo,
        screenShare: false,
        useCamera: false,
        useMic: verto.options.deviceParams.useMic,
        useSpeak: verto.options.deviceParams.useSpeak,
        tag: verto.options.tag,
        localTag: verto.options.localTag,
        login: verto.options.login,
        videoParams: verto.options.videoParams,
        useStream: verto.options.useStream,
      },
      params
    );
    if (!dialog.params.screenShare) {
      dialog.params.useCamera = verto.options.deviceParams.useCamera;
    }
    dialog.verto = verto;
    dialog.direction = direction;
    dialog.lastState = null;
    dialog.state = dialog.lastState = $.verto.enum.state.new;
    dialog.callbacks = verto.callbacks;
    dialog.answered = false;
    dialog.attach = params.attach || false;
    dialog.screenShare = params.screenShare || false;
    dialog.useCamera = dialog.params.useCamera;
    dialog.useMic = dialog.params.useMic;
    dialog.useSpeak = dialog.params.useSpeak;
    if (dialog.params.callID) {
      dialog.callID = dialog.params.callID;
    } else {
      dialog.callID = dialog.params.callID = generateGUID();
    }
    if (typeof dialog.params.tag === "function") {
      dialog.params.tag = dialog.params.tag();
    }
    if (dialog.params.tag) {
      console.log("dialog.params.tag", dialog.params.tag);
      dialog.audioStream = document.getElementById(dialog.params.tag);
    }
    if (dialog.params.localTag) {
      dialog.localVideo = document.getElementById(dialog.params.localTag);
    }
    dialog.verto.dialogs[dialog.callID] = dialog;
    var RTCcallbacks = {};
    if (dialog.direction == $.verto.enum.direction.inbound) {
      if (dialog.params.display_direction === "outbound") {
        dialog.params.remote_caller_id_name = dialog.params.caller_id_name;
        dialog.params.remote_caller_id_number = dialog.params.caller_id_number;
      } else {
        dialog.params.remote_caller_id_name = dialog.params.callee_id_name;
        dialog.params.remote_caller_id_number = dialog.params.callee_id_number;
      }
      if (!dialog.params.remote_caller_id_name) {
        dialog.params.remote_caller_id_name = "Nobody";
      }
      if (!dialog.params.remote_caller_id_number) {
        dialog.params.remote_caller_id_number = "UNKNOWN";
      }
      RTCcallbacks.onMessage = function (rtc, msg) {
        console.debug(msg);
      };
      RTCcallbacks.onAnswerSDP = function (rtc, sdp) {
        console.error("answer sdp", sdp);
      };
    } else {
      dialog.params.remote_caller_id_name = "Outbound Call";
      dialog.params.remote_caller_id_number = dialog.params.destination_number;
    }
    RTCcallbacks.onICESDP = function (rtc) {
      console.log("RECV " + rtc.type + " SDP", rtc.mediaData.SDP);
      if (dialog.state == $.verto.enum.state.requesting || dialog.state == $.verto.enum.state.answering || dialog.state == $.verto.enum.state.active) {
        location.reload();
        return;
      }
      if (rtc.type == "offer") {
        if (dialog.state == $.verto.enum.state.active) {
          dialog.setState($.verto.enum.state.requesting);
          dialog.sendMethod("verto.attach", { sdp: rtc.mediaData.SDP });
        } else {
          dialog.setState($.verto.enum.state.requesting);
          dialog.sendMethod("verto.invite", { sdp: rtc.mediaData.SDP });
        }
      }
    };

    RTCcallbacks.onStream = function (rtc, stream) {
      if (dialog.callbacks.permissionCallback && typeof dialog.callbacks.permissionCallback.onGranted === "function") {
        dialog.callbacks.permissionCallback.onGranted(stream);
      } else if (dialog.verto.options.permissionCallback && typeof dialog.verto.options.permissionCallback.onGranted === "function") {
        dialog.verto.options.permissionCallback.onGranted(stream);
      }
      console.log("stream started");
    };
    RTCcallbacks.onRemoteStream = function (rtc, stream) {
      if (typeof dialog.callbacks.onRemoteStream === "function") {
        dialog.callbacks.onRemoteStream(stream, dialog);
      }
      console.log("remote stream started");
    };
    RTCcallbacks.onError = function (e) {
      if (dialog.callbacks.permissionCallback && typeof dialog.callbacks.permissionCallback.onDenied === "function") {
        dialog.callbacks.permissionCallback.onDenied();
      } else if (dialog.verto.options.permissionCallback && typeof dialog.verto.options.permissionCallback.onDenied === "function") {
        dialog.verto.options.permissionCallback.onDenied();
      }
      console.error("ERROR:", e);
      dialog.hangup({ cause: "Device or Permission Error" });
    };
    dialog.rtc = new $.FSRTC({
      callbacks: RTCcallbacks,
      localVideo: dialog.screenShare ? null : dialog.localVideo,
      useVideo: dialog.params.useVideo ? dialog.videoStream : null,
      useAudio: dialog.audioStream,
      useStereo: dialog.params.useStereo,
      videoParams: dialog.params.videoParams,
      audioParams: verto.options.audioParams,
      iceServers: verto.options.iceServers,
      screenShare: dialog.screenShare,
      useCamera: dialog.useCamera,
      useMic: dialog.useMic,
      useSpeak: dialog.useSpeak,
      turnServer: verto.options.turnServer,
      useStream: dialog.params.useStream,
    });
    dialog.rtc.verto = dialog.verto;
    if (dialog.direction == $.verto.enum.direction.inbound) {
      if (dialog.attach) {
        dialog.answer();
      } else {
        dialog.ring();
      }
    }
  };
  $.verto.dialog.prototype.invite = function () {
    var dialog = this;
    dialog.rtc.call();
  };
  $.verto.dialog.prototype.sendMethod = function (method, obj) {
    var dialog = this;
    obj.dialogParams = {};
    for (var i in dialog.params) {
      if (i == "sdp" && method != "verto.invite" && method != "verto.attach") {
        continue;
      }
      if (obj.noDialogParams && i != "callID") {
        continue;
      }
      obj.dialogParams[i] = dialog.params[i];
    }
    delete obj.noDialogParams;
    dialog.verto.rpcClient.call(
      method,
      obj,
      function (e) {
        dialog.processReply(method, true, e);
      },
      function (e) {
        dialog.processReply(method, false, e);
      }
    );
  };
  function checkStateChange(oldS, newS) {
    if (newS == $.verto.enum.state.purge || $.verto.enum.states[oldS.name][newS.name]) {
      return true;
    }
    return false;
  }
  function find_name(id) {
    for (var i in $.verto.audioOutDevices) {
      var source = $.verto.audioOutDevices[i];
      if (source.id === id) {
        return source.label;
      }
    }
    return id;
  }
  $.verto.dialog.prototype.setAudioPlaybackDevice = function (sinkId, callback, arg) {
    var dialog = this;
    var element = dialog.audioStream;
    if (typeof element.sinkId !== "undefined") {
      var devname = find_name(sinkId);
      console.info("Dialog: " + dialog.callID + " Setting speaker:", element, devname);
      element
        .setSinkId(sinkId)
        .then(function () {
          console.log("Dialog: " + dialog.callID + " Success, audio output device attached: " + sinkId);
          if (callback) {
            callback(true, devname, arg);
          }
        })
        .catch(function (error) {
          var errorMessage = error;
          if (error.name === "SecurityError") {
            errorMessage = "Dialog: " + dialog.callID + " You need to use HTTPS for selecting audio output " + "device: " + error;
          }
          if (callback) {
            callback(false, null, arg);
          }
          console.error(errorMessage);
        });
    } else {
      console.warn("Dialog: " + dialog.callID + " Browser does not support output device selection.");
      if (callback) {
        callback(false, null, arg);
      }
    }
  };
  $.verto.dialog.prototype.setState = function (state) {
    var dialog = this;
    if (dialog.state == $.verto.enum.state.ringing) {
      dialog.stopRinging();
    }
    if (dialog.state == state || !checkStateChange(dialog.state, state)) {
      console.error("Dialog " + dialog.callID + ": INVALID state change from " + dialog.state.name + " to " + state.name);
      dialog.hangup();
      return false;
    }
    console.log("Dialog " + dialog.callID + ": state change from " + dialog.state.name + " to " + state.name);
    dialog.lastState = dialog.state;
    dialog.state = state;
    if (dialog.callbacks.onDialogState) {
      dialog.callbacks.onDialogState(this);
    }
    switch (dialog.state) {
      case $.verto.enum.state.early:
      case $.verto.enum.state.active:
        var speaker = dialog.useSpeak;
        console.info("Using Speaker: ", speaker);
        if (speaker && speaker !== "any" && speaker !== "none") {
          setTimeout(function () {
            dialog.setAudioPlaybackDevice(speaker);
          }, 500);
        }
        break;
      case $.verto.enum.state.trying:
        setTimeout(function () {
          if (dialog.state == $.verto.enum.state.trying) {
            dialog.setState($.verto.enum.state.hangup);
          }
        }, 30000);
        break;
      case $.verto.enum.state.purge:
        dialog.setState($.verto.enum.state.destroy);
        break;
      case $.verto.enum.state.hangup:
        if (dialog.lastState.val > $.verto.enum.state.requesting.val && dialog.lastState.val < $.verto.enum.state.hangup.val) {
          dialog.sendMethod("verto.bye", {});
        }
        dialog.setState($.verto.enum.state.destroy);
        break;
      case $.verto.enum.state.destroy:
        if (typeof dialog.verto.options.tag === "function") {
          $("#" + dialog.params.tag).remove();
        }
        delete dialog.verto.dialogs[dialog.callID];
        if (dialog.params.screenShare) {
          dialog.rtc.stopPeer();
        } else {
          dialog.rtc.stop();
        }
        break;
    }
    return true;
  };
  $.verto.dialog.prototype.processReply = function (method, success, e) {
  };
  $.verto.dialog.prototype.hangup = function (params) {
    var dialog = this;
    if (params) {
      if (params.causeCode) {
        dialog.causeCode = params.causeCode;
      }
      if (params.cause) {
        dialog.cause = params.cause;
      }
    }
    if (!dialog.cause && !dialog.causeCode) {
      dialog.cause = "NORMAL_CLEARING";
    }
    if (dialog.state.val >= $.verto.enum.state.new.val && dialog.state.val < $.verto.enum.state.hangup.val) {
      dialog.setState($.verto.enum.state.hangup);
    } else if (dialog.state.val < $.verto.enum.state.destroy) {
      dialog.setState($.verto.enum.state.destroy);
    }
  };
  $.verto.dialog.prototype.stopRinging = function () {

  };

  $.verto.dialog.prototype.ring = function () {

  };

  $.verto.dialog.prototype.transfer = function (dest, params) {

  };
  $.verto.dialog.prototype.answer = function (params) {

  };
  $.verto.dialog.prototype.handleAnswer = function (params) {

  };

  $.verto.dialog.prototype.sendMessage = function (msg, params) {

  };
  $.verto.dialog.prototype.handleInfo = function (params) {

  };
  $.verto.dialog.prototype.handleDisplay = function (params) {

  };
  $.verto.dialog.prototype.handleMedia = function (params) {
    var dialog = this;
    if (dialog.state.val >= $.verto.enum.state.early.val) {
      return;
    }
    dialog.gotEarly = true;

    dialog.rtc.answer(
      params.sdp,
      function () {
        console.log("Dialog " + dialog.callID + "Establishing early media");
        dialog.setState($.verto.enum.state.early);
        if (dialog.gotAnswer) {
          console.log("Dialog " + dialog.callID + "Answering Channel");
          dialog.setState($.verto.enum.state.active);
        }
      },
      function (e) {
        console.error(e);
        dialog.hangup();
      }
    );
    console.log("Dialog " + dialog.callID + "EARLY SDP", params.sdp);
  };
  $.verto.ENUM = function (s) {
    var i = 0,
      o = {};
    s.split(" ").map(function (x) {
      o[x] = { name: x, val: i++ };
    });
    return Object.freeze(o);
  };
  $.verto.enum = {};
  $.verto.enum.states = Object.freeze({
    new: { requesting: 1, recovering: 1, ringing: 1, destroy: 1, answering: 1, hangup: 1 },
    requesting: { trying: 1, hangup: 1, active: 1 },
    recovering: { answering: 1, hangup: 1 },
    trying: { active: 1, early: 1, hangup: 1 },
    ringing: { answering: 1, hangup: 1 },
    answering: { active: 1, hangup: 1 },
    active: { answering: 1, requesting: 1, hangup: 1, held: 1 },
    held: { hangup: 1, active: 1 },
    early: { hangup: 1, active: 1 },
    hangup: { destroy: 1 },
    destroy: {},
    purge: { destroy: 1 },
  });
  $.verto.enum.state = $.verto.ENUM("new requesting trying recovering ringing answering early active held hangup destroy purge");
  $.verto.enum.direction = $.verto.ENUM("inbound outbound");
  $.verto.enum.message = $.verto.ENUM("display info pvtEvent clientReady");
  $.verto.enum = Object.freeze($.verto.enum);
  $.verto.saved = [];
  $.verto.unloadJobs = [];
  var unloadEventName = "beforeunload";
  var iOS = ["iPad", "iPhone", "iPod"].indexOf(navigator.platform) >= 0;
  if (iOS) {
    unloadEventName = "pagehide";
  }
  $(window).bind(unloadEventName, function () {
    for (var f in $.verto.unloadJobs) {
      $.verto.unloadJobs[f]();
    }
    if ($.verto.haltClosure) return $.verto.haltClosure();
    for (var i in $.verto.saved) {
      var verto = $.verto.saved[i];
      if (verto) {
        verto.purge();
        verto.logout();
      }
    }
    return $.verto.warnOnUnload;
  });

  $.verto.init = function (obj, runtime) {
    if (!obj) {
      obj = {};
    }
    if (!obj.skipPermCheck && !obj.skipDeviceCheck) {
      $.FSRTC.checkPerms(
        function (status) {
          checkDevices(runtime);
        },
        true,
        true
      );
    } else if (obj.skipPermCheck && !obj.skipDeviceCheck) {
      checkDevices(runtime);
    } else if (!obj.skipPermCheck && obj.skipDeviceCheck) {
      $.FSRTC.checkPerms(
        function (status) {
          runtime(status);
        },
        true,
        true
      );
    } else {
      runtime(null);
    }
  };
  $.verto.genUUID = function () {
    return generateGUID();
  };
})(jQuery);