import 'mocha';
import { IDictionary } from 'common-types';
import * as chai from 'chai';
import * as helpers from './testing/helpers';
import Mock, { Delays } from '../src/mock';
import SchemaHelper from '../src/schema-helper';
import { first, last } from 'lodash';
import SnapShot from '../src/snapshot';
import { 
  firstProp, 
  lastProp, 
  firstKey, 
  lastKey 
} from '../src/util';

const expect = chai.expect;
describe('Reference functions', () => {
  const mocker = (h: SchemaHelper) => () => 'result';

  describe('Basic DB Querying', () => {

    it('using onceSync(), querying returns a synchronous result', () => {
      const m = new Mock();
      m.addSchema('cat').mock(mocker);
      m.addSchema('bar').mock(mocker);
      m.deploy.queueSchema('cat', 5).queueSchema('bar', 5).generate();
      const results = m.ref('/cats').onceSync('value') as SnapShot;
      expect(results.val).to.be.a('function');
      expect(results.child).to.be.a('function');
      expect(results.hasChild).to.be.a('function');

      expect(results.key).to.equal('cats');
      // expect(firstProp(results.val())).to.equal('result');
    });

    it('with default 5ms delay, querying returns an asynchronous result', done => {
      const m = new Mock();
      m.addSchema('foo').mock(mocker);
      m.addSchema('bar').mock(mocker);
      m.deploy.queueSchema('foo', 5).queueSchema('bar', 5).generate();
      m.ref('/foos').once('value').then((results) => {
        expect(results.numChildren()).is.equal(5);
        // expect(firstProp<string>(results.val())).to.equal('result');
        done();
      });
    });

    it('with numeric delay, querying returns an asynchronous result', done => {
      const m = new Mock();
      m.addSchema('foo').mock(mocker);
      m.addSchema('bar').mock(mocker);
      m.deploy.queueSchema('foo', 5).queueSchema('bar', 5).generate();
      m.setDelay(100);
      m.ref('/foos').once('value').then((results: any) => {
        expect(results.numChildren()).is.equal(5);
        // expect(firstProp(results.val())).is.equal('result');
        done();
      });
    });

    it('with named delay, querying returns an asynchronous result', done => {
      const m = new Mock();
      m.addSchema('foo').mock(mocker);
      m.addSchema('bar').mock(mocker);
      m.deploy.queueSchema('foo', 5).queueSchema('bar', 5).generate();
      m.setDelay(Delays.mobile);
      m.ref('/foos').once('value').then(results => {
        expect(results.numChildren()).is.equal(5);
        // expect(firstProp<string>(results.val())).is.equal('result');
        done();
      });
    });

    it('with delay range, querying returns an asynchronous result', done => {
      const m = new Mock();
      m.addSchema('foo').mock(mocker);
      m.addSchema('bar').mock(mocker);
      m.deploy.queueSchema('foo', 5).queueSchema('bar', 5).generate();
      m.setDelay([50, 80]);
      m.ref('/foos').once('value').then((results: any) => {
        expect(results.numChildren()).is.equal(5);
        // expect(firstProp(results.val())).is.equal('result');
        done();
      });
    });

    it('querying results can be iterated over with forEach()', done => {
      const m = new Mock();
      m.addSchema('user').mock((h) => () => ({
        name: h.faker.name.firstName() + ' ' + h.faker.name.lastName(),
        gender: h.faker.helpers.randomize(['male', 'female'])
      }));
      m.deploy.queueSchema('user', 5).generate();
      m.setDelay([50, 80]);
      m.ref('/users').once('value').then(snap => {
        snap.forEach(r => {
          expect(r.val()).to.be.an('object');
          expect(r.val().name).to.be.a('string');
        });
        done();
      });
    });

  });
  describe('Filtered querying', () => {

    it('query list with limitToFirst() set', done => {
      const m = new Mock();
      m.addSchema('monkey').mock(mocker);
      m.deploy.queueSchema('monkey', 15).generate();
      m.ref('/monkeys')
        .limitToFirst(10)
        .once('value')
        .then(snap => {
          const listOf = snap.val();
          expect(snap.numChildren()).to.equal(10);
          expect(Object.keys(m.db.monkeys).length).to.equal(15);
          expect(Object.keys(m.db.monkeys).indexOf(firstKey(listOf))).to.not.equal(-1);
          expect(Object.keys(m.db.monkeys).indexOf(lastKey(listOf))).to.not.equal(-1);
          expect(Object.keys(listOf).indexOf(lastKey(m.db.monkeys))).to.equal(-1);

          done();
        });
    });

    it('query list with limitToLast() set', done => {
      const m = new Mock();
      m.addSchema('monkey').mock(mocker);
      m.deploy.queueSchema('monkey', 15).generate();
      m.ref('/monkeys')
        .limitToLast(10)
        .once('value')
        .then(snap => {
          const listOf = snap.val();
          expect(snap.numChildren()).to.equal(10);
          expect(Object.keys(m.db.monkeys).length).to.equal(15);
          expect(Object.keys(m.db.monkeys).indexOf(lastKey(listOf))).to.not.equal(-1);
          expect(Object.keys(m.db.monkeys).indexOf(firstKey(listOf))).to.not.equal(-1);
          expect(Object.keys(listOf).indexOf(firstKey(m.db.monkeys))).to.equal(-1);

          done();
        });
    });

    it('equalTo() reduces query to only those equal to child property', done => {
      const m = new Mock();
      const young = (h: SchemaHelper) => () => ({
        first: h.faker.name.firstName,
        age: 12
      });
      const old = (h: SchemaHelper) => () => ({
        first: h.faker.name.firstName,
        age: 75
      });
      m.addSchema('oldPerson', old) 
        .modelName('person');
      m.addSchema('youngPerson', young)
        .modelName('person');
      m.deploy
        .queueSchema('oldPerson', 10)
        .queueSchema('youngPerson', 10)
        .generate();
      m.ref('/people')
        .equalTo(12, 'age')
        .once('value')
        .then(snap => {
          expect(Object.keys(m.db.people).length).to.equal(20);
          expect(snap.numChildren()).to.equal(10);

          done();
        });
    });

    it('startAt() filters a numeric property', () => {
      const m = new Mock();
      m.addSchema('dog', (h) => () => ({
        name: h.faker.name.firstName,
        age: 3
      }));
      m.queueSchema('dog', 10);
      m.queueSchema('dog', 10, { age: 5 });
      m.queueSchema('dog', 10, { age: 10 });
      m.generate();
      
      const results = m.ref('/dogs').onceSync('value');
      const gettingMature = m.ref('/dogs').startAt(5, 'age').onceSync('value');
      const mature = m.ref('/dogs').startAt(9, 'age').onceSync('value');

      expect(results.numChildren()).to.equal(30);
      expect(gettingMature.numChildren()).to.equal(20);
      expect(mature.numChildren()).to.equal(10);
    });

    it('startAt() filters a string property', () => {
      const m = new Mock();
      m.addSchema('dog', (h) => () => ({
        name: h.faker.name.firstName,
        born: "2014-09-08T08:02:17-05:00"
      }));
      m.queueSchema('dog', 10);
      m.queueSchema('dog', 10, { born: "2014-11-08T08:02:17-05:00" });
      m.queueSchema('dog', 10, { born: "2016-12-08T08:02:17-05:00" });
      m.generate();
      
      const all = m.ref('/dogs').onceSync('value');
      const nov14 = m.ref('/dogs').startAt("2014-11-01T01:00:00-05:00", 'born').onceSync('value');
      const pupsOnly = m.ref('/dogs').startAt("2016-12-01T08:02:17-05:00", 'born').onceSync('value');

      expect(all.numChildren()).to.equal(30);
      expect(nov14.numChildren()).to.equal(20);
      expect(pupsOnly.numChildren()).to.equal(10);
    });


    it.skip('startAt() filters sort by value when using value sort');
    it.skip('endAt() filters result by key by default');
    it('endAt() filters a numeric property', () => {
      const m = new Mock();
      m.addSchema('dog', (h) => () => ({
        name: h.faker.name.firstName,
        age: 1
      }));
      m.queueSchema('dog', 10);
      m.queueSchema('dog', 10, { age: 5 });
      m.queueSchema('dog', 10, { age: 10 });
      m.generate();
      
      const results = m.ref('/dogs').onceSync('value');
      const pups = m.ref('/dogs').endAt(2, 'age').onceSync('value');

      expect(results.numChildren()).to.equal(30);
      expect(pups.numChildren()).to.equal(10);
    });    
    it.skip('endAt() filters sort by value when using value sort');
    it.skip('startAt() combined with endAt() filters correctly');
    it.skip('startAt(), endAt(), orderByValue() filters correctly');

  }); // End Filtered Querying

  describe('Sort Order', () => {

    it.skip('orderByChild() sorts correctly');
    it.skip('orderByKey() sorts correctly');
    it.skip('orderByValue() sorts correctly');

    it.skip('orderByChild() combines with limitToFirst() for "server-side" selection');
    it.skip('orderByChild() combines with limitToLast() for "server-side" selection');

  });

});