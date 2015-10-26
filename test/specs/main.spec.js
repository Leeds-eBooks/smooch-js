'use strict';

var sinon = require('sinon');
var Backbone = require('backbone');
var urljoin = require('urljoin');

var ClientScenario = require('../scenarios/clientScenario');
var userData = require('../data/user');
var endpoint = require('../../src/js/endpoint');
var api = require('../../src/js/utils/api');

var SK_STORAGE = 'sk_deviceid';

describe('Main', function() {
    var scenario;
    var sandbox;
    var SupportKit;

    before(function() {
        scenario = new ClientScenario();
        scenario.build();
    });

    after(function() {
        scenario.clean();
    });

    beforeEach(function() {
        sandbox = sinon.sandbox.create();
        SupportKit = require('../../src/js/main.js');

        return SupportKit.init({
            appToken: 'thisisanapptoken'
        }).then(function() {
            sandbox.stub(SupportKit.user, 'save', function(attributes, options) {
                return this._save(attributes, options);
            });
        });

    });

    afterEach(function() {
        SupportKit.destroy();
        delete global.SupportKit;
        sandbox.restore();
    });

    describe('Global bindings', function() {
        // those tests are using the expect form since undefined
        // cannot be tested with the should syntax
        it('should publish a global', function() {
            global.SupportKit.should.exist;
        });

        it('should not publish dependencies in global context', function() {
            expect(global.Backbone).to.not.exist;
            expect(global.jQuery).to.not.exist;
            expect(global._).to.not.exist;
        });
    });

    describe('#init', function() {
        var userId = 'thisisauserid';
        var appToken = 'thisisanapptoken';
        var jwt = 'thisisajwt';
        var apiSpy;
        var initSpy;
        var readySpy;
        var loginSpy;

        beforeEach(function() {
            apiSpy = sandbox.spy(api, 'call');
            initSpy = sandbox.spy();
            readySpy = sandbox.spy();
            loginSpy = sandbox.spy(SupportKit, 'login');
        });

        it('should trigger ready, track appboot, login the user and resolve the promise', function() {
            SupportKit.destroy();
            SupportKit.appbootedOnce = false;

            SupportKit.once('ready', readySpy);

            var initPromise = SupportKit.init({
                appToken: appToken
            });

            return initPromise.then(initSpy).then(function() {
                loginSpy.should.have.been.calledOnce;
                initSpy.should.have.been.calledOnce;
            });
        });

        it('it should store the deviceId in local storage', function() {
            SupportKit.destroy();

            return SupportKit.init({
                appToken: appToken,
                userId: userId
            }).then(function() {
                localStorage.getItem(SK_STORAGE).should.exist;
            });
        });

        it('should populate endpoint with supplied appToken and jwt', function() {
            SupportKit.destroy();

            return SupportKit.init({
                appToken: appToken,
                jwt: jwt
            }).then(function() {
                endpoint.jwt.should.eql(jwt);
                endpoint.appToken.should.eql(appToken);
            });
        });

        it('should not populate endpoint jwt if unspecified', function() {
            SupportKit.destroy();

            return SupportKit.init({
                appToken: appToken
            }).then(function() {
                expect(endpoint.jwt).to.not.exist;
            });
        });

        it('should post platform device info to init', function() {
            SupportKit.destroy();

            return SupportKit.init({
                appToken: appToken
            }).then(function() {
                apiSpy.args[0][0].url.should.eql('v1/init');
                apiSpy.args[0][0].method.should.eql('POST');
                apiSpy.args[0][0].data.device.platform.should.eq('web');
            });
        });
    });

    describe('#login', function() {
        var cleanSpy;

        beforeEach(function() {
            cleanSpy = sandbox.spy(SupportKit, '_cleanState');
        });

        it('should cleanState', function() {
            return SupportKit.login('some_user_id').then(function() {
                cleanSpy.should.have.been.calledOnce;
            });
        });

        it('should receive a user even if no user id provided', function() {
            SupportKit._cleanState();

            return SupportKit.login().then(function() {
                endpoint.appUserId.should.equal(userData.appUser._id);
            });

        });

        it('should change the user id and jwt', function() {
            var oldUserId = endpoint.userId;
            var oldJwt = endpoint.jwt;

            var newUserId = 'new_user_id';
            var newJwt = 'new_jwt';

            return SupportKit.login(newUserId, newJwt).then(function() {
                newUserId.should.not.equal(oldUserId);
                newJwt.should.not.equal(oldJwt);

                endpoint.userId.should.equal(newUserId);
                endpoint.jwt.should.equal(newJwt);
            });

        });
    });

    describe('#logout', function() {
        var loginStub;
        beforeEach(function() {
            loginStub = sandbox.stub(SupportKit, 'login').returns(Promise.resolve());
        });

        it('should call login with no user id if ready', function() {
            SupportKit.true = false;
            SupportKit.logout().then(function() {
                loginStub.should.have.been.calledWithExactly();
            });
        });

        it('should do nothing if not ready', function() {
            SupportKit.ready = false;
            SupportKit.logout().then(function() {
                loginStub.should.not.have.been.called();
            });
        });
    });

    describe('#destroy', function() {
        beforeEach(function() {
            localStorage.setItem(SK_STORAGE, 'test');
            SupportKit.destroy();
        });

        afterEach(function() {
            localStorage.setItem(SK_STORAGE, undefined);
        });

        it('should not remove the device id from local storage', function() {
            expect(localStorage.getItem(SK_STORAGE)).to.exist;

        });

        it('should clear the endpoint of all variables', function() {
            expect(endpoint.appToken).to.not.exist;
            expect(endpoint.jwt).to.not.exist;
            expect(endpoint.appUserId).to.not.exist;
        });
    });

    describe('#updateUser', function() {

        // check if `save` actually calls the server or not
        var syncSpy;
        beforeEach(function() {
            syncSpy = sandbox.spy(Backbone, 'sync');
        });

        it('should fail the promise if called with bad parameters (empty, in this case)', function() {
            var failed;
            return SupportKit.updateUser()
                .catch(function() {
                    failed = true;
                })
                .then(function() {
                    failed.should.be.true;
                });
        });

        it('should not call save if the user has not changed', function() {
            return SupportKit.updateUser({
                givenName: 'GIVEN_NAME',
                surname: 'SURNAME',
                properties: {
                    'TEST': true
                }
            }).then(function() {
                syncSpy.should.be.calledOnce;

                return SupportKit.updateUser({
                    givenName: 'GIVEN_NAME',
                    surname: 'SURNAME',
                    properties: {
                        'TEST': true
                    }
                });
            }).then(function() {
                syncSpy.should.be.calledOnce;
            });
        });
    });

    describe('#_cleanState', function() {

        beforeEach(function() {
            localStorage.setItem(SK_STORAGE, 'test');
        });

        afterEach(function() {
            localStorage.setItem(SK_STORAGE, undefined);
        });

        it('should not remove the device id from local storage', function() {
            expect(localStorage.getItem(SK_STORAGE)).to.exist;
        });

        it('should clear endpoint values but keep the app token', function() {
            SupportKit._cleanState();

            expect(endpoint.appToken).to.exist;
            expect(endpoint.jwt).to.not.exist;
            expect(endpoint.appUserId).to.not.exist;
        });
    });

    describe('#track', function() {
        var api = require('../../src/js/utils/api');
        var apiSpy;

        beforeEach(function() {
            apiSpy = sandbox.spy(api, 'call');
        });

        it('should call /v1/appusers/:id/event', function() {
            SupportKit.track('new-event');

            apiSpy.args[0][0].url.should.eq(urljoin(SupportKit.user.url(), 'events'));
            apiSpy.args[0][0].method.should.eq('POST');
            apiSpy.args[0][0].data.name.should.eq('new-event');
        });
    });
});
