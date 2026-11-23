// Minimal: only log HTTP requests/responses
function log(s) { console.log(s); }
Java.perform(function () {
  try {
    var NH = Java.use('com.eyecon.global.Network.NetworkHelper');
    var orig = NH.j.overload('java.util.ArrayList', 'java.lang.String', 'java.lang.String', '[I',
      'boolean', 'java.lang.String', 'java.util.Map', 'boolean', 'boolean',
      'java.util.Map', 'java.lang.String');
    orig.implementation = function (params, url, method, codes, acceptJson, endpoint, headers, auth, gzip, respHeaders, rid) {
      var ps = [];
      try { var it = params.iterator(); while (it.hasNext()) ps.push(String(it.next())); } catch (e) {}
      log('REQ ' + method + ' ' + url + ' | endpoint=' + endpoint + ' auth=' + auth);
      log('  params=' + ps.join('&'));
      var result = null, err = null;
      try { result = orig.call(this, params, url, method, codes, acceptJson, endpoint, headers, auth, gzip, respHeaders, rid); }
      catch (e) { err = e; }
      var code = 'n/a';
      try { code = codes[0]; } catch (e2) {}
      if (err) { log('RES ' + endpoint + ' THREW ' + err); throw err; }
      log('RES ' + endpoint + ' code=' + code + ' len=' + (result ? result.length : 0) +
          ' body=' + (result ? String(result).substring(0, 2000) : 'null'));
      return result;
    };
    log('HOOK NetworkHelper.j installed');
  } catch (e) { log('HOOK FAILED: ' + e); }
});
