import { PwaController } from './pwa.controller';
import { CHEESE_PWA_MANIFEST } from './pwa.constants';

describe('PwaController', () => {
  let controller: PwaController;

  beforeEach(() => {
    controller = new PwaController();
  });

  it('returns the Cheese PWA manifest', () => {
    expect(controller.getManifest()).toEqual(CHEESE_PWA_MANIFEST);
  });
});
