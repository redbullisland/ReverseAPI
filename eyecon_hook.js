// Eyecon network + CID capture (stable hooks only)
function log(s) { console.log('[' + new Date().toISOString() + '] ' + s); }

Java.perform(function () {
  // 1) Every app HTTP request/response with raw body
  try {
    var NH = Java.use('com.eyecon.global.Network.NetworkHelper');
    var orig = NH.j.overload('java.util.ArrayList', 'java.lang.String', 'java.lang.String', '[I',
      'boolean', 'java.lang.String', 'java.util.Map', 'boolean', 'boolean',
      'java.util.Map', 'java.lang.String');
    orig.implementation = function (params, url, method, codes, acceptJson, endpoint, headers, auth, gzip, respHeaders, rid) {
      var ps = [];
      try {
        var it = params.iterator();
        while (it.hasNext()) ps.push(String(it.next()));
      } catch (e) {}
      log('REQ ' + method + ' ' + url + ' | endpoint=' + endpoint + ' auth=' + auth);
      log('  params=' + ps.join('&'));
      var result = null, err = null;
      try {
        result = orig.call(this, params, url, method, codes, acceptJson, endpoint, headers, auth, gzip, respHeaders, rid);
      } catch (e) { err = e; }
      var code = 'n/a';
      try { code = codes[0]; } catch (e2) {}
      if (err) {
        log('RES endpoint=' + endpoint + ' THREW ' + err);
        throw err;
      }
      log('RES endpoint=' + endpoint + ' code=' + code + ' len=' + (result ? result.length : 0) +
          ' body=' + (result ? String(result).substring(0, 2000) : 'null'));
      return result;
    };
    log('HOOK NetworkHelper.j installed');
  } catch (e) {
    log('HOOK NetworkHelper.j FAILED: ' + e);
  }

  // 2) CID being saved to shared prefs
  try {
    var Editor = Java.use('com.eyecon.global.Others.Objects.EyeconSharedPreference$EyeconEditor');
    var origC = Editor.c.overload('java.lang.Object', 'java.lang.String');
    origC.implementation = function (value, key) {
      var k = String(key);
      if (k.indexOf('clientId') >= 0 || k.indexOf('validation') >= 0 || k.indexOf('VALIDATION') >= 0) {
        log('*** PREF SAVE ' + k + ' = [' + value + ']');
      }
      return origC.call(this, value, key);
    };
    log('HOOK EyeconEditor.c installed');
  } catch (e) {
    log('HOOK EyeconEditor.c FAILED: ' + e);
  }

  // 3) CID reads
  try {
    var Auth = Java.use('com.eyecon.global.Registration.Authenticator');
    var origGet = Auth.d.overload();
    origGet.implementation = function () {
      var v = origGet.call(this);
      log('Authenticator.d() clientId = [' + v + ']');
      return v;
    };
    log('HOOK Authenticator.d installed');
  } catch (e) {
    log('HOOK Authenticator.d FAILED: ' + e);
  }

  // 4) Firebase token fetch
  try {
    var PS = Java.use('com.eyecon.global.Push.PushService');
    var origPush = PS.f.overload('com.eyecon.global.Others.Interfaces.CallbackForResults');
    origPush.implementation = function (cb) {
      log('PushService.f (Firebase getToken) called');
      return origPush.call(this, cb);
    };
    log('HOOK PushService.f installed');
  } catch (e) {
    log('HOOK PushService.f FAILED: ' + e);
  }
});
