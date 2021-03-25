/*!
 * Copyright (c) 2021 Digital Bazaar, Inc. All rights reserved.
 */
import {scan} from '..';

describe('Scan Tests', () => {
  it(`should properly export authorize`, async () => {
    (typeof scan === 'function').should.be.true;
  });
});
