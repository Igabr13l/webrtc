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

  };

  function onICESDP(self, sdp) {
    self.mediaData.SDP = sdp.sdp;
    self.options.callbacks["onICESDP"](self);
  }

  function onRemoteStream(self, stream) {
    var element = self.options.useAudio;
    if (typeof element.srcObject !== "undefined") {
      element.srcObject = stream;
    }
  }

  $.FSRTC.prototype.answer = function (sdp) {
    this.peer.addAnswerSDP({ type: "answer", sdp: sdp });
  };

  function getMediaParams(obj) {
    var audio;
    audio = {};
    if (obj.options.audioParams) {
      audio = obj.options.audioParams;
    }
    if (obj.options.useMic !== "any") {
      audio.deviceId = { exact: obj.options.useMic };
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
        onRemoteStream: (stream) => onRemoteStream(self, stream),
        onICESDP: function (sdp) {
          return onICESDP(self, sdp);
        },
        constraints: self.constraints,
        iceServers: self.options.iceServers,
        turnServer: self.options.turnServer,
      });
    }
    var mediaParams = getMediaParams(self);
    if (mediaParams.audio || mediaParams.video) {
      getUserMedia({ constraints: { audio: mediaParams.audio, video: mediaParams.video }, video: mediaParams.useVideo, onsuccess: onSuccess, onerror: () => { } });
    }
  };

  function FSRTCPeerConnection(options) {
    var gathering = false;
    var done = false;

    var peer = new window.RTCPeerConnection({
      bundlePolicy: "max-compat",
    });

    var x = 0;
    function ice_handler() {
      done = true;
      gathering = null;
      if (options.type == "offer") {
        options.onICESDP(peer.localDescription);
      }
    }
    peer.onicecandidate = function () {
      if (!gathering) {
        gathering = setTimeout(ice_handler, 1000);
      }
      done = true;
      if (gathering) {
        clearTimeout(gathering);
        gathering = null;
      }
      ice_handler();
    };
    if (options.attachStream) {
      const stream = options.attachStream;
      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });
    }

    peer.ontrack = function (event) {
      if (options.onRemoteStream) options.onRemoteStream(event.streams[0]);
    }

    if (options.onChannelMessage || !options.onChannelMessage) {
      const offer = peer.createOffer();
      peer.setLocalDescription(offer);
    }
    var channel;

    return {
      addAnswerSDP: function (sdp) {
        const answer = new window.RTCSessionDescription(sdp);
        peer.setRemoteDescription(answer);
      },
      peer,
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
              () => {
                console.error("Error logging in");
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
      this.options.onmessage(event);
    }
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
  $.verto.prototype.newCall = function (args, callbacks) {
    var verto = this;

    var dialog = new $.verto.dialog($.verto.enum.direction.outbound, this, args);
    dialog.invite();
    return dialog;
  };
  $.verto.prototype.handleMessage = function (data) {
    var verto = this;

    if (data.params.callID) {
      var dialog = verto.dialogs[data.params.callID];
      if (dialog) {
        switch (data.method) {
          case "verto.media":
            dialog.handleMedia(data.params);
            break;
        }
      }
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
    }
    RTCcallbacks.onICESDP = function (rtc) {
      console.log("RECV " + rtc.type + " SDP", rtc.mediaData.SDP);
      if (dialog.state == $.verto.enum.state.requesting || dialog.state == $.verto.enum.state.answering || dialog.state == $.verto.enum.state.active) {
        location.reload();
        return;
      }
      if (rtc.type == "offer") {
        if (dialog.state == $.verto.enum.state.active) {
          dialog.sendMethod("verto.attach", { sdp: rtc.mediaData.SDP });
        } else {
          dialog.sendMethod("verto.invite", { sdp: rtc.mediaData.SDP });
        }
      }
    };

    RTCcallbacks.onRemoteStream = function (rtc, stream) {
      if (typeof dialog.callbacks.onRemoteStream === "function") {
        dialog.callbacks.onRemoteStream(stream, dialog);
      }
      console.log("remote stream started");
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

  $.verto.dialog.prototype.handleMedia = function (params) {
    var dialog = this;
    dialog.gotEarly = true;
    dialog.rtc.answer(params.sdp);
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

})(jQuery);