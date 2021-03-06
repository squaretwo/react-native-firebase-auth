import * as firebase from 'firebase';
import Auth from './auth';

const FireAuth = class {
  user = null;
  googleAccessToken = undefined;
  profile = null;
  onUserChange = null;
  onLogout = null;
  onEmailVerified = null;
  onLogin = null;
  onError = null;

  init(googleConfig) {
    Auth.Google.configure(googleConfig);
  }

  setup = (onLogin, onUserChange, onLogout, onEmailVerified, onError) => {
    this.onUserChange = onUserChange;
    this.onLogout = onLogout;
    this.onEmailVerified = onEmailVerified;
    this.onLogin = onLogin;
    this.onError = onError;

    firebase.auth().onAuthStateChanged((user)=> {

      if (user) {
        // Determine if user needs to verify email
        var emailVerified = !user.providerData || !user.providerData.length || user.providerData[0].providerId != 'password' || user.emailVerified;

        // Upsert profile information
        var profileRef = firebase.database().ref(`profiles/${user.uid}`);
        profileRef.update({ emailVerified: emailVerified, email: user.email });

        profileRef.on('value', (profile)=> {
          const val = profile.val();

          // Email become verified in session
          if (val.emailVerified && (this.profile && !this.profile.val().emailVerified)) {
            this.onEmailVerified && this.onEmailVerified();
          }

          if (!this.user) {
            this.onLogin && this.onLogin(user, val); // On login
          } else if (val) {
            this.onUserChange && this.onUserChange(user, val); // On updated
          }

          this.profile = profile; // Store profile
          this.user = user; // Store user
        });

      } else {
        this.profile = null;
        this.user = null; // Clear user and logout
        this.onLogout && this.onLogout();
      }

    });
  }

  login = (email, password) => {
    try {
      firebase.auth().signInWithEmailAndPassword(email, password)
        .catch((err) => this.onError && this.onError(err));
    } catch (e) {
      this.onError && this.onError(e);
    }
  }

  loginAnonymously = () => {
    try {
      firebase.auth().signInAnonymously()
        .catch((err) => this.onError && this.onError(err));
    } catch (e) {
      this.onError && this.onError(e);
    }
  }

  register = (username, password) => {
    try {
      firebase.auth().createUserWithEmailAndPassword(username, password)
        .then((user)=> {
          user.sendEmailVerification();
        })
        .catch((err) => this.onError && this.onError(err));
    } catch (e) {
      this.onError && this.onError(e);
    }
  }

  resendVerification = () => {
    this.user.sendEmailVerification();
  }

  facebookLogin = (permissions) => {
    Auth.Facebook.login(permissions)
      .then((token) => (
        firebase.auth()
          .signInWithCredential(firebase.auth.FacebookAuthProvider.credential(token))
      ))
      .catch((err) => this.onError && this.onError(err));
  }

  googleLogin = () => {
    Auth.Google.login()
      .then((user) => {
        if (user.email) {
          firebase.auth().fetchProvidersForEmail(user.email).then((providers) => {
            if (providers.length > 0 && providers[0] === 'facebook.com') {
            this.onError && this.onError({message:'An account already exists with the same email address but different sign-in credentials. Sign in using a provider associated with this email address.'});
          } else {
            this.googleAccessToken = user.accessToken
            firebase.auth()
              .signInWithCredential(firebase.auth.GoogleAuthProvider.credential(null, user.accessToken))
          }
          });
        } else {
          firebase.auth()
            .signInWithCredential(firebase.auth.GoogleAuthProvider.credential(null, user.accessToken))
        }
      })
      .catch((err) => this.onError && this.onError(err));
  }

  googleLoginWithProvider = (providerCallbackPromise) => {
    Auth.Google.login()
      .then((user) => {
        if (user.email) {
        providerCallbackPromise(user.email).then((provider) => {
          if (provider === 'facebook') {
            this.onError && this.onError({message:'An account already exists with the same email address but different sign-in credentials. Sign in using a provider associated with this email address.'});
          } else {
            this.googleAccessToken = user.accessToken
            firebase.auth()
              .signInWithCredential(firebase.auth.GoogleAuthProvider.credential(null, user.accessToken))
          }
        });
      } else {
        firebase.auth()
          .signInWithCredential(firebase.auth.GoogleAuthProvider.credential(null, user.accessToken))
      }
    })
    .catch((err) => this.onError && this.onError(err));
  }

  logout = () => {
    this.user = null;
    this.profile = null;
    firebase.auth().signOut();
  }

  update = (data) => {
    var profileRef = firebase.database().ref(`profiles/${this.user.uid}`);
    return profileRef.update(data);
  }

  resetPassword = (email) => {
    firebase.auth().sendPasswordResetEmail(email);
  }

  updatePassword = (password) => {
    this.user.updatePassword(password);
  }

  linkWithGoogle = () => {
    // @TODO
  }

  linkWithFacebook = () => {
    // @TODO
  }

  linkWithEmail = () => {
    // @TODO
  }
};

export default new FireAuth();
