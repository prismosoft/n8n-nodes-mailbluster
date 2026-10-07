const test = require('node:test');
const assert = require('node:assert/strict');

const {
  leadIdentifierToHash,
  parseJsonObject,
  responseArray,
  responseNextPage,
} = require('../dist/nodes/MailBluster/helpers/utils.js');

const node = {
  id: 'test',
  name: 'Test',
  type: 'test',
  typeVersion: 1,
  position: [0, 0],
  parameters: {},
};

test('hashes lead emails exactly as MailBluster expects', () => {
  assert.equal(
    leadIdentifierToHash('richard@example.com'),
    '5a91f0b2d2c1e5c3229d906d978b7337',
  );
});

test('leaves an existing lead hash untouched', () => {
  const hash = '5a91f0b2d2c1e5c3229d906d978b7337';
  assert.equal(leadIdentifierToHash(hash), hash);
});

test('parses JSON objects and rejects arrays', () => {
  assert.deepEqual(parseJsonObject('{"company":"Prismosoft"}', 'Meta', node), {
    company: 'Prismosoft',
  });
  assert.throws(() => parseJsonObject('[]', 'Meta', node), /must be a JSON object/);
});

test('extracts paginated API records and next page', () => {
  const response = {
    products: [{ id: '101', name: 'Product' }],
    meta: { pageNo: 1, nextPageNo: 2 },
  };
  assert.deepEqual(responseArray(response, 'products'), [{ id: '101', name: 'Product' }]);
  assert.equal(responseNextPage(response), 2);
});
