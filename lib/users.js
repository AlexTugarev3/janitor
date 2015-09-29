var emaillogin = require('email-login');

var db = require('./db');
var log = require('./log');

var login = new emaillogin({
  directory: './tokens/',
  mailer: db.get('mailer')
});


// Get a user for the current session.

function get (data, query, callback) {

  getSession(query, function (err, session, token) {
    // See if the user is properly logged in.
    if (session.emailVerified()) {
      callback(err, getUser(session.email));
      return;
    }
    // If not, see if there is a login key.
    var key = data.key;
    if (!key) {
      callback(err, null);
      return;
    }
    // We have a login key, let's see if it confirms the user's email.
    log('confirming email', session.email);
    login.confirmEmail(token, key, function (err, token, session) {
      if (session.emailVerified()) {
        log('confirmed!');
        callback(err, getUser(session.email));
        return;
      }
      // No luck this time.
      log('not confirmed');
      callback(err, null);
      return;
    })
  });

}

exports.get = get;


// Send a single-use login link to the user's email address.

function sendLoginEmail (email, query, callback) {

  getSession(query, function (err, session, token) {
    if (!db.get('users')[email]) {
      callback('Error: Signing in currently requires an invitation');
      return;
    }
    login.proveEmail({
      token: token,
      email: email,
      subject: function () {
        return 'Janitor sign-in';
      },
      htmlMessage: function (key) {
        return '<p>Hello,</p>' +
        '<p>To sign in to the Janitor, please click ' +
        '<a href="https://janitor.technology/?key=' + key  + '">here</a>.</p>' +
        '<p>Thanks!<br>The Janitor</p>';
      }
    }, function (err) {
      callback(err);
    });
  });

}

exports.sendLoginEmail = sendLoginEmail;


// Destroy the current session.

function logout (query, callback) {

  getSession(query, function (err, session, token) {
    login.logout(token, function (err) {
      callback(err);
    });
  });

}

exports.logout = logout;


// Find the current session, or create a new one.

function getSession (query, callback) {

  var token = query.cookies.get('token');

  login.authenticate(token, function (err, success, session) {
    if (success) {
      callback(err, session, token);
      return;
    }
    // No current session, create a new one.
    login.login(function (err, token, session) {
      query.cookies.set('token', token);
      callback(err, session, token);
      return;
    });
  });

} // Don't export `getSession`.


// Find an existing user, or create a new one.

function getUser (email) {

  var users = db.get('users');
  var user = users[email];

  if (!user) {
    // Idea: auto-verify a new user's email the first time?
    user = {
      emails: [ email ],
      machines: []
    }
    users[email] = user;
    db.save();
  }

  return user;

} // Don't export `getUser`.