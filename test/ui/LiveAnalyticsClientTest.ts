/// <reference path="../Test.ts" />

module Coveo {
  describe('LiveAnalyticsClient', function () {
    var endpoint: AnalyticsEndpoint;
    var env: Mock.MockEnvironment;
    var client: LiveAnalyticsClient;
    var promise: Promise<IQueryResults>;

    beforeEach(function () {
      env = new Mock.MockEnvironmentBuilder().build();
      endpoint = Mock.mock<AnalyticsEndpoint>(AnalyticsEndpoint);
      client = new LiveAnalyticsClient(endpoint, env.root, 'foo', 'foo display', false, 'foo run name', 'foo run version', 'default', true);
      promise = new Promise((resolve, reject)=> {
        resolve(FakeResults.createFakeResults(3))
      })
    })

    afterEach(function () {
      env = null;
      endpoint = null;
      client = null;
      promise = null;
    })

    it('should send proper information on logSearchEvent', function (done) {

      client.logSearchEvent<IAnalyticsNoMeta>(AnalyticsActionCauseList.searchboxSubmit, {});
      var query: IQuery = {
        q: 'the query',
        aq: 'the advanced query',
        firstResult: 20,
        numberOfResults: 10,
        enableDidYouMean: true
      };

      Simulate.query(env, {
        query: query,
        promise: promise
      })
      _.defer(function () {
        var jasmineMatcher = jasmine.arrayContaining([jasmine.objectContaining({
          queryText: 'the query',
          advancedQuery: 'the advanced query',
          didYouMean: true,
          numberOfResults: 4,
          resultsPerPage: 10,
          pageNumber: 2,
          username: 'foo',
          userDisplayName: 'foo display',
          splitTestRunName: 'foo run name',
          splitTestRunVersion: 'foo run version'
        })])
        expect(endpoint.sendSearchEvents).toHaveBeenCalledWith(jasmineMatcher);
        done();
      })
    })

    it('should give precedence to query from the query state model instead of the one sent to the search api', (done) => {

      client.logSearchEvent<IAnalyticsNoMeta>(AnalyticsActionCauseList.searchboxSubmit, {});
      var query: IQuery = {
        q: 'the query',
        aq: 'the advanced query',
        firstResult: 20,
        numberOfResults: 10,
        enableDidYouMean: true
      };

      env.queryStateModel.get = ()=> {
        return 'another query';
      }

      Simulate.query(env, {
        query: query,
        promise: promise
      })

      _.defer(function () {
        var jasmineMatcher = jasmine.arrayContaining([jasmine.objectContaining({
          queryText: 'another query',
          advancedQuery: 'the advanced query',
          didYouMean: true,
          numberOfResults: 4,
          resultsPerPage: 10,
          pageNumber: 2,
          username: 'foo',
          userDisplayName: 'foo display',
          splitTestRunName: 'foo run name',
          splitTestRunVersion: 'foo run version'
        })])
        expect(endpoint.sendSearchEvents).toHaveBeenCalledWith(jasmineMatcher);
        done();
      })
    });

    describe('with multiple (3) search events', function () {
      var root: HTMLElement
      var env2: Mock.MockEnvironment;
      var env3: Mock.MockEnvironment;

      beforeEach(function () {
        root = document.createElement('div');
        env2 = new Mock.MockEnvironmentBuilder().build();
        env3 = new Mock.MockEnvironmentBuilder().build();
        root.appendChild(env.root);
        root.appendChild(env2.root);
        root.appendChild(env3.root);
        client = new LiveAnalyticsClient(endpoint, root, 'foo', 'foo display', false, 'foo run name', 'foo run version', 'default', true);
      })

      afterEach(function () {
        env = null;
        env2 = null;
        env3 = null;
        client = null;
        root = null;
      })

      it('should support when 3 analytics search events are triggered together, 3 events are pushed to the endpoint at the same time', (done) => {
        client.logSearchEvent<IAnalyticsNoMeta>(AnalyticsActionCauseList.searchboxSubmit, {});
        Simulate.query(env, {
          promise: promise,
          query: {
            q: 'the query 1'
          },
          deferSuccess: true
        });
        Simulate.query(env2, {
          promise: promise,
          query: {
            q: 'the query 2'
          },
          deferSuccess: true
        });
        Simulate.query(env3, {
          promise: promise,
          query: {
            q: 'the query 3'
          },
          deferSuccess: true
        });

        _.defer(function () {
          var jasmineMatcher = jasmine.arrayContaining([
            jasmine.objectContaining({
              queryText: 'the query 1'
            }),
            jasmine.objectContaining({
              queryText: 'the query 2'
            }),
            jasmine.objectContaining({
              queryText: 'the query 3'
            })])
          expect(endpoint.sendSearchEvents).toHaveBeenCalledWith(jasmineMatcher);
          done();
        })
      });

      it('should send only the new batch when search events are triggered together multiple times', function (done) {
        client.logSearchEvent<IAnalyticsNoMeta>(AnalyticsActionCauseList.searchboxSubmit, {});
        Simulate.query(env, {
          promise: promise,
          query: {
            q: 'the query 1'
          },
          deferSuccess: true
        });
        Simulate.query(env2, {
          promise: promise,
          query: {
            q: 'the query 2'
          },
          deferSuccess: true
        });
        Simulate.query(env3, {
          promise: promise,
          query: {
            q: 'the query 3'
          },
          deferSuccess: true
        });

        _.defer(function () {
          var jasmineMatcher = jasmine.arrayContaining([
            jasmine.objectContaining({
              queryText: 'the query 1'
            }),
            jasmine.objectContaining({
              queryText: 'the query 2'
            }),
            jasmine.objectContaining({
              queryText: 'the query 3'
            })])
          expect(endpoint.sendSearchEvents).toHaveBeenCalledWith(jasmineMatcher);
        })

        Simulate.query(env, {
          promise: promise,
          query: {
            q: 'the query 3'
          },
          deferSuccess: true
        });
        Simulate.query(env2, {
          promise: promise,
          query: {
            q: 'the query 4'
          },
          deferSuccess: true
        });
        Simulate.query(env3, {
          promise: promise,
          query: {
            q: 'the query 5'
          },
          deferSuccess: true
        });

        _.defer(function () {
          var jasmineMatcher = jasmine.arrayContaining([
            jasmine.objectContaining({
              queryText: 'the query 3'
            }),
            jasmine.objectContaining({
              queryText: 'the query 4'
            }),
            jasmine.objectContaining({
              queryText: 'the query 5'
            })])
          expect(endpoint.sendSearchEvents).toHaveBeenCalledWith(jasmineMatcher);
          done();
        })
      })

      it('should not break if a search event is followed by 0 during query', function (done) {
        client.logSearchEvent<IAnalyticsNoMeta>(AnalyticsActionCauseList.searchboxSubmit, {});
        Defer.flush();
        client.logSearchEvent<IAnalyticsNoMeta>(AnalyticsActionCauseList.searchboxSubmit, {});
        Simulate.query(env, {
          promise: promise,
          query: {
            q: 'the query 1'
          },
          deferSuccess: true
        });
        Simulate.query(env2, {
          promise: promise,
          query: {
            q: 'the query 2'
          },
          deferSuccess: true
        });
        Simulate.query(env3, {
          promise: promise,
          query: {
            q: 'the query 3'
          },
          deferSuccess: true
        });
        _.defer(function () {
          var jasmineMatcher = jasmine.arrayContaining([
            jasmine.objectContaining({
              queryText: 'the query 1'
            }),
            jasmine.objectContaining({
              queryText: 'the query 2'
            }),
            jasmine.objectContaining({
              queryText: 'the query 3'
            })])
          expect(endpoint.sendSearchEvents).toHaveBeenCalledWith(jasmineMatcher);
          done();
        })
      })

      it('should only send success events to the endpoint', function (done) {
        client.logSearchEvent<IAnalyticsNoMeta>(AnalyticsActionCauseList.searchboxSubmit, {});
        var promise2 = new Promise((resolve, reject)=> {
          reject();
        })

        promise2.catch(()=> {
        })

        Simulate.query(env, {
          promise: promise,
          query: {
            q: 'the query 1'
          },
          deferSuccess: true
        });
        Simulate.query(env2, {
          promise: promise2,
          query: {
            q: 'the query 2'
          },
          deferSuccess: true
        });
        Simulate.query(env3, {
          promise: promise,
          query: {
            q: 'the query 3'
          },
          deferSuccess: true
        });
        _.defer(function () {
          var jasmineMatcher = jasmine.arrayContaining([
            jasmine.objectContaining({
              queryText: 'the query 1'
            }),
            jasmine.objectContaining({
              queryText: 'the query 3'
            })])

          var jasmineMatcherNot = jasmine.arrayContaining([
            jasmine.objectContaining({
              queryText: 'the query 2'
            })])
          expect(endpoint.sendSearchEvents).toHaveBeenCalledWith(jasmineMatcher);
          expect(endpoint.sendSearchEvents).not.toHaveBeenCalledWith(jasmineMatcherNot);
          done();
        })
      })
    })

    it('should trigger an analytics event on document view', function () {
      var spy = jasmine.createSpy('spy');
      $$(env.root).on(AnalyticsEvents.documentViewEvent, spy);
      client.logClickEvent<IAnalyticsNoMeta>(AnalyticsActionCauseList.documentOpen, {}, FakeResults.createFakeResult('foo'), document.createElement('div'));
      Defer.flush();
      expect(spy).toHaveBeenCalled();
    })

    it('should trigger an analytics event on search event', function (done) {
      var spy = jasmine.createSpy('spy');
      $$(env.root).on(AnalyticsEvents.searchEvent, spy);
      client.logSearchEvent<IAnalyticsNoMeta>(AnalyticsActionCauseList.searchboxSubmit, {});
      Simulate.query(env, {
        query: {
          q: 'the query 1'
        },
        promise: new Promise((resolve, reject)=> {
          resolve(FakeResults.createFakeResults(3));
        })
      });
      _.defer(function () {
        expect(spy).toHaveBeenCalled();
        done();
      })
    })

    it('should trigger an analytics event on custom event', function () {
      var spy = jasmine.createSpy('spy');
      $$(env.root).on(AnalyticsEvents.customEvent, spy);
      client.logCustomEvent<IAnalyticsNoMeta>(AnalyticsActionCauseList.documentOpen, {}, document.createElement('div'));
      Defer.flush();
      expect(spy).toHaveBeenCalled();
    })

    it('should trigger change analytics metadata event', function () {
      var spy = jasmine.createSpy('spy');
      $$(env.root).on(AnalyticsEvents.changeAnalyticsCustomData, spy);
      client.logCustomEvent<IAnalyticsNoMeta>(AnalyticsActionCauseList.documentOpen, {}, document.createElement('div'));
      Defer.flush();
      expect(spy).toHaveBeenCalledWith(jasmine.any(Object), jasmine.objectContaining({
        originLevel1: 'default',
        originLevel2: 'default',
        originLevel3: undefined,
        language: String['locale'],
        type: 'CustomEvent',
        metaObject: jasmine.any(Object)
      }));
    })

    describe('search as you type', function () {
      beforeEach(function () {
        jasmine.clock().install();
      })
      afterEach(function () {
        jasmine.clock().uninstall();
      })

      it('should log after 5 seconds have passed since the last duringQueryEvent', function () {
        client.logSearchAsYouType<IAnalyticsNoMeta>(AnalyticsActionCauseList.searchboxSubmit, {});
        Simulate.query(env, {
          query: {
            q: 'the query 1'
          },
          promise: promise
        });
        jasmine.clock().tick(5);
        expect(client['pendingSearchAsYouTypeSearchEvent']['searchPromises'].length).toBe(0);
        jasmine.clock().tick(5000);
        expect(client['pendingSearchAsYouTypeSearchEvent']['searchPromises'].length).toBe(1);
      })

      it('should not log after 5 seconds have passed since the last duringQueryEvent if another event is pushed and it\'s a search box', function () {
        client.logSearchAsYouType<IAnalyticsNoMeta>(AnalyticsActionCauseList.searchboxSubmit, {});
        Simulate.query(env, {
          query: {
            q: 'the query 1'
          },
          promise: promise
        });
        jasmine.clock().tick(5);
        expect(client['pendingSearchAsYouTypeSearchEvent']).toBeDefined();
        client.logSearchEvent<IAnalyticsNoMeta>(AnalyticsActionCauseList.searchboxSubmit, {});
        Simulate.query(env, {
          query: {
            q: 'the query 1'
          },
          promise: promise
        });
        expect(client['pendingSearchAsYouTypeSearchEvent']).toBeUndefined();
      })

      it('should log after 5 seconds have passed since the last duringQueryEvent if another event is pushed and it\'s not a search box', function () {
        client.logSearchAsYouType<IAnalyticsNoMeta>(AnalyticsActionCauseList.searchboxSubmit, {});
        Simulate.query(env, {
          query: {
            q: 'the query 1'
          },
          promise: promise
        });
        jasmine.clock().tick(5);
        expect(client['pendingSearchAsYouTypeSearchEvent']).toBeDefined();
        client.logSearchEvent<IAnalyticsNoMeta>(AnalyticsActionCauseList.facetClearAll, {});
        Simulate.query(env, {
          query: {
            q: 'the query 1'
          },
          promise: promise
        });
        expect(client['pendingSearchAsYouTypeSearchEvent']).toBeDefined();
      })
    })
  })
}