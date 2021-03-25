/*!
 * Copyright (c) 2020 Digital Bazaar, Inc. All rights reserved.
 */
import {scan} from '..';

describe('Scan Tests', () => {
  it(`should properly export authorize`, async () => {
    (typeof scan === 'function').should.be.true;
  });
});
