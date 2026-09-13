// Shared JSON body reader for api/* handlers (Node http + Vercel compatible).

function readJsonBody(req, callback) {
  if (req.body && typeof req.body === 'object') {
    callback(req.body);
    return;
  }
  let body = '';
  req.on('data', function (chunk) {
    body += chunk;
    if (body.length > 1e6) req.destroy();
  });
  req.on('end', function () {
    try {
      callback(body ? JSON.parse(body) : {});
    } catch (err) {
      callback({ __invalid: true, message: err.message });
    }
  });
}

module.exports = { readJsonBody };